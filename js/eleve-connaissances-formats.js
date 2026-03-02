/**
 * eleve-connaissances-formats.js
 * Format renderers and interactions
 * Extracted from eleve-connaissances.js for maintainability
 */

Object.assign(EleveConnaissances, {

    combineQuestionsData(format, questionContents) {
        Logger.debug('EleveConnaissances', 'combineQuestionsData', { format, questionCount: questionContents.length });

        switch (format) {
            case 'vrai_faux':
                // Combiner en tableau de propositions
                return {
                    propositions: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        texte: qc.donnees.question || qc.donnees.enonce || qc.donnees.texte || `Question ${idx + 1}`,
                        reponse: qc.donnees.reponse ?? qc.donnees.reponse_correcte ?? null,
                        feedback: qc.donnees.feedback,
                        feedback_vrai: qc.donnees.feedback_vrai,
                        feedback_faux: qc.donnees.feedback_faux
                    }))
                };

            case 'qcm':
                // Pour QCM, on affiche chaque question séparément
                // On retourne un tableau de questions
                return {
                    multiQuestions: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        question: qc.donnees.question || qc.donnees.enonce || qc.donnees.titre || `Question ${idx + 1}`,
                        choix: qc.donnees.choix || qc.donnees.options || [],
                        reponse: qc.donnees.reponse ?? qc.donnees.reponse_correcte ?? null,
                        reponses_correctes: qc.donnees.reponses_correctes || [],
                        multiple: qc.donnees.multiple || false,
                        feedbacks_options: qc.donnees.feedbacks_options,
                        feedback_correct: qc.donnees.feedback_correct,
                        feedback_incorrect: qc.donnees.feedback_incorrect
                    }))
                };

            case 'timeline':
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        ...qc.donnees,
                        consigne: qc.donnees.consigne || qc.donnees.question || ''
                    }))
                };

            case 'association':
                // Chaque question association séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        consigne: qc.donnees.consigne || qc.donnees.question || '',
                        paires: qc.donnees.paires || []
                    }))
                };

            case 'texte_trou':
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        texte: qc.donnees.texte || qc.donnees.question || qc.donnees.texte_original || '',
                        mots: qc.donnees.mots || [],
                        trous: qc.donnees.trous || []
                    }))
                };

            case 'carte':
                // Chaque image cliquable séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        consigne: qc.donnees.consigne || qc.donnees.question || '',
                        image_url: qc.donnees.image_url || qc.donnees.image || '',
                        marqueurs: qc.donnees.marqueurs || []
                    }))
                };

            case 'question_ouverte':
                return {
                    multiQuestions: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        question: qc.donnees.question || qc.donnees.enonce || qc.donnees.titre || `Question ${idx + 1}`,
                        reponses_acceptees: qc.donnees.reponses_acceptees || qc.donnees.reponses || [],
                        comparaison_stricte: qc.donnees.comparaison_stricte || false,
                        feedback_correct: qc.donnees.feedback_correct,
                        feedback_incorrect: qc.donnees.feedback_incorrect
                    }))
                };

            case 'flashcard':
                // Combiner toutes les cartes
                const allCartes = [];
                questionContents.forEach(qc => {
                    if (qc.donnees.cartes?.length) {
                        allCartes.push(...qc.donnees.cartes);
                    } else {
                        allCartes.push({
                            titre: qc.donnees.titre || qc.donnees.question || '',
                            contenu: qc.donnees.contenu || qc.donnees.reponse || ''
                        });
                    }
                });
                return {
                    consigne: questionContents[0]?.donnees?.consigne || '',
                    cartes: allCartes
                };

            default:
                // Par défaut, retourner la première question
                return questionContents[0]?.donnees || {};
        }
    },

    /**
     * Render Vrai/Faux questions
     * Supporte deux formats:
     * - Simple: {question, reponse} - une seule question
     * - Multi: {propositions: [{texte, reponse}, ...]} - plusieurs propositions
     */
    renderVraiFaux(donnees, questions) {
        const questionText = donnees.question || donnees.enonce || '';

        // Format simple: une seule question vrai/faux
        if (donnees.reponse !== undefined && !donnees.propositions) {
            return `
                <div class="vrai-faux-container">
                    <div class="vrai-faux-items">
                        <div class="vrai-faux-item" data-index="0">
                            <div class="vf-proposition">${this.escapeHtml(questionText)}</div>
                            <div class="vf-choices">
                                <label class="vf-choice">
                                    <input type="radio" name="vf_0" value="vrai" onchange="EleveConnaissances.saveAnswer('vf_0', 'vrai')">
                                    <span class="vf-btn vrai">Vrai</span>
                                </label>
                                <label class="vf-choice">
                                    <input type="radio" name="vf_0" value="faux" onchange="EleveConnaissances.saveAnswer('vf_0', 'faux')">
                                    <span class="vf-btn faux">Faux</span>
                                </label>
                            </div>
                            <div class="vf-feedback hidden" id="feedback_vf_0"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Format multi: plusieurs propositions
        const items = donnees.propositions || [];

        // Vérifier qu'on a des données à afficher
        if (items.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de propositions configurées.</p>
                    <small>L'enseignant doit ajouter des propositions Vrai/Faux dans le formulaire d'édition.</small>
                </div>
            `;
        }

        const totalVf = items.length;
        if (totalVf > 1) {
            this._vfNavIndex = 0;
            this._vfResults = {};
        }

        return `
            <div class="vrai-faux-container" ${totalVf > 1 ? `data-total-vf="${totalVf}"` : ''}>
                ${questionText ? `<div class="question-enonce">${this.escapeHtml(questionText)}</div>` : ''}
                <div class="vrai-faux-items">
                    ${items.map((item, idx) => `
                        <div class="vrai-faux-item${totalVf > 1 && idx > 0 ? ' hidden' : ''}" data-index="${idx}">
                            <div class="vf-proposition">${this.escapeHtml(item.texte || item)}</div>
                            <div class="vf-choices">
                                <label class="vf-choice">
                                    <input type="radio" name="vf_${idx}" value="vrai" onchange="EleveConnaissances.saveAnswer('vf_${idx}', 'vrai')">
                                    <span class="vf-btn vrai">Vrai</span>
                                </label>
                                <label class="vf-choice">
                                    <input type="radio" name="vf_${idx}" value="faux" onchange="EleveConnaissances.saveAnswer('vf_${idx}', 'faux')">
                                    <span class="vf-btn faux">Faux</span>
                                </label>
                            </div>
                            <div class="vf-feedback hidden" id="feedback_vf_${idx}"></div>
                        </div>
                        ${totalVf > 1 ? `
                            <div class="vf-question-action${idx > 0 ? ' hidden' : ''}" id="vf_action_${idx}" data-for-vf="${idx}">
                                <button class="btn-qcm-validate" onclick="EleveConnaissances.validateVfQuestion(${idx})">Valider</button>
                            </div>
                        ` : ''}
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render QCM questions
     * Supporte:
     * - Format simple: {question, choix, reponse}
     * - Format multi: {multiQuestions: [{question, choix, reponse}, ...]}
     */
    renderQCM(donnees, questions) {
        // Format multi-questions (plusieurs QCM dans une étape)
        if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
            this._qcmNavIndex = 0;
            this._qcmResults = {};
            const totalQ = donnees.multiQuestions.length;
            return `
                <div class="qcm-multi-container" data-total-q="${totalQ}">
                    ${donnees.multiQuestions.map((q, qIdx) => {
                        const choices = q.choix || q.options || [];
                        const multiple = q.multiple || false;

                        if (choices.length === 0) {
                            return `<div class="qcm-question-block${qIdx > 0 ? ' hidden' : ''}" data-question="${qIdx}">
                                <div class="format-no-data">Question ${qIdx + 1}: Pas de choix configurés</div>
                            </div>`;
                        }

                        // Mélanger les choix
                        const indexedChoices = choices.map((choice, idx) => ({ choice, originalIdx: idx }));
                        const shuffledChoices = this.shuffleArray([...indexedChoices]);

                        return `
                            <div class="qcm-question-block${qIdx > 0 ? ' hidden' : ''}" data-question="${qIdx}">
                                <div class="question-enonce">${this.escapeHtml(q.question || `Question ${qIdx + 1}`)}</div>
                                <div class="qcm-choices">
                                    ${shuffledChoices.map(({ choice, originalIdx }) => `
                                        <label class="qcm-choice">
                                            <input type="${multiple ? 'checkbox' : 'radio'}"
                                                   name="qcm_answer_${qIdx}"
                                                   value="${originalIdx}"
                                                   onchange="EleveConnaissances.saveAnswer('qcm_${qIdx}', '${originalIdx}')">
                                            <span class="qcm-label">${this.escapeHtml(choice.texte || choice)}</span>
                                        </label>
                                    `).join('')}
                                </div>
                                <div class="qcm-feedback hidden" id="feedback_qcm_${qIdx}"></div>
                            </div>
                            ${totalQ > 1 ? `
                                <div class="qcm-question-action${qIdx > 0 ? ' hidden' : ''}" id="qcm_action_${qIdx}" data-for-qcm="${qIdx}">
                                    <button class="btn-qcm-validate" onclick="EleveConnaissances.validateQcmQuestion(${qIdx})">Valider</button>
                                </div>
                            ` : ''}
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Format simple (une seule question QCM)
        const question = donnees.question || donnees.enonce || '';
        // Accepter 'choix' ou 'options' comme nom de champ
        const choices = donnees.choix || donnees.options || [];
        const multiple = donnees.multiple || false;

        // Vérifier qu'on a des choix
        if (choices.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de choix configurés.</p>
                    <small>L'enseignant doit ajouter des choix QCM dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Mélanger les choix tout en gardant trace de l'index original
        const indexedChoices = choices.map((choice, idx) => ({ choice, originalIdx: idx }));
        const shuffledChoices = this.shuffleArray([...indexedChoices]);

        return `
            <div class="qcm-container">
                ${question ? `<div class="question-enonce">${this.escapeHtml(question)}</div>` : ''}
                <div class="qcm-choices">
                    ${shuffledChoices.map(({ choice, originalIdx }) => `
                        <label class="qcm-choice">
                            <input type="${multiple ? 'checkbox' : 'radio'}"
                                   name="qcm_answer"
                                   value="${originalIdx}"
                                   onchange="EleveConnaissances.saveAnswer('qcm', ${multiple} ? this.parentElement : '${originalIdx}')">
                            <span class="qcm-label">${this.escapeHtml(choice.texte || choice)}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="qcm-feedback hidden" id="feedback_qcm"></div>
            </div>
        `;
    },

    /**
     * Render Chronologie (frise chronologique)
     * Format admin: {consigne, mode, paires: [{date, evenement, reponses_acceptees?}, ...]}
     * - mode 'date' : L'événement est affiché, l'élève trouve la date
     * - mode 'evenement' : La date est affichée, l'élève trouve l'événement
     */
    renderChronologie(donnees, questions) {
        // Multi-question : carousel render-on-demand
        if (donnees.multiQuestions && donnees.multiQuestions.length > 1) {
            return this.renderMultiFormat('timeline', donnees, questions);
        }
        // Accepter 'paires' ou 'evenements' comme nom de champ
        const events = donnees.paires || donnees.evenements || [];
        const mode = donnees.mode || 'date'; // 'date' = élève tape dates, 'evenement' = élève tape événements
        const consigne = donnees.consigne || '';

        // Vérifier qu'on a des événements
        if (events.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore d'événements configurés.</p>
                    <small>L'enseignant doit ajouter des événements chronologiques dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Trier les événements par date pour la frise
        const sortedEvents = this.sortEventsByDate(events);

        // Instruction par défaut selon le mode
        let defaultInstruction = '';
        if (mode === 'date') {
            defaultInstruction = 'Complétez les dates manquantes sur la frise chronologique';
        } else {
            defaultInstruction = 'Complétez les événements manquants sur la frise chronologique';
        }

        // Stocker les réponses correctes hors DOM
        sortedEvents.forEach((evt, idx) => {
            if (mode === 'evenement') {
                this.storeAnswer(`chrono_evt_${idx}`, evt.evenement, evt.reponses_acceptees || []);
            } else {
                this.storeAnswer(`chrono_date_${idx}`, String(evt.date), evt.reponses_acceptees || []);
            }
        });

        return `
            <div class="chronologie-container">
                <p class="chrono-instruction">${this.escapeHtml(consigne || defaultInstruction)}</p>

                <!-- Frise chronologique avec champs de saisie -->
                <div class="chrono-frise-wrapper">
                    <div class="chrono-frise">
                        <div class="chrono-ligne">
                            <div class="chrono-fleche"></div>
                        </div>
                        <div class="chrono-points">
                            ${sortedEvents.map((evt, idx) => `
                                <div class="chrono-point-container" data-index="${idx}">
                                    <div class="chrono-point"></div>
                                    ${mode === 'evenement' ? `
                                        <!-- Mode: l'élève tape l'événement, la date est affichée -->
                                        <div class="chrono-date-label chrono-given">${this.escapeHtml(String(evt.date))}</div>
                                        <div class="chrono-input-zone">
                                            <input type="text"
                                                   class="chrono-input chrono-input-evenement"
                                                   id="chrono_evt_${idx}"
                                                   data-index="${idx}"
                                                   placeholder="Événement..."
                                                   autocomplete="off"
                                                   oninput="EleveConnaissances.saveChronoAnswer(${idx}, 'evenement', this.value)">
                                        </div>
                                    ` : `
                                        <!-- Mode: l'élève tape la date, l'événement est affiché -->
                                        <div class="chrono-input-zone">
                                            <input type="text"
                                                   class="chrono-input chrono-input-date"
                                                   id="chrono_date_${idx}"
                                                   data-index="${idx}"
                                                   placeholder="Date..."
                                                   autocomplete="off"
                                                   oninput="EleveConnaissances.saveChronoAnswer(${idx}, 'date', this.value)">
                                        </div>
                                        <div class="chrono-event-label chrono-given">${this.escapeHtml(evt.evenement)}</div>
                                    `}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Sauvegarde la réponse de l'élève pour la chronologie
     */
    saveChronoAnswer(index, type, value) {
        if (!this.userAnswers['chrono']) {
            this.userAnswers['chrono'] = {};
        }
        this.userAnswers['chrono'][index] = {
            type: type,
            value: value.trim()
        };
    },

    /**
     * Render Timeline (cartes draggables avec image de fond optionnelle par carte)
     */
    renderTimeline(donnees, questions) {
        // Multi-question : carousel render-on-demand
        if (donnees.multiQuestions && donnees.multiQuestions.length > 1) {
            return this.renderMultiFormat('timeline', donnees, questions);
        }
        const cartes = donnees.cartes || [];

        // Vérifier qu'on a des cartes
        if (cartes.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de cartes configurées.</p>
                    <small>L'enseignant doit ajouter des cartes Timeline dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Stocker l'ordre original pour validation (l'ordre de création EST l'ordre correct)
        this.timelineCartes = cartes;

        // Créer un tableau avec les index originaux pour le mélange
        const cartesAvecIndex = cartes.map((carte, originalIndex) => ({ ...carte, originalIndex }));

        // Mélange Fisher-Yates (vrai mélange aléatoire)
        const shuffled = [...cartesAvecIndex];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        // Setup drag & drop after render ET sauvegarder l'ordre initial
        setTimeout(() => {
            this.setupTimelineDragDrop();
            this.saveTimelineOrder();
        }, 100);

        return `
            <div class="timeline-container">
                <p class="timeline-instruction">Replacez les événements dans l'ordre chronologique en les faisant glisser.</p>
                <div class="timeline-cards" id="timelineCards">
                    ${shuffled.map((carte) => {
                        const imageUrl = this.normalizeImageUrl(carte.image_url);
                        const hasImage = imageUrl ? true : false;
                        const imgStyle = hasImage ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                        return `
                        <div class="timeline-card ${hasImage ? 'has-image' : ''}" draggable="true" data-original-index="${carte.originalIndex}" data-titre="${this.escapeHtml(carte.titre)}" ${imgStyle}>
                            <span class="timeline-card-titre">${this.escapeHtml(carte.titre)}</span>
                        </div>
                    `}).join('')}
                </div>
                <div class="chronologie-feedback hidden" id="feedback_timeline"></div>
            </div>
        `;
    },

    // État pour le drag & drop de la timeline
    timelineCartes: [],
    timelineDraggedCard: null,

    /**
     * Setup drag & drop pour la timeline
     */
    setupTimelineDragDrop() {
        const container = document.getElementById('timelineCards');
        if (!container) return;

        const cards = container.querySelectorAll('.timeline-card');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.timelineDraggedCard = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.timelineDraggedCard = null;
                // Sauvegarder l'ordre actuel
                this.saveTimelineOrder();
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this.timelineDraggedCard || this.timelineDraggedCard === card) return;

                const rect = card.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                if (e.clientX < midX) {
                    card.parentNode.insertBefore(this.timelineDraggedCard, card);
                } else {
                    card.parentNode.insertBefore(this.timelineDraggedCard, card.nextSibling);
                }
            });
        });
    },

    /**
     * Sauvegarde l'ordre des cartes timeline
     */
    saveTimelineOrder() {
        const container = document.getElementById('timelineCards');
        if (!container) return;

        const cards = Array.from(container.querySelectorAll('.timeline-card'));
        const order = cards.map(card => ({
            originalIndex: parseInt(card.dataset.originalIndex),
            titre: card.dataset.titre
        }));
        this.userAnswers['timeline_order'] = order;
    },

    /**
     * Ajoute un toggle "Ma réponse" / "Correction" au-dessus des cartes timeline.
     * Permet à l'élève de basculer entre son ordre et l'ordre correct avec animation.
     */
    addTimelineToggle(cardsContainer, cartes, studentOrder) {
        // Ne pas ajouter si déjà présent
        if (cardsContainer.parentElement.querySelector('.timeline-toggle')) return;

        const toggleHtml = `
            <div class="timeline-toggle">
                <button class="toggle-btn active" data-view="student">Ma réponse</button>
                <button class="toggle-btn" data-view="correction">Correction</button>
            </div>
        `;
        cardsContainer.insertAdjacentHTML('beforebegin', toggleHtml);

        const toggleContainer = cardsContainer.parentElement?.querySelector('.timeline-toggle');
        if (!toggleContainer) return; // Safety: Ensure toggle container exists before proceeding

        const btnStudent = toggleContainer.querySelector('[data-view="student"]');
        const btnCorrection = toggleContainer.querySelector('[data-view="correction"]');

        // L'ordre correct = les originalIndex en ordre croissant (0, 1, 2, 3, ...)
        const correctOrder = cartes.map((_, i) => i);

        const reorderCards = (targetOrder, activeBtn, inactiveBtn) => {
            activeBtn.classList.add('active');
            inactiveBtn.classList.remove('active');

            const cards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));
            // Créer un map originalIndex → élément DOM
            const cardsByOriginal = {};
            cards.forEach(c => { cardsByOriginal[parseInt(c.dataset.originalIndex)] = c; });

            // Ajouter la classe d'animation
            cardsContainer.classList.add('reordering');

            // Réordonner le DOM selon targetOrder
            targetOrder.forEach(origIdx => {
                const card = cardsByOriginal[origIdx];
                if (card) cardsContainer.appendChild(card);
            });

            // Mettre à jour les classes correct/incorrect
            const reorderedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));
            const isShowingCorrection = activeBtn === btnCorrection;

            reorderedCards.forEach((card, pos) => {
                const origIdx = parseInt(card.dataset.originalIndex);
                card.classList.remove('correct', 'incorrect');
                if (isShowingCorrection) {
                    // En mode correction, tout est dans le bon ordre
                    card.classList.add('correct');
                } else {
                    // En mode "Ma réponse", on remontre le résultat original
                    if (origIdx === pos) {
                        card.classList.add('correct');
                    } else {
                        card.classList.add('incorrect');
                    }
                }
            });

            // Retirer la classe après l'animation
            setTimeout(() => cardsContainer.classList.remove('reordering'), 450);
        };

        btnStudent.addEventListener('click', () => {
            if (btnStudent.classList.contains('active')) return;
            reorderCards(studentOrder, btnStudent, btnCorrection);
        });

        btnCorrection.addEventListener('click', () => {
            if (btnCorrection.classList.contains('active')) return;
            reorderCards(correctOrder, btnCorrection, btnStudent);
        });
    },

    /**
     * Render Texte à trous
     */
    renderTexteTrous(donnees, questions) {
        // Multi-question : carousel render-on-demand
        if (donnees.multiQuestions && donnees.multiQuestions.length > 1) {
            return this.renderMultiFormat('texte_trou', donnees, questions);
        }
        let texte = donnees.texte || '';
        const mots = donnees.mots || [];

        // Vérifier qu'on a du texte
        if (!texte) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de texte configuré.</p>
                    <small>L'enseignant doit ajouter un texte à trous dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Replace {...} patterns with input fields
        let inputIndex = 0;
        const processedTexte = texte.replace(/\{([^}]+)\}/g, (match, word) => {
            const idx = inputIndex++;
            this.storeAnswer(`trou_${idx}`, word, []);
            return `<input type="text" class="trou-input" id="trou_${idx}" placeholder="..." autocomplete="off">`;
        });

        return `
            <div class="texte-trous-container">
                ${mots.length > 0 ? `
                    <div class="mots-disponibles">
                        <span class="mots-label">Mots à placer :</span>
                        ${this.shuffleArray([...mots]).map(mot => `
                            <span class="mot-disponible" draggable="true" data-mot="${this.escapeHtml(mot)}">${this.escapeHtml(mot)}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="texte-avec-trous">
                    ${processedTexte}
                </div>
                <div class="chronologie-feedback hidden" id="feedback_texte_trous"></div>
            </div>
        `;
    },

    /**
     * Render Association (matching pairs)
     * Format: {consigne, paires: [{element1, element2}, ...]}
     */
    renderAssociation(donnees, questions) {
        // Multi-question : carousel render-on-demand
        if (donnees.multiQuestions && donnees.multiQuestions.length > 1) {
            return this.renderMultiFormat('association', donnees, questions);
        }
        const consigne = donnees.consigne || 'Associez les éléments correspondants';
        const paires = donnees.paires || [];

        if (paires.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de paires configurées.</p>
                    <small>L'enseignant doit ajouter des paires d'association dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Construire les éléments des deux côtés
        const elementsGauche = paires.map((p, i) => ({ texte: p.element1, type: p.element1_type || 'text', id: i }));
        const elementsDroite = paires.map((p, i) => ({ texte: p.element2, type: p.element2_type || 'text', id: i }));

        const gaucheHasImages = elementsGauche.some(el => el.type === 'image');
        const droiteHasImages = elementsDroite.some(el => el.type === 'image');

        // Déterminer le layout : quel groupe va en grille (haut), quel en chips (bas)
        let gridElements, chipElements, gridSide, chipSide;
        if (droiteHasImages && !gaucheHasImages) {
            // Cas classique : images à droite → grille images en haut, textes en chips en bas
            gridElements = this.shuffleArray([...elementsDroite]);
            chipElements = this.shuffleArray([...elementsGauche]);
            gridSide = 'droite';
            chipSide = 'gauche';
        } else if (gaucheHasImages && !droiteHasImages) {
            // Images à gauche → grille images en haut, textes en chips en bas
            gridElements = this.shuffleArray([...elementsGauche]);
            chipElements = this.shuffleArray([...elementsDroite]);
            gridSide = 'gauche';
            chipSide = 'droite';
        } else {
            // Texte↔texte ou image↔image : gauche en grille, droite en chips
            gridElements = this.shuffleArray([...elementsGauche]);
            chipElements = this.shuffleArray([...elementsDroite]);
            gridSide = 'gauche';
            chipSide = 'droite';
        }

        const gridHasImages = gridElements.some(el => el.type === 'image');
        const chipHasImages = chipElements.some(el => el.type === 'image');
        // Si les chips sont des textes longs (> 40 chars), les afficher en colonne
        const isDefinitions = !chipHasImages && chipElements.some(el => el.texte.length > 40);

        // Stocker le mapping pour la validation
        this._assocGridSide = gridSide;
        this._assocChipSide = chipSide;

        return `
            <div class="association-container">
                <p class="association-instruction">${this.escapeHtml(consigne)}</p>

                <!-- Grille (images ou termes courts) -->
                <div class="association-grid" id="associationGrid">
                    ${gridElements.map(el => `
                        <div class="association-grid-card ${!gridHasImages ? 'is-text' : ''}"
                             data-id="${el.id}" data-side="${gridSide}"
                             onclick="EleveConnaissances.selectAssociationItem(this, 'grid')">
                            ${el.type === 'image'
                                ? `<img class="assoc-card-img" src="${this.escapeHtml(this.normalizeImageUrl(el.texte))}" alt="">`
                                : `<span class="assoc-card-text">${this.escapeHtml(el.texte)}</span>`}
                            <span class="assoc-card-indicator"></span>
                            <span class="assoc-paired-label"></span>
                        </div>
                    `).join('')}
                </div>

                <div class="association-zone-label">Sélectionnez un élément ci-dessus puis son correspondant ci-dessous</div>

                <!-- Chips (noms / définitions) -->
                <div class="association-chips ${isDefinitions ? 'is-definitions' : ''}" id="associationChips">
                    ${chipElements.map(el => `
                        <div class="association-chip ${chipHasImages ? 'chip-image' : ''}"
                             data-id="${el.id}" data-side="${chipSide}"
                             onclick="EleveConnaissances.selectAssociationItem(this, 'chip')">
                            ${el.type === 'image'
                                ? `<img src="${this.escapeHtml(this.normalizeImageUrl(el.texte))}" alt="">`
                                : this.escapeHtml(el.texte)}
                        </div>
                    `).join('')}
                </div>

                <div class="association-feedback hidden" id="association_feedback"></div>
            </div>
        `;
    },

    // Couleurs pour les paires
    PAIR_COLORS: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#6366f1'],

    // Association selection state
    associationSelection: { grid: null, chip: null },
    associationPairs: [],
    associationPairCounter: 0,
    _assocGridSide: 'gauche',
    _assocChipSide: 'droite',

    selectAssociationItem(element, zone) {
        // zone = 'grid' ou 'chip'
        const id = element.dataset.id;

        // Si déjà pairé, défaire la paire
        if (element.classList.contains('paired')) {
            this.unpairAssociationItem(element, zone, id);
            return;
        }

        // Toggle selection dans cette zone
        if (this.associationSelection[zone] === id) {
            element.classList.remove('selected');
            this.associationSelection[zone] = null;
        } else {
            // Déselectionner la sélection précédente dans cette zone
            const container = zone === 'grid' ? '#associationGrid' : '#associationChips';
            document.querySelectorAll(`${container} .selected`).forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            this.associationSelection[zone] = id;
        }

        // Si les deux zones ont une sélection → créer la paire
        if (this.associationSelection.grid !== null && this.associationSelection.chip !== null) {
            // Utiliser le nombre de paires actuelles + 1 (pas un compteur global)
            const pairNum = this.associationPairs.length + 1;

            // Mapper vers gauche/droite pour la validation
            const gridId = this.associationSelection.grid;
            const chipId = this.associationSelection.chip;
            const pairData = {
                gauche: this._assocGridSide === 'gauche' ? gridId : chipId,
                droite: this._assocGridSide === 'droite' ? gridId : chipId,
                pairNum: pairNum
            };
            this.associationPairs.push(pairData);
            this.saveAnswer('association', this.associationPairs);

            // Trouver les éléments visuels
            const gridEl = document.querySelector(`#associationGrid .association-grid-card[data-id="${gridId}"]`);
            const chipEl = document.querySelector(`#associationChips .association-chip[data-id="${chipId}"]`);
            const colorIdx = (pairNum - 1) % this.PAIR_COLORS.length;
            const colorClass = `association-pair-color-${colorIdx + 1}`;

            // Marquer la carte grille
            if (gridEl) {
                gridEl.classList.remove('selected');
                gridEl.classList.add('paired', colorClass);
                gridEl.dataset.pairNum = pairNum;
                const indicator = gridEl.querySelector('.assoc-card-indicator');
                if (indicator) indicator.textContent = pairNum;
                // Coller le label du chip sous la carte
                const label = gridEl.querySelector('.assoc-paired-label');
                if (label && chipEl) {
                    label.textContent = chipEl.textContent.trim() || '🖼';
                }
            }

            // Marquer le chip
            if (chipEl) {
                chipEl.classList.remove('selected');
                chipEl.classList.add('paired', colorClass);
                chipEl.dataset.pairNum = pairNum;
            }

            this.associationSelection = { grid: null, chip: null };
        }
    },

    unpairAssociationItem(element, zone, id) {
        const pairNum = element.dataset.pairNum;
        if (!pairNum) return;

        const pairIndex = this.associationPairs.findIndex(p => String(p.pairNum) === String(pairNum));
        if (pairIndex > -1) {
            const pair = this.associationPairs[pairIndex];
            this.associationPairs.splice(pairIndex, 1);
            this.saveAnswer('association', this.associationPairs);

            // Retrouver les IDs grille/chip
            const gridId = this._assocGridSide === 'gauche' ? pair.gauche : pair.droite;
            const chipId = this._assocChipSide === 'gauche' ? pair.gauche : pair.droite;

            const gridEl = document.querySelector(`#associationGrid .association-grid-card[data-id="${gridId}"]`);
            const chipEl = document.querySelector(`#associationChips .association-chip[data-id="${chipId}"]`);

            [gridEl, chipEl].forEach(el => {
                if (el) {
                    for (let i = 1; i <= 8; i++) el.classList.remove(`association-pair-color-${i}`);
                    el.classList.remove('paired', 'selected');
                    delete el.dataset.pairNum;
                }
            });

            // Réinitialiser l'indicateur et le label de la carte
            if (gridEl) {
                const indicator = gridEl.querySelector('.assoc-card-indicator');
                if (indicator) indicator.textContent = '';
                const label = gridEl.querySelector('.assoc-paired-label');
                if (label) label.textContent = '';
            }
        }
    },

    /**
     * Render Carte cliquable (localisation sur image)
     * Nouvelle version: numéros sur la carte, popup pour répondre
     * Format: {consigne, image_url, marqueurs: [{id, x, y, reponse, reponses_acceptees?}, ...]}
     */
    renderCarte(donnees, questions) {
        // Multi-question : carousel render-on-demand
        if (donnees.multiQuestions && donnees.multiQuestions.length > 1) {
            return this.renderMultiFormat('carte', donnees, questions);
        }
        const consigne = donnees.consigne || 'Identifiez les éléments numérotés sur la carte';
        const imageUrl = donnees.image_url || '';
        const marqueurs = donnees.marqueurs || [];

        if (!imageUrl) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore d'image configurée.</p>
                    <small>L'enseignant doit ajouter une image dans le formulaire d'édition.</small>
                </div>
            `;
        }

        if (marqueurs.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de marqueurs configurés.</p>
                    <small>L'enseignant doit ajouter des points à localiser sur la carte.</small>
                </div>
            `;
        }

        // Stocker les données des marqueurs pour la validation
        this.carteMarqueurs = marqueurs;

        // Stocker les réponses correctes hors DOM
        marqueurs.forEach((m, idx) => {
            this.storeAnswer(`carte_marker_${idx}`, m.reponse, m.reponses_acceptees || []);
        });

        return `
            <div class="carte-container" id="carteContainer">
                <div class="carte-header">
                    <p class="carte-instruction">${this.escapeHtml(consigne)}</p>
                    <button class="carte-fullscreen-btn" onclick="EleveConnaissances.toggleCarteFullscreen()" title="Agrandir">
                        <span class="fullscreen-icon">⛶</span>
                    </button>
                </div>

                <!-- Image avec marqueurs numérotés -->
                <div class="carte-image-wrapper-v2">
                    <img src="${this.escapeHtml(imageUrl)}"
                         alt="Carte à compléter"
                         class="carte-image-v2">
                    <div class="carte-markers-layer-v2" id="carteMarkersLayer">
                        ${marqueurs.map((m, idx) => `
                            <div class="carte-marker-v2"
                                 data-index="${idx}"
                                 style="left: ${m.x}%; top: ${m.y}%;"
                                 onclick="EleveConnaissances.openCartePopup(${idx}, event)">
                                <span class="carte-marker-num-v2">${idx + 1}</span>
                                <span class="carte-marker-answer-label" id="carteMarkerLabel_${idx}"></span>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Popup pour répondre -->
                    <div class="carte-popup hidden" id="cartePopup">
                        <div class="carte-popup-content">
                            <div class="carte-popup-header">
                                <span class="carte-popup-title">Point n°<span id="cartePopupNum"></span></span>
                                <button class="carte-popup-close" onclick="EleveConnaissances.closeCartePopup()">×</button>
                            </div>
                            <div class="carte-popup-body">
                                <label>Qu'est-ce que c'est ?</label>
                                <input type="text"
                                       id="cartePopupInput"
                                       class="carte-popup-input"
                                       placeholder="Votre réponse..."
                                       autocomplete="off"
                                       onkeypress="if(event.key === 'Enter') EleveConnaissances.submitCarteAnswer()">
                            </div>
                            <div class="carte-popup-footer">
                                <button class="carte-popup-btn carte-popup-btn-cancel" onclick="EleveConnaissances.closeCartePopup()">Annuler</button>
                                <button class="carte-popup-btn carte-popup-btn-ok" onclick="EleveConnaissances.submitCarteAnswer()">Valider</button>
                            </div>
                        </div>
                    </div>
                </div>

                <p class="carte-help">Cliquez sur un numéro pour répondre. <span class="carte-help-hint">Utilisez ⛶ pour agrandir.</span></p>
                <div class="chronologie-feedback hidden" id="feedback_carte"></div>
            </div>
        `;
    },

    // État pour la carte v2
    carteMarqueurs: [],
    carteActiveIndex: null,

    openCartePopup(index, event) {
        // Bloquer l'ouverture si l'étape est déjà validée
        if (this.currentEtapeValidated) return;

        this.carteActiveIndex = index;
        const popup = document.getElementById('cartePopup');
        const numSpan = document.getElementById('cartePopupNum');
        const input = document.getElementById('cartePopupInput');

        numSpan.textContent = index + 1;

        // Pré-remplir si une réponse existe déjà
        const existingAnswer = this.userAnswers['carte_' + index];
        input.value = existingAnswer || '';

        popup.classList.remove('hidden');
        input.focus();

        // Marquer le marqueur comme actif
        document.querySelectorAll('.carte-marker-v2.active').forEach(el => el.classList.remove('active'));
        const marker = document.querySelector(`.carte-marker-v2[data-index="${index}"]`);
        if (marker) marker.classList.add('active');

        // Focus trap + Escape
        this._setupPopupFocusTrap(popup);
    },

    closeCartePopup() {
        const popup = document.getElementById('cartePopup');
        this._removePopupFocusTrap();
        popup.classList.add('hidden');
        this.carteActiveIndex = null;
        document.querySelectorAll('.carte-marker-v2.active').forEach(el => el.classList.remove('active'));
    },

    toggleCarteFullscreen() {
        const container = document.getElementById('carteContainer');
        if (!container) return;

        container.classList.toggle('fullscreen');
        const btn = container.querySelector('.carte-fullscreen-btn .fullscreen-icon');
        if (btn) {
            btn.textContent = container.classList.contains('fullscreen') ? '✕' : '⛶';
        }

        // Fermer avec Escape
        if (container.classList.contains('fullscreen')) {
            // Supprimer l'ancien listener s'il existe
            if (this._fullscreenEscapeHandler) {
                document.removeEventListener('keydown', this._fullscreenEscapeHandler);
            }
            this._fullscreenEscapeHandler = (e) => {
                if (e.key === 'Escape') {
                    container.classList.remove('fullscreen');
                    if (btn) btn.textContent = '⛶';
                    document.removeEventListener('keydown', this._fullscreenEscapeHandler);
                    this._fullscreenEscapeHandler = null;
                }
            };
            document.addEventListener('keydown', this._fullscreenEscapeHandler);
        } else if (this._fullscreenEscapeHandler) {
            document.removeEventListener('keydown', this._fullscreenEscapeHandler);
            this._fullscreenEscapeHandler = null;
        }
    },

    submitCarteAnswer() {
        if (this.carteActiveIndex === null) return;

        const input = document.getElementById('cartePopupInput');
        const answer = input.value.trim();
        const index = this.carteActiveIndex;

        if (answer) {
            // Sauvegarder la réponse
            this.userAnswers['carte_' + index] = answer;
            this.saveAnswer('carte', this.userAnswers);

            // Marquer le marqueur comme répondu et afficher la réponse sur la carte
            const marker = document.querySelector(`.carte-marker-v2[data-index="${index}"]`);
            if (marker) {
                marker.classList.add('answered');
                // Mettre à jour le label sur le marqueur
                const label = document.getElementById('carteMarkerLabel_' + index);
                if (label) {
                    label.textContent = answer;
                }
            }
        }

        this.closeCartePopup();
    },

    /**
     * Applique le mode correction sur les marqueurs carte après validation.
     * - Pastille vert/rouge pour feedback visuel immédiat
     * - Swap le onclick pour ouvrir le popup de correction au lieu du popup de saisie
     */
    applyCarteCorrectionMode(marker, idx, isCorrect, studentAnswer, correctAnswer) {
        if (!marker) return;

        // Stocker les données de correction dans le DOM
        marker.setAttribute('data-user-answer', studentAnswer || '');
        marker.setAttribute('data-correct-answer', correctAnswer);
        marker.setAttribute('data-is-correct', isCorrect ? 'true' : 'false');
        marker.setAttribute('data-correction-mode', 'true');

        // Garder le label visible avec le feedback coloré
        const label = marker.querySelector('.carte-marker-answer-label');
        if (label) {
            label.classList.remove('hidden');
            if (studentAnswer) {
                label.textContent = studentAnswer;
            } else {
                label.textContent = 'Non répondu';
            }
            label.classList.add(isCorrect ? 'label-correct' : 'label-incorrect');
        }

        // Remplacer le onclick par le popup de correction
        marker.setAttribute('onclick', `EleveConnaissances.openCarteCorrectionPopup(${idx})`);
    },

    /**
     * Ouvre un popup de correction (lecture seule) pour un marqueur carte.
     * Affiche la réponse de l'élève et la bonne réponse.
     */
    openCarteCorrectionPopup(index) {
        const marker = document.querySelector(`.carte-marker-v2[data-index="${index}"]`);
        if (!marker) return;

        const userAnswer = marker.getAttribute('data-user-answer') || '';
        const correctAnswer = marker.getAttribute('data-correct-answer') || '';
        const isCorrect = marker.getAttribute('data-is-correct') === 'true';
        const hasAnswer = userAnswer.trim() !== '';

        // Construire le contenu du popup selon le résultat (feedback minimaliste)
        let bodyHTML = '';
        if (isCorrect) {
            bodyHTML = `
                <div class="carte-correction-box correct">
                    <span class="carte-correction-text">${this.escapeHtml(userAnswer)}</span>
                    <span class="carte-correction-icon">✓</span>
                </div>
            `;
        } else {
            bodyHTML = `
                <div class="carte-correction-box incorrect">
                    <span class="carte-correction-text">${hasAnswer ? this.escapeHtml(userAnswer) : 'Non répondu'}</span>
                    <span class="carte-correction-icon">✗</span>
                </div>
            `;
        }

        // Réutiliser le popup existant en mode correction
        const popup = document.getElementById('cartePopup');
        if (!popup) return;

        const numSpan = document.getElementById('cartePopupNum');
        if (numSpan) numSpan.textContent = index + 1;

        const body = popup.querySelector('.carte-popup-body');
        if (body) body.innerHTML = bodyHTML;

        const footer = popup.querySelector('.carte-popup-footer');
        if (footer) footer.classList.add('hidden');

        popup.classList.remove('hidden');
    },

    /**
     * Render Flashcard
     * Format: {consigne, cartes: [{recto, verso}]}
     * Auto-évaluation: l'élève voit le recto, retourne la carte, puis dit s'il savait ou non
     */
    renderFlashcard(donnees, questions) {
        const consigne = donnees.consigne || '';
        const cartes = donnees.cartes || [];

        if (cartes.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Aucune carte configurée pour cet exercice.</p>
                    <small>L'enseignant doit ajouter des cartes dans le formulaire d'édition.</small>
                </div>
            `;
        }

        // Initialiser l'état flashcard
        this.flashcardState = {
            currentIndex: 0,
            total: cartes.length,
            cartes: cartes,
            results: [], // {recto, verso, savait: true/false}
            flipped: false,
            done: false
        };

        return `
            <div class="flashcard-container">
                ${consigne ? `<div class="flashcard-consigne">${this.escapeHtml(consigne)}</div>` : ''}
                <div class="flashcard-progress">
                    <span id="flashcardCounter">Carte 1 / ${cartes.length}</span>
                    <div class="flashcard-progress-bar">
                        <div class="flashcard-progress-fill" id="flashcardProgressFill" style="width: ${100 / cartes.length}%"></div>
                    </div>
                </div>
                <div class="flashcard-scene" id="flashcardScene">
                    <div class="flashcard-card" id="flashcardCard" onclick="EleveConnaissances.flipFlashcard()">
                        <div class="flashcard-face flashcard-front">
                            <div class="flashcard-face-label">Recto</div>
                            <div class="flashcard-face-content" id="flashcardFront">${this.escapeHtml(cartes[0].recto)}</div>
                            <div class="flashcard-flip-hint" id="flashcardFlipHint">Cliquez pour retourner</div>
                        </div>
                        <div class="flashcard-face flashcard-back">
                            <div class="flashcard-face-label">Verso</div>
                            <div class="flashcard-face-content" id="flashcardBack">${this.escapeHtml(cartes[0].verso)}</div>
                        </div>
                    </div>
                </div>
                <div class="flashcard-actions hidden" id="flashcardActions">
                    <button class="btn flashcard-btn-fail" onclick="EleveConnaissances.evaluateFlashcard(false)">
                        ✗ Je ne savais pas
                    </button>
                    <button class="btn flashcard-btn-success" onclick="EleveConnaissances.evaluateFlashcard(true)">
                        ✓ Je savais
                    </button>
                </div>
                <div class="flashcard-summary hidden" id="flashcardSummary"></div>
            </div>
        `;
    },

    /**
     * Retourne la flashcard courante
     */
    flipFlashcard() {
        if (!this.flashcardState || this.flashcardState.done) return;
        const card = document.getElementById('flashcardCard');
        const actions = document.getElementById('flashcardActions');
        const hint = document.getElementById('flashcardFlipHint');
        if (!card) return;

        this.flashcardState.flipped = !this.flashcardState.flipped;
        card.classList.toggle('flipped', this.flashcardState.flipped);

        if (this.flashcardState.flipped) {
            // Montrer les boutons d'auto-évaluation
            if (actions) actions.classList.remove('hidden');
            if (hint) hint.classList.add('hidden');
        } else {
            if (actions) actions.classList.add('hidden');
            if (hint) hint.classList.remove('hidden');
        }
    },

    /**
     * L'élève évalue s'il savait ou non la réponse
     */
    evaluateFlashcard(savait) {
        if (!this.flashcardState || this.flashcardState.done) return;

        const state = this.flashcardState;
        const carte = state.cartes[state.currentIndex];

        // Enregistrer le résultat
        state.results.push({
            recto: carte.recto,
            verso: carte.verso,
            savait: savait
        });

        // Sauvegarder dans userAnswers pour la validation
        this.userAnswers['flashcard'] = state.results;

        state.currentIndex++;

        if (state.currentIndex >= state.total) {
            // Toutes les cartes ont été vues
            state.done = true;
            this.showFlashcardSummary();
        } else {
            // Passer à la carte suivante
            this.showNextFlashcard();
        }
    },

    /**
     * Affiche la carte suivante
     */
    showNextFlashcard() {
        const state = this.flashcardState;
        const carte = state.cartes[state.currentIndex];

        const card = document.getElementById('flashcardCard');
        const front = document.getElementById('flashcardFront');
        const back = document.getElementById('flashcardBack');
        const actions = document.getElementById('flashcardActions');
        const hint = document.getElementById('flashcardFlipHint');
        const counter = document.getElementById('flashcardCounter');
        const progressFill = document.getElementById('flashcardProgressFill');

        if (card) {
            card.classList.remove('flipped');
            state.flipped = false;
        }
        if (front) front.textContent = carte.recto;
        if (back) back.textContent = carte.verso;
        if (actions) actions.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
        if (counter) counter.textContent = `Carte ${state.currentIndex + 1} / ${state.total}`;
        if (progressFill) progressFill.style.width = `${((state.currentIndex + 1) / state.total) * 100}%`;
        // Mettre à jour le compteur dans le header
        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Carte ${state.currentIndex + 1} / ${state.total}`;
    },

    /**
     * Termine les flashcards et passe directement à la validation de l'étape
     * (pas de résumé intermédiaire, l'élève a déjà vu les réponses au verso)
     */
    showFlashcardSummary() {
        const state = this.flashcardState;
        const scene = document.getElementById('flashcardScene');
        const actions = document.getElementById('flashcardActions');
        const counter = document.getElementById('flashcardCounter');
        const progressFill = document.getElementById('flashcardProgressFill');

        if (scene) scene.classList.add('hidden');
        if (actions) actions.classList.add('hidden');

        const nbSavait = state.results.filter(r => r.savait).length;
        if (counter) counter.textContent = `Terminé : ${nbSavait} / ${state.total} cartes réussies`;
        if (progressFill) progressFill.style.width = '100%';

        // Masquer le résumé détaillé (doublon avec le bilan final)
        const summary = document.getElementById('flashcardSummary');
        if (summary) summary.classList.add('hidden');

        // Valider directement l'étape → affiche le bandeau vert
        this.validateCurrentEtape();
    },

    /**
     * Render Question ouverte
     * Format: {question, reponses_acceptees: [...], feedback_correct?, feedback_incorrect?}
     */
    renderQuestionOuverte(donnees, questions) {
        // Format multi-questions
        if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
            const totalQo = donnees.multiQuestions.length;
            if (totalQo > 1) {
                this._qoNavIndex = 0;
                this._qoResults = {};
            }
            return `
                <div class="qo-multi-container" ${totalQo > 1 ? `data-total-qo="${totalQo}"` : ''}>
                    ${donnees.multiQuestions.map((q, qIdx) => `
                        <div class="question-ouverte-container${totalQo > 1 && qIdx > 0 ? ' hidden' : ''}" data-qo-index="${qIdx}">
                            <div class="question-ouverte-enonce">${this.escapeHtml(q.question)}</div>
                            <div class="question-ouverte-input-wrapper">
                                <input type="text"
                                       class="question-ouverte-input"
                                       id="questionOuverteReponse_${qIdx}"
                                       placeholder="Tapez votre réponse..."
                                       autocomplete="off"
                                       oninput="EleveConnaissances.saveAnswer('question_ouverte_${qIdx}', this.value)">
                            </div>
                            <div class="question-ouverte-feedback hidden" id="feedback_question_ouverte_${qIdx}"></div>
                        </div>
                        ${totalQo > 1 ? `
                            <div class="qo-question-action${qIdx > 0 ? ' hidden' : ''}" id="qo_action_${qIdx}" data-for-qo="${qIdx}">
                                <button class="btn-qcm-validate" onclick="EleveConnaissances.validateQoQuestion(${qIdx})">Valider</button>
                            </div>
                        ` : ''}
                    `).join('')}
                </div>
            `;
        }

        // Format simple (une seule question)
        const question = donnees.question || donnees.enonce || '';
        const reponsesAcceptees = donnees.reponses_acceptees || [];

        if (!question) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de question configurée.</p>
                    <small>L'enseignant doit ajouter une question dans le formulaire d'édition.</small>
                </div>
            `;
        }

        if (reponsesAcceptees.length === 0) {
            return `
                <div class="format-no-data">
                    <p>⚠️ Cet exercice n'a pas encore de réponses acceptées configurées.</p>
                    <small>L'enseignant doit ajouter au moins une réponse acceptée.</small>
                </div>
            `;
        }

        return `
            <div class="question-ouverte-container">
                <div class="question-ouverte-enonce">${this.escapeHtml(question)}</div>
                <div class="question-ouverte-input-wrapper">
                    <input type="text"
                           class="question-ouverte-input"
                           id="questionOuverteReponse"
                           placeholder="Tapez votre réponse..."
                           autocomplete="off"
                           oninput="EleveConnaissances.saveAnswer('question_ouverte', this.value)">
                </div>
                <div class="question-ouverte-feedback hidden" id="feedback_question_ouverte"></div>
            </div>
        `;
    },

    /**
     * Save an answer
     */
    saveAnswer(key, value) {
        this.userAnswers[key] = value;
    },

    extractFeedbackText(format, isCorrect, questionData, userAnswer, result = null) {
        switch (format) {
            case 'qcm':
                if (isCorrect && questionData.feedback_correct) return questionData.feedback_correct;
                if (!isCorrect && questionData.feedback_incorrect) return questionData.feedback_incorrect;
                return isCorrect ? 'Correct !' : 'Mauvaise réponse';

            case 'vf':
                if (isCorrect && questionData.feedback_vrai) return questionData.feedback_vrai;
                if (!isCorrect && questionData.feedback_faux) return questionData.feedback_faux;
                return isCorrect ? 'Correct !' : 'Mauvaise réponse';

            case 'question_ouverte':
                if (isCorrect) {
                    if (questionData.feedback_correct) return questionData.feedback_correct;
                    return 'Correct !';
                } else {
                    if (questionData.feedback_incorrect) return questionData.feedback_incorrect;
                    if (!userAnswer || (typeof userAnswer === 'string' && userAnswer.trim() === '')) return 'Non répondu';
                    return 'Mauvaise réponse';
                }

            case 'multi_format':
                // Pour les formats multiples (texte, association, chrono, carte)
                return isCorrect ? 'Correct !' : 'Réponse incorrecte';

            default:
                return isCorrect ? 'Correct !' : 'Incorrect';
        }
    },

    /**
     * Affiche le feedback unifié pour une question
     * Format: [Feedback pédagogique] + [X/Y points]
     */
    displayUnifiedFeedback(feedbackElementId, isCorrect, feedbackText, score, maxScore, format = null) {
        const feedbackEl = document.getElementById(feedbackElementId);
        if (!feedbackEl) return;

        feedbackEl.classList.remove('hidden');

        // Adapter la classe CSS selon le format
        let feedbackClass = 'question-feedback';
        if (format === 'qcm' || feedbackElementId.includes('qcm')) {
            feedbackClass = 'qcm-feedback';
        } else if (format === 'vf' || feedbackElementId.includes('vf')) {
            feedbackClass = 'vf-feedback';
        } else if (format === 'association' || feedbackElementId.includes('association')) {
            feedbackClass = 'association-feedback';
        } else if (format === 'chronologie' || format === 'timeline' || feedbackElementId.includes('timeline')) {
            feedbackClass = 'chronologie-feedback';
        }
        feedbackEl.className = `${feedbackClass} ${isCorrect ? 'correct' : 'incorrect'}`;

        // Format: HTML structuré (deux lignes épuré avec gradient)
        const isUnanswered = feedbackText === 'Non répondu';
        const icon = isCorrect ? '✓' : (isUnanswered ? '⚠' : '✗');
        const scoreDisplay = `${score}/${maxScore} point${maxScore > 1 ? 's' : ''}`;
        const messageText = feedbackText || (isCorrect ? 'Correct!' : 'Incorrect');

        // HTML structuré (plus professionnel que du texte brut)
        feedbackEl.innerHTML = `
            <div class="feedback-header">
                <span class="feedback-icon">${icon}</span>
                <span class="feedback-message">${this.escapeHtml(messageText)}</span>
            </div>
            <div class="feedback-score-line">
                <span class="score-label">Score:</span>
                <span class="score-value">${scoreDisplay}</span>
            </div>
        `;
    },


});
