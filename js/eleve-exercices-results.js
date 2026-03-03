/**
 * eleve-exercices-results.js
 *
 * Sauvegarde des résultats, mise à jour des stats locales,
 * écran de résultat SF avec progression, et animation de célébration.
 *
 * Étend EleveExercices via Object.assign.
 */
Object.assign(EleveExercices, {
    // ===============================
    // SAUVEGARDE RÉSULTATS
    // ===============================

    async saveResult(correct, total, percent) {
        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = this.currentExercise?.duree || 300;

        // Capturer isEntrainementLibre AU DÉBUT avant tout appel async
        // Car la valeur peut changer pendant les awaits
        const isEntrainementLibreSnapshot = this.isEntrainementLibre;

        // Pour les savoir-faire, calculer la validation au niveau banque
        let validationResult = null;
        if (this.currentType === 'savoir-faire' && this.currentExercise) {
            const banqueId = String(this.currentExercise.banque_id);
            const statsBanque = this.statsSFBanque[banqueId];
            validationResult = this.validerRepetitionSF(this.currentExercise, percent, timeSpent, statsBanque);

            // Stocker le résultat de validation pour l'écran de résultat
            this.lastValidationResult = validationResult;

            // Mettre à jour les stats locales
            const pratiqueData = {
                eleve_id: this.currentUser?.id || 'preview',
                exercice_id: this.currentExercise.id,
                banque_id: this.currentExercise.banque_id,
                score: percent,
                temps_passe: timeSpent,
                temps_prevu: tempsPrevu,
                repetition_validee: validationResult.repetitionValidee,
                nouvelle_repetition: validationResult.nouvelleRepetition,
                est_entrainement_libre: isEntrainementLibreSnapshot
            };
            this.updateLocalStatsSF(pratiqueData);
        }

        // Ne pas sauvegarder au backend si pas d'utilisateur
        if (!this.currentUser || !this.currentUser.id || !this.currentExercise) {
            return;
        }

        const resultData = {
            eleve_id: this.currentUser.id,
            exercice_id: this.currentExercise.id,
            banque_id: this.currentExercise.banque_id,
            score: percent,
            bonnes_reponses: correct,
            total_questions: total,
            temps_passe: timeSpent,
            date: new Date().toISOString()
        };

        try {
            const result = await this.callAPI('saveResultatExercice', resultData);
            if (result.success) {
                this.updateLocalResult(resultData);
            }

            // Pour les savoir-faire, sauvegarder dans l'historique des pratiques
            if (this.currentType === 'savoir-faire') {
                const pratiqueData = {
                    eleve_id: this.currentUser.id,
                    exercice_id: this.currentExercise.id,
                    banque_id: this.currentExercise.banque_id,
                    score: percent,
                    temps_passe: timeSpent,
                    temps_prevu: tempsPrevu,
                    repetition_numero: validationResult?.repetitionValidee ? validationResult.nouvelleRepetition : 0,
                    est_entrainement_libre: isEntrainementLibreSnapshot
                };
                try {
                    const sfResult = await this.callAPI('savePratiqueSF', pratiqueData);
                    if (!sfResult.success) {
                        console.error('[SF] Erreur backend:', sfResult.error);
                    }
                } catch (e) {
                    console.error('[SF] Erreur appel savePratiqueSF:', e);
                }
            }
        } catch (e) {
            console.error('[EleveExercices] Erreur sauvegarde résultat:', e);
        }
    },

    // ===============================
    // STATS LOCALES
    // ===============================

    /**
     * Met à jour les stats locales au niveau banque
     */
    updateLocalStatsSF(pratiqueData) {
        const exoId = String(pratiqueData.exercice_id);
        const banqueId = String(pratiqueData.banque_id);

        if (!this.statsSFBanque[banqueId]) {
            this.statsSFBanque[banqueId] = {
                banque_id: banqueId,
                repetitions_validees: 0,
                exercices_reussis: [],
                date_derniere_validation: null,
                total_pratiques: 0
            };
        }

        const statsBanque = this.statsSFBanque[banqueId];
        statsBanque.total_pratiques++;

        if (pratiqueData.repetition_validee && !pratiqueData.est_entrainement_libre) {
            statsBanque.repetitions_validees = pratiqueData.nouvelle_repetition;
            statsBanque.date_derniere_validation = new Date().toISOString();

            if (!statsBanque.exercices_reussis.includes(exoId)) {
                statsBanque.exercices_reussis.push(exoId);
            }
        }

        this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);
    },

    /**
     * Sauvegarde les stats SF par banque dans le cache local
     */
    saveHistoriqueSFBanqueToCache(statsBanque) {
        try {
            localStorage.setItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY, JSON.stringify({
                data: statsBanque,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[SF] Erreur sauvegarde cache banque:', e);
        }
    },

    /**
     * Charge les stats SF par banque depuis le cache local
     */
    loadHistoriqueSFBanqueFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.data;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    updateLocalResult(newResult) {
        const existingIndex = this.resultats.findIndex(r => r.exercice_id === newResult.exercice_id);
        if (existingIndex >= 0) {
            if (newResult.score > this.resultats[existingIndex].score) {
                this.resultats[existingIndex] = newResult;
            }
        } else {
            this.resultats.push(newResult);
        }
        this.saveResultatsToCache(this.resultats);
    },

    // ===============================
    // ÉCRAN DE RÉSULTAT SF
    // ===============================

    /**
     * Collecte les détails des réponses utilisateur pour l'écran de résultat
     */
    collectExerciseDetails() {
        const details = [];
        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        if (typeUI === 'carte_cliquable') {
            const marqueurs = this.carteMarqueurs || [];
            const reponses = this.carteReponses || [];
            marqueurs.forEach((m, index) => {
                const userAnswer = reponses[index] || '';
                const correctAnswer = m.reponse || '';
                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                details.push({
                    question: m.question || `Point ${index + 1}`,
                    reponseUtilisateur: userAnswer,
                    reponseAttendue: correctAnswer.split(/[|;]/)[0],
                    correct: isCorrect
                });
            });
        } else if (typeUI === 'document_mixte') {
            const data = this.mixteData || {};
            if (data.tableau && data.tableau.actif) {
                if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                    this.mixteTableauElements.forEach((el, idx) => {
                        if (el.type === 'row' && el.reponse) {
                            const input = document.getElementById(`mixte_element_${idx}`);
                            const userAnswer = input ? input.value : '';
                            const correctAnswer = el.reponse;
                            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                            details.push({
                                question: el.label || `Ligne ${idx + 1}`,
                                reponseUtilisateur: userAnswer,
                                reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                correct: isCorrect
                            });
                        }
                    });
                } else {
                    const colonnes = this.mixteTableauColonnes || [];
                    const lignes = this.mixteTableauLignes || [];
                    lignes.forEach((ligne, rowIdx) => {
                        colonnes.forEach((col, colIdx) => {
                            if (col.editable) {
                                const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                                const userAnswer = input ? input.value : '';
                                const correctAnswer = ligne.cells[colIdx] || '';
                                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                                details.push({
                                    question: `${col.titre || 'Colonne ' + (colIdx + 1)} - Ligne ${rowIdx + 1}`,
                                    reponseUtilisateur: userAnswer,
                                    reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                    correct: isCorrect
                                });
                            }
                        });
                    });
                }
            }
            if (data.questions && data.questions.actif) {
                const questions = this.mixteQuestions || [];
                questions.forEach((q, idx) => {
                    const textarea = document.getElementById(`mixte_answer_${idx}`);
                    const userAnswer = textarea ? textarea.value.trim() : '';
                    details.push({
                        question: q.question || `Question ${idx + 1}`,
                        reponseUtilisateur: userAnswer,
                        reponseAttendue: q.reponse_attendue || '(voir corrigé)',
                        correct: null,
                        isOpenQuestion: true
                    });
                });
            }
        } else if (typeUI === 'question_ouverte') {
            const questions = this.questionsOuvertes || [];
            questions.forEach((q, qIndex) => {
                (q.etapes || []).forEach((etape, eIndex) => {
                    const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                    const userAnswer = textarea ? textarea.value.trim() : '';
                    details.push({
                        question: etape.question || `Question ${eIndex + 1}`,
                        reponseUtilisateur: userAnswer,
                        reponseAttendue: etape.correction || '(voir corrigé)',
                        correct: null,
                        isOpenQuestion: true
                    });
                });
            });
        } else {
            // Tableau saisie
            const donnees = parseJSONField(this.currentExercise.donnees);
            const colonnes = donnees.colonnes || [];
            const lignes = donnees.lignes || [];
            lignes.forEach((ligne, rowIndex) => {
                const cells = ligne.cells || Object.values(ligne);
                colonnes.forEach((col, colIndex) => {
                    if (col.editable) {
                        const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                        const userAnswer = input ? input.value : '';
                        const correctAnswer = cells[colIndex] || '';
                        const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);

                        let questionLabel = '';
                        const nonEditableCols = colonnes.filter(c => !c.editable);
                        if (nonEditableCols.length > 0) {
                            const labelColIdx = colonnes.indexOf(nonEditableCols[0]);
                            questionLabel = cells[labelColIdx] || '';
                        }
                        if (!questionLabel) {
                            questionLabel = `Ligne ${rowIndex + 1} - ${col.titre || 'Colonne ' + (colIndex + 1)}`;
                        }

                        details.push({
                            question: questionLabel,
                            reponseUtilisateur: userAnswer,
                            reponseAttendue: correctAnswer.split(/[|;]/)[0],
                            correct: isCorrect
                        });
                    }
                });
            });
        }

        return details;
    },

    /**
     * Affiche l'écran de résultats SF avec 2 blocs (bilan + correction)
     * Système 4 répétitions
     */
    renderResultScreenSF(results) {
        const container = document.getElementById('exercices-content');
        const exo = this.currentExercise;

        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = exo.duree || 300;
        const tempsOK = timeSpent <= tempsPrevu;

        const validationResult = this.lastValidationResult || {
            repetitionValidee: false,
            nouvelleRepetition: 0,
            message: 'Résultat',
            conseil: '',
            estMaitrise: false
        };

        const isSuccess = validationResult.repetitionValidee;
        const resultType = isSuccess ? 'success' : (results.percent === 100 ? 'partial' : 'error');

        const generateRepDots = () => {
            let html = '<div class="rep-dots">';
            for (let i = 1; i <= this.SEUIL_REPETITIONS; i++) {
                const status = i <= validationResult.nouvelleRepetition ? 'completed' : 'pending';
                html += `<span class="rep-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        const nextExercise = this.findNextExercise();

        let prochaineDateStr = '';
        if (validationResult.prochaineDispo) {
            prochaineDateStr = new Date(validationResult.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }

        const correctionDetails = this.collectExerciseDetails();

        const generateCorrectionHTML = () => {
            if (correctionDetails.length === 0) {
                return '<p class="correction-fallback">Correction non disponible.</p>';
            }

            let html = `
                <div class="correction-table-wrapper">
                    <table class="correction-table-display">
                        <thead>
                            <tr>
                                <th class="col-question">Question</th>
                                <th class="col-reponse">Ta réponse</th>
                                <th class="col-attendue">Réponse attendue</th>
                                <th class="col-status">Résultat</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            correctionDetails.forEach((detail) => {
                const isCorrect = detail.correct === true;
                const isOpenQuestion = detail.isOpenQuestion === true;
                const statusClass = isOpenQuestion ? 'open' : (isCorrect ? 'correct' : 'incorrect');
                const statusIcon = isOpenQuestion ? '📝' : (isCorrect ? '✅' : '❌');
                const userAnswer = detail.reponseUtilisateur || '';
                const displayUserAnswer = userAnswer.trim() === '' ? '<span class="empty-answer">Non répondu</span>' : this.escapeHtml(userAnswer);

                html += `
                    <tr class="correction-row ${statusClass}">
                        <td class="col-question">${this.escapeHtml(detail.question)}</td>
                        <td class="col-reponse ${statusClass}">${displayUserAnswer}</td>
                        <td class="col-attendue">${this.escapeHtml(detail.reponseAttendue)}</td>
                        <td class="col-status"><span class="status-icon">${statusIcon}</span></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
            return html;
        };

        container.innerHTML = `
            <div class="result-view sf">
                <button class="exercise-back-btn" onclick="EleveExercices.backToList()">
                    ← Retour aux exercices
                </button>

                <div class="result-card-sf">
                    <!-- BLOC GAUCHE : BILAN -->
                    <div class="result-bilan">
                        <div class="bilan-header ${resultType}">
                            <span class="bilan-icon">${isSuccess ? '✅' : (results.percent === 100 ? '⏱️' : '❌')}</span>
                            <span class="bilan-message">${validationResult.message}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${resultType}">
                                <span class="score-value">${results.percent}%</span>
                            </div>
                            <span class="score-detail">${results.correct}/${results.total}</span>
                        </div>

                        <div class="bilan-temps-compact">
                            <span class="temps-info">⏱️ ${this.formatTime(timeSpent)} / ${this.formatTime(tempsPrevu)}</span>
                            <span class="temps-status ${tempsOK ? 'success' : 'warning'}">${tempsOK ? '✓' : '⚠️'}</span>
                        </div>

                        ${!this.isEntrainementLibre ? `
                        <div class="bilan-repetition-compact">
                            <span class="rep-dots-inline">${generateRepDots()}</span>
                            <span class="rep-label">Niveau ${validationResult.nouvelleRepetition}/${this.SEUIL_REPETITIONS}</span>
                        </div>
                        ` : `
                        <div class="bilan-entrainement-libre-badge">
                            <span class="libre-badge-icon">🔄</span>
                            <span class="libre-badge-text">Entraînement libre</span>
                        </div>
                        <div class="bilan-actions-libre">
                            ${validationResult.scoreEntrainementLibre === 100 ? `
                                <button class="btn btn-primary btn-continuer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                    🔄 Continuer de s'entraîner
                                </button>
                            ` : `
                                <button class="btn btn-primary btn-reessayer-libre" onclick="EleveExercices.restartExercise()">
                                    🔄 Réessayer cet exercice
                                </button>
                            `}
                        </div>
                        `}

                        <!-- Messages -->
                        <div class="bilan-messages">
                            ${validationResult.conseil && !isSuccess && !this.isEntrainementLibre ? `
                                <div class="bilan-conseil warning">
                                    <span class="conseil-icon">💡</span>
                                    <p>${validationResult.conseil}</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && !validationResult.estMaitrise ? `
                                <div class="bilan-prochaine-new">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${validationResult.nouvelleRepetition + 1} !</p>
                                    <p class="prochaine-sub">En attendant, tu peux t'entraîner autant que tu veux</p>
                                    <button class="btn btn-entrainer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                        💪 Continuer à s'entraîner
                                    </button>
                                </div>
                            ` : ''}

                            ${validationResult.estMaitrise ? `
                                <div class="bilan-maitrise">
                                    <span class="maitrise-icon">🎉</span>
                                    <p>Bravo ! Tu maîtrises cette banque !</p>
                                </div>
                            ` : ''}


                            <div class="bilan-actions">
                                ${!isSuccess && !this.isEntrainementLibre ? `
                                    <button class="btn btn-primary btn-restart-sf" onclick="EleveExercices.restartExercise()">
                                        🔄 Réessayer cet exercice
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- BLOC DROITE : CORRECTION + SUJET (onglets si document présent) -->
                    <div class="result-correction">
                        ${results.subjectHTML ? `
                        <div class="result-tabs">
                            <button class="result-tab active" data-tab="corrige" onclick="EleveExercices.switchResultTab('corrige')">📝 Corrigé</button>
                            <button class="result-tab" data-tab="sujet" onclick="EleveExercices.switchResultTab('sujet')">📄 Sujet</button>
                        </div>
                        ` : `
                        <div class="correction-header">
                            <h3>📝 Correction</h3>
                        </div>
                        `}
                        <div class="result-tab-content active" id="tabCorrige">
                            <div class="correction-content correction-table">
                                <div class="exercise-content">${results.correctedHTML || '<p class="correction-fallback">Correction non disponible.</p>'}</div>
                            </div>
                        </div>
                        ${results.subjectHTML ? `
                        <div class="result-tab-content" id="tabSujet">
                            <div class="subject-content">${results.subjectHTML}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Déclencher l'animation de célébration si réussite (pas en entraînement libre)
        if (isSuccess && !this.isEntrainementLibre) {
            setTimeout(() => {
                this.triggerCelebration(validationResult.nouvelleRepetition);
            }, 100);
        }

        // Reset le flag entraînement libre
        this.isEntrainementLibre = false;
    },

    // ===============================
    // NAVIGATION RÉSULTATS
    // ===============================

    switchResultTab(tab) {
        document.querySelectorAll('.result-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('tabCorrige').classList.toggle('active', tab === 'corrige');
        const tabSujet = document.getElementById('tabSujet');
        if (tabSujet) tabSujet.classList.toggle('active', tab === 'sujet');
    },

    toggleCorrige() {
        const wrapper = document.getElementById('correctedContentWrapper');
        const toggle = document.querySelector('.corrected-toggle');

        if (wrapper) {
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            if (toggle) {
                toggle.innerHTML = isHidden
                    ? '📋 Masquer le corrigé <span class="toggle-icon">▲</span>'
                    : '📋 Voir le corrigé <span class="toggle-icon">▼</span>';
            }
        }
    },

    toggleResultDetails() {
        const content = document.getElementById('resultDetailsContent');
        const icon = document.querySelector('.result-details .toggle-icon');
        if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            if (icon) icon.textContent = isHidden ? '▲' : '▼';
        }
    },

    findNextExercise() {
        if (!this.currentExercise || !this.exercices) return null;

        const currentBanqueExercices = this.exercices
            .filter(e => String(e.banque_id) === String(this.currentExercise.banque_id))
            .sort((a, b) => (a.numero || 0) - (b.numero || 0));

        const currentIndex = currentBanqueExercices.findIndex(e => e.id === this.currentExercise.id);
        if (currentIndex >= 0 && currentIndex < currentBanqueExercices.length - 1) {
            return currentBanqueExercices[currentIndex + 1];
        }
        return null;
    },

    restartExercise() {
        if (this.currentExercise) {
            this.startExercise(this.currentExercise.id);
        }
    },

    startEntrainementLibre() {
        if (!this.currentExercise || !this.exercices) return;

        const exercicesMêmeBanque = this.exercices.filter(
            e => String(e.banque_id) === String(this.currentExercise.banque_id)
        );

        if (exercicesMêmeBanque.length <= 1) {
            this.startExercise(this.currentExercise.id, true);
            return;
        }

        const autresExercices = exercicesMêmeBanque.filter(
            e => e.id !== this.currentExercise.id
        );
        const exerciceAleatoire = autresExercices[Math.floor(Math.random() * autresExercices.length)];

        this.startExercise(exerciceAleatoire.id, true);
    },

    startNextExercise() {
        const next = this.findNextExercise();
        if (next) {
            this.startExercise(next.id);
        } else {
            this.backToList();
        }
    },

    // ===============================
    // CÉLÉBRATION
    // ===============================

    /**
     * Déclenche une animation de célébration (paillettes/confettis)
     * @param {number} level - Niveau atteint (1-5), détermine l'intensité
     */
    triggerCelebration(level) {
        const existing = document.querySelector('.celebration-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = `celebration-container level-${level}`;
        document.body.appendChild(container);

        const config = {
            1: { sparkles: 20, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b'] },
            2: { sparkles: 35, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#34d399'] },
            3: { sparkles: 40, confetti: 20, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6'] },
            4: { sparkles: 50, confetti: 40, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            5: { sparkles: 60, confetti: 60, stars: 15, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'] }
        };

        const cfg = config[Math.min(level, 5)] || config[1];

        for (let i = 0; i < cfg.sparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            sparkle.style.animationDelay = Math.random() * 0.5 + 's';
            sparkle.style.width = (6 + Math.random() * 8) + 'px';
            sparkle.style.height = sparkle.style.width;
            container.appendChild(sparkle);
        }

        for (let i = 0; i < cfg.confetti; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            confetti.style.animationDelay = Math.random() * 0.8 + 's';
            confetti.style.width = (6 + Math.random() * 6) + 'px';
            confetti.style.height = (12 + Math.random() * 10) + 'px';
            container.appendChild(confetti);
        }

        for (let i = 0; i < cfg.stars; i++) {
            const star = document.createElement('div');
            star.className = 'golden-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 1 + 's';
            star.style.width = (15 + Math.random() * 15) + 'px';
            star.style.height = star.style.width;
            container.appendChild(star);
        }

        setTimeout(() => {
            container.remove();
        }, 5000);
    },

});
