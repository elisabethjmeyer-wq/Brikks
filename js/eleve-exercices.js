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
