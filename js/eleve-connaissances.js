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
    // Stocke les questions sélectionnées par étape (pour validation cohérente)
    selectedQuestionsPerEtape: {},

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
            // IMPORTANT: Toujours charger les progressions AVANT de rendre
            // Sinon tous les entraînements apparaissent comme "Nouveau"
            await this.loadProgressions();
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
            // Vérifier Auth.user en premier
            if (typeof Auth !== 'undefined' && Auth.user) return Auth.user;
            // Vérifier sessionStorage (utilisé par le système de connexion élève)
            const sessionUser = sessionStorage.getItem('brikks_user');
            if (sessionUser) return JSON.parse(sessionUser);
            // Fallback sur localStorage
            const localSession = localStorage.getItem('brikks_session');
            if (localSession) return JSON.parse(localSession);
            return null;
        } catch (e) {
            console.error('[EleveConnaissances] Erreur getCurrentUser:', e);
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
        // Charger les données de base
        const [banquesResult, entrainementsResult, etapesResult, etapeQuestionsResult, formatsResult, questionsResult] = await Promise.all([
            this.callAPI('getBanquesExercicesConn'),
            this.callAPI('getEntrainementsConn'),
            this.callAPI('getEtapesConn'),
            this.callAPI('getEtapeQuestionsConn', {}),
            this.callAPI('getFormatsQuestions'),
            this.callAPI('getQuestionsConnaissances', {})
        ]);

        const data = {
            banques: banquesResult.success ? banquesResult.data : [],
            entrainements: entrainementsResult.success ? entrainementsResult.data : [],
            etapes: etapesResult.success ? etapesResult.data : [],
            etapeQuestions: etapeQuestionsResult.success ? etapeQuestionsResult.data : [],
            formatsQuestions: formatsResult.success ? formatsResult.data : [],
            questionsConnaissances: questionsResult.success ? questionsResult.data : []
        };

        this.saveToCache(data);
        this.applyData(data);

        // Charger la progression de l'élève (après applyData pour avoir les IDs)
        await this.loadProgressions();
    },

    /**
     * Charge les progressions de mémorisation de l'élève
     */
    async loadProgressions() {
        if (!this.currentUser?.id) return;

        try {
            const result = await this.callAPI('getProgressionMemorisation', {
                eleve_id: this.currentUser.id
            });

            if (result.success) {
                this.progressions = {};
                result.data.forEach(p => {
                    this.progressions[p.entrainement_id] = p;
                });
                console.log('[EleveConnaissances] Progressions chargées:', this.progressions);
            }
        } catch (error) {
            console.error('[EleveConnaissances] Erreur chargement progressions:', error);
            this.progressions = {};
        }
    },

    // Stockage des progressions
    progressions: {},

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

        // Group entrainements by banque
        const entrainementsByBanque = {};
        this.entrainements.forEach(ent => {
            if (!entrainementsByBanque[ent.banque_exercice_id]) {
                entrainementsByBanque[ent.banque_exercice_id] = [];
            }
            entrainementsByBanque[ent.banque_exercice_id].push(ent);
        });

        // Calculate global stats based on progressions
        const globalStats = this.calculateGlobalStats();

        // Calculer le nombre total d'actions à faire (nouveau + à réviser)
        const aFaire = globalStats.aReviser + globalStats.nouveau;

        // Message bandeau simplifié et clair pour l'élève
        let bandeauMessage, bandeauClass;
        if (aFaire > 0) {
            bandeauMessage = `${aFaire} entraînement${aFaire > 1 ? 's' : ''} à faire`;
            bandeauClass = 'has-urgent';
        } else if (globalStats.total === globalStats.memorise && globalStats.total > 0) {
            bandeauMessage = '🏆 Tout est mémorisé !';
            bandeauClass = 'all-done';
        } else if (globalStats.total > 0) {
            bandeauMessage = '✓ Tu es à jour !';
            bandeauClass = 'waiting';
        } else {
            bandeauMessage = 'Aucun entraînement';
            bandeauClass = 'empty';
        }

        let html = `
            <!-- Bandeau bleu simple -->
            <div class="type-header-banner connaissances ${bandeauClass}">
                <div class="type-header-left">
                    <div class="type-icon-emoji">📚</div>
                    <div>
                        <h2 class="type-title">Entraînement de connaissances</h2>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat ${bandeauClass}">
                        <div class="type-stat-value">${bandeauMessage}</div>
                    </div>
                </div>
            </div>

            <!-- Liste des banques -->
            <div class="banques-accordion">
        `;

        this.banques.forEach(banque => {
            const banqueEntrainements = entrainementsByBanque[banque.id] || [];
            const banqueStats = this.calculateBanqueStats(banqueEntrainements);

            // Accordéons fermés par défaut - ouvrir seulement si l'utilisateur a cliqué
            const isExpanded = this.expandedBanques.has(banque.id);
            const hasActions = banqueStats.aReviser > 0 || banqueStats.nouveau > 0;

            // Calcul de la progression = moyenne des étapes
            const progressPercent = banqueStats.progressionMoyenne;

            // Couleur selon progression
            let progressColor = '#e5e7eb';
            if (progressPercent >= 100) progressColor = '#10b981';
            else if (progressPercent >= 70) progressColor = '#10b981';
            else if (progressPercent >= 40) progressColor = '#f59e0b';
            else if (progressPercent > 0) progressColor = '#3b82f6';

            // Badge résumé pour la banque - afficher "X à faire" ET/OU "X en attente"
            let banqueBadges = [];
            const aFaire = banqueStats.aReviser + banqueStats.nouveau;
            if (aFaire > 0) {
                banqueBadges.push(`<span class="banque-badge urgent">⚡ ${aFaire} à faire</span>`);
            }
            if (banqueStats.verrouille > 0) {
                banqueBadges.push(`<span class="banque-badge waiting">⏳ ${banqueStats.verrouille} en attente</span>`);
            }
            if (banqueStats.pretEvaluation) {
                banqueBadges.push(`<span class="banque-badge done">✅ Prêt pour l'évaluation</span>`);
            }
            // Si aucun badge, afficher un état par défaut
            const banqueBadge = banqueBadges.length > 0 ? banqueBadges.join(' ') : '';

            // Message de maîtrise
            let maitriseMessage = '';
            if (banqueStats.pretEvaluation) {
                maitriseMessage = `<div class="banque-maitrise">✅ Ce chapitre est bien maîtrisé !</div>`;
            }

            html += `
                <div class="banque-accordion-item connaissances${isExpanded ? ' expanded' : ''}${hasActions ? ' has-actions' : ''}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveConnaissances.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${this.escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">
                                ${banqueStats.total} entraînement${banqueStats.total > 1 ? 's' : ''} • ${banqueBadge}
                            </div>
                            <div class="banque-progress-bar">
                                <div class="banque-progress-fill" style="width: ${progressPercent}%; background: ${progressColor};"></div>
                            </div>
                        </div>
                        <div class="banque-progress-percent">${progressPercent}%</div>
                    </button>
                    <div class="banque-accordion-content">
                        ${maitriseMessage}
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
     * Calcule les statistiques globales
     * Ne compte que les entraînements assignés à une banque existante
     */
    calculateGlobalStats() {
        let total = 0;
        let memorise = 0;
        let aJour = 0; // verrouillé + mémorisé = à jour pour l'évaluation
        let aReviser = 0;
        let verrouille = 0;
        let nouveau = 0;

        // Créer un Set des IDs de banques existantes pour filtrage rapide
        const banqueIds = new Set(this.banques.map(b => b.id));

        this.entrainements.forEach(ent => {
            // Ne compter que les entraînements assignés à une banque existante
            if (!ent.banque_exercice_id || !banqueIds.has(ent.banque_exercice_id)) {
                return;
            }

            total++;
            const prog = this.progressions[ent.id];
            const status = this.getEntrainementStatus(prog);

            if (status.statusClass === 'memorise') {
                memorise++;
                aJour++;
            } else if (status.statusClass === 'verrouille') {
                verrouille++;
                aJour++;
            } else if (status.statusClass === 'a-reviser') {
                aReviser++;
            } else {
                nouveau++;
            }
        });

        // Pourcentage "prêt pour l'évaluation" = à jour / total
        const pourcentagePret = total > 0 ? Math.round((aJour / total) * 100) : 0;

        return {
            total,
            memorise,
            aJour,
            aReviser,
            verrouille,
            nouveau,
            pourcentagePret, // Pour la barre de progression
            pourcentageMemorises: total > 0 ? Math.round((memorise / total) * 100) : 0
        };
    },

    /**
     * Calcule les statistiques pour une banque
     */
    calculateBanqueStats(entrainements) {
        let total = entrainements.length;
        let memorise = 0;
        let aJour = 0;
        let aReviser = 0;
        let verrouille = 0;
        let nouveau = 0;
        let sommeEtapes = 0;
        let pretEvaluation = total > 0; // Vrai par défaut, devient faux si un entraînement < étape 5

        entrainements.forEach(ent => {
            const prog = this.progressions[ent.id];
            const status = this.getEntrainementStatus(prog);
            const etape = prog?.etape || 0;

            // Calcul de la somme des étapes pour la moyenne
            sommeEtapes += etape;

            // Vérifier si prêt pour évaluation (tous à étape ≥ 5)
            if (etape < 5) {
                pretEvaluation = false;
            }

            if (status.statusClass === 'memorise') {
                memorise++;
                aJour++;
            } else if (status.statusClass === 'verrouille') {
                verrouille++;
                aJour++;
            } else if (status.statusClass === 'a-reviser') {
                aReviser++;
            } else {
                nouveau++;
            }
        });

        // Progression moyenne = moyenne des (étape / 7) * 100
        const progressionMoyenne = total > 0 ? Math.round((sommeEtapes / total / 7) * 100) : 0;

        return {
            total,
            memorise,
            aJour,
            aReviser,
            verrouille,
            nouveau,
            progressionMoyenne,
            pretEvaluation
        };
    },

    /**
     * Render entrainements list for a banque
     * Tri intelligent : À réviser > Nouveaux > Verrouillés > Mémorisés
     */
    renderEntrainementsList(entrainements) {
        if (entrainements.length === 0) {
            return '<div class="empty-state" style="padding: 2rem;"><p>Aucun entraînement dans cette banque</p></div>';
        }

        // Trier les entraînements par priorité
        const sorted = [...entrainements].sort((a, b) => {
            const progA = this.progressions[a.id];
            const progB = this.progressions[b.id];
            const statusA = this.getEntrainementStatus(progA);
            const statusB = this.getEntrainementStatus(progB);

            const priority = { 'a-reviser': 0, 'new': 1, 'verrouille': 2, 'memorise': 3 };
            return (priority[statusA.statusClass] ?? 4) - (priority[statusB.statusClass] ?? 4);
        });

        return sorted.map((ent, index) => {
            const prog = this.progressions[ent.id];
            const dureeMinutes = ent.duree || 15;

            // Déterminer l'état de l'entraînement
            let statusInfo = this.getEntrainementStatus(prog);

            // Calculer le nombre de réussites (étape - 1, car backend démarre à 1)
            const reussites = prog?.etape ? Math.max(0, prog.etape - 1) : 0;

            // Badge simple au lieu de barre de progression
            let statusBadge = '';
            let actionHint = '';
            switch (statusInfo.statusClass) {
                case 'new':
                    statusBadge = '<span class="entrainement-badge new">🆕 Nouveau</span>';
                    actionHint = 'Clique pour découvrir →';
                    break;
                case 'a-reviser':
                    statusBadge = '<span class="entrainement-badge urgent">⚡ À réviser</span>';
                    actionHint = `${reussites}/7 réussies`;
                    break;
                case 'verrouille':
                    statusBadge = `<span class="entrainement-badge locked">⏳ Dans ${statusInfo.joursRestants}j</span>`;
                    actionHint = `${reussites}/7 réussies`;
                    break;
                case 'memorise':
                    statusBadge = '<span class="entrainement-badge done">✅ Mémorisé</span>';
                    actionHint = '7/7 réussies';
                    break;
            }

            // Construire les métadonnées : durée + description si disponible
            let metaText = `${dureeMinutes} min`;
            if (ent.description) {
                metaText += ` • ${this.escapeHtml(ent.description)}`;
            }

            return `
                <div class="exercice-item connaissances ${statusInfo.class}"
                     onclick="EleveConnaissances.startEntrainement('${ent.id}')"
                     data-entrainement-id="${ent.id}">
                    <div class="exercice-numero">${index + 1}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${this.escapeHtml(ent.titre || 'Entraînement ' + (index + 1))}</div>
                        <div class="exercice-meta">${metaText}</div>
                    </div>
                    <div class="exercice-status-area">
                        ${statusBadge}
                        <span class="exercice-hint">${actionHint}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Détermine l'état d'un entraînement basé sur sa progression
     */
    getEntrainementStatus(prog) {
        if (!prog) {
            return {
                class: '',
                statusClass: 'new',
                label: 'Nouveau',
                icon: '→',
                joursRestants: undefined
            };
        }

        if (prog.statut === 'memorise') {
            return {
                class: 'memorise',
                statusClass: 'memorise',
                label: '✓ Mémorisé',
                icon: '✓',
                joursRestants: undefined
            };
        }

        // Calculer si c'est verrouillé
        const now = new Date();
        const prochaineRevision = prog.prochaine_revision ? new Date(prog.prochaine_revision) : null;
        const joursRestants = prochaineRevision ? Math.ceil((prochaineRevision - now) / (1000 * 60 * 60 * 24)) : 0;

        if (prochaineRevision && now < prochaineRevision) {
            return {
                class: 'verrouille',
                statusClass: 'verrouille',
                label: `🔒 ${joursRestants}j`,
                icon: '🔒',
                joursRestants: joursRestants
            };
        }

        // À réviser
        return {
            class: 'a-reviser',
            statusClass: 'a-reviser',
            label: '⚡ À réviser',
            icon: '→',
            joursRestants: 0
        };
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
     * @param {string} entrainementId - ID de l'entraînement
     * @param {boolean} skipAvailabilityCheck - Si true, ignore le verrouillage (mode libre)
     */
    async startEntrainement(entrainementId, skipAvailabilityCheck = false) {
        // Vérifier si l'entraînement est verrouillé (sauf en mode libre)
        if (!skipAvailabilityCheck) {
            const prog = this.progressions[entrainementId];
            const status = this.getEntrainementStatus(prog);

            if (status.statusClass === 'verrouille') {
                // Afficher un modal de verrouillage avec option entraînement libre
                this.showLockedModal(prog, status, entrainementId);
                return;
            }

            // Si mémorisé, afficher un avertissement mais permettre de continuer
            if (status.statusClass === 'memorise') {
                this.isTrainingMode = true; // Mode entraînement libre (ne compte pas)
            } else {
                this.isTrainingMode = false;
            }
        }
        // Si skipAvailabilityCheck, isTrainingMode est déjà défini par startFreeTraining

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

                    <!-- Barre de progression des étapes avec navigation -->
                    <div class="etapes-navigation">
                        <button class="etape-nav-btn prev ${this.currentEtapeIndex === 0 ? 'disabled' : ''}"
                                onclick="EleveConnaissances.previousEtape()"
                                ${this.currentEtapeIndex === 0 ? 'disabled' : ''}>
                            ←
                        </button>
                        <div class="etapes-progress">
                            ${etapes.map((etape, idx) => `
                                <div class="etape-dot ${idx < this.currentEtapeIndex ? 'completed' : ''} ${idx === this.currentEtapeIndex ? 'current' : ''}"
                                     title="Étape ${idx + 1}">
                                    ${idx + 1}
                                </div>
                            `).join('<div class="etape-connector"></div>')}
                        </div>
                        ${this.currentEtapeIndex < etapes.length - 1 ? `
                            <button class="etape-nav-btn next"
                                    onclick="EleveConnaissances.nextEtape()">
                                →
                            </button>
                        ` : `
                            <button class="etape-nav-btn next finish-btn"
                                    onclick="EleveConnaissances.finishEntrainement()">
                                Terminer ✓
                            </button>
                        `}
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
     * Supporte les modes: 'manuel' (questions liées) et 'aleatoire' (tirage au sort)
     */
    renderEtapeContent(etape, questions) {
        const format = etape.format_code;

        console.log('[EleveConnaissances] renderEtapeContent - etape:', etape);
        console.log('[EleveConnaissances] renderEtapeContent - format:', format);
        console.log('[EleveConnaissances] renderEtapeContent - mode_selection:', etape.mode_selection);

        let allQuestionContents = [];

        // Vérifier si on a déjà sélectionné les questions pour cette étape
        // (important pour le mode aléatoire et pour la validation)
        if (this.selectedQuestionsPerEtape[etape.id]) {
            console.log('[EleveConnaissances] Réutilisation des questions déjà sélectionnées');
            allQuestionContents = this.selectedQuestionsPerEtape[etape.id].questions;
        } else {
            // Vérifier le mode de sélection
            if (etape.mode_selection === 'aleatoire') {
                // MODE ALÉATOIRE : Tirer au sort parmi les questions disponibles
                const nbQuestions = parseInt(etape.nb_questions) || 5;
                const banqueSourceId = etape.banque_source_id;

                console.log('[EleveConnaissances] Mode aléatoire - nb_questions:', nbQuestions, 'banque_source_id:', banqueSourceId);

                // Filtrer les questions par format et éventuellement par banque
                let availableQuestions = this.questionsConnaissances.filter(q => q.type === format);

                if (banqueSourceId) {
                    availableQuestions = availableQuestions.filter(q => String(q.banque_id) === String(banqueSourceId));
                }

                console.log('[EleveConnaissances] Questions disponibles pour tirage:', availableQuestions.length);

                // Mélanger et prendre le nombre demandé
                const shuffled = this.shuffleArray([...availableQuestions]);
                const selected = shuffled.slice(0, nbQuestions);

                console.log('[EleveConnaissances] Questions tirées au sort:', selected.length);

                // Convertir en format attendu
                for (const q of selected) {
                    let donnees = q.donnees || {};
                    if (typeof donnees === 'string') {
                        try {
                            donnees = JSON.parse(donnees);
                        } catch (e) {
                            donnees = {};
                        }
                    }
                    allQuestionContents.push({
                        id: q.id,
                        donnees: donnees
                    });
                }
            } else {
                // MODE MANUEL : Utiliser les questions liées via ETAPE_QUESTIONS_CONN
                const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
                    String(eq.etape_id) === String(etape.id)
                );
                console.log('[EleveConnaissances] Mode manuel - Questions liées (refs):', linkedQuestionRefs);

                for (const questionRef of linkedQuestionRefs) {
                    let questionContent = this.questionsConnaissances.find(q =>
                        String(q.id) === String(questionRef.question_id)
                    );

                    // FALLBACK: Si question non trouvée par ID, chercher par format/type
                    if (!questionContent && format) {
                        console.warn(`[EleveConnaissances] Question ID ${questionRef.question_id} non trouvée! Recherche fallback par type ${format}...`);
                        questionContent = this.questionsConnaissances.find(q => q.type === format);
                    }

                    if (questionContent) {
                        let donnees = questionContent.donnees || {};
                        if (typeof donnees === 'string') {
                            try {
                                donnees = JSON.parse(donnees);
                            } catch (e) {
                                console.error('[EleveConnaissances] Erreur parsing donnees:', e);
                                donnees = {};
                            }
                        }
                        allQuestionContents.push({
                            id: questionContent.id,
                            donnees: donnees
                        });
                    }
                }
            }
        }

        console.log('[EleveConnaissances] Toutes les questions trouvées:', allQuestionContents.length);

        // Combiner les données selon le format
        let donnees = {};

        if (allQuestionContents.length === 0) {
            // Fallback: essayer depuis l'étape directement
            if (etape.donnees) {
                let etapeDonnees = etape.donnees;
                if (typeof etapeDonnees === 'string') {
                    try {
                        etapeDonnees = JSON.parse(etapeDonnees);
                    } catch (e) {
                        etapeDonnees = {};
                    }
                }
                donnees = etapeDonnees;
            }
        } else if (allQuestionContents.length === 1) {
            // Une seule question: utiliser directement ses données
            donnees = allQuestionContents[0].donnees;
        } else {
            // Plusieurs questions: combiner selon le format
            donnees = this.combineQuestionsData(format, allQuestionContents);
        }

        // Stocker les questions et données pour la validation
        this.selectedQuestionsPerEtape[etape.id] = {
            questions: allQuestionContents,
            donnees: donnees,
            format: format
        };

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
            case 'texte_trou':
            case 'texte_trous':
                return this.renderTexteTrous(donnees, questions);
            case 'association':
                return this.renderAssociation(donnees, questions);
            case 'carte':
                return this.renderCarte(donnees, questions);
            case 'question_ouverte':
                return this.renderQuestionOuverte(donnees, questions);
            default:
                return `<div class="unsupported-format">Format non supporté: ${format}<br><small>Données: ${JSON.stringify(donnees)}</small></div>`;
        }
    },

    /**
     * Combine les données de plusieurs questions en un seul objet
     * pour l'affichage dans une étape
     */
    combineQuestionsData(format, questionContents) {
        console.log('[EleveConnaissances] combineQuestionsData - format:', format, 'questions:', questionContents.length);

        switch (format) {
            case 'vrai_faux':
                // Combiner en tableau de propositions
                return {
                    propositions: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        texte: qc.donnees.question || qc.donnees.enonce || `Question ${idx + 1}`,
                        reponse: qc.donnees.reponse
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
                        multiple: qc.donnees.multiple || false
                    }))
                };

            case 'chronologie':
            case 'timeline':
                // Combiner les événements/paires de toutes les questions
                const allEvents = [];
                const allPaires = [];
                questionContents.forEach(qc => {
                    if (qc.donnees.evenements) allEvents.push(...qc.donnees.evenements);
                    if (qc.donnees.paires) allPaires.push(...qc.donnees.paires);
                });
                return {
                    evenements: allEvents.length > 0 ? allEvents : undefined,
                    paires: allPaires.length > 0 ? allPaires : undefined
                };

            case 'association':
                // Combiner toutes les paires
                const pairs = [];
                questionContents.forEach(qc => {
                    if (qc.donnees.paires) pairs.push(...qc.donnees.paires);
                });
                return { paires: pairs };

            case 'texte_trou':
            case 'texte_trous':
                // Pour texte à trous, on peut combiner les textes
                return {
                    multiTextes: questionContents.map((qc, idx) => ({
                        id: qc.id,
                        texte: qc.donnees.texte || qc.donnees.question || '',
                        trous: qc.donnees.trous || []
                    }))
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
     * Supporte:
     * - Format simple: {question, choix, reponse}
     * - Format multi: {multiQuestions: [{question, choix, reponse}, ...]}
     */
    renderQCM(donnees, questions) {
        // Format multi-questions (plusieurs QCM dans une étape)
        if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
            return `
                <div class="qcm-multi-container">
                    ${donnees.multiQuestions.map((q, qIdx) => {
                        const choices = q.choix || q.options || [];
                        const multiple = q.multiple || false;

                        if (choices.length === 0) {
                            return `<div class="qcm-question-block" data-question="${qIdx}">
                                <div class="format-no-data">Question ${qIdx + 1}: Pas de choix configurés</div>
                            </div>`;
                        }

                        // Mélanger les choix
                        const indexedChoices = choices.map((choice, idx) => ({ choice, originalIdx: idx }));
                        const shuffledChoices = this.shuffleArray([...indexedChoices]);

                        return `
                            <div class="qcm-question-block" data-question="${qIdx}">
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
                        // Construire le style d'image
                        let frontStyle = '';
                        if (carte.image_url) {
                            frontStyle = `style="background-image: url('${this.escapeHtml(carte.image_url)}'); background-size: cover; background-position: center;"`;
                        }
                        return `
                        <div class="timeline-flip-card" draggable="true" data-original-index="${carte.originalIndex}" data-date="${carte.date}" data-titre="${this.escapeHtml(carte.titre)}">
                            <div class="flip-card-inner">
                                <div class="flip-card-front" ${frontStyle}>
                                    <span class="flip-card-titre">${this.escapeHtml(carte.titre)}</span>
                                </div>
                                <div class="flip-card-back">
                                    <span class="flip-card-date">${this.escapeHtml(carte.date)}</span>
                                    ${carte.explication ? `<p class="flip-card-explication">${this.escapeHtml(carte.explication)}</p>` : ''}
                                </div>
                            </div>
                        </div>
                    `}).join('')}
                </div>
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

        const cards = container.querySelectorAll('.timeline-flip-card');

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

        const cards = Array.from(container.querySelectorAll('.timeline-flip-card'));
        const order = cards.map(card => ({
            originalIndex: parseInt(card.dataset.originalIndex),
            date: card.dataset.date,
            titre: card.dataset.titre
        }));
        this.userAnswers['timeline_order'] = order;
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

        // Mélanger les deux colonnes indépendamment
        const elementsGauche = this.shuffleArray(paires.map((p, i) => ({ texte: p.element1, id: i })));
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
    associationPairCounter: 0,

    selectAssociationItem(element, side) {
        const id = element.dataset.id;

        // Si l'élément est déjà apparié, le désapparier au clic
        if (element.classList.contains('paired')) {
            this.unpairAssociationItem(element, side, id);
            return;
        }

        // Toggle selection
        if (this.associationSelection[side] === id) {
            element.classList.remove('selected');
            this.associationSelection[side] = null;
        } else {
            // Deselect previous selection on this side
            document.querySelectorAll(`.association-${side} .association-item.selected`)
                .forEach(el => el.classList.remove('selected'));
            element.classList.add('selected');
            this.associationSelection[side] = id;
        }

        // Check if both sides selected - create pair
        if (this.associationSelection.gauche !== null && this.associationSelection.droite !== null) {
            this.associationPairCounter++;
            const pairNum = this.associationPairCounter;

            this.associationPairs.push({
                gauche: this.associationSelection.gauche,
                droite: this.associationSelection.droite,
                pairNum: pairNum
            });
            this.saveAnswer('association', this.associationPairs);

            // Mark as paired (sans indiquer si c'est correct)
            const gaucheEl = document.querySelector(`.association-gauche .association-item[data-id="${this.associationSelection.gauche}"]`);
            const droiteEl = document.querySelector(`.association-droite .association-item[data-id="${this.associationSelection.droite}"]`);

            [gaucheEl, droiteEl].forEach(el => {
                if (el) {
                    el.classList.remove('selected');
                    el.classList.add('paired');
                    el.dataset.pairNum = pairNum;
                    // Ajouter un indicateur de numéro de paire
                    const indicator = el.querySelector('.association-link-indicator');
                    if (indicator) {
                        indicator.textContent = pairNum;
                        indicator.classList.add('has-pair');
                    }
                }
            });

            this.associationSelection = { gauche: null, droite: null };
        }
    },

    unpairAssociationItem(element, side, id) {
        const pairNum = element.dataset.pairNum;
        if (!pairNum) return;

        // Trouver et supprimer la paire
        const pairIndex = this.associationPairs.findIndex(p => String(p.pairNum) === String(pairNum));
        if (pairIndex > -1) {
            const pair = this.associationPairs[pairIndex];
            this.associationPairs.splice(pairIndex, 1);
            this.saveAnswer('association', this.associationPairs);

            // Réinitialiser les deux éléments de la paire
            const gaucheEl = document.querySelector(`.association-gauche .association-item[data-id="${pair.gauche}"]`);
            const droiteEl = document.querySelector(`.association-droite .association-item[data-id="${pair.droite}"]`);

            [gaucheEl, droiteEl].forEach(el => {
                if (el) {
                    el.classList.remove('paired', 'selected');
                    delete el.dataset.pairNum;
                    const indicator = el.querySelector('.association-link-indicator');
                    if (indicator) {
                        indicator.textContent = '';
                        indicator.classList.remove('has-pair');
                    }
                }
            });
        }
    },

    /**
     * Render Carte cliquable (localisation sur image)
     * Nouvelle version: numéros sur la carte, popup pour répondre
     * Format: {consigne, image_url, marqueurs: [{id, x, y, reponse, reponses_acceptees?}, ...]}
     */
    renderCarte(donnees, questions) {
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
            </div>
        `;
    },

    // État pour la carte v2
    carteMarqueurs: [],
    carteActiveIndex: null,

    openCartePopup(index, event) {
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
            const handleEsc = (e) => {
                if (e.key === 'Escape') {
                    container.classList.remove('fullscreen');
                    btn.textContent = '⛶';
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);
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
     * Render Question ouverte
     * Format: {question, reponses_acceptees: [...], case_sensitive?, feedback_correct?, feedback_incorrect?}
     */
    renderQuestionOuverte(donnees, questions) {
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
                // Valider les réponses saisies dans les champs
                const chronoAnswers = this.userAnswers['chrono'] || {};
                const paires = donnees.paires || donnees.evenements || [];
                const mode = donnees.mode || 'date';

                // Trier les événements pour correspondre à l'ordre d'affichage
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
                        const correctLower = correctValue.trim().toLowerCase();

                        // Vérifier la réponse principale
                        if (userValue === correctLower) {
                            isCorrect = true;
                        }
                        // Vérifier les réponses alternatives
                        if (!isCorrect && reponsesAcceptees.length > 0) {
                            isCorrect = reponsesAcceptees.some(alt =>
                                alt.trim().toLowerCase() === userValue
                            );
                        }
                    }

                    inputEl.classList.remove('correct', 'incorrect');
                    if (isCorrect) {
                        correct++;
                        inputEl.classList.add('correct');
                    } else {
                        inputEl.classList.add('incorrect');
                        // Afficher la bonne réponse après le champ
                        const container = inputEl.closest('.chrono-input-zone');
                        if (container && !container.querySelector('.chrono-correction')) {
                            const correction = document.createElement('span');
                            correction.className = 'chrono-correction';
                            correction.textContent = correctValue;
                            container.appendChild(correction);
                        }
                    }
                });
                break;

            case 'texte_trou':
            case 'texte_trous':
                // Valider les trous remplis
                const trouInputs = document.querySelectorAll('.trou-input');
                const trous = donnees.trous || [];

                trouInputs.forEach((input, idx) => {
                    total++;
                    const userValue = input.value.trim().toLowerCase();
                    const correctValue = input.dataset.answer ? input.dataset.answer.toLowerCase() : '';

                    // Chercher les alternatives pour ce trou
                    let alternatives = [];
                    if (trous[idx] && trous[idx].alternatives) {
                        alternatives = trous[idx].alternatives.map(a => a.toLowerCase());
                    }

                    input.classList.remove('correct', 'incorrect');

                    if (userValue === correctValue || alternatives.includes(userValue)) {
                        correct++;
                        input.classList.add('correct');
                    } else {
                        input.classList.add('incorrect');
                    }
                });
                break;

            case 'timeline':
                // Valider l'ordre des cartes
                // L'ordre correct est l'ordre de création (index 0, 1, 2, 3...)
                const cartes = donnees.cartes || [];
                const cardsContainer = document.getElementById('timelineCards');
                if (cardsContainer) {
                    const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-flip-card'));
                    total = cartes.length;

                    placedCards.forEach((card, positionActuelle) => {
                        // L'index original de cette carte (défini lors du rendu)
                        const originalIndex = parseInt(card.dataset.originalIndex);

                        card.classList.remove('correct', 'incorrect');
                        card.classList.add('flippable'); // Permettre de retourner après validation

                        // La carte est bien placée si son index original correspond à sa position actuelle
                        if (originalIndex === positionActuelle) {
                            correct++;
                            card.classList.add('correct');
                        } else {
                            card.classList.add('incorrect');
                        }
                    });
                }
                break;

            case 'carte':
                // Valider les réponses textuelles pour chaque marqueur (format v2)
                const marqueurs = donnees.marqueurs || [];

                marqueurs.forEach((m, idx) => {
                    total++;
                    const answer = this.userAnswers['carte_' + idx];
                    const marker = document.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
                    const answerItem = document.querySelector(`.carte-answer-item[data-index="${idx}"]`);

                    if (answer) {
                        // Normaliser les réponses pour comparaison
                        const userValue = answer.trim().toLowerCase();
                        const expectedValue = (m.reponse || '').trim().toLowerCase();

                        // Vérifier aussi les réponses alternatives acceptées
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
                    } else {
                        // Pas de réponse donnée
                        if (marker) marker.classList.add('incorrect');
                        if (answerItem) answerItem.classList.add('incorrect');
                    }
                });
                break;

            case 'question_ouverte':
                total = 1;
                const qoAnswer = this.userAnswers['question_ouverte'];
                const qoReponsesAcceptees = donnees.reponses_acceptees || [];
                const caseSensitive = donnees.case_sensitive || false;
                const qoFeedback = document.getElementById('feedback_question_ouverte');
                const qoInput = document.getElementById('questionOuverteReponse');

                let qoCorrect = false;
                if (qoAnswer) {
                    const userValue = caseSensitive ? qoAnswer.trim() : qoAnswer.trim().toLowerCase();
                    qoCorrect = qoReponsesAcceptees.some(rep => {
                        const expected = caseSensitive ? rep.trim() : rep.trim().toLowerCase();
                        return userValue === expected;
                    });
                }

                if (qoCorrect) correct = 1;

                if (qoInput) {
                    qoInput.classList.remove('correct', 'incorrect');
                    qoInput.classList.add(qoCorrect ? 'correct' : 'incorrect');
                }

                if (qoFeedback) {
                    qoFeedback.style.display = 'block';
                    qoFeedback.className = `question-ouverte-feedback ${qoCorrect ? 'correct' : 'incorrect'}`;
                    if (qoCorrect) {
                        qoFeedback.textContent = '✓ Correct !';
                        if (donnees.feedback_correct) qoFeedback.textContent += ` ${donnees.feedback_correct}`;
                    } else {
                        qoFeedback.textContent = `✗ La bonne réponse était: ${qoReponsesAcceptees[0] || ''}`;
                        if (donnees.feedback_incorrect) qoFeedback.textContent += ` ${donnees.feedback_incorrect}`;
                    }
                }
                break;

            case 'association':
                const assocPaires = donnees.paires || [];
                total = assocPaires.length;
                const userPairs = this.userAnswers['association'] || [];

                userPairs.forEach(up => {
                    const gaucheEl = document.querySelector(`.association-gauche .association-item[data-id="${up.gauche}"]`);
                    const droiteEl = document.querySelector(`.association-droite .association-item[data-id="${up.droite}"]`);

                    // Enlever la classe paired et mettre correct ou incorrect
                    if (up.gauche === up.droite) {
                        correct++;
                        [gaucheEl, droiteEl].forEach(el => {
                            if (el) {
                                el.classList.remove('paired');
                                el.classList.add('correct');
                            }
                        });
                    } else {
                        [gaucheEl, droiteEl].forEach(el => {
                            if (el) {
                                el.classList.remove('paired');
                                el.classList.add('incorrect');
                            }
                        });
                    }
                });

                // Marquer les éléments non appariés comme incorrects
                document.querySelectorAll('.association-item:not(.correct):not(.incorrect)').forEach(el => {
                    el.classList.add('incorrect');
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
     * Finish the entrainement - Calcule le score et affiche le récapitulatif
     */
    async finishEntrainement() {
        this.stopTimer();

        // Calculer le score de toutes les étapes
        const results = this.validateAllEtapes();
        this.lastResults = results;

        // Sauvegarder la progression et attendre le résultat
        // pour avoir lastProgressionResult avant le rendu
        await this.saveProgression(results);

        // Afficher l'écran de résultats (maintenant lastProgressionResult est défini)
        this.renderResultScreen(results);
    },

    /**
     * Valide toutes les étapes et retourne les résultats
     */
    validateAllEtapes() {
        const etapesResults = [];
        let totalCorrect = 0;
        let totalQuestions = 0;

        this.currentEtapes.forEach((etape, etapeIndex) => {
            const result = this.validateSingleEtape(etape, etapeIndex);
            etapesResults.push(result);
            totalCorrect += result.correct;
            totalQuestions += result.total;
        });

        const pourcentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return {
            etapes: etapesResults,
            totalCorrect,
            totalQuestions,
            pourcentage
        };
    },

    /**
     * Valide une étape spécifique (sans afficher le feedback)
     */
    validateSingleEtape(etape, etapeIndex) {
        // Utiliser les questions stockées lors du rendu (mode aléatoire ou manuel)
        let donnees = {};
        let format = etape.format_code;

        // Vérifier si on a des questions stockées pour cette étape
        if (this.selectedQuestionsPerEtape[etape.id]) {
            console.log('[EleveConnaissances] validateSingleEtape - utilisation des questions stockées pour étape', etape.id);
            donnees = this.selectedQuestionsPerEtape[etape.id].donnees;
            format = this.selectedQuestionsPerEtape[etape.id].format || format;
        } else {
            // Fallback: récupérer les données via la jointure (ancien comportement)
            console.log('[EleveConnaissances] validateSingleEtape - fallback sur jointure pour étape', etape.id);
            const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
                String(eq.etape_id) === String(etape.id)
            );

            if (linkedQuestionRefs.length > 0) {
                // Récupérer TOUTES les questions liées
                const allQuestionContents = [];
                linkedQuestionRefs.forEach(questionRef => {
                    let questionContent = this.questionsConnaissances.find(q =>
                        String(q.id) === String(questionRef.question_id)
                    );
                    if (questionContent && questionContent.donnees) {
                        let qDonnees = questionContent.donnees;
                        if (typeof qDonnees === 'string') {
                            try { qDonnees = JSON.parse(qDonnees); } catch (e) { qDonnees = {}; }
                        }
                        allQuestionContents.push({
                            id: questionContent.id,
                            donnees: qDonnees
                        });
                    }
                });

                if (allQuestionContents.length === 1) {
                    donnees = allQuestionContents[0].donnees;
                } else if (allQuestionContents.length > 1) {
                    donnees = this.combineQuestionsData(format, allQuestionContents);
                }
            }

            // Fallback sur etape.donnees
            if (Object.keys(donnees).length === 0 && etape.donnees) {
                donnees = etape.donnees;
                if (typeof donnees === 'string') {
                    try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
                }
            }
        }

        let correct = 0;
        let total = 0;
        let details = [];

        // Logique de validation selon le format
        switch (format) {
            case 'vrai_faux':
                if (donnees.reponse !== undefined && !donnees.propositions) {
                    total = 1;
                    const answer = this.userAnswers['vf_0'];
                    const expected = donnees.reponse === true || donnees.reponse === 'vrai' ? 'vrai' : 'faux';
                    const isCorrect = answer === expected;
                    if (isCorrect) correct++;
                    details.push({ question: donnees.question, reponse: answer, attendu: expected, correct: isCorrect });
                } else {
                    const propositions = donnees.propositions || [];
                    propositions.forEach((prop, idx) => {
                        total++;
                        const answer = this.userAnswers[`vf_${idx}`];
                        const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                        const isCorrect = answer === expected;
                        if (isCorrect) correct++;
                        details.push({ question: prop.texte, reponse: answer, attendu: expected, correct: isCorrect });
                    });
                }
                break;

            case 'qcm':
                // Vérifier si on a plusieurs questions QCM
                if (donnees.multiQuestions && Array.isArray(donnees.multiQuestions)) {
                    donnees.multiQuestions.forEach((mq, qIdx) => {
                        total++;
                        const qChoices = mq.choix || [];
                        const qUserAnswer = this.userAnswers[`qcm_${qIdx}`];
                        let qCorrectIndices = [];

                        // Déterminer les réponses correctes
                        if (mq.reponses_correctes && Array.isArray(mq.reponses_correctes)) {
                            qCorrectIndices = mq.reponses_correctes;
                        } else if (mq.reponse !== undefined) {
                            qCorrectIndices = [parseInt(mq.reponse)];
                        } else if (mq.reponse_correcte !== undefined) {
                            qCorrectIndices = [parseInt(mq.reponse_correcte)];
                        } else {
                            qCorrectIndices = qChoices.map((c, i) => c.correct ? i : -1).filter(i => i >= 0);
                        }

                        const qIsCorrect = qCorrectIndices.includes(parseInt(qUserAnswer));
                        if (qIsCorrect) correct++;
                        details.push({
                            question: mq.question || mq.enonce,
                            reponse: qUserAnswer !== undefined ? qChoices[qUserAnswer]?.texte || qChoices[qUserAnswer] : null,
                            attendu: qCorrectIndices.map(i => qChoices[i]?.texte || qChoices[i]).join(', '),
                            correct: qIsCorrect
                        });
                    });
                } else {
                    // QCM simple (une seule question)
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
                    const isCorrect = correctIndices.includes(parseInt(userAnswer));
                    if (isCorrect) correct = 1;
                    details.push({
                        question: donnees.question || donnees.enonce,
                        reponse: userAnswer !== undefined ? choices[userAnswer]?.texte || choices[userAnswer] : null,
                        attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                        correct: isCorrect
                    });
                }
                break;

            case 'chronologie':
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
                    const correctValue = mode === 'evenement' ? evt.evenement : String(evt.date);
                    const reponsesAcceptees = evt.reponses_acceptees || [];
                    let isCorrectAnswer = false;
                    if (answer && answer.value) {
                        const userValue = answer.value.trim().toLowerCase();
                        const correctLower = correctValue.trim().toLowerCase();
                        isCorrectAnswer = userValue === correctLower ||
                            reponsesAcceptees.some(alt => alt.trim().toLowerCase() === userValue);
                    }
                    if (isCorrectAnswer) correct++;
                    details.push({
                        question: mode === 'evenement' ? evt.date : evt.evenement,
                        reponse: answer?.value || null,
                        attendu: correctValue,
                        correct: isCorrectAnswer
                    });
                });
                break;

            case 'timeline':
                // Pour timeline, vérifier l'ordre des cartes
                // L'ordre correct est l'ordre de création (index 0, 1, 2, 3...)
                const cartes = donnees.cartes || [];
                total = cartes.length;

                // Récupérer l'ordre actuel des cartes depuis le DOM ou les réponses sauvegardées
                const container = document.getElementById('timelineCards');
                let userOrder = [];
                if (container) {
                    userOrder = Array.from(container.querySelectorAll('.timeline-flip-card')).map(card => ({
                        originalIndex: parseInt(card.dataset.originalIndex),
                        titre: card.dataset.titre,
                        date: card.dataset.date
                    }));
                } else if (this.userAnswers['timeline_order']) {
                    userOrder = this.userAnswers['timeline_order'];
                }

                // Comparer chaque position : la carte à la position N doit avoir originalIndex = N
                cartes.forEach((carte, positionAttendue) => {
                    const userCarte = userOrder[positionAttendue];
                    const isCorrect = userCarte && userCarte.originalIndex === positionAttendue;
                    if (isCorrect) correct++;
                    details.push({
                        question: `Position ${positionAttendue + 1}`,
                        reponse: userCarte ? userCarte.titre : 'Non placé',
                        attendu: `${carte.titre} (${carte.date})`,
                        correct: isCorrect
                    });
                });
                break;

            case 'texte_trou':
            case 'texte_trous':
                const texte = donnees.texte || '';
                const matches = texte.match(/\{([^}]+)\}/g) || [];
                matches.forEach((match, idx) => {
                    total++;
                    const expected = match.replace(/[{}]/g, '');
                    const input = document.getElementById(`trou_${idx}`);
                    const userValue = input ? input.value.trim() : '';
                    const isCorrectTrou = userValue.toLowerCase() === expected.toLowerCase();
                    if (isCorrectTrou) correct++;
                    details.push({ question: `Trou ${idx + 1}`, reponse: userValue, attendu: expected, correct: isCorrectTrou });
                });
                break;

            case 'association':
                const assocPaires = donnees.paires || [];
                total = assocPaires.length;
                const userPairs = this.userAnswers['association'] || [];

                // Pour chaque paire correcte, vérifier si l'utilisateur l'a trouvée
                assocPaires.forEach((paire, idx) => {
                    // Chercher si l'utilisateur a fait cette association
                    const userMatch = userPairs.find(up =>
                        String(up.gauche) === String(idx) && String(up.droite) === String(idx)
                    );
                    const isCorrect = !!userMatch;
                    if (isCorrect) correct++;

                    // Trouver ce que l'utilisateur a associé à cet élément
                    const userPair = userPairs.find(up => String(up.gauche) === String(idx));
                    let userReponse = 'Non associé';
                    if (userPair) {
                        const droiteIdx = parseInt(userPair.droite);
                        if (assocPaires[droiteIdx]) {
                            userReponse = assocPaires[droiteIdx].element2;
                        }
                    }

                    details.push({
                        question: paire.element1,
                        reponse: userReponse,
                        attendu: paire.element2,
                        correct: isCorrect
                    });
                });
                break;

            case 'carte':
                const marqueurs = donnees.marqueurs || [];
                marqueurs.forEach((m, idx) => {
                    total++;
                    const answer = this.userAnswers['carte_' + idx];
                    if (answer) {
                        const userValue = answer.trim().toLowerCase();
                        const expectedValue = (m.reponse || '').trim().toLowerCase();
                        const reponsesAcceptees = m.reponses_acceptees || [];
                        const allAccepted = [expectedValue, ...reponsesAcceptees.map(r => r.trim().toLowerCase())];
                        const isCorrectCarte = allAccepted.some(rep => userValue === rep);
                        if (isCorrectCarte) correct++;
                        details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrectCarte });
                    } else {
                        details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
                    }
                });
                break;

            case 'question_ouverte':
                total = 1;
                const qoAnswer = this.userAnswers['question_ouverte'];
                const qoReponsesAcceptees = donnees.reponses_acceptees || [];
                const caseSensitive = donnees.case_sensitive || false;
                let qoCorrect = false;
                if (qoAnswer) {
                    const userValue = caseSensitive ? qoAnswer.trim() : qoAnswer.trim().toLowerCase();
                    qoCorrect = qoReponsesAcceptees.some(rep => {
                        const expected = caseSensitive ? rep.trim() : rep.trim().toLowerCase();
                        return userValue === expected;
                    });
                }
                if (qoCorrect) correct = 1;
                details.push({
                    question: donnees.question,
                    reponse: qoAnswer,
                    attendu: qoReponsesAcceptees.join(' / '),
                    correct: qoCorrect
                });
                break;
        }

        return {
            etapeIndex,
            etapeTitre: etape.titre || `Étape ${etapeIndex + 1}`,
            format: etape.format_code,
            correct,
            total,
            pourcentage: total > 0 ? Math.round((correct / total) * 100) : 0,
            details,
            donnees
        };
    },

    /**
     * Sauvegarde la progression dans le backend
     */
    async saveProgression(results) {
        // Ne pas sauvegarder en mode entraînement libre (exercice déjà mémorisé)
        if (this.isTrainingMode) {
            console.log('[EleveConnaissances] Mode entraînement libre - progression non sauvegardée');
            this.lastProgressionResult = { statut: 'memorise', message: 'Entraînement libre' };
            return;
        }

        try {
            // Utiliser this.currentUser qui est initialisé au chargement
            if (!this.currentUser?.id) {
                console.warn('[EleveConnaissances] Pas d\'utilisateur connecté, progression non sauvegardée');
                return;
            }

            const response = await this.callAPI('saveProgressionMemorisation', {
                eleve_id: this.currentUser.id,
                entrainement_id: this.currentEntrainement.id,
                banque_id: this.currentBanque?.id || '',
                score: results.totalCorrect,
                score_max: results.totalQuestions
            });

            if (response.success) {
                this.lastProgressionResult = response;
                // Mettre à jour le cache local des progressions
                this.progressions[this.currentEntrainement.id] = {
                    ...this.progressions[this.currentEntrainement.id],
                    etape: response.etape,
                    statut: response.statut,
                    prochaine_revision: response.prochaine_revision
                };
                console.log('[EleveConnaissances] Progression sauvegardée:', response);
            }
        } catch (error) {
            console.error('[EleveConnaissances] Erreur sauvegarde progression:', error);
        }
    },

    /**
     * Affiche un modal quand l'entraînement est verrouillé
     * Offre l'option de faire l'entraînement en mode libre (ne compte pas)
     */
    showLockedModal(prog, status, entrainementId) {
        const entrainement = this.entrainements.find(e => e.id === (entrainementId || prog.entrainement_id));
        const titre = entrainement?.titre || 'Cet entraînement';

        const prochaineDate = new Date(prog.prochaine_revision);
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        const dateStr = prochaineDate.toLocaleDateString('fr-FR', options);

        // Créer un modal overlay
        const modal = document.createElement('div');
        modal.className = 'locked-modal-overlay';
        modal.innerHTML = `
            <div class="locked-modal">
                <div class="locked-modal-icon">🔒</div>
                <h3>Pas encore !</h3>
                <p class="locked-modal-title">${this.escapeHtml(titre)}</p>
                <p class="locked-modal-message">
                    Tu as réussi cet entraînement ! Pour que ça reste en mémoire,
                    reviens <strong>${dateStr}</strong> pour la prochaine révision.
                </p>
                <div class="locked-modal-info">
                    <div class="locked-modal-etape">Étape ${prog.etape}/7</div>
                    <div class="locked-modal-jours">${status.joursRestants} jour${status.joursRestants > 1 ? 's' : ''} restant${status.joursRestants > 1 ? 's' : ''}</div>
                </div>
                <div class="locked-modal-actions">
                    <button class="btn btn-primary" onclick="this.closest('.locked-modal-overlay').remove()">
                        J'ai compris
                    </button>
                    <button class="btn btn-outline btn-free-training" onclick="EleveConnaissances.startFreeTraining('${entrainementId || prog.entrainement_id}')">
                        M'entraîner quand même
                    </button>
                </div>
                <p class="locked-modal-free-hint">⚠️ L'entraînement libre ne compte pas pour ta progression</p>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Démarre un entraînement en mode libre (ne compte pas pour la progression)
     */
    startFreeTraining(entrainementId) {
        // Fermer le modal
        document.querySelector('.locked-modal-overlay')?.remove();

        // Marquer comme mode entraînement libre
        this.isTrainingMode = true;
        this.isFreeTraining = true;

        // Démarrer l'entraînement normalement
        this.startEntrainement(entrainementId, true); // true = skip availability check
    },

    /**
     * Affiche l'écran de résultats avec récapitulatif
     */
    renderResultScreen(results) {
        const container = document.getElementById('connaissances-content');
        const ent = this.currentEntrainement;
        const banque = this.currentBanque;
        const prog = this.lastProgressionResult || {};

        // Déterminer le message selon le score
        let messageIcon, messageTitle, messageClass;
        if (results.pourcentage >= 100) {
            messageIcon = '✅';
            messageTitle = 'Parfait !';
            messageClass = 'success';
        } else if (results.pourcentage >= 80) {
            messageIcon = '✅';
            messageTitle = 'Bravo !';
            messageClass = 'success';
        } else if (results.pourcentage >= 50) {
            messageIcon = '💪';
            messageTitle = 'Pas mal !';
            messageClass = 'partial';
        } else {
            messageIcon = '❌';
            messageTitle = 'Continue !';
            messageClass = 'error';
        }

        const isSuccess = !this.isTrainingMode && prog.reussi === true;
        const SEUIL_ETAPES = 6; // 6 niveaux pour les connaissances

        // Générer les dots de progression (6 niveaux)
        const generateProgDots = () => {
            const currentEtape = prog.etape || 1;
            let html = '<div class="prog-dots">';
            for (let i = 1; i <= SEUIL_ETAPES; i++) {
                const status = i <= currentEtape ? 'completed' : 'pending';
                html += `<span class="prog-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        // Prochaine date formatée
        let prochaineDateStr = '';
        if (prog.prochaine_revision) {
            prochaineDateStr = new Date(prog.prochaine_revision).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }

        // Trouver l'entraînement suivant
        const nextEntrainement = this.findNextEntrainement();

        // Générer le HTML de correction par étape
        const generateCorrectionHTML = () => {
            if (!results.etapes || results.etapes.length === 0) {
                return '<p class="correction-fallback">Aucun détail disponible.</p>';
            }

            return results.etapes.map((etape, idx) => `
                <div class="correction-etape ${etape.pourcentage >= 80 ? 'success' : etape.pourcentage >= 50 ? 'partial' : 'error'}">
                    <div class="correction-etape-header">
                        <span class="correction-etape-num">${idx + 1}</span>
                        <span class="correction-etape-title">${this.escapeHtml(etape.etapeTitre || 'Étape ' + (idx + 1))}</span>
                        <span class="correction-etape-score">${etape.correct}/${etape.total}</span>
                    </div>
                    <div class="correction-etape-details">
                        ${etape.details.map(d => `
                            <div class="correction-item ${d.correct ? 'correct' : 'incorrect'}">
                                <span class="correction-icon">${d.correct ? '✓' : '✗'}</span>
                                <div class="correction-content">
                                    <span class="correction-question">${this.escapeHtml(d.question || '')}</span>
                                    ${!d.correct ? `
                                        <div class="correction-answers">
                                            <span class="user-answer">${d.reponse ? this.escapeHtml(d.reponse) : '<em>Non répondu</em>'}</span>
                                            <span class="expected-answer">${this.escapeHtml(d.attendu)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        };

        container.innerHTML = `
            <div class="result-view conn" style="max-width:none;width:100%;margin:0;padding:1.5rem;box-sizing:border-box;">
                <button class="exercise-back-btn" onclick="EleveConnaissances.backToList()">
                    ← Retour aux entraînements
                </button>

                <div class="result-card-conn" style="width:100%;max-width:none;">
                    <!-- BLOC GAUCHE : BILAN -->
                    <div class="result-bilan-conn">
                        <div class="bilan-header ${messageClass}">
                            <span class="bilan-icon">${messageIcon}</span>
                            <span class="bilan-message">${messageTitle}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${messageClass}">
                                <span class="score-value">${results.pourcentage}%</span>
                            </div>
                            <span class="score-detail">${results.totalCorrect}/${results.totalQuestions}</span>
                        </div>

                        ${!this.isTrainingMode ? `
                        <div class="bilan-progression">
                            ${generateProgDots()}
                            <span class="prog-label">Niveau ${prog.etape || 1}/${SEUIL_ETAPES}</span>
                        </div>
                        ` : `
                        <div class="bilan-training-badge">
                            <span class="training-badge-icon">🔄</span>
                            <span class="training-badge-text">Entraînement libre</span>
                        </div>
                        `}

                        <!-- Messages selon le résultat -->
                        <div class="bilan-messages">
                            ${prog.statut === 'memorise' && prog.reussi ? `
                                <div class="bilan-memorise">
                                    <span class="memorise-icon">🎉</span>
                                    <p>Cet entraînement est mémorisé !</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && prog.statut !== 'memorise' ? `
                                <div class="bilan-prochaine">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${(prog.etape || 1) + 1} !</p>
                                    <p class="prochaine-sub">En attendant, tu peux t'entraîner autant que tu veux</p>
                                    <button class="btn btn-training" onclick="EleveConnaissances.restartAsTraining()">
                                        💪 Continuer à s'entraîner
                                    </button>
                                </div>
                            ` : ''}

                            ${!isSuccess && !this.isTrainingMode && prog.reussi === false ? `
                                <div class="bilan-retry">
                                    <p>📚 Il faut ${prog.seuil || 80}% pour valider.</p>
                                    <button class="btn btn-primary" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Réessayer
                                    </button>
                                </div>
                            ` : ''}

                            ${this.isTrainingMode ? `
                                <div class="bilan-training-info">
                                    <small>Ta progression n'est pas modifiée en mode libre</small>
                                    <button class="btn btn-primary" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Recommencer
                                    </button>
                                </div>
                            ` : ''}
                        </div>

                        <div class="bilan-actions">
                            ${nextEntrainement && isSuccess ? `
                                <button class="btn btn-primary" onclick="EleveConnaissances.startNextEntrainement()">
                                    Passer au suivant →
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <!-- BLOC DROITE : CORRECTION -->
                    <div class="result-correction-conn">
                        <div class="correction-header">
                            <h3>📝 Correction</h3>
                        </div>
                        <div class="correction-content">
                            ${generateCorrectionHTML()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Déclencher les célébrations appropriées (seulement si pas en mode entraînement libre)
        if (!this.isTrainingMode && prog.success) {
            setTimeout(() => {
                if (prog.statut === 'memorise' && prog.reussi) {
                    this.celebrateMemorized();
                    if (ent && ent.banque_exercice_id) {
                        this.checkAndCelebrateBanqueComplete(ent.banque_exercice_id);
                    }
                } else if (prog.reussi) {
                    this.celebrateSuccess();
                }
            }, 300);
        }
    },

    /**
     * Redémarre l'entraînement en mode libre (pour continuer à s'entraîner après réussite)
     */
    restartAsTraining() {
        this.isTrainingMode = true;
        this.startEntrainement(this.currentEntrainement.id);
    },

    /**
     * Toggle l'affichage des détails d'une étape
     */
    toggleEtapeDetails(idx) {
        const details = document.getElementById(`etapeDetails_${idx}`);
        if (details) {
            const isHidden = details.style.display === 'none';
            details.style.display = isHidden ? 'block' : 'none';
            const toggle = details.previousElementSibling.querySelector('.etape-recap-toggle');
            if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
        }
    },

    /**
     * Calcule le nombre de jours jusqu'à une date
     */
    calculateDaysUntil(dateStr) {
        const target = new Date(dateStr);
        const now = new Date();
        return Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));
    },

    /**
     * Trouve l'entraînement suivant dans la même banque
     */
    findNextEntrainement() {
        if (!this.currentBanque || !this.entrainements) return null;

        const currentBanqueEntrainements = this.entrainements
            .filter(e => String(e.banque_id) === String(this.currentBanque.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const currentIndex = currentBanqueEntrainements.findIndex(e => e.id === this.currentEntrainement.id);
        if (currentIndex >= 0 && currentIndex < currentBanqueEntrainements.length - 1) {
            return currentBanqueEntrainements[currentIndex + 1];
        }
        return null;
    },

    /**
     * Recommence l'entraînement actuel
     */
    restartEntrainement() {
        this.currentEtapeIndex = 0;
        this.userAnswers = {};
        // Réinitialiser les états d'association
        this.associationSelection = { gauche: null, droite: null };
        this.associationPairs = [];
        this.associationPairCounter = 0;
        this.renderEntrainementView();
    },

    /**
     * Lance l'entraînement suivant
     */
    startNextEntrainement() {
        const next = this.findNextEntrainement();
        if (next) {
            this.startEntrainement(next.id);
        } else {
            this.backToList();
        }
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
                // Temps écoulé - finir l'entraînement automatiquement
                this.handleTimeUp();
            }
        }, 1000);
    },

    /**
     * Appelé quand le temps est écoulé
     */
    handleTimeUp() {
        // Afficher une notification rapide
        const timer = document.getElementById('exerciseTimer');
        if (timer) {
            timer.classList.add('time-up');
            timer.innerHTML = '<span>⏰ Temps écoulé !</span>';
        }

        // Attendre un court instant puis finir l'entraînement
        setTimeout(() => {
            this.finishEntrainement();
        }, 1500);
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
    },

    // ============================================
    // CÉLÉBRATIONS - Animations confetti
    // ============================================

    /**
     * Célébration niveau 1 : Réussite (score ≥ seuil)
     * Confettis modérés qui tombent doucement
     */
    celebrateSuccess() {
        if (typeof confetti === 'undefined') return;

        // Confettis doux depuis le haut
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.3 },
            colors: ['#10b981', '#3b82f6', '#f59e0b'],
            ticks: 200,
            gravity: 1.2,
            scalar: 1
        });
    },

    /**
     * Célébration niveau 2 : Mémorisation complète (étape 7/7)
     * Explosion de confettis + étoiles
     */
    celebrateMemorized() {
        if (typeof confetti === 'undefined') return;

        const duration = 2000;
        const end = Date.now() + duration;

        // Explosion depuis les deux côtés
        const frame = () => {
            confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#10b981', '#059669', '#fbbf24', '#f59e0b']
            });
            confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#10b981', '#059669', '#fbbf24', '#f59e0b']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        };
        frame();

        // Burst central avec étoiles
        setTimeout(() => {
            confetti({
                particleCount: 100,
                spread: 100,
                origin: { y: 0.5 },
                colors: ['#fbbf24', '#f59e0b', '#10b981'],
                shapes: ['star', 'circle'],
                scalar: 1.2
            });
        }, 300);
    },

    /**
     * Célébration niveau 3 : Banque complète (tous les entraînements mémorisés)
     * Feu d'artifice spectaculaire multi-couleurs
     */
    celebrateBanqueComplete() {
        if (typeof confetti === 'undefined') return;

        const duration = 4000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 100, zIndex: 10000 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 80 * (timeLeft / duration);

            // Feu d'artifice depuis différentes positions
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ee82ee']
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ee82ee']
            });
        }, 250);

        // Grand final au centre
        setTimeout(() => {
            confetti({
                particleCount: 200,
                spread: 180,
                origin: { y: 0.5, x: 0.5 },
                colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1'],
                shapes: ['star'],
                scalar: 1.5,
                gravity: 0.8
            });
        }, 3500);
    },

    /**
     * Vérifie si une banque est complètement mémorisée et déclenche la célébration
     */
    checkAndCelebrateBanqueComplete(banqueId) {
        const banqueEntrainements = this.entrainements.filter(e => e.banque_exercice_id === banqueId);
        if (banqueEntrainements.length === 0) return false;

        const allMemorized = banqueEntrainements.every(ent => {
            const prog = this.progressions[ent.id];
            return prog && prog.statut === 'memorise';
        });

        if (allMemorized) {
            // Petit délai pour laisser l'utilisateur voir le message d'abord
            setTimeout(() => this.celebrateBanqueComplete(), 500);
            return true;
        }
        return false;
    }
};
