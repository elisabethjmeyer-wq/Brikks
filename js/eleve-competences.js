/**
 * Module Élève — Entraînement de compétences
 * Navigation 3 niveaux : liste → détail compétence → exercice
 *
 * Fichier principal : init, data, navigation, rendu liste & détail
 * Voir eleve-competences-exercice.js pour la vue exercice, timer, corrigé
 */

const EleveCompetences = {
    // Données
    competences: [],      // CompetencesReferentiel (toutes, pour lookup)
    criteres: [],         // CriteresReussite
    banques: [],          // BanquesCompetences (publiées uniquement)
    entrainements: [],    // EntrainementsCompetences (publiés uniquement)
    progressions: [],     // EleveEntrainementsCompetences (pour l'élève courant)
    currentUser: null,

    // Navigation
    currentView: 'list',  // 'list' | 'detail' | 'exercise'
    currentCompetence: null,
    currentBanque: null,
    currentEntrainement: null,
    currentMode: null,     // 'entrainement' | 'evalue'

    // Timer (géré dans eleve-competences-exercice.js)
    timer: null,
    timeRemaining: 0,
    exerciseStartTime: null,

    // Cache (5 min TTL)
    CACHE_KEY: 'brikks_competences_eleve_cache',
    CACHE_TTL: 5 * 60 * 1000,

    // ==========================================
    // INIT
    // ==========================================

    async init() {
        this.currentUser = await this.getCurrentUser();

        const cached = this.loadFromCache();
        if (cached) {
            this.competences = cached.competences || [];
            this.criteres = cached.criteres || [];
            this.banques = cached.banques || [];
            this.entrainements = cached.entrainements || [];
            this.progressions = cached.progressions || [];
            this.renderCompetencesList();
            this.refreshDataInBackground();
        } else {
            this.showLoader('Chargement des compétences...');
            try {
                await this.loadAllData();
                this.renderCompetencesList();
            } catch (error) {
                console.error('Erreur chargement compétences:', error);
                this.showError('Erreur lors du chargement des compétences');
            }
        }
    },

    async getCurrentUser() {
        try {
            const userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER);
            if (userData) return JSON.parse(userData);
            return null;
        } catch (e) {
            return null;
        }
    },

    // ==========================================
    // CHARGEMENT DES DONNÉES
    // ==========================================

    async loadAllData() {
        const promises = [
            this.callAPI('getCompetencesReferentiel', {}),
            this.callAPI('getCriteresReussite', {}),
            this.callAPI('getBanquesCompetences', {}),
            this.callAPI('getEntrainementsCompetences', {})
        ];

        if (this.currentUser) {
            promises.push(this.callAPI('getEleveEntrainementsCompetences', {
                eleve_id: this.currentUser.id
            }));
        }

        const results = await Promise.all(promises);

        if (results[0].success) {
            this.competences = results[0].data || [];
        }
        if (results[1].success) {
            this.criteres = results[1].data || [];
        }
        if (results[2].success) {
            this.banques = (results[2].data || []).filter(b => b.statut === 'publie');
        }
        if (results[3].success) {
            this.entrainements = (results[3].data || []).filter(e => e.statut === 'publie');
        }
        if (results[4] && results[4].success) {
            this.progressions = results[4].data || [];
        }

        this.saveToCache();
    },

    async refreshDataInBackground() {
        try {
            await this.loadAllData();
        } catch (e) { /* silencieux */ }
    },

    // ==========================================
    // CACHE
    // ==========================================

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

    saveToCache() {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                competences: this.competences,
                criteres: this.criteres,
                banques: this.banques,
                entrainements: this.entrainements,
                progressions: this.progressions,
                timestamp: Date.now()
            }));
        } catch (e) { /* silencieux */ }
    },

    // ==========================================
    // STATUTS
    // ==========================================

    /**
     * Statut d'une banque pour l'élève :
     * - validee : au moins 1 exercice mode évalué avec statut 'valide'
     * - en_cours : au moins 1 exercice commencé
     * - pas_commencee : rien
     */
    getBanqueStatus(banqueId) {
        const banqueEntrainements = this.getEntrainementsForBanque(banqueId);

        if (banqueEntrainements.length === 0) {
            return { status: 'pas_commencee', label: 'Pas commencée', cssClass: 'not-started' };
        }

        const banqueProgressions = [];
        banqueEntrainements.forEach(entr => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            if (prog) banqueProgressions.push(prog);
        });

        const hasValidated = banqueProgressions.some(p =>
            p.mode === 'evalue' && p.statut === 'valide'
        );
        if (hasValidated) {
            return { status: 'validee', label: 'Validée', cssClass: 'validated' };
        }

        if (banqueProgressions.length > 0) {
            return { status: 'en_cours', label: 'En cours', cssClass: 'in-progress' };
        }

        return { status: 'pas_commencee', label: 'Pas commencée', cssClass: 'not-started' };
    },

    /**
     * Récupère les entraînements d'une banque (par banque_id, fallback sur competence_id)
     */
    getEntrainementsForBanque(banqueId) {
        const banque = this.banques.find(b => String(b.id) === String(banqueId));
        if (!banque) return [];
        return this.entrainements.filter(e =>
            String(e.banque_id) === String(banqueId) ||
            (!e.banque_id && String(e.competence_id) === String(banque.competence_id))
        );
    },

    /**
     * Statut d'un exercice individuel
     */
    getExerciseStatus(progression) {
        if (!progression) {
            return { status: 'pas_commence', label: 'Pas commencé', cssClass: 'not-started', icon: '○' };
        }
        switch (progression.statut) {
            case 'en_cours':
                return { status: 'en_cours', label: 'En cours', cssClass: 'in-progress', icon: '▶' };
            case 'entraine':
                return { status: 'entraine', label: 'Entraîné', cssClass: 'trained', icon: '📝' };
            case 'soumis':
                return { status: 'soumis', label: 'Soumis', cssClass: 'submitted', icon: '📤' };
            case 'valide':
                return { status: 'valide', label: 'Validé', cssClass: 'validated', icon: '✓' };
            default:
                return { status: 'pas_commence', label: 'Pas commencé', cssClass: 'not-started', icon: '○' };
        }
    },

    // ==========================================
    // NIVEAU 1 — LISTE DES COMPÉTENCES
    // ==========================================

    renderCompetencesList() {
        this.currentView = 'list';
        this.currentCompetence = null;
        this.currentBanque = null;
        this.stopTimer();

        const container = document.getElementById('competences-content');
        const sorted = [...this.banques].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Calcul progression
        let nbValidees = 0;
        sorted.forEach(b => {
            if (this.getBanqueStatus(b.id).status === 'validee') nbValidees++;
        });
        const total = sorted.length;
        const percent = total > 0 ? Math.round((nbValidees / total) * 100) : 0;

        if (total === 0) {
            container.innerHTML = `
                <div class="comp-header-banner">
                    <div class="comp-header-left">
                        <div class="comp-header-icon">🎯</div>
                        <h2 class="comp-header-title">Entraînement de compétences</h2>
                    </div>
                </div>
                <div class="comp-empty-state">
                    <div class="comp-empty-icon">🎯</div>
                    <h3>Aucune compétence disponible</h3>
                    <p>Les entraînements de compétences seront bientôt disponibles.</p>
                </div>
            `;
            return;
        }

        const cardsHTML = sorted.map(banque => {
            const comp = this.competences.find(c => String(c.id) === String(banque.competence_id));
            const compNom = comp ? comp.nom : (banque.titre || 'Sans titre');
            const status = this.getBanqueStatus(banque.id);
            const banqueEntr = this.getEntrainementsForBanque(banque.id);

            // Calcul de la progression par banque
            const metaParts = this._getBanqueMetaParts(banqueEntr);

            return `
                <div class="comp-card ${status.cssClass}" onclick="EleveCompetences.openBanque('${banque.id}')">
                    <div class="comp-card-left">
                        <div class="comp-card-status-icon ${status.cssClass}">
                            ${status.status === 'validee' ? '✓' : status.status === 'en_cours' ? '⋯' : '○'}
                        </div>
                        <div class="comp-card-info">
                            <h3 class="comp-card-title">${this.escapeHtml(banque.titre || compNom)}</h3>
                            <div class="comp-card-meta">
                                ${metaParts.join('<span class="comp-meta-sep">·</span>')}
                            </div>
                        </div>
                    </div>
                    <div class="comp-card-right">
                        <span class="comp-card-badge ${status.cssClass}">${status.label}</span>
                        <span class="comp-card-chevron">›</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="comp-header-banner">
                <div class="comp-header-left">
                    <div class="comp-header-icon">🎯</div>
                    <h2 class="comp-header-title">Entraînement de compétences</h2>
                </div>
                <div class="comp-header-stats">
                    <div class="comp-stat">
                        <div class="comp-stat-value">${nbValidees}/${total}</div>
                        <div class="comp-stat-label">validées</div>
                    </div>
                </div>
            </div>

            <div class="comp-progress-container">
                <div class="comp-progress-label">
                    <span>Progression</span>
                    <span class="comp-progress-value">${nbValidees}/${total} compétences validées</span>
                </div>
                <div class="comp-progress-bar">
                    <div class="comp-progress-fill" style="width: ${percent}%;"></div>
                </div>
            </div>

            <div class="comp-cards-list">
                ${cardsHTML}
            </div>
        `;
    },

    /**
     * Résumé de progression pour le sous-titre d'une carte banque
     */
    _getBanqueMetaParts(banqueEntrainements) {
        const parts = [];
        let nbEntraines = 0, nbSoumis = 0, nbValides = 0, nbEnCours = 0;

        banqueEntrainements.forEach(entr => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            if (!prog) return;
            if (prog.statut === 'entraine') nbEntraines++;
            else if (prog.statut === 'soumis') nbSoumis++;
            else if (prog.statut === 'valide') nbValides++;
            else if (prog.statut === 'en_cours') nbEnCours++;
        });

        const total = banqueEntrainements.length;

        if (nbValides > 0) parts.push(`<span>${nbValides} validé${nbValides > 1 ? 's' : ''}</span>`);
        if (nbSoumis > 0) parts.push(`<span>${nbSoumis} en attente</span>`);
        if (nbEntraines > 0) parts.push(`<span>${nbEntraines} entraîné${nbEntraines > 1 ? 's' : ''}</span>`);
        if (nbEnCours > 0) parts.push(`<span>${nbEnCours} en cours</span>`);

        if (parts.length === 0) {
            parts.push(`<span>${total} exercice${total > 1 ? 's' : ''}</span>`);
        }

        return parts;
    },

    // ==========================================
    // NIVEAU 2 — DÉTAIL D'UNE COMPÉTENCE
    // ==========================================

    openBanque(banqueId) {
        const banque = this.banques.find(b => String(b.id) === String(banqueId));
        if (!banque) return;

        const comp = this.competences.find(c => String(c.id) === String(banque.competence_id));

        this.currentView = 'detail';
        this.currentBanque = banque;
        this.currentCompetence = comp || null;

        const container = document.getElementById('competences-content');
        const status = this.getBanqueStatus(banque.id);

        // Exercices (de la banque)
        const banqueEntrainements = this.getEntrainementsForBanque(banque.id)
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const compNom = comp ? comp.nom : (banque.titre || 'Sans titre');
        const compDesc = comp ? comp.description : '';

        // HTML exercices
        const exercicesHTML = banqueEntrainements.map((entr, index) => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            const dureeMin = Math.round((entr.duree || 1800) / 60);
            const exStatus = this.getExerciseStatus(prog);

            // Tag mode (Entraînement / Évaluation) si un mode a été choisi
            const modeTag = prog && prog.mode
                ? `<span class="comp-exercise-mode-tag ${prog.mode === 'entrainement' ? 'mode-entrainement' : 'mode-evalue'}">${prog.mode === 'entrainement' ? 'Entraînement' : 'Évaluation'}</span>`
                : '';

            return `
                <div class="comp-exercise-item ${exStatus.cssClass}" onclick="EleveCompetences.handleExerciseClick('${entr.id}')">
                    <div class="comp-exercise-num">${index + 1}</div>
                    <div class="comp-exercise-info">
                        <div class="comp-exercise-title">${this.escapeHtml(entr.titre)}</div>
                        <div class="comp-exercise-meta">
                            <span>⏱ ${dureeMin} min</span>
                            ${modeTag}
                        </div>
                    </div>
                    <div class="comp-exercise-action">
                        <span class="comp-exercise-badge ${exStatus.cssClass}">${exStatus.label}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <nav class="comp-breadcrumb">
                <span class="comp-breadcrumb-link" onclick="EleveCompetences.backToList()">Compétences</span>
                <span class="comp-breadcrumb-sep">›</span>
                <span class="comp-breadcrumb-current">${this.escapeHtml(banque.titre || compNom)}</span>
            </nav>

            <div class="comp-detail-card">
                <div class="comp-detail-header">
                    <div class="comp-detail-title-section">
                        <h2 class="comp-detail-title">${this.escapeHtml(banque.titre || compNom)}</h2>
                        <span class="comp-detail-badge ${status.cssClass}">${status.label}</span>
                    </div>
                </div>

                ${compDesc ? `
                    <div class="comp-detail-description">
                        <p>${this.escapeHtml(compDesc)}</p>
                    </div>
                ` : ''}

                <div class="comp-mode-cards">
                    <div class="comp-mode-card entrainement">
                        <div class="comp-mode-card-icon">📝</div>
                        <div class="comp-mode-card-content">
                            <h4>S'entraîner</h4>
                            <p>Travaillez à votre rythme. Vous verrez le corrigé commenté à la fin.</p>
                        </div>
                    </div>
                    <div class="comp-mode-card evalue">
                        <div class="comp-mode-card-icon">🎯</div>
                        <div class="comp-mode-card-content">
                            <h4>Être évalué(e)</h4>
                            <p>Soumettez votre production pour validation par le professeur.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="comp-detail-exercises">
                <h4>Exercices (${banqueEntrainements.length})</h4>
                ${banqueEntrainements.length === 0 ? `
                    <p class="comp-no-exercises">Aucun exercice disponible pour cette compétence.</p>
                ` : `
                    <div class="comp-exercises-list">
                        ${exercicesHTML}
                    </div>
                `}
            </div>
        `;
    },

    // Rétro-compatibilité
    openCompetence(compId) {
        // Trouver la banque liée à cette compétence
        const banque = this.banques.find(b => String(b.competence_id) === String(compId));
        if (banque) {
            this.openBanque(banque.id);
        }
    },

    // ==========================================
    // GESTION DU CLIC SUR UN EXERCICE
    // ==========================================

    handleExerciseClick(entrainementId) {
        const entr = this.entrainements.find(e => String(e.id) === String(entrainementId));
        if (!entr) return;

        const prog = this.progressions.find(p =>
            String(p.entrainement_id) === String(entrainementId)
        );

        if (!prog) {
            // Jamais commencé → modal de choix (première fois)
            this.openChoiceModal(entrainementId);
        } else if (prog.statut === 'en_cours') {
            // En cours → reprendre directement avec le mode déjà choisi
            this.currentEntrainement = entr;
            this.showExercise(entr, prog.mode);
        } else if (prog.statut === 'entraine') {
            // Entraîné → relecture : sujet + correction
            this.showExerciseReview(entr, prog);
        } else if (prog.statut === 'soumis') {
            // Soumis → relecture : sujet + message soumis
            this.showExerciseReview(entr, prog);
        } else if (prog.statut === 'valide') {
            // Validé → relecture : sujet + message validé
            this.showExerciseReview(entr, prog);
        }
    },

    // ==========================================
    // MODALS
    // ==========================================

    openChoiceModal(entrainementId) {
        const entr = this.entrainements.find(e => String(e.id) === String(entrainementId));
        if (!entr) return;

        this.currentEntrainement = entr;

        this._showChoiceModal(entr, {
            title: this.escapeHtml(entr.titre),
            question: 'Comment veux-tu faire cet exercice ?',
            option1: { label: "M'entraîner", desc: 'Travaillez à votre rythme. Vous verrez le corrigé commenté à la fin.', mode: 'entrainement' },
            option2: { label: 'Être évalué(e)', desc: 'Soumettez votre production pour validation par le professeur.', mode: 'evalue' }
        });
    },

    _showChoiceModal(entr, opts) {
        const dureeMin = Math.round((entr.duree || 1800) / 60);

        const modal = document.createElement('div');
        modal.id = 'compChoiceModal';
        modal.className = 'comp-modal-overlay';
        modal.innerHTML = `
            <div class="comp-modal">
                <div class="comp-modal-body">
                    <div class="comp-choice-info">
                        <h3>${opts.title}</h3>
                        <p>Durée indicative : <strong>${dureeMin} minutes</strong></p>
                    </div>

                    <p class="comp-choice-question">${opts.question}</p>

                    <div class="comp-choice-options">
                        <div class="comp-choice-option entrainement" onclick="EleveCompetences.startEntrainement('${opts.option1.mode}')">
                            <div class="comp-choice-icon">📝</div>
                            <div class="comp-choice-content">
                                <h4>${opts.option1.label}</h4>
                                <p>${opts.option1.desc}</p>
                            </div>
                        </div>

                        <div class="comp-choice-option evalue" onclick="EleveCompetences.startEntrainement('${opts.option2.mode}')">
                            <div class="comp-choice-icon">🎯</div>
                            <div class="comp-choice-content">
                                <h4>${opts.option2.label}</h4>
                                <p>${opts.option2.desc}</p>
                            </div>
                        </div>
                    </div>

                    <div class="comp-modal-footer">
                        <button class="comp-btn comp-btn-secondary" onclick="EleveCompetences.closeModal()">Annuler</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        const modal = document.getElementById('compChoiceModal');
        if (modal) modal.remove();
        this.currentEntrainement = null;
        document.body.style.overflow = '';
    },

    async startEntrainement(mode) {
        if (!this.currentEntrainement) return;
        const entr = this.currentEntrainement;

        // Mode prévisualisation (admin sans session élève)
        if (!this.currentUser) {
            this.closeModal();
            this.showExercise(entr, mode);
            return;
        }

        try {
            const result = await this.callAPI('startEleveEntrainementCompetence', {
                eleve_id: this.currentUser.id,
                entrainement_id: entr.id,
                mode: mode
            });

            if (!result.success) {
                alert(result.error || 'Erreur inconnue');
                this.closeModal();
                return;
            }

            // Mettre à jour les progressions locales
            const existing = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            if (existing) {
                existing.mode = mode;
                existing.statut = 'en_cours';
                existing.date_debut = new Date().toISOString();
            } else {
                this.progressions.push({
                    eleve_id: this.currentUser.id,
                    entrainement_id: entr.id,
                    mode: mode,
                    statut: 'en_cours',
                    date_debut: new Date().toISOString()
                });
            }

            this.closeModal();
            this.showExercise(entr, mode);
        } catch (error) {
            console.error('Erreur démarrage entraînement:', error);
            alert('Erreur lors du démarrage');
        }
    },

    showCorrigeFromList(entrainementId) {
        const entr = this.entrainements.find(e => String(e.id) === String(entrainementId));
        if (!entr) return;
        this.showCorrigeCommente(entr);
    },

    // ==========================================
    // NAVIGATION
    // ==========================================

    backToList() {
        this.stopTimer();
        this.currentCompetence = null;
        this.currentBanque = null;
        this.currentEntrainement = null;
        this.renderCompetencesList();
    },

    backToDetail() {
        this.stopTimer();
        if (this.currentBanque) {
            this.openBanque(this.currentBanque.id);
        } else if (this.currentCompetence) {
            this.openCompetence(this.currentCompetence.id);
        } else {
            this.backToList();
        }
    },

    // ==========================================
    // API (JSONP)
    // ==========================================

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

    // ==========================================
    // HELPERS
    // ==========================================

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.abs(seconds) % 60;
        const prefix = seconds < 0 ? '+' : '';
        return `${prefix}${mins}:${secs.toString().padStart(2, '0')}`;
    },

    showLoader(message) {
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-loader">
                <div class="comp-spinner"></div>
                <p>${message || 'Chargement...'}</p>
            </div>
        `;
    },

    showError(message) {
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-empty-state">
                <div class="comp-empty-icon">⚠️</div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
};

window.EleveCompetences = EleveCompetences;
