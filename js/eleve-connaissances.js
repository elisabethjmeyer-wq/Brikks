/**
 * Connaissances Élève - Logique JavaScript
 * Gestion des entraînements de connaissances pour les élèves
 * Utilise le système ENTRAINEMENTS_CONN
 */

const EleveConnaissances = {
    // Données
    banques: [],
    entrainements: [],
    etapes: [],
    etapeQuestions: [],
    formatsQuestions: [],
    resultats: [],

    // État
    currentUser: null,
    currentBanque: null,
    currentEntrainement: null,
    currentEtapeIndex: 0,
    expandedBanques: new Set(),
    timer: null,
    timeRemaining: 0,
    exerciseStartTime: null,
    userAnswers: {},

    // Cache config (5 minutes TTL)
    CACHE_KEY: 'brikks_conn_eleve_cache',
    CACHE_RESULTATS_KEY: 'brikks_conn_resultats_cache',
    CACHE_TTL: 5 * 60 * 1000,

    /**
     * Initialise la page de connaissances
     */
    async init() {
        this.currentUser = await this.getCurrentUser();

        // Try cache first
        const cached = this.loadFromCache();
        if (cached) {
            this.applyData(cached);
            this.renderAccordionView();
            this.refreshDataInBackground();
        } else {
            this.showLoader('Chargement des entraînements...');
            try {
                await this.loadData();
                this.renderAccordionView();
            } catch (error) {
                console.error('Erreur lors du chargement:', error);
                this.showError('Erreur lors du chargement des entraînements');
            }
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser() {
        try {
            if (typeof Auth !== 'undefined' && Auth.user) return Auth.user;
            const session = localStorage.getItem('brikks_session');
            if (session) return JSON.parse(session);
            return null;
        } catch (e) {
            return null;
        }
    },

    // Cache methods
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data;
            }
            return null;
        } catch (e) { return null; }
    },

    saveToCache(data) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        } catch (e) {}
    },

    applyData(data) {
        this.banques = (data.banques || []).filter(b => b.statut === 'publie');
        this.entrainements = (data.entrainements || []).filter(e => e.statut === 'publie');
        this.etapes = data.etapes || [];
        this.etapeQuestions = data.etapeQuestions || [];
        this.formatsQuestions = data.formatsQuestions || [];
        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        this.entrainements.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    },

    async loadData() {
        const [banquesResult, entrainementsResult, etapesResult, etapeQuestionsResult, formatsResult] = await Promise.all([
            this.callAPI('getBanquesExercicesConn'),
            this.callAPI('getEntrainementsConn'),
            this.callAPI('getEtapesConn'),
            this.callAPI('getEtapeQuestionsConn', {}),
            this.callAPI('getFormatsQuestions')
        ]);

        const data = {
            banques: banquesResult.success ? banquesResult.data : [],
            entrainements: entrainementsResult.success ? entrainementsResult.data : [],
            etapes: etapesResult.success ? etapesResult.data : [],
            etapeQuestions: etapeQuestionsResult.success ? etapeQuestionsResult.data : [],
            formatsQuestions: formatsResult.success ? formatsResult.data : []
        };

        this.saveToCache(data);
        this.applyData(data);
    },

    async refreshDataInBackground() {
        try {
            await this.loadData();
        } catch (error) {}
    },

    callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');
            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };
            const queryParams = new URLSearchParams({ action, callback: callbackName, ...params });
            script.src = `${CONFIG.WEBAPP_URL}?${queryParams.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed'));
            };
            document.body.appendChild(script);
        });
    },

    /**
     * Render the accordion view with blue header banner
     */
    renderAccordionView() {
        const container = document.getElementById('connaissances-content');

        if (this.banques.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Calculate global stats
        const totalEntrainements = this.entrainements.filter(e =>
            this.banques.some(b => b.id === e.banque_exercice_id)
        ).length;

        // TODO: Add real progress tracking from resultats
        const completedEntrainements = 0;
        const progressPercent = totalEntrainements > 0 ? Math.round((completedEntrainements / totalEntrainements) * 100) : 0;

        // Group entrainements by banque
        const entrainementsByBanque = {};
        this.entrainements.forEach(ent => {
            if (!entrainementsByBanque[ent.banque_exercice_id]) {
                entrainementsByBanque[ent.banque_exercice_id] = [];
            }
            entrainementsByBanque[ent.banque_exercice_id].push(ent);
        });

        let html = `
            <!-- Bandeau bleu -->
            <div class="type-header-banner connaissances">
                <div class="type-header-left">
                    <div class="type-icon-emoji">📚</div>
                    <div>
                        <h2 class="type-title">Entraînement de connaissances</h2>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat">
                        <div class="type-stat-value">${this.banques.length}</div>
                        <div class="type-stat-label">Banques</div>
                    </div>
                    <div class="type-stat">
                        <div class="type-stat-value">${totalEntrainements}</div>
                        <div class="type-stat-label">Entraînements</div>
                    </div>
                </div>
            </div>

            <!-- Barre de progression séparée -->
            <div class="conn-progress-section">
                <div class="conn-progress-header">
                    <span class="conn-progress-title">Ma progression</span>
                    <span class="conn-progress-value">${completedEntrainements}/${totalEntrainements} entraînements terminés</span>
                </div>
                <div class="conn-progress-bar">
                    <div class="conn-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
            </div>

            <!-- Barre de recherche -->
            <div class="conn-search-section">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="banqueSearch" placeholder="Rechercher une banque ou un entraînement..." oninput="EleveConnaissances.filterBanques(this.value)">
                </div>
            </div>

            <!-- Liste des banques en accordéon -->
            <div class="banques-accordion">
        `;

        this.banques.forEach(banque => {
            const banqueEntrainements = entrainementsByBanque[banque.id] || [];
            const total = banqueEntrainements.length;
            const completed = 0; // TODO: real data
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isExpanded = this.expandedBanques.has(banque.id);

            // Progress ring calculation
            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percent / 100) * circumference;

            html += `
                <div class="banque-accordion-item connaissances${isExpanded ? ' expanded' : ''}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveConnaissances.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${this.escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">${total} entraînement${total !== 1 ? 's' : ''}</div>
                        </div>
                        <div class="banque-progress">
                            <div class="progress-ring">
                                <svg viewBox="0 0 44 44">
                                    <circle class="progress-ring-bg" cx="22" cy="22" r="${radius}"/>
                                    <circle class="progress-ring-fill" cx="22" cy="22" r="${radius}"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${offset}"/>
                                </svg>
                                <span class="progress-ring-text">${percent}%</span>
                            </div>
                            <span class="progress-count">${completed}/${total}</span>
                        </div>
                    </button>
                    <div class="banque-accordion-content">
                        <div class="exercices-accordion-list">
                            ${this.renderEntrainementsList(banqueEntrainements)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Render entrainements list for a banque
     */
    renderEntrainementsList(entrainements) {
        if (entrainements.length === 0) {
            return '<div class="empty-state" style="padding: 2rem;"><p>Aucun entraînement dans cette banque</p></div>';
        }

        return entrainements.map((ent, index) => {
            const etapesCount = this.etapes.filter(e => e.entrainement_id === ent.id).length;
            const isCompleted = false; // TODO: real data
            const dureeMinutes = ent.duree ? Math.floor(ent.duree / 60) : null;

            return `
                <div class="exercice-item connaissances${isCompleted ? ' completed' : ''}"
                     onclick="EleveConnaissances.startEntrainement('${ent.id}')">
                    <div class="exercice-numero">${index + 1}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${this.escapeHtml(ent.titre || 'Entraînement ' + (index + 1))}</div>
                        <div class="exercice-meta">
                            ${etapesCount} étape${etapesCount !== 1 ? 's' : ''}
                            ${dureeMinutes ? ` • ${dureeMinutes} min` : ''}
                        </div>
                    </div>
                    <span class="exercice-status ${isCompleted ? 'completed' : 'new'}">${isCompleted ? 'Terminé' : 'Nouveau'}</span>
                    <span class="exercice-arrow">→</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Toggle banque accordion
     */
    toggleBanque(banqueId) {
        const item = document.querySelector(`.banque-accordion-item[data-banque-id="${banqueId}"]`);
        if (!item) return;

        if (this.expandedBanques.has(banqueId)) {
            this.expandedBanques.delete(banqueId);
            item.classList.remove('expanded');
        } else {
            this.expandedBanques.add(banqueId);
            item.classList.add('expanded');
        }
    },

    /**
     * Filter banques by search term
     */
    filterBanques(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const items = document.querySelectorAll('.banque-accordion-item');

        items.forEach(item => {
            const title = item.querySelector('.banque-title')?.textContent.toLowerCase() || '';
            const exercices = item.querySelectorAll('.exercice-item');
            let hasMatch = title.includes(term);

            exercices.forEach(exo => {
                const exoTitle = exo.querySelector('.exercice-titre')?.textContent.toLowerCase() || '';
                if (exoTitle.includes(term)) {
                    hasMatch = true;
                    exo.style.display = '';
                } else {
                    exo.style.display = term ? 'none' : '';
                }
            });

            item.style.display = hasMatch || !term ? '' : 'none';

            if (hasMatch && term) {
                this.expandedBanques.add(item.dataset.banqueId);
                item.classList.add('expanded');
            }
        });
    },

    /**
     * Start an entrainement
     */
    async startEntrainement(entrainementId) {
        this.showLoader('Chargement de l\'entraînement...');

        try {
            const entrainement = this.entrainements.find(e => e.id === entrainementId);
            if (!entrainement) {
                this.showError('Entraînement non trouvé');
                return;
            }

            this.currentEntrainement = entrainement;
            this.currentBanque = this.banques.find(b => b.id === entrainement.banque_exercice_id);
            this.currentEtapeIndex = 0;
            this.userAnswers = {};
            this.exerciseStartTime = Date.now();

            // Get etapes for this entrainement
            const entrainementEtapes = this.etapes
                .filter(e => e.entrainement_id === entrainementId)
                .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

            if (entrainementEtapes.length === 0) {
                this.showError('Cet entraînement n\'a pas encore d\'étapes configurées');
                return;
            }

            this.currentEtapes = entrainementEtapes;
            this.renderEntrainementView();

        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors du chargement de l\'entraînement');
        }
    },

    /**
     * Render the entrainement view with blue banner and steps
     */
    renderEntrainementView() {
        const ent = this.currentEntrainement;
        const banque = this.currentBanque;
        const etapes = this.currentEtapes;
        const currentEtape = etapes[this.currentEtapeIndex];

        const container = document.getElementById('connaissances-content');

        // Get questions for current etape
        const etapeQuestions = this.etapeQuestions
            .filter(eq => eq.etape_id === currentEtape.id)
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        container.innerHTML = `
            <div class="exercise-view">
                <button class="exercise-back-btn" onclick="EleveConnaissances.backToList()">
                    ← Retour aux entraînements
                </button>

                <div class="exercise-card">
                    <!-- Bandeau bleu avec titre et timer -->
                    <div class="exercise-header connaissances">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${banque ? this.escapeHtml(banque.titre) : ''} - ${this.escapeHtml(ent.titre)}</h1>
                                <div class="exercise-header-meta">Étape ${this.currentEtapeIndex + 1}/${etapes.length}</div>
                            </div>
                        </div>
                        ${ent.duree ? `
                            <div class="exercise-timer" id="exerciseTimer">
                                <span id="timerDisplay">${this.formatTime(ent.duree)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Barre de progression des étapes -->
                    <div class="etapes-progress">
                        ${etapes.map((etape, idx) => `
                            <div class="etape-dot ${idx < this.currentEtapeIndex ? 'completed' : ''} ${idx === this.currentEtapeIndex ? 'current' : ''}"
                                 title="Étape ${idx + 1}">
                                ${idx + 1}
                            </div>
                        `).join('<div class="etape-connector"></div>')}
                    </div>

                    <!-- Titre de l'étape -->
                    <div class="etape-header">
                        <h2>${this.escapeHtml(currentEtape.titre || 'Étape ' + (this.currentEtapeIndex + 1))}</h2>
                        <span class="etape-format-badge">${this.getFormatLabel(currentEtape.format_code)}</span>
                    </div>

                    <!-- Contenu de l'étape (questions) -->
                    <div class="exercise-content">
                        ${this.renderEtapeContent(currentEtape, etapeQuestions)}
                    </div>

                    <div class="result-banner" id="resultBanner"></div>

                    <!-- Actions -->
                    <div class="exercise-actions">
                        ${this.currentEtapeIndex > 0 ? `
                            <button class="btn btn-secondary" onclick="EleveConnaissances.previousEtape()">
                                ← Étape précédente
                            </button>
                        ` : ''}
                        <button class="btn btn-verifier" onclick="EleveConnaissances.validateEtape()">
                            Vérifier mes réponses
                        </button>
                        ${this.currentEtapeIndex < etapes.length - 1 ? `
                            <button class="btn btn-primary" onclick="EleveConnaissances.nextEtape()">
                                Étape suivante →
                            </button>
                        ` : `
                            <button class="btn btn-success" onclick="EleveConnaissances.finishEntrainement()">
                                Terminer l'entraînement
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        if (ent.duree && !this.timer) {
            this.startTimer(ent.duree);
        }
    },

    /**
     * Render the content of an etape based on its format
     */
    renderEtapeContent(etape, questions) {
        const format = etape.format_code;

        // Parse donnees if it's a string
        let donnees = etape.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        switch (format) {
            case 'vrai_faux':
                return this.renderVraiFaux(donnees, questions);
            case 'qcm':
                return this.renderQCM(donnees, questions);
            case 'chronologie':
                return this.renderChronologie(donnees, questions);
            case 'timeline':
                return this.renderTimeline(donnees, questions);
            case 'texte_trous':
                return this.renderTexteTrous(donnees, questions);
            default:
                return `<div class="unsupported-format">Format non supporté: ${format}</div>`;
        }
    },

    /**
     * Render Vrai/Faux questions
     */
    renderVraiFaux(donnees, questions) {
        const question = donnees.question || donnees.enonce || '';
        const items = donnees.propositions || [];

        return `
            <div class="vrai-faux-container">
                ${question ? `<div class="question-enonce">${this.escapeHtml(question)}</div>` : ''}
                <div class="vrai-faux-items">
                    ${items.map((item, idx) => `
                        <div class="vrai-faux-item" data-index="${idx}">
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
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render QCM questions
     */
    renderQCM(donnees, questions) {
        const question = donnees.question || donnees.enonce || '';
        const choices = donnees.choix || [];
        const multiple = donnees.multiple || false;

        return `
            <div class="qcm-container">
                ${question ? `<div class="question-enonce">${this.escapeHtml(question)}</div>` : ''}
                <div class="qcm-choices">
                    ${choices.map((choice, idx) => `
                        <label class="qcm-choice">
                            <input type="${multiple ? 'checkbox' : 'radio'}"
                                   name="qcm_answer"
                                   value="${idx}"
                                   onchange="EleveConnaissances.saveAnswer('qcm', ${multiple} ? this.parentElement : '${idx}')">
                            <span class="qcm-label">${this.escapeHtml(choice.texte || choice)}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="qcm-feedback" id="feedback_qcm" style="display: none;"></div>
            </div>
        `;
    },

    /**
     * Render Chronologie (Timeline ordering)
     */
    renderChronologie(donnees, questions) {
        const events = donnees.evenements || [];
        const mode = donnees.mode || 'date'; // 'date' or 'evenement'

        // Shuffle for student
        const shuffled = [...events].sort(() => Math.random() - 0.5);

        return `
            <div class="chronologie-container">
                <p class="chrono-instruction">
                    ${mode === 'date' ?
                        'Associez chaque événement à sa date en faisant glisser les éléments.' :
                        'Replacez les événements dans l\'ordre chronologique.'}
                </p>
                <div class="chrono-timeline" id="chronoTimeline">
                    ${shuffled.map((evt, idx) => `
                        <div class="chrono-card" draggable="true" data-id="${idx}" data-date="${evt.date}">
                            <div class="chrono-card-content">
                                ${mode === 'date' ?
                                    `<span class="chrono-event">${this.escapeHtml(evt.evenement)}</span>
                                     <input type="text" class="chrono-date-input" placeholder="Date ?" data-index="${idx}">` :
                                    `<span class="chrono-date">${this.escapeHtml(evt.date)}</span>
                                     <span class="chrono-event">${this.escapeHtml(evt.evenement)}</span>`
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render Timeline (Flip cards)
     */
    renderTimeline(donnees, questions) {
        const cartes = donnees.cartes || [];

        // Shuffle for student
        const shuffled = [...cartes].sort(() => Math.random() - 0.5);

        return `
            <div class="timeline-container">
                <p class="timeline-instruction">Replacez les événements dans l'ordre chronologique en les faisant glisser.</p>
                <div class="timeline-cards" id="timelineCards">
                    ${shuffled.map((carte, idx) => `
                        <div class="timeline-flip-card" draggable="true" data-id="${idx}" data-date="${carte.date}">
                            <div class="flip-card-inner">
                                <div class="flip-card-front" ${carte.image_url ? `style="background-image: url('${this.escapeHtml(carte.image_url)}')"` : ''}>
                                    <span class="flip-card-titre">${this.escapeHtml(carte.titre)}</span>
                                </div>
                                <div class="flip-card-back">
                                    <span class="flip-card-date">${this.escapeHtml(carte.date)}</span>
                                    ${carte.explication ? `<p class="flip-card-explication">${this.escapeHtml(carte.explication)}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Render Texte à trous
     */
    renderTexteTrous(donnees, questions) {
        let texte = donnees.texte || '';
        const mots = donnees.mots || [];

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
            </div>
        `;
    },

    /**
     * Save an answer
     */
    saveAnswer(key, value) {
        this.userAnswers[key] = value;
    },

    /**
     * Validate current etape
     */
    validateEtape() {
        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        let donnees = currentEtape.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        let correct = 0;
        let total = 0;

        switch (currentEtape.format_code) {
            case 'vrai_faux':
                const propositions = donnees.propositions || [];
                propositions.forEach((prop, idx) => {
                    total++;
                    const answer = this.userAnswers[`vf_${idx}`];
                    const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                    const isCorrect = answer === expected;
                    if (isCorrect) correct++;

                    const feedback = document.getElementById(`feedback_vf_${idx}`);
                    if (feedback) {
                        feedback.style.display = 'block';
                        feedback.className = `vf-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
                        feedback.textContent = isCorrect ? '✓ Correct' : `✗ La bonne réponse était: ${expected}`;
                        if (!isCorrect && prop.feedback) {
                            feedback.textContent += ` - ${prop.feedback}`;
                        }
                    }
                });
                break;

            case 'qcm':
                total = 1;
                const choices = donnees.choix || [];
                const userAnswer = this.userAnswers['qcm'];
                const correctIndices = choices
                    .map((c, i) => c.correct ? i : -1)
                    .filter(i => i >= 0);

                if (correctIndices.includes(parseInt(userAnswer))) {
                    correct = 1;
                }

                const qcmFeedback = document.getElementById('feedback_qcm');
                if (qcmFeedback) {
                    qcmFeedback.style.display = 'block';
                    qcmFeedback.className = `qcm-feedback ${correct === 1 ? 'correct' : 'incorrect'}`;
                    qcmFeedback.textContent = correct === 1 ? '✓ Correct !' : `✗ Ce n'est pas la bonne réponse.`;
                }
                break;

            // Add more format validations as needed
        }

        // Show result banner
        const banner = document.getElementById('resultBanner');
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
        if (banner) {
            banner.className = `result-banner show ${percent === 100 ? 'success' : percent >= 50 ? 'partial' : 'error'}`;
            banner.textContent = `Score: ${correct}/${total} (${percent}%)`;
        }
    },

    /**
     * Navigate to previous etape
     */
    previousEtape() {
        if (this.currentEtapeIndex > 0) {
            this.currentEtapeIndex--;
            this.renderEntrainementView();
        }
    },

    /**
     * Navigate to next etape
     */
    nextEtape() {
        if (this.currentEtapeIndex < this.currentEtapes.length - 1) {
            this.currentEtapeIndex++;
            this.renderEntrainementView();
        }
    },

    /**
     * Finish the entrainement
     */
    finishEntrainement() {
        this.stopTimer();
        // TODO: Save results to backend

        const container = document.getElementById('connaissances-content');
        container.innerHTML = `
            <div class="completion-view">
                <div class="completion-icon">🎉</div>
                <h2>Entraînement terminé !</h2>
                <p>Vous avez complété toutes les étapes de cet entraînement.</p>
                <button class="btn btn-primary" onclick="EleveConnaissances.backToList()">
                    Retour aux entraînements
                </button>
            </div>
        `;
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

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    startTimer(duration) {
        this.timeRemaining = duration;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                // Could show time up notification
            }
        }, 1000);
    },

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    updateTimerDisplay() {
        const display = document.getElementById('timerDisplay');
        const timer = document.getElementById('exerciseTimer');
        if (display) {
            display.textContent = this.formatTime(this.timeRemaining);
        }
        if (timer && this.timeRemaining <= 60) {
            timer.classList.add('warning');
        }
    },

    getFormatLabel(formatCode) {
        const labels = {
            'vrai_faux': 'Vrai/Faux',
            'qcm': 'QCM',
            'chronologie': 'Chronologie',
            'timeline': 'Frise chronologique',
            'texte_trous': 'Texte à trous'
        };
        return labels[formatCode] || formatCode;
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};
