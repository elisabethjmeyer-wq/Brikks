/**
 * eleve-connaissances-formats.js
 * Format renderers, interactions, validation, and multi-format carousel
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
                        texte: qc.donnees.question || qc.donnees.enonce || `Question ${idx + 1}`,
                        reponse: qc.donnees.reponse,
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
                        question: qc.donnees.question || qc.donnees.enonce || `Question ${idx + 1}`,
                        choix: qc.donnees.choix || qc.donnees.options || [],
                        reponse: qc.donnees.reponse || qc.donnees.reponse_correcte,
                        reponses_correctes: qc.donnees.reponses_correctes,
                        multiple: qc.donnees.multiple || false,
                        feedbacks_options: qc.donnees.feedbacks_options,
                        feedback_correct: qc.donnees.feedback_correct,
                        feedback_incorrect: qc.donnees.feedback_incorrect
                    }))
                };

            case 'chronologie':
            case 'timeline':
                // Chaque question chrono/timeline séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        ...qc.donnees
                    }))
                };

            case 'association':
                // Chaque question association séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        consigne: qc.donnees.consigne,
                        paires: qc.donnees.paires || []
                    }))
                };

            case 'texte_trou':
            case 'texte_trous':
                // Chaque texte à trous séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        texte: qc.donnees.texte || qc.donnees.question || '',
                        mots: qc.donnees.mots || [],
                        trous: qc.donnees.trous || []
                    }))
                };

            case 'carte':
                // Chaque image cliquable séparément
                return {
                    multiQuestions: questionContents.map(qc => ({
                        id: qc.id,
                        consigne: qc.donnees.consigne,
                        image_url: qc.donnees.image_url,
                        marqueurs: qc.donnees.marqueurs || []
                    }))
                };

            case 'question_ouverte':
                return {
                    multiQuestions: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        question: qc.donnees.question || qc.donnees.enonce || `Question ${idx + 1}`,
                        reponses_acceptees: qc.donnees.reponses_acceptees || [],
                        comparaison_stricte: qc.donnees.comparaison_stricte || false,
                        feedback_correct: qc.donnees.feedback_correct,
                        feedback_incorrect: qc.donnees.feedback_incorrect
                    }))
                };

            case 'flashcard':
                // Combiner toutes les cartes
                const allCartes = [];
                questionContents.forEach(qc => {
                    if (qc.donnees.cartes) allCartes.push(...qc.donnees.cartes);
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
                            <div class="vf-feedback" id="feedback_vf_0" style="display: none;"></div>
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
                        <div class="vrai-faux-item" data-index="${idx}" ${totalVf > 1 && idx > 0 ? 'style="display:none;"' : ''}>
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
                            <div class="vf-feedback" id="feedback_vf_${idx}" style="display: none;"></div>
                        </div>
                        ${totalVf > 1 ? `
                            <div class="vf-question-action" id="vf_action_${idx}" data-for-vf="${idx}" ${idx > 0 ? 'style="display:none;"' : ''}>
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
                            return `<div class="qcm-question-block" data-question="${qIdx}" ${qIdx > 0 ? 'style="display:none;"' : ''}>
                                <div class="format-no-data">Question ${qIdx + 1}: Pas de choix configurés</div>
                            </div>`;
                        }

                        // Mélanger les choix
                        const indexedChoices = choices.map((choice, idx) => ({ choice, originalIdx: idx }));
                        const shuffledChoices = this.shuffleArray([...indexedChoices]);

                        return `
                            <div class="qcm-question-block" data-question="${qIdx}" ${qIdx > 0 ? 'style="display:none;"' : ''}>
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
                                <div class="qcm-feedback" id="feedback_qcm_${qIdx}" style="display: none;"></div>
                            </div>
                            ${totalQ > 1 ? `
                                <div class="qcm-question-action" id="qcm_action_${qIdx}" data-for-qcm="${qIdx}" ${qIdx > 0 ? 'style="display:none;"' : ''}>
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
                <div class="qcm-feedback" id="feedback_qcm" style="display: none;"></div>
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
            return this.renderMultiFormat('chronologie', donnees, questions);
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
        const sortedEvents = [...events].sort((a, b) => {
            const dateA = parseInt(String(a.date).replace(/\D/g, '')) || 0;
            const dateB = parseInt(String(b.date).replace(/\D/g, '')) || 0;
            return dateA - dateB;
        });

        // Instruction par défaut selon le mode
        let defaultInstruction = '';
        if (mode === 'date') {
            defaultInstruction = 'Complétez les dates manquantes sur la frise chronologique';
        } else {
            defaultInstruction = 'Complétez les événements manquants sur la frise chronologique';
        }

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
                                                   data-correct="${this.escapeHtml(evt.evenement)}"
                                                   data-acceptees="${this.escapeHtml(JSON.stringify(evt.reponses_acceptees || []))}"
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
                                                   data-correct="${this.escapeHtml(String(evt.date))}"
                                                   data-acceptees="${this.escapeHtml(JSON.stringify(evt.reponses_acceptees || []))}"
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
                <div class="chronologie-feedback" id="feedback_timeline" style="display: none;"></div>
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
            return `<input type="text" class="trou-input" id="trou_${idx}" data-answer="${this.escapeHtml(word)}" placeholder="..." autocomplete="off">`;
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
                <div class="chronologie-feedback" id="feedback_texte_trous" style="display: none;"></div>
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

                <div class="association-feedback" id="association_feedback" style="display: none;"></div>
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
                                 data-reponse="${this.escapeHtml(m.reponse)}"
                                 data-acceptees="${this.escapeHtml(JSON.stringify(m.reponses_acceptees || []))}"
                                 style="left: ${m.x}%; top: ${m.y}%;"
                                 onclick="EleveConnaissances.openCartePopup(${idx}, event)">
                                <span class="carte-marker-num-v2">${idx + 1}</span>
                                <span class="carte-marker-answer-label" id="carteMarkerLabel_${idx}"></span>
                            </div>
                        `).join('')}
                    </div>
                    <!-- Popup pour répondre -->
                    <div class="carte-popup" id="cartePopup" style="display: none;">
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
                <div class="chronologie-feedback" id="feedback_carte" style="display: none;"></div>
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

        popup.style.display = 'flex';
        input.focus();

        // Marquer le marqueur comme actif
        document.querySelectorAll('.carte-marker-v2.active').forEach(el => el.classList.remove('active'));
        const marker = document.querySelector(`.carte-marker-v2[data-index="${index}"]`);
        if (marker) marker.classList.add('active');
    },

    closeCartePopup() {
        const popup = document.getElementById('cartePopup');
        popup.style.display = 'none';
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

        // Masquer le badge texte pour éviter les chevauchements — le détail est dans le popup
        const label = marker.querySelector('.carte-marker-answer-label');
        if (label) {
            label.style.display = 'none';
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
        if (footer) footer.style.display = 'none';

        popup.style.display = 'flex';
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
                <div class="flashcard-actions" id="flashcardActions" style="display: none;">
                    <button class="btn flashcard-btn-fail" onclick="EleveConnaissances.evaluateFlashcard(false)">
                        ✗ Je ne savais pas
                    </button>
                    <button class="btn flashcard-btn-success" onclick="EleveConnaissances.evaluateFlashcard(true)">
                        ✓ Je savais
                    </button>
                </div>
                <div class="flashcard-summary" id="flashcardSummary" style="display: none;"></div>
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
            if (actions) actions.style.display = 'flex';
            if (hint) hint.style.display = 'none';
        } else {
            if (actions) actions.style.display = 'none';
            if (hint) hint.style.display = '';
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
        if (actions) actions.style.display = 'none';
        if (hint) hint.style.display = '';
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

        if (scene) scene.style.display = 'none';
        if (actions) actions.style.display = 'none';

        const nbSavait = state.results.filter(r => r.savait).length;
        if (counter) counter.textContent = `Terminé : ${nbSavait} / ${state.total} cartes réussies`;
        if (progressFill) progressFill.style.width = '100%';

        // Masquer le résumé détaillé (doublon avec le bilan final)
        const summary = document.getElementById('flashcardSummary');
        if (summary) summary.style.display = 'none';

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
                        <div class="question-ouverte-container" data-qo-index="${qIdx}" ${totalQo > 1 && qIdx > 0 ? 'style="display:none;"' : ''}>
                            <div class="question-ouverte-enonce">${this.escapeHtml(q.question)}</div>
                            <div class="question-ouverte-input-wrapper">
                                <input type="text"
                                       class="question-ouverte-input"
                                       id="questionOuverteReponse_${qIdx}"
                                       placeholder="Tapez votre réponse..."
                                       autocomplete="off"
                                       oninput="EleveConnaissances.saveAnswer('question_ouverte_${qIdx}', this.value)">
                            </div>
                            <div class="question-ouverte-feedback" id="feedback_question_ouverte_${qIdx}" style="display: none;"></div>
                        </div>
                        ${totalQo > 1 ? `
                            <div class="qo-question-action" id="qo_action_${qIdx}" data-for-qo="${qIdx}" ${qIdx > 0 ? 'style="display:none;"' : ''}>
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
                <div class="question-ouverte-feedback" id="feedback_question_ouverte" style="display: none;"></div>
            </div>
        `;
    },

    /**
     * Save an answer
     */
    saveAnswer(key, value) {
        this.userAnswers[key] = value;
    },

    displayGlobalFeedback(correct, total) {
        const content = document.getElementById('exerciseContent');
        if (!content) return;

        // Chercher ou créer le conteneur de feedback global
        let globalFeedback = content.querySelector('.etape-global-feedback');
        if (!globalFeedback) {
            globalFeedback = document.createElement('div');
            globalFeedback.className = 'etape-global-feedback';
            // Insérer EN HAUT du contenu
            content.insertBefore(globalFeedback, content.firstChild);
        }

        // Afficher le feedback unifié
        const isCorrect = correct === total && total > 0;
        const feedbackText = isCorrect ? 'Correct !' : 'Réponse incorrecte';

        globalFeedback.id = 'etapeGlobalFeedback';
        globalFeedback.style.display = 'block';

        this.displayUnifiedFeedback(
            'etapeGlobalFeedback',
            isCorrect,
            feedbackText,
            correct,
            total,
            'question-feedback'
        );
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
                if (isCorrect && questionData.feedback_correct) return questionData.feedback_correct;
                if (!isCorrect) {
                    const correctAnswer = (questionData.reponses_acceptees && questionData.reponses_acceptees[0]) || '';
                    let text = `La bonne réponse était: ${correctAnswer}`;
                    if (questionData.feedback_incorrect) text += ` ${questionData.feedback_incorrect}`;
                    return text;
                }
                return isCorrect ? 'Correct !' : 'Mauvaise réponse';

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

        feedbackEl.style.display = 'block';

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

        // Format: HTML structuré (Option B - Deux lignes épuré avec gradient)
        const icon = isCorrect ? '✓' : '✗';
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

    /**
     * Affiche visuellement la correction de l'association avec deux sections :
     * "Ta réponse :" (les paires élève avec statut vert/rouge)
     * "Réponse correcte :" (les bonnes paires)
     */
    displayAssociationCorrectionVisual(donnees, userPairs, details, assocPaires) {
        const feedbackContainer = document.getElementById('association_feedback');
        if (!feedbackContainer) return;

        // Construire les éléments des deux côtés (ordre ORIGINAL, pas mélangés)
        const elementsGauche = assocPaires.map((p, i) => ({
            texte: p.element1,
            type: p.element1_type || 'text',
            id: i
        }));
        const elementsDroite = assocPaires.map((p, i) => ({
            texte: p.element2,
            type: p.element2_type || 'text',
            id: i
        }));

        const gaucheHasImages = elementsGauche.some(el => el.type === 'image');
        const droiteHasImages = elementsDroite.some(el => el.type === 'image');

        // Déterminer le layout pour l'affichage visuel (images vs texte)
        let displayElements, labelElements, hasImages;
        if (droiteHasImages && !gaucheHasImages) {
            displayElements = elementsDroite;
            labelElements = elementsGauche;
            hasImages = true;
        } else if (gaucheHasImages && !droiteHasImages) {
            displayElements = elementsGauche;
            labelElements = elementsDroite;
            hasImages = true;
        } else {
            displayElements = elementsGauche;
            labelElements = elementsDroite;
            hasImages = gaucheHasImages || droiteHasImages;
        }

        // ===== SECTION 1: TA RÉPONSE =====
        let studentHtml = '<p class="correction-assoc-hint correction-assoc-hint--student">Ta réponse :</p>';
        studentHtml += '<div class="correction-assoc-grid">';

        // Afficher les réponses de l'élève
        userPairs.forEach((pair) => {
            const leftIdx = parseInt(pair.gauche);
            const rightIdx = parseInt(pair.droite);
            const isCorrect = String(pair.gauche) === String(pair.droite);
            const statusClass = isCorrect ? 'card-correct' : 'card-incorrect';

            const leftEl = elementsGauche[leftIdx];
            const rightEl = elementsDroite[rightIdx];

            if (leftEl && rightEl) {
                // Afficher la paire complète : gauche → droite (ce que l'élève a choisi)
                const leftHasImage = leftEl.type === 'image';
                const rightHasImage = rightEl.type === 'image';
                const leftUrl = leftHasImage ? this.normalizeImageUrl(leftEl.texte) : null;
                const rightUrl = rightHasImage ? this.normalizeImageUrl(rightEl.texte) : null;

                if (leftHasImage && rightHasImage) {
                    // Deux images
                    studentHtml += `
                        <div class="correction-assoc-pair-flex ${statusClass}">
                            <div class="correction-assoc-card has-image" style="background-image: url('${this.escapeHtml(leftUrl)}');"></div>
                            <span class="assoc-pair-arrow">→</span>
                            <div class="correction-assoc-card has-image" style="background-image: url('${this.escapeHtml(rightUrl)}');"></div>
                            <span class="assoc-pair-status">${isCorrect ? '✓' : '✗'}</span>
                        </div>
                    `;
                } else if (leftHasImage) {
                    // Image à gauche, texte à droite
                    studentHtml += `
                        <div class="correction-assoc-pair-flex ${statusClass}">
                            <div class="correction-assoc-card has-image" style="background-image: url('${this.escapeHtml(leftUrl)}');"></div>
                            <span class="assoc-pair-arrow">→</span>
                            <div class="correction-assoc-card text-only">
                                <span class="correction-assoc-text">${this.escapeHtml(rightEl.texte)}</span>
                            </div>
                            <span class="assoc-pair-status">${isCorrect ? '✓' : '✗'}</span>
                        </div>
                    `;
                } else if (rightHasImage) {
                    // Texte à gauche, image à droite
                    studentHtml += `
                        <div class="correction-assoc-pair-flex ${statusClass}">
                            <div class="correction-assoc-card text-only">
                                <span class="correction-assoc-text">${this.escapeHtml(leftEl.texte)}</span>
                            </div>
                            <span class="assoc-pair-arrow">→</span>
                            <div class="correction-assoc-card has-image" style="background-image: url('${this.escapeHtml(rightUrl)}');"></div>
                            <span class="assoc-pair-status">${isCorrect ? '✓' : '✗'}</span>
                        </div>
                    `;
                } else {
                    // Deux textes
                    studentHtml += `
                        <div class="correction-assoc-pair-flex ${statusClass}">
                            <div class="correction-assoc-card text-only">
                                <span class="correction-assoc-text">${this.escapeHtml(leftEl.texte)}</span>
                            </div>
                            <span class="assoc-pair-arrow">→</span>
                            <div class="correction-assoc-card text-only">
                                <span class="correction-assoc-text">${this.escapeHtml(rightEl.texte)}</span>
                            </div>
                            <span class="assoc-pair-status">${isCorrect ? '✓' : '✗'}</span>
                        </div>
                    `;
                }
            }
        });

        // Afficher les éléments non appariés comme erreurs
        for (let i = 0; i < assocPaires.length; i++) {
            const isPaired = userPairs.some(pair => String(pair.gauche) === String(i));

            if (!isPaired) {
                const displayEl = displayElements[i];
                const labelEl = labelElements[i];

                if (displayEl && labelEl) {
                    if (hasImages && displayEl.type === 'image') {
                        const imageUrl = this.normalizeImageUrl(displayEl.texte);
                        const imgStyle = imageUrl ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                        studentHtml += `
                            <div class="correction-assoc-pair card-incorrect">
                                <div class="correction-assoc-card has-image unpaired" ${imgStyle}>
                                    <span class="correction-assoc-label">Non appairé</span>
                                </div>
                                <span class="assoc-pair-status">✗</span>
                            </div>
                        `;
                    } else {
                        studentHtml += `
                            <div class="correction-assoc-pair card-incorrect">
                                <div class="correction-assoc-card text-only unpaired">
                                    <span class="correction-assoc-text">${this.escapeHtml(displayEl.texte)}</span>
                                    <span class="correction-assoc-label">Non appairé</span>
                                </div>
                                <span class="assoc-pair-status">✗</span>
                            </div>
                        `;
                    }
                }
            }
        }

        studentHtml += '</div>';

        // ===== SECTION 2: RÉPONSE CORRECTE =====
        let correctHtml = '<p class="correction-assoc-hint correction-assoc-hint--correct">Réponse correcte :</p>';
        correctHtml += '<div class="correction-assoc-grid">';

        // Afficher toutes les bonnes paires
        assocPaires.forEach((paire, pIdx) => {
            const displayEl = displayElements[pIdx];
            const labelEl = labelElements[pIdx];

            if (displayEl && labelEl) {
                if (hasImages && displayEl.type === 'image') {
                    const imageUrl = this.normalizeImageUrl(displayEl.texte);
                    const imgStyle = imageUrl ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                    correctHtml += `
                        <div class="correction-assoc-pair card-correct">
                            <div class="correction-assoc-card has-image" ${imgStyle}>
                                <span class="correction-assoc-label">${this.escapeHtml(labelEl.texte)}</span>
                            </div>
                        </div>
                    `;
                } else {
                    correctHtml += `
                        <div class="correction-assoc-pair card-correct">
                            <div class="correction-assoc-card text-only">
                                <span class="correction-assoc-text">${this.escapeHtml(displayEl.texte)}</span>
                                <span class="correction-assoc-label">${this.escapeHtml(labelEl.texte)}</span>
                            </div>
                        </div>
                    `;
                }
            }
        });

        correctHtml += '</div>';

        // Afficher le tout
        feedbackContainer.innerHTML = studentHtml + correctHtml;
        feedbackContainer.style.display = 'block';
    },

    validateCurrentEtape() {
        if (this.currentEtapeValidated) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        // Utiliser les données combinées stockées lors du rendu (inclut multiQuestions)
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);

        let correct = 0;
        let total = 0;
        let details = [];

        switch (currentEtape.format_code) {
            case 'vrai_faux':
                if (donnees.reponse !== undefined && !donnees.propositions) {
                    total = 1;
                    const answer = this.userAnswers['vf_0'];
                    const expected = donnees.reponse === true || donnees.reponse === 'vrai' ? 'vrai' : 'faux';
                    const isCorrect = answer === expected;
                    if (isCorrect) correct++;

                    // Construire le texte du feedback (minimaliste - sans explication)
                    let feedbackText = isCorrect ? 'Correct' : 'Mauvaise réponse';

                    // Utiliser la fonction unifiée de feedback
                    this.displayUnifiedFeedback('feedback_vf_0', isCorrect, feedbackText, isCorrect ? 1 : 0, 1);
                    details.push({ question: donnees.question, reponse: answer, attendu: expected, correct: isCorrect });
                } else {
                    const propositions = donnees.propositions || [];
                    // Si validation question par question (carrousel), récupérer les résultats déjà stockés
                    if (this._vfResults && Object.keys(this._vfResults).length > 0) {
                        propositions.forEach((prop, idx) => {
                            total++;
                            const r = this._vfResults[idx];
                            if (r) {
                                if (r.correct) correct++;
                                details.push(r);
                            } else {
                                const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                                details.push({ question: prop.texte, reponse: null, attendu: expected, correct: false });
                            }
                        });
                    } else {
                        propositions.forEach((prop, idx) => {
                            total++;
                            const answer = this.userAnswers[`vf_${idx}`];
                            const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                            const isCorrect = answer === expected;
                            if (isCorrect) correct++;

                            // Construire le texte du feedback (minimaliste - sans explication)
                            let feedbackText = isCorrect ? 'Correct' : 'Mauvaise réponse';

                            // Utiliser la fonction unifiée de feedback
                            this.displayUnifiedFeedback(`feedback_vf_${idx}`, isCorrect, feedbackText, isCorrect ? 1 : 0, 1);
                            details.push({ question: prop.texte, reponse: answer, attendu: expected, correct: isCorrect });
                        });
                    }
                }
                break;

            case 'qcm':
                // Mode multi-questions (plusieurs QCM dans une étape)
                if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
                    // Si validation question par question (carrousel), récupérer les résultats déjà stockés
                    if (this._qcmResults && Object.keys(this._qcmResults).length > 0) {
                        donnees.multiQuestions.forEach((q, qIdx) => {
                            total++;
                            const r = this._qcmResults[qIdx];
                            if (r) {
                                if (r.correct) correct++;
                                details.push(r);
                            } else {
                                // Question non validée = incorrecte
                                const choices = q.choix || q.options || [];
                                let correctIndices = [];
                                if (q.reponses_correctes && Array.isArray(q.reponses_correctes)) correctIndices = q.reponses_correctes;
                                else if (q.reponse !== undefined) correctIndices = [q.reponse];
                                else if (q.reponse_correcte !== undefined) correctIndices = [q.reponse_correcte];
                                else correctIndices = choices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0);
                                details.push({
                                    question: q.question,
                                    reponse: null,
                                    attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                                    correct: false
                                });
                            }
                        });
                    } else {
                        // Fallback : validation classique (1 seule question ou pas de carrousel)
                        donnees.multiQuestions.forEach((q, qIdx) => {
                            total++;
                            const choices = q.choix || q.options || [];
                            const userAnswer = this.userAnswers[`qcm_${qIdx}`];

                            let correctIndices = [];
                            if (q.reponses_correctes && Array.isArray(q.reponses_correctes)) {
                                correctIndices = q.reponses_correctes;
                            } else if (q.reponse !== undefined) {
                                correctIndices = [q.reponse];
                            } else if (q.reponse_correcte !== undefined) {
                                correctIndices = [q.reponse_correcte];
                            } else {
                                correctIndices = choices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0);
                            }

                            const isCorrect = correctIndices.includes(parseInt(userAnswer));
                            if (isCorrect) correct++;

                            // Construire le texte du feedback (minimaliste - sans explication)
                            let feedbackText = isCorrect ? 'Correct' : 'Mauvaise réponse';

                            // Utiliser la fonction unifiée de feedback
                            this.displayUnifiedFeedback(`feedback_qcm_${qIdx}`, isCorrect, feedbackText, isCorrect ? 1 : 0, 1, 'qcm');
                            details.push({
                                question: q.question,
                                reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
                                attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                                correct: isCorrect
                            });
                        });
                    }
                } else {
                    // Mode simple (une seule question QCM)
                    total = 1;
                    const choices = donnees.choix || donnees.options || [];
                    const userAnswer = this.userAnswers['qcm'];

                    let correctIndices = [];
                    if (donnees.reponses_correctes && Array.isArray(donnees.reponses_correctes)) {
                        correctIndices = donnees.reponses_correctes;
                    } else if (donnees.reponse_correcte !== undefined) {
                        correctIndices = [donnees.reponse_correcte];
                    } else {
                        correctIndices = choices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0);
                    }

                    if (correctIndices.includes(parseInt(userAnswer))) correct = 1;

                    // Construire le texte du feedback (minimaliste - sans explication)
                    let feedbackText = correct === 1 ? 'Correct' : 'Mauvaise réponse';

                    // Utiliser la fonction unifiée de feedback
                    this.displayUnifiedFeedback('feedback_qcm', correct === 1, feedbackText, correct, 1, 'qcm');
                    details.push({
                        question: donnees.question,
                        reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
                        attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                        correct: correct === 1
                    });
                }
                break;

            case 'chronologie':
            case 'timeline':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                if (donnees.paires && donnees.mode) {
                    // Mode texte (chronologie)
                    const chronoAnswers = this.userAnswers['chrono'] || {};
                    const paires = donnees.paires || donnees.evenements || [];
                    const mode = donnees.mode || 'date';

                    const sortedEvents = [...paires].sort((a, b) => {
                        const dateA = parseInt(String(a.date).replace(/\D/g, '')) || 0;
                        const dateB = parseInt(String(b.date).replace(/\D/g, '')) || 0;
                        return dateA - dateB;
                    });

                    sortedEvents.forEach((evt, idx) => {
                        total++;
                        const answer = chronoAnswers[idx];
                        const inputEl = document.querySelector(`.chrono-input[data-index="${idx}"]`);
                        if (!inputEl) return;

                        let isCorrect = false;
                        let correctValue = mode === 'evenement' ? evt.evenement : String(evt.date);
                        let reponsesAcceptees = evt.reponses_acceptees || [];

                        if (answer && answer.value) {
                            const userValue = answer.value.trim().toLowerCase();
                            if (userValue === correctValue.trim().toLowerCase()) isCorrect = true;
                            if (!isCorrect && reponsesAcceptees.length > 0) {
                                isCorrect = reponsesAcceptees.some(alt => alt.trim().toLowerCase() === userValue);
                            }
                        }

                        inputEl.classList.remove('correct', 'incorrect');
                        if (isCorrect) {
                            correct++;
                            inputEl.classList.add('correct');
                        } else {
                            inputEl.classList.add('incorrect');
                            const container = inputEl.closest('.chrono-input-zone');
                            if (container && !container.querySelector('.chrono-correction')) {
                                const correction = document.createElement('span');
                                correction.className = 'chrono-correction';
                                correction.textContent = correctValue;
                                container.appendChild(correction);
                            }
                        }

                        // Ajouter l'affichage du score
                        const container = inputEl.closest('.chrono-input-zone');
                        if (container && !container.querySelector('.chrono-score')) {
                            const scoreSpan = document.createElement('span');
                            scoreSpan.className = 'chrono-score';
                            scoreSpan.textContent = isCorrect ? ' — 1/1 point' : ' — 0/1 point';
                            container.appendChild(scoreSpan);
                        }
                        details.push({ question: mode === 'evenement' ? evt.date : evt.evenement, reponse: answer?.value, attendu: correctValue, correct: isCorrect });
                    });
                } else {
                    // Mode drag (timeline cartes)
                    const cartes = donnees.cartes || [];
                    const cardsContainer = document.getElementById('timelineCards');
                    if (cardsContainer) {
                        const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));
                        total = cartes.length;

                        // Sauvegarder l'ordre de l'élève avant validation
                        const studentOrder = placedCards.map(c => parseInt(c.dataset.originalIndex));

                        placedCards.forEach((card, positionActuelle) => {
                            const originalIndex = parseInt(card.dataset.originalIndex);
                            card.classList.remove('correct', 'incorrect');
                            card.setAttribute('draggable', 'false');

                            const isCorrect = originalIndex === positionActuelle;
                            if (isCorrect) {
                                correct++;
                                card.classList.add('correct');
                            } else {
                                card.classList.add('incorrect');
                            }

                            // Score affiché globalement en haut, pas inline

                            details.push({ question: `Position ${positionActuelle + 1}`, reponse: cartes[originalIndex]?.titre, attendu: cartes[positionActuelle]?.titre, correct: originalIndex === positionActuelle });
                        });
                    }
                }

                // Afficher le feedback minimaliste avec score pour timeline
                if (!donnees.paires || !donnees.mode) {
                    const isTimelineCorrect = correct === total;
                    const feedbackText = isTimelineCorrect ? 'Correct' : 'Mauvaise réponse';
                    this.displayUnifiedFeedback('feedback_timeline', isTimelineCorrect, feedbackText, correct, total, 'chronologie');
                }
                break;

            case 'texte_trou':
            case 'texte_trous':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const trouInputs = document.querySelectorAll('.trou-input');
                const trous = donnees.trous || [];

                trouInputs.forEach((input, idx) => {
                    total++;
                    const userValue = input.value.trim().toLowerCase();
                    const correctValue = input.dataset.answer ? input.dataset.answer.toLowerCase() : '';

                    let alternatives = [];
                    if (trous[idx] && trous[idx].alternatives) {
                        alternatives = trous[idx].alternatives.map(a => a.toLowerCase());
                    }

                    input.classList.remove('correct', 'incorrect');
                    const isOk = userValue === correctValue || alternatives.includes(userValue);
                    if (isOk) {
                        correct++;
                        input.classList.add('correct');
                    } else {
                        input.classList.add('incorrect');
                    }

                    // Score affiché globalement en haut, pas inline

                    details.push({ question: `Trou ${idx + 1}`, reponse: input.value, attendu: input.dataset.answer, correct: isOk });
                });

                // Afficher le feedback minimaliste avec score pour texte à trous
                const isTexteTrousCorrect = correct === total;
                const texteTrousTexte = isTexteTrousCorrect ? 'Correct' : 'Mauvaise réponse';
                this.displayUnifiedFeedback('feedback_texte_trous', isTexteTrousCorrect, texteTrousTexte, correct, total, 'chronologie');
                break;

            case 'carte':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const marqueurs = donnees.marqueurs || [];
                marqueurs.forEach((m, idx) => {
                    total++;
                    const answer = this.userAnswers['carte_' + idx];
                    const marker = document.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
                    const answerItem = document.querySelector(`.carte-answer-item[data-index="${idx}"]`);
                    const correctAnswer = (m.reponse || '').split('|')[0].trim();

                    if (answer) {
                        const userValue = answer.trim().toLowerCase();
                        const expectedValue = (m.reponse || '').trim().toLowerCase();
                        const reponsesAcceptees = m.reponses_acceptees || [];
                        const allAccepted = [expectedValue, ...reponsesAcceptees.map(r => r.trim().toLowerCase())];
                        const isCorrect = allAccepted.some(rep => userValue === rep);

                        if (isCorrect) {
                            correct++;
                            if (marker) marker.classList.add('correct');
                            if (answerItem) answerItem.classList.add('correct');
                        } else {
                            if (marker) marker.classList.add('incorrect');
                            if (answerItem) answerItem.classList.add('incorrect');
                        }

                        // Apply correction mode visualization
                        this.applyCarteCorrectionMode(marker, idx, isCorrect, answer, correctAnswer);

                        // Score affiché globalement en haut, pas inline

                        details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrect });
                    } else {
                        if (marker) marker.classList.add('incorrect');
                        if (answerItem) answerItem.classList.add('incorrect');

                        // Apply correction mode visualization
                        this.applyCarteCorrectionMode(marker, idx, false, null, correctAnswer);

                        // Ajouter l'affichage du score
                        if (answerItem && !answerItem.querySelector('.carte-answer-score')) {
                            const scoreSpan = document.createElement('span');
                            scoreSpan.className = 'carte-answer-score';
                            scoreSpan.textContent = ' — 0/1 point';
                            answerItem.appendChild(scoreSpan);
                        }

                        details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
                    }
                });

                // Afficher le feedback minimaliste avec score pour carte
                const isCarteCorrect = correct === total;
                const carteTexte = isCarteCorrect ? 'Correct' : 'Mauvaise réponse';
                this.displayUnifiedFeedback('feedback_carte', isCarteCorrect, carteTexte, correct, total, 'chronologie');
                break;

            case 'question_ouverte':
                // Multi-questions avec résultats pré-validés
                if (donnees.multiQuestions && donnees.multiQuestions.length > 0 && this._qoResults && Object.keys(this._qoResults).length > 0) {
                    donnees.multiQuestions.forEach((q, qIdx) => {
                        total++;
                        const r = this._qoResults[qIdx];
                        if (r) {
                            if (r.correct) correct++;
                            details.push(r);
                        } else {
                            details.push({ question: q.question, reponse: null, attendu: (q.reponses_acceptees || []).join(' / '), correct: false });
                        }
                    });
                } else {
                    // Format simple (une seule question)
                    total = 1;
                    const qoAnswer = this.userAnswers['question_ouverte'];
                    const qoReponsesAcceptees = donnees.reponses_acceptees || [];
                    const qoStricte = donnees.comparaison_stricte || false;
                    const qoFeedbackEl = document.getElementById('feedback_question_ouverte');
                    const qoInput = document.getElementById('questionOuverteReponse');

                    let qoCorrect = false;
                    if (qoAnswer) {
                        qoCorrect = qoReponsesAcceptees.some(rep => this.compareAnswers(qoAnswer, rep, qoStricte));
                    }
                    if (qoCorrect) correct = 1;

                    if (qoInput) {
                        qoInput.classList.remove('correct', 'incorrect');
                        qoInput.classList.add(qoCorrect ? 'correct' : 'incorrect');
                    }

                    if (qoFeedbackEl) {
                        // Construire le texte du feedback (minimaliste - sans explication)
                        let feedbackText = qoCorrect ? 'Correct' : 'Mauvaise réponse';

                        // Utiliser la fonction unifiée de feedback
                        this.displayUnifiedFeedback('feedback_question_ouverte', qoCorrect, feedbackText, qoCorrect ? 1 : 0, 1);
                    }
                    details.push({ question: donnees.question, reponse: qoAnswer, attendu: qoReponsesAcceptees.join(' / '), correct: qoCorrect });
                }
                break;

            case 'association':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const assocPaires = donnees.paires || [];
                total = assocPaires.length;
                const userPairs = this.userAnswers['association'] || [];

                userPairs.forEach(up => {
                    // Retrouver les éléments visuels (grille + chip)
                    const gridId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
                    const chipId = this._assocChipSide === 'gauche' ? up.gauche : up.droite;
                    const gridEl = document.querySelector(`#associationGrid .association-grid-card[data-id="${gridId}"]`);
                    const chipEl = document.querySelector(`#associationChips .association-chip[data-id="${chipId}"]`);

                    const isCorrect = String(up.gauche) === String(up.droite);
                    if (isCorrect) {
                        correct++;
                        [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('correct'); } });
                    } else {
                        [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('incorrect'); } });
                    }
                    details.push({
                        question: assocPaires[parseInt(up.gauche)]?.element1 || up.gauche,
                        reponse: assocPaires[parseInt(up.droite)]?.element2 || up.droite,
                        correct: isCorrect
                    });
                });
                // Ajouter les éléments non associés comme erreurs
                for (let i = 0; i < assocPaires.length; i++) {
                    const gridId = String(i);
                    const isMatched = userPairs.some(up => {
                        const upGridId = this._assocGridSide === 'gauche' ? String(up.gauche) : String(up.droite);
                        return upGridId === gridId;
                    });
                    if (!isMatched) {
                        details.push({
                            question: assocPaires[i].element1,
                            reponse: '—',
                            attendu: assocPaires[i].element2,
                            correct: false
                        });
                    }
                }
                // Marquer les éléments non appariés comme incorrects
                document.querySelectorAll('#associationGrid .association-grid-card:not(.correct):not(.incorrect)').forEach(el => el.classList.add('incorrect'));

                // Cacher les chips et le label d'instruction
                const chipsZone = document.querySelector('#associationChips');
                if (chipsZone) chipsZone.style.display = 'none';
                const zoneLabel = document.querySelector('.association-zone-label');
                if (zoneLabel) zoneLabel.style.display = 'none';

                // Afficher le feedback minimaliste avec score
                const isAssocCorrect = correct === total;
                const feedbackText = isAssocCorrect ? 'Correct' : 'Mauvaise réponse';
                this.displayUnifiedFeedback('association_feedback', isAssocCorrect, feedbackText, correct, total, 'association');
                break;

            case 'flashcard':
                const flashResults = this.userAnswers['flashcard'] || [];
                const flashCartes = donnees.cartes || [];
                total = flashCartes.length;
                correct = flashResults.filter(r => r.savait).length;
                flashCartes.forEach((carte, idx) => {
                    const result = flashResults[idx];
                    details.push({ question: carte.recto, reponse: result ? (result.savait ? 'Je savais' : 'Je ne savais pas') : 'Non évalué', attendu: carte.verso, correct: result ? result.savait : false });
                });
                break;
        }

        // Marquer l'étape comme validée
        this.currentEtapeValidated = true;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Stocker le résultat pour le bilan final
        // Si multi-format, conserver les données de chaque sous-question pour la correction visuelle
        const subQuestions = (this._multiFormatState && this._multiFormatState.questions)
            ? this._multiFormatState.questions.map((q, qIdx) => ({
                qData: q,
                result: this._multiFormatState.results[qIdx] || { correct: 0, total: 0, details: [] }
            }))
            : null;

        this.etapesResults[this.currentEtapeIndex] = {
            etapeIndex: this.currentEtapeIndex,
            etapeTitre: currentEtape.titre || `Étape ${this.currentEtapeIndex + 1}`,
            format: currentEtape.format_code,
            correct,
            total,
            pourcentage: percent,
            details,
            donnees,
            subQuestions
        };

        // Désactiver les inputs
        const content = document.getElementById('exerciseContent');
        if (content) {
            content.classList.add('validated');
            content.querySelectorAll('input, select, textarea, button').forEach(el => {
                if (!el.closest('.etape-action-bar') && !el.closest('.timeline-toggle') && !el.closest('.carte-popup')) el.disabled = true;
            });
            // Désactiver les clics sur les items d'association (grille + chips)
            content.querySelectorAll('.association-grid-card, .association-chip').forEach(el => {
                el.style.pointerEvents = 'none';
            });
        }

        // NOTE: Pour les formats multi-questions (Association, Chrono, Texte à trous via renderMultiFormat),
        // le feedback est déjà affiché par validateMultiFormatQuestion() pour chaque question.
        // Pas de feedback global supplémentaire (éviter doublon)

        // Affichage du bouton "Suivant" dans la zone d'action habituelle avec meilleur styling
        const isLastEtape = this.currentEtapeIndex >= this.currentEtapes.length - 1;
        const actionBar = document.getElementById('etapeActionBar');
        if (actionBar) {
            const btnAction = isLastEtape ? 'finishEntrainement' : 'nextEtape';
            const btnLabel = isLastEtape ? 'Terminer ✓' : 'Suivant →';
            const btnClass = isLastEtape ? 'finish-btn' : 'next-btn';
            actionBar.className = 'etape-action-bar';
            actionBar.innerHTML = `<button class="btn-etape-action ${btnClass}" onclick="EleveConnaissances.${btnAction}()">${btnLabel}</button>`;
        }
    },

    /**
     * Récupère les données d'une étape (jointure etapeQuestions → questionsConnaissances)
     */
    getEtapeDonnees(etape) {
        let donnees = {};
        const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
            String(eq.etape_id) === String(etape.id)
        );

        if (linkedQuestionRefs.length > 0) {
            const questionRef = linkedQuestionRefs[0];
            const questionContent = this.questionsConnaissances.find(q =>
                String(q.id) === String(questionRef.question_id)
            );
            if (questionContent && questionContent.donnees) {
                donnees = questionContent.donnees;
                if (typeof donnees === 'string') {
                    try {
                        donnees = JSON.parse(donnees);
                    } catch (e) {
                        Logger.warn('EleveConnaissances', 'getEtapeDonnees JSON parse failed', e);
                        donnees = {};
                    }
                }
            }
        }

        if (Object.keys(donnees).length === 0 && etape.donnees) {
            donnees = etape.donnees;
            if (typeof donnees === 'string') {
                try {
                    donnees = JSON.parse(donnees);
                } catch (e) {
                    Logger.warn('EleveConnaissances', 'getEtapeDonnees JSON parse failed for etape donnees', e);
                    donnees = {};
                }
            }
        }
        return donnees;
    },

    validateQoQuestion(qIdx) {
        if (this._qoResults && this._qoResults[qIdx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const q = donnees.multiQuestions[qIdx];
        if (!q) return;

        const userAnswer = this.userAnswers[`question_ouverte_${qIdx}`];
        const reponsesAcceptees = q.reponses_acceptees || [];
        const stricte = q.comparaison_stricte || false;

        let isCorrect = false;
        if (userAnswer) {
            isCorrect = reponsesAcceptees.some(rep => this.compareAnswers(userAnswer, rep, stricte));
        }

        // Marquer l'input comme correct/incorrect
        const inputEl = document.getElementById(`questionOuverteReponse_${qIdx}`);
        if (inputEl) {
            inputEl.classList.remove('correct', 'incorrect');
            inputEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            inputEl.disabled = true;
        }

        // Afficher le feedback unifié avec score
        const feedbackText = this.extractFeedbackText('question_ouverte', isCorrect, q, userAnswer);
        this.displayUnifiedFeedback(
            `feedback_question_ouverte_${qIdx}`,
            isCorrect,
            feedbackText,
            isCorrect ? 1 : 0,
            1,
            'question-feedback'
        );

        // Stocker le résultat
        this._qoResults[qIdx] = {
            question: q.question,
            reponse: userAnswer,
            attendu: reponsesAcceptees.join(' / '),
            correct: isCorrect
        };

        // Remplacer le bouton
        const totalQo = donnees.multiQuestions.length;
        const allValidated = Object.keys(this._qoResults).length >= totalQo;
        const actionDiv = document.getElementById(`qo_action_${qIdx}`);

        if (allValidated) {
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qoNavNext()">Suivant →</button>`;
            }
        }
    },

    /** Navigation Question Ouverte : aller à une question */
    qoNavGoTo(index) {
        const container = document.querySelector('.qo-multi-container');
        if (!container) return;
        const items = container.querySelectorAll('.question-ouverte-container');
        const total = items.length;
        if (index < 0 || index >= total) return;

        this._qoNavIndex = index;

        items.forEach((item, i) => {
            item.style.display = i === index ? '' : 'none';
        });

        container.querySelectorAll('.qo-question-action').forEach(action => {
            const forIdx = parseInt(action.getAttribute('data-for-qo'));
            action.style.display = forIdx === index ? '' : 'none';
        });

        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Question ${index + 1} / ${total}`;
    },

    /** Navigation Question Ouverte : question suivante */
    qoNavNext() {
        const idx = this._qoNavIndex || 0;
        this.qoNavGoTo(idx + 1);
    },

    // ===== CAROUSEL GÉNÉRIQUE MULTI-FORMAT (render-on-demand) =====

    /**
     * Affiche un carousel multi-question pour les formats:
     * texte_trou, association, chronologie, timeline, carte
     */
    renderMultiFormat(format, donnees, questions) {
        const multiQ = donnees.multiQuestions;
        this._multiFormatState = {
            format: format,
            questions: multiQ,
            currentIndex: 0,
            results: {},
            totalQuestions: multiQ.length
        };

        // Rendre la première question
        const firstHtml = this.renderSingleFormatQuestion(format, multiQ[0]);

        return `
            <div class="multi-format-container" data-format="${format}" data-total-mf="${multiQ.length}">
                <div class="multi-format-content" id="multiFormatContent">
                    ${firstHtml}
                </div>
                <div class="multi-format-action" id="multiFormatAction">
                    <button class="btn-qcm-validate" onclick="EleveConnaissances.validateMultiFormatQuestion()">Valider</button>
                </div>
            </div>
        `;
    },

    /** Rend une seule question pour un format donné */
    renderSingleFormatQuestion(format, qData) {
        switch (format) {
            case 'texte_trou':
            case 'texte_trous':
                return this.renderTexteTrous(qData, []);
            case 'association':
                return this.renderAssociation(qData, []);
            case 'chronologie':
                if (qData.paires && qData.mode) return this.renderChronologie(qData, []);
                return this.renderTimeline(qData, []);
            case 'timeline':
                if (qData.paires && qData.mode) return this.renderChronologie(qData, []);
                return this.renderTimeline(qData, []);
            case 'carte':
                return this.renderCarte(qData, []);
            default:
                return '<div class="format-no-data"><p>Format non supporté</p></div>';
        }
    },

    /** Valide la question courante du carousel multi-format */
    validateMultiFormatQuestion() {
        const state = this._multiFormatState;
        if (!state) return;
        const idx = state.currentIndex;
        const qData = state.questions[idx];

        // Exécuter la validation spécifique au format
        const result = this.runFormatValidation(state.format, qData);
        state.results[idx] = result;

        // Afficher le feedback avec points
        const container = document.getElementById('multiFormatContent');
        let feedbackEl = document.getElementById('multiFormatFeedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'multiFormatFeedback';
            feedbackEl.className = 'multi-format-feedback';
            container.appendChild(feedbackEl);
        }
        feedbackEl.style.display = 'block';

        // Afficher le feedback unifié (format 2 lignes: message + score)
        const isCorrect = result.correct === result.total;
        const feedbackText = isCorrect ? 'Correct' : 'Réponse incorrecte';

        // Utiliser la fonction unifiée de feedback
        feedbackEl.id = 'multiFormatFeedback'; // S'assurer que l'ID existe
        // Passer le format spécifique (chronologie, timeline, etc.) pour appliquer le CSS approprié
        let feedbackFormat = state.format;
        if (!['qcm', 'vf', 'association', 'chronologie', 'timeline'].includes(feedbackFormat)) {
            feedbackFormat = 'question-feedback';
        }
        this.displayUnifiedFeedback(
            'multiFormatFeedback',
            isCorrect,
            feedbackText,
            result.correct,
            result.total,
            feedbackFormat
        );

        // Mettre à jour le bouton d'action dans un conteneur propre
        const actionDiv = document.getElementById('multiFormatAction');
        const allValidated = Object.keys(state.results).length >= state.totalQuestions;

        if (allValidated) {
            if (actionDiv) {
                actionDiv.innerHTML = '';
                actionDiv.style.marginTop = '1.5rem';
            }
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.style.marginTop = '1.5rem';
                actionDiv.innerHTML = `<button class="btn-qcm-next" style="padding: 0.75rem 1.5rem; font-size: 1rem;" onclick="EleveConnaissances.multiFormatNext()">Suivant →</button>`;
            }
        }
    },

    /** Passe à la question suivante du carousel multi-format */
    multiFormatNext() {
        const state = this._multiFormatState;
        if (!state) return;
        state.currentIndex++;
        const idx = state.currentIndex;
        const qData = state.questions[idx];

        // Nettoyer les réponses spécifiques au format précédent
        this.clearFormatAnswers(state.format);

        // Rendre la nouvelle question
        const content = document.getElementById('multiFormatContent');
        content.innerHTML = this.renderSingleFormatQuestion(state.format, qData);

        // Remettre le bouton Valider
        const actionDiv = document.getElementById('multiFormatAction');
        if (actionDiv) {
            actionDiv.innerHTML = `<button class="btn-qcm-validate" onclick="EleveConnaissances.validateMultiFormatQuestion()">Valider</button>`;
        }

        // Mettre à jour le compteur dans le header
        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Question ${idx + 1} / ${state.totalQuestions}`;

        // Re-setup spécifique au format (drag & drop, etc.)
        this.setupFormatAfterRender(state.format);
    },

    /** Nettoie les réponses utilisateur pour le format courant */
    clearFormatAnswers(format) {
        switch (format) {
            case 'association':
                this.userAnswers['association'] = [];
                this.associationPairs = [];
                this.associationSelection = { grid: null, chip: null };
                this.associationPairCounter = 0;
                break;
            case 'chronologie':
            case 'timeline':
                this.userAnswers['chrono'] = {};
                break;
            case 'carte':
                Object.keys(this.userAnswers).forEach(key => {
                    if (key.startsWith('carte_')) delete this.userAnswers[key];
                });
                break;
        }
    },

    /** Re-setup après render-on-demand (drag & drop, etc.) */
    setupFormatAfterRender(format) {
        switch (format) {
            case 'chronologie':
            case 'timeline':
                setTimeout(() => {
                    if (document.querySelector('.timeline-cards')) {
                        this.setupTimelineDragDrop();
                        this.saveTimelineOrder();
                    }
                }, 100);
                break;
        }
    },

    /** Exécute la validation spécifique au format et retourne { correct, total, details } */
    runFormatValidation(format, qData) {
        switch (format) {
            case 'texte_trou':
            case 'texte_trous':
                return this.runTexteValidation(qData);
            case 'association':
                return this.runAssociationValidation(qData);
            case 'chronologie':
            case 'timeline':
                if (qData.paires && qData.mode) return this.runChronoValidation(qData);
                return this.runTimelineValidation(qData);
            case 'carte':
                return this.runCarteValidation(qData);
            default:
                return { correct: 0, total: 0, details: [] };
        }
    },

    /** Validation texte à trous */
    runTexteValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const trouInputs = container.querySelectorAll('.trou-input');
        let correct = 0, total = 0;
        const details = [];

        trouInputs.forEach((input, idx) => {
            total++;
            const userValue = input.value.trim().toLowerCase();
            const correctValue = input.dataset.answer ? input.dataset.answer.toLowerCase() : '';
            let alternatives = [];
            if (qData.trous && qData.trous[idx] && qData.trous[idx].alternatives) {
                alternatives = qData.trous[idx].alternatives.map(a => a.toLowerCase());
            }
            input.classList.remove('correct', 'incorrect');
            const isOk = userValue === correctValue || alternatives.includes(userValue);
            if (isOk) {
                correct++;
                input.classList.add('correct');
            } else {
                input.classList.add('incorrect');
            }
            details.push({ question: `Trou ${idx + 1}`, reponse: input.value, attendu: input.dataset.answer, correct: isOk });
        });

        return { correct, total, details };
    },

    /** Validation chronologie (mode texte) */
    runChronoValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const events = qData.paires || qData.evenements || [];
        const mode = qData.mode || 'date';
        let correct = 0, total = 0;
        const details = [];

        const sortedEvents = [...events].sort((a, b) => {
            const dateA = parseInt(String(a.date).replace(/\D/g, '')) || 0;
            const dateB = parseInt(String(b.date).replace(/\D/g, '')) || 0;
            return dateA - dateB;
        });

        sortedEvents.forEach((evt, idx) => {
            total++;
            const inputEl = container.querySelector(`.chrono-input[data-index="${idx}"]`);
            if (!inputEl) return;

            let isCorrect = false;
            const correctValue = mode === 'evenement' ? evt.evenement : String(evt.date);
            const reponsesAcceptees = evt.reponses_acceptees || [];
            const userValue = inputEl.value.trim().toLowerCase();

            if (userValue) {
                if (userValue === correctValue.trim().toLowerCase()) isCorrect = true;
                if (!isCorrect && reponsesAcceptees.length > 0) {
                    isCorrect = reponsesAcceptees.some(alt => alt.trim().toLowerCase() === userValue);
                }
            }

            inputEl.classList.remove('correct', 'incorrect');
            if (isCorrect) {
                correct++;
                inputEl.classList.add('correct');
            } else {
                inputEl.classList.add('incorrect');
                const inputZone = inputEl.closest('.chrono-input-zone');
                if (inputZone && !inputZone.querySelector('.chrono-correction')) {
                    const correction = document.createElement('span');
                    correction.className = 'chrono-correction';
                    correction.textContent = correctValue;
                    inputZone.appendChild(correction);
                }
            }
            details.push({ question: mode === 'evenement' ? evt.date : evt.evenement, reponse: userValue, attendu: correctValue, correct: isCorrect });
        });

        return { correct, total, details };
    },

    /** Validation timeline (mode drag & drop) */
    runTimelineValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const cartes = qData.cartes || [];
        let correct = 0;
        const total = cartes.length;
        const details = [];

        const cardsContainer = container.querySelector('.timeline-cards');
        if (cardsContainer) {
            const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));

            placedCards.forEach((card, positionActuelle) => {
                const originalIndex = parseInt(card.dataset.originalIndex);
                card.classList.remove('correct', 'incorrect');
                card.setAttribute('draggable', 'false');

                if (originalIndex === positionActuelle) {
                    correct++;
                    card.classList.add('correct');
                } else {
                    card.classList.add('incorrect');
                }
                details.push({ question: `Position ${positionActuelle + 1}`, reponse: cartes[originalIndex]?.titre, attendu: cartes[positionActuelle]?.titre, correct: originalIndex === positionActuelle });
            });
        }

        return { correct, total, details };
    },

    /** Validation association */
    runAssociationValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const assocPaires = qData.paires || [];
        let correct = 0;
        const total = assocPaires.length;
        const details = [];
        const userPairs = this.userAnswers['association'] || [];

        userPairs.forEach(up => {
            const gridId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
            const chipId = this._assocChipSide === 'gauche' ? up.gauche : up.droite;
            const gridEl = container.querySelector(`.association-grid-card[data-id="${gridId}"]`);
            const chipEl = container.querySelector(`.association-chip[data-id="${chipId}"]`);

            const isCorrect = String(up.gauche) === String(up.droite);
            if (isCorrect) {
                correct++;
                [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('correct'); } });
            } else {
                [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('incorrect'); } });
            }
            details.push({
                question: assocPaires[parseInt(up.gauche)]?.element1 || up.gauche,
                reponse: assocPaires[parseInt(up.droite)]?.element2 || up.droite,
                correct: isCorrect
            });
        });

        // Éléments non associés = erreurs
        for (let i = 0; i < assocPaires.length; i++) {
            const gridId = String(i);
            const isMatched = userPairs.some(up => {
                const upGridId = this._assocGridSide === 'gauche' ? String(up.gauche) : String(up.droite);
                return upGridId === gridId;
            });
            if (!isMatched) {
                details.push({ question: assocPaires[i].element1, reponse: '—', attendu: assocPaires[i].element2, correct: false });
            }
        }

        // Feedback visuel
        container.querySelectorAll('.association-grid-card:not(.correct):not(.incorrect)').forEach(el => el.classList.add('incorrect'));
        const chipsZone = container.querySelector('.association-chips');
        if (chipsZone) chipsZone.style.display = 'none';
        const zoneLabel = container.querySelector('.association-zone-label');
        if (zoneLabel) zoneLabel.style.display = 'none';

        const getChipText = (id) => {
            const p = assocPaires[parseInt(id)];
            if (!p) return '?';
            return this._assocChipSide === 'gauche' ? p.element1 : p.element2;
        };

        container.querySelectorAll('.association-grid-card').forEach(card => {
            const cardId = card.dataset.id;
            const correctText = getChipText(cardId);
            const label = card.querySelector('.assoc-paired-label');
            if (!label) return;

            label.style.display = 'block';
            const userPair = userPairs.find(up => {
                const gId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
                return String(gId) === String(cardId);
            });

            if (userPair) {
                const chipId = this._assocChipSide === 'gauche' ? userPair.gauche : userPair.droite;
                const isCorrect = String(userPair.gauche) === String(userPair.droite);
                const studentText = getChipText(chipId);
                if (isCorrect) {
                    label.className = 'assoc-paired-label assoc-label-success';
                    label.innerHTML = `<span class="assoc-answer-ok">✓ ${this.escapeHtml(correctText)}</span>`;
                } else {
                    label.className = 'assoc-paired-label assoc-label-error';
                    label.innerHTML = `<span class="assoc-answer-wrong">✗ ${this.escapeHtml(studentText)}</span><span class="assoc-answer-right">→ ${this.escapeHtml(correctText)}</span>`;
                }
            } else {
                label.className = 'assoc-paired-label assoc-label-error';
                label.innerHTML = `<span class="assoc-answer-wrong">✗ —</span><span class="assoc-answer-right">→ ${this.escapeHtml(correctText)}</span>`;
            }
        });

        return { correct, total, details };
    },

    /** Validation carte/image cliquable */
    runCarteValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const marqueurs = qData.marqueurs || [];
        let correct = 0, total = 0;
        const details = [];

        marqueurs.forEach((m, idx) => {
            total++;
            const answer = this.userAnswers['carte_' + idx];
            const marker = container.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
            const correctAnswer = (m.reponse || '').split('|')[0].trim();

            if (answer) {
                const userValue = answer.trim().toLowerCase();
                const expectedValue = (m.reponse || '').trim().toLowerCase();
                const reponsesAcceptees = m.reponses_acceptees || [];
                const allAccepted = [expectedValue, ...reponsesAcceptees.map(r => r.trim().toLowerCase())];
                const isCorrect = allAccepted.some(rep => userValue === rep);

                if (isCorrect) {
                    correct++;
                    if (marker) marker.classList.add('correct');
                } else {
                    if (marker) marker.classList.add('incorrect');
                }
                this.applyCarteCorrectionMode(marker, idx, isCorrect, answer, correctAnswer);
                details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrect });
            } else {
                if (marker) marker.classList.add('incorrect');
                this.applyCarteCorrectionMode(marker, idx, false, null, correctAnswer);
                details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
            }
        });

        // Fermer le popup si ouvert
        this.closeCartePopup?.();

        return { correct, total, details };
    },

    /** Valide une proposition Vrai/Faux individuelle dans le carrousel */
    validateVfQuestion(idx) {
        if (this._vfResults && this._vfResults[idx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const propositions = donnees.propositions || [];
        const prop = propositions[idx];
        if (!prop) return;

        const answer = this.userAnswers[`vf_${idx}`];
        const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
        const isCorrect = answer === expected;

        // Afficher le feedback (minimaliste - sans explication)
        const feedback = document.getElementById(`feedback_vf_${idx}`);
        if (feedback) {
            feedback.style.display = 'block';
            feedback.className = `vf-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
            const vfSymbol = isCorrect ? '✓' : '✗';
            feedback.textContent = isCorrect ? '✓ Correct' : '✗ Mauvaise réponse';
        }

        // Verrouiller les choix
        const item = document.querySelector(`.vrai-faux-item[data-index="${idx}"]`);
        if (item) {
            item.querySelectorAll('input').forEach(el => el.disabled = true);
        }

        // Stocker le résultat
        this._vfResults[idx] = {
            question: prop.texte,
            reponse: answer,
            attendu: expected,
            correct: isCorrect
        };

        // Remplacer le bouton
        const totalVf = propositions.length;
        const allValidated = Object.keys(this._vfResults).length >= totalVf;
        const actionDiv = document.getElementById(`vf_action_${idx}`);

        if (allValidated) {
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.vfNavNext()">Suivant →</button>`;
            }
        }
    },

    /** Navigation Vrai/Faux : aller à une proposition */
    vfNavGoTo(index) {
        const container = document.querySelector('.vrai-faux-container');
        if (!container) return;
        const items = container.querySelectorAll('.vrai-faux-item');
        const total = items.length;
        if (index < 0 || index >= total) return;

        this._vfNavIndex = index;

        items.forEach((item, i) => {
            item.style.display = i === index ? '' : 'none';
        });

        // Afficher/masquer les boutons d'action correspondants
        container.querySelectorAll('.vf-question-action').forEach(action => {
            const forIdx = parseInt(action.getAttribute('data-for-vf'));
            action.style.display = forIdx === index ? '' : 'none';
        });

        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Question ${index + 1} / ${total}`;
    },

    /** Navigation Vrai/Faux : proposition suivante */
    vfNavNext() {
        const idx = this._vfNavIndex || 0;
        this.vfNavGoTo(idx + 1);
    },

    /** Valide une question QCM individuelle dans le carrousel multi-questions */
    validateQcmQuestion(qIdx) {
        // Éviter la double validation
        if (this._qcmResults && this._qcmResults[qIdx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const q = donnees.multiQuestions[qIdx];
        if (!q) return;

        const choices = q.choix || q.options || [];
        const userAnswer = this.userAnswers[`qcm_${qIdx}`];

        let correctIndices = [];
        if (q.reponses_correctes && Array.isArray(q.reponses_correctes)) {
            correctIndices = q.reponses_correctes;
        } else if (q.reponse !== undefined) {
            correctIndices = [q.reponse];
        } else if (q.reponse_correcte !== undefined) {
            correctIndices = [q.reponse_correcte];
        } else {
            correctIndices = choices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0);
        }

        const isCorrect = correctIndices.includes(parseInt(userAnswer));

        // Construire le texte du feedback (minimaliste - sans explication)
        let feedbackText = isCorrect ? 'Correct' : 'Mauvaise réponse';

        // Utiliser la fonction unifiée de feedback (avec score!)
        this.displayUnifiedFeedback(
            `feedback_qcm_${qIdx}`,
            isCorrect,
            feedbackText,
            isCorrect ? 1 : 0,
            1,
            'qcm'
        );

        // Verrouiller les choix de cette question
        const block = document.querySelector(`.qcm-question-block[data-question="${qIdx}"]`);
        if (block) {
            block.querySelectorAll('input').forEach(el => el.disabled = true);
        }

        // Stocker le résultat
        this._qcmResults[qIdx] = {
            question: q.question,
            reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
            attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
            correct: isCorrect
        };

        // Remplacer le bouton : "Valider" → "Suivant →" ou déclencher la validation globale
        const totalQ = donnees.multiQuestions.length;
        const allValidated = Object.keys(this._qcmResults).length >= totalQ;
        const actionDiv = document.getElementById(`qcm_action_${qIdx}`);

        if (allValidated) {
            // Toutes les questions ont été validées → déclencher la validation de l'étape
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else if (qIdx < totalQ - 1) {
            // Pas la dernière → bouton "Suivant →"
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qcmNavNext()">Suivant →</button>`;
            }
        } else {
            // Dernière question mais d'autres avant ne sont pas validées
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qcmNavGoTo(${this.findNextUnvalidatedQcm()})">← Revenir aux questions non validées</button>`;
            }
        }
    },

    /** Trouve la prochaine question QCM non validée */
    findNextUnvalidatedQcm() {
        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const totalQ = donnees.multiQuestions ? donnees.multiQuestions.length : 0;
        for (let i = 0; i < totalQ; i++) {
            if (!this._qcmResults[i]) return i;
        }
        return 0;
    },

    /** Navigation QCM multi-questions : aller à une question */
    qcmNavGoTo(index) {
        const container = document.querySelector('.qcm-multi-container');
        if (!container) return;
        const blocks = container.querySelectorAll('.qcm-question-block');
        const total = blocks.length;
        if (index < 0 || index >= total) return;

        this._qcmNavIndex = index;

        blocks.forEach((block, i) => {
            block.style.display = i === index ? '' : 'none';
        });

        // Afficher/masquer les boutons d'action correspondants
        container.querySelectorAll('.qcm-question-action').forEach(action => {
            const forIdx = parseInt(action.getAttribute('data-for-qcm'));
            action.style.display = forIdx === index ? '' : 'none';
        });

        // Mettre à jour le compteur dans le header de l'étape
        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Question ${index + 1} / ${total}`;
    },

    /** Navigation QCM : question suivante */
    qcmNavNext() {
        const idx = this._qcmNavIndex || 0;
        this.qcmNavGoTo(idx + 1);
    },

});
