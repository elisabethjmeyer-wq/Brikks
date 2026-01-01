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
    duration: 0,        // Durée totale en secondes (définie par l'admin)
    remainingTime: 0,   // Temps restant en secondes
    timerInterval: null,
    timeExpired: false,

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
            type: 'connaissances', // connaissances, savoir-faire, competences
            duration: 10 * 60  // 10 minutes en secondes (configurable par l'admin)
        };

        // Initialiser le compte à rebours
        this.duration = this.training.duration;
        this.remainingTime = this.training.duration;

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
            },
            {
                format: 'image-cliquable',
                titre: 'Carte des explorations',
                description: 'Identifiez les lieux sur la carte',
                imageUrl: 'https://placehold.co/1200x600/e0f2fe/0369a1?text=Carte+du+Monde',
                zones: [
                    { id: 'portugal', label: 'Portugal', x: 42, y: 35, width: 4, height: 6 },
                    { id: 'inde', label: 'Inde', x: 68, y: 42, width: 6, height: 8 },
                    { id: 'bresil', label: 'Brésil', x: 28, y: 58, width: 8, height: 12 },
                    { id: 'cap', label: 'Cap de Bonne-Espérance', x: 52, y: 72, width: 5, height: 6 },
                    { id: 'amerique', label: 'Amérique (Caraïbes)', x: 20, y: 42, width: 6, height: 6 }
                ],
                questions: [
                    { question: 'Où se trouve le Portugal, point de départ des explorations ?', correctZoneId: 'portugal' },
                    { question: 'Cliquez sur le cap contourné par Bartolomeu Dias en 1488', correctZoneId: 'cap' },
                    { question: 'Où Vasco de Gama est-il arrivé en 1498 ?', correctZoneId: 'inde' },
                    { question: 'Où Pedro Álvares Cabral a-t-il accosté en 1500 ?', correctZoneId: 'bresil' }
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

    // ========== TIMER (COMPTE À REBOURS) ==========
    startTimer() {
        this.timeExpired = false;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    },

    updateTimer() {
        if (this.remainingTime > 0) {
            this.remainingTime--;
            this.updateTimerDisplay();

            // Alertes visuelles quand le temps est bas
            const timerEl = document.querySelector('.timer');
            if (this.remainingTime <= 60 && this.remainingTime > 30) {
                timerEl?.classList.add('warning');
                timerEl?.classList.remove('danger');
            } else if (this.remainingTime <= 30) {
                timerEl?.classList.remove('warning');
                timerEl?.classList.add('danger');
            }
        } else {
            // Temps écoulé !
            this.onTimeExpired();
        }
    },

    updateTimerDisplay() {
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        const timerValueEl = document.getElementById('timerValue');
        if (timerValueEl) {
            timerValueEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    },

    onTimeExpired() {
        this.stopTimer();
        this.timeExpired = true;

        // Afficher un message et redémarrer l'entraînement
        alert('Temps ecoul\u00e9 ! L\'entra\u00eenement va red\u00e9marrer.');

        // Redémarrer l'entraînement
        this.restart();
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    getElapsedTime() {
        return this.duration - this.remainingTime;
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
        const isVerified = this.results[this.currentStepIndex]?.verified;

        // Initialiser le mélange des options si pas encore fait
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { shuffledOptions: {} };
            step.questions.forEach(q => {
                // Créer un tableau d'indices et le mélanger
                const indices = q.options.map((_, i) => i);
                this.answers[this.currentStepIndex].shuffledOptions[q.id] = this.shuffleArray(indices);
            });
        }

        const stepAnswers = this.answers[this.currentStepIndex];

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
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderQCMQuestion(question, qIndex, stepAnswers, isVerified) {
        // Récupérer l'index original sélectionné par l'élève
        const selectedOriginalIndex = stepAnswers[question.id];
        const isAnswered = selectedOriginalIndex !== undefined;
        const isCorrect = isVerified && selectedOriginalIndex === question.correctIndex;
        const isIncorrect = isVerified && isAnswered && selectedOriginalIndex !== question.correctIndex;

        // Récupérer l'ordre mélangé des options
        const shuffledOrder = stepAnswers.shuffledOptions?.[question.id] || question.options.map((_, i) => i);

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
                    ${shuffledOrder.map((originalIndex) => {
                        const option = question.options[originalIndex];
                        let optionClass = '';
                        if (selectedOriginalIndex === originalIndex) optionClass = 'selected';
                        if (isVerified) {
                            optionClass += ' disabled';
                            if (originalIndex === question.correctIndex) optionClass += ' correct';
                            else if (selectedOriginalIndex === originalIndex) optionClass += ' incorrect';
                        }

                        return `
                            <div class="qcm-option ${optionClass}"
                                 onclick="EleveEntrainement.selectQCMOption('${question.id}', ${originalIndex})">
                                <div class="qcm-radio">
                                    ${isVerified && originalIndex === question.correctIndex ? '✓' :
                                      (isVerified && selectedOriginalIndex === originalIndex && originalIndex !== question.correctIndex ? '✗' :
                                      (selectedOriginalIndex === originalIndex ? '●' : ''))}
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

    selectQCMOption(questionId, originalIndex) {
        // Ne pas permettre la sélection si déjà vérifié
        if (this.results[this.currentStepIndex]?.verified) return;

        // Enregistrer la réponse (l'index original de la bonne réponse)
        this.answers[this.currentStepIndex][questionId] = originalIndex;

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
    renderNavigationButtons() {
        // Mode correction : navigation entre les corrections
        if (this.correctionMode) {
            if (this.currentStepIndex < this.steps.length - 1) {
                return `<button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Correction suivante</button>`;
            } else {
                return `<button class="btn btn-primary" onclick="EleveEntrainement.backToResults()">Retour aux resultats</button>`;
            }
        }

        // Mode entraînement normal
        if (this.currentStepIndex < this.steps.length - 1) {
            return `<button class="btn btn-primary" onclick="EleveEntrainement.nextStep()">Etape suivante</button>`;
        } else {
            return `<button class="btn btn-success" onclick="EleveEntrainement.finishTraining()">Terminer l'entrainement</button>`;
        }
    },

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

    // Terminer l'entraînement : vérifier toutes les étapes et afficher les résultats
    finishTraining() {
        // Vérifier toutes les étapes
        this.steps.forEach((step, index) => {
            if (!this.results[index]?.verified) {
                const savedIndex = this.currentStepIndex;
                this.currentStepIndex = index;
                this.verifyCurrentStep();
                this.currentStepIndex = savedIndex;
            }
        });

        // Afficher les résultats
        this.showResults();
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
                        <button class="btn btn-outline" onclick="EleveEntrainement.showCorrections()">Voir les corrections</button>
                        <button class="btn btn-secondary" onclick="EleveEntrainement.restart()">Refaire l'entrainement</button>
                        <button class="btn btn-primary" onclick="window.history.back()">Retour aux entrainements</button>
                    </div>
                </div>
            </div>
        `;
    },

    // Afficher les corrections détaillées
    showCorrections() {
        this.currentStepIndex = 0;
        this.correctionMode = true;

        document.getElementById('resultContainer').style.display = 'none';
        document.getElementById('exerciseContainer').style.display = 'block';
        document.getElementById('progressSection').style.display = 'block';

        this.render();
        window.scrollTo(0, 0);
    },

    // Retour aux résultats depuis le mode correction
    backToResults() {
        this.correctionMode = false;
        document.getElementById('exerciseContainer').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';
        this.showResults();
    },

    restart() {
        this.currentStepIndex = 0;
        this.answers = {};
        this.results = {};
        this.timeExpired = false;
        this.correctionMode = false;

        // Réinitialiser le compte à rebours
        this.remainingTime = this.duration;
        this.stopTimer();
        this.startTimer();

        // Retirer les classes d'alerte du timer
        const timerEl = document.querySelector('.timer');
        timerEl?.classList.remove('warning', 'danger');

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
                        <img src="${step.imageUrl}" alt="${step.titre}" class="image-cliquable-img" id="clickableImage"
                             onerror="this.onerror=null; this.src='https://placehold.co/1200x600/f0f0f0/666666?text=Image+non+disponible';">
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

        // Setup click handlers if not all questions answered and not in correction mode
        if (!allQuestionsAnswered && !this.correctionMode) {
            this.setupImageClickHandlers(step, currentQuestionIndex);
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
        if (isVerified) {
            questions.forEach((q, qIndex) => {
                const userAnswer = stepAnswers[`q_${qIndex}`];
                if (q.correctZoneId === zone.id) {
                    zoneStatus = userAnswer === zone.id ? 'correct' : 'show-correct';
                } else if (userAnswer === zone.id) {
                    zoneStatus = 'incorrect';
                }
            });
        }

        return `
            <div class="image-cliquable-zone ${zoneStatus}"
                 data-zone-id="${zone.id}"
                 style="left: ${zone.x}%; top: ${zone.y}%; width: ${zone.width}%; height: ${zone.height}%;"
                 title="${this.escapeHtml(zone.label)}">
                ${isVerified ? `<span class="zone-label">${this.escapeHtml(zone.label)}</span>` : ''}
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

        zones.forEach(zone => {
            zone.addEventListener('click', () => {
                const zoneId = zone.dataset.zoneId;
                this.handleZoneClick(zoneId, currentQuestionIndex, step);
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

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveEntrainement = EleveEntrainement;
