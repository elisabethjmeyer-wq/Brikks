/**
 * Moteur d'Entraînement Élève
 * Gère les différents formats d'exercices
 */

const EleveEntrainement = {
    // État
    training: null,
    steps: [],
    currentStepIndex: 0,
    currentQuestionIndex: 0,  // Index de la question dans l'étape actuelle
    answers: {},
    results: {},
    duration: 0,        // Durée totale en secondes (définie par l'admin)
    remainingTime: 0,   // Temps restant en secondes
    timerInterval: null,
    timeExpired: false,

    // Configuration des formats d'exercices (aligné avec Google Sheets FORMATS)
    formats: {
        // Formats de base
        qcm: {
            icon: '❓',
            label: 'QCM',
            render: 'renderQCM',
            verify: 'verifyQCM'
        },
        qcm_multiple: {
            icon: '☑️',
            label: 'QCM Multiple',
            render: 'renderQCMMultiple',
            verify: 'verifyQCMMultiple'
        },
        vrai_faux: {
            icon: '✅',
            label: 'Vrai ou Faux',
            render: 'renderVraiFaux',
            verify: 'verifyVraiFaux'
        },
        trous: {
            icon: '📝',
            label: 'Texte à trous',
            render: 'renderTrous',
            verify: 'verifyTrous'
        },
        association: {
            icon: '🔗',
            label: 'Association',
            render: 'renderAssociation',
            verify: 'verifyAssociation'
        },
        ordonner: {
            icon: '📋',
            label: 'Ordonner',
            render: 'renderOrdonner',
            verify: 'verifyOrdonner'
        },
        // Formats avancés
        question_ouverte: {
            icon: '✍️',
            label: 'Question ouverte',
            render: 'renderQuestionOuverte',
            verify: 'verifyQuestionOuverte'
        },
        image_cliquable: {
            icon: '🗺️',
            label: 'Image cliquable',
            render: 'renderImageCliquable',
            verify: 'verifyImageCliquable'
        },
        // Alias pour compatibilité avec anciennes données
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
        },
        timeline: {
            icon: '📅',
            label: 'Timeline',
            render: 'renderOrdonner',
            verify: 'verifyOrdonner'
        },
        chronologie: {
            icon: '🗓️',
            label: 'Chronologie',
            render: 'renderTrous',
            verify: 'verifyTrous'
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
        try {
            // Charger depuis Google Sheets via Apps Script
            const response = await this.callAPI('getEntrainement', { id: trainingId });

            if (!response.success || !response.data) {
                throw new Error(response.error || 'Entraînement non trouvé');
            }

            const data = response.data;

            // Configurer l'entraînement
            this.training = {
                id: data.id,
                titre: data.titre,
                niveau: data.niveau,
                chapitre_id: data.chapitre_id,
                description: data.description,
                type: data.niveau, // connaissances, savoir-faire, competences
                matiere: data.discipline || data.matiere || '',
                chapitre: data.chapitre_nom || data.chapitre || '',
                theme: data.theme_nom || ''
            };

            // Convertir durée en secondes (format: "10" pour 10 minutes)
            const dureeMinutes = parseInt(data.duree_estimee) || 10;
            this.duration = dureeMinutes * 60;
            this.remainingTime = this.duration;

            // Convertir les questions en steps
            this.steps = this.convertQuestionsToSteps(data.questions || []);

            // Initialiser les réponses
            this.answers = {};
            this.results = {};

        } catch (error) {
            console.error('Erreur chargement entraînement:', error);
            // Fallback sur données mock en cas d'erreur
            console.warn('Fallback sur données mock');
            this.loadMockData();
        }
    },

    /**
     * Appel API vers Google Apps Script
     */
    async callAPI(action, params = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        // Ajouter les paramètres
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });

        // Utiliser JSONP pour contourner CORS
        return new Promise((resolve, reject) => {
            const callbackName = 'entrainementCallback_' + Date.now();
            const script = document.createElement('script');

            window[callbackName] = (data) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
            };

            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            // Timeout après 15 secondes
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

    /**
     * Convertit les questions du format Sheet vers le format steps
     */
    convertQuestionsToSteps(questions) {
        // Mapping des format_id vers les types (fallback si format.type_base manquant)
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
            // Essayer d'obtenir le type de format de plusieurs façons
            let formatType = q.format?.type_base;

            if (!formatType && q.format_id) {
                formatType = formatIdToType[q.format_id] || formatIdToType[String(q.format_id).trim()];
            }

            // Dernier recours : essayer de déduire du nom du format
            if (!formatType && q.format?.nom) {
                const nom = q.format.nom.toLowerCase();
                if (nom.includes('qcm') && nom.includes('multiple')) formatType = 'qcm_multiple';
                else if (nom.includes('qcm')) formatType = 'qcm';
                else if (nom.includes('vrai') || nom.includes('faux')) formatType = 'vrai_faux';
                else if (nom.includes('trou')) formatType = 'trous';
                else if (nom.includes('association')) formatType = 'association';
                else if (nom.includes('ordonner') || nom.includes('ordre')) formatType = 'ordonner';
            }

            // Fallback final
            if (!formatType) formatType = 'qcm';

            const donnees = q.donnees || {};

            // Structure de base
            const step = {
                format: formatType,
                titre: q.enonce || donnees.question || donnees.consigne || 'Question',
                description: q.explication || donnees.explication || '',
                points: q.points || 1,
                question_id: q.id
            };

            // Adapter selon le format
            switch (formatType) {
                case 'qcm':
                    // Format connaissances: donnees.question, donnees.options, donnees.reponse_correcte
                    step.questions = [{
                        id: q.id,
                        question: donnees.question || q.enonce,
                        options: donnees.options || [],
                        correctIndex: donnees.reponse_correcte,
                        explanation: donnees.explication || q.explication
                    }];
                    break;

                case 'qcm_multiple':
                    step.questions = [{
                        id: q.id,
                        question: donnees.question || q.enonce,
                        options: donnees.options || [],
                        correctIndices: donnees.reponses_correctes || [],
                        explanation: donnees.explication || q.explication
                    }];
                    break;

                case 'vrai_faux':
                    // Format connaissances: donnees.question, donnees.reponse (vrai/faux)
                    step.questions = [{
                        id: q.id,
                        question: donnees.question || q.enonce,
                        correctAnswer: donnees.reponse === 'vrai' || donnees.reponse_correcte === true || donnees.reponse_correcte === 'vrai',
                        explanation: donnees.explication || q.explication
                    }];
                    break;

                case 'trous':
                case 'texte_trou':
                    // Format connaissances: donnees.texte avec {mot}
                    step.format = 'trous';
                    step.texte = donnees.texte || q.enonce;
                    // Extraire les trous du texte format {mot}
                    const matches = (donnees.texte || '').match(/\{([^}]+)\}/g) || [];
                    step.trous = matches.map((m, i) => ({
                        id: `trou_${i}`,
                        answer: m.replace(/[{}]/g, '')
                    }));
                    break;

                case 'association':
                    // Format connaissances: donnees.paires [{element1, element2}]
                    step.consigne = donnees.consigne || 'Associez les éléments';
                    step.paires = (donnees.paires || []).map((p, i) => ({
                        id: `pair_${i}`,
                        left: p.element1 || p.left,
                        right: p.element2 || p.right
                    }));
                    break;

                case 'chronologie':
                    // Format connaissances: donnees.paires [{date, evenement}], donnees.mode
                    step.format = 'chronologie';
                    step.consigne = donnees.consigne || 'Complétez la chronologie';
                    step.mode = donnees.mode || 'date_vers_evenement';
                    step.items = (donnees.paires || []).map((p, i) => {
                        const blankType = step.mode === 'date_vers_evenement' ? 'event' : 'date';
                        return {
                            date: p.date,
                            event: p.evenement,
                            blank: i > 0 ? blankType : null // Première ligne visible, les autres à compléter
                        };
                    });
                    break;

                case 'timeline':
                    // Format connaissances: donnees.evenements []
                    step.format = 'ordonner';
                    step.consigne = donnees.consigne || 'Remettez dans l\'ordre chronologique';
                    step.elements = (donnees.evenements || []).map((e, i) => ({
                        id: `evt_${i}`,
                        text: typeof e === 'string' ? e : e.titre || e.text || ''
                    }));
                    step.ordre_correct = step.elements.map((_, i) => i);
                    break;

                case 'ordonner':
                    step.elements = donnees.elements || [];
                    step.ordre_correct = donnees.ordre_correct || [];
                    break;

                case 'question_ouverte':
                    step.questions = [{
                        id: q.id,
                        question: donnees.question || q.enonce,
                        keywords: donnees.mots_cles || [],
                        correction: donnees.explication || q.explication
                    }];
                    break;

                case 'image_cliquable':
                    step.imageUrl = donnees.image_url || '';
                    step.zones = donnees.zones || [];
                    step.questions = donnees.questions || [];
                    break;

                default:
                    // Format inconnu, essayer de garder les données brutes
                    Object.assign(step, donnees);
            }

            return step;
        });
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

        // Build subtitle with available info
        const subtitleParts = [];
        if (this.training.matiere) subtitleParts.push(this.training.matiere);
        if (this.training.chapitre) subtitleParts.push(this.training.chapitre);
        const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' • ') : (this.training.description || '');
        document.getElementById('trainingSubtitle').textContent = subtitle;

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

        // Si toutes les questions ont été répondues, afficher le résumé de l'étape
        const allAnswered = step.questions.every(q => stepAnswers[q.id] !== undefined);
        if (allAnswered && this.currentQuestionIndex >= step.questions.length) {
            this.renderQCMStepSummary(step, stepAnswers);
            return;
        }

        // Sinon, afficher une seule question à la fois
        const currentQuestion = step.questions[this.currentQuestionIndex];
        if (!currentQuestion) {
            // Sécurité : si on dépasse le nombre de questions, afficher le résumé
            this.currentQuestionIndex = step.questions.length;
            this.renderQCM(step);
            return;
        }

        const questionResult = this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`];
        const isQuestionVerified = questionResult?.verified || false;
        const selectedOriginalIndex = stepAnswers[currentQuestion.id];
        const isAnswered = selectedOriginalIndex !== undefined;

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon qcm">${this.getFormatIcon('qcm')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">Question ${this.currentQuestionIndex + 1} / ${step.questions.length}</span>
                </div>

                <div class="exercise-body">
                    <div class="qcm-questions-list">
                        ${this.renderQCMQuestion(currentQuestion, this.currentQuestionIndex, stepAnswers, isQuestionVerified)}
                    </div>

                    <div class="exercise-actions">
                        ${this.renderQCMQuestionButtons(step, isAnswered, isQuestionVerified)}
                    </div>
                </div>
            </div>
        `;
    },

    renderQCMStepSummary(step, stepAnswers) {
        const container = document.getElementById('exerciseContainer');
        let correct = 0;
        let total = step.questions.length;

        step.questions.forEach(q => {
            if (stepAnswers[q.id] === q.correctIndex) {
                correct++;
            }
        });

        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        let scoreClass = 'success';
        if (score < 50) scoreClass = 'failure';
        else if (score < 80) scoreClass = 'partial';

        container.innerHTML = `
            <div class="exercise-card">
                <div class="exercise-header">
                    <div class="exercise-icon qcm">${this.getFormatIcon('qcm')}</div>
                    <div class="exercise-info">
                        <h2>${step.titre}</h2>
                        <p>${step.description}</p>
                    </div>
                    <span class="exercise-badge">✓ Étape complétée</span>
                </div>

                <div class="exercise-body">
                    <div class="step-summary">
                        <div class="step-summary-header ${scoreClass}">
                            <span class="step-summary-icon">${score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</span>
                            <div>
                                <h3>${score >= 80 ? 'Excellent !' : score >= 50 ? 'Bien joué !' : 'Continue tes efforts'}</h3>
                                <p><strong>${correct}/${total} bonnes réponses</strong></p>
                            </div>
                        </div>
                    </div>

                    <div class="exercise-actions">
                        ${this.renderQCMStepSummaryButtons()}
                    </div>
                </div>
            </div>
        `;
    },

    renderQCMQuestionButtons(step, isAnswered, isQuestionVerified) {
        let html = '';

        if (this.correctionMode) {
            // En mode correction, les réponses sont toujours vérifiées
            if (this.currentQuestionIndex < step.questions.length - 1) {
                html += `<button class="btn btn-primary" onclick="EleveEntrainement.nextQuestion()">Correction suivante</button>`;
            } else {
                html += `<button class="btn btn-primary" onclick="EleveEntrainement.backToResults()">Retour aux résultats</button>`;
            }
        } else {
            // Mode entraînement normal
            if (!isQuestionVerified && !isAnswered) {
                html += `<p style="color: var(--gray-500); text-align: center; margin-bottom: 16px;">Veuillez sélectionner une réponse</p>`;
            }

            if (isQuestionVerified) {
                // Après vérification, afficher bouton "Question suivante"
                if (this.currentQuestionIndex < step.questions.length - 1) {
                    html += `<button class="btn btn-primary" onclick="EleveEntrainement.nextQuestion()">Question suivante</button>`;
                } else {
                    html += `<button class="btn btn-success" onclick="EleveEntrainement.nextQuestion()">Voir le résumé</button>`;
                }
            } else if (isAnswered) {
                // Si répondu mais pas vérifiée, montrer bouton "Valider"
                html += `<button class="btn btn-success" onclick="EleveEntrainement.verifyCurrentQuestion()">Valider</button>`;
                html += `<button class="btn btn-secondary" onclick="EleveEntrainement.resetCurrentQuestion()" style="margin-left: 8px;">Changer de réponse</button>`;
            }
        }

        return html;
    },

    renderQCMStepSummaryButtons() {
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
        const questionResult = this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`];
        // Ne pas permettre la sélection si la question est déjà vérifiée
        if (questionResult?.verified) return;

        // Enregistrer la réponse (l'index original de la bonne réponse)
        this.answers[this.currentStepIndex][questionId] = originalIndex;

        // Re-render la question
        this.renderCurrentStep();
    },

    verifyCurrentQuestion() {
        const step = this.steps[this.currentStepIndex];
        const currentQuestion = step.questions[this.currentQuestionIndex];
        const stepAnswers = this.answers[this.currentStepIndex] || {};
        const selectedOriginalIndex = stepAnswers[currentQuestion.id];

        if (selectedOriginalIndex === undefined) return; // Ne pas vérifier si pas de réponse

        const isCorrect = selectedOriginalIndex === currentQuestion.correctIndex;
        this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`] = {
            verified: true,
            correct: isCorrect ? 1 : 0,
            total: 1,
            score: isCorrect ? 100 : 0
        };

        this.renderCurrentStep();
    },

    nextQuestion() {
        const step = this.steps[this.currentStepIndex];
        if (this.currentQuestionIndex < step.questions.length - 1) {
            this.currentQuestionIndex++;
            this.renderCurrentStep();
            window.scrollTo(0, 0);
        } else {
            // Passer au résumé de l'étape
            this.currentQuestionIndex = step.questions.length;
            this.renderCurrentStep();
            window.scrollTo(0, 0);
        }
    },

    resetCurrentQuestion() {
        const step = this.steps[this.currentStepIndex];
        const currentQuestion = step.questions[this.currentQuestionIndex];
        delete this.answers[this.currentStepIndex][currentQuestion.id];
        delete this.results[`${this.currentStepIndex}-${this.currentQuestionIndex}`];
        this.renderCurrentStep();
    },

    restartCurrentStep() {
        this.currentQuestionIndex = 0;
        delete this.answers[this.currentStepIndex];
        delete this.results[this.currentStepIndex];
        // Effacer tous les résultats des questions individuelles
        for (let i = 0; i < this.steps[this.currentStepIndex].questions.length; i++) {
            delete this.results[`${this.currentStepIndex}-${i}`];
        }
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
            this.currentQuestionIndex = 0;
            this.render();
        }
    },

    nextStep() {
        if (this.currentStepIndex < this.steps.length - 1) {
            this.currentStepIndex++;
            this.currentQuestionIndex = 0;
            this.render();
            window.scrollTo(0, 0);
        } else {
            // Si c'était la dernière étape, terminer l'entraînement
            this.finishTraining();
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

    // Terminer l'entraînement : calculer les résultats finaux à partir des questions vérifiées
    finishTraining() {
        // Combiner les résultats des questions individuelles pour chaque étape
        this.steps.forEach((step, stepIndex) => {
            let correct = 0;
            let total = step.questions.length;

            step.questions.forEach((q, qIndex) => {
                const questionResult = this.results[`${stepIndex}-${qIndex}`];

                // Si la question a été vérifiée, compter le résultat
                if (questionResult?.verified) {
                    if (questionResult.correct === 1) {
                        correct++;
                    }
                } else if (this.answers[stepIndex]?.[q.id] !== undefined) {
                    // Si pas vérifiée mais répondue, faire la vérification
                    const stepAnswers = this.answers[stepIndex] || {};
                    const isCorrect = this.checkQuestionAnswer(q, stepAnswers, step);
                    if (isCorrect) {
                        correct++;
                    }
                    // Marquer comme vérifié pour le mode correction
                    this.results[`${stepIndex}-${qIndex}`] = {
                        verified: true,
                        correct: isCorrect ? 1 : 0,
                        total: 1,
                        score: isCorrect ? 100 : 0
                    };
                }
            });

            // Créer le résultat global de l'étape
            this.results[stepIndex] = {
                verified: true,
                correct,
                total,
                score: total > 0 ? Math.round((correct / total) * 100) : 0
            };
        });

        // Afficher les résultats
        this.showResults();
    },

    // Fonction utilitaire pour vérifier une réponse selon le format
    checkQuestionAnswer(question, stepAnswers, step) {
        const format = step.format;

        switch (format) {
            case 'qcm':
                return stepAnswers[question.id] === question.correctIndex;
            case 'vrai_faux':
                return stepAnswers[question.id] === question.correctAnswer;
            case 'qcm_multiple':
                const selections = stepAnswers.selections?.[question.id] || [];
                const correctIndices = question.correctIndices || [];
                return selections.length === correctIndices.length &&
                    selections.every(idx => correctIndices.includes(idx));
            default:
                return false;
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
        const isConnaissances = this.training.type === 'connaissances' || this.training.niveau === 'connaissances';
        const passThreshold = 80;
        const isPassed = globalScore >= passThreshold;

        let headerClass = 'success';
        let icon = '🏆';
        let message = 'Bravo, entraînement terminé !';

        if (isConnaissances) {
            // Pour les entraînements de connaissances, indiquer clairement réussi/échoué
            if (isPassed) {
                headerClass = 'success';
                icon = '🎉';
                message = 'Entraînement réussi !';
            } else {
                headerClass = 'failure';
                icon = '💪';
                message = 'Entraînement non validé';
            }
        } else {
            // Pour les autres types, comportement original
            if (globalScore < 50) {
                headerClass = 'failure';
                icon = '💪';
                message = 'Continue tes efforts !';
            } else if (globalScore < 80) {
                headerClass = 'partial';
                icon = '👍';
                message = 'Bien joué !';
            }
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
                    ${isConnaissances ? `
                        <div class="threshold-indicator ${isPassed ? 'passed' : 'failed'}">
                            <div class="threshold-bar">
                                <div class="threshold-fill" style="width: ${Math.min(globalScore, 100)}%"></div>
                                <div class="threshold-marker" style="left: ${passThreshold}%">
                                    <span class="threshold-label">${passThreshold}%</span>
                                </div>
                            </div>
                            <p class="threshold-message">
                                ${isPassed
                                    ? `✓ Tu as atteint le seuil de ${passThreshold}% requis pour valider !`
                                    : `✗ Il te faut ${passThreshold}% pour valider (${passThreshold - globalScore}% de plus)`
                                }
                            </p>
                        </div>
                    ` : ''}

                    <div class="final-score">
                        <div class="final-score-item">
                            <div class="final-score-value ${isPassed && isConnaissances ? 'passed' : ''}">${globalScore}%</div>
                            <div class="final-score-label">Score global</div>
                        </div>
                        <div class="final-score-item">
                            <div class="final-score-value">${totalCorrect}/${totalQuestions}</div>
                            <div class="final-score-label">Bonnes réponses</div>
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
        this.currentQuestionIndex = 0;
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
        this.currentQuestionIndex = 0;
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
                                const isCorrect = isVerified && stepAnswers.connections[index] === index;
                                const isActive = stepAnswers.activeLeft === index;

                                return `
                                    <div class="association-item ${isActive ? 'active' : ''} ${isConnected ? 'connected' : ''} ${isVerified && isConnected ? (isCorrect ? 'correct' : 'incorrect') : ''}"
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
                                const connectedLeft = Object.keys(stepAnswers.connections).find(k => stepAnswers.connections[k] === item.originalIndex);
                                const isCorrect = isVerified && connectedLeft !== undefined && parseInt(connectedLeft) === item.originalIndex;

                                return `
                                    <div class="association-item ${isConnected ? 'connected' : ''} ${isVerified ? (isCorrect ? 'correct' : (isConnected ? 'incorrect' : '')) : ''}"
                                         data-original="${item.originalIndex}"
                                         onclick="EleveEntrainement.selectAssociationRight(${item.originalIndex})">
                                        ${this.escapeHtml(item.text)}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <div class="exercise-actions">
                        ${!isVerified ? `<button class="btn btn-secondary" onclick="EleveEntrainement.resetAssociations()">Réinitialiser</button>` : ''}
                        ${this.renderNavigationButtons()}
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

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveEntrainement = EleveEntrainement;
