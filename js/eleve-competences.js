/**
 * Module Élève — Entraînement de compétences
 * Navigation 3 niveaux : liste → détail compétence → exercice
 *
 * Fichier principal : init, data, navigation, rendu liste & détail
 * Voir eleve-competences-exercice.js pour la vue exercice, timer, corrigé
 */

const EleveCompetences = {
    // Données
    competences: [],      // CompetencesReferentiel (visibles uniquement)
    criteres: [],         // CriteresReussite
    entrainements: [],    // EntrainementsCompetences (publiés uniquement)
    progressions: [],     // EleveEntrainementsCompetences (pour l'élève courant)
    currentUser: null,

    // Navigation
    currentView: 'list',  // 'list' | 'detail' | 'exercise'
    currentCompetence: null,
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
            this.callAPI('getEntrainementsCompetences', {})
        ];

        if (this.currentUser) {
            promises.push(this.callAPI('getEleveEntrainementsCompetences', {
                eleve_id: this.currentUser.id
            }));
        }

        const results = await Promise.all(promises);

        if (results[0].success) {
            this.competences = (results[0].data || []).filter(c =>
                c.visible === true || c.visible === 'true'
            );
        }
        if (results[1].success) {
            this.criteres = results[1].data || [];
        }
        if (results[2].success) {
            this.entrainements = (results[2].data || []).filter(e => e.statut === 'publie');
        }
        if (results[3] && results[3].success) {
            this.progressions = results[3].data || [];
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
     * Statut d'une compétence pour l'élève :
     * - validee : au moins 1 exercice mode évalué avec statut 'valide'
     * - en_cours : au moins 1 exercice commencé
     * - pas_commencee : rien
     */
    getCompetenceStatus(compId) {
        const compEntrainements = this.entrainements.filter(e =>
            String(e.competence_id) === String(compId)
        );

        if (compEntrainements.length === 0) {
            return { status: 'pas_commencee', label: 'Pas commencée', cssClass: 'not-started' };
        }

        const compProgressions = [];
        compEntrainements.forEach(entr => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            if (prog) compProgressions.push(prog);
        });

        const hasValidated = compProgressions.some(p =>
            p.mode === 'evalue' && p.statut === 'valide'
        );
        if (hasValidated) {
            return { status: 'validee', label: 'Validée', cssClass: 'validated' };
        }

        if (compProgressions.length > 0) {
            return { status: 'en_cours', label: 'En cours', cssClass: 'in-progress' };
        }

        return { status: 'pas_commencee', label: 'Pas commencée', cssClass: 'not-started' };
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
        this.stopTimer();

        const container = document.getElementById('competences-content');
        const sorted = [...this.competences].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Calcul progression
        let nbValidees = 0;
        sorted.forEach(c => {
            if (this.getCompetenceStatus(c.id).status === 'validee') nbValidees++;
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

        const cardsHTML = sorted.map(comp => {
            const status = this.getCompetenceStatus(comp.id);
            const nbExo = this.entrainements.filter(e =>
                String(e.competence_id) === String(comp.id)
            ).length;
            const nbCrit = this.criteres.filter(cr =>
                String(cr.competence_id) === String(comp.id)
            ).length;

            return `
                <div class="comp-card ${status.cssClass}" onclick="EleveCompetences.openCompetence('${comp.id}')">
                    <div class="comp-card-left">
                        <div class="comp-card-status-icon ${status.cssClass}">
                            ${status.status === 'validee' ? '✓' : status.status === 'en_cours' ? '⋯' : '○'}
                        </div>
                        <div class="comp-card-info">
                            <h3 class="comp-card-title">${this.escapeHtml(comp.nom)}</h3>
                            <div class="comp-card-meta">
                                <span>${nbExo} exercice${nbExo > 1 ? 's' : ''}</span>
                                <span class="comp-meta-sep">·</span>
                                <span>${nbCrit} critère${nbCrit > 1 ? 's' : ''}</span>
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

    // ==========================================
    // NIVEAU 2 — DÉTAIL D'UNE COMPÉTENCE
    // ==========================================

    openCompetence(compId) {
        const comp = this.competences.find(c => String(c.id) === String(compId));
        if (!comp) return;

        this.currentView = 'detail';
        this.currentCompetence = comp;

        const container = document.getElementById('competences-content');
        const status = this.getCompetenceStatus(comp.id);

        // Critères
        const criteresComp = this.criteres
            .filter(cr => String(cr.competence_id) === String(comp.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Exercices
        const compEntrainements = this.entrainements
            .filter(e => String(e.competence_id) === String(comp.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // HTML critères
        const criteresHTML = criteresComp.length > 0 ? `
            <div class="comp-detail-criteres">
                <h4>Critères de réussite</h4>
                <p class="comp-detail-hint">Tous les critères doivent être validés pour que la compétence soit acquise.</p>
                <ol class="comp-criteres-list">
                    ${criteresComp.map(cr => `<li>${this.escapeHtml(cr.libelle)}</li>`).join('')}
                </ol>
            </div>
        ` : '';

        // HTML exercices
        const exercicesHTML = compEntrainements.map(entr => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            const dureeMin = Math.round((entr.duree || 1800) / 60);
            const exStatus = this.getExerciseStatus(prog);

            return `
                <div class="comp-exercise-item ${exStatus.cssClass}" onclick="EleveCompetences.handleExerciseClick('${entr.id}')">
                    <div class="comp-exercise-icon ${exStatus.cssClass}">
                        ${exStatus.icon}
                    </div>
                    <div class="comp-exercise-info">
                        <div class="comp-exercise-title">${this.escapeHtml(entr.titre)}</div>
                        <div class="comp-exercise-meta">
                            <span>⏱ ${dureeMin} min</span>
                            ${entr.description ? `<span class="comp-meta-sep">·</span><span>${this.escapeHtml(entr.description)}</span>` : ''}
                        </div>
                    </div>
                    <div class="comp-exercise-action">
                        <span class="comp-exercise-badge ${exStatus.cssClass}">${exStatus.label}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <button class="comp-back-btn" onclick="EleveCompetences.backToList()">
                ← Retour aux compétences
            </button>

            <div class="comp-detail-card">
                <div class="comp-detail-header">
                    <div class="comp-detail-status ${status.cssClass}">
                        ${status.status === 'validee' ? '✓' : status.status === 'en_cours' ? '⋯' : '○'}
                    </div>
                    <div class="comp-detail-title-section">
                        <h2 class="comp-detail-title">${this.escapeHtml(comp.nom)}</h2>
                        <span class="comp-detail-badge ${status.cssClass}">${status.label}</span>
                    </div>
                </div>

                ${comp.description ? `
                    <div class="comp-detail-description">
                        <p>${this.escapeHtml(comp.description)}</p>
                    </div>
                ` : ''}

                ${criteresHTML}

                ${comp.consigne ? `
                    <div class="comp-detail-consigne">
                        <h4>Consigne</h4>
                        <p>${this.escapeHtml(comp.consigne)}</p>
                    </div>
                ` : ''}
            </div>

            <div class="comp-detail-exercises">
                <h4>Exercices (${compEntrainements.length})</h4>
                ${compEntrainements.length === 0 ? `
                    <p class="comp-no-exercises">Aucun exercice disponible pour cette compétence.</p>
                ` : `
                    <div class="comp-exercises-list">
                        ${exercicesHTML}
                    </div>
                `}
            </div>
        `;
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
            // Pas commencé → modal de choix
            this.openChoiceModal(entrainementId);
        } else if (prog.statut === 'en_cours') {
            // En cours → reprendre
            this.showExercise(entr, prog.mode);
        } else if (prog.statut === 'entraine') {
            // Entraîné → proposer de refaire ou d'évaluer
            this.openRetrainModal(entrainementId);
        } else if (prog.statut === 'soumis') {
            // Soumis → message d'attente
            this.showSubmittedMessage(entr);
        } else if (prog.statut === 'valide') {
            // Validé → voir résultat ou se ré-entraîner
            this.showValidatedMessage(entr);
        }
    },

    // ==========================================
    // MODALS
    // ==========================================

    openChoiceModal(entrainementId) {
        const entr = this.entrainements.find(e => String(e.id) === String(entrainementId));
        if (!entr) return;

        this.currentEntrainement = entr;
        const dureeMin = Math.round((entr.duree || 1800) / 60);

        const modal = document.createElement('div');
        modal.id = 'compChoiceModal';
        modal.className = 'comp-modal-overlay';
        modal.innerHTML = `
            <div class="comp-modal">
                <div class="comp-modal-header">
                    <h2>Choisissez votre mode</h2>
                    <button class="comp-modal-close" onclick="EleveCompetences.closeModal()">×</button>
                </div>
                <div class="comp-modal-body">
                    <div class="comp-choice-info">
                        <h3>${this.escapeHtml(entr.titre)}</h3>
                        <p>Durée indicative : <strong>${dureeMin} minutes</strong></p>
                    </div>

                    <div class="comp-choice-options">
                        <div class="comp-choice-option" onclick="EleveCompetences.startEntrainement('entrainement')">
                            <div class="comp-choice-icon">📝</div>
                            <div class="comp-choice-content">
                                <h4>S'entraîner</h4>
                                <p>Travaillez à votre rythme. Vous verrez le corrigé commenté à la fin.</p>
                                <p class="comp-choice-note">Pas de validation de compétence.</p>
                            </div>
                        </div>

                        <div class="comp-choice-option" onclick="EleveCompetences.startEntrainement('evalue')">
                            <div class="comp-choice-icon">🎯</div>
                            <div class="comp-choice-content">
                                <h4>Être évalué(e)</h4>
                                <p>Soumettez votre production pour validation par le professeur.</p>
                                <p class="comp-choice-note important">La compétence pourra être validée.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    },

    openRetrainModal(entrainementId) {
        const entr = this.entrainements.find(e => String(e.id) === String(entrainementId));
        if (!entr) return;

        this.currentEntrainement = entr;
        const dureeMin = Math.round((entr.duree || 1800) / 60);

        const modal = document.createElement('div');
        modal.id = 'compChoiceModal';
        modal.className = 'comp-modal-overlay';
        modal.innerHTML = `
            <div class="comp-modal">
                <div class="comp-modal-header">
                    <h2>Cet exercice a déjà été fait</h2>
                    <button class="comp-modal-close" onclick="EleveCompetences.closeModal()">×</button>
                </div>
                <div class="comp-modal-body">
                    <div class="comp-choice-info">
                        <h3>${this.escapeHtml(entr.titre)}</h3>
                        <p>Durée indicative : <strong>${dureeMin} minutes</strong></p>
                    </div>

                    <div class="comp-choice-options">
                        <div class="comp-choice-option" onclick="EleveCompetences.startEntrainement('entrainement')">
                            <div class="comp-choice-icon">📝</div>
                            <div class="comp-choice-content">
                                <h4>Se ré-entraîner</h4>
                                <p>Refaites l'exercice pour vous perfectionner. Le corrigé sera accessible à la fin.</p>
                            </div>
                        </div>

                        <div class="comp-choice-option" onclick="EleveCompetences.startEntrainement('evalue')">
                            <div class="comp-choice-icon">🎯</div>
                            <div class="comp-choice-content">
                                <h4>Passer en mode évalué</h4>
                                <p>Soumettez votre production pour validation par le professeur.</p>
                                <p class="comp-choice-note important">La compétence pourra être validée.</p>
                            </div>
                        </div>
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

    // ==========================================
    // MESSAGES (soumis, validé)
    // ==========================================

    showSubmittedMessage(entr) {
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entr.competence_id}')">
                ← Retour
            </button>
            <div class="comp-message-view">
                <div class="comp-message-icon submitted">📤</div>
                <h2>${this.escapeHtml(entr.titre)}</h2>
                <p class="comp-message-text">Votre production a été soumise et est en attente de correction par le professeur.</p>
                <button class="comp-btn comp-btn-secondary" onclick="EleveCompetences.openCompetence('${entr.competence_id}')">
                    Retour à la compétence
                </button>
            </div>
        `;
    },

    showValidatedMessage(entr) {
        const correction = entr.correction_commentee;
        const hasCorrige = correction && typeof correction === 'object' && correction.proposition;

        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entr.competence_id}')">
                ← Retour
            </button>
            <div class="comp-message-view validated">
                <div class="comp-message-icon validated">✓</div>
                <h2>${this.escapeHtml(entr.titre)}</h2>
                <p class="comp-message-text">Compétence validée sur cet exercice !</p>
                <div class="comp-message-actions">
                    ${hasCorrige ? `
                        <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.showCorrigeFromList('${entr.id}')">
                            Voir le corrigé commenté
                        </button>
                    ` : ''}
                    <button class="comp-btn comp-btn-secondary" onclick="EleveCompetences.openCompetence('${entr.competence_id}')">
                        Retour à la compétence
                    </button>
                </div>
            </div>
        `;
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
        this.currentEntrainement = null;
        this.renderCompetencesList();
    },

    backToDetail() {
        this.stopTimer();
        if (this.currentCompetence) {
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
