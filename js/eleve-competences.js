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
    CACHE_KEY: CONFIG.STORAGE_KEYS.CACHE_COMPETENCES,
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
            this.banques = (results[2].data || []).filter(b =>
                b.statut === 'publie' && (!b.type_usage || b.type_usage === 'entrainement')
            );
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
     * - validee : au moins 1 exercice évalué validé par le prof
     * - corrigee : au moins 1 exercice corrigé par le prof (en attente de validation)
     * - soumise : au moins 1 exercice évalué soumis, en attente de correction
     * - en_cours : au moins 1 exercice commencé
     * - non_soumise : au moins 1 exercice refusé par l'élève (pas d'autre progression)
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

        // Entraînement uniquement : terminé ou en cours
        if (banqueProgressions.some(p => p.statut === 'entraine')) {
            return { status: 'entraine', label: 'Terminé', cssClass: 'completed' };
        }

        if (banqueProgressions.some(p => p.statut === 'en_cours')) {
            return { status: 'en_cours', label: 'En cours', cssClass: 'in-progress' };
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
     * Statut d'un exercice individuel — badge unique (mode + statut fusionnés)
     * @param {Object|null} progression
     * @param {Object} [entrainement] — nécessaire pour calculer la deadline (soumis sans envoi)
     */
    getExerciseStatus(progression) {
        if (!progression) {
            return { status: 'pas_commence', label: '', cssClass: 'not-started', icon: '' };
        }
        switch (progression.statut) {
            case 'en_cours':
                return { status: 'en_cours', label: 'En cours', cssClass: 'in-progress', icon: '▶' };
            case 'entraine':
                return { status: 'entraine', label: 'Terminé', cssClass: 'trained', icon: '✓' };
            default:
                // Statuts legacy (soumis, valide, etc.) — afficher comme terminé
                return { status: 'entraine', label: 'Terminé', cssClass: 'trained', icon: '✓' };
        }
    },

    /**
     * Sous-statuts pour 'soumis' : distingue "à envoyer" vs "en attente de correction"
     */
    _getSoumisStatus(progression, entrainement) {
        const hasEnvoye = !!progression.date_envoi;

        if (hasEnvoye) {
            return { status: 'soumis_envoye', label: 'En attente de correction', cssClass: 'submitted-sent', icon: '📤' };
        }

        // Pas encore envoyé → calculer la deadline
        const modeRendu = progression.mode_rendu;
        const delivery = SubmissionUtils.getDeliveryInfo(
            entrainement ? entrainement.id : (progression.entrainement_id || '')
        );

        if (modeRendu === 'numerique' || (delivery && delivery.modeRendu === 'numerique')) {
            const deadlineText = this._calcDeadlineMail(progression, entrainement);
            if (this._isDeadlinePassed(deadlineText)) {
                return { status: 'soumis_expire', label: 'Délai dépassé', cssClass: 'submitted-expired', icon: '⚠️' };
            }
            return { status: 'soumis_a_envoyer', label: 'À envoyer via MBN', sublabel: deadlineText, cssClass: 'submitted-pending', icon: '📧' };
        }

        if (modeRendu === 'papier' || (delivery && delivery.modeRendu === 'papier')) {
            const deadlineText = this._calcDeadlinePapier(progression, entrainement);
            return { status: 'soumis_a_deposer', label: 'À déposer dans le casier', sublabel: deadlineText, cssClass: 'submitted-pending', icon: '📄' };
        }

        // Fallback : pas de mode_rendu connu
        return { status: 'soumis', label: 'En attente de correction', cssClass: 'submitted-sent', icon: '📤' };
    },

    /**
     * Calcule le texte de deadline mail à partir de date_soumission + délai
     */
    _calcDeadlineMail(progression, entrainement) {
        // Essayer d'abord le localStorage (calculé au moment de la soumission)
        const delivery = SubmissionUtils.getDeliveryInfo(
            entrainement ? entrainement.id : (progression.entrainement_id || '')
        );
        if (delivery && delivery.deadlineText) return delivery.deadlineText;

        // Recalculer depuis date_soumission + delai_mail_minutes
        if (progression.date_soumission && entrainement) {
            const delai = entrainement.delai_mail_minutes || 30;
            const soumissionDate = new Date(progression.date_soumission);
            const deadline = new Date(soumissionDate.getTime() + delai * 60 * 1000);
            const h = deadline.getHours();
            const m = String(deadline.getMinutes()).padStart(2, '0');
            return 'avant ' + h + 'h' + m;
        }

        return '';
    },

    /**
     * Calcule le texte de deadline papier à partir de date_soumission + délai
     */
    _calcDeadlinePapier(progression, entrainement) {
        const delivery = SubmissionUtils.getDeliveryInfo(
            entrainement ? entrainement.id : (progression.entrainement_id || '')
        );
        if (delivery && delivery.deadlineText) return delivery.deadlineText;

        // Recalculer depuis date_soumission + delai_papier_jours
        if (progression.date_soumission && entrainement) {
            const delai = entrainement.delai_papier_jours || 1;
            const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
            const moisNoms = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            const d = SubmissionUtils.prochainJourOuvre(delai, SubmissionUtils._joursNonCoursCache || new Set());
            return 'le ' + jours[d.getDay()] + ' ' + d.getDate() + ' ' + moisNoms[d.getMonth()];
        }

        return '';
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

        // Calcul progression (nombre de banques terminées)
        let nbTerminees = 0;
        sorted.forEach(b => {
            const st = this.getBanqueStatus(b.id).status;
            if (st === 'entraine') nbTerminees++;
        });
        const total = sorted.length;
        const percent = total > 0 ? Math.round((nbTerminees / total) * 100) : 0;

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
            const matiere = comp ? (comp.matiere || '') : '';
            const banqueEntr = this.getEntrainementsForBanque(banque.id);

            // Calcul de la progression par banque
            const metaParts = this._getBanqueMetaParts(banqueEntr);

            // Badge matière
            const matiereBadge = matiere ? `<span class="comp-matiere-badge">${escapeHtml(matiere)}</span>` : '';

            return `
                <div class="comp-card" onclick="EleveCompetences.openBanque('${banque.id}')">
                    <div class="comp-card-left">
                        <div class="comp-card-info">
                            <h3 class="comp-card-title">${escapeHtml(banque.titre || compNom)} ${matiereBadge}</h3>
                            <div class="comp-card-meta">
                                ${metaParts.join('<span class="comp-meta-sep">·</span>')}
                            </div>
                        </div>
                    </div>
                    <div class="comp-card-right">
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
                        <div class="comp-stat-value">${nbTerminees}/${total}</div>
                        <div class="comp-stat-label">terminées</div>
                    </div>
                </div>
            </div>

            <div class="comp-progress-container">
                <div class="comp-progress-label">
                    <span>Progression</span>
                    <span class="comp-progress-value">${nbTerminees}/${total} compétences terminées</span>
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
        let nbTermines = 0, nbAEnvoyer = 0, nbEnAttente = 0, nbValides = 0, nbEnCours = 0, nbCorrige = 0, nbNonEvalue = 0, nbNonValide = 0;

        banqueEntrainements.forEach(entr => {
            const prog = this.progressions.find(p =>
                String(p.entrainement_id) === String(entr.id)
            );
            if (!prog) return;
            if (prog.statut === 'entraine') nbTermines++;
            else if (prog.statut === 'soumis' && prog.date_envoi) nbEnAttente++;
            else if (prog.statut === 'soumis') nbAEnvoyer++;
            else if (prog.statut === 'valide') nbValides++;
            else if (prog.statut === 'corrige') nbCorrige++;
            else if (prog.statut === 'non_valide') nbNonValide++;
            else if (prog.statut === 'en_cours') nbEnCours++;
            else if (prog.statut === 'non_soumis') nbNonEvalue++;
        });

        const total = banqueEntrainements.length;

        if (nbValides > 0) parts.push(`<span>${nbValides} validé${nbValides > 1 ? 's' : ''}</span>`);
        if (nbCorrige > 0) parts.push(`<span>${nbCorrige} corrigé${nbCorrige > 1 ? 's' : ''}</span>`);
        if (nbNonValide > 0) parts.push(`<span>${nbNonValide} non validé${nbNonValide > 1 ? 's' : ''}</span>`);
        if (nbEnAttente > 0) parts.push(`<span>${nbEnAttente} en attente de correction</span>`);
        if (nbAEnvoyer > 0) parts.push(`<span>${nbAEnvoyer} à envoyer</span>`);
        if (nbTermines > 0) parts.push(`<span>${nbTermines} terminé${nbTermines > 1 ? 's' : ''}</span>`);
        if (nbEnCours > 0) parts.push(`<span>${nbEnCours} en cours</span>`);
        if (nbNonEvalue > 0) parts.push(`<span>${nbNonEvalue} non évalué${nbNonEvalue > 1 ? 's' : ''}</span>`);

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
            const dureeMin = entr.duree || 30;
            const exStatus = this.getExerciseStatus(prog, entr);

            // Badge unique (vide si pas commencé)
            const badgeHTML = exStatus.label
                ? `<span class="comp-exercise-badge ${exStatus.cssClass}">${exStatus.label}${exStatus.sublabel ? '<span class="comp-exercise-badge-sub">' + exStatus.sublabel + '</span>' : ''}</span>`
                : '';

            return `
                <div class="comp-exercise-item ${exStatus.cssClass}" onclick="EleveCompetences.handleExerciseClick('${entr.id}')">
                    <div class="comp-exercise-num">${index + 1}</div>
                    <div class="comp-exercise-info">
                        <div class="comp-exercise-title">${escapeHtml(entr.titre)}</div>
                        <div class="comp-exercise-meta">
                            <span>⏱ ${dureeMin} min</span>
                        </div>
                    </div>
                    <div class="comp-exercise-action">
                        ${badgeHTML}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <nav class="comp-breadcrumb">
                <span class="comp-breadcrumb-link" onclick="EleveCompetences.backToList()">Compétences</span>
                <span class="comp-breadcrumb-sep">›</span>
                <span class="comp-breadcrumb-current">${escapeHtml(banque.titre || compNom)}</span>
            </nav>

            <div class="comp-detail-card">
                <div class="comp-detail-header">
                    <div class="comp-detail-title-section">
                        <h2 class="comp-detail-title">${escapeHtml(banque.titre || compNom)}</h2>
                    </div>
                </div>

                ${compDesc ? `
                    <div class="comp-detail-description">
                        <p>${escapeHtml(compDesc)}</p>
                    </div>
                ` : ''}

                <div class="comp-mode-cards">
                    <div class="comp-mode-card entrainement">
                        <div class="comp-mode-card-icon">📝</div>
                        <div class="comp-mode-card-content">
                            <h4>S'entraîner</h4>
                            <p>Travaille \u00E0 ton rythme. Tu verras le corrig\u00E9 comment\u00E9 \u00E0 la fin.</p>
                        </div>
                    </div>
                    <div class="comp-mode-card evalue">
                        <div class="comp-mode-card-icon">🎯</div>
                        <div class="comp-mode-card-content">
                            <h4>Être évalué(e)</h4>
                            <p>Soumets ta production pour validation par le professeur.</p>
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
            // Jamais commencé → démarrer directement en mode entraînement
            this.currentEntrainement = entr;
            this.startEntrainement('entrainement');
        } else if (prog.statut === 'en_cours') {
            // En cours → popup Reprendre / Recommencer
            this._showResumeOrRestartModal(entr);
        } else if (prog.statut === 'entraine') {
            // Entraîné → popup Se ré-entraîner / Consulter correction
            this._showRetrainOrReviewModal(entr, prog);
        } else {
            // Tout autre statut (legacy évaluation) → consulter la correction
            this.showExerciseReview(entr, prog);
        }
    },

    // ==========================================
    // MODALS
    // ==========================================

    // openChoiceModal supprimé — plus de mode évaluation dans les entraînements.
    // L'élève démarre toujours en mode entraînement.

    closeModal() {
        const modal = document.getElementById('compChoiceModal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
    },

    /**
     * Popup pour exercice en cours (mode entraînement) :
     * Reprendre là où on s'est arrêté ou recommencer.
     */
    _showResumeOrRestartModal(entr) {
        this.currentEntrainement = entr;
        const dureeMin = entr.duree || 30;
        const savedTime = this._loadTrainTimer(entr.id);
        const savedTimeStr = savedTime !== null ? this.formatTime(savedTime) : '';

        const modal = document.createElement('div');
        modal.id = 'compChoiceModal';
        modal.className = 'comp-modal-overlay';
        modal.innerHTML = `
            <div class="comp-modal">
                <div class="comp-modal-body">
                    <div class="comp-choice-info">
                        <h3>${escapeHtml(entr.titre)}</h3>
                        <p>Tu avais commencé cet entraînement${savedTimeStr ? ' (' + savedTimeStr + ' restantes)' : ''}.</p>
                    </div>

                    <p class="comp-choice-question">Que veux-tu faire ?</p>

                    <div class="comp-choice-options">
                        <div class="comp-choice-option entrainement" onclick="EleveCompetences.resumeTraining()">
                            <div class="comp-choice-icon">▶️</div>
                            <div class="comp-choice-content">
                                <h4>Reprendre l'entraînement</h4>
                                <p>Le chronomètre reprend là où tu t'es arrêté${savedTimeStr ? ' (' + savedTimeStr + ')' : ''}.</p>
                            </div>
                        </div>

                        <div class="comp-choice-option evalue" onclick="EleveCompetences.restartTrainingFromModal()">
                            <div class="comp-choice-icon">🔄</div>
                            <div class="comp-choice-content">
                                <h4>Recommencer l'entraînement</h4>
                                <p>Le chronomètre redémarre à zéro (${dureeMin} min).</p>
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

    /**
     * Popup pour exercice terminé (mode entraînement) :
     * Se ré-entraîner ou consulter le sujet et la correction.
     */
    _showRetrainOrReviewModal(entr, prog) {
        this.currentEntrainement = entr;
        this._pendingReviewProg = prog;

        const modal = document.createElement('div');
        modal.id = 'compChoiceModal';
        modal.className = 'comp-modal-overlay';
        modal.innerHTML = `
            <div class="comp-modal">
                <div class="comp-modal-body">
                    <div class="comp-choice-info">
                        <h3>${escapeHtml(entr.titre)}</h3>
                        <p>Tu as déjà terminé cet entraînement.</p>
                    </div>

                    <p class="comp-choice-question">Que veux-tu faire ?</p>

                    <div class="comp-choice-options">
                        <div class="comp-choice-option entrainement" onclick="EleveCompetences.restartTrainingFromModal()">
                            <div class="comp-choice-icon">🔄</div>
                            <div class="comp-choice-content">
                                <h4>Se ré-entraîner</h4>
                                <p>Recommencer l'exercice depuis le début, le chronomètre redémarre.</p>
                            </div>
                        </div>

                        <div class="comp-choice-option evalue" onclick="EleveCompetences.viewReviewFromModal()">
                            <div class="comp-choice-icon">📋</div>
                            <div class="comp-choice-content">
                                <h4>Consulter le sujet et la correction</h4>
                                <p>Revoir le sujet et le corrigé commenté.</p>
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

    resumeTraining() {
        if (!this.currentEntrainement) return;
        this.closeModal();
        this.showExercise(this.currentEntrainement, 'entrainement');
    },

    async restartTrainingFromModal() {
        if (!this.currentEntrainement) return;
        this._clearTrainTimer(this.currentEntrainement.id);
        this._setChoiceModalLoading('entrainement');
        await this.startEntrainement('entrainement', this.currentEntrainement.id);
    },

    viewReviewFromModal() {
        if (!this.currentEntrainement) return;
        const prog = this._pendingReviewProg;
        this.closeModal();
        this.showExerciseReview(this.currentEntrainement, prog);
    },

    /**
     * Démarre ou relance un entraînement (premier démarrage ou ré-entraînement).
     * @param {string} mode — 'entrainement' ou 'evalue'
     * @param {string} [entrainementId] — si fourni, cherche l'entraînement par ID (ré-entraînement)
     */
    async startEntrainement(mode, entrainementId) {
        if (this._startingEntrainement) return;

        const entr = entrainementId
            ? this.entrainements.find(e => String(e.id) === String(entrainementId))
            : this.currentEntrainement;
        if (!entr) return;
        this._startingEntrainement = true;

        // Feedback visuel immédiat sur le modal
        this._setChoiceModalLoading(mode);

        // Mode prévisualisation (admin sans session élève)
        if (!this.currentUser) {
            this._startingEntrainement = false;
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
                this._startingEntrainement = false;
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
            this.saveToCache();

            this._startingEntrainement = false;
            this.closeModal();
            this.currentEntrainement = entr;
            this.showExercise(entr, mode);
        } catch (error) {
            this._startingEntrainement = false;
            console.error('Erreur démarrage entraînement:', error);
            alert('Erreur lors du démarrage');
        }
    },

    /** Affiche un état de chargement sur le modal de choix de mode. */
    _setChoiceModalLoading(mode) {
        const modal = document.getElementById('compChoiceModal');
        if (!modal) return;

        // Désactiver tous les clics dans le modal
        modal.querySelectorAll('.comp-choice-option').forEach(function(opt) {
            opt.style.pointerEvents = 'none';
            opt.style.opacity = '0.5';
        });
        modal.querySelector('.comp-modal-footer .comp-btn').style.pointerEvents = 'none';

        // Mettre en surbrillance l'option choisie avec un spinner
        var chosenClass = mode === 'evalue' ? '.comp-choice-option.evalue' : '.comp-choice-option.entrainement';
        var chosen = modal.querySelector(chosenClass);
        if (chosen) {
            chosen.style.opacity = '1';
            var icon = chosen.querySelector('.comp-choice-icon');
            if (icon) icon.textContent = '\u23F3';
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
        // Nettoyage beforeunload (méthode ajoutée par eleve-competences-exercice.js)
        if (this._removeBeforeUnload) {
            this._removeBeforeUnload();
        }
    }
};

window.EleveCompetences = EleveCompetences;
