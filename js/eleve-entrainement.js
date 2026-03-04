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
                    <div class="qcm-item-question">${escapeHtml(question.question)}</div>
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
                                <span class="qcm-option-text">${escapeHtml(option)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="qcm-item-feedback ${isVerified ? 'show' : ''} ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="qcm-item-feedback-header">
                        ${isCorrect ? '✓ Bonne réponse !' : (isAnswered ? '✗ Mauvaise réponse' : '⚠️ Non répondu')}
                    </div>
                    <div class="qcm-item-feedback-text">${escapeHtml(question.explanation || '')}</div>
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
    }
};

window.EleveEntrainement = EleveEntrainement;
