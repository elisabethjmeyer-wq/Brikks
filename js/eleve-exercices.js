/**
 * Exercices Élève - Logique JavaScript
 * Gestion des exercices d'entraînement pour les élèves
 * Design accordéon avec vue unifiée
 */

const EleveExercices = {
    // Type courant (savoir-faire, connaissances, competences)
    currentType: 'savoir-faire',

    // Données
    banques: [],
    exercices: [],
    formats: [],
    resultats: [],
    // Historique des pratiques SF (pour calcul automatisation)
    statsSF: {},  // Stats par exercice_id (legacy, pour compatibilité)
    statsSFBanque: {},  // Stats par banque_id (nouveau système Option B)

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
        EN_PAUSE: 'en-pause',            // ⏳ Espacement non atteint, bloqué
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

    // Ancien système (conservé pour compatibilité, mais non utilisé)
    SEUIL_PRATIQUES_PARFAITES: 3,
    SEUIL_JOURS_RAFRAICHIR: 30,

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
                // OPTION B: Charger aussi les stats par banque
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
        } catch (e) {}
    },

    async loadResultats() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) {}
    },

    async refreshResultatsInBackground() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) {}
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
        } catch (e) {}
    },

    async loadHistoriqueSF() {
        if (!this.currentUser || !this.currentUser.id) return;
        if (this.currentType !== 'savoir-faire') return;

        try {
            console.log('[SF] Chargement historique pour eleve_id:', this.currentUser.id);
            const result = await this.callAPI('getHistoriquePratiquesSF', { eleve_id: this.currentUser.id });
            console.log('[SF] Réponse getHistoriquePratiquesSF:', result);
            if (result.debug) {
                console.log('[SF] DEBUG - Sheet exists:', result.debug.sheetExists,
                            '| Total rows:', result.debug.totalRows,
                            '| Filtered:', result.debug.filteredRows);
            }
            if (result.success && result.stats) {
                this.statsSF = result.stats;
                this.saveHistoriqueSFToCache(this.statsSF);
                console.log('[SF] Stats chargées:', Object.keys(this.statsSF).length, 'exercices');

                // OPTION B: Charger les stats par banque depuis le backend (si disponible)
                if (result.statsBanque) {
                    this.statsSFBanque = result.statsBanque;
                } else {
                    // Fallback: calculer depuis les stats par exercice
                    this.statsSFBanque = this.computeStatsBanqueFromStatsExercice(this.statsSF);
                }
                this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);
                console.log('[SF-OptionB] Stats banques chargées:', Object.keys(this.statsSFBanque).length, 'banques');
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

                // OPTION B: Mettre à jour les stats par banque EN FUSIONNANT avec les stats locales
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
        } catch (e) {}
    },

    /**
     * Fusionne les stats banques locales avec celles du backend
     * Garde toujours les valeurs les plus élevées/récentes pour éviter de perdre la progression
     * @param {Object} localStats - Stats locales (peuvent contenir des mises à jour récentes)
     * @param {Object} remoteStats - Stats du backend (peuvent être en retard)
     * @returns {Object} Stats fusionnées
     */
    mergeStatsBanque(localStats, remoteStats) {
        const merged = { ...remoteStats };

        // Pour chaque banque locale, vérifier si elle a des valeurs plus récentes
        for (const [banqueId, localStat] of Object.entries(localStats || {})) {
            if (!merged[banqueId]) {
                // Banque uniquement locale, la garder
                merged[banqueId] = localStat;
            } else {
                // Comparer et garder les valeurs les plus élevées/récentes
                const remoteStat = merged[banqueId];

                // Garder la répétition la plus élevée
                if ((localStat.repetitions_validees || 0) > (remoteStat.repetitions_validees || 0)) {
                    merged[banqueId].repetitions_validees = localStat.repetitions_validees;
                    merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                    merged[banqueId].exercices_reussis = localStat.exercices_reussis || [];
                } else if ((localStat.repetitions_validees || 0) === (remoteStat.repetitions_validees || 0)) {
                    // Même niveau, garder la date la plus récente
                    if (localStat.date_derniere_validation && remoteStat.date_derniere_validation) {
                        if (new Date(localStat.date_derniere_validation) > new Date(remoteStat.date_derniere_validation)) {
                            merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                        }
                    } else if (localStat.date_derniere_validation) {
                        merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                    }
                    // Fusionner les exercices réussis
                    const allExos = new Set([
                        ...(localStat.exercices_reussis || []),
                        ...(remoteStat.exercices_reussis || [])
                    ]);
                    merged[banqueId].exercices_reussis = [...allExos];
                }

                // Garder le total de pratiques le plus élevé
                merged[banqueId].total_pratiques = Math.max(
                    localStat.total_pratiques || 0,
                    remoteStat.total_pratiques || 0
                );
            }
        }

        return merged;
    },

    /**
     * OPTION B: Calcule les stats par banque à partir des stats par exercice
     * Utilisé comme fallback si le backend ne retourne pas encore statsBanque
     */
    computeStatsBanqueFromStatsExercice(statsExercice) {
        const statsBanque = {};

        for (const [exoId, stats] of Object.entries(statsExercice || {})) {
            const banqueId = String(stats.banque_id);
            if (!banqueId) continue;

            if (!statsBanque[banqueId]) {
                statsBanque[banqueId] = {
                    banque_id: banqueId,
                    repetitions_validees: 0,
                    exercices_reussis: [],
                    date_derniere_validation: null,
                    total_pratiques: 0
                };
            }

            const sb = statsBanque[banqueId];
            sb.total_pratiques += (stats.total_pratiques || 0);

            // Si l'exercice a été validé au moins une fois, l'ajouter aux réussis
            if (stats.repetitions_validees > 0) {
                if (!sb.exercices_reussis.includes(exoId)) {
                    sb.exercices_reussis.push(exoId);
                }

                // Le niveau de la banque = niveau max atteint parmi tous les exercices (pas le nb d'exercices)
                if (stats.repetitions_validees > sb.repetitions_validees) {
                    sb.repetitions_validees = stats.repetitions_validees;
                    // Date de dernière validation = celle de la pratique qui a atteint ce niveau
                    sb.date_derniere_validation = stats.date_derniere_validation;
                } else if (stats.repetitions_validees === sb.repetitions_validees) {
                    // Même niveau, garder la date la plus récente
                    if (stats.date_derniere_validation) {
                        if (!sb.date_derniere_validation || stats.date_derniere_validation > sb.date_derniere_validation) {
                            sb.date_derniere_validation = stats.date_derniere_validation;
                        }
                    }
                }
            }
        }

        return statsBanque;
    },

    /**
     * Calcule le statut d'un exercice SF selon le système 4 répétitions
     * @param {string} exerciceId - ID de l'exercice
     * @param {Object} exercice - Données de l'exercice (pour temps_prevu)
     * @returns {Object} Status complet avec infos de progression
     */
    getExerciceStatusSF(exerciceId, exercice) {
        const now = new Date();
        const stats = this.statsSF[String(exerciceId)];

        // Pas de stats = jamais fait
        if (!stats || stats.repetitions_validees === undefined) {
            // Fallback pour ancien système (pas de repetitions_validees)
            if (stats && stats.total_pratiques > 0) {
                // Ancien système : convertir pratiques_parfaites en approximation
                return this._getStatusFromOldSystem(stats, exercice);
            }
            return {
                statut: this.STATUTS_SF.A_DECOUVRIR,
                repetitions: 0,
                ...this.LABELS_STATUTS_SF['a-decouvrir'],
                statusClass: 'a-decouvrir',
                message: 'Premier essai',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false
            };
        }

        const reps = stats.repetitions_validees || 0;
        const dernierePratique = stats.date_derniere_validation
            ? new Date(stats.date_derniere_validation)
            : null;

        // Maîtrisé (5 répétitions)
        if (reps >= this.SEUIL_REPETITIONS) {
            // Vérifier si rappel suggéré (>21 jours)
            if (dernierePratique) {
                const joursDepuis = Math.floor((now - dernierePratique) / (1000 * 60 * 60 * 24));
                if (joursDepuis >= this.SEUIL_JOURS_RAPPEL) {
                    return {
                        statut: this.STATUTS_SF.RAPPEL_SUGGERE,
                        repetitions: reps,
                        ...this.LABELS_STATUTS_SF['rappel-suggere'],
                        statusClass: 'rappel-suggere',
                        message: `${joursDepuis}j depuis dernière pratique`,
                        joursRestants: 0,
                        prochaineDispo: null,
                        peutFaire: true,
                        estEntrainementLibre: false,
                        joursDepuis
                    };
                }
            }

            return {
                statut: this.STATUTS_SF.MAITRISE,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['maitrise'],
                statusClass: 'maitrise',
                message: 'Exercice maîtrisé !',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false
            };
        }

        // En cours (1-3 répétitions) - vérifier espacement
        if (reps > 0 && dernierePratique) {
            const espacementRequis = this.ESPACEMENTS_REPETITIONS[reps] || 7;
            const prochaineDispo = new Date(dernierePratique);
            prochaineDispo.setDate(prochaineDispo.getDate() + espacementRequis);

            const joursRestants = Math.max(0, Math.ceil((prochaineDispo - now) / (1000 * 60 * 60 * 24)));

            if (now < prochaineDispo) {
                // Bloqué - en pause
                return {
                    statut: this.STATUTS_SF.EN_PAUSE,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['en-pause'],
                    statusClass: 'en-pause',
                    message: `Dispo dans ${joursRestants}j`,
                    joursRestants: joursRestants,
                    prochaineDispo: prochaineDispo.toISOString(),
                    peutFaire: false,
                    estEntrainementLibre: true // Peut s'entraîner librement
                };
            } else {
                // Disponible - à réviser
                return {
                    statut: this.STATUTS_SF.A_REVISER,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['a-reviser'],
                    statusClass: 'a-reviser',
                    message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS} disponible`,
                    joursRestants: 0,
                    prochaineDispo: null,
                    peutFaire: true,
                    estEntrainementLibre: false
                };
            }
        }

        // En cours sans date (cas rare) ou 0 répétition avec des pratiques
        if (reps > 0) {
            return {
                statut: this.STATUTS_SF.EN_COURS,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['en-cours'],
                statusClass: 'en-cours',
                message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS}`,
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false
            };
        }

        // Par défaut : à découvrir
        return {
            statut: this.STATUTS_SF.A_DECOUVRIR,
            repetitions: 0,
            ...this.LABELS_STATUTS_SF['a-decouvrir'],
            statusClass: 'a-decouvrir',
            message: 'Premier essai',
            joursRestants: 0,
            prochaineDispo: null,
            peutFaire: true,
            estEntrainementLibre: false
        };
    },

    /**
     * Fallback pour les données de l'ancien système (sans repetitions_validees)
     */
    _getStatusFromOldSystem(stats, exercice) {
        const pratiquesParfaites = stats.pratiques_parfaites || 0;

        if (pratiquesParfaites === 0) {
            return {
                statut: this.STATUTS_SF.A_DECOUVRIR,
                repetitions: 0,
                ...this.LABELS_STATUTS_SF['a-decouvrir'],
                statusClass: 'a-decouvrir',
                message: 'Premier essai',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false
            };
        }

        // Approximation : 1 pratique parfaite ≈ 1 répétition, max 3 (ancien système)
        const repsApprox = Math.min(pratiquesParfaites, 3);

        return {
            statut: this.STATUTS_SF.EN_COURS,
            repetitions: repsApprox,
            ...this.LABELS_STATUTS_SF['en-cours'],
            statusClass: 'en-cours',
            message: `~${repsApprox}/${this.SEUIL_REPETITIONS} (migration)`,
            joursRestants: 0,
            prochaineDispo: null,
            peutFaire: true,
            estEntrainementLibre: false
        };
    },

    /**
     * Calcule le numéro de semaine de l'année
     */
    _getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    },

    /**
     * Génère un hash simple à partir d'une chaîne
     */
    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    },

    /**
     * Sélectionne l'exercice à proposer pour une banque
     * - Différent du dernier exercice fait
     * - Rotation hebdomadaire (seed basé sur semaine)
     */
    getExerciceDisponible(banqueId, exercices) {
        if (!exercices || exercices.length === 0) return null;
        if (exercices.length === 1) return exercices[0];

        // Récupérer le dernier exercice fait dans cette banque (hors entraînement libre)
        let dernierExerciceId = null;
        const banqueStats = Object.values(this.statsSF).filter(s =>
            String(s.banque_id) === String(banqueId) &&
            s.derniere_pratique
        );

        if (banqueStats.length > 0) {
            // Trouver le plus récent
            banqueStats.sort((a, b) => new Date(b.derniere_pratique) - new Date(a.derniere_pratique));
            dernierExerciceId = banqueStats[0].exercice_id;
        }

        // Filtrer : exclure le dernier exercice fait
        let exercicesDisponibles = exercices.filter(e => String(e.id) !== String(dernierExerciceId));

        // Si un seul exercice dans la banque (ou après filtrage), on le garde
        if (exercicesDisponibles.length === 0) {
            exercicesDisponibles = exercices;
        }

        // Sélection pseudo-aléatoire basée sur la semaine (pour stabilité)
        const weekNumber = this._getWeekNumber(new Date());
        const seed = this._hashCode(banqueId + '_' + weekNumber + '_' + this.currentUser?.id);
        const index = Math.abs(seed) % exercicesDisponibles.length;

        return exercicesDisponibles[index];
    },

    /**
     * OPTION B: Détermine le statut d'une banque SF (progression par banque, pas par exercice)
     * @returns {Object} { status, repetitions, exercice?, prochaineDispo?, message, peutFaire, estEntrainementLibre }
     */
    getBanqueStatusSF(banqueId, exercices) {
        if (!exercices || exercices.length === 0) {
            return { status: 'vide', message: 'Aucun exercice', repetitions: 0, peutFaire: false };
        }

        const now = new Date();
        const stats = this.statsSFBanque[String(banqueId)];

        // Pas de stats = jamais fait cette banque
        if (!stats || stats.repetitions_validees === undefined || stats.repetitions_validees === 0) {
            const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
            return {
                status: this.STATUTS_SF.A_DECOUVRIR,
                repetitions: 0,
                ...this.LABELS_STATUTS_SF['a-decouvrir'],
                statusClass: 'a-decouvrir',
                message: 'Premier essai',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercice: exercice
            };
        }

        const reps = stats.repetitions_validees || 0;
        const exercicesReussis = stats.exercices_reussis || [];
        const dernierePratique = stats.date_derniere_validation
            ? new Date(stats.date_derniere_validation)
            : null;

        // Maîtrisé (5 répétitions avec 5 exercices différents)
        if (reps >= this.SEUIL_REPETITIONS) {
            // Vérifier si rappel suggéré (>21 jours)
            if (dernierePratique) {
                const joursDepuis = Math.floor((now - dernierePratique) / (1000 * 60 * 60 * 24));
                if (joursDepuis >= this.SEUIL_JOURS_RAPPEL) {
                    const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
                    return {
                        status: this.STATUTS_SF.RAPPEL_SUGGERE,
                        repetitions: reps,
                        ...this.LABELS_STATUTS_SF['rappel-suggere'],
                        statusClass: 'rappel-suggere',
                        message: `${joursDepuis}j depuis dernière pratique`,
                        joursRestants: 0,
                        prochaineDispo: null,
                        peutFaire: true,
                        estEntrainementLibre: false,
                        joursDepuis,
                        exercice: exercice,
                        exercicesReussis
                    };
                }
            }

            return {
                status: this.STATUTS_SF.MAITRISE,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['maitrise'],
                statusClass: 'maitrise',
                message: 'Banque maîtrisée !',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercicesReussis
            };
        }

        // En cours (1-4 répétitions) - vérifier espacement
        if (reps > 0 && dernierePratique) {
            const espacementRequis = this.ESPACEMENTS_REPETITIONS[reps] || 7;
            const prochaineDispo = new Date(dernierePratique);
            prochaineDispo.setDate(prochaineDispo.getDate() + espacementRequis);

            const joursRestants = Math.max(0, Math.ceil((prochaineDispo - now) / (1000 * 60 * 60 * 24)));

            if (now < prochaineDispo) {
                // Bloqué - en pause
                const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
                return {
                    status: this.STATUTS_SF.EN_PAUSE,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['en-pause'],
                    statusClass: 'en-pause',
                    message: `Dispo dans ${joursRestants}j`,
                    joursRestants: joursRestants,
                    prochaineDispo: prochaineDispo.toISOString(),
                    peutFaire: false,
                    estEntrainementLibre: true, // Peut s'entraîner librement
                    exercice: exercice,
                    exercicesReussis
                };
            } else {
                // Disponible - à réviser
                const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
                return {
                    status: this.STATUTS_SF.A_REVISER,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['a-reviser'],
                    statusClass: 'a-reviser',
                    message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS} disponible`,
                    joursRestants: 0,
                    prochaineDispo: null,
                    peutFaire: true,
                    estEntrainementLibre: false,
                    exercice: exercice,
                    exercicesReussis
                };
            }
        }

        // En cours sans date (cas rare)
        if (reps > 0) {
            const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
            return {
                status: this.STATUTS_SF.EN_COURS,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['en-cours'],
                statusClass: 'en-cours',
                message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS}`,
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercice: exercice,
                exercicesReussis
            };
        }

        // Par défaut : à découvrir
        const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
        return {
            status: this.STATUTS_SF.A_DECOUVRIR,
            repetitions: 0,
            ...this.LABELS_STATUTS_SF['a-decouvrir'],
            statusClass: 'a-decouvrir',
            message: 'Premier essai',
            joursRestants: 0,
            prochaineDispo: null,
            peutFaire: true,
            estEntrainementLibre: false,
            exercice: exercice
        };
    },

    /**
     * OPTION B: Sélectionne un exercice aléatoire parmi ceux non encore réussis pour cette banque
     * @param {string} banqueId - ID de la banque
     * @param {Array} exercices - Liste des exercices de la banque
     * @param {Array} exercicesReussis - Liste des IDs d'exercices déjà réussis
     * @returns {Object|null} Un exercice aléatoire
     */
    getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis) {
        if (!exercices || exercices.length === 0) return null;

        // Convertir en strings pour comparaison
        const reussisSet = new Set((exercicesReussis || []).map(id => String(id)));

        // Filtrer les exercices non encore réussis
        let exercicesDisponibles = exercices.filter(e => !reussisSet.has(String(e.id)));

        // Si tous les exercices ont été réussis, on recycle (permet de continuer après maîtrise)
        if (exercicesDisponibles.length === 0) {
            exercicesDisponibles = exercices;
        }

        // Sélection aléatoire
        const randomIndex = Math.floor(Math.random() * exercicesDisponibles.length);
        return exercicesDisponibles[randomIndex];
    },

    /**
     * Affiche le pop-up de blocage avec option d'entraînement libre
     * @param {Object} statusInfo - Infos du statut de l'exercice
     * @param {Function} onEntrainementLibre - Callback si l'élève choisit de s'entraîner
     * @param {Function} onClose - Callback pour fermer
     */
    showBlocagePopup(statusInfo, onEntrainementLibre, onClose) {
        // Supprimer popup existant
        const existingPopup = document.querySelector('.blocage-popup-overlay');
        if (existingPopup) existingPopup.remove();

        const prochaineDateStr = statusInfo.prochaineDispo
            ? new Date(statusInfo.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            })
            : 'bientôt';

        // Message avec ordinal
        const prochainNumero = statusInfo.repetitions + 1;
        const ordinalMsg = prochainNumero <= this.SEUIL_REPETITIONS
            ? `Tu pourras passer à ton ${this.ORDINAUX[prochainNumero]} entraînement dans ${statusInfo.joursRestants} jour${statusInfo.joursRestants > 1 ? 's' : ''}`
            : 'Tu as maîtrisé cette banque !';

        const popup = document.createElement('div');
        popup.className = 'blocage-popup-overlay';
        popup.innerHTML = `
            <div class="blocage-popup">
                <div class="blocage-popup-header">
                    <span class="blocage-icon">🔒</span>
                    <h3>Pas encore !</h3>
                </div>
                <div class="blocage-popup-body">
                    <p class="blocage-message">
                        Tu as réussi cet entraînement ! Pour apprendre efficacement, retravaille cette banque le <strong>${prochaineDateStr}</strong>.
                    </p>
                    <div class="blocage-progress">
                        <span class="blocage-etape">${ordinalMsg}</span>
                    </div>
                </div>
                <div class="blocage-popup-actions">
                    <button class="btn btn-primary blocage-btn-compris" type="button">
                        J'ai compris
                    </button>
                    <button class="btn btn-ghost blocage-btn-libre" type="button">
                        M'entraîner quand même
                    </button>
                </div>
                <p class="blocage-warning">
                    ⚠️ L'entraînement libre ne compte pas pour ta progression
                </p>
            </div>
        `;

        document.body.appendChild(popup);

        // Event listeners
        popup.querySelector('.blocage-btn-compris').addEventListener('click', () => {
            popup.remove();
            if (onClose) onClose();
        });

        popup.querySelector('.blocage-btn-libre').addEventListener('click', () => {
            popup.remove();
            if (onEntrainementLibre) onEntrainementLibre();
        });

        // Fermer en cliquant en dehors
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
                if (onClose) onClose();
            }
        });
    },

    /**
     * OPTION B: Valide une tentative d'exercice SF au niveau de la BANQUE
     * @param {Object} exercice - Données de l'exercice
     * @param {number} score - Score obtenu (0-100)
     * @param {number} tempsPasse - Temps passé en secondes
     * @param {Object} statsBanque - Stats actuelles de la BANQUE (pas de l'exercice)
     * @returns {Object} Résultat de la validation
     */
    validerRepetitionSF(exercice, score, tempsPasse, statsBanque) {
        const tempsPrevu = exercice.duree || 900; // 15 min par défaut
        const repsActuelles = statsBanque?.repetitions_validees || 0;
        const prochaineRep = repsActuelles + 1;

        // Entraînement libre = ne compte pas pour la progression
        if (this.isEntrainementLibre) {
            const isSuccessLibre = score === 100;
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'entrainement_libre',
                message: isSuccessLibre ? 'Bravo !' : "Continue de t'entraîner, tu vas y arriver !",
                conseil: '',
                estMaitrise: repsActuelles >= this.SEUIL_REPETITIONS,
                proposeNouvelExercice: false,
                scoreEntrainementLibre: score // Pour savoir si réussi ou non dans l'affichage
            };
        }

        // Score non parfait = pas validé, proposer un autre exercice
        if (score < 100) {
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'score_insuffisant',
                message: `Continue tes efforts ! (${score}%)`,
                conseil: '',  // Plus de message culpabilisant
                estMaitrise: false,
                proposeNouvelExercice: true  // OPTION B: proposer un autre exercice
            };
        }

        // Vérifier le temps pour répétitions 2, 3, 4 et 5 (automatisation)
        if (prochaineRep >= this.REP_TEMPS_OBLIGATOIRE && tempsPasse > tempsPrevu) {
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'temps_depasse',
                message: `Presque ! Essaie d'aller plus vite`,
                conseil: '',  // Plus de message culpabilisant
                estMaitrise: false,
                proposeNouvelExercice: true  // OPTION B: proposer un autre exercice
            };
        }

        // Répétition validée !
        const nouvelleRep = Math.min(prochaineRep, this.SEUIL_REPETITIONS);
        const estMaitrise = nouvelleRep >= this.SEUIL_REPETITIONS;

        // Calculer prochaine disponibilité
        let prochaineDispo = null;
        let joursAttente = 0;
        if (!estMaitrise) {
            joursAttente = this.ESPACEMENTS_REPETITIONS[nouvelleRep] || 7;
            prochaineDispo = new Date();
            prochaineDispo.setDate(prochaineDispo.getDate() + joursAttente);
        }

        return {
            repetitionValidee: true,
            nouvelleRepetition: nouvelleRep,
            raison: 'succes',
            message: estMaitrise
                ? '🎉 Banque maîtrisée !'
                : `Bravo ! Niveau ${nouvelleRep}/${this.SEUIL_REPETITIONS} atteint`,
            conseil: estMaitrise
                ? 'Félicitations ! Tu maîtrises cette banque !'
                : '',
            prochaineDispo: prochaineDispo?.toISOString(),
            joursAttente: joursAttente,
            estMaitrise: estMaitrise,
            proposeNouvelExercice: false
        };
    },

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
        } catch (e) {}
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
        } catch (error) {}
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
        // Phase 1: Affichage simple sans priorité
        let nbBanquesMaitrisees = 0;
        const banquesStatus = {};

        this.banques.forEach(banque => {
            const banqueExercices = exercicesByBanque[banque.id] || [];
            const status = this.getBanqueStatusSF(banque.id, banqueExercices);
            banquesStatus[banque.id] = status;

            if (status.status === this.STATUTS_SF.MAITRISE) nbBanquesMaitrisees++;
        });

        // Message bandeau simplifié (pas de priorité en Phase 1)
        let bandeauMessage, bandeauClass;
        if (nbBanquesMaitrisees === this.banques.length && this.banques.length > 0) {
            bandeauMessage = '🏆 Tout est maîtrisé !';
            bandeauClass = 'all-done';
        } else {
            bandeauMessage = `${this.banques.length} banque${this.banques.length > 1 ? 's' : ''}`;
            bandeauClass = '';
        }

        let html = `
            <!-- Bandeau SF simplifié -->
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

        this.banques.forEach(banque => {
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

            // Status class simplifié (Phase 1: pas de "bloquee")
            const statusClass = banqueStatus.status === this.STATUTS_SF.MAITRISE ? 'maitrisee' : '';

            // Message simplifié: juste la progression
            const reps = banqueStatus.repetitions || 0;
            const simpleMessage = banqueStatus.status === this.STATUTS_SF.MAITRISE
                ? 'Maîtrisé !'
                : `Niveau ${reps}/${this.SEUIL_REPETITIONS}`;

            html += `
                <div class="banque-accordion-item ${this.currentType}${isExpanded ? ' expanded' : ''} ${statusClass}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveExercices.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${this.escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">
                                <span class="banque-status-message">${simpleMessage}</span>
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
     * Phase 1: Rendu simplifié - toujours montrer l'exercice comme accessible
     */
    renderExercisesListSF(banqueId, exercices, banqueStatus) {
        if (!exercices || exercices.length === 0) {
            return '<div class="empty-state" style="padding: 1rem;"><p>Aucun exercice dans cette banque</p></div>';
        }

        // Si banque maîtrisée, montrer résumé + option de s'entraîner
        if (banqueStatus.status === this.STATUTS_SF.MAITRISE) {
            const exo = banqueStatus.exercice || exercices[0];
            return `
                <div class="banque-resume">
                    <p>Tu as réussi 5 exercices différents !</p>
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

        // Exercice à afficher
        const exo = banqueStatus.exercice;
        if (!exo) {
            return '<div class="empty-state" style="padding: 1rem;"><p>Aucun exercice disponible</p></div>';
        }

        const reps = banqueStatus.repetitions || 0;
        const dureeMinutes = exo.duree > 60 ? Math.floor(exo.duree / 60) : exo.duree;

        // Info sur quand le niveau compte (si espacement non atteint)
        let infoEspacement = '';
        if (banqueStatus.status === this.STATUTS_SF.EN_PAUSE && banqueStatus.prochaineDispo) {
            const prochaineDateStr = new Date(banqueStatus.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'short'
            });
            infoEspacement = `<div class="info-espacement">ℹ️ Ton niveau ${reps + 1} compte à partir de ${prochaineDateStr}</div>`;
        }

        return `
            ${infoEspacement}
            <div class="exercice-item ${this.currentType} selected-exercise"
                 onclick="EleveExercices.startExercise('${exo.id}')"
                 data-exercice-id="${exo.id}">
                <div class="exercice-numero">${reps + 1}</div>
                <div class="exercice-info">
                    <div class="exercice-titre">${this.escapeHtml(exo.titre || 'Exercice')}</div>
                    <div class="exercice-meta">${dureeMinutes ? dureeMinutes + ' min' : ''}</div>
                </div>
                <div class="exercice-status-area">
                    <span class="exercice-hint">Commencer →</span>
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
                            <div class="banque-title">${this.escapeHtml(banque.titre)}</div>
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
     * Calcule les stats globales pour SF (nouveau système 6 statuts)
     */
    calculateGlobalStatsSF(exercicesByBanque) {
        let total = 0;
        let maitrise = 0;      // Anciennement "automatise"
        let rappelSuggere = 0; // Nouveau statut
        let aReviser = 0;      // Anciennement "a-rafraichir"
        let enCours = 0;       // Anciennement "en-acquisition"
        let enPause = 0;       // Anciennement "acquis-lent"
        let aDecouvrir = 0;    // Anciennement "new"

        this.banques.forEach(banque => {
            const exercices = exercicesByBanque[banque.id] || [];
            exercices.forEach(exo => {
                total++;
                const status = this.getExerciceStatusSF(exo.id, exo);

                switch (status.statusClass) {
                    case 'maitrise': maitrise++; break;
                    case 'rappel-suggere': rappelSuggere++; break;
                    case 'a-reviser': aReviser++; break;
                    case 'en-cours': enCours++; break;
                    case 'en-pause': enPause++; break;
                    case 'a-decouvrir': aDecouvrir++; break;
                }
            });
        });

        // "À faire" = à réviser + en cours + à découvrir + rappel suggéré
        const aFaire = aReviser + enCours + aDecouvrir + rappelSuggere;

        // Pour compatibilité avec l'ancien code qui utilise "automatise"
        const automatise = maitrise;

        return {
            total,
            automatise,       // Pour compatibilité
            maitrise,
            rappelSuggere,
            aReviser,
            enCours,
            enPause,
            aDecouvrir,
            aFaire
        };
    },

    /**
     * OPTION B: Calcule les stats d'une banque SF basées sur les répétitions de la BANQUE
     * Progression = répétitions validées / 5 * 100
     */
    calculateBanqueStatsSF(exercices, banqueId) {
        const total = exercices.length;

        // DEBUG: Afficher les clés disponibles et l'ID recherché
        console.log('[DEBUG calculateBanqueStatsSF] banqueId recherché:', banqueId);
        console.log('[DEBUG calculateBanqueStatsSF] Clés dans statsSFBanque:', Object.keys(this.statsSFBanque));
        console.log('[DEBUG calculateBanqueStatsSF] statsSFBanque complet:', this.statsSFBanque);

        // Récupérer les stats de la banque (Option B)
        const statsBanque = this.statsSFBanque[String(banqueId)];
        console.log('[DEBUG calculateBanqueStatsSF] Stats trouvées:', statsBanque);
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

        // Trier les exercices par priorité pour SF (à faire en premier)
        // Ordre: À réviser → En cours → À découvrir → Rappel suggéré → En pause → Maîtrisé
        let sorted = [...exercices];
        if (this.currentType === 'savoir-faire') {
            const priorityOrder = {
                'a-reviser': 0,      // Disponible pour répétition - priorité max
                'en-cours': 1,       // En progression
                'a-decouvrir': 2,    // Nouveau
                'rappel-suggere': 3, // Maîtrisé mais à rafraîchir
                'en-pause': 4,       // Bloqué temporairement
                'maitrise': 5        // Terminé
            };
            sorted.sort((a, b) => {
                const statusA = this.getExerciceStatusSF(a.id, a);
                const statusB = this.getExerciceStatusSF(b.id, b);
                return (priorityOrder[statusA.statusClass] ?? 6) - (priorityOrder[statusB.statusClass] ?? 6);
            });
        }

        return sorted.map((exo, index) => {
            const format = this.formats.find(f => f.id === exo.format_id);

            // Pour les savoir-faire, utiliser le nouveau système de statut
            if (this.currentType === 'savoir-faire') {
                const statusSF = this.getExerciceStatusSF(exo.id, exo);
                const isMaitrise = statusSF.statusClass === 'maitrise';

                // Badge et indication sous le badge
                let statusBadge = `<span class="entrainement-badge ${statusSF.statusClass}">${statusSF.icon} ${statusSF.label}</span>`;
                let actionHint = '';

                switch (statusSF.statusClass) {
                    case 'a-decouvrir':
                        actionHint = 'Clique pour découvrir →';
                        break;
                    case 'en-cours':
                        actionHint = `Niveau ${statusSF.repetitions}/${this.SEUIL_REPETITIONS}`;
                        break;
                    case 'a-reviser':
                        actionHint = `Niveau ${statusSF.repetitions + 1}/${this.SEUIL_REPETITIONS} dispo →`;
                        break;
                    case 'en-pause':
                        actionHint = statusSF.message; // "Dispo dans Xj"
                        break;
                    case 'maitrise':
                        actionHint = `Niveau ${this.SEUIL_REPETITIONS}/${this.SEUIL_REPETITIONS}`;
                        break;
                    case 'rappel-suggere':
                        actionHint = statusSF.joursDepuis ? `${statusSF.joursDepuis}j sans pratiquer` : 'Rappel suggéré';
                        break;
                }

                // Métadonnées - juste la durée en minutes
                let metaText = '';
                if (exo.duree) {
                    // Si durée > 60, c'est probablement en secondes → convertir en minutes
                    const dureeMinutes = exo.duree > 60 ? Math.floor(exo.duree / 60) : exo.duree;
                    metaText = `${dureeMinutes} min`;
                }

                return `
                    <div class="exercice-item ${this.currentType} ${statusSF.statusClass}${isMaitrise ? ' completed' : ''}"
                         onclick="EleveExercices.startExercise('${exo.id}')"
                         data-exercice-id="${exo.id}">
                        <div class="exercice-numero">${index + 1}</div>
                        <div class="exercice-info">
                            <div class="exercice-titre">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                            <div class="exercice-meta">${metaText}</div>
                        </div>
                        <div class="exercice-status-area">
                            ${statusBadge}
                            <span class="exercice-hint">${actionHint}</span>
                        </div>
                    </div>
                `;
            }

            // Pour les autres types, garder l'ancien système
            const result = this.getExerciseResult(exo.id);
            const statusInfo = this.getStatusInfo(result);
            const isCompleted = result && result.score === 100;

            return `
                <div class="exercice-item ${this.currentType}${isCompleted ? ' completed' : ''}"
                     onclick="EleveExercices.startExercise('${exo.id}')">
                    <div class="exercice-numero">${exo.numero || '?'}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
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
        // Pour les savoir-faire, déterminer si c'est entrainement libre
        // Phase 1: Pas de popup de blocage, mais on track si espacement atteint ou non
        console.log('[SF DEBUG startExercise] forceEntrainementLibre:', forceEntrainementLibre);

        if (this.currentType === 'savoir-faire') {
            const exo = this.exercices.find(e => String(e.id) === String(exerciceId));
            if (exo) {
                const banqueId = exo.banque_id;
                const banqueExercices = this.exercices.filter(e => e.banque_id === banqueId);
                const banqueStatus = this.getBanqueStatusSF(banqueId, banqueExercices);

                console.log('[SF DEBUG startExercise] banqueStatus:', banqueStatus.status, '| EN_PAUSE:', this.STATUTS_SF.EN_PAUSE, '| MAITRISE:', this.STATUTS_SF.MAITRISE);

                // Entrainement libre si: forcé, OU espacement non atteint, OU banque maîtrisée
                this.isEntrainementLibre = forceEntrainementLibre ||
                    banqueStatus.status === this.STATUTS_SF.EN_PAUSE ||
                    banqueStatus.status === this.STATUTS_SF.MAITRISE;

                console.log('[SF DEBUG startExercise] isEntrainementLibre final:', this.isEntrainementLibre);
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

        let donnees = exo.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';
        let contentHTML = '';

        if (typeUI === 'tableau_saisie') {
            contentHTML = this.renderTableauSaisie(donnees, structure);
        } else if (typeUI === 'carte_cliquable') {
            contentHTML = this.renderCarteCliquable(donnees, structure);
        } else if (typeUI === 'document_tableau') {
            contentHTML = this.renderDocumentTableau(donnees, structure);
        } else if (typeUI === 'question_ouverte') {
            contentHTML = this.renderQuestionOuverte(donnees, structure);
        } else if (typeUI === 'document_mixte') {
            contentHTML = this.renderDocumentMixte(donnees, structure);
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
                                <h1>${banque ? this.escapeHtml(banque.titre) : ''} - ${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</h1>
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
                            ${this.escapeHtml(exo.consigne)}
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
    // RENDER EXERCISE TYPES
    // ===============================

    renderTableauSaisie(donnees, structure) {
        let colonnes = donnees.colonnes || structure.colonnes || [
            { titre: 'Date', editable: false },
            { titre: 'Réponse', editable: true }
        ];
        const lignes = donnees.lignes || [];

        let html = `
            <table class="tableau-exercice">
                <thead>
                    <tr>
                        ${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            html += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    html += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    const value = cells[colIndex] || '';
                    html += `<td class="cell-display">${this.escapeHtml(value)}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    renderCarteCliquable(donnees, structure) {
        const imageUrl = this.convertToDirectImageUrl(donnees.image_url || '');
        const marqueurs = donnees.marqueurs || [];

        let marqueursHTML = marqueurs.map((m, index) => `
            <div class="carte-marqueur" data-id="${m.id || index}"
                 data-reponse="${this.escapeHtml(m.reponse || '')}"
                 style="left: ${m.x}%; top: ${m.y}%;"
                 onclick="EleveExercices.openMarqueurModal(${index})">
                <span class="marqueur-numero">${index + 1}</span>
                <span class="marqueur-reponse-badge hidden" id="badge_${index}"></span>
            </div>
        `).join('');

        this.carteMarqueurs = marqueurs;
        this.carteReponses = new Array(marqueurs.length).fill('');
        this.currentMarqueurIndex = null;

        return `
            <div class="carte-cliquable-container">
                <div class="carte-image-wrapper">
                    <img src="${this.escapeHtml(imageUrl)}" alt="Carte" class="carte-image">
                    <div class="carte-marqueurs">${marqueursHTML}</div>
                </div>
            </div>
            <div class="carte-modal-overlay hidden" id="marqueurModal">
                <div class="carte-modal">
                    <div class="carte-modal-header">
                        <h3>Élément n°<span id="modalMarqueurNum"></span></h3>
                        <button class="carte-modal-close" onclick="EleveExercices.closeMarqueurModal()">×</button>
                    </div>
                    <div class="carte-modal-body">
                        <label>Identifiez cet élément :</label>
                        <input type="text" id="marqueurInput" placeholder="Votre réponse..." autocomplete="off">
                    </div>
                    <div class="carte-modal-footer">
                        <button class="btn-cancel" onclick="EleveExercices.closeMarqueurModal()">Annuler</button>
                        <button class="btn-validate" onclick="EleveExercices.saveMarqueurReponse()">Valider</button>
                    </div>
                </div>
            </div>
        `;
    },

    openMarqueurModal(index) {
        this.currentMarqueurIndex = index;
        document.getElementById('modalMarqueurNum').textContent = index + 1;
        document.getElementById('marqueurInput').value = this.carteReponses[index] || '';
        document.getElementById('marqueurModal').classList.remove('hidden');
        document.getElementById('marqueurInput').focus();
    },

    closeMarqueurModal() {
        document.getElementById('marqueurModal').classList.add('hidden');
        this.currentMarqueurIndex = null;
    },

    saveMarqueurReponse() {
        const index = this.currentMarqueurIndex;
        if (index === null) return;

        const reponse = document.getElementById('marqueurInput').value.trim();
        this.carteReponses[index] = reponse;

        const badge = document.getElementById(`badge_${index}`);
        if (badge) {
            if (reponse) {
                badge.textContent = reponse;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (marqueur) {
            marqueur.classList.toggle('answered', reponse !== '');
        }

        this.closeMarqueurModal();
    },

    renderDocumentTableau(donnees, structure) {
        const doc = donnees.document || {};
        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let tableHTML = `
            <table class="tableau-exercice">
                <thead><tr>${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}</tr></thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            tableHTML += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    tableHTML += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    tableHTML += `<td class="cell-display">${this.escapeHtml(cells[colIndex] || '')}</td>`;
                }
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';

        return `
            <div class="document-tableau-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="tableau-section"><h4>À compléter</h4>${tableHTML}</div>
            </div>
        `;
    },

    renderQuestionOuverte(donnees, structure) {
        const doc = donnees.document || {};
        const questions = donnees.questions || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let questionsHTML = questions.map((q, qIndex) => {
            const etapesHTML = (q.etapes || []).map((etape, eIndex) => `
                <div class="question-etape">
                    <label>${this.escapeHtml(etape)}</label>
                    <textarea id="reponse_${qIndex}_${eIndex}" rows="2" placeholder="Votre réponse..."></textarea>
                </div>
            `).join('');

            return `
                <div class="question-ouverte-item" id="question_${qIndex}">
                    <h4>${this.escapeHtml(q.titre || `Question ${qIndex + 1}`)}</h4>
                    ${etapesHTML}
                    <div class="correction-box hidden" id="correctionBox_${qIndex}">
                        <h5>Correction</h5>
                        <div class="correction-content">${this.escapeHtml(q.reponse_attendue || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.questionsOuvertes = questions;

        return `
            <div class="question-ouverte-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="questions-section"><h4>Questions</h4>${questionsHTML}</div>
            </div>
        `;
    },

    renderDocumentMixte(donnees, structure) {
        const doc = donnees.document || { actif: false };
        const tableau = donnees.tableau || { actif: false };
        const questions = donnees.questions || { actif: false };
        const sectionOrder = donnees.sectionOrder || ['document', 'tableau', 'questions'];
        const layout = donnees.layout || 'vertical';

        this.mixteData = donnees;

        if (layout === 'horizontal' && doc.actif) {
            const docHTML = this.renderMixteDocumentSection(doc);
            let rightHTML = '';
            sectionOrder.forEach(section => {
                if (section === 'tableau' && tableau.actif) {
                    rightHTML += this.renderMixteTableauSection(tableau);
                } else if (section === 'questions' && questions.actif) {
                    rightHTML += this.renderMixteQuestionsSection(questions);
                }
            });

            return `
                <div class="document-mixte-container horizontal-layout">
                    <div class="mixte-left-column">${docHTML}</div>
                    <div class="mixte-right-column">${rightHTML}</div>
                </div>
            `;
        }

        let sectionsHTML = '';
        sectionOrder.forEach(section => {
            if (section === 'document' && doc.actif) {
                sectionsHTML += this.renderMixteDocumentSection(doc);
            } else if (section === 'tableau' && tableau.actif) {
                sectionsHTML += this.renderMixteTableauSection(tableau);
            } else if (section === 'questions' && questions.actif) {
                sectionsHTML += this.renderMixteQuestionsSection(questions);
            }
        });

        return `<div class="document-mixte-container">${sectionsHTML}</div>`;
    },

    renderMixteDocumentSection(doc) {
        const docType = doc.type || 'url';
        const url = doc.url || '';
        const texte = doc.texte || '';
        const titre = doc.titre || '';
        const legende = doc.legende || '';

        const legendeHTML = this.escapeHtml(legende).replace(/\*([^*]+)\*/g, '<em>$1</em>');

        let contentHTML = '';

        if (docType === 'texte' && texte) {
            contentHTML = this.textToHtml(texte);
        } else if (url) {
            const converted = this.convertGoogleUrl(url);
            if (converted.type === 'empty') {
                contentHTML = '<div class="doc-placeholder">Document non disponible</div>';
            } else if (converted.type === 'drive_file') {
                contentHTML = `
                    <img src="${converted.imageUrl}" alt="Document" class="mixte-doc-image"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <iframe src="${converted.iframeUrl}" class="mixte-doc-iframe" style="display:none;"></iframe>
                `;
            } else if (converted.iframeUrl) {
                contentHTML = `<iframe src="${converted.iframeUrl}" class="mixte-doc-iframe"></iframe>`;
            } else {
                contentHTML = `<img src="${this.convertToDirectImageUrl(url)}" alt="Document" class="mixte-doc-image">`;
            }
        } else {
            contentHTML = '<div class="doc-placeholder">Aucun document</div>';
        }

        return `
            <div class="mixte-section mixte-document">
                ${titre ? `<div class="mixte-section-header doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="mixte-doc-content ${docType === 'texte' ? 'doc-text-content' : ''}">${contentHTML}</div>
                ${legende ? `<div class="mixte-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    textToHtml(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        const paragraphs = html.split(/\n\s*\n/);
        return paragraphs.map(p => {
            const withBreaks = p.trim().replace(/\n/g, '<br>');
            return `<p>${withBreaks}</p>`;
        }).join('');
    },

    renderMixteTableauSection(tableau) {
        const titre = tableau.titre || 'À compléter';

        if (tableau.elements && tableau.elements.length > 0) {
            this.mixteTableauElements = tableau.elements;

            const elementsHTML = tableau.elements.map((el, idx) => {
                if (el.type === 'section') {
                    return `<div class="mixte-tableau-section-row">${this.escapeHtml(el.text)}</div>`;
                } else {
                    return `
                        <div class="mixte-tableau-row">
                            <div class="row-label">${this.escapeHtml(el.label)}</div>
                            <div class="row-input">
                                <input type="text" class="cell-input" id="mixte_element_${idx}"
                                       placeholder="${this.escapeHtml(el.placeholder || '')}" data-index="${idx}"
                                       data-reponse="${this.escapeHtml(el.reponse || '')}" autocomplete="off">
                            </div>
                        </div>
                    `;
                }
            }).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">${elementsHTML}</div>
                </div>
            `;
        } else {
            const colonnes = tableau.colonnes || [];
            const lignes = tableau.lignes || [];

            this.mixteTableauColonnes = colonnes;
            this.mixteTableauLignes = lignes;

            const headerHTML = colonnes.map(col =>
                `<th class="${col.editable ? 'editable-header' : ''}">${this.escapeHtml(col.titre)}</th>`
            ).join('');

            const bodyHTML = lignes.map((ligne, rowIdx) =>
                `<tr>${colonnes.map((col, colIdx) => {
                    if (col.editable) {
                        return `<td class="cell-editable">
                            <input type="text" class="cell-input" id="mixte_cell_${rowIdx}_${colIdx}" placeholder="..." data-row="${rowIdx}" data-col="${colIdx}" autocomplete="off">
                        </td>`;
                    } else {
                        return `<td>${this.escapeHtml(ligne.cells[colIdx] || '')}</td>`;
                    }
                }).join('')}</tr>`
            ).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">
                        <table class="mixte-table">
                            <thead><tr>${headerHTML}</tr></thead>
                            <tbody>${bodyHTML}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    },

    renderMixteQuestionsSection(questions) {
        const liste = questions.liste || [];
        this.mixteQuestions = liste;

        const questionsHTML = liste.map((q, idx) => `
            <div class="mixte-question-item" id="mixte_question_${idx}">
                <div class="mixte-question-text">${idx + 1}. ${this.escapeHtml(q.question)}</div>
                <textarea id="mixte_answer_${idx}" class="mixte-question-textarea" placeholder="Votre réponse..." rows="3"></textarea>
                <div class="mixte-correction hidden" id="mixte_correction_${idx}">
                    <strong>Correction:</strong> ${this.escapeHtml(q.reponse_attendue || '')}
                </div>
            </div>
        `).join('');

        return `
            <div class="mixte-section mixte-questions">
                <div class="mixte-section-header questions-header">Questions</div>
                <div class="mixte-questions-content">${questionsHTML}</div>
            </div>
        `;
    },

    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveFileMatch) {
            const fileId = driveFileMatch[1];
            return {
                type: 'drive_file',
                id: fileId,
                imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
                iframeUrl: `https://drive.google.com/file/d/${fileId}/preview`
            };
        }

        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            return { type: 'google_doc', id: docsMatch[1], iframeUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview` };
        }

        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            return { type: 'google_sheet', id: sheetsMatch[1], iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview` };
        }

        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            return { type: 'google_slide', id: slidesMatch[1], iframeUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed` };
        }

        return { type: 'direct_url', url: url, imageUrl: url };
    },

    // ===============================
    // VALIDATION
    // ===============================

    /**
     * Bloque l'exercice pendant le chargement (après clic sur Terminer)
     * Désactive tous les inputs et affiche un overlay
     */
    lockExercise() {
        const exerciseContent = document.querySelector('.exercise-content');
        if (!exerciseContent) return;

        // Désactiver tous les champs de saisie
        const inputs = exerciseContent.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = true;
            input.classList.add('locked');
        });

        // Ajouter un overlay de chargement sur l'exercice
        const overlay = document.createElement('div');
        overlay.className = 'exercise-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Calcul du résultat...</span>
            </div>
        `;
        exerciseContent.style.position = 'relative';
        exerciseContent.appendChild(overlay);
    },

    async validateExercise() {
        if (!this.currentExercise) return;

        // Empêcher les clics multiples
        if (this.isValidating) return;
        this.isValidating = true;

        // Désactiver le bouton et afficher le chargement
        const btnVerifier = document.getElementById('btnVerifier');
        if (btnVerifier) {
            btnVerifier.disabled = true;
            btnVerifier.innerHTML = '<span class="spinner-small"></span> Validation...';
        }

        // Bloquer tout l'exercice pendant le chargement
        this.lockExercise();

        this.stopTimer();

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';
        let result;

        if (typeUI === 'carte_cliquable') {
            result = this.validateCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            result = this.validateQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            result = this.validateDocumentMixte();
        } else {
            result = this.validateTableauSaisie();
        }

        const { correct, total } = result;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Sauvegarder le résultat
        await this.saveResult(correct, total, percent);

        // Pour les savoir-faire: afficher l'écran de résultat dédié
        if (this.currentType === 'savoir-faire') {
            // Appliquer les corrections sur l'exercice actuel
            this.applyCorrections(typeUI);

            // Supprimer l'overlay de chargement avant de capturer le HTML
            const overlay = document.querySelector('.exercise-loading-overlay');
            if (overlay) overlay.remove();

            // Capturer le HTML de l'exercice corrigé avec les valeurs des inputs
            const exerciseContent = document.querySelector('.exercise-content');
            const correctedHTML = this.captureContentWithValues(exerciseContent);

            // Capturer aussi la consigne si présente
            const consigneEl = document.querySelector('.exercise-consigne');
            const consigneHTML = consigneEl ? consigneEl.outerHTML : '';

            this.renderResultScreenSF({
                correct,
                total,
                percent,
                correctedHTML,
                consigneHTML
            });
            return;
        }

        // Pour les autres types: comportement existant (bandeau + boutons)
        const banner = document.getElementById('resultBanner');
        if (percent === 100) {
            banner.className = 'result-banner show success';
            banner.textContent = `Parfait ! ${correct}/${total} réponses correctes`;
        } else if (percent >= 50) {
            banner.className = 'result-banner show partial';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        } else {
            banner.className = 'result-banner show error';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        }

        // Après validation : afficher les boutons "Corrigé" et "Recommencer"
        const btnCorrige = document.getElementById('btnCorrige');
        const btnRestart = document.getElementById('btnRestart');

        if (btnCorrige) btnCorrige.style.display = 'inline-flex';
        if (btnRestart) btnRestart.style.display = 'inline-flex';

        // Modifier le bouton "Vérifier" pour permettre de re-vérifier (réutiliser la variable existante)
        if (btnVerifier) {
            btnVerifier.disabled = false;
            btnVerifier.textContent = 'Vérifier à nouveau';
            this.isValidating = false;
        }
    },

    validateTableauSaisie() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];
        let correct = 0, total = 0;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    total++;
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    if (!input) return;

                    const correctAnswerRaw = cells[colIndex] || '';

                    if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                        input.className = 'correct';
                        correct++;
                    } else {
                        input.className = 'incorrect';
                        // DON'T show correction here - only mark as incorrect
                    }
                    // Don't disable input so student can retry
                }
            });
        });

        return { correct, total };
    },

    validateCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];
        let correct = 0, total = marqueurs.length;

        marqueurs.forEach((m, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            const correctAnswerRaw = m.reponse || '';

            if (this.checkAnswerMatch(reponses[index] || '', correctAnswerRaw)) {
                if (marqueur) marqueur.classList.add('correct');
                if (badge) badge.classList.add('correct');
                correct++;
            } else {
                if (marqueur) marqueur.classList.add('incorrect');
                if (badge) badge.classList.add('incorrect');
            }
        });

        // Don't disable markers - student can still modify and retry

        return { correct, total };
    },

    validateQuestionOuverte() {
        // Question ouverte: no auto-correction possible, just mark as answered
        const questions = this.questionsOuvertes || [];
        let hasAnswers = false;

        questions.forEach((q, qIndex) => {
            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea && textarea.value.trim()) {
                    hasAnswers = true;
                    textarea.classList.add('answered');
                }
            });
        });

        // Don't show correction boxes yet - wait for "Voir le corrigé"
        return { correct: 0, total: 0 };
    },

    validateDocumentMixte() {
        let correct = 0, total = 0;
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row' && el.reponse) {
                        total++;
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            const correctAnswerRaw = el.reponse;

                            if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                input.classList.add('correct');
                                input.classList.remove('incorrect');
                                correct++;
                            } else {
                                input.classList.add('incorrect');
                                input.classList.remove('correct');
                            }
                            // Don't disable - allow retry
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((ligne, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            total++;
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                const correctAnswerRaw = ligne.cells[colIdx] || '';

                                if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                    input.classList.add('correct');
                                    input.classList.remove('incorrect');
                                    correct++;
                                } else {
                                    input.classList.add('incorrect');
                                    input.classList.remove('correct');
                                    // DON'T show correction - only mark as incorrect
                                }
                                // Don't disable - allow retry
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif) {
            const questions = this.mixteQuestions || [];
            questions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                if (textarea && textarea.value.trim()) {
                    textarea.classList.add('answered');
                }
                // DON'T show correction yet - wait for "Voir le corrigé"
            });
        }

        return { correct, total };
    },

    async saveResult(correct, total, percent) {
        console.log('[SF] saveResult appelé - currentUser:', this.currentUser, 'currentExercise:', this.currentExercise?.id);

        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = this.currentExercise?.duree || 300; // duree est déjà en secondes

        // IMPORTANT: Capturer isEntrainementLibre AU DÉBUT avant tout appel async
        // Car la valeur peut changer pendant les awaits
        const isEntrainementLibreSnapshot = this.isEntrainementLibre;
        console.log('[SF] isEntrainementLibre capturé au début:', isEntrainementLibreSnapshot);

        // OPTION B: Pour les savoir-faire, calculer la validation au niveau BANQUE
        let validationResult = null;
        if (this.currentType === 'savoir-faire' && this.currentExercise) {
            const banqueId = String(this.currentExercise.banque_id);
            const statsBanque = this.statsSFBanque[banqueId];
            validationResult = this.validerRepetitionSF(this.currentExercise, percent, timeSpent, statsBanque);

            // Stocker le résultat de validation pour l'écran de résultat
            this.lastValidationResult = validationResult;

            // Mettre à jour les stats locales
            const pratiqueData = {
                eleve_id: this.currentUser?.id || 'preview',
                exercice_id: this.currentExercise.id,
                banque_id: this.currentExercise.banque_id,
                score: percent,
                temps_passe: timeSpent,
                temps_prevu: tempsPrevu,
                repetition_validee: validationResult.repetitionValidee,
                nouvelle_repetition: validationResult.nouvelleRepetition,
                est_entrainement_libre: isEntrainementLibreSnapshot  // Utiliser la valeur capturée
            };
            this.updateLocalStatsSF(pratiqueData);
        }

        // Ne pas sauvegarder au backend si pas d'utilisateur
        if (!this.currentUser || !this.currentUser.id || !this.currentExercise) {
            console.log('[SF] Pas de sauvegarde backend (preview mode ou user manquant)');
            return;
        }

        const resultData = {
            eleve_id: this.currentUser.id,
            exercice_id: this.currentExercise.id,
            banque_id: this.currentExercise.banque_id,
            score: percent,
            bonnes_reponses: correct,
            total_questions: total,
            temps_passe: timeSpent,
            date: new Date().toISOString()
        };

        try {
            // Sauvegarder dans l'ancien système (pour compatibilité)
            const result = await this.callAPI('saveResultatExercice', resultData);
            if (result.success) {
                this.updateLocalResult(resultData);
            }

            // Pour les savoir-faire, sauvegarder dans l'historique des pratiques avec nouvelles infos
            if (this.currentType === 'savoir-faire') {
                // DEBUG: Afficher les détails de validation
                console.log('[SF DEBUG] Validation details:', {
                    score: percent,
                    isEntrainementLibreSnapshot: isEntrainementLibreSnapshot,
                    isEntrainementLibreActuel: this.isEntrainementLibre,
                    validationResult: validationResult,
                    repetitionValidee: validationResult?.repetitionValidee,
                    nouvelleRepetition: validationResult?.nouvelleRepetition
                });

                const pratiqueData = {
                    eleve_id: this.currentUser.id,
                    exercice_id: this.currentExercise.id,
                    banque_id: this.currentExercise.banque_id,
                    score: percent,
                    temps_passe: timeSpent,
                    temps_prevu: tempsPrevu,
                    // Nouvelles données système 4 répétitions
                    repetition_numero: validationResult?.repetitionValidee ? validationResult.nouvelleRepetition : 0,
                    est_entrainement_libre: isEntrainementLibreSnapshot  // Utiliser la valeur capturée au début
                };
                console.log('[SF] Envoi sauvegarde pratique au backend:', pratiqueData);
                try {
                    const sfResult = await this.callAPI('savePratiqueSF', pratiqueData);
                    console.log('[SF] Réponse backend savePratiqueSF:', sfResult);
                    if (sfResult.success) {
                        console.log('[SF] DEBUG - Sheet:', sfResult.debug?.sheetName,
                                    '| Created:', sfResult.debug?.sheetCreated,
                                    '| Rows:', sfResult.debug?.rowCount);
                    } else {
                        console.error('[SF] Erreur backend:', sfResult.error);
                    }
                } catch (e) {
                    console.error('[SF] Erreur appel savePratiqueSF:', e);
                }
            }
        } catch (e) {
            console.error('[EleveExercices] Erreur sauvegarde résultat:', e);
        }
    },

    /**
     * OPTION B: Met à jour les stats locales au niveau BANQUE (plus par exercice)
     */
    updateLocalStatsSF(pratiqueData) {
        const exoId = String(pratiqueData.exercice_id);
        const banqueId = String(pratiqueData.banque_id);
        console.log('[SF-OptionB] Mise à jour stats pour banque:', banqueId, 'exercice:', exoId, 'Score:', pratiqueData.score);

        // ========== Mise à jour des stats par BANQUE (nouveau système Option B) ==========
        if (!this.statsSFBanque[banqueId]) {
            this.statsSFBanque[banqueId] = {
                banque_id: banqueId,
                repetitions_validees: 0,
                exercices_reussis: [],
                date_derniere_validation: null,
                total_pratiques: 0
            };
        }

        const statsBanque = this.statsSFBanque[banqueId];
        statsBanque.total_pratiques++;

        // Si répétition validée, mettre à jour la banque
        if (pratiqueData.repetition_validee && !pratiqueData.est_entrainement_libre) {
            statsBanque.repetitions_validees = pratiqueData.nouvelle_repetition;
            statsBanque.date_derniere_validation = new Date().toISOString();

            // Ajouter l'exercice à la liste des réussis (si pas déjà dedans)
            if (!statsBanque.exercices_reussis.includes(exoId)) {
                statsBanque.exercices_reussis.push(exoId);
            }
            console.log('[SF-OptionB] Répétition banque validée!', statsBanque);
        }

        // Sauvegarder stats banque dans le cache
        this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);

        // ========== Mise à jour des stats par exercice (legacy, pour compatibilité) ==========
        if (!this.statsSF[exoId]) {
            this.statsSF[exoId] = {
                exercice_id: exoId,
                banque_id: banqueId,
                total_pratiques: 0,
                pratiques_parfaites: 0,
                repetitions_validees: 0,
                derniere_pratique: null,
                date_derniere_validation: null,
                temps_moyen: 0,
                temps_prevu: pratiqueData.temps_prevu || 0
            };
        }

        const statsExo = this.statsSF[exoId];
        statsExo.total_pratiques++;

        if (pratiqueData.score === 100) {
            statsExo.pratiques_parfaites++;
        }

        // Mettre à jour temps moyen
        const oldTotal = (statsExo.total_pratiques - 1) * statsExo.temps_moyen;
        statsExo.temps_moyen = Math.round((oldTotal + pratiqueData.temps_passe) / statsExo.total_pratiques);
        statsExo.derniere_pratique = new Date().toISOString();

        this.saveHistoriqueSFToCache(this.statsSF);
        console.log('[SF-OptionB] Stats banque:', this.statsSFBanque[banqueId]);
    },

    /**
     * Sauvegarde les stats SF par banque dans le cache local
     */
    saveHistoriqueSFBanqueToCache(statsBanque) {
        try {
            localStorage.setItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY, JSON.stringify({
                data: statsBanque,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[SF] Erreur sauvegarde cache banque:', e);
        }
    },

    /**
     * Charge les stats SF par banque depuis le cache local
     */
    loadHistoriqueSFBanqueFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.data;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    updateLocalResult(newResult) {
        const existingIndex = this.resultats.findIndex(r => r.exercice_id === newResult.exercice_id);
        if (existingIndex >= 0) {
            if (newResult.score > this.resultats[existingIndex].score) {
                this.resultats[existingIndex] = newResult;
            }
        } else {
            this.resultats.push(newResult);
        }
        this.saveResultatsToCache(this.resultats);
    },

    normalizeAnswer(str) {
        return String(str).toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    /**
     * Vérifie si la réponse utilisateur correspond à la réponse correcte
     * Supporte les réponses multiples séparées par | ou ;
     * @param {string} userAnswer - Réponse de l'élève
     * @param {string} correctAnswer - Réponse(s) correcte(s), séparées par | ou ;
     * @returns {boolean} true si la réponse est correcte
     */
    checkAnswerMatch(userAnswer, correctAnswer) {
        const normalizedUser = this.normalizeAnswer(userAnswer);
        if (normalizedUser === '') return false;

        // Séparer les réponses multiples par | ou ;
        const correctOptions = String(correctAnswer).split(/[|;]/).map(opt => this.normalizeAnswer(opt));

        // Vérifier si la réponse utilisateur correspond à l'une des options
        return correctOptions.some(opt => opt !== '' && normalizedUser === opt);
    },

    // ===============================
    // ÉCRAN DE RÉSULTAT SF
    // ===============================

    /**
     * Collecte les détails des réponses utilisateur pour l'écran de résultat
     * @returns {Array} Liste des détails {question, reponseUtilisateur, reponseAttendue, correct}
     */
    collectExerciseDetails() {
        const details = [];
        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }
        const typeUI = structure ? structure.type_ui : 'tableau_saisie';

        if (typeUI === 'carte_cliquable') {
            const marqueurs = this.carteMarqueurs || [];
            const reponses = this.carteReponses || [];
            marqueurs.forEach((m, index) => {
                const userAnswer = reponses[index] || '';
                const correctAnswer = m.reponse || '';
                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                details.push({
                    question: m.question || `Point ${index + 1}`,
                    reponseUtilisateur: userAnswer,
                    reponseAttendue: correctAnswer.split(/[|;]/)[0], // Première option seulement
                    correct: isCorrect
                });
            });
        } else if (typeUI === 'document_mixte') {
            const data = this.mixteData || {};
            if (data.tableau && data.tableau.actif) {
                if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                    this.mixteTableauElements.forEach((el, idx) => {
                        if (el.type === 'row' && el.reponse) {
                            const input = document.getElementById(`mixte_element_${idx}`);
                            const userAnswer = input ? input.value : '';
                            const correctAnswer = el.reponse;
                            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                            details.push({
                                question: el.label || `Ligne ${idx + 1}`,
                                reponseUtilisateur: userAnswer,
                                reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                correct: isCorrect
                            });
                        }
                    });
                } else {
                    const colonnes = this.mixteTableauColonnes || [];
                    const lignes = this.mixteTableauLignes || [];
                    lignes.forEach((ligne, rowIdx) => {
                        colonnes.forEach((col, colIdx) => {
                            if (col.editable) {
                                const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                                const userAnswer = input ? input.value : '';
                                const correctAnswer = ligne.cells[colIdx] || '';
                                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                                details.push({
                                    question: `${col.titre || 'Colonne ' + (colIdx + 1)} - Ligne ${rowIdx + 1}`,
                                    reponseUtilisateur: userAnswer,
                                    reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                    correct: isCorrect
                                });
                            }
                        });
                    });
                }
            }
        } else if (typeUI === 'question_ouverte') {
            // Question ouverte: pas de correction automatique, mais on affiche les réponses
            const questions = this.questionsOuvertes || [];
            questions.forEach((q, qIndex) => {
                (q.etapes || []).forEach((etape, eIndex) => {
                    const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                    const userAnswer = textarea ? textarea.value.trim() : '';
                    details.push({
                        question: etape.question || `Question ${eIndex + 1}`,
                        reponseUtilisateur: userAnswer,
                        reponseAttendue: etape.correction || '(voir corrigé)',
                        correct: null, // Non évaluable automatiquement
                        isOpenQuestion: true
                    });
                });
            });
        } else {
            // Tableau saisie
            let donnees = this.currentExercise.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }
            const colonnes = donnees.colonnes || [];
            const lignes = donnees.lignes || [];
            lignes.forEach((ligne, rowIndex) => {
                const cells = ligne.cells || Object.values(ligne);
                colonnes.forEach((col, colIndex) => {
                    if (col.editable) {
                        const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                        const userAnswer = input ? input.value : '';
                        const correctAnswer = cells[colIndex] || '';
                        const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);

                        // Trouver un libellé pour la question
                        let questionLabel = '';
                        const nonEditableCols = colonnes.filter(c => !c.editable);
                        if (nonEditableCols.length > 0) {
                            const labelColIdx = colonnes.indexOf(nonEditableCols[0]);
                            questionLabel = cells[labelColIdx] || '';
                        }
                        if (!questionLabel) {
                            questionLabel = `Ligne ${rowIndex + 1} - ${col.titre || 'Colonne ' + (colIndex + 1)}`;
                        }

                        details.push({
                            question: questionLabel,
                            reponseUtilisateur: userAnswer,
                            reponseAttendue: correctAnswer.split(/[|;]/)[0],
                            correct: isCorrect
                        });
                    }
                });
            });
        }

        return details;
    },

    /**
     * Affiche l'écran de résultats SF avec 2 blocs (bilan + correction)
     * Système 4 répétitions
     * @param {Object} results - {correct, total, percent, correctedHTML, consigneHTML}
     */
    renderResultScreenSF(results) {
        const container = document.getElementById('exercices-content');
        const exo = this.currentExercise;

        // Calculer le temps passé
        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = exo.duree || 300;
        const tempsOK = timeSpent <= tempsPrevu;

        // Récupérer le résultat de validation (calculé dans saveResult)
        const validationResult = this.lastValidationResult || {
            repetitionValidee: false,
            nouvelleRepetition: 0,
            message: 'Résultat',
            conseil: '',
            estMaitrise: false
        };

        // Déterminer le type de résultat pour le style
        const isSuccess = validationResult.repetitionValidee;
        const resultType = isSuccess ? 'success' : (results.percent === 100 ? 'partial' : 'error');

        // Générer les points de progression (5 dots avec numéros)
        const generateRepDots = () => {
            let html = '<div class="rep-dots">';
            for (let i = 1; i <= this.SEUIL_REPETITIONS; i++) {
                const status = i <= validationResult.nouvelleRepetition ? 'completed' : 'pending';
                html += `<span class="rep-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        // Trouver l'exercice suivant
        const nextExercise = this.findNextExercise();

        // Prochaine date si applicable
        let prochaineDateStr = '';
        if (validationResult.prochaineDispo) {
            prochaineDateStr = new Date(validationResult.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }

        // Collecter les détails de correction
        const correctionDetails = this.collectExerciseDetails();

        // Générer le HTML de correction avec tableau clair montrant réponses élève vs attendues
        const generateCorrectionHTML = () => {
            if (correctionDetails.length === 0) {
                return '<p class="correction-fallback">Correction non disponible.</p>';
            }

            let html = `
                <div class="correction-table-wrapper">
                    <table class="correction-table-display">
                        <thead>
                            <tr>
                                <th class="col-question">Question</th>
                                <th class="col-reponse">Ta réponse</th>
                                <th class="col-attendue">Réponse attendue</th>
                                <th class="col-status">Résultat</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            correctionDetails.forEach((detail) => {
                const isCorrect = detail.correct === true;
                const isOpenQuestion = detail.isOpenQuestion === true;
                const statusClass = isOpenQuestion ? 'open' : (isCorrect ? 'correct' : 'incorrect');
                const statusIcon = isOpenQuestion ? '📝' : (isCorrect ? '✅' : '❌');
                const userAnswer = detail.reponseUtilisateur || '';
                const displayUserAnswer = userAnswer.trim() === '' ? '<span class="empty-answer">Non rempli</span>' : this.escapeHtml(userAnswer);

                html += `
                    <tr class="correction-row ${statusClass}">
                        <td class="col-question">${this.escapeHtml(detail.question)}</td>
                        <td class="col-reponse ${statusClass}">${displayUserAnswer}</td>
                        <td class="col-attendue">${this.escapeHtml(detail.reponseAttendue)}</td>
                        <td class="col-status"><span class="status-icon">${statusIcon}</span></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
            return html;
        };

        container.innerHTML = `
            <div class="result-view sf">
                <button class="exercise-back-btn" onclick="EleveExercices.backToList()">
                    ← Retour aux exercices
                </button>

                <div class="result-card-sf">
                    <!-- BLOC GAUCHE : BILAN -->
                    <div class="result-bilan">
                        <div class="bilan-header ${resultType}">
                            <span class="bilan-icon">${isSuccess ? '✅' : (results.percent === 100 ? '⏱️' : '❌')}</span>
                            <span class="bilan-message">${validationResult.message}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${resultType}">
                                <span class="score-value">${results.percent}%</span>
                            </div>
                            <span class="score-detail">${results.correct}/${results.total}</span>
                        </div>

                        <div class="bilan-temps-compact">
                            <span class="temps-info">⏱️ ${this.formatTime(timeSpent)} / ${this.formatTime(tempsPrevu)}</span>
                            <span class="temps-status ${tempsOK ? 'success' : 'warning'}">${tempsOK ? '✓' : '⚠️'}</span>
                        </div>

                        ${!this.isEntrainementLibre ? `
                        <div class="bilan-repetition-compact">
                            <span class="rep-dots-inline">${generateRepDots()}</span>
                            <span class="rep-label">Niveau ${validationResult.nouvelleRepetition}/${this.SEUIL_REPETITIONS}</span>
                        </div>
                        ` : `
                        <div class="bilan-entrainement-libre-badge">
                            <span class="libre-badge-icon">🔄</span>
                            <span class="libre-badge-text">Entraînement libre</span>
                        </div>
                        <div class="bilan-actions-libre">
                            ${validationResult.scoreEntrainementLibre === 100 ? `
                                <button class="btn btn-primary btn-continuer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                    🔄 Continuer de s'entraîner
                                </button>
                            ` : `
                                <button class="btn btn-primary btn-reessayer-libre" onclick="EleveExercices.restartExercise()">
                                    🔄 Réessayer cet exercice
                                </button>
                            `}
                        </div>
                        `}

                        <!-- Messages -->
                        <div class="bilan-messages">
                            ${validationResult.conseil && !isSuccess && !this.isEntrainementLibre ? `
                                <div class="bilan-conseil warning">
                                    <span class="conseil-icon">💡</span>
                                    <p>${validationResult.conseil}</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && !validationResult.estMaitrise ? `
                                <div class="bilan-prochaine-new">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${validationResult.nouvelleRepetition + 1} !</p>
                                    <p class="prochaine-sub">En attendant, tu peux t'entraîner autant que tu veux</p>
                                    <button class="btn btn-entrainer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                        💪 Continuer à s'entraîner
                                    </button>
                                </div>
                            ` : ''}

                            ${validationResult.estMaitrise ? `
                                <div class="bilan-maitrise">
                                    <span class="maitrise-icon">🎉</span>
                                    <p>Bravo ! Tu maîtrises cette banque !</p>
                                </div>
                            ` : ''}


                            <div class="bilan-actions">
                                ${!isSuccess && !this.isEntrainementLibre ? `
                                    <button class="btn btn-primary btn-restart-sf" onclick="EleveExercices.restartExercise()">
                                        🔄 Réessayer cet exercice
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- BLOC DROITE : CORRECTION (tableau original avec corrections inline) -->
                    <div class="result-correction">
                        <div class="correction-header">
                            <h3>📝 Correction</h3>
                        </div>
                        <div class="correction-content correction-table">
                            <div class="exercise-content">${results.correctedHTML || '<p class="correction-fallback">Correction non disponible.</p>'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Déclencher l'animation de célébration si réussite (pas en entraînement libre)
        if (isSuccess && !this.isEntrainementLibre) {
            // Petit délai pour que le DOM soit rendu
            setTimeout(() => {
                this.triggerCelebration(validationResult.nouvelleRepetition);
            }, 100);
        }

        // Reset le flag entraînement libre
        this.isEntrainementLibre = false;
    },

    /**
     * Toggle l'affichage du corrigé dans l'écran de résultat SF
     */
    toggleCorrige() {
        const wrapper = document.getElementById('correctedContentWrapper');
        const toggle = document.querySelector('.corrected-toggle');
        const icon = toggle ? toggle.querySelector('.toggle-icon') : null;

        if (wrapper) {
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            if (toggle) {
                toggle.innerHTML = isHidden
                    ? '📋 Masquer le corrigé <span class="toggle-icon">▲</span>'
                    : '📋 Voir le corrigé <span class="toggle-icon">▼</span>';
            }
        }
    },

    /**
     * Toggle l'affichage des détails dans l'écran de résultat (ancien)
     */
    toggleResultDetails() {
        const content = document.getElementById('resultDetailsContent');
        const icon = document.querySelector('.result-details .toggle-icon');
        if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            if (icon) icon.textContent = isHidden ? '▲' : '▼';
        }
    },

    /**
     * Trouve l'exercice suivant dans la même banque
     */
    findNextExercise() {
        if (!this.currentExercise || !this.exercices) return null;

        const currentBanqueExercices = this.exercices
            .filter(e => String(e.banque_id) === String(this.currentExercise.banque_id))
            .sort((a, b) => (a.numero || 0) - (b.numero || 0));

        const currentIndex = currentBanqueExercices.findIndex(e => e.id === this.currentExercise.id);
        if (currentIndex >= 0 && currentIndex < currentBanqueExercices.length - 1) {
            return currentBanqueExercices[currentIndex + 1];
        }
        return null;
    },

    /**
     * Recommence l'exercice actuel
     */
    restartExercise() {
        if (this.currentExercise) {
            this.startExercise(this.currentExercise.id);
        }
    },

    /**
     * Lance un exercice aléatoire de la même banque en mode entraînement libre
     */
    startEntrainementLibre() {
        if (!this.currentExercise || !this.exercices) return;

        // Récupérer tous les exercices de la même banque
        const exercicesMêmeBanque = this.exercices.filter(
            e => String(e.banque_id) === String(this.currentExercise.banque_id)
        );

        if (exercicesMêmeBanque.length <= 1) {
            // Si un seul exercice, relancer le même
            this.startExercise(this.currentExercise.id, true);
            return;
        }

        // Exclure l'exercice courant et en choisir un aléatoire
        const autresExercices = exercicesMêmeBanque.filter(
            e => e.id !== this.currentExercise.id
        );
        const exerciceAleatoire = autresExercices[Math.floor(Math.random() * autresExercices.length)];

        this.startExercise(exerciceAleatoire.id, true);
    },

    /**
     * Déclenche une animation de célébration (paillettes/confettis)
     * @param {number} level - Niveau atteint (1-5), détermine l'intensité
     */
    triggerCelebration(level) {
        // Supprimer une célébration existante
        const existing = document.querySelector('.celebration-container');
        if (existing) existing.remove();

        // Créer le conteneur
        const container = document.createElement('div');
        container.className = `celebration-container level-${level}`;
        document.body.appendChild(container);

        // Configuration selon le niveau
        const config = {
            1: { sparkles: 20, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b'] },
            2: { sparkles: 35, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#34d399'] },
            3: { sparkles: 40, confetti: 20, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6'] },
            4: { sparkles: 50, confetti: 40, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            5: { sparkles: 60, confetti: 60, stars: 15, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'] }
        };

        const cfg = config[Math.min(level, 5)] || config[1];

        // Créer les paillettes
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

        // Créer les confettis (niveau 3+)
        for (let i = 0; i < cfg.confetti; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            confetti.style.animationDelay = Math.random() * 0.8 + 's';
            confetti.style.width = (6 + Math.random() * 6) + 'px';
            confetti.style.height = (12 + Math.random() * 10) + 'px';
            container.appendChild(confetti);
        }

        // Créer les étoiles dorées (niveau 5)
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
        setTimeout(() => {
            container.remove();
        }, 5000);
    },

    /**
     * Lance l'exercice suivant
     */
    startNextExercise() {
        const next = this.findNextExercise();
        if (next) {
            this.startExercise(next.id);
        } else {
            this.backToList();
        }
    },

    // ===============================
    // CORRECTIONS
    // ===============================

    /**
     * Applique les corrections sur l'exercice actuel (remplit les bonnes réponses)
     * @param {string} typeUI - Type d'interface de l'exercice
     */
    applyCorrections(typeUI) {
        if (typeUI === 'carte_cliquable') {
            this.showCarteCorrige();
        } else if (typeUI === 'document_mixte') {
            this.showDocumentMixteCorrige();
        } else if (typeUI === 'question_ouverte') {
            this.showQuestionOuverteCorrige();
        } else if (typeUI === 'tableau_saisie' || typeUI === 'document_tableau') {
            this.showTableauCorrige();
        }
    },

    /**
     * Capture le HTML d'un élément en incluant les valeurs actuelles des inputs
     * (innerHTML ne capture pas les valeurs des inputs, seulement les attributs)
     */
    captureContentWithValues(element) {
        if (!element) return '';

        // Cloner l'élément pour ne pas modifier l'original
        const clone = element.cloneNode(true);

        // Pour chaque input dans le clone, mettre la valeur comme attribut
        const originalInputs = element.querySelectorAll('input, textarea');
        const clonedInputs = clone.querySelectorAll('input, textarea');

        originalInputs.forEach((origInput, idx) => {
            const clonedInput = clonedInputs[idx];
            if (clonedInput) {
                // Définir l'attribut value avec la valeur actuelle
                clonedInput.setAttribute('value', origInput.value);
                // Pour les textareas, mettre le contenu
                if (origInput.tagName === 'TEXTAREA') {
                    clonedInput.textContent = origInput.value;
                }
            }
        });

        return clone.innerHTML;
    },

    // ===============================
    // SHOW CORRIGE
    // ===============================

    showCorrige() {
        this.stopTimer(); // Stop timer when showing correction

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }
        const typeUI = structure ? structure.type_ui : 'tableau_saisie';

        this.applyCorrections(typeUI);

        const banner = document.getElementById('resultBanner');
        banner.className = 'result-banner show info';
        banner.textContent = 'Voici le corrigé complet.';
    },

    showCarteCorrige() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];

        marqueurs.forEach((m, index) => {
            const badge = document.getElementById(`badge_${index}`);
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const userAnswer = reponses[index] || '';
            const correctAnswer = m.reponse || '';
            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
            const firstCorrectAnswer = correctAnswer.split(/[|;]/)[0].trim();

            if (badge) {
                // Afficher la bonne réponse dans le badge (toujours en vert)
                badge.textContent = firstCorrectAnswer;
                badge.classList.remove('hidden', 'incorrect');
                badge.classList.add('correction');
            }

            if (marqueur) {
                // Colorer le marqueur selon le résultat
                marqueur.classList.remove('incorrect', 'correct', 'answered');
                marqueur.classList.add('show-correction');
                marqueur.classList.add(isCorrect ? 'correction-correct' : 'correction-incorrect');

                // Stocker les données de correction dans des attributs data
                marqueur.setAttribute('data-user-answer', userAnswer);
                marqueur.setAttribute('data-correct-answer', firstCorrectAnswer);
                marqueur.setAttribute('data-is-correct', isCorrect ? 'true' : 'false');
                marqueur.setAttribute('data-correction-mode', 'true');

                // Changer l'attribut onclick pour le mode correction
                marqueur.setAttribute('onclick', `EleveExercices.openMarqueurCorrectionModal(${index})`);
            }
        });
    },

    /**
     * Ouvre le popup de correction pour un marqueur de carte cliquable
     * @param {number} index - Index du marqueur
     */
    openMarqueurCorrectionModal(index) {
        // Récupérer les données depuis les attributs du marqueur
        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (!marqueur || marqueur.getAttribute('data-correction-mode') !== 'true') {
            // Si pas en mode correction, ouvrir le modal normal
            this.openMarqueurModal(index);
            return;
        }

        const userAnswer = marqueur.getAttribute('data-user-answer') || '';
        const correctAnswer = marqueur.getAttribute('data-correct-answer') || '';
        const isCorrect = marqueur.getAttribute('data-is-correct') === 'true';
        const hasAnswer = userAnswer.trim() !== '';

        // Construire le contenu du popup
        let bodyHTML = '';

        if (isCorrect) {
            // Réponse correcte : un seul encart vert
            bodyHTML = `
                <div class="correction-answer correct">
                    <span class="answer-text">${this.escapeHtml(userAnswer)}</span>
                    <span class="answer-icon">✓</span>
                </div>
            `;
        } else {
            // Réponse incorrecte ou non répondue
            bodyHTML = `
                <div class="correction-answer incorrect">
                    <span class="answer-text">${hasAnswer ? this.escapeHtml(userAnswer) : 'Non répondu'}</span>
                    <span class="answer-icon">✗</span>
                </div>
                <div class="correction-answer expected">
                    <span class="answer-text">Réponse correcte : ${this.escapeHtml(correctAnswer)}</span>
                </div>
            `;
        }

        // Mettre à jour le modal
        const modal = document.getElementById('marqueurModal');
        if (modal) {
            document.getElementById('modalMarqueurNum').textContent = index + 1;

            // Remplacer le body du modal par le contenu de correction
            const modalBody = modal.querySelector('.carte-modal-body');
            if (modalBody) {
                modalBody.innerHTML = bodyHTML;
            }

            // Cacher le footer (pas de boutons Annuler/Valider en mode correction)
            const modalFooter = modal.querySelector('.carte-modal-footer');
            if (modalFooter) {
                modalFooter.style.display = 'none';
            }

            modal.classList.remove('hidden');
        }
    },

    showQuestionOuverteCorrige() {
        const questions = this.questionsOuvertes || [];
        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.remove('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) textarea.disabled = true;
            });
        });
    },

    showDocumentMixteCorrige() {
        const data = this.mixteData || {};
        const container = document.querySelector('.document-mixte-container');

        // Récupérer le contenu du document avant de le masquer
        const docSection = document.querySelector('.mixte-document') || document.querySelector('.mixte-left-column');
        let documentHTML = '';
        if (docSection) {
            documentHTML = docSection.innerHTML;
            // Supprimer complètement la section document du layout
            docSection.remove();
        }

        // Passer le container en layout vertical pleine largeur
        if (container) {
            container.classList.remove('horizontal-layout');
            container.classList.add('correction-fullwidth');

            // Créer le bouton "Voir le document" et le modal s'ils n'existent pas
            if (documentHTML && !document.getElementById('toggleDocumentBtn')) {
                // Bouton pour ouvrir le modal
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'toggleDocumentBtn';
                toggleBtn.className = 'btn-toggle-document';
                toggleBtn.innerHTML = '📄 Voir le document';
                toggleBtn.setAttribute('onclick', 'EleveExercices.openDocumentModal()');
                container.insertBefore(toggleBtn, container.firstChild);

                // Modal pour le document
                const modal = document.createElement('div');
                modal.id = 'documentModal';
                modal.className = 'document-modal-overlay hidden';
                modal.innerHTML = `
                    <div class="document-modal">
                        <div class="document-modal-header">
                            <h3>📄 Document</h3>
                            <button class="document-modal-close" onclick="EleveExercices.closeDocumentModal()">×</button>
                        </div>
                        <div class="document-modal-body">
                            ${documentHTML}
                        </div>
                    </div>
                `;
                container.appendChild(modal);
            }
        }

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
            this.mixteTableauElements.forEach((el, idx) => {
                if (el.type === 'row' && el.reponse) {
                    const input = document.getElementById(`mixte_element_${idx}`);
                    if (input) {
                        const userAnswer = input.value.trim();
                        const correctAnswerRaw = el.reponse;
                        const firstCorrectAnswer = correctAnswerRaw.split(/[|;]/)[0].trim();
                        const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswerRaw);

                        // Garder la réponse de l'élève et colorer selon le résultat
                        input.classList.remove('incorrect', 'correct');
                        input.classList.add(isCorrect ? 'correct' : 'incorrect');
                        input.disabled = true;

                        // Si non répondu, afficher un placeholder
                        if (!userAnswer) {
                            input.value = '(non répondu)';
                            input.classList.add('empty-answer');
                        }

                        // Si incorrect, afficher la bonne réponse en dessous
                        if (!isCorrect) {
                            const correctionDiv = document.createElement('div');
                            correctionDiv.className = 'correction-expected-below';
                            correctionDiv.innerHTML = `Réponse : ${this.escapeHtml(firstCorrectAnswer)}`;
                            input.parentNode.appendChild(correctionDiv);
                        }
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) textarea.disabled = true;
                if (correctionDiv && q.reponse_attendue) {
                    // Prendre uniquement la première réponse acceptable
                    const firstAnswer = q.reponse_attendue.split(/[|;]/)[0].trim();
                    correctionDiv.innerHTML = `<strong>Réponse attendue :</strong> ${this.escapeHtml(firstAnswer)}`;
                    correctionDiv.style.display = 'block';
                }
            });
        }
    },

    /**
     * Ouvre le modal avec le document
     */
    openDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    /**
     * Ferme le modal du document
     */
    closeDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    showTableauCorrige() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((ligne, rowIdx) => {
            colonnes.forEach((col, colIdx) => {
                if (col.editable) {
                    const input = document.getElementById(`input_${rowIdx}_${colIdx}`);
                    if (input) {
                        const fullAnswer = ligne.cells[colIdx] || '';
                        const firstAnswer = fullAnswer.split(/[|;]/)[0].trim();
                        const userAnswer = input.value.trim();
                        const isCorrect = input.classList.contains('correct');
                        const isEmpty = userAnswer === '';

                        // Créer un conteneur pour remplacer l'input
                        const correctionCell = document.createElement('div');
                        correctionCell.className = 'correction-cell';

                        if (isCorrect) {
                            // Réponse correcte : fond vert
                            correctionCell.classList.add('correct');
                            correctionCell.innerHTML = `<span class="answer-text">${this.escapeHtml(userAnswer)}</span>`;
                        } else {
                            // Incorrect ou vide : fond rouge avec la bonne réponse
                            correctionCell.classList.add('incorrect');
                            if (isEmpty) {
                                // Pas de réponse : juste la bonne réponse
                                correctionCell.innerHTML = `<span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>`;
                            } else {
                                // Mauvaise réponse : réponse barrée + bonne réponse
                                correctionCell.innerHTML = `
                                    <span class="wrong-answer">${this.escapeHtml(userAnswer)}</span>
                                    <span class="arrow">→</span>
                                    <span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>
                                `;
                            }
                        }

                        // Remplacer l'input par le conteneur de correction
                        input.parentNode.replaceChild(correctionCell, input);
                    }
                }
            });
        });
    },

    // ===============================
    // RESET
    // ===============================

    resetExercise() {
        if (!this.currentExercise) return;

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';

        if (typeUI === 'carte_cliquable') {
            this.resetCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            this.resetQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            this.resetDocumentMixte();
        } else {
            this.resetTableauSaisie();
        }

        // Hide result banner
        document.getElementById('resultBanner').className = 'result-banner';

        // Reset start time for tracking
        this.exerciseStartTime = Date.now();

        // Restart timer
        if (this.currentExercise.duree) {
            this.startTimer(this.currentExercise.duree);
        }

        // Réinitialiser l'état des boutons
        const btnCorrige = document.getElementById('btnCorrige');
        const btnRestart = document.getElementById('btnRestart');
        const btnVerifier = document.getElementById('btnVerifier');

        if (btnCorrige) btnCorrige.style.display = 'none';
        if (btnRestart) btnRestart.style.display = 'none';
        if (btnVerifier) btnVerifier.textContent = 'Vérifier mes réponses';
    },

    resetDocumentMixte() {
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
            this.mixteTableauElements.forEach((el, idx) => {
                if (el.type === 'row') {
                    const input = document.getElementById(`mixte_element_${idx}`);
                    if (input) {
                        input.value = '';
                        input.className = 'cell-input';
                        input.disabled = false;
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
                if (correctionDiv) {
                    correctionDiv.style.display = 'none';
                    correctionDiv.innerHTML = '';
                }
            });
        }
    },

    resetTableauSaisie() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((_, rowIndex) => {
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    const correction = document.getElementById(`correction_${rowIndex}_${colIndex}`);
                    if (input) {
                        input.value = '';
                        input.className = '';
                        input.disabled = false;
                    }
                    if (correction) correction.textContent = '';
                }
            });
        });
    },

    resetCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        this.carteReponses = new Array(marqueurs.length).fill('');

        marqueurs.forEach((_, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            if (badge) {
                badge.textContent = '';
                badge.classList.add('hidden');
                badge.classList.remove('correct', 'incorrect', 'correction');
            }
            if (marqueur) {
                marqueur.classList.remove('correct', 'incorrect', 'answered', 'show-correction');
                marqueur.style.pointerEvents = '';
            }
        });
    },

    resetQuestionOuverte() {
        const questions = this.questionsOuvertes || [];

        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.add('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
            });
        });
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

    // ===============================
    // TACHES COMPLEXES (Compétences)
    // ===============================

    // Data for tâches complexes
    tachesComplexes: [],
    competencesReferentiel: [],
    criteresReussite: [],
    eleveTachesProgress: [],
    currentTacheComplexe: null,
    tacheTimer: null,
    tacheTimeRemaining: 0,

    async initCompetences() {
        this.showLoader('Chargement des taches complexes...');
        try {
            // Load tâches complexes, referentiel, critères and student progress in parallel
            const [tachesResult, compRefResult, criteresResult, progressResult] = await Promise.all([
                this.callAPI('getTachesComplexes', {}),
                this.callAPI('getCompetencesReferentiel', {}),
                this.callAPI('getCriteresReussite', {}),
                this.currentUser ? this.callAPI('getEleveTachesComplexes', { eleve_id: this.currentUser.id }) : { success: true, data: [] }
            ]);

            if (tachesResult.success) {
                this.tachesComplexes = (tachesResult.data || []).filter(t => t.statut === 'publie');
            }
            if (compRefResult.success) {
                this.competencesReferentiel = compRefResult.data || [];
            }
            if (criteresResult.success) {
                this.criteresReussite = criteresResult.data || [];
            }
            if (progressResult.success) {
                this.eleveTachesProgress = progressResult.data || [];
            }

            this.renderTachesComplexesList();
        } catch (error) {
            console.error('Erreur chargement taches complexes:', error);
            this.showError('Erreur lors du chargement des taches complexes');
        }
    },

    renderTachesComplexesList() {
        const container = document.getElementById('exercices-content');

        // Calculate stats
        const totalTaches = this.tachesComplexes.length;
        const completedTaches = this.eleveTachesProgress.filter(p => p.statut === 'termine').length;
        const progressPercent = totalTaches > 0 ? Math.round((completedTaches / totalTaches) * 100) : 0;

        if (totalTaches === 0) {
            container.innerHTML = `
                <div class="type-header-banner competences">
                    <div class="type-header-left">
                        <div class="type-icon-emoji">🎯</div>
                        <div>
                            <h2 class="type-title">Entraînement de compétences</h2>
                        </div>
                    </div>
                </div>
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h3>Aucun entrainement disponible</h3>
                    <p>Les entrainements de competences seront bientot disponibles.</p>
                </div>
            `;
            return;
        }

        // Sort by ordre
        this.tachesComplexes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        container.innerHTML = `
            <div class="type-header-banner competences">
                <div class="type-header-left">
                    <div class="type-icon-emoji">🎯</div>
                    <div>
                        <h2 class="type-title">Entraînement de compétences</h2>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat">
                        <div class="type-stat-value">${totalTaches}</div>
                        <div class="type-stat-label">Tâches</div>
                    </div>
                </div>
            </div>

            <div class="training-toolbar">
                <div class="global-progress">
                    <div class="global-progress-label">
                        <span>Progression globale</span>
                        <span class="global-progress-value">${completedTaches}/${totalTaches} tâches terminées</span>
                    </div>
                    <div class="global-progress-bar competences">
                        <div class="global-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>

            <div class="taches-complexes-grid">
                ${this.tachesComplexes.map(tache => this.renderTacheComplexeCard(tache)).join('')}
            </div>
        `;
    },

    renderTacheComplexeCard(tache) {
        // Get student progress for this tache
        const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);

        // Parse competences
        const compIds = (tache.competences_ids || '').split(',').filter(id => id.trim());
        const competences = compIds.map(id => {
            const comp = this.competencesReferentiel.find(c => c.id === id.trim());
            return comp ? comp.nom : null;
        }).filter(Boolean);

        const dureeMin = Math.round((tache.duree || 2700) / 60);

        let statusBadge = '';
        let actionButton = '';

        if (progress) {
            if (progress.statut === 'termine') {
                if (progress.mode === 'entrainement') {
                    statusBadge = '<span class="tache-status entrainement">Termine (entrainement)</span>';
                    actionButton = tache.correction_url
                        ? `<a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-secondary">Voir la correction</a>`
                        : '<span class="no-correction">Correction non disponible</span>';
                } else {
                    statusBadge = '<span class="tache-status points-bonus">Rendu pour points bonus</span>';
                    actionButton = '<span class="attente-correction">En attente de correction</span>';
                }
            } else {
                // En cours
                statusBadge = '<span class="tache-status en-cours">En cours</span>';
                actionButton = `<button class="btn btn-primary" onclick="EleveExercices.resumeTacheComplexe('${tache.id}')">Reprendre</button>`;
            }
        } else {
            // Not started
            actionButton = `<button class="btn btn-primary" onclick="EleveExercices.openTacheChoiceModal('${tache.id}')">Commencer</button>`;
        }

        return `
            <div class="tache-complexe-card" data-id="${tache.id}">
                <div class="tache-card-header">
                    <div class="tache-card-icon">&#128995;</div>
                    <div class="tache-card-info">
                        <h3 class="tache-card-title">${this.escapeHtml(tache.titre)}</h3>
                        ${statusBadge}
                    </div>
                    <div class="tache-card-duration">
                        <span class="duration-icon">&#9202;</span>
                        <span>${dureeMin} min</span>
                    </div>
                </div>
                ${tache.description ? `<p class="tache-card-description">${this.escapeHtml(tache.description)}</p>` : ''}
                <div class="tache-card-competences">
                    <strong>Competences evaluees :</strong>
                    <ul>
                        ${competences.map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}
                    </ul>
                </div>
                <div class="tache-card-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    },

    openTacheChoiceModal(tacheId) {
        // Prevent multiple modals
        const existingModal = document.getElementById('tacheChoiceModal');
        if (existingModal) existingModal.remove();

        const tache = this.tachesComplexes.find(t => t.id === tacheId);
        if (!tache) return;

        this.currentTacheComplexe = tache;
        const dureeMin = Math.round((tache.duree || 2700) / 60);

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'tacheChoiceModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-choice">
                <div class="modal-header">
                    <h2>Choisissez votre mode</h2>
                    <button class="modal-close" onclick="EleveExercices.closeTacheChoiceModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tache-choice-info">
                        <h3>${this.escapeHtml(tache.titre)}</h3>
                        <p class="tache-choice-duration">Duree : <strong>${dureeMin} minutes</strong></p>
                    </div>

                    <div class="tache-choice-options">
                        <div class="choice-option" onclick="EleveExercices.startTacheComplexe('points_bonus')">
                            <div class="choice-icon">&#127919;</div>
                            <div class="choice-content">
                                <h4>Rendre pour points bonus</h4>
                                <p>Faites le travail seul(e). Vous pourrez rendre votre copie au professeur pour obtenir des points bonus.</p>
                                <p class="choice-warning">Vous ne pourrez pas voir la correction.</p>
                            </div>
                        </div>

                        <div class="choice-option" onclick="EleveExercices.startTacheComplexe('entrainement')">
                            <div class="choice-icon">&#128218;</div>
                            <div class="choice-content">
                                <h4>M'entrainer</h4>
                                <p>Faites le travail pour vous entrainer. Vous pourrez voir la correction a la fin.</p>
                                <p class="choice-warning">Vous ne pourrez pas demander de points bonus.</p>
                            </div>
                        </div>
                    </div>

                    <p class="choice-note"><strong>Attention :</strong> Ce choix est definitif et ne peut pas etre modifie.</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    },

    closeTacheChoiceModal() {
        const modal = document.getElementById('tacheChoiceModal');
        if (modal) modal.remove();
        this.currentTacheComplexe = null;
        document.body.style.overflow = '';
    },

    async startTacheComplexe(mode) {
        if (!this.currentTacheComplexe) return;

        const tache = this.currentTacheComplexe;

        // Check if user is connected (allow preview mode for admin)
        if (!this.currentUser) {
            // Preview mode - skip API call, just show exercise
            this.closeTacheChoiceModal();
            this.showTacheComplexeExercise(tache, mode);
            return;
        }

        // Register choice in database
        try {
            const result = await this.callAPI('startEleveTacheComplexe', {
                eleve_id: this.currentUser.id,
                tache_id: tache.id,
                mode: mode
            });

            if (!result.success) {
                if (result.existing) {
                    alert('Vous avez deja fait un choix pour cette tache.');
                    this.closeTacheChoiceModal();
                    this.initCompetences(); // Refresh
                    return;
                }
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
                return;
            }

            // Add to local progress
            this.eleveTachesProgress.push({
                eleve_id: this.currentUser.id,
                tache_id: tache.id,
                mode: mode,
                statut: 'en_cours',
                date_debut: new Date().toISOString()
            });

            this.closeTacheChoiceModal();
            this.showTacheComplexeExercise(tache, mode);
        } catch (error) {
            console.error('Erreur demarrage tache:', error);
            alert('Erreur lors du demarrage');
        }
    },

    resumeTacheComplexe(tacheId) {
        const tache = this.tachesComplexes.find(t => t.id === tacheId);
        const progress = this.eleveTachesProgress.find(p => p.tache_id === tacheId);
        if (!tache || !progress) return;

        this.showTacheComplexeExercise(tache, progress.mode);
    },

    showTacheComplexeExercise(tache, mode) {
        const container = document.getElementById('exercices-content');
        const duree = tache.duree || 2700;
        this.tacheTimeRemaining = duree;
        this.currentTacheComplexe = tache;
        this.currentTacheMode = mode;

        // Parse competences with full data and their individual criteria
        const compIds = (tache.competences_ids || '').split(',').filter(id => id.trim());
        const competences = compIds.map(id => {
            const comp = this.competencesReferentiel.find(c => c.id === id.trim());
            if (!comp) return null;
            // Get criteria for this competence, sorted by ordre
            const criteres = this.criteresReussite
                .filter(cr => cr.competence_id === comp.id)
                .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
            return { id: comp.id, nom: comp.nom, description: comp.description || '', criteres };
        }).filter(Boolean);

        // Generate competences list with expandable criteria
        const competencesHTML = competences.map((c, index) => {
            const hasCriteria = c.criteres && c.criteres.length > 0;
            const criteriaHTML = hasCriteria
                ? `<ul class="criteria-list">${c.criteres.map(cr => `<li>${this.escapeHtml(cr.libelle)}</li>`).join('')}</ul>`
                : (c.description ? this.formatCriteria(c.description) : '');
            const showExpand = hasCriteria || c.description;

            return `
                <div class="competence-item-v2">
                    <div class="competence-header-v2" onclick="EleveExercices.toggleCompetenceCriteria(${index})">
                        <span class="competence-bullet">●</span>
                        <span class="competence-name-v2">${this.escapeHtml(c.nom)}</span>
                        ${showExpand ? `<span class="competence-chevron" id="compExpand${index}">▼</span>` : ''}
                    </div>
                    ${showExpand ? `
                        <div class="competence-criteria-v2 hidden" id="compCriteria${index}">
                            ${criteriaHTML}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Convert document URL for iframe embedding
        const iframeUrl = this.getEmbedUrl(tache.document_url);

        // Correction button for training mode
        const correctionBtn = mode === 'entrainement' ? `
            <div class="correction-section">
                ${tache.correction_url
                    ? `<a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-correction">
                        📝 Voir la correction
                       </a>`
                    : `<button class="btn btn-correction-disabled" disabled>
                        📝 Correction non disponible
                       </button>`
                }
            </div>
        ` : '';

        container.innerHTML = `
            <div class="tache-exercise-view-v3">
                <button class="exercise-back-btn" onclick="EleveExercices.backToCompetencesList()">
                    ← Retour aux entrainements
                </button>

                <div class="exercise-card-v3">
                    <div class="exercise-header competences">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${this.escapeHtml(tache.titre)}</h1>
                                <div class="exercise-header-meta">
                                    <span class="mode-badge-inline ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Evaluation - Points bonus'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="tacheTimer">
                            <span class="timer-icon">⏱</span>
                            <span id="timerDisplay">${this.formatTime(this.tacheTimeRemaining)}</span>
                        </div>
                    </div>

                    ${tache.description ? `
                        <div class="consigne-box">
                            <div class="consigne-label">CONSIGNE</div>
                            <div class="consigne-text">${this.escapeHtml(tache.description)}</div>
                        </div>
                    ` : ''}

                    <div class="tache-layout-v3">
                        <div class="document-section">
                            <div class="document-toolbar">
                                <span class="document-title">Document</span>
                                <div class="document-actions-v3">
                                    <a href="${this.escapeHtml(tache.document_url)}" download class="doc-btn" title="Télécharger">
                                        ⬇️
                                    </a>
                                    <button class="doc-btn" onclick="EleveExercices.toggleFullscreen()" title="Plein écran">
                                        ⛶
                                    </button>
                                    <a href="${this.escapeHtml(tache.document_url)}" target="_blank" class="doc-btn" title="Nouvel onglet">
                                        ↗️
                                    </a>
                                </div>
                            </div>
                            <div class="document-frame-wrapper" id="documentWrapper">
                                <iframe src="${iframeUrl}" class="document-frame" id="documentIframe" allowfullscreen></iframe>
                            </div>
                        </div>

                        <div class="sidebar-section">
                            <div class="sidebar-panel competences-panel-v2">
                                <h3>Compétences évaluées</h3>
                                <p class="panel-hint">Cliquez pour voir les critères</p>
                                <div class="competences-list-v2">
                                    ${competencesHTML}
                                </div>
                            </div>

                            ${correctionBtn}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Start timer
        this.startTacheTimer();
    },

    formatCriteria(description) {
        // Split by line breaks or dashes to create list items
        const lines = description.split(/[\n\r]+|(?=\s*-\s)/).filter(line => line.trim());
        if (lines.length <= 1) {
            return `<div class="criteria-text">${this.escapeHtml(description)}</div>`;
        }
        return `<ul class="criteria-list">
            ${lines.map(line => {
                const cleanLine = line.replace(/^[\s-]+/, '').trim();
                return cleanLine ? `<li>${this.escapeHtml(cleanLine)}</li>` : '';
            }).join('')}
        </ul>`;
    },

    toggleFullscreen() {
        const wrapper = document.getElementById('documentWrapper');
        if (wrapper) {
            wrapper.classList.toggle('fullscreen');
            document.body.classList.toggle('document-fullscreen-active');
        }
    },

    toggleCompetenceCriteria(index) {
        const criteria = document.getElementById(`compCriteria${index}`);
        const expand = document.getElementById(`compExpand${index}`);
        if (criteria) {
            criteria.classList.toggle('hidden');
            if (expand) {
                expand.innerHTML = criteria.classList.contains('hidden') ? '&#9660;' : '&#9650;';
            }
        }
    },

    getEmbedUrl(url) {
        if (!url) return '';

        // Publuu flip-book - convert to embed URL
        if (url.includes('publuu.com/flip-book')) {
            // Format: https://publuu.com/flip-book/USER_ID/BOOK_ID
            // Embed: https://publuu.com/flip-book/USER_ID/BOOK_ID/page/1?embed
            const match = url.match(/publuu\.com\/flip-book\/(\d+)\/(\d+)/);
            if (match) {
                return `https://publuu.com/flip-book/${match[1]}/${match[2]}/page/1?embed`;
            }
            // Already has page number, just add ?embed if missing
            if (!url.includes('?embed')) {
                return url + (url.includes('/page/') ? '?embed' : '/page/1?embed');
            }
            return url;
        }

        // Google Drive file - convert to embed URL
        if (url.includes('drive.google.com')) {
            // Handle /file/d/ format
            const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) {
                return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
            }
            // Handle ?id= format
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
            }
        }
        // Google Docs/Slides/Sheets - convert to embed
        if (url.includes('docs.google.com')) {
            if (url.includes('/edit') || url.includes('/view')) {
                return url.replace(/\/(edit|view).*$/, '/preview');
            }
            return url + '/preview';
        }
        // PDF direct URL - use Google Docs viewer
        if (url.toLowerCase().endsWith('.pdf')) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }
        // Default - try direct embed
        return url;
    },

    backToCompetencesList() {
        if (this.tacheTimer) {
            clearInterval(this.tacheTimer);
            this.tacheTimer = null;
        }
        this.currentTacheComplexe = null;
        this.initCompetences();
    },

    startTacheTimer() {
        if (this.tacheTimer) clearInterval(this.tacheTimer);
        this.timerExpiredShown = false;

        this.tacheTimer = setInterval(() => {
            this.tacheTimeRemaining--;
            const timerEl = document.getElementById('tacheTimer');
            const timerDisplay = document.getElementById('timerDisplay');

            if (timerDisplay) {
                // Show negative time for training mode
                if (this.tacheTimeRemaining < 0 && this.currentTacheMode === 'entrainement') {
                    timerDisplay.textContent = '+' + this.formatTime(Math.abs(this.tacheTimeRemaining));
                } else {
                    timerDisplay.textContent = this.formatTime(Math.max(0, this.tacheTimeRemaining));
                }
            }
            if (timerEl) {
                if (this.tacheTimeRemaining <= 300 && this.tacheTimeRemaining > 60) {
                    timerEl.classList.add('warning');
                    timerEl.classList.remove('danger');
                }
                if (this.tacheTimeRemaining <= 60) {
                    timerEl.classList.add('danger');
                    timerEl.classList.remove('warning');
                }
                if (this.tacheTimeRemaining < 0) {
                    timerEl.classList.add('overtime');
                }
            }

            if (this.tacheTimeRemaining <= 0 && !this.timerExpiredShown) {
                this.timerExpiredShown = true;

                if (this.currentTacheMode === 'points_bonus') {
                    // Points bonus mode: BLOCK and redirect
                    clearInterval(this.tacheTimer);
                    this.tacheTimer = null;
                    this.showTimeExpiredPointsBonus();
                } else {
                    // Training mode: Just show a non-blocking notification
                    this.showTimerExpiredNotification();
                    // Timer continues counting in overtime
                }
            }
        }, 1000);
    },

    showTimerExpiredNotification() {
        // Create a non-blocking notification for training mode
        const notification = document.createElement('div');
        notification.className = 'timer-notification';
        notification.innerHTML = `
            <div class="timer-notification-content">
                <span class="notification-icon">⏱</span>
                <span>Temps écoulé ! Vous pouvez continuer à travailler.</span>
                <button onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },

    async showTimeExpiredPointsBonus() {
        const tache = this.currentTacheComplexe;

        // Submit for correction in database if user is connected
        if (tache && this.currentUser) {
            try {
                // Calculate time spent (total duration since timer counts down from duree)
                const duree = tache.duree || 2700;
                const tempsPasse = duree; // Full duration for points bonus mode

                await this.callAPI('submitEleveTacheComplexe', {
                    eleve_id: this.currentUser.id,
                    tache_id: tache.id,
                    temps_passe: tempsPasse
                });

                const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);
                if (progress) {
                    progress.statut = 'soumis';
                    progress.date_soumission = new Date().toISOString();
                }
            } catch (error) {
                console.error('Erreur soumission tache:', error);
            }
        }

        // Show blocking screen for points bonus mode
        const container = document.getElementById('exercices-content');

        container.innerHTML = `
            <div class="tache-timeup-view points-bonus-expired">
                <div class="timeup-icon">⏰</div>
                <h2>Temps écoulé !</h2>
                <h3>${tache ? this.escapeHtml(tache.titre) : ''}</h3>
                <div class="timeup-mode">
                    <span class="mode-badge points_bonus">Évaluation - Points bonus</span>
                </div>

                <div class="timeup-content">
                    <p class="important-message">L'épreuve est terminée. Vous devez maintenant rendre votre travail.</p>

                    <div class="submit-instructions">
                        <h3>📤 Comment rendre votre travail ?</h3>
                        <div class="submit-options">
                            <div class="submit-option">
                                <span class="submit-icon">📧</span>
                                <div>
                                    <strong>Par mail (format numérique)</strong>
                                    <p>Envoyez votre travail <strong>dans les 30 minutes</strong></p>
                                </div>
                            </div>
                            <div class="submit-option">
                                <span class="submit-icon">📄</span>
                                <div>
                                    <strong>En format papier</strong>
                                    <p>Déposez votre copie <strong>dans le casier du professeur le lendemain</strong></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p class="info-note">✅ Votre participation a été enregistrée.</p>
                    <p class="info-note secondary">Une fois votre copie corrigée, vous pourrez accéder au mode "Entraînement" pour cette tâche.</p>
                </div>

                <div class="timeup-actions">
                    <button class="btn btn-primary" onclick="EleveExercices.initCompetences()">
                        Retour aux entraînements
                    </button>
                </div>
            </div>
        `;
    },

    async showTimeExpired() {
        const tache = this.currentTacheComplexe;
        const mode = this.currentTacheMode || 'entrainement';

        // Update in database if user is connected
        if (tache && this.currentUser) {
            try {
                await this.callAPI('finishEleveTacheComplexe', {
                    eleve_id: this.currentUser.id,
                    tache_id: tache.id
                });

                const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);
                if (progress) {
                    progress.statut = 'termine';
                    progress.date_fin = new Date().toISOString();
                }
            } catch (error) {
                console.error('Erreur fin tache:', error);
            }
        }

        // Show time expired screen
        const container = document.getElementById('exercices-content');

        let submitInstructions = '';
        if (mode === 'points_bonus') {
            submitInstructions = `
                <div class="submit-instructions">
                    <h3>Comment rendre votre travail ?</h3>
                    <div class="submit-options">
                        <div class="submit-option">
                            <span class="submit-icon">&#128233;</span>
                            <div>
                                <strong>Par messagerie (format numerique)</strong>
                                <p>Envoyez votre travail dans les 30 minutes</p>
                            </div>
                        </div>
                        <div class="submit-option">
                            <span class="submit-icon">&#128196;</span>
                            <div>
                                <strong>En format papier</strong>
                                <p>Remettez votre copie a la prochaine seance</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="tache-timeup-view">
                <div class="timeup-icon">&#9200;</div>
                <h2>Temps ecoule !</h2>
                <h3>${tache ? this.escapeHtml(tache.titre) : ''}</h3>
                <div class="timeup-mode">
                    Mode : <span class="mode-badge ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Evaluation - Points bonus'}</span>
                </div>

                ${mode === 'entrainement' ? `
                    <div class="timeup-content">
                        <p>L'entrainement est termine. Vous pouvez consulter la correction.</p>
                        ${tache && tache.correction_url ? `
                            <a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-primary btn-large">
                                Voir la correction
                            </a>
                        ` : '<p class="no-correction">La correction n\'est pas encore disponible.</p>'}
                    </div>
                ` : `
                    <div class="timeup-content">
                        <p>L'epreuve est terminee. Vous devez maintenant rendre votre travail au professeur.</p>
                        ${submitInstructions}
                        <p class="info-note">Votre participation a ete enregistree.</p>
                    </div>
                `}

                <div class="timeup-actions">
                    <button class="btn btn-secondary" onclick="EleveExercices.initCompetences()">
                        Retour aux entrainements
                    </button>
                </div>
            </div>
        `;
    },

    showTacheComplexeComplete(tache, mode) {
        // This is now only called for preview mode or legacy
        const container = document.getElementById('exercices-content');

        let resultContent = '';
        if (mode === 'entrainement') {
            resultContent = `
                <p>Vous pouvez maintenant consulter la correction.</p>
                ${tache.correction_url ? `
                    <a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-primary btn-large">
                        Voir la correction
                    </a>
                ` : '<p class="no-correction">La correction n\'est pas encore disponible.</p>'}
            `;
        } else {
            resultContent = `
                <p>Rendez votre copie au professeur pour obtenir vos points bonus.</p>
                <p class="info-note">Votre participation a ete enregistree.</p>
            `;
        }

        container.innerHTML = `
            <div class="tache-complete-view">
                <div class="complete-icon">&#10004;</div>
                <h2>Travail termine !</h2>
                <h3>${this.escapeHtml(tache.titre)}</h3>
                <div class="complete-mode">
                    Mode : <span class="mode-badge ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Points bonus'}</span>
                </div>
                <div class="complete-content">
                    ${resultContent}
                </div>
                <div class="complete-actions">
                    <button class="btn btn-secondary" onclick="EleveExercices.initCompetences()">
                        Retour aux taches
                    </button>
                </div>
            </div>
        `;
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

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
