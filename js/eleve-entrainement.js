/**
 * Moteur d'Entraînement Élève
 * Gère les différents formats d'exercices
 */

const EleveEntrainement = {
    // État
    training: null,
    steps: [],
    currentStepIndex: 0,
    answers: {},
    results: {},
    startTime: null,
    timerInterval: null,

    // Configuration des formats d'exercices
    formats: {
        qcm: {
            icon: '📝',
            label: 'QCM',
            render: 'renderQCM',
            verify: 'verifyQCM'
        },
        timeline: {
            icon: '📅',
            label: 'Timeline',
            render: 'renderTimeline',
            verify: 'verifyTimeline'
        },
        chronologie: {
            icon: '🗓️',
            label: 'Chronologie',
            render: 'renderChronologie',
            verify: 'verifyChronologie'
        },
        'question-ouverte': {
            icon: '✍️',
            label: 'Question ouverte',
            render: 'renderQuestionOuverte',
            verify: 'verifyQuestionOuverte'
        },
        'image-cliquable': {
            icon: '🗺️',
            label: 'Image cliquable',
            render: 'renderImageCliquable',
            verify: 'verifyImageCliquable'
        }
    },

    // ========== INITIALISATION ==========
    async init() {
        try {
            // Récupérer l'ID de l'entraînement depuis l'URL
            const params = new URLSearchParams(window.location.search);
            const trainingId = params.get('id');

            if (trainingId && trainingId !== 'test') {
                await this.loadTraining(trainingId);
            } else {
                // Mode test avec données mock
                this.loadMockData();
            }

            this.startTimer();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement de l\'entraînement');
        }
    },

    // ========== CHARGEMENT DONNÉES ==========
    async loadTraining(trainingId) {
        // TODO: Charger depuis Google Sheets
        // Pour l'instant, utiliser les données mock
        this.loadMockData();
    },

    loadMockData() {
        // Données de test pour développement
        this.training = {
            id: 'test_001',
            titre: 'Les explorateurs (Série 1/3)',
            matiere: 'Histoire',
            chapitre: 'L1 - Les explorations portugaises',
            type: 'connaissances' // connaissances, savoir-faire, competences
        };

        // Étapes de l'entraînement (chaque étape = un format d'exercice)
        this.steps = [
            {
                format: 'timeline',
                titre: 'Chronologie des explorations',
                description: 'Remettez les événements dans l\'ordre chronologique',
                events: [
                    {
                        date: '1488',
                        titre: 'Cap de Bonne-Espérance',
                        description: 'Bartolomeu Dias contourne le cap de Bonne-Espérance'
                    },
                    {
                        date: '1492',
                        titre: 'Découverte de l\'Amérique',
                        description: 'Christophe Colomb atteint les Caraïbes'
                    },
                    {
                        date: '1498',
                        titre: 'Route maritime vers l\'Inde',
                        description: 'Vasco de Gama atteint Calicut'
                    },
                    {
                        date: '1500',
                        titre: 'Découverte du Brésil',
                        description: 'Pedro Álvares Cabral accoste au Brésil'
                    },
                    {
                        date: '1519',
                        titre: 'Tour du monde de Magellan',
                        description: 'Début de l\'expédition de Magellan'
                    }
                ]
            },
            {
                format: 'chronologie',
                titre: 'Complétez la frise',
                description: 'Retrouvez les dates ou événements manquants',
                items: [
                    { date: '1488', event: 'Cap de Bonne-Espérance', blank: null },
                    { date: '1492', event: 'Découverte de l\'Amérique', blank: 'date' },
                    { date: '1498', event: 'Arrivée en Inde', blank: 'event' },
                    { date: '1500', event: 'Découverte du Brésil', blank: 'date' },
                    { date: '1519', event: 'Tour du monde', blank: null }
                ]
            },
            {
                format: 'qcm',
                titre: 'Questions à choix unique',
                description: 'Répondez aux questions ci-dessous',
                questions: [
                    {
                        id: 'q1',
                        question: 'Quelle est la date du passage du cap de Bonne-Espérance par Bartolomeu Dias ?',
                        options: ['1492', '1488', '1498', '1500'],
                        correctIndex: 1,
                        explanation: 'Bartolomeu Dias atteint le cap de Bonne-Espérance en 1488, ouvrant la route maritime vers l\'océan Indien.'
                    },
                    {
                        id: 'q2',
                        question: 'Qui a atteint l\'Inde par voie maritime en 1498 ?',
                        options: ['Christophe Colomb', 'Vasco de Gama', 'Magellan', 'Bartolomeu Dias'],
                        correctIndex: 1,
                        explanation: 'Vasco de Gama atteint Calicut (Inde) en 1498, établissant la première route maritime directe entre l\'Europe et l\'Asie.'
                    },
                    {
                        id: 'q3',
                        question: 'La caravelle est...',
                        options: ['Un instrument de navigation', 'Une épice précieuse', 'Un type de navire', 'Un comptoir commercial'],
                        correctIndex: 2,
                        explanation: 'La caravelle est un navire léger et maniable, idéal pour l\'exploration des côtes africaines.'
                    },
                    {
                        id: 'q4',
                        question: 'Quel prince portugais a encouragé les explorations maritimes au XVe siècle ?',
                        options: ['Manuel Ier', 'Henri le Navigateur', 'Jean II', 'Alphonse V'],
                        correctIndex: 1,
                        explanation: 'Henri le Navigateur (1394-1460) a fondé une école de navigation et financé de nombreuses expéditions.'
                    },
                    {
                        id: 'q5',
                        question: 'Quelle épice était la plus recherchée par les Portugais ?',
                        options: ['La cannelle', 'Le safran', 'Le poivre', 'La muscade'],
                        correctIndex: 2,
                        explanation: 'Le poivre était surnommé "l\'or noir" et valait son poids en or à l\'époque.'
                    }
                ]
            },
            {
                format: 'question-ouverte',
                titre: 'Réflexion',
                description: 'Répondez aux questions avec vos propres mots',
                questions: [
                    {
                        id: 'qo1',
                        question: 'Pourquoi les Portugais ont-ils cherché une route maritime vers l\'Inde ?',
                        keywords: ['épices', 'commerce', 'or', 'richesse', 'Ottomans', 'routes terrestres'],
                        correction: 'Les Portugais cherchaient à contourner les routes terrestres contrôlées par les Ottomans pour accéder directement au commerce des épices et autres richesses d\'Asie, réduisant ainsi les intermédiaires et les coûts.'
                    },
                    {
                        id: 'qo2',
                        question: 'Quelles ont été les conséquences des grandes découvertes pour les populations locales ?',
                        keywords: ['colonisation', 'esclavage', 'maladies', 'exploitation', 'culture'],
                        correction: 'Les grandes découvertes ont souvent eu des conséquences dramatiques pour les populations locales : colonisation, exploitation des ressources, esclavage, propagation de maladies européennes, et destruction des cultures traditionnelles.'
                    }
                ]
            }
        ];

        // Initialiser les réponses
        this.answers = {};
        this.results = {};
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('trainingContent').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <span style="font-size: 48px;">😕</span>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="window.history.back()">Retour</button>
            </div>
        `;
    },

    // ========== TIMER ==========
    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    },

    updateTimer() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById('timerValue').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    },

    getElapsedTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ========== RENDU PRINCIPAL ==========
    render() {
        this.renderHeader();
        this.renderProgress();
        this.renderCurrentStep();
    },

    renderHeader() {
        document.getElementById('trainingTitle').textContent =
            `${this.getFormatIcon(this.steps[0]?.format)} ${this.training.titre}`;
        document.getElementById('trainingSubtitle').textContent =
            `${this.training.matiere} • ${this.training.chapitre}`;

        const badge = document.getElementById('typeBadge');
        badge.textContent = this.getTypeLabel(this.training.type);
        badge.className = `type-badge ${this.training.type}`;
    },

    getTypeLabel(type) {
        const labels = {
            connaissances: '✅ Connaissances',
            'savoir-faire': '🔧 Savoir-faire',
            competences: '🎯 Compétences'
        };
        return labels[type] || type;
    },

    getFormatIcon(format) {
        return this.formats[format]?.icon || '📝';
    },

    getFormatLabel(format) {
        return this.formats[format]?.label || format;
    },

    renderProgress() {
        const progressSection = document.getElementById('progressSection');
        const progressSteps = document.getElementById('progressSteps');
        const progressText = document.getElementById('progressText');

        // Masquer si une seule étape
        if (this.steps.length <= 1) {
            progressSection.style.display = 'none';
            return;
        }

        progressSection.style.display = 'block';
        progressText.textContent = `Étape ${this.currentStepIndex + 1}/${this.steps.length}`;

        progressSteps.innerHTML = this.steps.map((step, index) => {
            let stepClass = '';
            if (index < this.currentStepIndex) stepClass = 'completed';
            else if (index === this.currentStepIndex) stepClass = 'current';

            return `
                <div class="progress-step ${stepClass}" onclick="EleveEntrainement.goToStep(${index})">
                    <div class="progress-step-bar">
                        <div class="progress-step-bar-fill"></div>
                    </div>
                    <div class="progress-step-label">
                        <span class="progress-step-icon">${index + 1}</span>
                        ${this.getFormatLabel(step.format)} (${step.questions?.length || 0})
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCurrentStep() {
        const step = this.steps[this.currentStepIndex];
        if (!step) return;

        const format = this.formats[step.format];
        if (format && this[format.render]) {
            this[format.render](step);
        } else {
            this.renderUnsupportedFormat(step);
        }
    },

    renderUnsupportedFormat(step) {
        document.getElementById('exerciseContainer').innerHTML = `
            <div class="exercise-card">
                <div class="exercise-body" style="text-align: center; padding: 60px;">
                    <span style="font-size: 48px;">🚧</span>
                    <h2 style="margin: 16px 0;">Format non supporté</h2>
                    <p style="color: var(--gray-500);">Le format "${step.format}" n'est pas encore implémenté.</p>
                </div>
            </div>
        `;
    },

    // ========== FORMAT QCM ==========
    renderQCM(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const isVerified = this.results[this.currentStepIndex]?.verified;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon qcm">${this.getFormatIcon('qcm')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.questions.length} questions</span>
                </div>

                <div class="exercise-body">
                    <div class="qcm-questions-list">
                        ${step.questions.map((q, qIndex) => this.renderQCMQuestion(q, qIndex, stepAnswers, isVerified)).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${isVerified ? `
                            <button class="btn btn-secondary" onclick="EleveEntrainement.resetStep()">🔄 Recommencer</button>
                            ${this.currentStepIndex < this.steps.length - 1 ? `
                                <button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Étape suivante →</button>
                            ` : `
                                <button class="btn btn-success" onclick="EleveEntrainement.showResults()">🏆 Voir les résultats</button>
                            `}
                        ` : `
                            <button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentStep()">✓ Vérifier mes réponses</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    renderQCMQuestion(question, qIndex, stepAnswers, isVerified) {
        const selectedIndex = stepAnswers[question.id];
        const isAnswered = selectedIndex !== undefined;
        const isCorrect = isVerified && selectedIndex === question.correctIndex;
        const isIncorrect = isVerified && isAnswered && selectedIndex !== question.correctIndex;

        let itemClass = '';
        if (isVerified && isCorrect) itemClass = 'answered';
        else if (isVerified && isIncorrect) itemClass = 'answered incorrect';
        else if (isVerified && !isAnswered) itemClass = 'answered incorrect';

        return `
            <div class="qcm-item ${itemClass}" id="qcm-${question.id}">
                <div class="qcm-item-header">
                    <div class="qcm-item-number">${qIndex + 1}</div>
                    <div class="qcm-item-question">${this.escapeHtml(question.question)}</div>
                    <span class="qcm-item-status">
                        ${isVerified ? (isCorrect ? '✓' : (isAnswered ? '✗' : '⚠️')) : ''}
                    </span>
                </div>
                <div class="qcm-options">
                    ${question.options.map((option, oIndex) => {
                        let optionClass = '';
                        if (selectedIndex === oIndex) optionClass = 'selected';
                        if (isVerified) {
                            optionClass += ' disabled';
                            if (oIndex === question.correctIndex) optionClass += ' correct';
                            else if (selectedIndex === oIndex) optionClass += ' incorrect';
                        }

                        return `
                            <div class="qcm-option ${optionClass}"
                                 onclick="EleveEntrainement.selectQCMOption('${question.id}', ${oIndex})">
                                <div class="qcm-radio">
                                    ${isVerified && oIndex === question.correctIndex ? '✓' :
                                      (isVerified && selectedIndex === oIndex && oIndex !== question.correctIndex ? '✗' :
                                      (selectedIndex === oIndex ? '●' : ''))}
                                </div>
                                <span class="qcm-option-text">${this.escapeHtml(option)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="qcm-item-feedback ${isVerified ? 'show' : ''} ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="qcm-item-feedback-header">
                        ${isCorrect ? '✓ Bonne réponse !' : (isAnswered ? '✗ Mauvaise réponse' : '⚠️ Non répondu')}
                    </div>
                    <div class="qcm-item-feedback-text">${this.escapeHtml(question.explanation || '')}</div>
                </div>
            </div>
        `;
    },

    selectQCMOption(questionId, optionIndex) {
        // Ne pas permettre la sélection si déjà vérifié
        if (this.results[this.currentStepIndex]?.verified) return;

        // Initialiser les réponses pour cette étape si nécessaire
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }

        // Enregistrer la réponse
        this.answers[this.currentStepIndex][questionId] = optionIndex;

        // Re-render la question
        this.renderCurrentStep();
    },

    verifyQCM() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        let correct = 0;
        let total = step.questions.length;

        step.questions.forEach(q => {
            if (stepAnswers[q.id] === q.correctIndex) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total,
            score: Math.round((correct / total) * 100)
        };

        this.renderCurrentStep();
    },

    // ========== NAVIGATION ==========
    goToStep(index) {
        if (index >= 0 && index < this.steps.length) {
            this.currentStepIndex = index;
            this.render();
        }
    },

    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.render();
            window.scrollTo(0, 0);
        }
    },

    resetStep() {
        delete this.answers[this.currentStepIndex];
        delete this.results[this.currentStepIndex];
        this.renderCurrentStep();
    },

    verifyCurrentStep() {
        const step = this.steps[this.currentStepIndex];
        const format = this.formats[step.format];

        if (format && this[format.verify]) {
            this[format.verify]();
        }
    },

    // ========== RÉSULTATS ==========
    showResults() {
        this.stopTimer();

        const elapsed = this.getElapsedTime();
        let totalCorrect = 0;
        let totalQuestions = 0;

        this.steps.forEach((step, index) => {
            const result = this.results[index];
            if (result) {
                totalCorrect += result.correct;
                totalQuestions += result.total;
            }
        });

        const globalScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        let headerClass = 'success';
        let icon = '🏆';
        let message = 'Bravo, entraînement terminé !';

        if (globalScore < 50) {
            headerClass = 'failure';
            icon = '💪';
            message = 'Continue tes efforts !';
        } else if (globalScore < 80) {
            headerClass = 'partial';
            icon = '👍';
            message = 'Bien joué !';
        }

        document.getElementById('exerciseContainer').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
            <div class="final-result">
                <div class="final-result-header ${headerClass}">
                    <div class="final-result-icon">${icon}</div>
                    <h2>${message}</h2>
                    <p>Tu as complété "${this.training.titre}"</p>
                </div>
                <div class="final-result-body">
                    <div class="final-score">
                        <div class="final-score-item">
                            <div class="final-score-value">${globalScore}%</div>
                            <div class="final-score-label">Score global</div>
                        </div>
                        <div class="final-score-item">
                            <div class="final-score-value">${this.formatTime(elapsed)}</div>
                            <div class="final-score-label">Temps total</div>
                        </div>
                    </div>

                    ${this.steps.length > 1 ? `
                        <div class="final-steps-detail">
                            ${this.steps.map((step, index) => {
                                const result = this.results[index] || { correct: 0, total: 0 };
                                const stepScore = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
                                let scoreClass = 'success';
                                if (stepScore < 50) scoreClass = 'failure';
                                else if (stepScore < 80) scoreClass = 'partial';

                                return `
                                    <div class="final-step-row">
                                        <div class="final-step-name">
                                            <span>${this.getFormatIcon(step.format)}</span>
                                            ${this.getFormatLabel(step.format)} (${result.total} questions)
                                        </div>
                                        <span class="final-step-score ${scoreClass}">${result.correct}/${result.total} ${stepScore >= 80 ? '✓' : ''}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}

                    <div class="final-actions">
                        <button class="btn btn-secondary" onclick="EleveEntrainement.restart()">🔄 Refaire l'entraînement</button>
                        <button class="btn btn-primary" onclick="window.history.back()">📚 Retour aux entraînements</button>
                    </div>
                </div>
            </div>
        `;
    },

    restart() {
        this.currentStepIndex = 0;
        this.answers = {};
        this.results = {};
        this.startTime = Date.now();
        this.startTimer();

        document.getElementById('resultContainer').style.display = 'none';
        document.getElementById('exerciseContainer').style.display = 'block';

        this.render();
        window.scrollTo(0, 0);
    },

    quit() {
        if (Object.keys(this.answers).length > 0) {
            if (confirm('Es-tu sûr de vouloir quitter ? Ta progression sera perdue.')) {
                window.history.back();
            }
        } else {
            window.history.back();
        }
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
                        ${isVerified ? `
                            <button class="btn btn-secondary" onclick="EleveEntrainement.resetStep()">🔄 Recommencer</button>
                            ${this.currentStepIndex < this.steps.length - 1 ? `
                                <button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Étape suivante →</button>
                            ` : `
                                <button class="btn btn-success" onclick="EleveEntrainement.showResults()">🏆 Voir les résultats</button>
                            `}
                        ` : `
                            <button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentStep()">✓ Vérifier l'ordre</button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Setup drag & drop si pas vérifié
        if (!isVerified) {
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
                    <div class="timeline-event-date">${this.escapeHtml(event.date)}</div>
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
                        ${isVerified ? `
                            <button class="btn btn-secondary" onclick="EleveEntrainement.resetStep()">🔄 Recommencer</button>
                            ${this.currentStepIndex < this.steps.length - 1 ? `
                                <button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Étape suivante →</button>
                            ` : `
                                <button class="btn btn-success" onclick="EleveEntrainement.showResults()">🏆 Voir les résultats</button>
                            `}
                        ` : `
                            <button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentStep()">✓ Vérifier mes réponses</button>
                        `}
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
                        ${isVerified ? `
                            <button class="btn btn-secondary" onclick="EleveEntrainement.resetStep()">🔄 Recommencer</button>
                            ${this.currentStepIndex < this.steps.length - 1 ? `
                                <button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Étape suivante →</button>
                            ` : `
                                <button class="btn btn-success" onclick="EleveEntrainement.showResults()">🏆 Voir les résultats</button>
                            `}
                        ` : `
                            <button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentStep()">✓ Voir la correction</button>
                        `}
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
                                    ${question.keywords.map(kw => {
                                        const found = keywordsFound.includes(kw.toLowerCase());
                                        return `<span class="keyword-tag ${found ? 'found' : 'missing'}">${found ? '✓' : '✗'} ${this.escapeHtml(kw)}</span>`;
                                    }).join('')}
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

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveEntrainement = EleveEntrainement;
