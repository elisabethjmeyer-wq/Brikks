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
    // Résultats par étape (remplis au fur et à mesure de la validation)
    etapesResults: [],
    currentEtapeValidated: false,

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
        this.formatsQuestions = data.formatsQuestions || [];
        this.questionsConnaissances = data.questionsConnaissances || [];

        // Filtrer les données orphelines pour éviter les erreurs d'affichage
        const banqueIds = new Set(this.banques.map(b => String(b.id)));
        this.entrainements = (data.entrainements || []).filter(e => banqueIds.has(String(e.banque_exercice_id)));

        const entrainementIds = new Set(this.entrainements.map(e => String(e.id)));
        this.etapes = (data.etapes || []).filter(et => entrainementIds.has(String(et.entrainement_id)));

        const etapeIds = new Set(this.etapes.map(et => String(et.id)));
        const questionIds = new Set(this.questionsConnaissances.map(q => String(q.id)));
        this.etapeQuestions = (data.etapeQuestions || []).filter(eq =>
            etapeIds.has(String(eq.etape_id)) && questionIds.has(String(eq.question_id))
        );

        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        this.entrainements.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Debug log
        console.log('[EleveConnaissances] Données chargées (après filtrage orphelins):', {
            banques: this.banques.length,
            entrainements: this.entrainements.length,
            etapes: this.etapes.length,
            etapeQuestions: this.etapeQuestions.length,
            questionsConnaissances: this.questionsConnaissances.length
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

        // Logger les erreurs API
        const apiResults = [
            { name: 'banques', result: banquesResult },
            { name: 'entrainements', result: entrainementsResult },
            { name: 'etapes', result: etapesResult },
            { name: 'etapeQuestions', result: etapeQuestionsResult },
            { name: 'formats', result: formatsResult },
            { name: 'questions', result: questionsResult }
        ];
        apiResults.forEach(({ name, result }) => {
            if (!result.success) {
                console.warn(`[EleveConnaissances] API ${name} échouée:`, result.error || 'Erreur inconnue');
            }
        });

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
        } catch (error) {
            console.warn('[EleveConnaissances] Erreur lors du rafraîchissement en arrière-plan:', error);
        }
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
                    actionHint = `${reussites}/6 réussies`;
                    break;
                case 'verrouille':
                    statusBadge = `<span class="entrainement-badge locked">⏳ Dans ${statusInfo.joursRestants}j</span>`;
                    actionHint = `${reussites}/6 réussies`;
                    break;
                case 'memorise':
                    statusBadge = '<span class="entrainement-badge done">✅ Mémorisé</span>';
                    actionHint = '6/6 réussies';
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
            this.etapesResults = [];
            this.currentEtapeValidated = false;
            this.exerciseStartTime = Date.now();
            // Réinitialiser les états d'association
            this.associationSelection = { grid: null, chip: null };
            this.associationPairs = [];
            this.associationPairCounter = 0;
            // Réinitialiser les données stockées par étape
            this.selectedQuestionsPerEtape = {};

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

        const isValidated = this.currentEtapeValidated;
        const isLastEtape = this.currentEtapeIndex >= etapes.length - 1;
        const isFlashcard = currentEtape.format_code === 'flashcard';

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
                                <span id="timerDisplay">${this.formatTime(this.timeRemaining || ent.duree * 60)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Barre de progression des étapes -->
                    <div class="etapes-navigation">
                        <div class="etapes-progress">
                            ${etapes.map((etape, idx) => {
                                const validated = idx < this.etapesResults.length;
                                const isCurrent = idx === this.currentEtapeIndex;
                                return `<div class="etape-dot ${validated ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
                                     title="Étape ${idx + 1}">
                                    ${validated ? '✓' : idx + 1}
                                </div>`;
                            }).join('<div class="etape-connector"></div>')}
                        </div>
                    </div>

                    <!-- Titre de l'étape -->
                    <div class="etape-header">
                        <h2>${this.escapeHtml(currentEtape.titre || 'Étape ' + (this.currentEtapeIndex + 1))}</h2>
                        <span class="etape-format-badge">${this.getFormatLabel(currentEtape.format_code)}</span>
                    </div>

                    <!-- Contenu de l'étape (questions) -->
                    <div class="exercise-content ${isValidated ? 'validated' : ''}" id="exerciseContent">
                        ${this.renderEtapeContent(currentEtape, etapeQuestions)}
                    </div>

                    <!-- Zone de feedback (visible après validation) -->
                    <div class="etape-feedback" id="etapeFeedback" style="display: none;"></div>

                    <!-- Bouton d'action -->
                    <div class="etape-action-bar" id="etapeActionBar">
                        ${isFlashcard ? '' : (isValidated ? `
                            <button class="btn-etape-action next-btn" onclick="EleveConnaissances.${isLastEtape ? 'finishEntrainement' : 'nextEtape'}()">
                                ${isLastEtape ? 'Terminer ✓' : 'Suivant →'}
                            </button>
                        ` : `
                            <button class="btn-etape-action validate-btn" onclick="EleveConnaissances.validateCurrentEtape()">
                                Valider
                            </button>
                        `)}
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
                    const questionContent = this.questionsConnaissances.find(q =>
                        String(q.id) === String(questionRef.question_id)
                    );

                    if (!questionContent) {
                        console.warn(`[EleveConnaissances] Question ID ${questionRef.question_id} non trouvée, ignorée`);
                        continue;
                    }

                    let donnees = questionContent.donnees || {};
                    if (typeof donnees === 'string') {
                        try {
                            donnees = JSON.parse(donnees);
                            // Double-encodage possible : si le résultat est encore une string, re-parser
                            if (typeof donnees === 'string') {
                                donnees = JSON.parse(donnees);
                            }
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
            case 'timeline':
                // Mode texte (paires date/événement) ou mode cartes (drag & drop)
                if (donnees.paires && donnees.mode) {
                    return this.renderChronologie(donnees, questions);
                }
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
            case 'flashcard':
                return this.renderFlashcard(donnees, questions);
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
                let timelineMode = undefined;
                let timelineConsigne = undefined;
                questionContents.forEach(qc => {
                    if (qc.donnees.evenements) allEvents.push(...qc.donnees.evenements);
                    if (qc.donnees.paires) allPaires.push(...qc.donnees.paires);
                    if (qc.donnees.mode) timelineMode = qc.donnees.mode;
                    if (qc.donnees.consigne) timelineConsigne = qc.donnees.consigne;
                });
                const combined = {
                    evenements: allEvents.length > 0 ? allEvents : undefined,
                    paires: allPaires.length > 0 ? allPaires : undefined
                };
                if (timelineMode) combined.mode = timelineMode;
                if (timelineConsigne) combined.consigne = timelineConsigne;
                return combined;

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
     * Render Timeline (cartes draggables avec image de fond optionnelle par carte)
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
                        const imageUrl = this.normalizeImageUrl(carte.image_url);
                        const hasImage = imageUrl ? true : false;
                        const imgStyle = hasImage ? `style="background-image: url('${this.escapeHtml(imageUrl)}');"` : '';
                        return `
                        <div class="timeline-card ${hasImage ? 'has-image' : ''}" draggable="true" data-original-index="${carte.originalIndex}" data-titre="${this.escapeHtml(carte.titre)}" ${imgStyle}>
                            <span class="timeline-card-titre">${this.escapeHtml(carte.titre)}</span>
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
            this.associationPairCounter++;
            const pairNum = this.associationPairCounter;

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
    },

    /**
     * Affiche le récapitulatif des flashcards
     */
    showFlashcardSummary() {
        const state = this.flashcardState;
        const scene = document.getElementById('flashcardScene');
        const actions = document.getElementById('flashcardActions');
        const summary = document.getElementById('flashcardSummary');
        const counter = document.getElementById('flashcardCounter');
        const progressFill = document.getElementById('flashcardProgressFill');

        if (scene) scene.style.display = 'none';
        if (actions) actions.style.display = 'none';

        const nbSavait = state.results.filter(r => r.savait).length;
        if (counter) counter.textContent = `Terminé : ${nbSavait} / ${state.total} cartes réussies`;
        if (progressFill) progressFill.style.width = '100%';

        if (summary) {
            summary.style.display = 'block';
            summary.innerHTML = `
                <div class="flashcard-summary-score ${nbSavait === state.total ? 'perfect' : nbSavait >= state.total / 2 ? 'partial' : 'fail'}">
                    <span class="flashcard-summary-icon">${nbSavait === state.total ? '🎉' : nbSavait >= state.total / 2 ? '💪' : '📚'}</span>
                    <span class="flashcard-summary-text">${nbSavait} / ${state.total} cartes réussies</span>
                </div>
                <div class="flashcard-summary-details">
                    ${state.results.map((r, i) => `
                        <div class="flashcard-summary-item ${r.savait ? 'correct' : 'incorrect'}">
                            <span class="flashcard-summary-item-icon">${r.savait ? '✓' : '✗'}</span>
                            <div class="flashcard-summary-item-content">
                                <span class="flashcard-summary-recto">${this.escapeHtml(r.recto)}</span>
                                <span class="flashcard-summary-verso">→ ${this.escapeHtml(r.verso)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Auto-valider l'étape flashcard et afficher le bouton Suivant
        this.validateCurrentEtape();
    },

    /**
     * Render Question ouverte
     * Format: {question, reponses_acceptees: [...], feedback_correct?, feedback_incorrect?}
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
     * Validate current etape — feedback immédiat style Projet Voltaire
     * Récupère les données via la jointure etapeQuestions → questionsConnaissances
     * Affiche le feedback inline, désactive les inputs, puis affiche le bouton Suivant
     */
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

                    const feedback = document.getElementById('feedback_vf_0');
                    if (feedback) {
                        feedback.style.display = 'block';
                        feedback.className = `vf-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
                        feedback.textContent = isCorrect ? '✓ Correct' : `✗ La bonne réponse était: ${expected}`;
                        if (donnees.feedback_vrai && isCorrect) feedback.textContent += ` - ${donnees.feedback_vrai}`;
                        if (donnees.feedback_faux && !isCorrect) feedback.textContent += ` - ${donnees.feedback_faux}`;
                    }
                    details.push({ question: donnees.question, reponse: answer, attendu: expected, correct: isCorrect });
                } else {
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
                            if (!isCorrect && prop.feedback) feedback.textContent += ` - ${prop.feedback}`;
                        }
                        details.push({ question: prop.texte, reponse: answer, attendu: expected, correct: isCorrect });
                    });
                }
                break;

            case 'qcm':
                // Mode multi-questions (plusieurs QCM dans une étape)
                if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
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

                        const qcmFeedback = document.getElementById(`feedback_qcm_${qIdx}`);
                        if (qcmFeedback) {
                            qcmFeedback.style.display = 'block';
                            qcmFeedback.className = `qcm-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
                            qcmFeedback.textContent = isCorrect ? '✓ Correct !' : `✗ Ce n'est pas la bonne réponse.`;

                            const feedbacksOptions = q.feedbacks_options || [];
                            const chosenIdx = parseInt(userAnswer);
                            if (feedbacksOptions[chosenIdx]) {
                                qcmFeedback.textContent += ` ${feedbacksOptions[chosenIdx]}`;
                            } else if (isCorrect && q.feedback_correct) {
                                qcmFeedback.textContent += ` ${q.feedback_correct}`;
                            } else if (!isCorrect && q.feedback_incorrect) {
                                qcmFeedback.textContent += ` ${q.feedback_incorrect}`;
                            }
                        }
                        details.push({
                            question: q.question,
                            reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
                            attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                            correct: isCorrect
                        });
                    });
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

                    const qcmFeedback = document.getElementById('feedback_qcm');
                    if (qcmFeedback) {
                        qcmFeedback.style.display = 'block';
                        qcmFeedback.className = `qcm-feedback ${correct === 1 ? 'correct' : 'incorrect'}`;
                        qcmFeedback.textContent = correct === 1 ? '✓ Correct !' : `✗ Ce n'est pas la bonne réponse.`;

                        const feedbacksOptions = donnees.feedbacks_options || [];
                        const chosenIdx = parseInt(userAnswer);
                        if (feedbacksOptions[chosenIdx]) {
                            qcmFeedback.textContent += ` ${feedbacksOptions[chosenIdx]}`;
                        } else if (correct === 1 && donnees.feedback_correct) {
                            qcmFeedback.textContent += ` ${donnees.feedback_correct}`;
                        } else if (correct === 0 && donnees.feedback_incorrect) {
                            qcmFeedback.textContent += ` ${donnees.feedback_incorrect}`;
                        }
                    }
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
                        details.push({ question: mode === 'evenement' ? evt.date : evt.evenement, reponse: answer?.value, attendu: correctValue, correct: isCorrect });
                    });
                } else {
                    // Mode drag (timeline cartes)
                    const cartes = donnees.cartes || [];
                    const cardsContainer = document.getElementById('timelineCards');
                    if (cardsContainer) {
                        const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));
                        total = cartes.length;

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

                        // Afficher la correction si pas tout correct
                        if (correct < total) {
                            const existingCorrection = document.querySelector('.timeline-container .correction-section');
                            if (!existingCorrection) {
                                const correctionHtml = `
                                    <div class="correction-section">
                                        <h4>Ordre correct</h4>
                                        <div class="correction-list">
                                            ${cartes.map((carte, i) => `
                                                <div class="correction-item">
                                                    <span class="order-num">${i + 1}</span>
                                                    <span class="item-text">${this.escapeHtml(carte.titre)}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                                cardsContainer.insertAdjacentHTML('afterend', correctionHtml);
                            }
                        }
                    }
                }
                break;

            case 'texte_trou':
            case 'texte_trous':
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
                    details.push({ question: `Trou ${idx + 1}`, reponse: input.value, attendu: input.dataset.answer, correct: isOk });
                });
                break;

            case 'carte':
                const marqueurs = donnees.marqueurs || [];
                marqueurs.forEach((m, idx) => {
                    total++;
                    const answer = this.userAnswers['carte_' + idx];
                    const marker = document.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
                    const answerItem = document.querySelector(`.carte-answer-item[data-index="${idx}"]`);

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
                        details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrect });
                    } else {
                        if (marker) marker.classList.add('incorrect');
                        if (answerItem) answerItem.classList.add('incorrect');
                        details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
                    }
                });
                break;

            case 'question_ouverte':
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
                    qoFeedbackEl.style.display = 'block';
                    qoFeedbackEl.className = `question-ouverte-feedback ${qoCorrect ? 'correct' : 'incorrect'}`;
                    if (qoCorrect) {
                        qoFeedbackEl.textContent = '✓ Correct !';
                        if (donnees.feedback_correct) qoFeedbackEl.textContent += ` ${donnees.feedback_correct}`;
                    } else {
                        qoFeedbackEl.textContent = `✗ La bonne réponse était: ${qoReponsesAcceptees[0] || ''}`;
                        if (donnees.feedback_incorrect) qoFeedbackEl.textContent += ` ${donnees.feedback_incorrect}`;
                    }
                }
                details.push({ question: donnees.question, reponse: qoAnswer, attendu: qoReponsesAcceptees.join(' / '), correct: qoCorrect });
                break;

            case 'association':
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
                // Marquer les éléments non appariés comme incorrects
                document.querySelectorAll('#associationGrid .association-grid-card:not(.correct):not(.incorrect)').forEach(el => el.classList.add('incorrect'));

                // Cacher les chips et le label d'instruction
                const chipsZone = document.querySelector('#associationChips');
                if (chipsZone) chipsZone.style.display = 'none';
                const zoneLabel = document.querySelector('.association-zone-label');
                if (zoneLabel) zoneLabel.style.display = 'none';

                // Mettre à jour les labels sous chaque carte avec la correction
                const getChipText = (id) => {
                    const p = assocPaires[parseInt(id)];
                    if (!p) return '?';
                    return this._assocChipSide === 'gauche' ? p.element1 : p.element2;
                };

                document.querySelectorAll('#associationGrid .association-grid-card').forEach(card => {
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
        this.etapesResults[this.currentEtapeIndex] = {
            etapeIndex: this.currentEtapeIndex,
            etapeTitre: currentEtape.titre || `Étape ${this.currentEtapeIndex + 1}`,
            format: currentEtape.format_code,
            correct,
            total,
            pourcentage: percent,
            details,
            donnees
        };

        // Désactiver les inputs
        const content = document.getElementById('exerciseContent');
        if (content) {
            content.classList.add('validated');
            content.querySelectorAll('input, select, textarea, button').forEach(el => {
                if (!el.closest('.etape-action-bar')) el.disabled = true;
            });
            // Désactiver les clics sur les items d'association (grille + chips)
            content.querySelectorAll('.association-grid-card, .association-chip').forEach(el => {
                el.style.pointerEvents = 'none';
            });
        }

        // Bandeau unifié : feedback + bouton dans un seul bloc
        const feedbackZone = document.getElementById('etapeFeedback');
        const isLastEtape = this.currentEtapeIndex >= this.currentEtapes.length - 1;
        if (feedbackZone) {
            feedbackZone.style.display = 'block';
            const feedbackClass = percent === 100 ? 'success' : percent >= 50 ? 'partial' : 'error';
            feedbackZone.className = `etape-feedback ${feedbackClass}`;

            const messages = {
                success: { icon: '✓', title: 'Bravo !', sub: 'Parfait, continue comme ça !' },
                partial: { icon: '~', title: 'Pas mal !', sub: 'Tu y es presque, encore un effort.' },
                error: { icon: '✗', title: 'Dommage...', sub: 'Regarde la correction et réessaie.' }
            };
            const msg = messages[feedbackClass];
            const btnAction = isLastEtape ? 'finishEntrainement' : 'nextEtape';
            const btnLabel = isLastEtape ? 'Terminer ✓' : 'Suivant →';

            feedbackZone.innerHTML = `
                <div class="etape-feedback-main">
                    <div class="etape-feedback-icon">${msg.icon}</div>
                    <div class="etape-feedback-text">
                        <strong>${msg.title}</strong>
                        <span>${correct}/${total} correct${correct > 1 ? 's' : ''} — ${msg.sub}</span>
                    </div>
                    <button class="btn-etape-action next-btn" onclick="EleveConnaissances.${btnAction}()">
                        ${btnLabel}
                    </button>
                </div>
            `;
        }

        // Cacher l'ancienne barre d'action (le bouton est dans le bandeau)
        const actionBar = document.getElementById('etapeActionBar');
        if (actionBar) actionBar.style.display = 'none';
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
                    try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
                }
            }
        }

        if (Object.keys(donnees).length === 0 && etape.donnees) {
            donnees = etape.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }
        }
        return donnees;
    },

    /**
     * Navigate to previous etape (désactivé dans le nouveau flux)
     */
    previousEtape() {
        // Plus de retour en arrière dans le nouveau flux
    },

    /**
     * Navigate to next etape — uniquement après validation
     */
    nextEtape() {
        if (!this.currentEtapeValidated) return;
        if (this.currentEtapeIndex < this.currentEtapes.length - 1) {
            this.currentEtapeIndex++;
            this.currentEtapeValidated = false;
            // Réinitialiser les réponses et états pour la nouvelle étape
            this.userAnswers = {};
            this.associationSelection = { grid: null, chip: null };
            this.associationPairs = [];
            this.associationPairCounter = 0;
            this.renderEntrainementView();
        }
    },

    /**
     * Finish the entrainement - Utilise les résultats déjà calculés par validateCurrentEtape
     */
    async finishEntrainement() {
        this.stopTimer();

        // Si l'étape courante n'a pas encore été validée (ex: timer expiré), la valider
        if (!this.currentEtapeValidated) {
            this.validateCurrentEtape();
        }

        // Compiler les résultats à partir des étapes déjà validées
        const results = this.compileResults();
        this.lastResults = results;

        await this.saveProgression(results);
        this.renderResultScreen(results);
    },

    /**
     * Compile les résultats depuis etapesResults (déjà remplis par validateCurrentEtape)
     */
    compileResults() {
        let totalCorrect = 0;
        let totalQuestions = 0;

        // Pour les étapes non encore validées (timer expiré), créer un résultat vide
        this.currentEtapes.forEach((etape, idx) => {
            if (!this.etapesResults[idx]) {
                this.etapesResults[idx] = {
                    etapeIndex: idx,
                    etapeTitre: etape.titre || `Étape ${idx + 1}`,
                    format: etape.format_code,
                    correct: 0,
                    total: 0,
                    pourcentage: 0,
                    details: [],
                    donnees: {}
                };
            }
        });

        this.etapesResults.forEach(result => {
            totalCorrect += result.correct;
            totalQuestions += result.total;
        });

        const pourcentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return {
            etapes: this.etapesResults,
            totalCorrect,
            totalQuestions,
            pourcentage
        };
    },

    // validateSingleEtape supprimé — les résultats sont maintenant
    // stockés par validateCurrentEtape() dans this.etapesResults

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
                    <div class="locked-modal-etape">Niveau ${Math.max((prog.etape || 1) - 1, 0)}/6 validé</div>
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
     * Génère le HTML du détail des erreurs (pour la colonne droite en cas d'échec)
     */
    generateErrorDetails(results) {
        if (!results.etapes || results.etapes.length === 0) {
            return `
                <div class="correction-empty">
                    <p>Détail non disponible.</p>
                </div>
            `;
        }
        const hasErrors = results.etapes.some(e => e.details && e.details.some(d => !d.correct));
        if (!hasErrors) {
            return `
                <div class="felicitation-panel success">
                    <div class="felicitation-icon">🎉</div>
                    <h3>Aucune erreur !</h3>
                    <p>Tu as tout réussi, bravo !</p>
                </div>
            `;
        }
        const errorGroups = results.etapes.map((etape, idx) => {
            const errors = (etape.details || []).filter(d => !d.correct);
            if (errors.length === 0) return '';
            return `
                <div class="correction-etape-group">
                    <div class="correction-etape-title">${this.escapeHtml(etape.etapeTitre || 'Étape ' + (idx + 1))}</div>
                    ${errors.map(err => `
                        <div class="correction-error-row">
                            <div class="correction-error-q">${this.escapeHtml(String(err.question || ''))}</div>
                            <div class="correction-error-answers">
                                <span class="correction-given">${this.escapeHtml(String(err.reponse || '—'))}</span>
                                ${err.attendu ? `<span class="correction-expected">→ ${this.escapeHtml(String(err.attendu))}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');

        return `
            <div class="correction-header-conn">
                <h3>📝 Détail des erreurs</h3>
            </div>
            <div class="correction-body-conn">
                ${errorGroups}
            </div>
        `;
    },

    /**
     * Affiche l'écran de résultats avec récapitulatif
     */
    renderResultScreen(results) {
        const container = document.getElementById('connaissances-content');
        const ent = this.currentEntrainement;
        const prog = this.lastProgressionResult || {};

        // Temps passé
        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = (ent.duree || 5) * 60;
        const tempsOK = timeSpent <= tempsPrevu;

        // prog.etape = prochain niveau à tenter (déjà incrémenté côté serveur)
        const SEUIL_ETAPES = 6;
        const niveauValide = Math.max((prog.etape || 1) - 1, 0);
        const isSuccess = !this.isTrainingMode && prog.reussi === true;

        // Déterminer le type de résultat
        let resultType, messageIcon, messageTitle;
        if (isSuccess) {
            resultType = 'success';
            messageIcon = '✅';
            messageTitle = prog.statut === 'memorise' ? 'Mémorisé !' : `Bravo ! Niveau ${niveauValide}/${SEUIL_ETAPES} atteint`;
        } else if (results.pourcentage >= 50) {
            resultType = 'partial';
            messageIcon = '💪';
            messageTitle = 'Pas mal !';
        } else {
            resultType = 'error';
            messageIcon = '❌';
            messageTitle = 'Continue !';
        }

        // Dots de progression (6 niveaux)
        const generateProgDots = () => {
            let html = '<div class="rep-dots">';
            for (let i = 1; i <= SEUIL_ETAPES; i++) {
                const status = i <= niveauValide ? 'completed' : 'pending';
                html += `<span class="rep-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        // Date prochaine révision
        let prochaineDateStr = '';
        if (prog.prochaine_revision) {
            prochaineDateStr = new Date(prog.prochaine_revision).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long'
            });
        }

        const nextEntrainement = this.findNextEntrainement();

        // Colonne droite : félicitation (réussite) ou détail des erreurs (échec)
        const generateFelicitationPanel = () => {
            if (prog.statut === 'memorise' && prog.reussi) {
                return `
                    <div class="felicitation-panel memorise">
                        <div class="felicitation-icon">🏆</div>
                        <h3>Mémorisé !</h3>
                        <p>Tu maîtrises parfaitement cet entraînement. Les connaissances sont ancrées dans ta mémoire long terme !</p>
                    </div>
                `;
            }
            if (isSuccess) {
                return `
                    <div class="felicitation-panel success">
                        <div class="felicitation-icon">🎉</div>
                        <h3>Niveau ${niveauValide} validé !</h3>
                        <p>Continue comme ça, tu es sur la bonne voie pour tout mémoriser !</p>
                    </div>
                `;
            }
            // Échec : afficher le détail des erreurs
            return this.generateErrorDetails(results);
        };

        container.innerHTML = `
            <div class="result-view conn">
                <button class="exercise-back-btn" onclick="EleveConnaissances.backToList()">
                    ← Retour aux entraînements
                </button>

                <div class="result-card-conn">
                    <!-- COLONNE GAUCHE : BILAN -->
                    <div class="result-bilan-conn">
                        <div class="bilan-header ${resultType}">
                            <span class="bilan-icon">${messageIcon}</span>
                            <span class="bilan-message">${messageTitle}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${resultType}">
                                <span class="score-value">${results.pourcentage}%</span>
                            </div>
                            <span class="score-detail">${results.totalCorrect}/${results.totalQuestions}</span>
                        </div>

                        <div class="bilan-temps-compact">
                            <span class="temps-info">⏱️ ${this.formatTime(timeSpent)} / ${this.formatTime(tempsPrevu)}</span>
                            <span class="temps-status ${tempsOK ? 'success' : 'warning'}">${tempsOK ? '✓' : '⚠️'}</span>
                        </div>

                        ${!this.isTrainingMode ? `
                        <div class="bilan-repetition-compact">
                            <span class="rep-dots-inline">${generateProgDots()}</span>
                            <span class="rep-label">Niveau ${niveauValide}/${SEUIL_ETAPES}</span>
                        </div>
                        ` : `
                        <div class="bilan-entrainement-libre-badge">
                            <span class="libre-badge-icon">🔄</span>
                            <span class="libre-badge-text">Entraînement libre</span>
                        </div>
                        `}

                        <div class="bilan-messages">
                            ${prog.statut === 'memorise' && prog.reussi ? `
                                <div class="bilan-maitrise">
                                    <span class="maitrise-icon">🎉</span>
                                    <p>Cet entraînement est mémorisé !</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && prog.statut !== 'memorise' ? `
                                <div class="bilan-prochaine-new">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${prog.etape || 1} !</p>
                                </div>
                            ` : ''}

                            ${!isSuccess && !this.isTrainingMode && prog.reussi === false ? `
                                <div class="bilan-conseil warning">
                                    <span class="conseil-icon">💡</span>
                                    <p>Il faut ${prog.seuil || 80}% pour valider ce niveau.</p>
                                </div>
                            ` : ''}

                            <div class="bilan-actions">
                                ${!isSuccess && !this.isTrainingMode ? `
                                    <button class="btn btn-primary btn-restart-conn" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Réessayer
                                    </button>
                                ` : ''}

                                ${this.isTrainingMode ? `
                                    <button class="btn btn-primary btn-restart-conn" onclick="EleveConnaissances.restartEntrainement()">
                                        🔄 Recommencer
                                    </button>
                                ` : ''}

                                ${nextEntrainement && isSuccess ? `
                                    <button class="btn btn-primary btn-next-conn" onclick="EleveConnaissances.startNextEntrainement()">
                                        Passer au suivant →
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- COLONNE DROITE : FÉLICITATION ou ERREURS -->
                    <div class="result-right-conn ${isSuccess || (prog.statut === 'memorise' && prog.reussi) ? 'is-felicitation' : 'is-correction'}">
                        ${generateFelicitationPanel()}
                    </div>
                </div>
            </div>
        `;

        // Déclencher les animations paillettes si réussite (pas en mode libre)
        if (isSuccess && !this.isTrainingMode) {
            setTimeout(() => {
                this.triggerCelebration(niveauValide);
                if (prog.statut === 'memorise' && ent && ent.banque_exercice_id) {
                    this.checkAndCelebrateBanqueComplete(ent.banque_exercice_id);
                }
            }, 100);
        }
    },

    /**
     * Redémarre l'entraînement en mode libre (pour continuer à s'entraîner après réussite)
     */
    restartAsTraining() {
        this.isTrainingMode = true;
        // Passer true pour skipAvailabilityCheck afin de ne pas écraser isTrainingMode
        this.startEntrainement(this.currentEntrainement.id, true);
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
            .filter(e => String(e.banque_exercice_id) === String(this.currentBanque.id))
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
        this.currentEtapeValidated = false;
        this.etapesResults = [];
        // Réinitialiser les états d'association
        this.associationSelection = { grid: null, chip: null };
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

    // ========== PIPELINE COMPARAISON SOUPLE ==========

    /** Mots-outils français à ignorer en mode souple */
    STOP_WORDS: new Set([
        'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd',
        'a', 'au', 'aux', 'et', 'ou', 'en', 'dans', 'sur', 'par', 'pour'
    ]),

    /** Table chiffres écrits → arabe (1-30) */
    NOMBRES_LETTRES: {
        'zero': '0', 'un': '1', 'deux': '2', 'trois': '3', 'quatre': '4',
        'cinq': '5', 'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9',
        'dix': '10', 'onze': '11', 'douze': '12', 'treize': '13', 'quatorze': '14',
        'quinze': '15', 'seize': '16', 'dix-sept': '17', 'dix-huit': '18', 'dix-neuf': '19',
        'vingt': '20', 'vingt-et-un': '21', 'vingt-deux': '22', 'vingt-trois': '23',
        'vingt-quatre': '24', 'vingt-cinq': '25', 'vingt-six': '26', 'vingt-sept': '27',
        'vingt-huit': '28', 'vingt-neuf': '29', 'trente': '30',
        'premier': '1', 'premiere': '1', 'deuxieme': '2', 'troisieme': '3',
        'quatrieme': '4', 'cinquieme': '5', 'sixieme': '6', 'septieme': '7',
        'huitieme': '8', 'neuvieme': '9', 'dixieme': '10',
        'onzieme': '11', 'douzieme': '12', 'treizieme': '13', 'quatorzieme': '14',
        'quinzieme': '15', 'seizieme': '16', 'vingtieme': '20', 'trentieme': '30'
    },

    /** Table chiffres romains → arabe */
    ROMAINS: {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8,
        'IX': 9, 'X': 10, 'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
        'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20, 'XXI': 21,
        'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27,
        'XXVIII': 28, 'XXIX': 29, 'XXX': 30
    },

    /**
     * Convertit les chiffres romains en arabes dans un texte.
     * Cherche les mots composés uniquement de I, V, X et les convertit.
     */
    convertRomainToArabe(text) {
        return text.replace(/\b([IVXLC]+)\b/g, (match) => {
            if (this.ROMAINS[match] !== undefined) {
                return String(this.ROMAINS[match]);
            }
            return match;
        });
    },

    /**
     * Convertit les nombres écrits en lettres en arabes.
     * Ex: "quatorze" → "14", "vingt-deux" → "22"
     */
    convertNombresLettres(text) {
        // D'abord les composés (vingt-deux, dix-sept, etc.)
        for (const [lettres, chiffre] of Object.entries(this.NOMBRES_LETTRES)) {
            if (lettres.includes('-')) {
                const regex = new RegExp('\\b' + lettres.replace('-', '[\\s-]') + '\\b', 'g');
                text = text.replace(regex, chiffre);
            }
        }
        // Puis les simples
        for (const [lettres, chiffre] of Object.entries(this.NOMBRES_LETTRES)) {
            if (!lettres.includes('-')) {
                const regex = new RegExp('\\b' + lettres + '\\b', 'g');
                text = text.replace(regex, chiffre);
            }
        }
        return text;
    },

    /**
     * Singularisation légère du français :
     * - eaux → eau (gâteaux → gâteau)
     * - aux → al (animaux → animal)
     * - s final retiré (chats → chat)
     * - x final retiré (cheveux → cheveu)
     */
    simpleStem(word) {
        if (word.length <= 2) return word;
        if (word.endsWith('eaux')) return word.slice(0, -1);       // eaux → eau
        if (word.endsWith('aux')) return word.slice(0, -3) + 'al'; // aux → al
        if (word.endsWith('s')) return word.slice(0, -1);          // s final
        if (word.endsWith('x')) return word.slice(0, -1);          // x final
        return word;
    },

    /**
     * Normalise un texte pour comparaison tolérante (mode souple) :
     * - minuscules + suppression accents
     * - conversion romains → arabes, lettres → arabes
     * - suppression ponctuation
     * - suppression mots-outils
     * - singularisation légère
     */
    normalizeSouple(text) {
        if (!text) return '';
        // Convertir romains AVANT la mise en minuscules
        let t = this.convertRomainToArabe(text.trim());
        t = t.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
            .replace(/['']/g, ' ')                            // apostrophes → espace
            .replace(/[^a-z0-9\s\-]/g, '')                    // garder lettres, chiffres, espaces, tirets
            .replace(/\s+/g, ' ')
            .trim();
        // Convertir nombres en lettres → arabes
        t = this.convertNombresLettres(t);
        // Supprimer mots-outils et appliquer stemming
        const words = t.split(' ')
            .filter(w => !this.STOP_WORDS.has(w))
            .map(w => this.simpleStem(w));
        return words.join(' ');
    },

    /**
     * Sépare un texte brut en éléments (split sur "," et " et " et " ou ").
     * À appeler AVANT normalisation pour conserver les délimiteurs.
     */
    splitElements(text) {
        return text
            .split(/\s*,\s*|\s+et\s+|\s+ou\s+/i)
            .map(s => s.trim())
            .filter(Boolean);
    },

    /**
     * Compare une réponse élève à une réponse attendue.
     * @param {string} userAnswer - réponse de l'élève
     * @param {string} expectedAnswer - réponse attendue
     * @param {boolean} stricte - si true, comparaison exacte ; si false, pipeline souple
     */
    compareAnswers(userAnswer, expectedAnswer, stricte) {
        if (!userAnswer || !expectedAnswer) return false;

        // Mode strict : comparaison exacte (trim seulement)
        if (stricte) {
            return userAnswer.trim() === expectedAnswer.trim();
        }

        // Mode souple : comparaison directe après normalisation
        const normUser = this.normalizeSouple(userAnswer);
        const normExpected = this.normalizeSouple(expectedAnswer);
        if (normUser === normExpected) return true;

        // Comparaison par éléments : splitter le texte BRUT, puis normaliser chaque partie
        const userParts = this.splitElements(userAnswer).map(p => this.normalizeSouple(p)).sort();
        const expectedParts = this.splitElements(expectedAnswer).map(p => this.normalizeSouple(p)).sort();

        if (userParts.length === expectedParts.length && userParts.length > 0 &&
            userParts.every((part, i) => part === expectedParts[i])) {
            return true;
        }

        return false;
    },

    /**
     * Convertit une URL Google Drive partagée en URL d'image directe.
     * Ex: https://drive.google.com/file/d/ABC123/view → https://lh3.googleusercontent.com/d/ABC123
     */
    normalizeImageUrl(url) {
        if (!url) return '';
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
        if (driveFileMatch) {
            return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
        }
        const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
        if (driveOpenMatch) {
            return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
        }
        const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
        if (driveUcMatch) {
            return `https://lh3.googleusercontent.com/d/${driveUcMatch[1]}`;
        }
        return url;
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
            'chronologie': 'Frise chronologique',
            'timeline': 'Frise chronologique',
            'texte_trou': 'Texte à trous',
            'texte_trous': 'Texte à trous',
            'association': 'Association',
            'carte': 'Carte',
            'question_ouverte': 'Question ouverte',
            'flashcard': 'Flashcards'
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
    // CÉLÉBRATIONS - Animations paillettes progressives (6 niveaux)
    // ============================================

    /**
     * Animation de célébration progressive selon le niveau validé
     * Intensité croissante : paillettes → confettis → étoiles dorées
     */
    triggerCelebration(level) {
        // Supprimer une célébration existante
        const existing = document.querySelector('.celebration-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = `celebration-container level-${level}`;
        document.body.appendChild(container);

        // Configuration progressive pour 6 niveaux
        const config = {
            1: { sparkles: 20, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b'] },
            2: { sparkles: 30, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#34d399'] },
            3: { sparkles: 40, confetti: 15, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6'] },
            4: { sparkles: 45, confetti: 30, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            5: { sparkles: 50, confetti: 45, stars: 8, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            6: { sparkles: 60, confetti: 60, stars: 15, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'] }
        };

        const cfg = config[Math.min(level, 6)] || config[1];

        // Paillettes
        for (let i = 0; i < cfg.sparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            sparkle.style.animationDelay = Math.random() * 0.5 + 's';
            sparkle.style.width = (6 + Math.random() * 8) + 'px';
            sparkle.style.height = sparkle.style.width;
            container.appendChild(sparkle);
        }

        // Confettis (niveau 3+)
        for (let i = 0; i < cfg.confetti; i++) {
            const confettiEl = document.createElement('div');
            confettiEl.className = 'confetti';
            confettiEl.style.left = Math.random() * 100 + '%';
            confettiEl.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            confettiEl.style.animationDelay = Math.random() * 0.8 + 's';
            confettiEl.style.width = (6 + Math.random() * 6) + 'px';
            confettiEl.style.height = (12 + Math.random() * 10) + 'px';
            container.appendChild(confettiEl);
        }

        // Étoiles dorées (niveau 5+)
        for (let i = 0; i < cfg.stars; i++) {
            const star = document.createElement('div');
            star.className = 'golden-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 1 + 's';
            star.style.width = (15 + Math.random() * 15) + 'px';
            star.style.height = star.style.width;
            container.appendChild(star);
        }

        // Supprimer après l'animation
        setTimeout(() => container.remove(), 5000);
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
