/**
 * Exercices Élève - Logique JavaScript
 * Gestion des exercices d'entraînement pour les élèves
 * Design accordéon avec vue unifiée
 */

/**
 * Parse un champ JSON (donnees ou structure) de manière sûre.
 * Gère les chaînes simples, le double-encodage, et les valeurs déjà parsées.
 * @param {*} raw - Valeur brute (string JSON, objet, null, etc.)
 * @param {*} fallback - Valeur par défaut si le parsing échoue (défaut: {})
 * @returns {Object|Array}
 */
function parseJSONField(raw, fallback = {}) {
    if (!raw) return fallback;
    if (typeof raw === 'object') return raw;
    try {
        let parsed = JSON.parse(raw);
        // Gérer le double-encodage (string qui contient une string JSON)
        if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
        }
        return parsed;
    } catch (e) {
        return fallback;
    }
}

/**
 * Registre des formats d'exercice.
 * Pour ajouter un nouveau format, il suffit d'ajouter une entrée ici
 * et d'implémenter les méthodes correspondantes dans le module.
 *
 * Chaque format définit :
 *   render(donnees, structure) → HTML string
 *   validate()                → { correct, total }
 *   showCorrection()          → void (modifie le DOM)
 *   reset()                   → void (réinitialise le DOM)
 */
const FORMAT_HANDLERS = {
    tableau_saisie: {
        render(donnees, structure)  { return this.renderTableauSaisie(donnees, structure); },
        validate()                 { return this.validateTableauSaisie(); },
        showCorrection()           { this.showTableauCorrige(); },
        reset()                    { this.resetTableauSaisie(); }
    },
    carte_cliquable: {
        render(donnees, structure)  { return this.renderCarteCliquable(donnees, structure); },
        validate()                 { return this.validateCarteCliquable(); },
        showCorrection()           { this.showCarteCorrige(); },
        reset()                    { this.resetCarteCliquable(); }
    },
    document_tableau: {
        render(donnees, structure)  { return this.renderDocumentTableau(donnees, structure); },
        validate()                 { return this.validateTableauSaisie(); },
        showCorrection()           { this.showTableauCorrige(); },
        reset()                    { this.resetTableauSaisie(); }
    },
    question_ouverte: {
        render(donnees, structure)  { return this.renderQuestionOuverte(donnees, structure); },
        validate()                 { return this.validateQuestionOuverte(); },
        showCorrection()           { this.showQuestionOuverteCorrige(); },
        reset()                    { this.resetQuestionOuverte(); }
    },
    document_mixte: {
        render(donnees, structure)  { return this.renderDocumentMixte(donnees, structure); },
        validate()                 { return this.validateDocumentMixte(); },
        showCorrection()           { this.showDocumentMixteCorrige(); },
        reset()                    { this.resetDocumentMixte(); }
    }
};

