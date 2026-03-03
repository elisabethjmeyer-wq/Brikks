/**
 * eleve-exercices-validation.js
 *
 * Validation des réponses par format d'exercice + comparaison de réponses.
 * Gère aussi le verrouillage de l'exercice pendant la soumission.
 *
 * Étend EleveExercices via Object.assign.
 */
Object.assign(EleveExercices, {
    // ===============================
    // VALIDATION
    // ===============================

    /**
     * Bloque l'exercice pendant le chargement (après clic sur Terminer)
     * Désactive tous les inputs et affiche un overlay
     */
    lockExercise() {
        const exerciseContent = document.querySelector('.exercise-content');
        if (!exerciseContent) return;

        const inputs = exerciseContent.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = true;
            input.classList.add('locked');
        });

        const overlay = document.createElement('div');
        overlay.className = 'exercise-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Calcul du résultat...</span>
            </div>
        `;
        exerciseContent.style.position = 'relative';
        exerciseContent.appendChild(overlay);
    },

    async validateExercise() {
        if (!this.currentExercise) return;

        // Empêcher les clics multiples
        if (this.isValidating) return;
        this.isValidating = true;

        // Désactiver le bouton et afficher le chargement
        const btnVerifier = document.getElementById('btnVerifier');
        if (btnVerifier) {
            btnVerifier.disabled = true;
            btnVerifier.innerHTML = '<span class="spinner-small"></span> Validation...';
        }

        // Bloquer tout l'exercice pendant le chargement
        this.lockExercise();

        this.stopTimer();

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        const structure = parseJSONField(format?.structure);

        const typeUI = structure.type_ui || 'unknown';
        let result;

        const handler = this.getFormatHandler(typeUI);
        if (handler && handler.validate) {
            result = handler.validate.call(this);
        } else {
            result = this.validateTableauSaisie();
        }

        const { correct, total } = result;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Sauvegarder le résultat
        await this.saveResult(correct, total, percent);

        // Pour les savoir-faire: afficher l'écran de résultat dédié
        if (this.currentType === 'savoir-faire') {
            const exerciseContent = document.querySelector('.exercise-content');

            // Capturer le sujet/document AVANT les corrections (qui modifient le DOM)
            let subjectHTML = '';
            const docEl = exerciseContent.querySelector('.mixte-document, .document-section');
            if (docEl) {
                subjectHTML = docEl.outerHTML;
            }

            // Appliquer les corrections sur l'exercice actuel
            this.applyCorrections(typeUI);

            // Supprimer l'overlay de chargement avant de capturer le HTML
            const overlay = document.querySelector('.exercise-loading-overlay');
            if (overlay) overlay.remove();

            // Nettoyer les éléments document du HTML corrigé (on les montre dans l'onglet Sujet)
            if (subjectHTML) {
                // Retirer le bouton + modal créés par showDocumentMixteCorrige
                const toggleBtn = exerciseContent.querySelector('#toggleDocumentBtn');
                const docModal = exerciseContent.querySelector('#documentModal');
                if (toggleBtn) toggleBtn.remove();
                if (docModal) docModal.remove();

                // Retirer la section document restante (document_tableau, question_ouverte)
                const remainingDoc = exerciseContent.querySelector('.document-section');
                if (remainingDoc) remainingDoc.remove();

                // Retirer la colonne gauche vide (document_mixte horizontal)
                const emptyLeftCol = exerciseContent.querySelector('.mixte-left-column');
                if (emptyLeftCol && emptyLeftCol.children.length === 0) emptyLeftCol.remove();
            }

            // Capturer le HTML de l'exercice corrigé (sans le document)
            const correctedHTML = this.captureContentWithValues(exerciseContent);

            // Capturer aussi la consigne si présente
            const consigneEl = document.querySelector('.exercise-consigne');
            const consigneHTML = consigneEl ? consigneEl.outerHTML : '';

            this.renderResultScreenSF({
                correct,
                total,
                percent,
                correctedHTML,
                consigneHTML,
                subjectHTML
            });
            return;
        }

        // Pour les autres types: comportement existant (bandeau + boutons)
        const banner = document.getElementById('resultBanner');
        if (percent === 100) {
            banner.className = 'result-banner show success';
            banner.textContent = `Parfait ! ${correct}/${total} réponses correctes`;
        } else if (percent >= 50) {
            banner.className = 'result-banner show partial';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        } else {
            banner.className = 'result-banner show error';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        }

        // Après validation : afficher les boutons "Corrigé" et "Recommencer"
        const btnCorrige = document.getElementById('btnCorrige');
        const btnRestart = document.getElementById('btnRestart');

        if (btnCorrige) btnCorrige.style.display = 'inline-flex';
        if (btnRestart) btnRestart.style.display = 'inline-flex';

        // Modifier le bouton "Vérifier" pour permettre de re-vérifier
        if (btnVerifier) {
            btnVerifier.disabled = false;
            btnVerifier.textContent = 'Vérifier à nouveau';
            this.isValidating = false;
        }
    },

    validateTableauSaisie() {
        const donnees = parseJSONField(this.currentExercise.donnees);
        const parsed = this._parseTableauDonnees(donnees, {});
        let correct = 0, total = 0;

        parsed.lignes.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell.type === 'reponse') {
                    total++;
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    if (!input) return;

                    // Construire la chaîne de réponses acceptées (principale + alternatives)
                    const allAnswers = [cell.valeur, ...(cell.alternatives || [])].filter(a => a).join('|');
                    const isStricte = cell.correction === 'stricte';

                    if (this.checkAnswerMatch(input.value, allAnswers, isStricte)) {
                        input.className = 'correct';
                        correct++;
                    } else {
                        input.className = 'incorrect';
                    }
                }
            });
        });

        return { correct, total };
    },

    validateCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];
        let correct = 0, total = marqueurs.length;

        marqueurs.forEach((m, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            const correctAnswerRaw = m.reponse || '';
            const isStricte = m.correction === 'stricte';

            if (this.checkAnswerMatch(reponses[index] || '', correctAnswerRaw, isStricte)) {
                if (marqueur) marqueur.classList.add('correct');
                if (badge) badge.classList.add('correct');
                correct++;
            } else {
                if (marqueur) marqueur.classList.add('incorrect');
                if (badge) badge.classList.add('incorrect');
            }
        });

        return { correct, total };
    },

    validateQuestionOuverte() {
        const questions = this.questionsOuvertes || [];

        questions.forEach((q, qIndex) => {
            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea && textarea.value.trim()) {
                    textarea.classList.add('answered');
                }
            });
        });

        return { correct: 0, total: 0 };
    },

    validateDocumentMixte() {
        let correct = 0, total = 0;
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row' && el.reponse) {
                        total++;
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            const correctAnswerRaw = el.reponse;

                            if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                input.classList.add('correct');
                                input.classList.remove('incorrect');
                                correct++;
                            } else {
                                input.classList.add('incorrect');
                                input.classList.remove('correct');
                            }
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((ligne, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            total++;
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                const correctAnswerRaw = ligne.cells[colIdx] || '';

                                if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                    input.classList.add('correct');
                                    input.classList.remove('incorrect');
                                    correct++;
                                } else {
                                    input.classList.add('incorrect');
                                    input.classList.remove('correct');
                                }
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif) {
            const questions = this.mixteQuestions || [];
            questions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                if (textarea && textarea.value.trim()) {
                    textarea.classList.add('answered');
                }
            });
        }

        return { correct, total };
    },

    // ===============================
    // COMPARAISON DE RÉPONSES
    // ===============================

    normalizeAnswer(str) {
        return String(str).toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    /**
     * Vérifie si la réponse utilisateur correspond à la réponse correcte.
     * Supporte les réponses multiples séparées par | ou ;
     * @param {string} userAnswer - Réponse de l'élève
     * @param {string} correctAnswer - Réponse(s) correcte(s), séparées par | ou ;
     * @param {boolean} [stricte=false] - Si true, comparaison exacte (trim seulement)
     */
    checkAnswerMatch(userAnswer, correctAnswer, stricte) {
        const userTrimmed = String(userAnswer).trim();
        if (userTrimmed === '') return false;

        const correctOptions = String(correctAnswer).split(/[|;]/).map(opt => opt.trim()).filter(opt => opt !== '');

        if (stricte) {
            return correctOptions.some(opt => userTrimmed === opt);
        }

        const normalizedUser = this.normalizeAnswer(userAnswer);
        return correctOptions.some(opt => normalizedUser === this.normalizeAnswer(opt));
    },

});
