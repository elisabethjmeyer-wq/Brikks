/**
 * Moteur d'Evaluation Eleve
 * Gere l'execution des evaluations avec validation binaire
 */

const EleveEvaluation = {
    // Etat
    evaluation: null,
    steps: [],
    currentStepIndex: 0,
    answers: {},
    results: {},
    duration: 0,
    remainingTime: 0,
    timerInterval: null,
    timeExpired: false,
    isSubmitting: false,

    // Configuration des formats (reutilise le meme systeme que l'entrainement)
    formats: {
        qcm: { icon: '?', label: 'QCM', render: 'renderQCM', verify: 'verifyQCM' },
        qcm_multiple: { icon: 'M', label: 'QCM Multiple', render: 'renderQCMMultiple', verify: 'verifyQCMMultiple' },
        vrai_faux: { icon: 'VF', label: 'Vrai ou Faux', render: 'renderVraiFaux', verify: 'verifyVraiFaux' },
        trous: { icon: 'T', label: 'Texte a trous', render: 'renderTrous', verify: 'verifyTrous' },
        association: { icon: 'A', label: 'Association', render: 'renderAssociation', verify: 'verifyAssociation' },
        ordonner: { icon: 'O', label: 'Ordonner', render: 'renderOrdonner', verify: 'verifyOrdonner' },
        question_ouverte: { icon: 'Q', label: 'Question ouverte', render: 'renderQuestionOuverte', verify: 'verifyQuestionOuverte' },
        image_cliquable: { icon: 'I', label: 'Image cliquable', render: 'renderImageCliquable', verify: 'verifyImageCliquable' }
    },

    // ========== INITIALISATION ==========
    async init() {
        try {
            const params = new URLSearchParams(window.location.search);
            const evalId = params.get('id');

            if (evalId && evalId !== 'test') {
                await this.loadEvaluation(evalId);
            } else {
                this.loadMockData();
            }

            this.startTimer();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement de l\'evaluation');
        }
    },

    // ========== CHARGEMENT DONNEES ==========
    async loadEvaluation(evalId) {
        try {
            const response = await this.callAPI('getEvaluation', { id: evalId });

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Evaluation non trouvee');
            }

            const data = response.data;

            this.evaluation = {
                id: data.id,
                titre: data.titre,
                type: data.type, // connaissances, savoir-faire, competences, bonus
                chapitre_id: data.chapitre_id,
                chapitre_nom: data.chapitre_nom,
                description: data.description,
                briques: parseInt(data.briques) || 1,
                seuil: parseInt(data.seuil) || 80, // Pourcentage requis pour validation
                methodologie_id: data.methodologie_id,
                criteres: data.criteres
            };

            // Duree en secondes
            const dureeMinutes = parseInt(data.duree) || 15;
            this.duration = dureeMinutes * 60;
            this.remainingTime = this.duration;

            // Convertir les questions en steps
            this.steps = this.convertQuestionsToSteps(data.questions || []);

            this.answers = {};
            this.results = {};

        } catch (error) {
            console.error('Erreur chargement evaluation:', error);
            console.warn('Fallback sur donnees mock');
            this.loadMockData();
        }
    },

    async callAPI(action, params = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });

        return new Promise((resolve, reject) => {
            const callbackName = 'evalCallback_' + Date.now();
            const script = document.createElement('script');

            window[callbackName] = (data) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
            };

            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur reseau'));
            };

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) {
                        document.body.removeChild(script);
                    }
                    reject(new Error('Timeout'));
                }
            }, 15000);
        });
    },

    convertQuestionsToSteps(questions) {
        const formatIdToType = {
            'format_001': 'qcm',
            'format_002': 'qcm_multiple',
            'format_003': 'vrai_faux',
            'format_004': 'trous',
            'format_005': 'association',
            'format_006': 'ordonner',
            'format_007': 'question_ouverte',
            'format_008': 'image_cliquable'
        };

        return questions.map(q => {
            let formatType = q.format?.type_base;

            if (!formatType && q.format_id) {
                formatType = formatIdToType[q.format_id] || formatIdToType[String(q.format_id).trim()];
            }

            if (!formatType && q.format?.nom) {
                const nom = q.format.nom.toLowerCase();
                if (nom.includes('qcm') && nom.includes('multiple')) formatType = 'qcm_multiple';
                else if (nom.includes('qcm')) formatType = 'qcm';
                else if (nom.includes('vrai') || nom.includes('faux')) formatType = 'vrai_faux';
                else if (nom.includes('trou')) formatType = 'trous';
                else if (nom.includes('association')) formatType = 'association';
                else if (nom.includes('ordonner') || nom.includes('ordre')) formatType = 'ordonner';
            }

            if (!formatType) formatType = 'qcm';

            const donnees = q.donnees || {};

            const step = {
                format: formatType,
                titre: q.enonce || 'Question',
                description: q.explication || '',
                points: q.points || 1,
                question_id: q.id
            };

            switch (formatType) {
                case 'qcm':
                    step.questions = [{
                        id: q.id,
                        question: q.enonce,
                        options: donnees.options || [],
                        correctIndex: donnees.reponse_correcte,
                        explanation: q.explication
                    }];
                    break;

                case 'qcm_multiple':
                    step.questions = [{
                        id: q.id,
                        question: q.enonce,
                        options: donnees.options || [],
                        correctIndices: donnees.reponses_correctes || [],
                        explanation: q.explication
                    }];
                    break;

                case 'vrai_faux':
                    step.questions = [{
                        id: q.id,
                        question: q.enonce,
                        correctAnswer: donnees.reponse_correcte,
                        explanation: q.explication
                    }];
                    break;

                case 'trous':
                    step.texte = donnees.texte || q.enonce;
                    step.trous = donnees.trous || [];
                    break;

                case 'association':
                    step.paires = donnees.paires || [];
                    break;

                case 'ordonner':
                    step.elements = donnees.elements || [];
                    step.ordre_correct = donnees.ordre_correct || [];
                    break;

                case 'question_ouverte':
                    step.questions = [{
                        id: q.id,
                        question: q.enonce,
                        keywords: donnees.mots_cles || [],
                        correction: q.explication
                    }];
                    break;

                case 'image_cliquable':
                    step.imageUrl = donnees.image_url || '';
                    step.zones = donnees.zones || [];
                    step.questions = donnees.questions || [];
                    break;

                default:
                    Object.assign(step, donnees);
            }

            return step;
        });
    },

    loadMockData() {
        this.evaluation = {
            id: 'eval_test_001',
            titre: 'Evaluation - Les explorations portugaises',
            type: 'connaissances',
            chapitre_nom: 'L1 - Les explorations portugaises',
            briques: 5,
            seuil: 80
        };

        this.duration = 15 * 60;
        this.remainingTime = this.duration;

        this.steps = [
            {
                format: 'qcm',
                titre: 'Questions sur les explorations',
                description: 'Repondez aux questions suivantes',
                questions: [
                    {
                        id: 'q1',
                        question: 'Quelle est la date du passage du cap de Bonne-Esperance par Bartolomeu Dias ?',
                        options: ['1492', '1488', '1498', '1500'],
                        correctIndex: 1,
                        explanation: 'Bartolomeu Dias atteint le cap de Bonne-Esperance en 1488.'
                    },
                    {
                        id: 'q2',
                        question: 'Qui a atteint l\'Inde par voie maritime en 1498 ?',
                        options: ['Christophe Colomb', 'Vasco de Gama', 'Magellan', 'Bartolomeu Dias'],
                        correctIndex: 1,
                        explanation: 'Vasco de Gama atteint Calicut (Inde) en 1498.'
                    },
                    {
                        id: 'q3',
                        question: 'La caravelle est...',
                        options: ['Un instrument de navigation', 'Une epice precieuse', 'Un type de navire', 'Un comptoir commercial'],
                        correctIndex: 2,
                        explanation: 'La caravelle est un navire leger et maniable.'
                    }
                ]
            },
            {
                format: 'vrai_faux',
                titre: 'Vrai ou Faux',
                description: 'Indiquez si les affirmations sont vraies ou fausses',
                questions: [
                    {
                        id: 'vf1',
                        question: 'Henri le Navigateur a lui-meme naviguer jusqu\'en Inde.',
                        correctAnswer: false,
                        explanation: 'Henri le Navigateur n\'a jamais navigue lui-meme, il a finance et organise les expeditions.'
                    },
                    {
                        id: 'vf2',
                        question: 'Le poivre etait surnomme "l\'or noir" a l\'epoque des grandes decouvertes.',
                        correctAnswer: true,
                        explanation: 'Le poivre valait tres cher et etait tres recherche.'
                    }
                ]
            }
        ];

        this.answers = {};
        this.results = {};
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluationContent').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <span style="font-size: 48px;">:(</span>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="window.history.back()">Retour</button>
            </div>
        `;
    },

    // ========== TIMER ==========
    startTimer() {
        this.timeExpired = false;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    },

    updateTimer() {
        if (this.remainingTime > 0) {
            this.remainingTime--;
            this.updateTimerDisplay();

            const timerEl = document.querySelector('.timer');
            if (this.remainingTime <= 60 && this.remainingTime > 30) {
                timerEl?.classList.add('warning');
                timerEl?.classList.remove('danger');
            } else if (this.remainingTime <= 30) {
                timerEl?.classList.remove('warning');
                timerEl?.classList.add('danger');
            }
        } else {
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
        // En evaluation, le temps ecoule = soumission automatique
        this.finishEvaluation();
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
        document.getElementById('evaluationTitle').textContent = this.evaluation.titre;
        document.getElementById('evaluationSubtitle').textContent = this.evaluation.chapitre_nom || '';

        document.getElementById('stakesValue').textContent = this.evaluation.briques;

        const badge = document.getElementById('typeBadge');
        badge.textContent = this.getTypeLabel(this.evaluation.type);
        badge.className = `type-badge ${this.evaluation.type}`;
    },

    getTypeLabel(type) {
        const labels = {
            connaissances: 'Connaissances',
            'savoir-faire': 'Savoir-faire',
            competences: 'Competences',
            bonus: 'Bonus'
        };
        return labels[type] || type;
    },

    getFormatIcon(format) {
        return this.formats[format]?.icon || '?';
    },

    getFormatLabel(format) {
        return this.formats[format]?.label || format;
    },

    renderProgress() {
        const progressSection = document.getElementById('progressSection');
        const progressSteps = document.getElementById('progressSteps');
        const progressText = document.getElementById('progressText');

        if (this.steps.length <= 1) {
            progressSection.style.display = 'none';
            return;
        }

        progressSection.style.display = 'block';
        progressText.textContent = `Etape ${this.currentStepIndex + 1}/${this.steps.length}`;

        progressSteps.innerHTML = this.steps.map((step, index) => {
            let stepClass = '';
            if (index < this.currentStepIndex) stepClass = 'completed';
            else if (index === this.currentStepIndex) stepClass = 'current';

            return `
                <div class="progress-step ${stepClass}">
                    <div class="progress-step-bar">
                        <div class="progress-step-bar-fill"></div>
                    </div>
                    <div class="progress-step-label">
                        <span class="progress-step-icon">${index + 1}</span>
                        ${this.getFormatLabel(step.format)}
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
                    <span style="font-size: 48px;">!</span>
                    <h2 style="margin: 16px 0;">Format non supporte</h2>
                    <p style="color: var(--gray-500);">Le format "${step.format}" n'est pas encore implemente.</p>
                </div>
            </div>
        `;
    },

    // ========== FORMAT QCM ==========
    renderQCM(step) {
        const container = document.getElementById('exerciseContainer');

        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { shuffledOptions: {} };
            step.questions.forEach(q => {
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
                        ${step.questions.map((q, qIndex) => this.renderQCMQuestion(q, qIndex, stepAnswers)).join('')}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderQCMQuestion(question, qIndex, stepAnswers) {
        const selectedOriginalIndex = stepAnswers[question.id];
        const shuffledOrder = stepAnswers.shuffledOptions?.[question.id] || question.options.map((_, i) => i);

        return `
            <div class="qcm-item" id="qcm-${question.id}">
                <div class="qcm-item-header">
                    <div class="qcm-item-number">${qIndex + 1}</div>
                    <div class="qcm-item-question">${this.escapeHtml(question.question)}</div>
                </div>
                <div class="qcm-options">
                    ${shuffledOrder.map((originalIndex) => {
                        const option = question.options[originalIndex];
                        let optionClass = selectedOriginalIndex === originalIndex ? 'selected' : '';

                        return `
                            <div class="qcm-option ${optionClass}"
                                 onclick="EleveEvaluation.selectQCMOption('${question.id}', ${originalIndex})">
                                <div class="qcm-radio">
                                    ${selectedOriginalIndex === originalIndex ? '●' : ''}
                                </div>
                                <span class="qcm-option-text">${this.escapeHtml(option)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    selectQCMOption(questionId, originalIndex) {
        this.answers[this.currentStepIndex][questionId] = originalIndex;
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
    },

    // ========== FORMAT VRAI/FAUX ==========
    renderVraiFaux(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon vrai-faux">${this.getFormatIcon('vrai_faux')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Repondez Vrai ou Faux'}</p>
                    </div>
                    <span class="exercise-badge">${step.questions?.length || 1} question(s)</span>
                </div>

                <div class="exercise-body">
                    <div class="vrai-faux-list">
                        ${(step.questions || []).map((q, qIndex) => {
                            const answer = stepAnswers[q.id];

                            return `
                                <div class="vrai-faux-item">
                                    <div class="vrai-faux-question">
                                        <span class="vrai-faux-number">${qIndex + 1}</span>
                                        <span class="vrai-faux-text">${this.escapeHtml(q.question)}</span>
                                    </div>
                                    <div class="vrai-faux-buttons">
                                        <button class="vrai-faux-btn vrai ${answer === true ? 'selected' : ''}"
                                                onclick="EleveEvaluation.selectVraiFaux('${q.id}', true)">
                                            Vrai
                                        </button>
                                        <button class="vrai-faux-btn faux ${answer === false ? 'selected' : ''}"
                                                onclick="EleveEvaluation.selectVraiFaux('${q.id}', false)">
                                            Faux
                                        </button>
                                    </div>
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

    selectVraiFaux(questionId, value) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][questionId] = value;
        this.renderCurrentStep();
    },

    verifyVraiFaux() {
        const step = this.steps[this.currentStepIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const questions = step.questions || [];

        let correct = 0;
        questions.forEach(q => {
            if (stepAnswers[q.id] === q.correctAnswer) {
                correct++;
            }
        });

        this.results[this.currentStepIndex] = {
            verified: true,
            correct,
            total: questions.length,
            score: Math.round((correct / questions.length) * 100)
        };
    },

    // ========== FORMAT QCM MULTIPLE ==========
    renderQCMMultiple(step) {
        const container = document.getElementById('exerciseContainer');

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
                        <p>${step.description || 'Plusieurs reponses possibles'}</p>
                    </div>
                    <span class="exercise-badge">${step.questions?.length || 1} question(s)</span>
                </div>

                <div class="exercise-body">
                    <div class="qcm-questions-list">
                        ${(step.questions || []).map((q, qIndex) => {
                            const selections = stepAnswers.selections[q.id] || [];

                            return `
                                <div class="qcm-item" id="qcm-${q.id}">
                                    <div class="qcm-item-header">
                                        <div class="qcm-item-number">${qIndex + 1}</div>
                                        <div class="qcm-item-question">${this.escapeHtml(q.question)}</div>
                                        <span class="qcm-item-hint">Plusieurs reponses possibles</span>
                                    </div>
                                    <div class="qcm-options">
                                        ${q.options.map((option, optIndex) => {
                                            const isSelected = selections.includes(optIndex);

                                            return `
                                                <div class="qcm-option checkbox ${isSelected ? 'selected' : ''}"
                                                     onclick="EleveEvaluation.toggleQCMMultiple('${q.id}', ${optIndex})">
                                                    <div class="qcm-checkbox">
                                                        ${isSelected ? 'V' : ''}
                                                    </div>
                                                    <span class="qcm-option-text">${this.escapeHtml(option)}</span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
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
    },

    // ========== FORMAT TROUS ==========
    renderTrous(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        let texteHtml = this.escapeHtml(step.texte || step.titre);
        const trous = step.trous || [];

        trous.forEach((trou, index) => {
            const userAnswer = stepAnswers[`trou_${index}`] || '';

            const inputHtml = `
                <span class="trou-wrapper">
                    <input type="text"
                           class="trou-input"
                           id="trou_${index}"
                           value="${this.escapeHtml(userAnswer)}"
                           placeholder="${trou.indice || '...'}"
                           onchange="EleveEvaluation.updateTrou(${index}, this.value)">
                </span>
            `;

            texteHtml = texteHtml.replace(`{${index}}`, inputHtml);
        });

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon trous">${this.getFormatIcon('trous')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre || 'Completez le texte'}</h2>
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
    },

    // ========== FORMAT ASSOCIATION ==========
    renderAssociation(step) {
        const container = document.getElementById('exerciseContainer');

        if (!this.answers[this.currentStepIndex]) {
            const rightItems = step.paires.map((p, i) => ({ text: p.droite, originalIndex: i }));
            this.answers[this.currentStepIndex] = {
                shuffledRight: this.shuffleArray(rightItems),
                connections: {}
            };
        }

        const stepAnswers = this.answers[this.currentStepIndex];
        const paires = step.paires || [];

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon association">${this.getFormatIcon('association')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description || 'Reliez les elements correspondants'}</p>
                    </div>
                    <span class="exercise-badge">${paires.length} paires</span>
                </div>

                <div class="exercise-body">
                    <div class="association-instruction">
                        <span class="association-instruction-icon">i</span>
                        <span>Cliquez sur un element a gauche puis sur son correspondant a droite</span>
                    </div>

                    <div class="association-container">
                        <div class="association-column association-left">
                            ${paires.map((p, index) => {
                                const isConnected = stepAnswers.connections[index] !== undefined;
                                const isActive = stepAnswers.activeLeft === index;

                                return `
                                    <div class="association-item ${isActive ? 'active' : ''} ${isConnected ? 'connected' : ''}"
                                         data-index="${index}"
                                         onclick="EleveEvaluation.selectAssociationLeft(${index})">
                                        ${this.escapeHtml(p.gauche)}
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <div class="association-column association-right">
                            ${stepAnswers.shuffledRight.map((item) => {
                                const isConnected = Object.values(stepAnswers.connections).includes(item.originalIndex);

                                return `
                                    <div class="association-item ${isConnected ? 'connected' : ''}"
                                         data-original="${item.originalIndex}"
                                         onclick="EleveEvaluation.selectAssociationRight(${item.originalIndex})">
                                        ${this.escapeHtml(item.text)}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-secondary" onclick="EleveEvaluation.resetAssociations()">Reinitialiser</button>
                        ${this.renderNavigationButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    selectAssociationLeft(index) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = { shuffledRight: [], connections: {} };
        }

        this.answers[this.currentStepIndex].activeLeft = index;
        this.renderCurrentStep();
    },

    selectAssociationRight(originalIndex) {
        const stepAnswers = this.answers[this.currentStepIndex];
        if (stepAnswers.activeLeft === undefined) return;

        Object.keys(stepAnswers.connections).forEach(key => {
            if (stepAnswers.connections[key] === originalIndex) {
                delete stepAnswers.connections[key];
            }
        });

        stepAnswers.connections[stepAnswers.activeLeft] = originalIndex;
        delete stepAnswers.activeLeft;

        this.renderCurrentStep();
    },

    resetAssociations() {
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
    },

    // ========== FORMAT ORDONNER ==========
    renderOrdonner(step) {
        const container = document.getElementById('exerciseContainer');

        const elements = step.elements || [];
        const ordreCorrect = step.ordre_correct || elements.map((_, i) => i);

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
                        <p>${step.description || 'Remettez les elements dans le bon ordre'}</p>
                    </div>
                    <span class="exercise-badge">${elements.length} elements</span>
                </div>

                <div class="exercise-body">
                    <div class="ordonner-instruction">
                        <span class="ordonner-instruction-icon">i</span>
                        <span>Utilisez les fleches pour reorganiser les elements</span>
                    </div>

                    <div class="ordonner-container" id="ordonnerContainer">
                        ${currentOrder.map((elementIndex, position) => {
                            const element = elements[elementIndex];

                            return `
                                <div class="ordonner-item" data-index="${elementIndex}">
                                    <span class="ordonner-position">${position + 1}</span>
                                    <span class="ordonner-text">${this.escapeHtml(typeof element === 'object' ? element.titre || element.text : element)}</span>
                                    <div class="ordonner-controls">
                                        <button class="ordonner-btn" onclick="EleveEvaluation.moveOrdonner(${position}, -1)" ${position === 0 ? 'disabled' : ''}>^</button>
                                        <button class="ordonner-btn" onclick="EleveEvaluation.moveOrdonner(${position}, 1)" ${position === currentOrder.length - 1 ? 'disabled' : ''}>v</button>
                                    </div>
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

    moveOrdonner(position, direction) {
        const order = this.answers[this.currentStepIndex].order;
        const newPosition = position + direction;

        if (newPosition < 0 || newPosition >= order.length) return;

        [order[position], order[newPosition]] = [order[newPosition], order[position]];

        this.renderCurrentStep();
    },

    verifyOrdonner() {
        const step = this.steps[this.currentStepIndex];
        const currentOrder = this.answers[this.currentStepIndex]?.order || [];

        const elements = step.elements || [];
        const ordreCorrect = step.ordre_correct || elements.map((_, i) => i);

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
    },

    // ========== FORMAT QUESTION OUVERTE ==========
    renderQuestionOuverte(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon question-ouverte">${this.getFormatIcon('question_ouverte')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">${step.questions.length} question${step.questions.length > 1 ? 's' : ''}</span>
                </div>

                <div class="exercise-body">
                    <div class="question-ouverte-list">
                        ${step.questions.map((q, index) => {
                            const answer = stepAnswers[q.id] || '';

                            return `
                                <div class="question-ouverte-item">
                                    <div class="question-ouverte-header">
                                        <div class="question-ouverte-number">${index + 1}</div>
                                        <div class="question-ouverte-text">${this.escapeHtml(q.question)}</div>
                                    </div>

                                    <div class="question-ouverte-answer">
                                        <textarea
                                            class="question-ouverte-textarea"
                                            placeholder="Ecrivez votre reponse ici..."
                                            onchange="EleveEvaluation.setQuestionOuverteAnswer('${q.id}', this.value)"
                                            oninput="EleveEvaluation.setQuestionOuverteAnswer('${q.id}', this.value)"
                                        >${this.escapeHtml(answer)}</textarea>

                                        ${q.keywords ? `
                                            <div class="question-ouverte-hint">
                                                <span>i</span> Mots-cles attendus : ${q.keywords.length}
                                            </div>
                                        ` : ''}
                                    </div>
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

    setQuestionOuverteAnswer(questionId, value) {
        if (!this.answers[this.currentStepIndex]) {
            this.answers[this.currentStepIndex] = {};
        }
        this.answers[this.currentStepIndex][questionId] = value;
    },

    checkKeywords(answer, keywords) {
        const normalizedAnswer = this.normalizeText(answer);
        return keywords.filter(kw => {
            const normalizedKw = this.normalizeText(kw);
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
    },

    // ========== FORMAT IMAGE CLIQUABLE ==========
    renderImageCliquable(step) {
        const container = document.getElementById('exerciseContainer');
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const currentQuestionIndex = stepAnswers.currentQuestion || 0;
        const allQuestionsAnswered = currentQuestionIndex >= step.questions.length;
        const currentQuestion = step.questions[currentQuestionIndex];

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon image-cliquable">${this.getFormatIcon('image_cliquable')}</div>
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
                            <div class="image-cliquable-question-icon">?</div>
                            <div class="image-cliquable-question-text">${this.escapeHtml(currentQuestion.question)}</div>
                        </div>
                    ` : `
                        <div class="image-cliquable-complete">
                            <p>Toutes les zones ont ete identifiees !</p>
                        </div>
                    `}

                    <div class="image-cliquable-container">
                        <img src="${step.imageUrl}" alt="${step.titre}" class="image-cliquable-img" id="clickableImage"
                             onerror="this.onerror=null; this.src='https://placehold.co/1200x600/f0f0f0/666666?text=Image+non+disponible';">
                        <div class="image-cliquable-zones" id="clickableZones">
                            ${step.zones.map((zone, zIndex) => `
                                <div class="image-cliquable-zone"
                                     data-zone-id="${zone.id}"
                                     style="left: ${zone.x}%; top: ${zone.y}%; width: ${zone.width}%; height: ${zone.height}%;"
                                     title="${this.escapeHtml(zone.label)}">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="exercise-actions">
                        ${allQuestionsAnswered ? this.renderNavigationButtons() : ''}
                    </div>
                </div>
            </div>
        `;

        if (!allQuestionsAnswered) {
            this.setupImageClickHandlers(step, currentQuestionIndex);
        }
    },

    setupImageClickHandlers(step, currentQuestionIndex) {
        const zones = document.querySelectorAll('.image-cliquable-zone');

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

        this.answers[this.currentStepIndex][`q_${questionIndex}`] = zoneId;

        const clickedZone = document.querySelector(`[data-zone-id="${zoneId}"]`);
        const isCorrect = step.questions[questionIndex].correctZoneId === zoneId;

        clickedZone.classList.add(isCorrect ? 'flash-correct' : 'flash-incorrect');

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
    },

    // ========== NAVIGATION ==========
    renderNavigationButtons() {
        if (this.currentStepIndex < this.steps.length - 1) {
            return `<button class="btn btn-primary" onclick="EleveEvaluation.nextStep()">Etape suivante</button>`;
        } else {
            return `<button class="btn btn-success" onclick="EleveEvaluation.confirmFinish()">Terminer l'evaluation</button>`;
        }
    },

    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.render();
            window.scrollTo(0, 0);
        }
    },

    confirmFinish() {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmModalTitle').textContent = 'Terminer l\'evaluation';
        document.getElementById('confirmModalMessage').textContent =
            'Etes-vous sur de vouloir soumettre votre evaluation ? Cette action est definitive.';
        document.getElementById('confirmModalBtn').textContent = 'Soumettre';
        document.getElementById('confirmModalBtn').onclick = () => {
            this.closeConfirmModal();
            this.finishEvaluation();
        };
        modal.classList.remove('hidden');
    },

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    },

    verifyCurrentStep() {
        const step = this.steps[this.currentStepIndex];
        const format = this.formats[step.format];

        if (format && this[format.verify]) {
            this[format.verify]();
        }
    },

    finishEvaluation() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        this.stopTimer();

        // Verifier toutes les etapes
        this.steps.forEach((step, index) => {
            if (!this.results[index]?.verified) {
                const savedIndex = this.currentStepIndex;
                this.currentStepIndex = index;
                this.verifyCurrentStep();
                this.currentStepIndex = savedIndex;
            }
        });

        // Calculer le score global
        const globalResult = this.calculateGlobalResult();

        // Sauvegarder les resultats
        this.saveResults(globalResult);

        // Afficher les resultats
        this.showResults(globalResult);
    },

    calculateGlobalResult() {
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

        // Determiner si valide selon le type
        let isValidated = false;

        if (this.evaluation.type === 'savoir-faire') {
            // Savoir-faire : doit etre PARFAIT (100%)
            isValidated = globalScore === 100;
        } else {
            // Connaissances, Competences, Bonus : atteindre le seuil
            isValidated = globalScore >= this.evaluation.seuil;
        }

        return {
            score: globalScore,
            correct: totalCorrect,
            total: totalQuestions,
            isValidated,
            validationsEarned: isValidated ? this.evaluation.briques : 0,
            elapsedTime: this.getElapsedTime()
        };
    },

    async saveResults(globalResult) {
        try {
            await this.callAPI('saveEvaluationResult', {
                evaluation_id: this.evaluation.id,
                eleve_id: 'current_user', // A remplacer par l'ID reel de l'eleve
                score: globalResult.score,
                validations: globalResult.validationsEarned,
                is_validated: globalResult.isValidated,
                temps_passe: globalResult.elapsedTime,
                details: JSON.stringify(this.results)
            });
        } catch (error) {
            console.error('Erreur sauvegarde resultats:', error);
            // On continue quand meme a afficher les resultats
        }
    },

    showResults(globalResult) {
        document.getElementById('exerciseContainer').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';

        let headerClass = globalResult.isValidated ? 'validated' : 'failed';
        let icon = globalResult.isValidated ? ':)' : ':(';
        let message = globalResult.isValidated ? 'Evaluation validee !' : 'Evaluation non validee';
        let subMessage = globalResult.isValidated
            ? `Tu as gagne ${globalResult.validationsEarned} validation${globalResult.validationsEarned > 1 ? 's' : ''} !`
            : 'Tu pourras repasser cette evaluation avec de nouvelles questions.';

        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header ${headerClass}">
                    <div class="evaluation-result-icon">${icon}</div>
                    <h2>${message}</h2>
                    <p>${subMessage}</p>
                </div>

                <div class="validation-result">
                    <div class="validation-item">
                        <div class="validation-item-value ${globalResult.isValidated ? 'earned' : 'lost'}">${globalResult.validationsEarned}</div>
                        <div class="validation-item-label">Validations obtenues</div>
                    </div>
                    <div class="validation-item">
                        <div class="validation-item-value">${this.evaluation.briques}</div>
                        <div class="validation-item-label">Validations en jeu</div>
                    </div>
                </div>

                <div class="score-details">
                    <h3>Details du score</h3>
                    <div class="score-breakdown">
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.score}%</div>
                            <div class="score-item-label">Score obtenu</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.correct}/${globalResult.total}</div>
                            <div class="score-item-label">Bonnes reponses</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${this.formatTime(globalResult.elapsedTime)}</div>
                            <div class="score-item-label">Temps</div>
                        </div>
                    </div>

                    <div class="threshold-info">
                        <div class="threshold-info-icon">${this.evaluation.seuil}%</div>
                        <div class="threshold-info-text">
                            <strong>Seuil de validation</strong>
                            <span>${this.evaluation.type === 'savoir-faire'
                                ? 'Pour un savoir-faire, tu dois obtenir 100% (zero erreur)'
                                : `Tu devais obtenir au moins ${this.evaluation.seuil}% pour valider`}</span>
                        </div>
                    </div>

                    ${this.evaluation.type === 'savoir-faire' && !globalResult.isValidated ? `
                        <div class="savoir-faire-warning">
                            <div class="savoir-faire-warning-title">
                                <span>!</span> Savoir-faire non valide
                            </div>
                            <p>Pour valider un savoir-faire, tu dois repondre correctement a toutes les questions sans aucune erreur.
                            Tu pourras repasser cette evaluation avec un nouveau sujet tire au sort.</p>
                        </div>
                    ` : ''}
                </div>

                <div class="result-actions">
                    <button class="btn btn-primary" onclick="window.location.href='evaluations.html'">
                        Retour aux evaluations
                    </button>
                </div>
            </div>
        `;
    },

    quit() {
        if (Object.keys(this.answers).length > 0) {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmModalTitle').textContent = 'Quitter l\'evaluation';
            document.getElementById('confirmModalMessage').textContent =
                'Attention ! Si vous quittez, votre progression sera perdue et l\'evaluation sera consideree comme non terminee.';
            document.getElementById('confirmModalBtn').textContent = 'Quitter quand meme';
            document.getElementById('confirmModalBtn').onclick = () => {
                this.closeConfirmModal();
                window.history.back();
            };
            modal.classList.remove('hidden');
        } else {
            window.history.back();
        }
    },

    // ========== UTILS ==========
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveEvaluation = EleveEvaluation;
