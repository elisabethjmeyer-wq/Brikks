/**
 * Connaissances Élève - Logique JavaScript
 * Gestion des entraînements de connaissances pour les élèves
 * Utilise le système ENTRAINEMENTS_CONN
 */

// Défini aussi dans eleve-exercices.js — déclaré ici pour les pages qui ne le chargent pas
if (typeof parseJSONField === 'undefined') {
    // eslint-disable-next-line no-unused-vars
    function parseJSONField(raw, fallback = {}) {
        if (!raw) return fallback;
        if (typeof raw === 'object') return raw;
        try {
            let parsed = JSON.parse(raw);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            return parsed;
        } catch (e) {
            return fallback;
        }
    }
}

const EleveConnaissances = {
    // Nombre d'étapes de mémorisation (doit correspondre à ETAPE_MAX côté backend)
    SEUIL_ETAPES: 7,

    // Données
    banques: [],
    entrainements: [],
    etapes: [],
    etapeQuestions: [],
    formatsQuestions: [],
    questionsConnaissances: [],  // Contenu des questions avec donnees
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
                Logger.error('EleveConnaissances', 'Erreur lors du chargement', error);
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
            Logger.error('EleveConnaissances', 'Erreur getCurrentUser', e);
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
        } catch (e) {
            Logger.warn('EleveConnaissances', 'Cache getFromCache failed', e);
            return null;
        }
    },

    saveToCache(data) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                ...data,
                timestamp: Date.now()
            }));
        } catch (e) { /* storage full or unavailable, ignore */ }
    },

    applyData(data) {
        this.banques = data.banques || [];
        this.formatsQuestions = data.formatsQuestions || [];
        this.questionsConnaissances = data.questionsConnaissances || [];

        // Filtrer les entraînements non publiés + les données orphelines
        const banqueIds = new Set(this.banques.map(b => String(b.id)));
        this.entrainements = (data.entrainements || []).filter(e =>
            String(e.statut).toLowerCase() === 'publie' && banqueIds.has(String(e.banque_exercice_id))
        );

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
        Logger.debug('EleveConnaissances', 'Données chargées', {
            banques: this.banques.length,
            entrainements: this.entrainements.length
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
                Logger.warn('EleveConnaissances', `API ${name} échouée`, result.error || 'Erreur inconnue');
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
                Logger.debug('EleveConnaissances', 'Progressions chargées', Object.keys(this.progressions).length);
            }
        } catch (error) {
            Logger.error('EleveConnaissances', 'Erreur chargement progressions', error);
            this.progressions = {};
        }
    },

    // Stockage des progressions
    progressions: {},

    async refreshDataInBackground() {
        try {
            await this.loadData();
        } catch (error) {
            Logger.warn('EleveConnaissances', 'Erreur lors du rafraîchissement en arrière-plan', error);
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
                            <div class="banque-title">${escapeHtml(banque.titre)}</div>
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
            // etape = prochain niveau à tenter (backend incrémente après succès)
            // niveauxValides = nombre de niveaux effectivement réussis
            const etape = prog?.etape || 0;
            const niveauxValides = Math.max(0, etape - 1);

            sommeEtapes += niveauxValides;

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

        // Progression moyenne = moyenne des (étape / SEUIL_ETAPES) * 100
        const progressionMoyenne = total > 0 ? Math.round((sommeEtapes / total / this.SEUIL_ETAPES) * 100) : 0;

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
            return '<div class="empty-state"><p>Aucun entraînement dans cette banque</p></div>';
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
                    actionHint = `${reussites}/${this.SEUIL_ETAPES} réussies`;
                    break;
                case 'verrouille':
                    statusBadge = `<span class="entrainement-badge locked">⏳ Dans ${statusInfo.joursRestants}j</span>`;
                    actionHint = `${reussites}/${this.SEUIL_ETAPES} réussies`;
                    break;
                case 'memorise':
                    statusBadge = '<span class="entrainement-badge done">✅ Mémorisé</span>';
                    actionHint = `${this.SEUIL_ETAPES}/${this.SEUIL_ETAPES} réussies`;
                    break;
            }

            // Construire les métadonnées : durée + description si disponible
            let metaText = `${dureeMinutes} min`;
            if (ent.description) {
                metaText += ` • ${escapeHtml(ent.description)}`;
            }

            return `
                <div class="exercice-item connaissances ${statusInfo.class}"
                     onclick="EleveConnaissances.startEntrainement('${ent.id}')"
                     data-entrainement-id="${ent.id}">
                    <div class="exercice-numero">${index + 1}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${escapeHtml(ent.titre || 'Entraînement ' + (index + 1))}</div>
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
            Logger.debug('EleveConnaissances', 'startEntrainement', { entrainementId });

            const entrainement = this.entrainements.find(e => e.id === entrainementId);
            if (!entrainement) {
                this.showError('Entraînement non trouvé');
                return;
            }

            this.currentEntrainement = entrainement;
            this.currentBanque = this.banques.find(b => b.id === entrainement.banque_exercice_id);
            this.currentEtapeIndex = 0;
            this.etapesResults = [];
            this.exerciseStartTime = Date.now();
            this.resetEtapeState();
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

            Logger.debug('EleveConnaissances', 'Étapes trouvées pour cet entrainement', { count: entrainementEtapes.length });

            if (entrainementEtapes.length === 0) {
                // Pas d'étapes - afficher un message mais quand même permettre de voir l'entraînement
                Logger.warn('EleveConnaissances', 'Aucune étape trouvée, vérifier la structure des données');
                this.showError('Cet entraînement n\'a pas encore d\'étapes configurées');
                return;
            }

            this.currentEtapes = entrainementEtapes;
            this.renderEntrainementView();

        } catch (error) {
            Logger.error('EleveConnaissances', 'Erreur lors de startEntrainement', error);
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
                                <h1>${banque ? escapeHtml(banque.titre) : ''} - ${escapeHtml(ent.titre)}</h1>
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
                        <h2>${escapeHtml(currentEtape.titre || 'Étape ' + (this.currentEtapeIndex + 1))}</h2>
                        <span class="qcm-header-counter" id="qcmHeaderCounter"></span>
                        <span class="etape-format-badge">${this.getFormatLabel(currentEtape.format_code)}</span>
                    </div>
                    <!-- Barre de progression intra-étape (multi-questions) -->
                    <div class="multi-progress-bar hidden" id="multiProgressBar">
                        <div class="multi-progress-fill" id="multiProgressFill"></div>
                    </div>

                    <!-- Contenu de l'étape (questions) -->
                    <div class="exercise-content ${isValidated ? 'validated' : ''}" id="exerciseContent">
                        ${this.renderEtapeContent(currentEtape, etapeQuestions)}
                    </div>

                    <!-- Zone de feedback (visible après validation) -->
                    <div class="etape-feedback hidden" id="etapeFeedback"></div>

                    <!-- Bouton d'action (à droite, unifié pour tous les formats) -->
                    <div class="etape-action-bar" id="etapeActionBar">
                        ${isFlashcard ? '' : `
                            <button class="btn-etape-action ${isValidated ? (isLastEtape ? 'finish-btn' : 'next-btn') : 'validate-btn'}" onclick="EleveConnaissances.${isValidated ? (isLastEtape ? 'finishEntrainement' : 'nextEtape') : 'validateCurrentEtape'}()">
                                ${isValidated ? (isLastEtape ? 'Terminer ✓' : 'Suivant →') : 'Valider'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Multi-questions (QCM, V/F, QO, et formats génériques) : masquer le bouton Valider de l'étape + afficher le compteur
        const qcmMulti = document.querySelector('.qcm-multi-container[data-total-q]');
        const vfMulti = document.querySelector('.vrai-faux-container[data-total-vf]');
        const qoMulti = document.querySelector('.qo-multi-container[data-total-qo]');
        const mfMulti = document.querySelector('.multi-format-container[data-total-mf]');
        const flashcardContainer = document.querySelector('.flashcard-container');
        const multiTotal = qcmMulti ? parseInt(qcmMulti.getAttribute('data-total-q'))
                         : vfMulti ? parseInt(vfMulti.getAttribute('data-total-vf'))
                         : qoMulti ? parseInt(qoMulti.getAttribute('data-total-qo'))
                         : mfMulti ? parseInt(mfMulti.getAttribute('data-total-mf'))
                         : 0;
        if (multiTotal > 1) {
            const validateBtn = document.querySelector('#etapeActionBar .validate-btn');
            if (validateBtn) validateBtn.classList.add('hidden');
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Question 1 / ${multiTotal}`;
            this.updateMultiProgressBar(1, multiTotal);
        }
        // Flashcard : afficher le compteur "Carte X / Y" dans le header
        if (flashcardContainer && this.flashcardState) {
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Carte 1 / ${this.flashcardState.total}`;
            this.updateMultiProgressBar(1, this.flashcardState.total);
        }

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
        const format = this.normalizeFormat(etape.format_code);

        // Réinitialiser le store des réponses correctes pour la nouvelle étape
        this.clearAnswerStore();

        Logger.debug('EleveConnaissances', 'renderEtapeContent', { etape: etape.id, format, mode: etape.mode_selection });

        let allQuestionContents = [];

        // Vérifier si on a déjà sélectionné les questions pour cette étape
        // (important pour le mode aléatoire et pour la validation)
        if (this.selectedQuestionsPerEtape[etape.id]) {
            Logger.debug('EleveConnaissances', 'Réutilisation des questions déjà sélectionnées');
            allQuestionContents = this.selectedQuestionsPerEtape[etape.id].questions;
        } else {
            // Vérifier le mode de sélection
            if (etape.mode_selection === 'aleatoire') {
                // MODE ALÉATOIRE : Tirer au sort parmi les questions disponibles
                const nbQuestions = parseInt(etape.nb_questions) || 5;
                const banqueSourceId = etape.banque_source_id;

                Logger.debug('EleveConnaissances', 'Mode aléatoire', { nbQuestions, banqueSourceId });

                // Filtrer les questions par format et éventuellement par banque
                let availableQuestions = this.questionsConnaissances.filter(q => q.type === format);

                if (banqueSourceId) {
                    availableQuestions = availableQuestions.filter(q => String(q.banque_id) === String(banqueSourceId));
                }

                Logger.debug('EleveConnaissances', 'Questions disponibles pour tirage', { count: availableQuestions.length });

                // Mélanger et prendre le nombre demandé
                const shuffled = this.shuffleArray([...availableQuestions]);
                const selected = shuffled.slice(0, nbQuestions);

                Logger.debug('EleveConnaissances', 'Questions tirées au sort', { count: selected.length });

                // Convertir en format attendu
                for (const q of selected) {
                    allQuestionContents.push({
                        id: q.id,
                        donnees: parseJSONField(q.donnees)
                    });
                }
            } else {
                // MODE MANUEL : Utiliser les questions liées via ETAPE_QUESTIONS_CONN
                const rawLinkedRefs = this.etapeQuestions.filter(eq =>
                    String(eq.etape_id) === String(etape.id)
                );
                // Dédupliquer par question_id pour éviter les doublons (flashcards dupliquées, etc.)
                const seenQuestionIds = new Set();
                const linkedQuestionRefs = rawLinkedRefs.filter(eq => {
                    const qId = String(eq.question_id);
                    if (seenQuestionIds.has(qId)) return false;
                    seenQuestionIds.add(qId);
                    return true;
                });
                Logger.debug('EleveConnaissances', 'Mode manuel - Questions liées', { dedup: linkedQuestionRefs.length, total: rawLinkedRefs.length });

                for (const questionRef of linkedQuestionRefs) {
                    const questionContent = this.questionsConnaissances.find(q =>
                        String(q.id) === String(questionRef.question_id)
                    );

                    if (!questionContent) {
                        Logger.warn('EleveConnaissances', `Question ID ${questionRef.question_id} non trouvée`);
                        continue;
                    }

                    allQuestionContents.push({
                        id: questionContent.id,
                        donnees: parseJSONField(questionContent.donnees)
                    });
                }
            }
        }

        Logger.debug('EleveConnaissances', 'Toutes les questions trouvées', { count: allQuestionContents.length });

        // Combiner les données selon le format
        let donnees = {};

        if (allQuestionContents.length === 0) {
            // Fallback: essayer depuis l'étape directement
            if (etape.donnees) {
                donnees = parseJSONField(etape.donnees);
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

        switch (format) {
            case 'vrai_faux':
                return this.renderVraiFaux(donnees, questions);
            case 'qcm':
                return this.renderQCM(donnees, questions);
            case 'timeline':
                if (donnees.multiQuestions || (donnees.paires && donnees.mode)) {
                    return this.renderChronologie(donnees, questions);
                }
                return this.renderTimeline(donnees, questions);
            case 'texte_trou':
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

    // ===== NAVIGATION =====

    /**
     * Navigate to next etape — uniquement après validation
     */
    nextEtape() {
        if (!this.currentEtapeValidated) return;
        if (this.currentEtapeIndex < this.currentEtapes.length - 1) {
            // Cleanup event listeners from previous etape
            this.cleanupEventListeners();

            this.currentEtapeIndex++;
            this.resetEtapeState();
            this.renderEntrainementView();
        }
    },

    /**
     * Finish the entrainement - Utilise les résultats déjà calculés par validateCurrentEtape
     */
    async finishEntrainement() {
        // Guard contre le double-clic
        if (this._finishing) return;
        this._finishing = true;

        // Désactiver le bouton visuellement
        const finishBtn = document.querySelector('#etapeActionBar .finish-btn');
        const originalBtnText = finishBtn ? finishBtn.textContent : '';
        if (finishBtn) {
            finishBtn.disabled = true;
            finishBtn.classList.add('is-loading');
            finishBtn.textContent = 'Enregistrement...';
        }

        // Cleanup event listeners
        this.cleanupEventListeners();
        this.stopTimer();

        // Si l'étape courante n'a pas encore été validée (ex: timer expiré), la valider
        if (!this.currentEtapeValidated) {
            this.validateCurrentEtape();
        }

        // Compiler les résultats à partir des étapes déjà validées
        const results = this.compileResults();
        this.lastResults = results;

        try {
            await this.saveProgression(results);
        } catch (e) {
            this._finishing = false;
            // Réactiver le bouton en cas d'erreur
            if (finishBtn) {
                finishBtn.disabled = false;
                finishBtn.classList.remove('is-loading');
                finishBtn.textContent = originalBtnText;
            }
            Logger.error('EleveConnaissances', 'Erreur lors de finishEntrainement', e);
            return;
        }

        this.renderResultScreen(results);
    },

    // ===== TIMER =====

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

};
