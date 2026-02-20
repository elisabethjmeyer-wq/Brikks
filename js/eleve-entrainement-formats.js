Object.assign(EleveEntrainement, {
    // ========== FORMAT VRAI/FAUX ==========
    renderVraiFaux(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const questions = step.questions || [{ id: 'q1', question: step.titre, correctAnswer: step.correctAnswer }];

        // Si toutes les questions ont été répondues, afficher le résumé de l'étape
        const allAnswered = questions.every(q => stepAnswers[q.id] !== undefined);
        if (allAnswered && this.currentQuestionIndex >= questions.length) {
            this.renderVraiFauxStepSummary(step, stepAnswers, questions);
            return;
        }

        // Sinon, afficher une seule question à la fois
        const currentQuestion = questions[this.currentQuestionIndex];
        if (!currentQuestion) {
            this.currentQuestionIndex = questions.length;
            this.renderVraiFaux(step);
            return;
        }

        const questionResult = this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`];
        const isQuestionVerified = questionResult?.verified || false;
        const answer = stepAnswers[currentQuestion.id];
        const isAnswered = answer !== undefined;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon vrai-faux">${this.getFormatIcon('vrai_faux')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Répondez Vrai ou Faux'}</p>
                    </div>
                    <span class="exercise-badge">Question ${this.currentQuestionIndex + 1} / ${questions.length}</span>
                </div>

                <div class="exercise-body">
                    <div class="vrai-faux-list">
                        <div class="vrai-faux-item ${isQuestionVerified ? (answer === currentQuestion.correctAnswer ? 'correct' : 'incorrect') : ''}">
                            <div class="vrai-faux-question">
                                <span class="vrai-faux-number">${this.currentQuestionIndex + 1}</span>
                                <span class="vrai-faux-text">${this.escapeHtml(currentQuestion.question)}</span>
                            </div>
                            <div class="vrai-faux-buttons">
                                <button class="vrai-faux-btn vrai ${answer === true ? 'selected' : ''} ${isQuestionVerified && currentQuestion.correctAnswer === true ? 'correct-answer' : ''} ${isQuestionVerified ? 'disabled' : ''}"
                                        onclick="EleveEntrainement.selectVraiFaux('${currentQuestion.id}', true)"
                                        ${isQuestionVerified ? 'disabled' : ''}>
                                    Vrai
                                </button>
                                <button class="vrai-faux-btn faux ${answer === false ? 'selected' : ''} ${isQuestionVerified && currentQuestion.correctAnswer === false ? 'correct-answer' : ''} ${isQuestionVerified ? 'disabled' : ''}"
                                        onclick="EleveEntrainement.selectVraiFaux('${currentQuestion.id}', false)"
                                        ${isQuestionVerified ? 'disabled' : ''}>
                                    Faux
                                </button>
                            </div>
                            ${isQuestionVerified ? `
                                <div class="vrai-faux-feedback ${answer === currentQuestion.correctAnswer ? 'correct' : 'incorrect'}">
                                    ${answer === currentQuestion.correctAnswer ? '✓ Correct' : (answer !== undefined ? '✗ Incorrect' : '⚠️ Non répondu')}
                                    ${currentQuestion.explanation ? `<p>${this.escapeHtml(currentQuestion.explanation)}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="exercise-actions">
                        ${this.renderVraiFauxQuestionButtons(questions, isAnswered, isQuestionVerified)}
                    </div>
                </div>
            </div>
        `;
    },

    renderVraiFauxStepSummary(step, stepAnswers, questions) {
        const container = document.getElementById('exerciseContainer');
        let correct = 0;

        questions.forEach(q => {
            if (stepAnswers[q.id] === q.correctAnswer) {
                correct++;
            }
        });

        const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
        let scoreClass = 'success';
        if (score < 50) scoreClass = 'failure';
        else if (score < 80) scoreClass = 'partial';

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon vrai-faux">${this.getFormatIcon('vrai_faux')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Répondez Vrai ou Faux'}</p>
                    </div>
                    <span class="exercise-badge">✓ Étape complétée</span>
                </div>

                <div class="exercise-body">
                    <div class="step-summary">
                        <div class="step-summary-header ${scoreClass}">
                            <span class="step-summary-icon">${score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</span>
                            <div>
                                <h3>${score >= 80 ? 'Excellent !' : score >= 50 ? 'Bien joué !' : 'Continue tes efforts'}</h3>
                                <p><strong>${correct}/${questions.length} bonnes réponses</strong></p>
                            </div>
                        </div>
                    </div>

                    <div class="exercise-actions">
                        ${this.renderVraiFauxStepSummaryButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderVraiFauxQuestionButtons(questions, isAnswered, isQuestionVerified) {
        let html = '';

        if (!isQuestionVerified && !isAnswered) {
            html += `<p style="color: var(--gray-500); text-align: center; margin-bottom: 16px;">Veuillez sélectionner une réponse</p>`;
        }

        if (isQuestionVerified) {
            if (this.currentQuestionIndex < questions.length - 1) {
                html += `<button class="btn btn-primary" onclick="EleveEntrainement.nextQuestion()">Question suivante</button>`;
            } else {
                html += `<button class="btn btn-success" onclick="EleveEntrainement.nextQuestion()">Voir le résumé</button>`;
            }
        } else if (isAnswered) {
            html += `<button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentQuestion()">Valider</button>`;
            html += `<button class="btn btn-secondary" onclick="EleveEntrainement.resetCurrentQuestion()" style="margin-left: 8px;">Changer de réponse</button>`;
        }

        return html;
    },

    renderVraiFauxStepSummaryButtons() {
        const step = this.steps[this.currentStepIndex];
        if (this.currentStepIndex < this.steps.length - 1) {
            return `
                <button class="btn btn-secondary" onclick="EleveEntrainement.restartCurrentStep()">Recommencer cette étape</button>
                <button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Étape suivante</button>
            `;
        } else {
            return `
                <button class="btn btn-secondary" onclick="EleveEntrainement.restartCurrentStep()">Recommencer cette étape</button>
                <button class="btn btn-success" onclick="EleveEntrainement.finishTraining()">Terminer l'entraînement</button>
            `;
        }
    },

    selectVraiFaux(questionId, value) {
        const questionResult = this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`];
        if (questionResult?.verified) return;

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][questionId] = value;
        this.renderCurrentStep();
    },

    verifyVraiFaux() {
        const step = this.steps[this.currentStepIndex];
        const questions = step.questions || [{ id: 'q1', correctAnswer: step.correctAnswer }];
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        // Cette fonction n'est plus utilisée pour la vérification question par question
        // Elle pourrait être utilisée dans le mode correction si nécessaire
    },

    // ========== FORMAT QCM MULTIPLE ==========
    renderQCMMultiple(step) {
        const container = document.getElementById('exerciseContainer');
        const isVerified = this.results[this.currentStepIndex]?.verified;

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { selections: {} };
        }

        const stepAnswers = this.answers[this.currentStepIndex];

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon qcm-multiple">${this.getFormatIcon('qcm_multiple')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Plusieurs réponses possibles'}</p>
                    </div>
                    <span class="exercise-badge">${step.questions?.length || 1} question(s)</span>
                </div>

                <div class="exercise-body">
                    <div class="qcm-questions-list">
                        ${(step.questions || []).map((q, qIndex) => {
                            const selections = stepAnswers.selections[q.id] || [];
                            const correctIndices = q.correctIndices || [];

                            return `
                                <div class="qcm-item ${isVerified ? 'answered' : ''}" id="qcm-${q.id}">
                                    <div class="qcm-item-header">
                                        <div class="qcm-item-number">${qIndex + 1}</div>
                                        <div class="qcm-item-question">${this.escapeHtml(q.question)}</div>
                                        <span class="qcm-item-hint">Plusieurs réponses possibles</span>
                                    </div>
                                    <div class="qcm-options">
                                        ${q.options.map((option, optIndex) => {
                                            const isSelected = selections.includes(optIndex);
                                            const isCorrectOption = correctIndices.includes(optIndex);
                                            let optionClass = isSelected ? 'selected' : '';

                                            if (isVerified) {
                                                optionClass += ' disabled';
                                                if (isCorrectOption) optionClass += ' correct';
                                                else if (isSelected) optionClass += ' incorrect';
                                            }

                                            return `
                                                <div class="qcm-option checkbox ${optionClass}"
                                                     onclick="EleveEntrainement.toggleQCMMultiple('${q.id}', ${optIndex})">
                                                    <div class="qcm-checkbox">
                                                        ${isSelected ? '✓' : ''}
                                                    </div>
                                                    <span class="qcm-option-text">${this.escapeHtml(option)}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                    ${isVerified && q.explanation ? `
                                        <div class="qcm-item-feedback show">
                                            <div class="qcm-item-feedback-text">${this.escapeHtml(q.explanation)}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    toggleQCMMultiple(questionId, optionIndex) {
        if (this.results[this.currentStepIndex]?.verified) return;

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { selections: {} };
        }
        if (!this.answers[this.currentStepIndex].selections[questionId]) {
            this.answers[this.currentStepIndex].selections[questionId] = [];
        }

        const selections = this.answers[this.currentStepIndex].selections[questionId];
        const index = selections.indexOf(optionIndex);

        if (index === -1) {
            selections.push(optionIndex);
        } else {
            selections.splice(index, 1);
        }

        this.renderCurrentStep();
    },

    verifyQCMMultiple() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || { selections: {} };

        let correct = 0;
        const questions = step.questions || [];

        questions.forEach(q => {
            const selections = stepAnswers.selections[q.id] || [];
            const correctIndices = q.correctIndices || [];

            // Vérifier si les sélections correspondent exactement
            const isCorrect = selections.length === correctIndices.length &&
                              selections.every(s => correctIndices.includes(s));

            if (isCorrect) correct++;
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: questions.length,
            score: Math.round((correct / questions.length) * 100)
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT TROUS (Texte à trous) ==========
    renderTrous(step) {
        const container = document.getElementById('exerciseContainer');
        const isVerified = this.results[this.currentStepIndex]?.verified;
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        // Parser le texte avec les trous {0}, {1}, etc.
        let texteHtml = this.escapeHtml(step.texte || step.titre);
        const trous = step.trous || [];

        trous.forEach((trou, index) => {
            const userAnswer = stepAnswers[`trou_${index}`] || '';
            const isCorrect = isVerified && this.normalizeText(userAnswer) === this.normalizeText(trou.reponse);

            const inputHtml = `
                <span class="trou-wrapper ${isVerified ? (isCorrect ? 'correct' : 'incorrect') : ''}">
                    <input type="text"
                           class="trou-input"
                           id="trou_${index}"
                           value="${this.escapeHtml(userAnswer)}"
                           placeholder="${trou.indice || '...'}"
                           ${isVerified ? 'disabled' : ''}
                           onchange="EleveEntrainement.updateTrou(${index}, this.value)">
                    ${isVerified && !isCorrect ? `<span class="trou-correction">${this.escapeHtml(trou.reponse)}</span>` : ''}
                </span>
            `;

            texteHtml = texteHtml.replace(`{${index}}`, inputHtml);
        });

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon trous">${this.getFormatIcon('trous')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre || 'Complétez le texte'}</h2>
                        <p>${step.description || 'Remplissez les espaces vides'}</p>
                    </div>
                    <span class="exercise-badge">${trous.length} trou(s)</span>
                </div>

                <div class="exercise-body">
                    <div class="trous-texte">
                        ${texteHtml}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    updateTrou(index, value) {
        if (this.results[this.currentStepIndex]?.verified) return;

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][`trou_${index}`] = value;
    },

    verifyTrous() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const trous = step.trous || [];

        let correct = 0;
        trous.forEach((trou, index) => {
            const userAnswer = stepAnswers[`trou_${index}`] || '';
            if (this.normalizeText(userAnswer) === this.normalizeText(trou.reponse)) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: trous.length,
            score: Math.round((correct / trous.length) * 100)
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT ASSOCIATION ==========
    renderAssociation(step) {
        const container = document.getElementById('exerciseContainer');
        const isVerified = this.results[this.currentStepIndex]?.verified;

        if (!this.answers[this.currentStepIndex]) {
            // Mélanger les éléments de droite
            const rightItems = step.paires.map((p, i) => ({ text: p.droite, originalIndex: i }));
            this.answers[this.currentStepIndex] = {
                shuffledRight: this.shuffleArray(rightItems),
                connections: {}
            };
        }

        const stepAnswers = this.answers[this.currentStepIndex];
        const paires = step.paires || [];

        // Si vérifié, afficher le rendu de correction avec paires
        if (isVerified) {
            container.innerHTML = `
                <div class="exercise-card">
                    <div class="exercise-header">
                        <div class="exercise-icon association">${this.getFormatIcon('association')}</div>
                        <div class="exercise-info">
                            <h2>${step.titre}</h2>
                            <p>${step.description || 'Reliez les éléments correspondants'}</p>
                        </div>
                        <span class="exercise-badge">${paires.length} paires</span>
                    </div>

                    <div class="exercise-body">
                        ${this.renderAssociationCorrection(step, stepAnswers, paires)}

                        <div class="exercise-actions">
                            ${this.renderNavigationButtons()}
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Rendu normal en mode test
        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon association">${this.getFormatIcon('association')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Reliez les éléments correspondants'}</p>
                    </div>
                    <span class="exercise-badge">${paires.length} paires</span>
                </div>

                <div class="exercise-body">
                    <div class="association-instruction">
                        <span class="association-instruction-icon">💡</span>
                        <span>Cliquez sur un élément à gauche puis sur son correspondant à droite</span>
                    </div>

                    <div class="association-container">
                        <div class="association-column association-left">
                            ${paires.map((p, index) => {
                                const isConnected = stepAnswers.connections[index] !== undefined;
                                const isCorrect = stepAnswers.connections[index] === index;
                                const isActive = stepAnswers.activeLeft === index;

                                return `
                                    <div class="association-item ${isActive ? 'active' : ''} ${isConnected ? 'connected' : ''}"
                                         data-index="${index}"
                                         onclick="EleveEntrainement.selectAssociationLeft(${index})">
                                        ${this.escapeHtml(p.gauche)}
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <div class="association-column association-right">
                            ${stepAnswers.shuffledRight.map((item, displayIndex) => {
                                const isConnected = Object.values(stepAnswers.connections).includes(item.originalIndex);

                                return `
                                    <div class="association-item ${isConnected ? 'connected' : ''}"
                                         data-original="${item.originalIndex}"
                                         onclick="EleveEntrainement.selectAssociationRight(${item.originalIndex})">
                                        ${this.escapeHtml(item.text)}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-secondary" onclick="EleveEntrainement.resetAssociations()">Réinitialiser</button>
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderAssociationCorrection(step, stepAnswers, paires) {
        // Afficher les réponses élèves et les bonnes réponses en paires
        const userAnswersHtml = paires.map((p, index) => {
            const connectedIndex = stepAnswers.connections[index];
            const isCorrect = connectedIndex === index;
            const connectedText = connectedIndex !== undefined ? paires[connectedIndex].droite : '(non répondu)';

            return `
                <div class="association-pair ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="association-pair-left">${this.escapeHtml(p.gauche)}</div>
                    <div class="association-pair-arrow">→</div>
                    <div class="association-pair-right">${this.escapeHtml(connectedText)}</div>
                </div>
            `;
        }).join('');

        const correctAnswersHtml = paires.map((p, index) => {
            return `
                <div class="association-pair correct">
                    <div class="association-pair-left">${this.escapeHtml(p.gauche)}</div>
                    <div class="association-pair-arrow">→</div>
                    <div class="association-pair-right">${this.escapeHtml(p.droite)}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="association-correction-container">
                <div class="association-correction-section">
                    <h3 class="association-correction-title user-answer">Ta réponse :</h3>
                    <div class="association-pairs-list">
                        ${userAnswersHtml}
                    </div>
                </div>

                <div class="association-correction-section">
                    <h3 class="association-correction-title correct-answer">Réponse correcte :</h3>
                    <div class="association-pairs-list">
                        ${correctAnswersHtml}
                    </div>
                </div>
            </div>
        `;
    },

    selectAssociationLeft(index) {
        if (this.results[this.currentStepIndex]?.verified) return;

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { shuffledRight: [], connections: {} };
        }

        this.answers[this.currentStepIndex].activeLeft = index;
        this.renderCurrentStep();
    },

    selectAssociationRight(originalIndex) {
        if (this.results[this.currentStepIndex]?.verified) return;

        const stepAnswers = this.answers[this.currentStepIndex];
        if (stepAnswers.activeLeft === undefined) return;

        // Supprimer les anciennes connexions vers cet élément de droite
        Object.keys(stepAnswers.connections).forEach(key => {
            if (stepAnswers.connections[key] === originalIndex) {
                delete stepAnswers.connections[key];
            }
        });

        // Créer la nouvelle connexion
        stepAnswers.connections[stepAnswers.activeLeft] = originalIndex;
        delete stepAnswers.activeLeft;

        this.renderCurrentStep();
    },

    resetAssociations() {
        if (this.results[this.currentStepIndex]?.verified) return;

        if (this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex].connections = {};
            delete this.answers[this.currentStepIndex].activeLeft;
        }
        this.renderCurrentStep();
    },

    verifyAssociation() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || { connections: {} };
        const paires = step.paires || [];

        let correct = 0;
        paires.forEach((_, index) => {
            if (stepAnswers.connections[index] === index) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: paires.length,
            score: Math.round((correct / paires.length) * 100)
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT ORDONNER ==========
    renderOrdonner(step) {
        const container = document.getElementById('exerciseContainer');
        const isVerified = this.results[this.currentStepIndex]?.verified;

        // Utiliser events (ancien format) ou elements (nouveau format)
        const elements = step.elements || step.events?.map(e => e.titre || e.description) || [];
        const ordreCorrect = step.ordre_correct || step.events?.map((_, i) => i) || elements.map((_, i) => i);

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {
                order: this.shuffleArray([...elements.map((_, i) => i)])
            };
        }

        const currentOrder = this.answers[this.currentStepIndex].order;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon ordonner">${this.getFormatIcon('ordonner')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Remettez les éléments dans le bon ordre'}</p>
                    </div>
                    <span class="exercise-badge">${elements.length} éléments</span>
                </div>

                <div class="exercise-body">
                    <div class="ordonner-instruction">
                        <span class="ordonner-instruction-icon">💡</span>
                        <span>Utilisez les flèches pour réorganiser les éléments</span>
                    </div>

                    <div class="ordonner-container ${isVerified ? 'verified' : ''}" id="ordonnerContainer">
                        ${currentOrder.map((elementIndex, position) => {
                            const element = elements[elementIndex];
                            const correctPosition = ordreCorrect.indexOf(elementIndex);
                            const isCorrectPosition = isVerified && position === correctPosition;

                            return `
                                <div class="ordonner-item ${isVerified ? (isCorrectPosition ? 'correct' : 'incorrect') : ''}"
                                     data-index="${elementIndex}">
                                    <span class="ordonner-position">${position + 1}</span>
                                    <span class="ordonner-text">${this.escapeHtml(typeof element === 'object' ? element.titre || element.text : element)}</span>
                                    ${!isVerified ? `
                                        <div class="ordonner-controls">
                                            <button class="ordonner-btn" onclick="EleveEntrainement.moveOrdonner(${position}, -1)" ${position === 0 ? 'disabled' : ''}>▲</button>
                                            <button class="ordonner-btn" onclick="EleveEntrainement.moveOrdonner(${position}, 1)" ${position === currentOrder.length - 1 ? 'disabled' : ''}>▼</button>
                                        </div>
                                    ` : `
                                        <span class="ordonner-status">${isCorrectPosition ? '✓' : `→ ${correctPosition + 1}`}</span>
                                    `}
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;

        // Setup drag and drop si non vérifié
        if (!isVerified) {
            this.setupOrdonnerDragDrop();
        }
    },

    moveOrdonner(position, direction) {
        if (this.results[this.currentStepIndex]?.verified) return;

        const order = this.answers[this.currentStepIndex].order;
        const newPosition = position + direction;

        if (newPosition < 0 || newPosition >= order.length) return;

        // Échanger les positions
        [order[position], order[newPosition]] = [order[newPosition], order[position]];

        this.renderCurrentStep();
    },

    setupOrdonnerDragDrop() {
        const container = document.getElementById('ordonnerContainer');
        if (!container) return;

        const items = container.querySelectorAll('.ordonner-item');
        let draggedItem = null;

        items.forEach(item => {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');

                if (draggedItem && draggedItem !== item) {
                    const order = this.answers[this.currentStepIndex].order;
                    const fromIndex = Array.from(container.children).indexOf(draggedItem);
                    const toIndex = Array.from(container.children).indexOf(item);

                    // Réorganiser
                    const [moved] = order.splice(fromIndex, 1);
                    order.splice(toIndex, 0, moved);

                    this.renderCurrentStep();
                }
            });
        });
    },

    verifyOrdonner() {
        const step = this.steps[this.currentStepIndex];
        const currentOrder = this.answers[this.currentStepIndex]?.order || [];

        const elements = step.elements || step.events?.map(e => e.titre || e.description) || [];
        const ordreCorrect = step.ordre_correct || step.events?.map((_, i) => i) || elements.map((_, i) => i);

        let correct = 0;
        currentOrder.forEach((elementIndex, position) => {
            if (ordreCorrect[position] === elementIndex) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: elements.length,
            score: Math.round((correct / elements.length) * 100)
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT TIMELINE ==========
    renderTimeline(step) {
        const container = document.getElementById('exerciseContainer');
        const isVerified = this.results[this.currentStepIndex]?.verified;

        // Initialiser l'ordre si pas encore fait
        if (!this.answers[this.currentStepIndex]) {
            // Mélanger les événements pour l'exercice
            this.answers[this.currentStepIndex] = {
                order: this.shuffleArray([...step.events.map((_, i) => i)])
            };
        }

        const currentOrder = this.answers[this.currentStepIndex].order;
        const orderedEvents = currentOrder.map(i => ({ ...step.events[i], originalIndex: i }));

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon timeline">${this.getFormatIcon('timeline')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.events.length} événements</span>
                </div>

                <div class="exercise-body">
                    <div class="timeline-instruction">
                        <span class="timeline-instruction-icon">💡</span>
                        <span>Glissez-déposez les événements pour les remettre dans l'ordre chronologique</span>
                    </div>

                    <div class="timeline-container ${isVerified ? 'verified' : ''}" id="timelineContainer">
                        ${orderedEvents.map((event, index) => this.renderTimelineEvent(event, index, isVerified, step.events)).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;

        // Setup drag & drop (seulement si pas en mode correction)
        if (!this.correctionMode) {
            this.setupTimelineDragDrop();
        }
    },

    renderTimelineEvent(event, displayIndex, isVerified, allEvents) {
        const correctIndex = allEvents.findIndex(e => e.date === event.date && e.titre === event.titre);
        const isCorrectPosition = isVerified && this.isTimelinePositionCorrect(displayIndex, event.originalIndex, allEvents);

        let statusClass = '';
        if (isVerified) {
            statusClass = isCorrectPosition ? 'correct' : 'incorrect';
        }

        return `
            <div class="timeline-event ${statusClass}"
                 data-index="${displayIndex}"
                 data-original="${event.originalIndex}"
                 draggable="${!isVerified}">
                <div class="timeline-event-handle">
                    ${isVerified ? (isCorrectPosition ? '✓' : '✗') : '⋮⋮'}
                </div>
                <div class="timeline-event-content">
                    ${isVerified ? `<div class="timeline-event-date">${this.escapeHtml(event.date)}</div>` : ''}
                    <div class="timeline-event-titre">${this.escapeHtml(event.titre)}</div>
                    ${event.description ? `<div class="timeline-event-desc">${this.escapeHtml(event.description)}</div>` : ''}
                </div>
                ${isVerified && !isCorrectPosition ? `
                    <div class="timeline-event-correction">
                        Position correcte : ${this.getCorrectPositionLabel(event.originalIndex, allEvents)}
                    </div>
                ` : ''}
            </div>
        `;
    },

    isTimelinePositionCorrect(displayIndex, originalIndex, allEvents) {
        // Trier les événements par date pour obtenir l'ordre correct
        const sortedByDate = [...allEvents].map((e, i) => ({ ...e, origIdx: i }))
            .sort((a, b) => this.compareDates(a.date, b.date));

        // La position correcte de cet événement
        const correctPosition = sortedByDate.findIndex(e => e.origIdx === originalIndex);
        return displayIndex === correctPosition;
    },

    getCorrectPositionLabel(originalIndex, allEvents) {
        const sortedByDate = [...allEvents].map((e, i) => ({ ...e, origIdx: i }))
            .sort((a, b) => this.compareDates(a.date, b.date));

        const correctPosition = sortedByDate.findIndex(e => e.origIdx === originalIndex);
        return `#${correctPosition + 1}`;
    },

    compareDates(dateA, dateB) {
        // Extraire l'année pour comparaison simple
        const yearA = parseInt(dateA.match(/-?\d+/)?.[0] || 0);
        const yearB = parseInt(dateB.match(/-?\d+/)?.[0] || 0);
        return yearA - yearB;
    },

    setupTimelineDragDrop() {
        const container = document.getElementById('timelineContainer');
        if (!container) return;

        const events = container.querySelectorAll('.timeline-event');
        let draggedEl = null;

        events.forEach(event => {
            event.addEventListener('dragstart', (e) => {
                draggedEl = event;
                event.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            event.addEventListener('dragend', () => {
                if (draggedEl) {
                    draggedEl.classList.remove('dragging');
                    draggedEl = null;
                }
                events.forEach(el => el.classList.remove('drag-over'));
            });

            event.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            event.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (event !== draggedEl) {
                    event.classList.add('drag-over');
                }
            });

            event.addEventListener('dragleave', () => {
                event.classList.remove('drag-over');
            });

            event.addEventListener('drop', (e) => {
                e.preventDefault();
                event.classList.remove('drag-over');

                if (draggedEl && draggedEl !== event) {
                    const allEvents = [...container.querySelectorAll('.timeline-event')];
                    const fromIndex = allEvents.indexOf(draggedEl);
                    const toIndex = allEvents.indexOf(event);

                    // Réorganiser dans le DOM
                    if (fromIndex < toIndex) {
                        event.after(draggedEl);
                    } else {
                        event.before(draggedEl);
                    }

                    // Mettre à jour l'ordre dans answers
                    this.updateTimelineOrder();
                }
            });
        });
    },

    updateTimelineOrder() {
        const container = document.getElementById('timelineContainer');
        const events = container.querySelectorAll('.timeline-event');

        const newOrder = [...events].map(el => parseInt(el.dataset.original));
        this.answers[this.currentStepIndex] = { order: newOrder };
    },

    verifyTimeline() {
        const step = this.steps[this.currentStepIndex];
        const currentOrder = this.answers[this.currentStepIndex]?.order || [];

        // Calculer l'ordre correct (trié par date)
        const sortedByDate = [...step.events].map((e, i) => ({ ...e, origIdx: i }))
            .sort((a, b) => this.compareDates(a.date, b.date));
        const correctOrder = sortedByDate.map(e => e.origIdx);

        // Compter les positions correctes
        let correct = 0;
        currentOrder.forEach((origIdx, displayIdx) => {
            if (correctOrder[displayIdx] === origIdx) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: step.events.length,
            score: Math.round((correct / step.events.length) * 100)
        };

        this.renderCurrentStep();
    },

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    // ========== FORMAT CHRONOLOGIE ==========
    renderChronologie(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const isVerified = this.results[this.currentStepIndex]?.verified;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon chronologie">${this.getFormatIcon('chronologie')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.items.length} éléments</span>
                </div>

                <div class="exercise-body">
                    <div class="chronologie-instruction">
                        <span class="chronologie-instruction-icon">💡</span>
                        <span>Complétez les dates ou événements manquants dans la frise</span>
                    </div>

                    <div class="chronologie-frise">
                        ${step.items.map((item, index) => this.renderChronologieItem(item, index, stepAnswers, isVerified)).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderChronologieItem(item, index, stepAnswers, isVerified) {
        const answer = stepAnswers[`item_${index}`] || '';
        const isBlank = item.blank === 'date' || item.blank === 'event';
        const correctAnswer = item.blank === 'date' ? item.date : item.event;
        const isCorrect = isVerified && this.normalizeAnswer(answer) === this.normalizeAnswer(correctAnswer);

        let statusClass = '';
        if (isVerified && isBlank) {
            statusClass = isCorrect ? 'correct' : 'incorrect';
        }

        return `
            <div class="chronologie-item ${statusClass}">
                <div class="chronologie-item-line"></div>
                <div class="chronologie-item-dot"></div>
                <div class="chronologie-item-content">
                    <div class="chronologie-item-date">
                        ${item.blank === 'date' ? `
                            <input type="text"
                                   class="chronologie-input ${statusClass}"
                                   placeholder="Date ?"
                                   value="${this.escapeHtml(answer)}"
                                   ${isVerified ? 'disabled' : ''}
                                   onchange="EleveEntrainement.setChronologieAnswer(${index}, this.value)">
                            ${isVerified ? `<span class="chronologie-correction">${this.escapeHtml(item.date)}</span>` : ''}
                        ` : `
                            <span class="chronologie-date-fixed">${this.escapeHtml(item.date)}</span>
                        `}
                    </div>
                    <div class="chronologie-item-event">
                        ${item.blank === 'event' ? `
                            <input type="text"
                                   class="chronologie-input event ${statusClass}"
                                   placeholder="Événement ?"
                                   value="${this.escapeHtml(answer)}"
                                   ${isVerified ? 'disabled' : ''}
                                   onchange="EleveEntrainement.setChronologieAnswer(${index}, this.value)">
                            ${isVerified ? `<span class="chronologie-correction">${this.escapeHtml(item.event)}</span>` : ''}
                        ` : `
                            <span class="chronologie-event-fixed">${this.escapeHtml(item.event)}</span>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    setChronologieAnswer(index, value) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][`item_${index}`] = value;
    },

    normalizeAnswer(text) {
        if (!text) return '';
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
            .trim();
    },

    verifyChronologie() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        let correct = 0;
        let total = 0;

        step.items.forEach((item, index) => {
            if (item.blank === 'date' || item.blank === 'event') {
                total++;
                const answer = stepAnswers[`item_${index}`] || '';
                const correctAnswer = item.blank === 'date' ? item.date : item.event;

                if (this.normalizeAnswer(answer) === this.normalizeAnswer(correctAnswer)) {
                    correct++;
                }
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total,
            score: total > 0 ? Math.round((correct / total) * 100) : 100
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT QUESTION OUVERTE ==========
    renderQuestionOuverte(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const isVerified = this.results[this.currentStepIndex]?.verified;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon question-ouverte">${this.getFormatIcon('question-ouverte')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.questions.length} question${step.questions.length > 1 ? 's' : ''}</span>
                </div>

                <div class="exercise-body">
                    <div class="question-ouverte-list">
                        ${step.questions.map((q, index) => this.renderQuestionOuverteItem(q, index, stepAnswers, isVerified)).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderQuestionOuverteItem(question, index, stepAnswers, isVerified) {
        const answer = stepAnswers[question.id] || '';
        const keywordsFound = isVerified ? this.checkKeywords(answer, question.keywords || []) : [];
        const hasAnswer = answer.trim().length > 0;

        return `
            <div class="question-ouverte-item ${isVerified ? 'verified' : ''}">
                <div class="question-ouverte-header">
                    <div class="question-ouverte-number">${index + 1}</div>
                    <div class="question-ouverte-text">${this.escapeHtml(question.question)}</div>
                </div>

                <div class="question-ouverte-answer">
                    <textarea
                        class="question-ouverte-textarea"
                        placeholder="Écrivez votre réponse ici..."
                        ${isVerified ? 'disabled' : ''}
                        onchange="EleveEntrainement.setQuestionOuverteAnswer('${question.id}', this.value)"
                        oninput="EleveEntrainement.setQuestionOuverteAnswer('${question.id}', this.value)"
                    >${this.escapeHtml(answer)}</textarea>

                    ${!isVerified && question.keywords ? `
                        <div class="question-ouverte-hint">
                            <span>💡</span> Mots-clés attendus : ${question.keywords.length}
                        </div>
                    ` : ''}
                </div>

                ${isVerified ? `
                    <div class="question-ouverte-feedback">
                        ${question.keywords && question.keywords.length > 0 ? `
                            <div class="question-ouverte-keywords">
                                <div class="question-ouverte-keywords-title">Mots-clés attendus :</div>
                                <div class="question-ouverte-keywords-list">
                                    ${(() => {
                                        const kw = question.keywords[0];
                                        const found = keywordsFound.includes(kw.toLowerCase());
                                        return `<span class="keyword-tag ${found ? 'found' : 'missing'}">${found ? '✓' : '✗'} ${this.escapeHtml(kw)}</span>`;
                                    })()}
                                </div>
                            </div>
                        ` : ''}

                        ${question.correction ? `
                            <div class="question-ouverte-correction">
                                <div class="question-ouverte-correction-title">Réponse attendue :</div>
                                <div class="question-ouverte-correction-text">${this.escapeHtml(question.correction)}</div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    },

    setQuestionOuverteAnswer(questionId, value) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][questionId] = value;
    },

    checkKeywords(answer, keywords) {
        const normalizedAnswer = this.normalizeAnswer(answer);
        return keywords.filter(kw => {
            const normalizedKw = this.normalizeAnswer(kw);
            return normalizedAnswer.includes(normalizedKw);
        }).map(kw => kw.toLowerCase());
    },

    verifyQuestionOuverte() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        let totalKeywords = 0;
        let foundKeywords = 0;

        step.questions.forEach(q => {
            if (q.keywords && q.keywords.length > 0) {
                totalKeywords += q.keywords.length;
                const answer = stepAnswers[q.id] || '';
                foundKeywords += this.checkKeywords(answer, q.keywords).length;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct: foundKeywords,
            total: totalKeywords,
            score: totalKeywords > 0 ? Math.round((foundKeywords / totalKeywords) * 100) : 100
        };

        this.renderCurrentStep();
    },

    // ========== FORMAT IMAGE CLIQUABLE ==========
    renderImageCliquable(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const isVerified = this.results[this.currentStepIndex]?.verified || this.correctionMode;
        const currentQuestionIndex = stepAnswers.currentQuestion || 0;
        const allQuestionsAnswered = currentQuestionIndex >= step.questions.length || isVerified;
        const currentQuestion = step.questions[currentQuestionIndex];

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon image-cliquable">${this.getFormatIcon('image-cliquable')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.questions.length} zones</span>
                </div>

                <div class="exercise-body">
                    ${!allQuestionsAnswered ? `
                        <div class="image-cliquable-progress">
                            <span>Question ${currentQuestionIndex + 1}/${step.questions.length}</span>
                            <div class="image-cliquable-progress-bar">
                                <div class="image-cliquable-progress-fill" style="width: ${(currentQuestionIndex / step.questions.length) * 100}%"></div>
                            </div>
                        </div>

                        <div class="image-cliquable-question">
                            <div class="image-cliquable-question-icon">Cible</div>
                            <div class="image-cliquable-question-text">${this.escapeHtml(currentQuestion.question)}</div>
                        </div>
                    ` : ''}

                    <div class="image-cliquable-container ${isVerified ? 'verified' : ''}">
                        ${step.imageUrl ? `
                            <img src="${step.imageUrl}" alt="${step.titre}" class="image-cliquable-img" id="clickableImage"
                                 onerror="this.onerror=null; this.src='https://placehold.co/1200x600/f0f0f0/666666?text=Image+non+disponible';">
                        ` : `
                            <div style="display: flex; align-items: center; justify-content: center; height: 300px; background: var(--gray-100); color: var(--gray-400);">
                                <span>Aucune image disponible</span>
                            </div>
                        `}
                        <div class="image-cliquable-zones" id="clickableZones">
                            ${step.zones.map((zone, zIndex) => this.renderImageZone(zone, zIndex, stepAnswers, isVerified, step.questions)).join('')}
                        </div>
                    </div>

                    ${isVerified ? this.renderImageCliquableResults(step, stepAnswers) : ''}

                    <div class="exercise-actions">
                        ${allQuestionsAnswered ? this.renderNavigationButtons() : ''}
                    </div>
                </div>
            </div>
        `;

        // Setup click handlers
        if (!allQuestionsAnswered && !this.correctionMode) {
            this.setupImageClickHandlers(step, currentQuestionIndex);
        } else if (isVerified && this.correctionMode) {
            // In correction mode, setup popup handlers
            setTimeout(() => this.setupImageClickHandlers(step, currentQuestionIndex), 0);
        }
    },

    renderImageCliquableResults(step, stepAnswers) {
        const resultsHtml = step.questions.map((q, qIndex) => {
            const userAnswer = stepAnswers[`q_${qIndex}`];
            const isCorrect = userAnswer === q.correctZoneId;
            const answerText = !isCorrect ? `<span class="image-cliquable-result-answer">Reponse : ${this.getZoneName(step.zones, q.correctZoneId)}</span>` : '';

            return `
                <div class="image-cliquable-result-item ${isCorrect ? 'correct' : 'incorrect'}">
                    <span class="image-cliquable-result-icon">${isCorrect ? 'V' : 'X'}</span>
                    <span class="image-cliquable-result-text">${this.escapeHtml(q.question)}</span>
                    ${answerText}
                </div>
            `;
        }).join('');

        return `
            <div class="image-cliquable-results">
                <h3>Resultats</h3>
                <div class="image-cliquable-results-list">
                    ${resultsHtml}
                </div>
            </div>
        `;
    },

    renderImageZone(zone, index, stepAnswers, isVerified, questions) {
        // Trouver si cette zone était la bonne réponse pour une question
        let zoneStatus = '';
        let zoneIcon = '';

        if (isVerified) {
            questions.forEach((q, qIndex) => {
                const userAnswer = stepAnswers[`q_${qIndex}`];
                if (q.correctZoneId === zone.id) {
                    zoneStatus = userAnswer === zone.id ? 'correct' : 'show-correct';
                    zoneIcon = '✓';
                } else if (userAnswer === zone.id) {
                    zoneStatus = 'incorrect';
                    zoneIcon = '✗';
                }
            });
        }

        return `
            <div class="image-cliquable-zone ${zoneStatus}"
                 data-zone-id="${zone.id}"
                 style="left: ${zone.x}%; top: ${zone.y}%; width: ${zone.width}%; height: ${zone.height}%;"
                 title="${this.escapeHtml(zone.label)}">
                ${isVerified && zoneIcon ? `<span class="zone-icon">${zoneIcon}</span>` : ''}
            </div>
        `;
    },

    getZoneName(zones, zoneId) {
        const zone = zones.find(z => z.id === zoneId);
        return zone ? zone.label : 'Inconnu';
    },

    setupImageClickHandlers(step, currentQuestionIndex) {
        const zones = document.querySelectorAll('.image-cliquable-zone');
        const currentQuestion = step.questions[currentQuestionIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const isVerified = this.results[this.currentStepIndex]?.verified || this.correctionMode;

        zones.forEach(zone => {
            zone.addEventListener('click', () => {
                const zoneId = zone.dataset.zoneId;

                if (isVerified && this.correctionMode) {
                    // Mode correction: afficher le popup
                    this.showImageZonePopup(zoneId, step, stepAnswers);
                } else {
                    // Mode normal: gérer le clic
                    this.handleZoneClick(zoneId, currentQuestionIndex, step);
                }
            });
        });
    },

    handleZoneClick(zoneId, questionIndex, step) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { currentQuestion: 0 };
        }

        // Enregistrer la réponse
        this.answers[this.currentStepIndex][`q_${questionIndex}`] = zoneId;

        // Feedback visuel rapide
        const clickedZone = document.querySelector(`[data-zone-id="${zoneId}"]`);
        const isCorrect = step.questions[questionIndex].correctZoneId === zoneId;

        clickedZone.classList.add(isCorrect ? 'flash-correct' : 'flash-incorrect');

        // Passer à la question suivante après un délai
        setTimeout(() => {
            this.answers[this.currentStepIndex].currentQuestion = questionIndex + 1;
            this.renderCurrentStep();
        }, 600);
    },

    showImageZonePopup(zoneId, step, stepAnswers) {
        // Trouver la zone
        const zone = step.zones.find(z => z.id === zoneId);
        if (!zone) return;

        // Trouver quelle question cette zone concerne
        let questionInfo = null;
        let userAnswer = null;
        let isCorrect = false;

        for (let i = 0; i < step.questions.length; i++) {
            const q = step.questions[i];
            const answer = stepAnswers[`q_${i}`];

            if (q.correctZoneId === zoneId || answer === zoneId) {
                questionInfo = q;
                userAnswer = answer;
                isCorrect = answer === q.correctZoneId;
                break;
            }
        }

        if (!questionInfo) return;

        // Créer le popup
        const popupContent = `
            <div class="image-zone-popup">
                <div class="popup-close" onclick="this.parentElement.parentElement.style.display='none'">✕</div>
                <div class="popup-question">${this.escapeHtml(questionInfo.question)}</div>

                <div class="popup-section ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="popup-label">Ta réponse :</div>
                    <div class="popup-zone-name">${isCorrect ? '✓' : '✗'} ${this.escapeHtml(zone.label)}</div>
                </div>

                ${!isCorrect ? `
                    <div class="popup-section correct">
                        <div class="popup-label">Réponse correcte :</div>
                        <div class="popup-zone-name">✓ ${this.escapeHtml(this.getZoneName(step.zones, questionInfo.correctZoneId))}</div>
                    </div>
                ` : ''}
            </div>
        `;

        // Créer l'overlay du popup
        let popupOverlay = document.getElementById('imageZonePopupOverlay');
        if (!popupOverlay) {
            popupOverlay = document.createElement('div');
            popupOverlay.id = 'imageZonePopupOverlay';
            popupOverlay.className = 'image-zone-popup-overlay';
            popupOverlay.onclick = (e) => {
                if (e.target === popupOverlay) {
                    popupOverlay.style.display = 'none';
                }
            };
            document.body.appendChild(popupOverlay);
        }

        popupOverlay.innerHTML = popupContent;
        popupOverlay.style.display = 'flex';
    },

    verifyImageCliquable() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        let correct = 0;
        step.questions.forEach((q, qIndex) => {
            if (stepAnswers[`q_${qIndex}`] === q.correctZoneId) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: step.questions.length,
            score: Math.round((correct / step.questions.length) * 100)
        };

        this.renderCurrentStep();
    },

});
