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
    questionsConnaissances: [],  // Contenu des questions avec donnees
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

        // Clear cache for debugging
        localStorage.removeItem(this.CACHE_KEY);
        console.log('[EleveConnaissances] Cache vidé, chargement des données fraîches...');

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
        // TODO: Remettre le filtre statut === 'publie' en production
        // Pour l'instant, on affiche tout pour le test
        this.banques = data.banques || [];
        this.entrainements = data.entrainements || [];
        this.etapes = data.etapes || [];
        this.etapeQuestions = data.etapeQuestions || [];
        this.formatsQuestions = data.formatsQuestions || [];
        this.questionsConnaissances = data.questionsConnaissances || [];  // Questions avec donnees
        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        this.entrainements.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Debug log
        console.log('[EleveConnaissances] Données chargées:', {
            banques: this.banques.length,
            entrainements: this.entrainements.length,
            etapes: this.etapes.length,
            etapeQuestions: this.etapeQuestions.length,
            questionsConnaissances: this.questionsConnaissances.length,
            data: data
        });
    },

    async loadData() {
        const [banquesResult, entrainementsResult, etapesResult, etapeQuestionsResult, formatsResult, questionsResult] = await Promise.all([
            this.callAPI('getBanquesExercicesConn'),
            this.callAPI('getEntrainementsConn'),
            this.callAPI('getEtapesConn'),
            this.callAPI('getEtapeQuestionsConn', {}),
            this.callAPI('getFormatsQuestions'),
            this.callAPI('getQuestionsConnaissances', {})  // Charger le contenu des questions
        ]);

        const data = {
            banques: banquesResult.success ? banquesResult.data : [],
            entrainements: entrainementsResult.success ? entrainementsResult.data : [],
            etapes: etapesResult.success ? etapesResult.data : [],
            etapeQuestions: etapeQuestionsResult.success ? etapeQuestionsResult.data : [],
            formatsQuestions: formatsResult.success ? formatsResult.data : [],
            questionsConnaissances: questionsResult.success ? questionsResult.data : []  // Contenu avec donnees
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
            const isCompleted = false; // TODO: real data
            const dureeMinutes = ent.duree || 15; // durée en minutes

            // Construire les métadonnées
            let metaItems = [];
            metaItems.push(`${dureeMinutes} min`);
            if (ent.description) {
                metaItems.push(this.escapeHtml(ent.description));
            }

            return `
                <div class="exercice-item connaissances${isCompleted ? ' completed' : ''}"
                     onclick="EleveConnaissances.startEntrainement('${ent.id}')">
                    <div class="exercice-numero">${index + 1}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${this.escapeHtml(ent.titre || 'Entraînement ' + (index + 1))}</div>
                        <div class="exercice-meta">${metaItems.join(' • ')}</div>
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
            console.log('[EleveConnaissances] startEntrainement:', entrainementId);
            console.log('[EleveConnaissances] Toutes les étapes:', this.etapes);

            const entrainement = this.entrainements.find(e => e.id === entrainementId);
            if (!entrainement) {
                this.showError('Entraînement non trouvé');
                return;
            }

            console.log('[EleveConnaissances] Entrainement trouvé:', entrainement);

            this.currentEntrainement = entrainement;
            this.currentBanque = this.banques.find(b => b.id === entrainement.banque_exercice_id);
            this.currentEtapeIndex = 0;
            this.userAnswers = {};
            this.exerciseStartTime = Date.now();

            // Get etapes for this entrainement
            const entrainementEtapes = this.etapes
                .filter(e => e.entrainement_id === entrainementId)
                .sort((a, b) => {
                    // Utiliser ordre si disponible, sinon l'ID (qui contient un timestamp)
                    const ordreA = a.ordre !== '' && a.ordre !== undefined ? Number(a.ordre) : Infinity;
                    const ordreB = b.ordre !== '' && b.ordre !== undefined ? Number(b.ordre) : Infinity;
                    if (ordreA !== ordreB) return ordreA - ordreB;
                    // Fallback: trier par ID (timestamp)
                    return String(a.id).localeCompare(String(b.id));
                });

            console.log('[EleveConnaissances] Étapes trouvées pour cet entrainement:', entrainementEtapes);

            if (entrainementEtapes.length === 0) {
                // Pas d'étapes - afficher un message mais quand même permettre de voir l'entraînement
                console.warn('[EleveConnaissances] Aucune étape trouvée, vérifier la structure des données');
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
                                <span id="timerDisplay">${this.formatTime(ent.duree * 60)}</span>
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
     * Jointure: etape → etapeQuestions → questionsConnaissances (pour obtenir donnees)
     */
    renderEtapeContent(etape, questions) {
        const format = etape.format_code;

        console.log('[EleveConnaissances] renderEtapeContent - etape:', etape);
        console.log('[EleveConnaissances] renderEtapeContent - format:', format);

        // 1. Trouver les questions liées à cette étape via ETAPE_QUESTIONS_CONN
        const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
            String(eq.etape_id) === String(etape.id)
        );
        console.log('[EleveConnaissances] Questions liées (refs):', linkedQuestionRefs);

        // 2. Récupérer le contenu des questions depuis QUESTIONS_CONNAISSANCES
        let donnees = {};
        if (linkedQuestionRefs.length > 0) {
            // Prendre la première question (pour les formats simples)
            const questionRef = linkedQuestionRefs[0];
            console.log('[EleveConnaissances] Recherche question_id:', questionRef.question_id);
            console.log('[EleveConnaissances] IDs disponibles dans questionsConnaissances:',
                this.questionsConnaissances.map(q => q.id));

            const questionContent = this.questionsConnaissances.find(q =>
                String(q.id) === String(questionRef.question_id)
            );
            console.log('[EleveConnaissances] Contenu question trouvé:', questionContent);

            if (questionContent && questionContent.donnees) {
                donnees = questionContent.donnees;
                // Parse si c'est une string JSON
                if (typeof donnees === 'string') {
                    try {
                        donnees = JSON.parse(donnees);
                    } catch (e) {
                        console.error('[EleveConnaissances] Erreur parsing donnees:', e);
                        donnees = {};
                    }
                }
            }
        }

        // 3. Si toujours pas de donnees, essayer depuis l'étape directement (fallback)
        if (Object.keys(donnees).length === 0 && etape.donnees) {
            let etapeDonnees = etape.donnees;
            if (typeof etapeDonnees === 'string') {
                try {
                    etapeDonnees = JSON.parse(etapeDonnees);
                } catch (e) {
                    etapeDonnees = {};
                }
            }
            if (etapeDonnees && typeof etapeDonnees === 'object') {
                donnees = etapeDonnees;
            }
        }

        console.log('[EleveConnaissances] renderEtapeContent - donnees finales:', donnees);

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
            case 'association':
                return this.renderAssociation(donnees, questions);
            default:
                return `<div class="unsupported-format">Format non supporté: ${format}<br><small>Données: ${JSON.stringify(donnees)}</small></div>`;
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

        return `
            <div class="vrai-faux-container">
                ${questionText ? `<div class="question-enonce">${this.escapeHtml(questionText)}</div>` : ''}
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
     * Format admin: {consigne, mode, paires: [{date, evenement}, ...]}
     * Affiche une frise chronologique visuelle avec flèche
     */
    renderChronologie(donnees, questions) {
        // Accepter 'paires' ou 'evenements' comme nom de champ
        const events = donnees.paires || donnees.evenements || [];
        const mode = donnees.mode || 'date'; // 'date' or 'evenement'
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

        // Mélanger les événements pour le drag & drop
        const shuffledEvents = this.shuffleArray([...events]);

        // Instruction par défaut ou personnalisée
        const defaultInstruction = 'Placez les événements sur la frise chronologique';

        return `
            <div class="chronologie-container">
                <p class="chrono-instruction">${this.escapeHtml(consigne || defaultInstruction)}</p>

                <!-- Frise chronologique avec flèche -->
                <div class="chrono-frise-wrapper">
                    <div class="chrono-frise">
                        <div class="chrono-ligne">
                            <div class="chrono-fleche"></div>
                        </div>
                        <div class="chrono-points">
                            ${sortedEvents.map((evt, idx) => `
                                <div class="chrono-point-container" data-index="${idx}" data-date="${evt.date}">
                                    <div class="chrono-date-label">${this.escapeHtml(String(evt.date))}</div>
                                    <div class="chrono-point"></div>
                                    <div class="chrono-drop-zone"
                                         data-index="${idx}"
                                         ondragover="event.preventDefault(); this.classList.add('drag-over')"
                                         ondragleave="this.classList.remove('drag-over')"
                                         ondrop="EleveConnaissances.dropChronoEvent(event, ${idx})">
                                        <span class="chrono-placeholder">?</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Événements à placer -->
                <div class="chrono-events-pool">
                    <p class="chrono-pool-label">Événements à placer :</p>
                    <div class="chrono-events-list">
                        ${shuffledEvents.map((evt, idx) => `
                            <div class="chrono-event-card"
                                 draggable="true"
                                 data-event="${this.escapeHtml(evt.evenement)}"
                                 data-correct-date="${evt.date}"
                                 ondragstart="EleveConnaissances.dragChronoEvent(event)">
                                ${this.escapeHtml(evt.evenement)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // Drag & Drop pour chronologie
    dragChronoEvent(event) {
        event.dataTransfer.setData('text/plain', event.target.dataset.event);
        event.dataTransfer.setData('correct-date', event.target.dataset.correctDate);
        event.target.classList.add('dragging');
    },

    dropChronoEvent(event, index) {
        event.preventDefault();
        const dropZone = event.currentTarget;
        dropZone.classList.remove('drag-over');

        const eventText = event.dataTransfer.getData('text/plain');
        const correctDate = event.dataTransfer.getData('correct-date');
        const targetDate = dropZone.parentElement.dataset.date;

        // Retirer l'élément de la pool
        const draggedCard = document.querySelector(`.chrono-event-card[data-event="${eventText}"]`);
        if (draggedCard) {
            draggedCard.classList.remove('dragging');
            draggedCard.style.display = 'none';
        }

        // Placer dans la zone
        dropZone.innerHTML = `<span class="chrono-placed-event" data-correct-date="${correctDate}">${eventText}</span>`;
        dropZone.classList.add('filled');

        // Sauvegarder la réponse
        if (!this.userAnswers['chrono']) {
            this.userAnswers['chrono'] = {};
        }
        this.userAnswers['chrono'][index] = {
            placed: eventText,
            correctDate: correctDate,
            targetDate: targetDate
        };
    },

    /**
     * Render Timeline (Flip cards)
     */
    renderTimeline(donnees, questions) {
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
            </div>
        `;
    },

    /**
     * Render Association (matching pairs)
     * Format: {consigne, paires: [{element1, element2}, ...]}
     */
    renderAssociation(donnees, questions) {
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

        // Mélanger les éléments de droite
        const elementsGauche = paires.map((p, i) => ({ texte: p.element1, id: i }));
        const elementsDroite = this.shuffleArray(paires.map((p, i) => ({ texte: p.element2, id: i })));

        return `
            <div class="association-container">
                <p class="association-instruction">${this.escapeHtml(consigne)}</p>
                <div class="association-columns">
                    <div class="association-column association-gauche">
                        ${elementsGauche.map(el => `
                            <div class="association-item" data-id="${el.id}" onclick="EleveConnaissances.selectAssociationItem(this, 'gauche')">
                                <span class="association-text">${this.escapeHtml(el.texte)}</span>
                                <span class="association-link-indicator"></span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="association-column association-droite">
                        ${elementsDroite.map(el => `
                            <div class="association-item" data-id="${el.id}" onclick="EleveConnaissances.selectAssociationItem(this, 'droite')">
                                <span class="association-link-indicator"></span>
                                <span class="association-text">${this.escapeHtml(el.texte)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="association-feedback" id="association_feedback" style="display: none;"></div>
            </div>
        `;
    },

    // Association selection state
    associationSelection: { gauche: null, droite: null },
    associationPairs: [],

    selectAssociationItem(element, side) {
        const id = element.dataset.id;

        // Toggle selection
        if (this.associationSelection[side] === id) {
            element.classList.remove('selected');
            this.associationSelection[side] = null;
        } else {
            // Deselect previous
            document.querySelectorAll(`.association-${side} .association-item.selected`)
                .forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            this.associationSelection[side] = id;
        }

        // Check if both sides selected - create pair
        if (this.associationSelection.gauche && this.associationSelection.droite) {
            this.associationPairs.push({
                gauche: this.associationSelection.gauche,
                droite: this.associationSelection.droite
            });
            this.saveAnswer('association', this.associationPairs);

            // Visual feedback - mark as linked
            document.querySelectorAll('.association-gauche .association-item.selected, .association-droite .association-item.selected')
                .forEach(el => {
                    el.classList.remove('selected');
                    el.classList.add('linked');
                });

            this.associationSelection = { gauche: null, droite: null };
        }
    },

    /**
     * Save an answer
     */
    saveAnswer(key, value) {
        this.userAnswers[key] = value;
    },

    /**
     * Validate current etape
     * Récupère les données via la jointure etapeQuestions → questionsConnaissances
     */
    validateEtape() {
        const currentEtape = this.currentEtapes[this.currentEtapeIndex];

        // Récupérer les données via la jointure (même logique que renderEtapeContent)
        let donnees = {};
        const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
            String(eq.etape_id) === String(currentEtape.id)
        );

        if (linkedQuestionRefs.length > 0) {
            const questionRef = linkedQuestionRefs[0];
            const questionContent = this.questionsConnaissances.find(q =>
                String(q.id) === String(questionRef.question_id)
            );
            if (questionContent && questionContent.donnees) {
                donnees = questionContent.donnees;
                if (typeof donnees === 'string') {
                    try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
                }
            }
        }

        // Fallback sur etape.donnees si pas trouvé via jointure
        if (Object.keys(donnees).length === 0 && currentEtape.donnees) {
            donnees = currentEtape.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }
        }

        let correct = 0;
        let total = 0;

        switch (currentEtape.format_code) {
            case 'vrai_faux':
                // Format simple: {question, reponse}
                if (donnees.reponse !== undefined && !donnees.propositions) {
                    total = 1;
                    const answer = this.userAnswers['vf_0'];
                    const expected = donnees.reponse === true || donnees.reponse === 'vrai' ? 'vrai' : 'faux';
                    const isCorrect = answer === expected;
                    if (isCorrect) correct++;

                    const feedback = document.getElementById('feedback_vf_0');
                    if (feedback) {
                        feedback.style.display = 'block';
                        feedback.className = `vf-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
                        feedback.textContent = isCorrect ? '✓ Correct' : `✗ La bonne réponse était: ${expected}`;
                        if (donnees.feedback_vrai && isCorrect) feedback.textContent += ` - ${donnees.feedback_vrai}`;
                        if (donnees.feedback_faux && !isCorrect) feedback.textContent += ` - ${donnees.feedback_faux}`;
                    }
                } else {
                    // Format multi: {propositions: [...]}
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
                }
                break;

            case 'qcm':
                total = 1;
                // Accepter 'choix' ou 'options'
                const choices = donnees.choix || donnees.options || [];
                const userAnswer = this.userAnswers['qcm'];

                // Accepter différents formats de réponses correctes
                let correctIndices = [];
                if (donnees.reponses_correctes && Array.isArray(donnees.reponses_correctes)) {
                    correctIndices = donnees.reponses_correctes;
                } else if (donnees.reponse_correcte !== undefined) {
                    correctIndices = [donnees.reponse_correcte];
                } else {
                    correctIndices = choices
                        .map((c, i) => c.correct ? i : -1)
                        .filter(i => i >= 0);
                }

                if (correctIndices.includes(parseInt(userAnswer))) {
                    correct = 1;
                }

                const qcmFeedback = document.getElementById('feedback_qcm');
                if (qcmFeedback) {
                    qcmFeedback.style.display = 'block';
                    qcmFeedback.className = `qcm-feedback ${correct === 1 ? 'correct' : 'incorrect'}`;
                    qcmFeedback.textContent = correct === 1 ? '✓ Correct !' : `✗ Ce n'est pas la bonne réponse.`;
                    if (correct === 1 && donnees.feedback_correct) {
                        qcmFeedback.textContent += ` ${donnees.feedback_correct}`;
                    }
                    if (correct === 0 && donnees.feedback_incorrect) {
                        qcmFeedback.textContent += ` ${donnees.feedback_incorrect}`;
                    }
                }
                break;

            case 'chronologie':
                // Valider les événements placés sur la frise
                const chronoAnswers = this.userAnswers['chrono'] || {};
                const dropZones = document.querySelectorAll('.chrono-drop-zone');

                dropZones.forEach((zone, idx) => {
                    total++;
                    const answer = chronoAnswers[idx];
                    const targetDate = zone.parentElement.dataset.date;

                    zone.classList.remove('correct', 'incorrect');

                    if (answer && String(answer.correctDate) === String(targetDate)) {
                        correct++;
                        zone.classList.add('correct');
                    } else {
                        zone.classList.add('incorrect');
                        // Afficher la bonne réponse
                        const paires = donnees.paires || donnees.evenements || [];
                        const correctEvent = paires.find(p => String(p.date) === String(targetDate));
                        if (correctEvent && !zone.classList.contains('filled')) {
                            zone.innerHTML = `<span class="chrono-placed-event" style="color: #991b1b;">${correctEvent.evenement}</span>`;
                        }
                    }
                });
                break;

            case 'association':
                const assocPaires = donnees.paires || [];
                total = assocPaires.length;
                const userPairs = this.userAnswers['association'] || [];

                userPairs.forEach(up => {
                    if (up.gauche === up.droite) {
                        correct++;
                    }
                });
                break;
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
        // duration est en minutes, convertir en secondes
        this.timeRemaining = duration * 60;
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