const EleveExercices = {
    // Type courant (savoir-faire, connaissances, competences)
    currentType: 'savoir-faire',

    // Données
    banques: [],
    exercices: [],
    formats: [],
    resultats: [],
    // Historique des pratiques SF (pour calcul automatisation)
    statsSF: {},  // Stats brutes par exercice (source backend, utilisé pour le fallback de calcul par banque)
    statsSFBanque: {},  // Stats agrégées par banque (source de vérité pour le rendu)

    // État
    currentBanque: null,
    currentExercise: null,
    timer: null,
    timeRemaining: 0,
    exerciseStartTime: null,
    currentUser: null,
    expandedBanques: new Set(), // Track which banques are expanded

    // Cache config (5 minutes TTL)
    CACHE_KEY: 'brikks_exercices_cache',
    CACHE_RESULTATS_KEY: 'brikks_resultats_cache',
    CACHE_HISTORIQUE_SF_KEY: 'brikks_historique_sf_cache',
    CACHE_HISTORIQUE_SF_BANQUE_KEY: 'brikks_historique_sf_banque_cache',
    CACHE_TTL: 5 * 60 * 1000,

    // ============================================
    // SYSTÈME 5 RÉPÉTITIONS ESPACÉES - SAVOIR-FAIRE
    // ============================================
    SEUIL_REPETITIONS: 5,              // 5 répétitions pour maîtriser
    SEUIL_JOURS_RAPPEL: 21,            // Rappel suggéré après 21 jours (3 semaines)

    // Espacements entre répétitions (en jours)
    // Clé = répétition validée, valeur = jours avant prochaine
    ESPACEMENTS_REPETITIONS: {
        0: 0,    // Pas encore commencé → disponible immédiatement
        1: 1,    // Après rép 1 → attendre 1 jour
        2: 3,    // Après rép 2 → attendre 3 jours
        3: 7,    // Après rép 3 → attendre 7 jours
        4: 14    // Après rép 4 → attendre 14 jours
    },

    // À partir de quelle répétition le temps conditionne la validation
    REP_TEMPS_OBLIGATOIRE: 2, // Répétitions 2, 3, 4 et 5 (automatisation dès rep 2)

    // Messages ordinaux pour affichage
    ORDINAUX: ['', '1er', '2ème', '3ème', '4ème', '5ème'],

    // Statuts exercice SF
    STATUTS_SF: {
        A_DECOUVRIR: 'a-decouvrir',      // 🔘 0 répétition
        EN_COURS: 'en-cours',            // 🔄 1-4 répétitions, disponible
        A_REVISER: 'a-reviser',          // 🔔 Espacement atteint, peut refaire
        EN_PAUSE: 'en-pause',            // ⏳ Espacement non atteint, entraînement libre
        MAITRISE: 'maitrise',            // ✅ 5 répétitions validées
        RAPPEL_SUGGERE: 'rappel-suggere' // 💤 Maîtrisé + >21 jours
    },

    // Labels et icônes pour les statuts
    LABELS_STATUTS_SF: {
        'a-decouvrir': { label: 'À découvrir', icon: '🔘', cssClass: 'a-decouvrir' },
        'en-cours': { label: 'En cours', icon: '🔄', cssClass: 'en-cours' },
        'a-reviser': { label: 'À réviser', icon: '🔔', cssClass: 'a-reviser' },
        'en-pause': { label: 'En pause', icon: '⏳', cssClass: 'en-pause' },
        'maitrise': { label: 'Maîtrisé', icon: '✅', cssClass: 'maitrise' },
        'rappel-suggere': { label: 'Rappel suggéré', icon: '💤', cssClass: 'rappel-suggere' }
    },

    // Flag pour entraînement libre (pendant blocage)
    isEntrainementLibre: false,

    // Cache pour l'exercice sélectionné par banque
    exerciceParBanque: {},

    /**
     * Initialise la page d'exercices
     */
    async init(type) {
        this.currentType = type;
        this.currentUser = await this.getCurrentUser();

        // Handle competences differently (tâches complexes)
        if (type === 'competences') {
            await this.initCompetences();
            return;
        }

        // Try cache first
        const cached = this.loadFromCache();
        if (cached) {
            this.applyData(cached.banques, cached.exercices, cached.formats);
            const cachedResultats = this.loadResultatsFromCache();
            if (cachedResultats) this.resultats = cachedResultats;
            // Charger historique SF depuis cache si savoir-faire
            if (type === 'savoir-faire') {
                const cachedHistoriqueSF = this.loadHistoriqueSFFromCache();
                if (cachedHistoriqueSF) this.statsSF = cachedHistoriqueSF;
                // Charger aussi les stats par banque
                const cachedHistoriqueSFBanque = this.loadHistoriqueSFBanqueFromCache();
                if (cachedHistoriqueSFBanque) this.statsSFBanque = cachedHistoriqueSFBanque;
            }
            this.renderAccordionView();
            this.refreshDataInBackground();
            this.refreshResultatsInBackground();
            if (type === 'savoir-faire') this.refreshHistoriqueSFInBackground();
        } else {
            this.showLoader('Chargement des exercices...');
            try {
                // Charger toutes les données en parallèle pour optimiser le temps de chargement
                const loadPromises = [
                    this.loadData(),
                    this.loadResultats()
                ];
                if (type === 'savoir-faire') {
                    loadPromises.push(this.loadHistoriqueSF());
                }
                await Promise.all(loadPromises);
                this.renderAccordionView();
            } catch (error) {
                console.error('Erreur lors du chargement:', error);
                this.showError('Erreur lors du chargement des exercices');
            }
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser() {
        try {
            // Utiliser sessionStorage avec la bonne clé (comme les autres modules)
            const userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER);
            if (userData) return JSON.parse(userData);
            return null;
        } catch (e) {
            return null;
        }
    },

    // Cache methods
    loadResultatsFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_RESULTATS_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.resultats || [];
            }
            return null;
        } catch (e) { return null; }
    },

    saveResultatsToCache(resultats) {
        try {
            localStorage.setItem(this.CACHE_RESULTATS_KEY, JSON.stringify({
                resultats,
                timestamp: Date.now()
            }));
        } catch (e) { /* storage full or unavailable, ignore */ }
    },

    async loadResultats() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) { /* background load, silence errors */ }
    },

    async refreshResultatsInBackground() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) { /* background refresh, silence errors */ }
    },

    // ========================================
    // HISTORIQUE PRATIQUES SF
    // ========================================

    loadHistoriqueSFFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_HISTORIQUE_SF_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.stats || {};
            }
            return null;
        } catch (e) { return null; }
    },

    saveHistoriqueSFToCache(stats) {
        try {
            localStorage.setItem(this.CACHE_HISTORIQUE_SF_KEY, JSON.stringify({
                stats,
                timestamp: Date.now()
            }));
        } catch (e) { /* storage full or unavailable, ignore */ }
    },

    async loadHistoriqueSF() {
        if (!this.currentUser || !this.currentUser.id) return;
        if (this.currentType !== 'savoir-faire') return;

        try {
            const result = await this.callAPI('getHistoriquePratiquesSF', { eleve_id: this.currentUser.id });
            if (result.success && result.stats) {
                this.statsSF = result.stats;
                this.saveHistoriqueSFToCache(this.statsSF);

                // Charger les stats par banque depuis le backend (si disponible)
                if (result.statsBanque) {
                    this.statsSFBanque = result.statsBanque;
                } else {
                    // Fallback: calculer depuis les stats par exercice
                    this.statsSFBanque = this.computeStatsBanqueFromStatsExercice(this.statsSF);
                }
                this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);
            }
        } catch (e) {
            console.error('[EleveExercices] Erreur chargement historique SF:', e);
        }
    },

    async refreshHistoriqueSFInBackground() {
        if (!this.currentUser || !this.currentUser.id) return;
        if (this.currentType !== 'savoir-faire') return;

        try {
            const result = await this.callAPI('getHistoriquePratiquesSF', { eleve_id: this.currentUser.id });
            if (result.success && result.stats) {
                this.statsSF = result.stats;
                this.saveHistoriqueSFToCache(this.statsSF);

                // Mettre à jour les stats par banque EN FUSIONNANT avec les stats locales
                // Cela évite d'écraser les mises à jour locales non encore persistées au backend
                let newStatsBanque;
                if (result.statsBanque) {
                    newStatsBanque = result.statsBanque;
                } else {
                    newStatsBanque = this.computeStatsBanqueFromStatsExercice(this.statsSF);
                }
                this.statsSFBanque = this.mergeStatsBanque(this.statsSFBanque, newStatsBanque);
                this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);
            }
        } catch (e) { /* background refresh, silence errors */ }
    },

    // mergeStatsBanque, computeStatsBanqueFromStatsExercice, getBanqueStatusSF,
    // getExerciceAleatoirePourBanque, showBlocagePopup, validerRepetitionSF
    // → voir eleve-exercices-sf.js

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

    saveToCache(banques, exercices, formats) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                banques, exercices, formats,
                timestamp: Date.now()
            }));
        } catch (e) { /* storage full or unavailable, ignore */ }
    },

    applyData(banques, exercices, formats) {
        this.banques = (banques || []).filter(b =>
            b.type === this.currentType && b.statut === 'publie'
        );
        this.exercices = (exercices || []).filter(e => e.statut === 'publie');
        this.formats = formats || [];
        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    },

    async refreshDataInBackground() {
        try {
            const [banquesResult, exercicesResult, formatsResult] = await Promise.all([
                this.callAPI('getBanquesExercices'),
                this.callAPI('getExercices'),
                this.callAPI('getFormatsExercices')
            ]);
            const banques = banquesResult.success ? banquesResult.data : [];
            const exercices = exercicesResult.success ? exercicesResult.data : [];
            const formats = formatsResult.success ? formatsResult.data : [];
            this.saveToCache(banques, exercices, formats);
            this.applyData(banques, exercices, formats);
        } catch (error) { /* background refresh, silence errors */ }
    },

    async loadData() {
        const [banquesResult, exercicesResult, formatsResult] = await Promise.all([
            this.callAPI('getBanquesExercices'),
            this.callAPI('getExercices'),
            this.callAPI('getFormatsExercices')
        ]);
        const banques = banquesResult.success ? banquesResult.data : [];
        const exercices = exercicesResult.success ? exercicesResult.data : [];
        const formats = formatsResult.success ? formatsResult.data : [];
        this.saveToCache(banques, exercices, formats);
        this.applyData(banques, exercices, formats);
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
     * Render the accordion view with type header and expandable banques
     * Pour SF : unifié avec le style Connaissances
     */
    renderAccordionView() {
        const container = document.getElementById('exercices-content');

        if (this.banques.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Group exercises by banque
        const exercicesByBanque = {};
        this.exercices.forEach(exo => {
            if (!exercicesByBanque[exo.banque_id]) {
                exercicesByBanque[exo.banque_id] = [];
            }
            exercicesByBanque[exo.banque_id].push(exo);
        });

        // Sort exercises within each banque
        Object.keys(exercicesByBanque).forEach(banqueId => {
            exercicesByBanque[banqueId].sort((a, b) => (a.numero || 0) - (b.numero || 0));
        });

        // Pour SF, utiliser le nouveau système de stats
        if (this.currentType === 'savoir-faire') {
            this.renderAccordionViewSF(container, exercicesByBanque);
            return;
        }

        // Pour les autres types, garder l'ancien rendu
        this.renderAccordionViewDefault(container, exercicesByBanque);
    },

    /**
     * Rendu accordéon pour Savoir-faire (système 1 exercice par banque)
     */
    renderAccordionViewSF(container, exercicesByBanque) {
        // Calculer le statut de chaque banque
        let nbBanquesMaitrisees = 0;
        let nbBanquesAValider = 0;
        const banquesStatus = {};

        this.banques.forEach(banque => {
            const banqueExercices = exercicesByBanque[banque.id] || [];
            const status = this.getBanqueStatusSF(banque.id, banqueExercices);
            banquesStatus[banque.id] = status;

            if (status.status === this.STATUTS_SF.MAITRISE) nbBanquesMaitrisees++;
            // "À valider" = le prochain essai compte pour la progression
            if (status.status === this.STATUTS_SF.A_DECOUVRIR ||
                status.status === this.STATUTS_SF.EN_COURS ||
                status.status === this.STATUTS_SF.A_REVISER) {
                nbBanquesAValider++;
            }
        });

        // Message bandeau actionnable
        let bandeauMessage, bandeauClass;
        if (nbBanquesMaitrisees === this.banques.length && this.banques.length > 0) {
            bandeauMessage = '🏆 Tout est maîtrisé !';
            bandeauClass = 'all-done';
        } else if (nbBanquesAValider > 0) {
            bandeauMessage = `${nbBanquesAValider} niveau${nbBanquesAValider > 1 ? 'x' : ''} à valider`;
            bandeauClass = 'has-urgent';
        } else {
            bandeauMessage = '✓ Tu es à jour — continue à t\u2019entraîner !';
            bandeauClass = 'waiting';
        }

        // Trier les banques par pertinence d'action
        const prioriteSF = {
            [this.STATUTS_SF.A_REVISER]: 0,
            [this.STATUTS_SF.EN_COURS]: 1,
            [this.STATUTS_SF.A_DECOUVRIR]: 2,
            [this.STATUTS_SF.EN_PAUSE]: 3,
            [this.STATUTS_SF.RAPPEL_SUGGERE]: 4,
            [this.STATUTS_SF.MAITRISE]: 5
        };
        const banquesSorted = [...this.banques].sort((a, b) => {
            const pa = prioriteSF[banquesStatus[a.id]?.status] ?? 9;
            const pb = prioriteSF[banquesStatus[b.id]?.status] ?? 9;
            return pa - pb;
        });

        let html = `
            <!-- Bandeau SF -->
            <div class="type-header-banner ${this.currentType} ${bandeauClass}">
                <div class="type-header-left">
                    <div class="type-icon-emoji">${this.getTypeEmoji()}</div>
                    <div>
                        <h2 class="type-title">Entraînement de ${this.getTypeLabel().toLowerCase()}</h2>
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

        banquesSorted.forEach(banque => {
            const banqueExercices = exercicesByBanque[banque.id] || [];
            const banqueStats = this.calculateBanqueStatsSF(banqueExercices, banque.id);
            const banqueStatus = banquesStatus[banque.id];

            // Accordéons fermés par défaut
            const isExpanded = this.expandedBanques.has(banque.id);

            // Couleur selon progression
            let progressColor = '#e5e7eb';
            if (banqueStats.progressPercent >= 100) progressColor = '#10b981';
            else if (banqueStats.progressPercent >= 70) progressColor = '#10b981';
            else if (banqueStats.progressPercent >= 40) progressColor = '#f59e0b';
            else if (banqueStats.progressPercent > 0) progressColor = '#3b82f6';

            // La banque est "à valider" si le prochain essai compte
            const reps = banqueStatus.repetitions || 0;
            const estAValider = banqueStatus.status === this.STATUTS_SF.A_DECOUVRIR ||
                banqueStatus.status === this.STATUTS_SF.EN_COURS ||
                banqueStatus.status === this.STATUTS_SF.A_REVISER;

            // Message contextuel adapté SF
            let banqueMeta = '';
            switch (banqueStatus.status) {
                case this.STATUTS_SF.A_DECOUVRIR:
                    banqueMeta = `Niveau 0/${this.SEUIL_REPETITIONS} · Prêt à valider`;
                    break;
                case this.STATUTS_SF.EN_COURS:
                case this.STATUTS_SF.A_REVISER:
                    banqueMeta = `Niveau ${reps}/${this.SEUIL_REPETITIONS} · Prêt à valider`;
                    break;
                case this.STATUTS_SF.EN_PAUSE: {
                    const dateStr = banqueStatus.prochaineDispo
                        ? new Date(banqueStatus.prochaineDispo).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
                        : `dans ${banqueStatus.joursRestants}j`;
                    banqueMeta = `Niveau ${reps}/${this.SEUIL_REPETITIONS} · Prochain niveau le ${dateStr}`;
                    break;
                }
                case this.STATUTS_SF.MAITRISE:
                    banqueMeta = 'Maîtrisé !';
                    break;
                case this.STATUTS_SF.RAPPEL_SUGGERE:
                    banqueMeta = `Maîtrisé · ${banqueStatus.joursDepuis || ''}j sans pratiquer`;
                    break;
                default:
                    banqueMeta = `Niveau ${reps}/${this.SEUIL_REPETITIONS}`;
            }

            html += `
                <div class="banque-accordion-item ${this.currentType}${isExpanded ? ' expanded' : ''}${estAValider ? ' has-actions' : ''}${banqueStatus.status === this.STATUTS_SF.MAITRISE ? ' maitrisee' : ''}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveExercices.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">
                                <span class="banque-status-message">${banqueMeta}</span>
                            </div>
                            <div class="banque-progress-bar">
                                <div class="banque-progress-fill" style="width: ${banqueStats.progressPercent}%; background: ${progressColor};"></div>
                            </div>
                        </div>
                        <div class="banque-progress-percent">${banqueStats.progressPercent}%</div>
                    </button>
                    <div class="banque-accordion-content">
                        ${banqueStatus.status === this.STATUTS_SF.MAITRISE ? `
                            <div class="banque-maitrise">✅ Cette banque est maîtrisée !</div>
                        ` : ''}
                        <div class="exercices-accordion-list">
                            ${this.renderExercisesListSF(banque.id, banqueExercices, banqueStatus)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Rendu de l'exercice SF dans une banque — CTA contextuel selon le statut
     */
    renderExercisesListSF(banqueId, exercices, banqueStatus) {
        if (!exercices || exercices.length === 0) {
            return '<div class="empty-state" style="padding: 1rem;"><p>Aucun exercice dans cette banque</p></div>';
        }

        // Banque maîtrisée : résumé + option de continuer
        if (banqueStatus.status === this.STATUTS_SF.MAITRISE) {
            const exo = banqueStatus.exercice || exercices[0];
            return `
                <div class="banque-resume">
                    <p>Tu as réussi ${this.SEUIL_REPETITIONS} exercices différents !</p>
                </div>
                <div class="exercice-item ${this.currentType} maitrise selected-exercise"
                     onclick="EleveExercices.startExerciseLibre('${exo.id}')"
                     data-exercice-id="${exo.id}">
                    <div class="exercice-info">
                        <div class="exercice-titre">S'entraîner quand même</div>
                    </div>
                    <div class="exercice-status-area">
                        <span class="exercice-hint">Entraînement libre</span>
                    </div>
                </div>
            `;
        }

        // Rappel suggéré : maîtrisé mais inactif depuis longtemps
        if (banqueStatus.status === this.STATUTS_SF.RAPPEL_SUGGERE) {
            const exo = banqueStatus.exercice || exercices[0];
            return `
                <div class="exercice-item ${this.currentType} selected-exercise"
                     onclick="EleveExercices.startExercise('${exo.id}')"
                     data-exercice-id="${exo.id}">
                    <div class="exercice-info">
                        <div class="exercice-titre">${escapeHtml(exo.titre || 'Exercice')}</div>
                        <div class="exercice-meta">${banqueStatus.joursDepuis || ''}j sans pratiquer</div>
                    </div>
                    <div class="exercice-status-area">
                        <span class="exercice-hint">S'entraîner →</span>
                    </div>
                </div>
            `;
        }

        // Exercice à afficher
        const exo = banqueStatus.exercice;
        if (!exo) {
            return '<div class="empty-state" style="padding: 1rem;"><p>Aucun exercice disponible</p></div>';
        }

        const reps = banqueStatus.repetitions || 0;
        const dureeMinutes = exo.duree > 60 ? Math.floor(exo.duree / 60) : exo.duree;

        // CTA et hint adaptés au statut
        let ctaText, hintText = '';
        switch (banqueStatus.status) {
            case this.STATUTS_SF.A_DECOUVRIR:
                ctaText = 'Valider le niveau 1 →';
                break;
            case this.STATUTS_SF.EN_COURS:
            case this.STATUTS_SF.A_REVISER:
                ctaText = `Valider le niveau ${reps + 1} →`;
                break;
            case this.STATUTS_SF.EN_PAUSE: {
                ctaText = 'S\u2019entraîner →';
                const dateStr = banqueStatus.prochaineDispo
                    ? new Date(banqueStatus.prochaineDispo).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
                    : `dans ${banqueStatus.joursRestants}j`;
                hintText = `Ton niveau ${reps + 1} comptera le ${dateStr}`;
                break;
            }
            default:
                ctaText = 'Commencer →';
        }

        return `
            <div class="exercice-item ${this.currentType} selected-exercise"
                 onclick="EleveExercices.startExercise('${exo.id}')"
                 data-exercice-id="${exo.id}">
                <div class="exercice-numero">${reps + 1}</div>
                <div class="exercice-info">
                    <div class="exercice-titre">${escapeHtml(exo.titre || 'Exercice')}</div>
                    <div class="exercice-meta">${dureeMinutes ? dureeMinutes + ' min' : ''}</div>
                </div>
                <div class="exercice-status-area">
                    <span class="exercice-hint">${ctaText}</span>
                    ${hintText ? `<span class="exercice-hint-sub">${hintText}</span>` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Rendu accordéon par défaut (ancienne version pour autres types)
     */
    renderAccordionViewDefault(container, exercicesByBanque) {
        // Calculate global stats
        const totalExercises = this.exercices.filter(e =>
            this.banques.some(b => b.id === e.banque_id)
        ).length;
        const completedExercises = this.exercices.filter(e =>
            this.banques.some(b => b.id === e.banque_id) &&
            this.resultats.some(r => r.exercice_id === e.id)
        ).length;
        const progressPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

        let html = `
            <div class="type-header-banner ${this.currentType}">
                <div class="type-header-left">
                    <div class="type-icon-emoji">${this.getTypeEmoji()}</div>
                    <div>
                        <h2 class="type-title">Entraînement de ${this.getTypeLabel().toLowerCase()}</h2>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat">
                        <div class="type-stat-value">${this.banques.length}</div>
                        <div class="type-stat-label">Banques</div>
                    </div>
                    <div class="type-stat">
                        <div class="type-stat-value">${totalExercises}</div>
                        <div class="type-stat-label">Exercices</div>
                    </div>
                </div>
            </div>

            <div class="training-toolbar">
                <div class="search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="banqueSearch" placeholder="Rechercher une banque..." oninput="EleveExercices.filterBanques(this.value)">
                </div>
                <div class="global-progress">
                    <div class="global-progress-label">
                        <span>Progression globale</span>
                        <span class="global-progress-value">${completedExercises}/${totalExercises} exercices</span>
                    </div>
                    <div class="global-progress-bar ${this.currentType}">
                        <div class="global-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>

            <div class="banques-accordion">
        `;

        this.banques.forEach(banque => {
            const banqueExercices = exercicesByBanque[banque.id] || [];
            const completed = banqueExercices.filter(exo =>
                this.resultats.some(r => r.exercice_id === exo.id)
            ).length;
            const total = banqueExercices.length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isExpanded = this.expandedBanques.has(banque.id);

            // Progress ring calculation (circumference = 2 * PI * radius)
            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percent / 100) * circumference;

            html += `
                <div class="banque-accordion-item ${this.currentType}${isExpanded ? ' expanded' : ''}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveExercices.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">${total} exercice${total !== 1 ? 's' : ''}</div>
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
                            ${this.renderExercisesList(banqueExercices)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Calcule les stats d'une banque SF basées sur les répétitions de la BANQUE
     * Progression = répétitions validées / 5 * 100
     */
    calculateBanqueStatsSF(exercices, banqueId) {
        const total = exercices.length;

        const statsBanque = this.statsSFBanque[String(banqueId)];
        const repsValidees = statsBanque?.repetitions_validees || 0;
        const exercicesReussis = statsBanque?.exercices_reussis || [];

        // Progression = répétitions validées sur 5
        const progressPercent = Math.round((repsValidees / this.SEUIL_REPETITIONS) * 100);

        // Déterminer le statut global
        const estMaitrise = repsValidees >= this.SEUIL_REPETITIONS;

        return {
            total,
            repetitionsValidees: repsValidees,
            exercicesReussis: exercicesReussis.length,
            maitrise: estMaitrise ? 1 : 0,
            automatise: estMaitrise ? 1 : 0, // Pour compatibilité
            progressPercent,
            // Legacy compatibility
            rappelSuggere: 0,
            aReviser: 0,
            enCours: repsValidees > 0 && !estMaitrise ? 1 : 0,
            enPause: 0,
            aDecouvrir: repsValidees === 0 ? 1 : 0,
            aFaire: estMaitrise ? 0 : 1
        };
    },

    /**
     * Render exercises list for a banque
     */
    renderExercisesList(exercices) {
        if (exercices.length === 0) {
            return '<div class="empty-state" style="padding: 2rem;"><p>Aucun exercice dans cette banque</p></div>';
        }

        return exercices.map((exo) => {
            const format = this.formats.find(f => f.id === exo.format_id);
            const result = this.getExerciseResult(exo.id);
            const statusInfo = this.getStatusInfo(result);
            const isCompleted = result && result.score === 100;

            return `
                <div class="exercice-item ${this.currentType}${isCompleted ? ' completed' : ''}"
                     onclick="EleveExercices.startExercise('${exo.id}')">
                    <div class="exercice-numero">${exo.numero || '?'}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                        <div class="exercice-meta">
                            ${format ? format.nom : 'Format inconnu'}
                            ${exo.duree ? ` • ${Math.floor(exo.duree / 60)} min` : ''}
                            ${result && result.score < 100 ? ` • Meilleur: ${result.score}%` : ''}
                        </div>
                    </div>
                    <span class="exercice-status ${statusInfo.class}">${statusInfo.label}</span>
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
     * Render empty state with SVG icon
     */
    renderEmptyState() {
        return `
            <div class="type-header-banner ${this.currentType}">
                <div class="type-header-left">
                    <div class="type-icon-emoji">${this.getTypeEmoji()}</div>
                    <div>
                        <h2 class="type-title">Entraînement de ${this.getTypeLabel().toLowerCase()}</h2>
                    </div>
                </div>
            </div>
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h3>Aucun exercice disponible</h3>
                <p>Les exercices de ${this.getTypeLabel().toLowerCase()} seront bientôt disponibles.</p>
            </div>
        `;
    },

    getExerciseResult(exerciceId) {
        return this.resultats.find(r => r.exercice_id === exerciceId);
    },

    getStatusInfo(result) {
        if (!result) {
            return { class: 'new', label: 'Nouveau' };
        }
        if (result.score === 100) {
            return { class: 'completed', label: 'Parfait' };
        }
        return { class: 'in-progress', label: `${result.score}%` };
    },

    /**
     * Start exercise - avec vérification du blocage pour SF
     */
    /**
     * Phase 1: Démarrer en mode entraînement libre (après maîtrise)
     */
    startExerciseLibre(exerciceId) {
        this.startExercise(exerciceId, true);
    },

    async startExercise(exerciceId, forceEntrainementLibre = false) {
        // Déterminer si c'est un entraînement libre (ne compte pas pour la progression)
        if (this.currentType === 'savoir-faire') {
            const exo = this.exercices.find(e => String(e.id) === String(exerciceId));
            if (exo) {
                const banqueId = exo.banque_id;
                const banqueExercices = this.exercices.filter(e => e.banque_id === banqueId);
                const banqueStatus = this.getBanqueStatusSF(banqueId, banqueExercices);

                // Entrainement libre si: forcé, OU espacement non atteint, OU banque maîtrisée
                this.isEntrainementLibre = forceEntrainementLibre ||
                    banqueStatus.status === this.STATUTS_SF.EN_PAUSE ||
                    banqueStatus.status === this.STATUTS_SF.MAITRISE;
            } else {
                this.isEntrainementLibre = forceEntrainementLibre;
            }
        } else {
            this.isEntrainementLibre = forceEntrainementLibre;
        }

        this.showLoader('Chargement de l\'exercice...');

        try {
            const result = await this.callAPI('getExercice', { id: exerciceId });
            if (result.success && result.data) {
                this.currentExercise = result.data;
                this.currentBanque = this.banques.find(b => b.id === this.currentExercise.banque_id);
                this.exerciseStartTime = Date.now();
                this.renderExercise();
            } else {
                this.showError('Exercice non trouvé');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors du chargement de l\'exercice');
        }
    },

    /**
     * Render exercise view
     */
    renderExercise() {
        // Réinitialiser le flag de validation
        this.isValidating = false;

        const exo = this.currentExercise;
        const banque = this.currentBanque;
        const format = this.formats.find(f => f.id === exo.format_id);

        const donnees = parseJSONField(exo.donnees);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'unknown';
        let contentHTML = '';

        const handler = this.getFormatHandler(typeUI);
        if (handler && handler.render) {
            contentHTML = handler.render.call(this, donnees, structure);
        } else {
            contentHTML = `
                <div style="text-align: center; color: #6b7280; padding: 2rem;">
                    <p>Type d'exercice non supporté: ${typeUI}</p>
                </div>
            `;
        }

        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="exercise-view">
                <button class="exercise-back-btn" onclick="EleveExercices.backToList()">
                    ← Retour aux exercices
                </button>

                <div class="exercise-card">
                    <div class="exercise-header ${this.currentType}">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${banque ? escapeHtml(banque.titre) : ''} - ${escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</h1>
                                <div class="exercise-header-meta">${format ? format.nom : ''}</div>
                            </div>
                        </div>
                        ${exo.duree ? `
                            <div class="exercise-timer" id="exerciseTimer">
                                <span id="timerDisplay">${this.formatTime(exo.duree)}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${exo.consigne ? `
                        <div class="exercise-consigne">
                            ${escapeHtml(exo.consigne)}
                        </div>
                    ` : ''}

                    <div class="exercise-content">
                        ${contentHTML}
                    </div>

                    <div class="result-banner" id="resultBanner"></div>

                    <div class="exercise-actions">
                        <button class="btn btn-verifier" id="btnVerifier" onclick="EleveExercices.validateExercise()">
                            ${this.currentType === 'savoir-faire' ? 'Terminer' : 'Vérifier mes réponses'}
                        </button>
                        ${this.currentType !== 'savoir-faire' ? `
                            <button class="btn btn-corrige" id="btnCorrige" onclick="EleveExercices.showCorrige()" style="display: none;">
                                Voir le corrigé
                            </button>
                            <button class="btn btn-restart" id="btnRestart" onclick="EleveExercices.resetExercise()" style="display: none;">
                                Recommencer
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        if (exo.duree) {
            this.startTimer(exo.duree);
        }
    },

    /**
     * Back to accordion list
     */
    backToList() {
        this.stopTimer();
        this.currentExercise = null;
        this.renderAccordionView();
    },

    // ===============================
    // TIMER
    // ===============================

    startTimer(seconds) {
        this.stopTimer();
        this.timeRemaining = seconds;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.validateExercise();
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
        const timerEl = document.getElementById('exerciseTimer');
        if (display) display.textContent = this.formatTime(this.timeRemaining);
        if (timerEl && this.timeRemaining <= 60) timerEl.classList.add('warning');
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ===============================
    // HELPERS
    // ===============================

    getTypeLabel() {
        const labels = {
            'savoir-faire': 'Savoir-faire',
            'connaissances': 'Connaissances',
            'competences': 'Compétences'
        };
        return labels[this.currentType] || this.currentType;
    },

    getTypeEmoji() {
        const emojis = {
            'savoir-faire': '🔧',
            'connaissances': '📚',
            'competences': '🎯'
        };
        return emojis[this.currentType] || '📝';
    },

    filterBanques(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const items = document.querySelectorAll('.banque-accordion-item');

        items.forEach(item => {
            const title = item.querySelector('.banque-title');
            if (title) {
                const text = title.textContent.toLowerCase();
                if (term === '' || text.includes(term)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    },

    getTypeIconSVG() {
        // Simple SVG icons for each type
        const icons = {
            'savoir-faire': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#d97706" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>',
            'connaissances': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#059669" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>',
            'competences': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#7c3aed" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>'
        };
        return icons[this.currentType] || icons['connaissances'];
    },

    showLoader(message) {
        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="page-loader">
                <div class="spinner"></div>
                <p>${message || 'Chargement...'}</p>
            </div>
        `;
    },

    showError(message) {
        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    /**
     * Retourne le handler de format pour un type_ui donné.
     * @param {string} typeUI - Le type d'interface (tableau_saisie, carte_cliquable, etc.)
     * @returns {Object|null} Le handler avec render/validate/showCorrection/reset, ou null
     */
    getFormatHandler(typeUI) {
        return FORMAT_HANDLERS[typeUI] || null;
    },


    convertToDirectImageUrl(url) {
        if (!url) return url;
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }
        return url;
    }
};

// Export global
window.EleveExercices = EleveExercices;
