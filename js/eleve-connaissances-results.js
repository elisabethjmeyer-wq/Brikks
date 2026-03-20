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
                    details.push({ question: `Question ${i + 1}`, reponse: null, attendu: 'Non répondu', correct: false });
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
        const format = this.normalizeFormat(etape.format_code);

        switch (format) {
            case 'qcm':
                return donnees.multiQuestions?.length || 1;
            case 'vrai_faux':
                return donnees.propositions?.length || 1;
            case 'chronologie':
            case 'timeline':
                return donnees.cartes?.length || donnees.paires?.length || 1;
            case 'texte_trou':
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
            } else {
                Logger.error('EleveConnaissances', 'Erreur sauvegarde progression (API)', response.error);
                this.lastProgressionResult = { saveError: true, error: response.error };
            }
        } catch (error) {
            Logger.error('EleveConnaissances', 'Erreur sauvegarde progression', error);
            this.lastProgressionResult = { saveError: true };
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
                <p class="locked-modal-title">${escapeHtml(titre)}</p>
                <p class="locked-modal-message">
                    Tu as réussi cet entraînement ! Pour que ça reste en mémoire,
                    reviens <strong>${dateStr}</strong> pour la prochaine révision.
                </p>
                <div class="locked-modal-info">
                    <div class="locked-modal-etape">Niveau ${Math.max((prog.etape || 1) - 1, 0)}/${this.SEUIL_ETAPES} validé</div>
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
            if (!val || val === '—' || val === 'Non répondu') return `<span class="${className}">Non répondu</span>`;
            const str = String(val);
            if (isImageUrl(str)) {
                return `<img class="correction-mini-img ${className}" src="${escapeHtml(this.normalizeImageUrl(str))}" alt="" />`;
            }
            return `<span class="${className}">${escapeHtml(str)}</span>`;
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
                                    <span class="overview-etape-name">${escapeHtml(ed.etape.etapeTitre || 'Étape ' + (ed.idx + 1))} — ${this.getFormatLabel(ed.etape.format)}</span>
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
                            const imgStyle = hasImage ? `style="background-image: url('${escapeHtml(imageUrl)}');"` : '';
                            const statusClass = sc.correct ? 'card-correct' : 'card-incorrect';
                            return `
                                <div class="correction-timeline-card ${hasImage ? 'has-image' : ''} ${statusClass}" ${imgStyle}>
                                    <span class="correction-timeline-pos">${ci + 1}</span>
                                    <span class="correction-timeline-titre">${escapeHtml(sc.titre || 'Non répondu')}</span>
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
                            const imgStyle = hasImage ? `style="background-image: url('${escapeHtml(imageUrl)}');"` : '';
                            return `
                                <div class="correction-timeline-card ${hasImage ? 'has-image' : ''}" ${imgStyle}>
                                    <span class="correction-timeline-pos">${ci + 1}</span>
                                    <span class="correction-timeline-titre">${escapeHtml(carte.titre)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
                return studentHtml + correctHtml;
            }

            if (hasPaires && hasMode) {
                // Chronologie texte (frise avec dates/événements à compléter) : erreurs uniquement
                return qErrors.map(err => {
                    const isUnanswered = !err.reponse;
                    const givenClass = isUnanswered ? 'correction-given correction-given--empty' : 'correction-given';
                    return `
                    <div class="correction-error-row">
                        <div class="correction-error-q">${renderElement(err.question, 'correction-q-text')}</div>
                        <div class="correction-error-answers">
                            <span class="${givenClass}">${escapeHtml(String(err.reponse || 'Non répondu'))}</span>
                            ${err.attendu ? `<span class="correction-expected">→ ${renderElement(err.attendu, 'correction-expected-val')}</span>` : ''}
                        </div>
                    </div>
                `}).join('');
            }

            if (hasPaires) {
                // Association : rendu grille de cartes (même style que la frise chronologique)
                // d.question = element1 de la paire, d.reponse = element2 associé par l'élève
                const studentPairs = qDetails.map(d => ({
                    element1: d.question,
                    userAnswer: d.reponse,
                    expected: d.attendu,
                    correct: d.correct
                }));

                // Helper : rend une carte d'association
                // Détecte automatiquement si val1 ou val2 est une image
                // L'image va en background, le texte en label
                const renderAssocCard = (val1, val2, statusClass, isUnanswered) => {
                    const v1IsImg = val1 && isImageUrl(val1);
                    const v2IsImg = val2 && isImageUrl(val2);

                    let imageUrl = '';
                    let textVal = '';
                    let labelVal = '';

                    if (v1IsImg && !v2IsImg) {
                        // element1 = image, element2 = texte label
                        imageUrl = this.normalizeImageUrl(val1);
                        labelVal = isUnanswered ? 'Non répondu' : (val2 || '');
                    } else if (!v1IsImg && v2IsImg) {
                        // element1 = texte, element2 = image → afficher texte + image miniature en label
                        textVal = val1 || '';
                        labelVal = isUnanswered ? 'Non répondu' : (val2 || '');
                    } else {
                        // Texte ↔ texte (ou image ↔ image fallback)
                        textVal = val1 || '';
                        labelVal = isUnanswered ? 'Non répondu' : (val2 || '');
                    }

                    const hasImage = !!imageUrl;
                    const imgStyle = hasImage ? `style="background-image: url('${escapeHtml(imageUrl)}');"` : '';
                    const labelClass = isUnanswered ? 'correction-assoc-card-label correction-assoc-card-label--empty' : 'correction-assoc-card-label';
                    // Si le label est une image URL, afficher une miniature
                    const labelIsImg = labelVal && isImageUrl(labelVal);
                    const labelHtml = labelIsImg
                        ? `<img class="correction-assoc-card-label-img" src="${escapeHtml(this.normalizeImageUrl(labelVal))}" alt="">`
                        : `<span class="${labelClass}">${escapeHtml(labelVal)}</span>`;

                    return `
                        <div class="correction-timeline-card correction-assoc-card-v2 ${hasImage ? 'has-image' : ''} ${statusClass}" ${imgStyle}>
                            ${!hasImage && textVal ? `<span class="correction-timeline-titre">${escapeHtml(textVal)}</span>` : ''}
                            ${labelHtml}
                        </div>
                    `;
                };

                // Section "Ta réponse :"
                const studentHtml = studentPairs.length > 0 ? `
                    <p class="correction-timeline-hint correction-timeline-hint--student">Ta réponse :</p>
                    <div class="correction-timeline-cards">
                        ${studentPairs.map(sp => {
                            const statusClass = sp.correct ? 'card-correct' : 'card-incorrect';
                            const isUnanswered = !sp.userAnswer || sp.userAnswer === 'Non répondu';
                            return renderAssocCard(sp.element1, sp.userAnswer, statusClass, isUnanswered);
                        }).join('')}
                    </div>
                ` : '';

                // Section "Réponse correcte :"
                const correctHtml = `
                    <p class="correction-timeline-hint correction-timeline-hint--correct">Réponse correcte :</p>
                    <div class="correction-timeline-cards">
                        ${qData.paires.map(p => renderAssocCard(p.element1, p.element2, '', false)).join('')}
                    </div>
                `;

                return studentHtml + correctHtml;
            }

            if (hasMarqueurs && qData.image_url) {
                // Image cliquable : marqueurs sur l'image avec popover au clic
                const marqueurs = qData.marqueurs || [];
                const imageUrl = this.normalizeImageUrl(qData.image_url);

                const markersHtml = marqueurs.map((m, idx) => {
                    const detail = qDetails[idx];
                    const isCorrect = detail ? detail.correct : false;
                    const statusClass = isCorrect ? 'marker-correct' : 'marker-incorrect';
                    const correctAnswer = (m.reponse || '').split('|')[0].trim();
                    const userAnswer = detail ? (detail.reponse || 'Non répondu') : 'Non répondu';
                    const isUnanswered = !detail || !detail.reponse || detail.reponse === 'Non répondu';

                    // Déterminer le côté du popover selon la position du marqueur
                    const popoverSide = m.x > 55 ? 'popover-left' : 'popover-right';
                    const popoverVert = m.y > 70 ? 'popover-above' : '';

                    let popoverContent;
                    if (isCorrect) {
                        popoverContent = `
                            <div class="popover-panel popover-panel--correct">
                                <span class="popover-panel-icon">✓</span>
                                <span class="popover-panel-value">${escapeHtml(userAnswer)}</span>
                            </div>`;
                    } else if (isUnanswered) {
                        popoverContent = `
                            <div class="popover-panel popover-panel--wrong">
                                <span class="popover-panel-icon">✗</span>
                                <span class="popover-panel-label">Non répondu</span>
                            </div>
                            <div class="popover-panel popover-panel--correct">
                                <span class="popover-panel-icon">✓</span>
                                <span class="popover-panel-value">${escapeHtml(correctAnswer)}</span>
                            </div>`;
                    } else {
                        popoverContent = `
                            <div class="popover-panel popover-panel--wrong">
                                <span class="popover-panel-icon">✗</span>
                                <span class="popover-panel-value">${escapeHtml(userAnswer)}</span>
                            </div>
                            <div class="popover-panel popover-panel--correct">
                                <span class="popover-panel-icon">✓</span>
                                <span class="popover-panel-value">${escapeHtml(correctAnswer)}</span>
                            </div>`;
                    }

                    return `
                        <div class="correction-carte-marker ${statusClass}"
                             style="left: ${m.x}%; top: ${m.y}%;"
                             onclick="event.stopPropagation(); this.parentElement.querySelectorAll('.popover-open').forEach(m => { if(m!==this) m.classList.remove('popover-open') }); this.classList.toggle('popover-open')" role="button" tabindex="0">
                            <span class="correction-carte-marker-num">${idx + 1}</span>
                            <div class="correction-carte-popover ${popoverSide} ${popoverVert}">
                                <span class="popover-marker-num">${idx + 1}</span>
                                ${popoverContent}
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="correction-carte-visual">
                        <div class="correction-carte-image-wrapper correction-carte-image-wrapper--popover">
                            <img src="${escapeHtml(imageUrl)}" alt="Carte" class="correction-carte-image">
                            <div class="correction-carte-markers-layer">
                                ${markersHtml}
                            </div>
                        </div>
                        <p class="correction-carte-tap-hint">Clique sur un marqueur pour voir le détail</p>
                    </div>
                `;
            }

            // Texte à trous : afficher le texte reconstitué avec réponses en couleur
            const trouTexte = qData.texte || (qData.multiQuestions?.[0]?.texte);
            if (trouTexte && qDetails.some(d => d.question?.startsWith('Trou '))) {
                let trouIdx = 0;
                const rebuilt = trouTexte.replace(/\{([^}]+)\}/g, (_match, correctWord) => {
                    const detail = qDetails[trouIdx++];
                    if (!detail) return correctWord;
                    if (detail.correct) {
                        return `<span class="trou-correction trou-correct">${escapeHtml(detail.reponse || correctWord)}</span>`;
                    }
                    const studentVal = detail.reponse || '…';
                    return `<span class="trou-correction trou-incorrect">${escapeHtml(studentVal)}</span>` +
                        `<span class="trou-correction trou-expected">→ ${escapeHtml(correctWord)}</span>`;
                });
                return `<div class="correction-texte-trous">${rebuilt}</div>`;
            }

            // Fallback : erreurs texte (QCM, V/F, Question ouverte)
            // Layout panélisé : question → bloc erreur (réponse + feedback) → bloc bonne réponse
            return qErrors.map(err => {
                const isUnanswered = !err.reponse;
                const hasFeedback = !!err.feedbackOption;
                return `
                <div class="correction-error-block">
                    <div class="correction-error-question">${renderElement(err.question, 'correction-q-text')}</div>
                    <div class="correction-error-panel correction-panel-wrong">
                        <div class="correction-panel-header">
                            <span class="correction-panel-icon">✗</span>
                            <span class="correction-panel-label">${isUnanswered ? 'Non répondu' : 'Ta réponse'}</span>
                        </div>
                        ${!isUnanswered ? `<div class="correction-panel-value correction-panel-value--wrong">${escapeHtml(String(err.reponse))}</div>` : ''}
                        ${hasFeedback ? `<div class="correction-panel-feedback">${escapeHtml(err.feedbackOption)}</div>` : ''}
                    </div>
                    ${err.attendu ? `
                    <div class="correction-error-panel correction-panel-correct">
                        <div class="correction-panel-header">
                            <span class="correction-panel-icon">✓</span>
                            <span class="correction-panel-label">Bonne réponse</span>
                        </div>
                        <div class="correction-panel-value correction-panel-value--correct">${renderElement(err.attendu, 'correction-expected-val')}</div>
                    </div>
                    ` : ''}
                </div>
            `}).join('');
        };

        // Helper : détermine le label du sous-format d'une question
        const getSubFormatLabel = (qData, fallbackFormat) => {
            if (qData.cartes?.length > 0) return 'Frise à cartes';
            if (qData.paires?.length > 0 && qData.mode) return 'Frise chronologique';
            if (qData.paires?.length > 0) return 'Association';
            if (qData.marqueurs?.length > 0) return 'Carte';
            if (qData.texte || qData.multiQuestions?.[0]?.texte) return 'Texte à trous';
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
                                <span class="correction-sub-format">${escapeHtml(subLabel)}</span>
                                <span class="correction-sub-score">${sq.result.correct}/${sq.result.total}</span>
                            </div>
                            ${subContent}
                        </div>
                    `;
                }).filter(Boolean).join('');
            } else if ((fmt === 'chronologie' || fmt === 'timeline') && (donnees.cartes?.length > 0 || (donnees.paires?.length > 0 && donnees.mode))) {
                // Timeline simple (pas multi) : frise élève + frise correcte
                const allDetails = ed.etape.details || [];
                content = renderSingleCorrection(donnees, allDetails, ed.errors);
            } else if (fmt === 'flashcard' && donnees.cartes?.length > 0) {
                // Flashcards : cartes retournables comme à l'entraînement
                const allDetails = ed.etape.details || [];
                const failedIndices = allDetails.map((d, di) => !d.correct ? di : -1).filter(di => di >= 0);
                const failedCartes = failedIndices.map(fi => donnees.cartes[fi]).filter(Boolean);
                content = `
                    <div class="correction-flashcards-grid">
                        ${failedCartes.map((carte, _ci) => `
                            <div class="correction-fc-scene" onclick="this.querySelector('.correction-fc-card').classList.toggle('flipped')">
                                <div class="correction-fc-card">
                                    <div class="correction-fc-face correction-fc-front">
                                        <div class="correction-fc-face-label">Recto</div>
                                        <div class="correction-fc-face-content">${escapeHtml(carte.recto)}</div>
                                        <div class="correction-fc-hint">Cliquer pour retourner</div>
                                    </div>
                                    <div class="correction-fc-face correction-fc-back">
                                        <div class="correction-fc-face-label">Verso</div>
                                        <div class="correction-fc-face-content">${escapeHtml(carte.verso)}</div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
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
                        <span class="carousel-slide-title">${escapeHtml(ed.etape.etapeTitre || 'Étape ' + (ed.idx + 1))} — ${this.getFormatLabel(ed.etape.format)}</span>
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

        // Fermer les popovers ouverts quand on clique en dehors d'un marqueur
        // Retirer l'ancien listener avant d'en ajouter un nouveau (évite les fuites mémoire)
        if (this._popoverClickHandler) {
            document.removeEventListener('click', this._popoverClickHandler);
        }
        this._popoverClickHandler = (e) => {
            if (!e.target.closest('.correction-carte-marker')) {
                document.querySelectorAll('.correction-carte-marker.popover-open').forEach(m => m.classList.remove('popover-open'));
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this._popoverClickHandler);
        }, 100);

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
        const niveauValide = Math.max((prog.etape || 1) - 1, 0);
        const SEUIL_ETAPES = this.SEUIL_ETAPES;
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

        // Dots de progression (7 niveaux)
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

                            ${prog.saveError ? `
                                <div class="bilan-conseil save-error">
                                    <span class="conseil-icon">⚠️</span>
                                    <p>Ta progression n'a pas pu être enregistrée (problème de connexion). Réessaie plus tard.</p>
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
        this._finishing = false;
        this.currentEtapeIndex = 0;
        this.etapesResults = [];
        this.exerciseStartTime = Date.now();
        this.resetEtapeState();
        this.selectedQuestionsPerEtape = {};
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

        // Popover click handler (correction carte)
        if (this._popoverClickHandler) {
            document.removeEventListener('click', this._popoverClickHandler);
            this._popoverClickHandler = null;
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
        this._finishing = false;
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
