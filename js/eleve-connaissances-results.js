/**
 * EleveConnaissances - Results & Progression Methods
 *
 * Contains methods for compiling results, saving progression,
 * rendering result screens, and related UI utilities.
 */

Object.assign(EleveConnaissances, {

    /**
     * Compile les résultats depuis etapesResults (déjà remplis par validateCurrentEtape)
     */
    compileResults() {
        let totalCorrect = 0;
        let totalQuestions = 0;

        // Pour les étapes non encore validées (timer expiré), créer un résultat avec le vrai total attendu
        this.currentEtapes.forEach((etape, idx) => {
            if (!this.etapesResults[idx]) {
                const expectedTotal = this.getExpectedQuestionCount(etape);
                const details = [];
                for (let i = 0; i < expectedTotal; i++) {
                    details.push({ question: `Question ${i + 1}`, reponse: null, attendu: '—', correct: false });
                }
                this.etapesResults[idx] = {
                    etapeIndex: idx,
                    etapeTitre: etape.titre || `Étape ${idx + 1}`,
                    format: etape.format_code,
                    correct: 0,
                    total: expectedTotal,
                    pourcentage: 0,
                    details,
                    donnees: {}
                };
            }
        });

        this.etapesResults.forEach(result => {
            totalCorrect += result.correct;
            totalQuestions += result.total;
        });

        const pourcentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return {
            etapes: this.etapesResults,
            totalCorrect,
            totalQuestions,
            pourcentage
        };
    },

    /**
     * Estime le nombre de questions attendues pour une étape non visitée.
     */
    getExpectedQuestionCount(etape) {
        const storedData = this.selectedQuestionsPerEtape[etape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(etape);
        const format = etape.format_code;

        switch (format) {
            case 'qcm':
                return donnees.multiQuestions?.length || 1;
            case 'vrai_faux':
                return donnees.propositions?.length || 1;
            case 'chronologie':
            case 'timeline':
                return donnees.cartes?.length || donnees.paires?.length || 1;
            case 'texte_trou':
            case 'texte_trous':
                if (donnees.multiQuestions?.length > 1) return donnees.multiQuestions.length;
                return (donnees.texte || '').match(/\{[^}]+\}/g)?.length || 1;
            case 'association':
                return donnees.paires?.length || 1;
            case 'carte':
                return donnees.marqueurs?.length || 1;
            case 'question_ouverte':
                return donnees.multiQuestions?.length || 1;
            case 'flashcard':
                return donnees.cartes?.length || 1;
            default:
                return 1;
        }
    },

    /**
     * Sauvegarde la progression dans le backend
     */
    async saveProgression(results) {
        // Ne pas sauvegarder en mode entraînement libre (exercice déjà mémorisé)
        if (this.isTrainingMode) {
            Logger.debug('EleveConnaissances', 'Mode entraînement libre - progression non sauvegardée');
            this.lastProgressionResult = { statut: 'memorise', message: 'Entraînement libre' };
            return;
        }

        try {
            // Utiliser this.currentUser qui est initialisé au chargement
            if (!this.currentUser?.id) {
                Logger.warn('EleveConnaissances', 'Pas d\'utilisateur connecté, progression non sauvegardée');
                return;
            }

            const response = await this.callAPI('saveProgressionMemorisation', {
                eleve_id: this.currentUser.id,
                entrainement_id: this.currentEntrainement.id,
                banque_id: this.currentBanque?.id || '',
                score: results.totalCorrect,
                score_max: results.totalQuestions
            });

            if (response.success) {
                this.lastProgressionResult = response;
                // Mettre à jour le cache local des progressions
                this.progressions[this.currentEntrainement.id] = {
                    ...this.progressions[this.currentEntrainement.id],
                    etape: response.etape,
                    statut: response.statut,
                    prochaine_revision: response.prochaine_revision
                };
                Logger.debug('EleveConnaissances', 'Progression sauvegardée', response);
            }
        } catch (error) {
            Logger.error('EleveConnaissances', 'Erreur sauvegarde progression', error);
        }
    },

    /**
     * Affiche un modal quand l'entraînement est verrouillé
     * Offre l'option de faire l'entraînement en mode libre (ne compte pas)
     */
    showLockedModal(prog, status, entrainementId) {
        const entrainement = this.entrainements.find(e => e.id === (entrainementId || prog.entrainement_id));
        const titre = entrainement?.titre || 'Cet entraînement';

        const prochaineDate = new Date(prog.prochaine_revision);
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateStr = prochaineDate.toLocaleDateString('fr-FR', options);

        // Créer un modal overlay
        const modal = document.createElement('div');
        modal.className = 'locked-modal-overlay';
        modal.innerHTML = `
            <div class="locked-modal">
                <div class="locked-modal-icon">🔒</div>
                <h3>Pas encore !</h3>
                <p class="locked-modal-title">${this.escapeHtml(titre)}</p>
                <p class="locked-modal-message">
                    Tu as réussi cet entraînement ! Pour que ça reste en mémoire,
                    reviens <strong>${dateStr}</strong> pour la prochaine révision.
                </p>
                <div class="locked-modal-info">
                    <div class="locked-modal-etape">Niveau ${Math.max((prog.etape || 1) - 1, 0)}/6 validé</div>
                    <div class="locked-modal-jours">${status.joursRestants} jour${status.joursRestants > 1 ? 's' : ''} restant${status.joursRestants > 1 ? 's' : ''}</div>
                </div>
                <div class="locked-modal-actions">
                    <button class="btn btn-primary" onclick="this.closest('.locked-modal-overlay').remove()">
                        J'ai compris
                    </button>
                    <button class="btn btn-outline btn-free-training" onclick="EleveConnaissances.startFreeTraining('${entrainementId || prog.entrainement_id}')">
                        M'entraîner quand même
                    </button>
                </div>
                <p class="locked-modal-free-hint">⚠️ L'entraînement libre ne compte pas pour ta progression</p>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Démarre un entraînement en mode libre (ne compte pas pour la progression)
     */
    startFreeTraining(entrainementId) {
        // Fermer le modal
        document.querySelector('.locked-modal-overlay')?.remove();

        // Marquer comme mode entraînement libre
        this.isTrainingMode = true;
        this.isFreeTraining = true;

        // Démarrer l'entraînement normalement
        this.startEntrainement(entrainementId, true); // true = skip availability check
    },

    /**
     * Génère le HTML du détail des erreurs (pour la colonne droite en cas d'échec)
     */
    generateErrorDetails(results) {
        if (!results.etapes || results.etapes.length === 0) {
            return `
                <div class="correction-empty">
                    <p>Détail non disponible.</p>
                </div>
            `;
        }
        const hasErrors = results.etapes.some(e => e.details && e.details.some(d => !d.correct));
        if (!hasErrors) {
            return `
                <div class="felicitation-panel success">
                    <div class="felicitation-icon">🎉</div>
                    <h3>Aucune erreur !</h3>
                    <p>Tu as tout réussi, bravo !</p>
                </div>
            `;
        }

        const isImageUrl = (str) => {
            if (!str) return false;
            const s = String(str).trim().toLowerCase();
            return s.startsWith('http') && (s.includes('drive.google') || s.includes('imgur') || /\.(jpg|jpeg|png|gif|webp|svg)/.test(s));
        };

        const renderElement = (val, className) => {
            if (!val || val === '—') return `<span class="${className}">—</span>`;
            const str = String(val);
            if (isImageUrl(str)) {
                return `<img class="correction-mini-img ${className}" src="${this.escapeHtml(this.normalizeImageUrl(str))}" alt="" />`;
            }
            return `<span class="${className}">${this.escapeHtml(str)}</span>`;
        };

        // Préparer les données par étape
        const etapesData = results.etapes.map((etape, idx) => {
            const allDetails = etape.details || [];
            const errors = allDetails.filter(d => !d.correct);
            const correct = allDetails.filter(d => d.correct).length;
            const total = allDetails.length;
            return { etape, idx, errors, correct, total, hasErr: errors.length > 0 };
        });

        // Filtrer : seules les étapes avec erreurs sont affichées
        const etapesWithErrors = etapesData.filter(ed => ed.hasErr);

        // Slide 0 : Vue d'ensemble (uniquement les étapes avec erreurs)
        const overviewSlide = `
            <div class="carousel-slide" data-slide="0">
                <div class="carousel-slide-header overview-header">
                    <span class="carousel-slide-title">Vue d'ensemble</span>
                </div>
                <div class="carousel-slide-content">
                    <div class="overview-list">
                        ${etapesWithErrors.map((ed, i) => `
                            <div class="overview-row has-errors" onclick="EleveConnaissances.carouselGoTo(${i + 1})">
                                <span class="overview-status">❌</span>
                                <div class="overview-info">
                                    <span class="overview-etape-name">${this.escapeHtml(ed.etape.etapeTitre || 'Étape ' + (ed.idx + 1))} — ${this.getFormatLabel(ed.etape.format)}</span>
                                    <span class="overview-score">${ed.correct}/${ed.total} correct</span>
                                </div>
                                <span class="overview-arrow">→</span>
                            </div>
                        `).join('')}
                    </div>
                    <p class="overview-hint">Clique sur une étape ou utilise les flèches pour voir le détail</p>
                </div>
            </div>
        `;

        // Helper : rend la correction d'une sous-question selon son format
        const renderSingleCorrection = (qData, qDetails, qErrors) => {
            const hasCartes = qData.cartes?.length > 0;
            const hasPaires = qData.paires?.length > 0;
            const hasMode = !!qData.mode;
            const hasMarqueurs = qData.marqueurs?.length > 0;

            if (hasCartes) {
                // Timeline (cartes drag & drop) : frise élève + frise correcte
                const studentCards = qDetails.map(d => ({
                    titre: d.reponse, correct: d.correct, attendu: d.attendu
                }));
                const studentHtml = studentCards.length > 0 ? `
                    <p class="correction-timeline-hint correction-timeline-hint--student">Ta réponse :</p>
                    <div class="correction-timeline-cards">
                        ${studentCards.map((sc, ci) => {
                            const carte = qData.cartes.find(c => c.titre === sc.titre) || {};
                            const imageUrl = carte.image_url ? this.normalizeImageUrl(carte.image_url) : '';
                            const hasImage = !!imageUrl;
                            const imgStyle = hasImage ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                            const statusClass = sc.correct ? 'card-correct' : 'card-incorrect';
                            return `
                                <div class="correction-timeline-card ${hasImage ? 'has-image' : ''} ${statusClass}" ${imgStyle}>
                                    <span class="correction-timeline-pos">${ci + 1}</span>
                                    <span class="correction-timeline-titre">${this.escapeHtml(sc.titre || '—')}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '';
                const correctHtml = `
                    <p class="correction-timeline-hint correction-timeline-hint--correct">Ordre correct :</p>
                    <div class="correction-timeline-cards">
                        ${qData.cartes.map((carte, ci) => {
                            const imageUrl = carte.image_url ? this.normalizeImageUrl(carte.image_url) : '';
                            const hasImage = !!imageUrl;
                            const imgStyle = hasImage ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                            return `
                                <div class="correction-timeline-card ${hasImage ? 'has-image' : ''}" ${imgStyle}>
                                    <span class="correction-timeline-pos">${ci + 1}</span>
                                    <span class="correction-timeline-titre">${this.escapeHtml(carte.titre)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                return studentHtml + correctHtml;
            }

            if (hasPaires && hasMode) {
                // Chronologie texte (frise avec dates/événements à compléter) : erreurs uniquement
                return qErrors.map(err => `
                    <div class="correction-error-row">
                        <div class="correction-error-q">${renderElement(err.question, 'correction-q-text')}</div>
                        <div class="correction-error-answers">
                            <span class="correction-given">${this.escapeHtml(String(err.reponse || '—'))}</span>
                            ${err.attendu ? `<span class="correction-expected">→ ${renderElement(err.attendu, 'correction-expected-val')}</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }

            if (hasPaires) {
                // Association : Ta réponse + Réponse correcte (comme chronologie)
                // Construire les paires que l'élève a faites (depuis qDetails)
                const studentPairs = qDetails.map(d => ({
                    element1: d.reponse,
                    element2: d.attendu,
                    correct: d.correct
                }));

                // Section "Ta réponse :"
                const studentHtml = studentPairs.length > 0 ? `
                    <p class="correction-timeline-hint correction-timeline-hint--student">Ta réponse :</p>
                    <div class="correction-assoc-grid">
                        ${studentPairs.map((sp, pi) => {
                            const el1 = sp.element1;
                            const el2 = sp.element2;
                            const statusClass = sp.correct ? 'card-correct' : 'card-incorrect';
                            const img = isImageUrl(el1) ? el1 : (isImageUrl(el2) ? el2 : null);
                            const text = isImageUrl(el1) ? el2 : el1;

                            if (img) {
                                return `
                                    <div class="correction-assoc-card ${statusClass} has-image" style="background-image: url('${this.escapeHtml(this.normalizeImageUrl(img))}');">
                                        <span class="correction-assoc-label">${this.escapeHtml(text)}</span>
                                    </div>
                                `;
                            }
                            return `
                                <div class="correction-assoc-card ${statusClass} text-only">
                                    <span class="correction-assoc-text">${this.escapeHtml(el1)}</span>
                                    <span class="correction-assoc-label">${this.escapeHtml(el2)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '';

                // Section "Réponse correcte :"
                const correctHtml = `
                    <p class="correction-timeline-hint correction-timeline-hint--correct">Réponse correcte :</p>
                    <div class="correction-assoc-grid">
                        ${qData.paires.map(p => {
                            const el1 = p.element1;
                            const el2 = p.element2;
                            const img = isImageUrl(el1) ? el1 : (isImageUrl(el2) ? el2 : null);
                            const text = isImageUrl(el1) ? el2 : el1;

                            if (img) {
                                return `
                                    <div class="correction-assoc-card card-correct has-image" style="background-image: url('${this.escapeHtml(this.normalizeImageUrl(img))}');">
                                        <span class="correction-assoc-label">${this.escapeHtml(text)}</span>
                                    </div>
                                `;
                            }
                            return `
                                <div class="correction-assoc-card card-correct text-only">
                                    <span class="correction-assoc-text">${this.escapeHtml(el1)}</span>
                                    <span class="correction-assoc-label">${this.escapeHtml(el2)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

                return studentHtml + correctHtml;
            }

            if (hasMarqueurs && qData.image_url) {
                // Carte / image cliquable
                const failedDetails = qDetails.filter(d => !d.correct);
                return failedDetails.map(err => `
                    <div class="correction-error-row">
                        <div class="correction-error-q">${renderElement(err.question, 'correction-q-text')}</div>
                        <div class="correction-error-answers">
                            <span class="correction-given">${this.escapeHtml(String(err.reponse || '—'))}</span>
                            ${err.attendu ? `<span class="correction-expected">→ ${renderElement((err.attendu || '').split('|')[0], 'correction-expected-val')}</span>` : ''}
                        </div>
                    </div>
                `).join('');
            }

            // Fallback : erreurs texte (QCM, V/F, Texte à trous, Question ouverte)
            return qErrors.map(err => `
                <div class="correction-error-row">
                    <div class="correction-error-q">${renderElement(err.question, 'correction-q-text')}</div>
                    <div class="correction-error-answers">
                        <span class="correction-given">${this.escapeHtml(String(err.reponse || '—'))}</span>
                        ${err.attendu ? `<span class="correction-expected">→ ${renderElement(err.attendu, 'correction-expected-val')}</span>` : ''}
                    </div>
                </div>
            `).join('');
        };

        // Helper : détermine le label du sous-format d'une question
        const getSubFormatLabel = (qData, fallbackFormat) => {
            if (qData.cartes?.length > 0) return 'Frise à cartes';
            if (qData.paires?.length > 0 && qData.mode) return 'Frise chronologique';
            if (qData.paires?.length > 0) return 'Association';
            if (qData.marqueurs?.length > 0) return 'Carte';
            if (qData.texte) return 'Texte à trous';
            return this.getFormatLabel(fallbackFormat || '');
        };

        // Slides 1..N : une par étape avec erreurs uniquement
        const etapeSlides = etapesWithErrors.map((ed, i) => {
            let content = '';
            const fmt = ed.etape.format;
            const donnees = ed.etape.donnees || {};
            const subQuestions = ed.etape.subQuestions;

            // Multi-questions : rendre chaque sous-question séparément avec le bon format visuel
            if (subQuestions && subQuestions.length > 1) {
                content = subQuestions.map((sq, qIdx) => {
                    const qDetails = sq.result.details || [];
                    const qErrors = qDetails.filter(d => !d.correct);
                    if (qErrors.length === 0) return ''; // pas d'erreurs dans cette sous-question
                    const subLabel = getSubFormatLabel(sq.qData, fmt);
                    const subContent = renderSingleCorrection(sq.qData, qDetails, qErrors);
                    return `
                        <div class="correction-sub-question">
                            <div class="correction-sub-header">
                                <span class="correction-sub-title">Exercice ${qIdx + 1}/${subQuestions.length}</span>
                                <span class="correction-sub-format">${this.escapeHtml(subLabel)}</span>
                                <span class="correction-sub-score">${sq.result.correct}/${sq.result.total}</span>
                            </div>
                            ${subContent}
                        </div>
                    `;
                }).filter(Boolean).join('');
            } else if ((fmt === 'chronologie' || fmt === 'timeline') && donnees.cartes?.length > 0) {
                // Timeline simple (pas multi) : frise élève + frise correcte
                const allDetails = ed.etape.details || [];
                content = renderSingleCorrection(donnees, allDetails, ed.errors);
            } else if (fmt === 'flashcard' && donnees.cartes?.length > 0) {
                // Flashcards : recto/verso des cartes ratées
                const allDetails = ed.etape.details || [];
                const failedIndices = allDetails.map((d, di) => !d.correct ? di : -1).filter(di => di >= 0);
                const failedCartes = failedIndices.map(fi => donnees.cartes[fi]).filter(Boolean);
                content = failedCartes.map(carte => `
                    <div class="correction-flashcard-row">
                        <div class="correction-flashcard-recto">${this.escapeHtml(carte.recto)}</div>
                        <span class="correction-flashcard-arrow">→</span>
                        <div class="correction-flashcard-verso">${this.escapeHtml(carte.verso)}</div>
                    </div>
                `).join('');
            } else if (fmt === 'carte' && donnees.marqueurs?.length > 0 && donnees.image_url) {
                // Image cliquable simple
                content = renderSingleCorrection(donnees, ed.etape.details || [], ed.errors);
            } else if (fmt === 'association' && donnees.paires?.length > 0) {
                // Association simple
                content = renderSingleCorrection(donnees, ed.etape.details || [], ed.errors);
            } else {
                // QCM, V/F, Texte à trous, Question ouverte : erreurs uniquement
                content = renderSingleCorrection(donnees, ed.etape.details || [], ed.errors);
            }

            return `
                <div class="carousel-slide hidden" data-slide="${i + 1}">
                    <div class="carousel-slide-header">
                        <span class="carousel-slide-title">${this.escapeHtml(ed.etape.etapeTitre || 'Étape ' + (ed.idx + 1))} — ${this.getFormatLabel(ed.etape.format)}</span>
                        <span class="carousel-slide-score ${ed.hasErr ? 'has-errors' : 'all-correct'}">${ed.hasErr ? '❌' : '✅'} ${ed.correct}/${ed.total}</span>
                    </div>
                    <div class="carousel-slide-content">
                        ${content}
                    </div>
                </div>
            `;
        }).join('');

        const totalSlides = etapesWithErrors.length + 1; // overview + étapes avec erreurs

        // Dots : premier = losange (overview), reste = ronds (erreurs uniquement)
        const dots = Array.from({ length: totalSlides }, (_, i) => {
            const dotClass = i === 0 ? 'carousel-dot overview-dot active' : 'carousel-dot dot-error';
            return `<button class="${dotClass}" onclick="EleveConnaissances.carouselGoTo(${i})" aria-label="Slide ${i}"></button>`;
        }).join('');

        return `
            <div class="correction-header-conn">
                <div class="carousel-nav">
                    <button class="carousel-arrow carousel-prev" onclick="EleveConnaissances.carouselPrev()" disabled>←</button>
                    <h3>📝 Détail des erreurs</h3>
                    <button class="carousel-arrow carousel-next" onclick="EleveConnaissances.carouselNext()">→</button>
                </div>
            </div>
            <div class="carousel-container">
                ${overviewSlide}
                ${etapeSlides}
            </div>
            <div class="carousel-dots">
                ${dots}
            </div>
        `;
    },

    /** Navigation carrousel : aller à un slide */
    carouselGoTo(index) {
        const container = document.querySelector('.carousel-container');
        if (!container) return;
        const slides = container.querySelectorAll('.carousel-slide');
        const totalSlides = slides.length;
        if (index < 0 || index >= totalSlides) return;

        this._carouselIndex = index;

        // Afficher/masquer les slides
        slides.forEach((slide, i) => {
            slide.classList.toggle('hidden', i !== index);
        });

        // Mettre à jour les dots
        const dots = document.querySelectorAll('.carousel-dots .carousel-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        // Mettre à jour les flèches
        const prevBtn = document.querySelector('.carousel-prev');
        const nextBtn = document.querySelector('.carousel-next');
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === totalSlides - 1;
    },

    /** Navigation carrousel : slide précédent */
    carouselPrev() {
        const idx = this._carouselIndex || 0;
        this.carouselGoTo(idx - 1);
    },

    /** Navigation carrousel : slide suivant */
    carouselNext() {
        const idx = this._carouselIndex || 0;
        this.carouselGoTo(idx + 1);
    },

    /**
     * Affiche l'écran de résultats avec récapitulatif
     */
    renderResultScreen(results) {
        const container = document.getElementById('connaissances-content');
        const ent = this.currentEntrainement;
        const prog = this.lastProgressionResult || {};

        // Temps passé
        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = (ent.duree || 5) * 60;
        const tempsOK = timeSpent <= tempsPrevu;

        // prog.etape = prochain niveau à tenter (déjà incrémenté côté serveur)
        const SEUIL_ETAPES = 6;
        const niveauValide = Math.max((prog.etape || 1) - 1, 0);
        const isSuccess = !this.isTrainingMode && prog.reussi === true;

        // Le score atteint-il le seuil de réussite ? (indépendant du mode)
        const seuilReussite = prog.seuil || 80;
        const scoreOK = results.pourcentage >= seuilReussite;

        // Déterminer le type de résultat basé sur le SCORE (pas uniquement la progression)
        let resultType, messageIcon, messageTitle;
        if (results.pourcentage >= 100) {
            resultType = 'success';
            messageIcon = '✅';
            messageTitle = isSuccess && prog.statut === 'memorise' ? 'Mémorisé !' :
                           isSuccess ? `Parfait ! Niveau ${niveauValide}/${SEUIL_ETAPES} atteint` : 'Parfait !';
        } else if (scoreOK) {
            resultType = 'success';
            messageIcon = '✅';
            messageTitle = isSuccess ? `Bravo ! Niveau ${niveauValide}/${SEUIL_ETAPES} atteint` : 'Bravo !';
        } else if (results.pourcentage >= 50) {
            resultType = 'partial';
            messageIcon = '💪';
            messageTitle = 'Pas mal !';
        } else {
            resultType = 'error';
            messageIcon = '❌';
            messageTitle = 'Continue !';
        }

        // Dots de progression (6 niveaux)
        const generateProgDots = () => {
            let html = '<div class="rep-dots">';
            for (let i = 1; i <= SEUIL_ETAPES; i++) {
                const status = i <= niveauValide ? 'completed' : 'pending';
                html += `<span class="rep-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        // Date prochaine révision
        let prochaineDateStr = '';
        if (prog.prochaine_revision) {
            prochaineDateStr = new Date(prog.prochaine_revision).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
        }

        const nextEntrainement = this.findNextEntrainement();

        // Colonne droite : félicitation si 100% sans erreur, sinon détail des erreurs
        const hasErrors = results.etapes && results.etapes.some(e => e.details && e.details.some(d => !d.correct));
        const generateRightPanel = () => {
            if (!hasErrors) {
                // Sans faute → félicitation
                const isMemorise = prog.statut === 'memorise' && prog.reussi;
                return `
                    <div class="felicitation-panel ${isMemorise ? 'memorise' : 'success'}">
                        <div class="felicitation-icon">${isMemorise ? '🏆' : '🎉'}</div>
                        <h3>${isMemorise ? 'Mémorisé !' : isSuccess ? `Niveau ${niveauValide} validé !` : 'Parfait !'}</h3>
                        <p>${isMemorise ? 'Tu maîtrises parfaitement cet entraînement. Les connaissances sont ancrées dans ta mémoire long terme !' : 'Sans faute, bravo !'}</p>
                    </div>
                `;
            }
            // Dès qu'il y a des erreurs → détail des erreurs
            return this.generateErrorDetails(results);
        };

        container.innerHTML = `
            <div class="result-view conn">
                <button class="exercise-back-btn" onclick="EleveConnaissances.backToList()">
                    ← Retour aux entraînements
                </button>

                <div class="result-card-conn">
                    <!-- COLONNE GAUCHE : BILAN -->
                    <div class="result-bilan-conn">
                        <div class="bilan-header ${resultType}">
                            <span class="bilan-icon">${messageIcon}</span>
                            <span class="bilan-message">${messageTitle}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${resultType}">
                                <span class="score-value">${results.pourcentage}%</span>
                            </div>
                            <span class="score-detail">${results.totalCorrect}/${results.totalQuestions}</span>
                        </div>

                        <div class="bilan-temps-compact">
                            <span class="temps-info">⏱️ ${this.formatTime(timeSpent)} / ${this.formatTime(tempsPrevu)}</span>
                            <span class="temps-status ${tempsOK ? 'success' : 'warning'}">${tempsOK ? '✓' : '⚠️'}</span>
                        </div>

                        ${!this.isTrainingMode ? `
                        <div class="bilan-repetition-compact">
                            <span class="rep-dots-inline">${generateProgDots()}</span>
                            <span class="rep-label">Niveau ${niveauValide}/${SEUIL_ETAPES}</span>
                        </div>
                        ` : `
                        <div class="bilan-entrainement-libre-badge">
                            <span class="libre-badge-icon">🔄</span>
                            <span class="libre-badge-text">Entraînement libre</span>
                        </div>
                        `}

                        <div class="bilan-messages">
                            ${prog.statut === 'memorise' && prog.reussi ? `
                                <div class="bilan-maitrise">
                                    <span class="maitrise-icon">🎉</span>
                                    <p>Cet entraînement est mémorisé !</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && prog.statut !== 'memorise' ? `
                                <div class="bilan-prochaine-new">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${prog.etape || 1} !</p>
                                </div>
                            ` : ''}

                            ${!isSuccess && !this.isTrainingMode && prog.reussi === false ? `
                                <div class="bilan-conseil warning">
                                    <span class="conseil-icon">💡</span>
                                    <p>Il faut ${prog.seuil || 80}% pour valider ce niveau.</p>
                                </div>
                            ` : ''}

                            <div class="bilan-actions">
                                ${!isSuccess && !this.isTrainingMode ? `
                                    <button class="btn btn-primary btn-restart-conn" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Réessayer
                                    </button>
                                ` : ''}

                                ${this.isTrainingMode && !scoreOK ? `
                                    <button class="btn btn-primary btn-restart-conn" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Recommencer
                                    </button>
                                ` : ''}

                                ${nextEntrainement && isSuccess ? `
                                    <button class="btn btn-primary btn-next-conn" onclick="EleveConnaissances.startNextEntrainement()">
                                        Passer au suivant →
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- COLONNE DROITE : FÉLICITATION ou ERREURS -->
                    <div class="result-right-conn ${!hasErrors ? 'is-felicitation' : 'is-correction'}">
                        ${generateRightPanel()}
                    </div>
                </div>
            </div>
        `;

        // Initialiser le carrousel si présent
        this._carouselIndex = 0;

        // Déclencher les animations paillettes si réussite (pas en mode libre)
        if (isSuccess && !this.isTrainingMode) {
            setTimeout(() => {
                this.triggerCelebration(niveauValide);
                if (prog.statut === 'memorise' && ent && ent.banque_exercice_id) {
                    this.checkAndCelebrateBanqueComplete(ent.banque_exercice_id);
                }
            }, 100);
        }
    },

    /**
     * Redémarre l'entraînement en mode libre (pour continuer à s'entraîner après réussite)
     */
    restartAsTraining() {
        this.isTrainingMode = true;
        // Passer true pour skipAvailabilityCheck afin de ne pas écraser isTrainingMode
        this.startEntrainement(this.currentEntrainement.id, true);
    },

    /**
     * Toggle l'affichage des détails d'une étape
     */
    toggleEtapeDetails(idx) {
        const details = document.getElementById(`etapeDetails_${idx}`);
        if (details) {
            const isHidden = details.classList.contains('hidden');
            details.classList.toggle('hidden');
            const toggle = details.previousElementSibling.querySelector('.etape-recap-toggle');
            if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
        }
    },

    /**
     * Calcule le nombre de jours jusqu'à une date
     */
    calculateDaysUntil(dateStr) {
        const target = new Date(dateStr);
        const now = new Date();
        return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
    },

    /**
     * Trouve l'entraînement suivant dans la même banque
     */
    findNextEntrainement() {
        if (!this.currentBanque || !this.entrainements) return null;

        const currentBanqueEntrainements = this.entrainements
            .filter(e => String(e.banque_exercice_id) === String(this.currentBanque.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const currentIndex = currentBanqueEntrainements.findIndex(e => e.id === this.currentEntrainement.id);
        if (currentIndex >= 0 && currentIndex < currentBanqueEntrainements.length - 1) {
            return currentBanqueEntrainements[currentIndex + 1];
        }
        return null;
    },

    /**
     * Recommence l'entraînement actuel
     */
    restartEntrainement() {
        this.currentEtapeIndex = 0;
        this.userAnswers = {};
        this.currentEtapeValidated = false;
        this.etapesResults = [];
        // Réinitialiser les états d'association
        this.associationSelection = { grid: null, chip: null };
        this.associationPairs = [];
        this.associationPairCounter = 0;
        // Réinitialiser les états multi-format
        this._multiFormatState = null;
        this._qcmResults = {};
        this._qoResults = {};
        this.renderEntrainementView();
    },

    /**
     * Nettoie tous les event listeners pour éviter les fuites mémoire
     */
    cleanupEventListeners() {
        // Timeline drag-drop listeners
        const timelineCards = document.querySelectorAll('.timeline-card');
        timelineCards.forEach(card => {
            const newCard = card.cloneNode(true);
            if (card.parentNode) {
                card.parentNode.replaceChild(newCard, card);
            }
        });

        // Timeline toggle buttons
        const toggleBtns = document.querySelectorAll('.timeline-toggle button');
        toggleBtns.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            if (btn.parentNode) {
                btn.parentNode.replaceChild(newBtn, btn);
            }
        });

        // Fullscreen escape handler
        if (this._fullscreenEscapeHandler) {
            document.removeEventListener('keydown', this._fullscreenEscapeHandler);
            this._fullscreenEscapeHandler = null;
        }
    },

    /**
     * Lance l'entraînement suivant
     */
    startNextEntrainement() {
        const next = this.findNextEntrainement();
        if (next) {
            this.startEntrainement(next.id);
        } else {
            this.backToList();
        }
    },

    /**
     * Back to accordion list
     */
    backToList() {
        this.stopTimer();
        this.currentEntrainement = null;
        this.currentEtapes = [];
        this.currentEtapeIndex = 0;
        this.userAnswers = {};
        this.renderAccordionView();
    },

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="type-header-banner connaissances">
                <div class="type-header-left">
                    <div class="type-icon-emoji">📚</div>
                    <div>
                        <h2 class="type-title">Entraînement de connaissances</h2>
                    </div>
                </div>
            </div>
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h3>Aucun entraînement disponible</h3>
                <p>Les entraînements de connaissances seront bientôt disponibles.</p>
            </div>
        `;
    },

    // Utility methods
    showLoader(message) {
        const container = document.getElementById('connaissances-content');
        container.innerHTML = `
            <div class="page-loader">
                <div class="spinner"></div>
                <p>${message}</p>
            </div>
        `;
    },

    showError(message) {
        const container = document.getElementById('connaissances-content');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <h3>Erreur</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="EleveConnaissances.init()">Réessayer</button>
            </div>
        `;
    },

});
