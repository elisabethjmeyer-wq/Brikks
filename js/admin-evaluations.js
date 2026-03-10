/**
 * Admin Evaluations - Gestion des evaluations
 * Phase 2 : matière toggle, sommatives, saisie des résultats, corrections banner
 */

const AdminEvaluations = {
    // Data
    evaluations: [],
    sommatives: [],
    resultats: [],
    resultatsSommatives: [],
    chapitres: [],
    themes: [],
    disciplines: [],
    methodologies: [],
    bexConfig: [],
    eleves: [],

    // Connaissances data (for cascade dropdown)
    banquesExercicesConn: [],
    entrainementsConn: [],

    // Savoir-faire data (for cascade dropdown)
    banquesSF: [],
    exercicesSF: [],

    // Progression evaluation data
    progressionsEvaluation: [],
    parametresNotes: [],

    // Wizard state
    wizardStep: 1,
    wizardData: {},

    // Current tab type
    currentType: 'connaissances',

    // Current matière filter
    currentMatiere: 'FR',

    // Filters
    filters: {
        statut: ''
    },

    // Saisie state
    saisieEvaluation: null,
    saisieChanges: {},
    saisieSommative: null,

    // Type colors
    typeColors: {
        'connaissances': 'green',
        'savoir-faire': 'orange',
        'competences': 'purple',
        'bonus': 'yellow',
        'sommatives': 'blue'
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();

            // Si hash #bonus-demandes, basculer sur l'onglet bonus
            if (window.location.hash === '#bonus-demandes') {
                this.currentType = 'bonus';
                // Mettre à jour l'UI des onglets
                document.querySelectorAll('.eval-tab').forEach(tab => {
                    tab.classList.remove('active');
                    if (tab.dataset.type === 'bonus') tab.classList.add('active');
                });
            }

            this.updateCounts();
            this.renderEvaluations();
            this.updateDemandesBanner();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    async loadData() {
        const safeGet = (name) => SheetsAPI.getSheetData(name).catch(err => {
            console.warn(`[Evaluations] Echec chargement ${name}:`, err);
            return [];
        });

        const [
            disciplinesData,
            themesData,
            chapitresData,
            methodologiesData,
            elevesData,
            sommativesData,
            resultatsSommativesData,
            banquesExercicesConnData,
            entrainementsConnData,
            banquesExercicesData,
            exercicesData,
            banquesCompetencesData,
            entrainementsCompetencesData,
            competencesReferentielData,
            criteresReussiteData
        ] = await Promise.all([
            safeGet('DISCIPLINES'),
            safeGet('THEMES'),
            safeGet('CHAPITRES'),
            safeGet('METHODOLOGIE'),
            safeGet('UTILISATEURS'),
            safeGet('NOTES_SOMMATIVES'),
            safeGet('RESULTATS_SOMMATIVES'),
            safeGet('BANQUES_EXERCICES_CONN'),
            safeGet('ENTRAINEMENTS_CONN'),
            safeGet('BANQUES_EXERCICES'),
            safeGet('EXERCICES'),
            safeGet('BanquesCompetences'),
            safeGet('EntrainementsCompetences'),
            safeGet('CompetencesReferentiel'),
            safeGet('CriteresReussite')
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.methodologies = SheetsAPI.parseSheetData(methodologiesData);
        this.eleves = SheetsAPI.parseSheetData(elevesData).filter(u => u.role === 'eleve');
        this.sommatives = SheetsAPI.parseSheetData(sommativesData);
        this.resultatsSommatives = SheetsAPI.parseSheetData(resultatsSommativesData);

        // Connaissances data (for cascade dropdown)
        this.banquesExercicesConn = SheetsAPI.parseSheetData(banquesExercicesConnData);
        this.entrainementsConn = SheetsAPI.parseSheetData(entrainementsConnData);

        // Savoir-faire data (for cascade dropdown)
        const allBanques = SheetsAPI.parseSheetData(banquesExercicesData);
        this.banquesSF = allBanques.filter(b => b.type === 'savoir-faire');
        this.exercicesSF = SheetsAPI.parseSheetData(exercicesData);

        // Compétences / TC / Bonus data
        const allBanquesComp = SheetsAPI.parseSheetData(banquesCompetencesData);
        this.banquesCompetences = allBanquesComp.filter(b => !b.type_usage || b.type_usage === 'entrainement');
        this.banquesTachesComplexes = allBanquesComp.filter(b => b.type_usage === 'tache_complexe');
        this.banquesBonusPonctuels = allBanquesComp.filter(b => b.type_usage === 'bonus_ponctuel');
        this.entrainementsCompetences = SheetsAPI.parseSheetData(entrainementsCompetencesData);
        this.competencesReferentiel = SheetsAPI.parseSheetData(competencesReferentielData);
        this.criteresReussite = SheetsAPI.parseSheetData(criteresReussiteData);

        // Load evaluations
        try {
            const evaluationsData = await SheetsAPI.getSheetData('EVALUATIONS');
            this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
            // Synchroniser le statut des évals numériques avec dates
            this._syncStatutsFromDates();
        } catch (_e) {
            this.evaluations = [];
        }

        // Load evaluation results (clearCache pour voir les dernières demandes)
        try {
            SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
            const resultatsData = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
            this.resultats = SheetsAPI.parseSheetData(resultatsData);
        } catch (_e) {
            this.resultats = [];
        }

        // Load progression evaluation
        try {
            const progEvalData = await SheetsAPI.getSheetData('PROGRESSION_EVALUATION');
            this.progressionsEvaluation = SheetsAPI.parseSheetData(progEvalData);
        } catch (_e) {
            this.progressionsEvaluation = [];
        }

        // Load notes parameters (for semester detection)
        try {
            const paramNotesData = await SheetsAPI.getSheetData('PARAMETRES_NOTES');
            this.parametresNotes = SheetsAPI.parseSheetData(paramNotesData);
        } catch (_e) {
            this.parametresNotes = [];
        }
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluations-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">!</div>
                <h3>Erreur</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    },

    // ========== NOTIFICATIONS ==========
    showNotification(message, type) {
        const el = document.getElementById('notification');
        el.textContent = message;
        el.className = 'notification notification-' + (type || 'success') + ' show';
        setTimeout(() => { el.classList.remove('show'); }, type === 'error' ? 6000 : 4000);
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Add button
        document.getElementById('addEvaluationBtn').addEventListener('click', () => this._handleAddClick());

        // Tab clicks
        document.querySelectorAll('.eval-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.switchTab(type);
            });
        });

        // Matière toggle
        document.querySelectorAll('.matiere-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.matiere-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentMatiere = e.currentTarget.dataset.matiere;
                this.updateCounts();
                this.renderEvaluations();
            });
        });

        // Fermer les dropdowns de statut au clic extérieur
        document.addEventListener('click', (e) => {
            // Ne pas fermer si le clic est à l'intérieur d'un dropdown ouvert
            if (e.target.closest('.status-dropdown.open')) return;
            document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));
        });

        // Filter statut
        document.getElementById('filterStatut').addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.renderEvaluations();
        });

        // Modal events
        document.getElementById('closeEvaluationModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelEvaluationBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('evalWizardNextBtn').addEventListener('click', () => this.wizardNext());
        document.getElementById('evalWizardPrevBtn').addEventListener('click', () => this.wizardPrev());

        // Sommative modal
        document.getElementById('closeSommativeModal').addEventListener('click', () => this.closeSommativeModal());
        document.getElementById('cancelSommativeBtn').addEventListener('click', () => this.closeSommativeModal());
        document.getElementById('saveSommativeBtn').addEventListener('click', () => this.saveSommative());

        // Attribution modal
        document.getElementById('closeAttributionModal').addEventListener('click', () => this.closeAttributionModal());
        document.getElementById('cancelAttributionBtn').addEventListener('click', () => this.closeAttributionModal());
        document.getElementById('saveAttributionBtn').addEventListener('click', () => this.saveAttributions());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteEvaluation());

        // Modal overlays
        ['evaluationModal', 'attributionModal', 'deleteModal', 'sommativeModal'].forEach(id => {
            document.getElementById(id).addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    document.getElementById(id).classList.add('hidden');
                }
            });
        });

        // Saisie back button
        document.getElementById('saisieBackBtn').addEventListener('click', () => this.closeSaisie());
    },

    _handleAddClick() {
        if (this.currentType === 'sommatives') {
            this.openSommativeModal();
        } else {
            this.openModal();
        }
    },

    // ========== TABS ==========
    switchTab(type) {
        this.currentType = type;

        // Update tab UI
        document.querySelectorAll('.eval-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === type) {
                tab.classList.add('active');
            }
        });

        // Update add button texts
        this._updateAddButtonLabels(type);

        this.renderEvaluations();
    },

    _updateAddButtonLabels() {
        const btnText = document.getElementById('addEvaluationBtnText');
        if (btnText) btnText.textContent = 'Nouvelle évaluation';
    },

    updateCounts() {
        const types = ['connaissances', 'savoir-faire', 'competences', 'bonus'];
        types.forEach(type => {
            const count = this._filterByMatiere(this.evaluations.filter(e => e.type === type)).length;
            const countEl = document.getElementById(`count${this._capitalizeType(type)}`);
            if (countEl) countEl.textContent = count;
        });

        // Sommatives count
        const somCount = this._filterSommativesByMatiere(this.sommatives).length;
        const somCountEl = document.getElementById('countSommatives');
        if (somCountEl) somCountEl.textContent = somCount;
    },

    _capitalizeType(str) {
        if (str === 'savoir-faire') return 'SavoirFaire';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // ========== MATIÈRE FILTER ==========
    _filterByMatiere(list) {
        return list.filter(e => {
            const m = e.matiere || '';
            return m === this.currentMatiere || m === 'Les deux';
        });
    },

    _filterSommativesByMatiere(list) {
        return list.filter(s => {
            const m = s.matiere || '';
            return m === this.currentMatiere || m === 'Les deux';
        });
    },

    // ========== RENDER ==========

    renderEvaluations() {
        if (this.currentType === 'sommatives') {
            this._renderSommatives();
            return;
        }

        const container = document.getElementById('evaluationsList');
        const emptyState = document.getElementById('emptyState');

        // Pour l'onglet bonus : afficher les cartes comme les autres types
        if (this.currentType === 'bonus') {
            let filtered = this.evaluations.filter(e => {
                if (e.type !== 'bonus') return false;
                if (this.filters.statut && e.statut !== this.filters.statut) return false;
                return true;
            });
            filtered = this._filterByMatiere(filtered);

            if (filtered.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
            } else {
                emptyState.style.display = 'none';
                container.innerHTML = filtered.map(e => this.renderEvaluationCard(e)).join('');
            }
            return;
        }

        // Autres types (connaissances, SF, compétences)
        let filtered = this.evaluations.filter(e => {
            if (e.type !== this.currentType) return false;
            if (this.filters.statut && e.statut !== this.filters.statut) return false;
            return true;
        });

        filtered = this._filterByMatiere(filtered);

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = filtered.map(e => this.renderEvaluationCard(e)).join('');
        }

    },

    _renderDemandeCard(d, options = {}) {
        const eleve = (this.eleves || []).find(e => String(e.id).trim() === String(d.eleve_id).trim());
        const evaluation = (this.evaluations || []).find(e => String(e.id).trim() === String(d.evaluation_id).trim());
        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() : d.eleve_id;
        const evalTitle = evaluation ? (evaluation.titre || 'Sans titre') : d.evaluation_id;
        const evalType = evaluation ? (evaluation.type || '') : '';
        const sousType = evaluation ? (evaluation.sous_type_bonus || evaluation.sous_type_comp || '') : '';
        const dateStr = d.date_demande ? new Date(d.date_demande).toLocaleDateString('fr-FR') : '';

        let typeBadge = '';
        if (evalType === 'bonus' && sousType === 'competence') {
            typeBadge = '<span class="demande-badge purple">Bonus compétence</span>';
        } else if (evalType === 'bonus' && sousType === 'ponctuel') {
            typeBadge = '<span class="demande-badge teal">Bonus ponctuel</span>';
        } else if (evalType === 'competences') {
            typeBadge = '<span class="demande-badge red">Tâche complexe</span>';
        } else {
            typeBadge = `<span class="demande-badge gray">${escapeHtml(evalType)}</span>`;
        }

        // Pour les demandes traitées : afficher le statut au lieu du bouton Répondre
        let actionsHtml = '';
        let cardClickAttr = '';
        if (options.treated) {
            const ds = String(d.demande_statut || '').trim();
            if (ds === 'accepte') {
                actionsHtml = '<span class="demande-status-tag accepted">✓ Acceptée</span>';
            } else if (ds === 'refuse') {
                actionsHtml = '<span class="demande-status-tag refused">✗ Refusée</span>';
            }
            cardClickAttr = ` onclick="AdminEvaluations.openDemandeDetailModal('${d.evaluation_id}', '${d.eleve_id}')"`;
        } else {
            actionsHtml = `<button class="btn btn-sm btn-primary" onclick="AdminEvaluations.openReponseModal('${d.evaluation_id}', '${d.eleve_id}')">Répondre</button>`;
        }

        return `
            <div class="demande-card${options.treated ? ' treated' : ''}"${cardClickAttr}>
                <div class="demande-card-left">
                    <div class="demande-eleve">${escapeHtml(eleveName)}</div>
                    <div class="demande-eval">
                        ${typeBadge}
                        <span class="demande-eval-title">${escapeHtml(evalTitle)}</span>
                    </div>
                    <div class="demande-date">Demandé le ${escapeHtml(dateStr)}</div>
                </div>
                <div class="demande-card-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    },

    _renderDemandesView() {
        const demandes = this._getDemandesEnAttente();
        const traitees = this._getDemandesTraitees();

        let html = '';

        // Section demandes en attente
        if (demandes.length === 0 && traitees.length === 0) {
            return '<div class="demandes-empty-state">Aucune demande.</div>';
        }

        if (demandes.length > 0) {
            html += '<div class="demandes-list">';
            html += demandes.map(d => this._renderDemandeCard(d)).join('');
            html += '</div>';
        } else {
            html += '<div class="demandes-empty-state">Aucune demande en attente.</div>';
        }

        // Section demandes traitées (dépliant fermé par défaut)
        if (traitees.length > 0) {
            html += `
                <details class="demandes-traitees-details">
                    <summary class="demandes-traitees-summary">
                        Demandes traitées <span class="demandes-traitees-count">${traitees.length}</span>
                    </summary>
                    <div class="demandes-list treated">
                        ${traitees.map(d => this._renderDemandeCard(d, { treated: true })).join('')}
                    </div>
                </details>
            `;
        }

        return html;
    },

    renderEvaluationCard(evaluation) {
        const typeClass = evaluation.type || 'connaissances';
        const statusClass = evaluation.statut || 'brouillon';
        const order = evaluation.ordre || this._getEvaluationOrder(evaluation);

        // Status labels
        const statusLabels = {
            'brouillon': '📝 Brouillon',
            'planifiee': '📅 Planifiée',
            'publiee': '🟢 En cours',
            'terminee': '✅ Terminée'
        };

        // Order badge
        const typeIcons = {
            'connaissances': order,
            'savoir-faire': `B${order}`,
            'competences': order,
            'bonus': '⭐'
        };

        // Matière badge
        const matiere = evaluation.matiere || '';
        let matiereBadge = '';
        if (matiere === 'FR') {
            matiereBadge = '<span class="matiere-badge fr">🇫🇷 FR</span>';
        } else if (matiere === 'HG-EMC') {
            matiereBadge = '<span class="matiere-badge hg">🌍 HG</span>';
        } else if (matiere === 'Les deux') {
            matiereBadge = '<span class="matiere-badge both">🔗 FR+HG</span>';
        }

        // Results stats
        const evalResults = this.resultats.filter(r =>
            String(r.evaluation_id).trim() === String(evaluation.id).trim()
        );
        const isBonusType = evaluation.type === 'bonus' && String(evaluation.sous_type_bonus || '').trim() !== 'suivi';

        // Pour les bonus comp/ponctuel : compter les demandes, pas tous les élèves
        let totalEleves, saisis, validated, statsLabel;
        if (isBonusType) {
            const demandes = evalResults.filter(r => String(r.demande_statut || '').trim());
            totalEleves = demandes.length;
            saisis = demandes.length;
            validated = evalResults.filter(r => r.is_validated === true || r.is_validated === 'true').length;
            statsLabel = totalEleves === 1 ? 'Demande' : 'Demandes';
        } else {
            totalEleves = this.eleves.length || 25;
            saisis = evalResults.length;
            validated = evalResults.filter(r => r.is_validated === true || r.is_validated === 'true').length;
            statsLabel = 'Saisis';
        }

        // Type-specific meta info
        let metaItems = [];
        if (evaluation.type === 'connaissances') {
            metaItems = [
                `🎯 ${evaluation.briques || 2} pts`,
                `📊 Seuil: ${evaluation.seuil || 80}%`
            ];
        } else if (evaluation.type === 'savoir-faire') {
            metaItems = [
                `🎯 ${evaluation.briques || 2} pts`
            ];
        } else if (evaluation.type === 'competences') {
            metaItems = [
                `🎯 ${evaluation.briques || 2} pts`
            ];
        } else if (evaluation.type === 'bonus') {
            metaItems = [
                `🎯 ${evaluation.briques || 5} pts max`
            ];
        }

        // Add date info if present
        if (evaluation.mode_passation === 'papier' && evaluation.date_ouverture) {
            metaItems.push(`📅 ${this._formatDateShort(evaluation.date_ouverture)}`);
        } else {
            if (evaluation.date_ouverture) {
                metaItems.push(`📅 Ouverture: ${this._formatDateShort(evaluation.date_ouverture)}`);
            }
            if (evaluation.date_fermeture) {
                metaItems.push(`🔒 Fermeture: ${this._formatDateShort(evaluation.date_fermeture)}`);
            }
        }

        // Count pending demandes for bonus types
        const pendingDemandes = isBonusType ? evalResults.filter(r => String(r.demande_statut || '').trim() === 'demande').length : 0;

        const statsHtml = `
            <div class="eval-card-stats">
                ${pendingDemandes > 0 ? `
                <div class="eval-stat eval-stat-alert">
                    <div class="eval-stat-value">${pendingDemandes}</div>
                    <div class="eval-stat-label">En attente</div>
                </div>` : ''}
                <div class="eval-stat">
                    <div class="eval-stat-value">${isBonusType ? totalEleves : `${saisis}/${totalEleves}`}</div>
                    <div class="eval-stat-label">${statsLabel}</div>
                </div>
                ${validated > 0 ? `
                <div class="eval-stat">
                    <div class="eval-stat-value">${validated}</div>
                    <div class="eval-stat-label">Validés</div>
                </div>` : ''}
            </div>
        `;

        const canSaisir = statusClass === 'publiee' || statusClass === 'terminee' || statusClass === 'planifiee';

        return `
            <div class="eval-card ${typeClass}" data-id="${evaluation.id}">
                <div class="eval-card-main">
                    <div class="eval-card-order ${typeClass}">${typeIcons[typeClass] || order}</div>
                    <div class="eval-card-content">
                        <div class="eval-card-title">
                            ${escapeHtml(evaluation.titre || 'Sans titre')}
                            ${matiereBadge}
                            ${(() => { const sem = this._getSemestreTag(evaluation); return sem ? `<span class="sem-tag">${sem}</span>` : ''; })()}
                            <span class="mode-badge ${evaluation.type === 'competences' || evaluation.mode_passation === 'papier' ? 'papier' : 'numerique'}">${evaluation.type === 'competences' ? '📝 En classe' : evaluation.mode_passation === 'papier' ? '📄 Papier' : '💻 Numérique'}</span>
                            <span class="status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                            ${evaluation.type === 'competences' && (evaluation.sujet_disponible_avance === true || evaluation.sujet_disponible_avance === 'true' || evaluation.sujet_disponible_avance === 'TRUE') ? '<span class="mode-badge sujet-avance">👁 Sujet visible</span>' : ''}
                        </div>
                        <div class="eval-card-meta">
                            ${metaItems.map(item => `<span>${item}</span>`).join('')}
                        </div>
                    </div>
                    ${statsHtml}
                    <div class="eval-card-actions">
                        <button class="btn-icon" onclick="AdminEvaluations.editEvaluation('${evaluation.id}')" title="Modifier">✏️</button>
                        ${canSaisir ? `<button class="btn-icon" onclick="AdminEvaluations.openSaisie('${evaluation.id}')" title="Saisir résultats">📝</button>` : ''}
                        <div class="status-dropdown-wrapper">
                            <button class="btn-icon" onclick="AdminEvaluations.toggleStatusDropdown(event, '${evaluation.id}')" title="Changer le statut">
                                <span class="status-dot ${statusClass}"></span>
                            </button>
                            ${this._renderStatusDropdown(evaluation)}
                        </div>
                        <button class="btn-icon danger" onclick="AdminEvaluations.confirmDelete('${evaluation.id}', 'evaluation')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    },

    _getEvaluationOrder(evaluation) {
        const sameType = this.evaluations.filter(e => e.type === evaluation.type);
        const index = sameType.findIndex(e => e.id === evaluation.id);
        return index >= 0 ? index + 1 : 1;
    },

    /**
     * Détermine le semestre d'une évaluation à partir de sa date
     * et des plages de dates dans PARAMETRES_NOTES.
     */
    _getSemestreTag(ev) {
        const dateStr = ev.date_ouverture || ev.date_debut || '';
        let evalDate;
        if (dateStr) {
            evalDate = new Date(dateStr);
            if (isNaN(evalDate.getTime())) evalDate = new Date();
        } else {
            evalDate = new Date(); // Fallback: date du jour
        }

        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && evalDate >= debut && evalDate <= fin) {
                return 'S' + p.semestre;
            }
        }
        return '';
    },


    /**
     * Normalise une date (venant de Google Sheets ou autre) vers le format
     * attendu par <input type="datetime-local"> : YYYY-MM-DDTHH:MM
     */
    _toDateTimeLocal(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    _formatDateShort(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return dateStr; }
    },

    // ========== SOMMATIVES RENDER ==========
    _renderSommatives() {
        const container = document.getElementById('evaluationsList');
        const emptyState = document.getElementById('emptyState');

        const filtered = this._filterSommativesByMatiere(this.sommatives);

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = filtered.map(s => this._renderSommativeCard(s)).join('');
        }
    },

    _renderSommativeCard(sommative) {
        const matiere = sommative.matiere || 'FR';
        let matiereBadge = '';
        if (matiere === 'FR') {
            matiereBadge = '<span class="matiere-badge fr">🇫🇷 FR</span>';
        } else if (matiere === 'HG-EMC') {
            matiereBadge = '<span class="matiere-badge hg">🌍 HG</span>';
        } else if (matiere === 'Les deux') {
            matiereBadge = '<span class="matiere-badge both">🔗 FR+HG</span>';
        }

        // Count results
        const somResults = this.resultatsSommatives.filter(r =>
            String(r.sommative_id).trim() === String(sommative.id).trim()
        );
        const saisis = somResults.filter(r => r.note !== '' && r.note !== undefined).length;
        const totalEleves = this.eleves.length || 25;

        return `
            <div class="eval-card sommatives" data-id="${sommative.id}">
                <div class="eval-card-main">
                    <div class="eval-card-order sommatives">/${sommative.bareme || 20}</div>
                    <div class="eval-card-content">
                        <div class="eval-card-title">
                            ${escapeHtml(sommative.titre || 'Sans titre')}
                            ${matiereBadge}
                            ${sommative.date ? `<span class="date-badge">📅 ${sommative.date}</span>` : ''}
                        </div>
                        <div class="eval-card-meta">
                            <span>📊 Coef. ${sommative.coefficient || 1}</span>
                            <span>📅 S${sommative.semestre || 1}</span>
                        </div>
                    </div>
                    <div class="eval-card-stats">
                        <div class="eval-stat">
                            <div class="eval-stat-value">${saisis}/${totalEleves}</div>
                            <div class="eval-stat-label">Notes saisies</div>
                        </div>
                    </div>
                    <div class="eval-card-actions">
                        <button class="btn-icon" onclick="AdminEvaluations.openSaisieSommative('${sommative.id}')" title="Saisir notes">📝</button>
                        <button class="btn-icon" onclick="AdminEvaluations.editSommative('${sommative.id}')" title="Modifier">✏️</button>
                        <button class="btn-icon danger" onclick="AdminEvaluations.confirmDelete('${sommative.id}', 'sommative')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== EVALUATION MODAL (WIZARD) ==========
    async openModal(evaluation = null) {
        const title = document.getElementById('evaluationModalTitle');
        const isEdit = !!evaluation;

        // Type is always determined by current tab (no step 1)
        const type = isEdit ? evaluation.type : (this.currentType !== 'sommatives' ? this.currentType : 'connaissances');
        const typeLabels = { 'connaissances': 'connaissances', 'savoir-faire': 'savoir-faire', 'competences': 'compétences', 'bonus': 'bonus' };

        // Rafraîchir les données TC/comp/bonus pour refléter les changements faits dans Banques d'exercices
        if (type === 'competences' || type === 'bonus') {
            SheetsAPI.clearCacheFor('BanquesCompetences');
            SheetsAPI.clearCacheFor('EntrainementsCompetences');
            SheetsAPI.clearCacheFor('CompetencesReferentiel');
            await this.loadData();
        }

        if (isEdit) {
            title.textContent = `Modifier l'évaluation de ${typeLabels[type] || type}`;
            document.getElementById('editEvaluationId').value = evaluation.id;
            document.getElementById('evalEntrainementConnId').value = evaluation.entrainement_conn_id || '';
            this.wizardData = { ...evaluation };
            // Normalise dates pour input datetime-local
            this.wizardData.date_ouverture = this._toDateTimeLocal(evaluation.date_ouverture);
            this.wizardData.date_fermeture = this._toDateTimeLocal(evaluation.date_fermeture);
            // Pour les évals papier, extraire la date simple depuis date_ouverture
            if (evaluation.mode_passation === 'papier' && evaluation.date_ouverture) {
                this.wizardData.date_evaluation = this._splitDateTime(evaluation.date_ouverture)[0];
            }
        } else {
            title.textContent = `Nouvelle évaluation de ${typeLabels[type] || type}`;
            document.getElementById('editEvaluationId').value = '';
            document.getElementById('evalEntrainementConnId').value = '';
            this.wizardData = {
                type: type,
                matiere: this.currentMatiere,
                briques: 3,
                statut: 'brouillon',
                seuil: 80
            };
        }

        // Compétences = toujours tâche complexe
        if (type === 'competences') {
            this.wizardData.sous_type_comp = 'tache_complexe';
        }

        // Always start at step 1 (Paramètres) — no type selection step
        this.wizardStep = 1;
        this._renderWizardStep();
        document.getElementById('evaluationModal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('evaluationModal').classList.add('hidden');
        this.wizardStep = 1;
        this.wizardData = {};
    },

    // ========== WIZARD NAVIGATION ==========
    // Wizard now has 2 steps max: 1=Paramètres, 2=Sujet (conn/SF only)

    _getMaxStep() {
        const type = this.wizardData.type;
        // Conn/SF : 2 étapes (Paramètres + Sélection sujet)
        if (type === 'connaissances' || type === 'savoir-faire') return 2;
        // TC : 5 étapes (Paramètres + Compétences + Document + Corrigé + Résumé)
        if (type === 'competences') return 5;
        // Bonus compétence : 5 étapes (Paramètres + Compétence + Document + Corrigé + Résumé)
        if (type === 'bonus' && this.wizardData.sous_type_bonus === 'competence') return 5;
        // Bonus ponctuel : 5 étapes (Paramètres + Document + Corrigé + Critères + Résumé)
        if (type === 'bonus' && this.wizardData.sous_type_bonus === 'ponctuel') return 5;
        // Bonus suivi : 1 étape (Paramètres)
        return 1;
    },

    /**
     * Labels des étapes du wizard selon le type d'évaluation.
     */
    _getStepLabels() {
        const type = this.wizardData.type;
        if (type === 'connaissances' || type === 'savoir-faire') {
            return ['Paramètres', 'Sujet'];
        }
        if (type === 'competences') {
            return ['Paramètres', 'Compétences', 'Document', 'Corrigé', 'Résumé'];
        }
        if (type === 'bonus' && this.wizardData.sous_type_bonus === 'competence') {
            return ['Paramètres', 'Compétence', 'Document', 'Corrigé', 'Résumé'];
        }
        if (type === 'bonus' && this.wizardData.sous_type_bonus === 'ponctuel') {
            return ['Paramètres', 'Document', 'Corrigé', 'Critères', 'Résumé'];
        }
        return ['Paramètres'];
    },

    wizardNext() {
        const maxStep = this._getMaxStep();

        // On the last step, save
        if (this.wizardStep >= maxStep) {
            this.saveEvaluation();
            return;
        }

        // Collect data from current step before advancing
        if (!this._collectWizardStepData()) return;

        this.wizardStep++;
        this._renderWizardStep();
    },

    wizardPrev() {
        if (this.wizardStep <= 1) return;
        this._collectWizardStepData();
        this.wizardStep--;
        this._renderWizardStep();
    },

    _updateWizardStepper() {
        const maxStep = this._getMaxStep();
        const labels = this._getStepLabels();
        const stepper = document.getElementById('evalWizardStepper');

        // Générer le stepper dynamiquement
        let html = '';
        for (let i = 1; i <= maxStep; i++) {
            if (i > 1) html += '<div class="eval-step-connector"></div>';
            const active = i === this.wizardStep ? ' active' : '';
            const completed = i < this.wizardStep ? ' completed' : '';
            html += `<button class="eval-wizard-step${active}${completed}" data-step="${i}">
                <span class="eval-step-number">${completed ? '✓' : i}</span>
                <span class="eval-step-label">${labels[i - 1] || ''}</span>
            </button>`;
        }
        if (stepper) stepper.innerHTML = html;

        // Navigation buttons
        const prevBtn = document.getElementById('evalWizardPrevBtn');
        const nextBtn = document.getElementById('evalWizardNextBtn');
        prevBtn.style.display = this.wizardStep > 1 ? '' : 'none';
        nextBtn.textContent = this.wizardStep >= maxStep ? 'Enregistrer' : 'Suivant →';
    },

    _renderWizardStep() {
        const content = document.getElementById('evalWizardContent');
        this._updateWizardStepper();

        const type = this.wizardData.type;
        const sousType = this.wizardData.sous_type_bonus || '';

        // Step 1 = Paramètres (all types)
        if (this.wizardStep === 1) {
            content.innerHTML = this._renderStep2();
            return;
        }

        // Conn/SF : Step 2 = Sujet (cascade dropdown, inchangé)
        if (type === 'connaissances' || type === 'savoir-faire') {
            content.innerHTML = this._renderStep3();
            return;
        }

        // TC : Steps 2-5
        if (type === 'competences') {
            switch (this.wizardStep) {
                case 2: content.innerHTML = this._renderStepCompetences(); this._initStepCompetences(); break;
                case 3: content.innerHTML = this._renderStepDocument(); this._initStepDocument(); break;
                case 4: content.innerHTML = this._renderStepCorrige(); this._initStepCorrige(); break;
                case 5: content.innerHTML = this._renderStepResume(); break;
            }
            return;
        }

        // Bonus compétence : Steps 2-5
        if (type === 'bonus' && sousType === 'competence') {
            switch (this.wizardStep) {
                case 2: content.innerHTML = this._renderStepCompetenceUnique(); this._initStepCompetenceUnique(); break;
                case 3: content.innerHTML = this._renderStepDocument(); this._initStepDocument(); break;
                case 4: content.innerHTML = this._renderStepCorrige(); this._initStepCorrige(); break;
                case 5: content.innerHTML = this._renderStepResume(); break;
            }
            return;
        }

        // Bonus ponctuel : Steps 2-5
        if (type === 'bonus' && sousType === 'ponctuel') {
            switch (this.wizardStep) {
                case 2: content.innerHTML = this._renderStepDocument(); this._initStepDocument(); break;
                case 3: content.innerHTML = this._renderStepCorrige(); this._initStepCorrige(); break;
                case 4: content.innerHTML = this._renderStepCriteresLibres(); this._initStepCriteresLibres(); break;
                case 5: content.innerHTML = this._renderStepResume(); break;
            }
            return;
        }
    },

    // ========== STEP 1: PARAMÈTRES ==========

    _renderStep2() {
        const d = this.wizardData;
        const type = d.type;

        let typeSpecificHTML = '';
        if (type === 'connaissances') {
            typeSpecificHTML = this._renderConnFields(d);
        } else if (type === 'savoir-faire') {
            typeSpecificHTML = this._renderDefaultFields(d);
        } else if (type === 'competences') {
            typeSpecificHTML = this._renderCompFields(d);
        } else if (type === 'bonus') {
            typeSpecificHTML = this._renderBonusFields(d);
        }

        return `
            <div class="eval-wizard-step-content">
                <div class="step-header">
                    <h3>Paramètres</h3>
                    <p>Configurez les détails de l'évaluation</p>
                </div>
                <div class="wizard-form">
                    <div class="form-group full-width">
                        <label>Titre <span class="req">*</span></label>
                        <input type="text" class="form-input" id="evalTitre" value="${escapeHtml(d.titre || '')}" placeholder="Ex: Evaluation chapitre 1">
                    </div>
                    ${type === 'bonus' ? `
                    <div class="form-row">
                        <div class="form-group" id="evalMatiereGroup">
                            <label>Matière <span class="req">*</span></label>
                            <select class="form-select" id="evalMatiere">
                                <option value="FR" ${d.matiere === 'FR' || !d.matiere ? 'selected' : ''}>🇫🇷 Français</option>
                                <option value="HG-EMC" ${d.matiere === 'HG-EMC' ? 'selected' : ''}>🌍 HG-EMC</option>
                                <option value="Les deux" ${d.matiere === 'Les deux' ? 'selected' : ''}>🔗 Les deux</option>
                            </select>
                        </div>
                        <div class="form-group"></div>
                    </div>
                    <select id="evalCategorie" style="display:none"><option value="" selected></option></select>` : `
                    <div style="display:none">
                        <select id="evalMatiere"><option value="${type === 'competences' ? 'Les deux' : 'FR'}" selected></option></select>
                        <select id="evalCategorie"><option value="" selected></option></select>
                    </div>`}
                    <div class="form-row">
                        <div class="form-group" ${(type === 'competences' || (type === 'bonus' && d.sous_type_bonus === 'competence')) ? 'style="display:none"' : ''}>
                            <label>Points mis en jeu <span class="req">*</span></label>
                            <input type="number" class="form-input" id="evalBriques" value="${d.briques || 3}" min="0.25" max="50" step="0.25">
                            ${(type === 'competences' || (type === 'bonus' && d.sous_type_bonus === 'competence')) ? '<div class="form-help">Calculé automatiquement depuis les points par compétence</div>' : ''}
                        </div>
                        <div class="form-group" ${(type === 'competences' || type === 'bonus') ? 'style="display:none"' : ''}>
                            <label>Mode de passation</label>
                            <select class="form-select" id="evalModePassation" onchange="AdminEvaluations._onModePassationChange()">
                                <option value="numerique" ${d.mode_passation === 'numerique' || !d.mode_passation ? 'selected' : ''}>💻 Numérique</option>
                                <option value="papier" ${d.mode_passation === 'papier' || type === 'competences' || type === 'bonus' ? 'selected' : ''}>📄 Papier</option>
                            </select>
                            <div class="form-help">Papier : pas de bouton « Commencer » côté élève</div>
                        </div>
                    </div>
                    ${typeSpecificHTML}
                </div>
            </div>
        `;
    },

    _renderConnFields(d) {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Seuil de réussite (%) <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalSeuil" value="${d.seuil || 80}" min="0" max="100">
                    <div class="form-help">Score minimum pour valider</div>
                </div>
                <div class="form-group"></div>
            </div>
        `;
    },

    /**
     * À l'initialisation, met à jour le statut en mémoire des évals numériques avec dates.
     * Après ça, la carte affiche toujours evaluation.statut (pas de recalcul à chaque rendu).
     */
    _syncStatutsFromDates() {
        const toUpdate = [];
        for (const ev of this.evaluations) {
            if (ev.mode_passation === 'papier') continue;
            // Brouillon/terminée = décision manuelle de la prof, on ne l'écrase jamais
            if (ev.statut === 'brouillon' || ev.statut === 'terminee') continue;
            if (!ev.date_ouverture && !ev.date_fermeture) continue;
            const newStatut = this._computeAutoStatut(ev.date_ouverture, ev.date_fermeture);
            if (newStatut !== ev.statut) {
                toUpdate.push({ id: ev.id, oldStatut: ev.statut, newStatut });
                ev.statut = newStatut;
            }
        }
        // Persister les changements de statut en arrière-plan (fire-and-forget)
        for (const u of toUpdate) {
            this.callAPI('updateEvaluation', { id: u.id, statut: u.newStatut }).catch(() => {
                console.warn('Échec sync statut auto pour eval', u.id);
            });
        }
        if (toUpdate.length > 0) {
            SheetsAPI.clearCacheFor('EVALUATIONS');
        }
    },

    /**
     * Compute auto status from dates
     */
    _computeAutoStatut(dateOuverture, dateFermeture) {
        const now = new Date();
        if (dateOuverture) {
            const ouv = new Date(dateOuverture);
            if (ouv > now) return 'planifiee';
        }
        if (dateFermeture) {
            const ferm = new Date(dateFermeture);
            if (ferm < now) return 'terminee';
        }
        // Between ouverture and fermeture (or only ouverture set and passed)
        if (dateOuverture || dateFermeture) return 'publiee';
        return 'brouillon';
    },

    _getStatutLabel(statut) {
        const labels = {
            'brouillon': '📝 Brouillon',
            'planifiee': '📅 Planifiée',
            'publiee': '🟢 En cours',
            'terminee': '✅ Terminée'
        };
        return labels[statut] || statut;
    },


    /**
     * Convertit "HH:MM" ou "HHhMM" → affichage français "HHhMM". Vide → "".
     */
    _formatTimeFR(val) {
        if (!val) return '';
        const clean = val.replace('h', ':');
        const [h, m] = clean.split(':');
        if (!h) return '';
        return h.padStart(2, '0') + 'h' + (m || '00').padStart(2, '0');
    },

    /**
     * Parse une heure saisie par l'utilisateur (formats acceptés : "10h30", "10:30", "1030", "10h").
     * Retourne "HH:MM" ou null si invalide.
     */
    _parseTimeFR(val) {
        if (!val || !val.trim()) return null;
        const s = val.trim();
        let h, m;
        if (s.includes('h') || s.includes('H')) {
            const parts = s.toLowerCase().split('h');
            h = parseInt(parts[0], 10);
            m = parts[1] ? parseInt(parts[1], 10) : 0;
        } else if (s.includes(':')) {
            const parts = s.split(':');
            h = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
        } else if (s.length === 4 && /^\d{4}$/.test(s)) {
            h = parseInt(s.substring(0, 2), 10);
            m = parseInt(s.substring(2, 4), 10);
        } else if (s.length <= 2 && /^\d+$/.test(s)) {
            h = parseInt(s, 10);
            m = 0;
        } else {
            return null;
        }
        if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
        return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    },

    /**
     * Sépare une date-heure ("YYYY-MM-DDTHH:MM" ou "YYYY-MM-DD HH:MM") en [datePart, timePart].
     */
    _splitDateTime(val) {
        if (!val) return ['', ''];
        // Séparer sur T ou espace
        const sep = val.includes('T') ? 'T' : ' ';
        const parts = val.split(sep);
        return [parts[0] || '', (parts[1] || '').substring(0, 5)];
    },

    /**
     * Rend le dropdown de statut avec les 4 options : Brouillon, Publier, Programmer, Terminer.
     * L'option "Programmer" intègre un mini-formulaire de dates inline.
     */
    _renderStatusDropdown(evaluation) {
        const id = evaluation.id;
        const statut = evaluation.statut || 'brouillon';
        const isPapier = evaluation.mode_passation === 'papier';

        // Extraire date/heure actuelles pour pré-remplir le formulaire
        // Les dates peuvent être au format "YYYY-MM-DDTHH:MM" ou "YYYY-MM-DD HH:MM"
        const dateOuv = evaluation.date_ouverture || '';
        const dateFerm = evaluation.date_fermeture || '';
        const [datePartOuv, timePartOuv] = this._splitDateTime(dateOuv);
        const [datePartFerm, timePartFerm] = this._splitDateTime(dateFerm);

        const isProgrammed = statut === 'planifiee' || (statut === 'publiee' && dateOuv);

        return `
            <div class="status-dropdown" id="status-dropdown-${id}">
                <button class="${statut === 'brouillon' ? 'active' : ''}" onclick="AdminEvaluations.changeStatut('${id}', 'brouillon')">
                    <span class="status-dot-mini brouillon"></span> Brouillon
                </button>
                <button class="${statut === 'publiee' && !dateOuv ? 'active' : ''}" onclick="AdminEvaluations._publishNow('${id}')">
                    <span class="status-dot-mini publiee"></span> Publier maintenant
                </button>
                <div class="status-dropdown-separator"></div>
                <div class="status-dropdown-schedule ${isProgrammed ? 'active' : ''}">
                    <button class="schedule-toggle ${isProgrammed ? 'active' : ''}" onclick="AdminEvaluations._toggleSchedulePanel(event, '${id}')">
                        <span class="status-dot-mini planifiee"></span> Programmer
                        <span class="schedule-chevron">${isProgrammed ? '▾' : '▸'}</span>
                    </button>
                    <div class="schedule-panel" id="schedule-panel-${id}" style="${isProgrammed ? '' : 'display:none'}">
                        <div class="schedule-field">
                            <label>${isPapier ? 'Date' : 'Ouverture'}</label>
                            <div class="schedule-date-row">
                                <input type="date" class="schedule-input" id="schedDate-${id}" value="${datePartOuv}">
                                ${isPapier ? '' : `<input type="text" class="schedule-input schedule-time" id="schedTimeOuv-${id}" value="${this._formatTimeFR(timePartOuv)}" placeholder="HH:MM">`}
                            </div>
                        </div>
                        ${isPapier ? '' : `
                        <div class="schedule-field">
                            <label>Fermeture <span class="schedule-optional">(optionnel)</span></label>
                            <div class="schedule-date-row">
                                <input type="date" class="schedule-input" id="schedDateFerm-${id}" value="${datePartFerm}">
                                <input type="text" class="schedule-input schedule-time" id="schedTimeFerm-${id}" value="${this._formatTimeFR(timePartFerm)}" placeholder="HH:MM">
                            </div>
                        </div>`}
                        <button class="schedule-save-btn" onclick="AdminEvaluations._saveSchedule('${id}')">
                            Enregistrer
                        </button>
                    </div>
                </div>
                <div class="status-dropdown-separator"></div>
                <button class="${statut === 'terminee' ? 'active' : ''}" onclick="AdminEvaluations.changeStatut('${id}', 'terminee')">
                    <span class="status-dot-mini terminee"></span> Terminer
                </button>
            </div>`;
    },

    /**
     * Publie immédiatement (supprime les dates de programmation).
     */
    async _publishNow(evalId) {
        document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));
        const evaluation = this.evaluations.find(e => String(e.id) === String(evalId));
        if (!evaluation) return;

        const oldStatut = evaluation.statut;
        const oldDateOuv = evaluation.date_ouverture;
        const oldDateFerm = evaluation.date_fermeture;

        // Mise à jour optimiste
        evaluation.statut = 'publiee';
        evaluation.date_ouverture = '';
        evaluation.date_fermeture = '';
        this.renderEvaluations();

        try {
            const result = await this.callAPI('updateEvaluation', {
                id: evalId, statut: 'publiee', date_ouverture: '', date_fermeture: ''
            });
            if (!result.success) {
                evaluation.statut = oldStatut;
                evaluation.date_ouverture = oldDateOuv;
                evaluation.date_fermeture = oldDateFerm;
                this.renderEvaluations();
                this.showNotification('Erreur lors de la publication', 'error');
            } else {
                SheetsAPI.clearCacheFor('EVALUATIONS');
            }
        } catch (_err) {
            evaluation.statut = oldStatut;
            evaluation.date_ouverture = oldDateOuv;
            evaluation.date_fermeture = oldDateFerm;
            this.renderEvaluations();
            this.showNotification('Erreur réseau', 'error');
        }
    },

    /**
     * Toggle le panneau de programmation dans le dropdown.
     */
    _toggleSchedulePanel(event, evalId) {
        event.stopPropagation();
        const panel = document.getElementById(`schedule-panel-${evalId}`);
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : '';
        }
    },

    /**
     * Sauvegarde les dates depuis le panneau de programmation du dropdown.
     */
    async _saveSchedule(evalId) {
        const evaluation = this.evaluations.find(e => String(e.id) === String(evalId));
        if (!evaluation) return;

        const isPapier = evaluation.mode_passation === 'papier';
        const dateStr = document.getElementById(`schedDate-${evalId}`)?.value || '';

        if (!dateStr) {
            this.showNotification('Veuillez sélectionner une date', 'error');
            return;
        }

        let dateOuverture = '';
        let dateFermeture = '';

        if (isPapier) {
            dateOuverture = dateStr;
        } else {
            const rawTimeOuv = document.getElementById(`schedTimeOuv-${evalId}`)?.value || '';
            const timeOuv = this._parseTimeFR(rawTimeOuv) || '08:00';
            dateOuverture = dateStr + 'T' + timeOuv;

            const dateFermStr = document.getElementById(`schedDateFerm-${evalId}`)?.value || '';
            if (dateFermStr) {
                const rawTimeFerm = document.getElementById(`schedTimeFerm-${evalId}`)?.value || '';
                const timeFerm = this._parseTimeFR(rawTimeFerm) || '18:00';
                dateFermeture = dateFermStr + 'T' + timeFerm;
            }
        }

        // Calculer le statut effectif
        const now = new Date();
        const ouv = new Date(dateOuverture);
        let newStatut = ouv > now ? 'planifiee' : 'publiee';

        document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));

        const oldStatut = evaluation.statut;
        const oldDateOuv = evaluation.date_ouverture;
        const oldDateFerm = evaluation.date_fermeture;

        // Mise à jour optimiste
        evaluation.statut = newStatut;
        evaluation.date_ouverture = dateOuverture;
        evaluation.date_fermeture = dateFermeture;
        this.renderEvaluations();

        try {
            const result = await this.callAPI('updateEvaluation', {
                id: evalId,
                statut: newStatut,
                date_ouverture: dateOuverture,
                date_fermeture: dateFermeture
            });
            if (!result.success) {
                evaluation.statut = oldStatut;
                evaluation.date_ouverture = oldDateOuv;
                evaluation.date_fermeture = oldDateFerm;
                this.renderEvaluations();
                this.showNotification('Erreur lors de la programmation', 'error');
            } else {
                SheetsAPI.clearCacheFor('EVALUATIONS');
                this.showNotification('Programmation enregistrée', 'success');
            }
        } catch (_err) {
            evaluation.statut = oldStatut;
            evaluation.date_ouverture = oldDateOuv;
            evaluation.date_fermeture = oldDateFerm;
            this.renderEvaluations();
            this.showNotification('Erreur réseau', 'error');
        }
    },

    _onModePassationChange() {
        this._collectCurrentFormFields();
        this.wizardData.mode_passation = document.getElementById('evalModePassation')?.value || 'numerique';
        this._renderWizardStep();
    },

    /**
     * Sauvegarde les valeurs actuelles de tous les champs du wizard step 1
     * dans wizardData, sans validation (pas de blocage si titre vide).
     * Utilisé avant un re-render pour ne pas perdre la saisie utilisateur.
     */
    _collectCurrentFormFields() {
        const titre = document.getElementById('evalTitre')?.value;
        if (titre !== undefined) this.wizardData.titre = titre.trim();

        const briques = document.getElementById('evalBriques')?.value;
        if (briques) this.wizardData.briques = parseFloat(briques) || 3;

        const seuil = document.getElementById('evalSeuil')?.value;
        if (seuil) this.wizardData.seuil = parseInt(seuil) || 80;

        const modePassation = document.getElementById('evalModePassation')?.value;
        if (modePassation) this.wizardData.mode_passation = modePassation;

        const matiereGroup = document.getElementById('evalMatiereGroup');
        if (matiereGroup && matiereGroup.style.display !== 'none') {
            this.wizardData.matiere = document.getElementById('evalMatiere')?.value || 'FR';
        }

        if (this.wizardData.type === 'bonus') {
            this.wizardData.categorie = document.getElementById('evalCategorie')?.value || 'connaissances';
            const descEl = document.getElementById('evalDescriptionEleve')?.value;
            if (descEl !== undefined) this.wizardData.description_eleve = descEl.trim();
        }

        const criteres = document.getElementById('evalCriteres')?.value;
        if (criteres !== undefined) this.wizardData.criteres = criteres.trim();

        const methodologie = document.getElementById('evalMethodologieTC')?.value;
        if (methodologie !== undefined) this.wizardData.methodologie_id = methodologie;

        const sujetAvance = document.getElementById('evalSujetAvance');
        if (sujetAvance) this.wizardData.sujet_disponible_avance = sujetAvance.checked;

        const dateOuv = document.getElementById('evalDateOuverture');
        if (dateOuv) this.wizardData.date_ouverture = dateOuv.value || '';

        const dateFerm = document.getElementById('evalDateFermeture');
        if (dateFerm) this.wizardData.date_fermeture = dateFerm.value || '';
    },

    _renderDefaultFields() {
        return '';
    },

    _renderCompFields(d) {
        const checked = d.sujet_disponible_avance === true || d.sujet_disponible_avance === 'true' || d.sujet_disponible_avance === 'TRUE';
        return `
            <div class="form-group">
                <label class="toggle-label">
                    <input type="checkbox" id="evalSujetAvance" ${checked ? 'checked' : ''}>
                    <span>Sujet visible par les élèves</span>
                </label>
                <div class="form-help">Si activé, les élèves pourront consulter le sujet depuis leur carte d'évaluation</div>
            </div>
        `;
    },

    _renderBonusFields(d) {
        const sousType = d.sous_type_bonus || 'competence';

        let sousTypeFields = '';
        if (sousType === 'suivi') {
            sousTypeFields = `
                <div class="form-group">
                    <label>Nombre de validations requises <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalNbValidations" value="${d.nb_validations || 5}" min="1" max="50">
                    <div class="form-help">L'élève doit réussir ce nombre de fois pour obtenir les points (saisis dans le tableau de résultats)</div>
                </div>
                <div class="form-group">
                    <label>Description pour l'élève</label>
                    <textarea class="form-input" id="evalDescriptionEleve" rows="3" placeholder="Ex : Apporter ses affaires à chaque cours, réviser le vocabulaire...">${escapeHtml(d.description_eleve || '')}</textarea>
                    <div class="form-help">Ce texte sera visible par l'élève sur la carte de ce bonus</div>
                </div>
            `;
        } else if (sousType === 'competence' || sousType === 'ponctuel') {
            sousTypeFields = `
                <div class="form-group">
                    <label>Description pour l'élève</label>
                    <textarea class="form-input" id="evalDescriptionEleve" rows="3" placeholder="Ex : Présenter un document à l'oral en 5 minutes...">${escapeHtml(d.description_eleve || '')}</textarea>
                    <div class="form-help">Ce texte sera visible par l'élève sur la carte de ce bonus</div>
                </div>
            `;
        }

        return `
            <div class="form-group">
                <label>Type de bonus <span class="req">*</span></label>
                <div class="sous-type-toggle" id="bonusSousTypeToggle">
                    <button type="button" class="sous-type-btn ${sousType === 'competence' ? 'active' : ''}" data-value="competence" onclick="AdminEvaluations._onBonusSousTypeChange('competence')">
                        🟣 Compétence
                    </button>
                    <button type="button" class="sous-type-btn ${sousType === 'ponctuel' ? 'active' : ''}" data-value="ponctuel" onclick="AdminEvaluations._onBonusSousTypeChange('ponctuel')">
                        🎁 Ponctuel
                    </button>
                    <button type="button" class="sous-type-btn ${sousType === 'suivi' ? 'active' : ''}" data-value="suivi" onclick="AdminEvaluations._onBonusSousTypeChange('suivi')">
                        📊 Suivi
                    </button>
                </div>
                <div class="form-help" id="bonusSousTypeHelp">${this._getBonusSousTypeHelp(sousType)}</div>
            </div>
            <div id="bonusSousTypeFields">${sousTypeFields}</div>
        `;
    },

    _getBonusSousTypeHelp(sousType) {
        if (sousType === 'competence') return 'Lié à une compétence du référentiel (comme un entraînement)';
        if (sousType === 'ponctuel') return 'Exercice ponctuel avec critères libres';
        if (sousType === 'suivi') return 'Compteur de validations (pas d\'exercice, points saisis manuellement)';
        return '';
    },

    _onBonusSousTypeChange(value) {
        this.wizardData.sous_type_bonus = value;
        // Update toggle buttons
        document.querySelectorAll('#bonusSousTypeToggle .sous-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
        // Update help text
        var help = document.getElementById('bonusSousTypeHelp');
        if (help) help.textContent = this._getBonusSousTypeHelp(value);
        // Update sous-type-specific fields
        var container = document.getElementById('bonusSousTypeFields');
        if (container) {
            if (value === 'suivi') {
                container.innerHTML = `
                    <div class="form-group">
                        <label>Nombre de validations requises <span class="req">*</span></label>
                        <input type="number" class="form-input" id="evalNbValidations" value="${this.wizardData.nb_validations || 5}" min="1" max="50">
                        <div class="form-help">L'élève doit réussir ce nombre de fois pour obtenir les points (saisis dans le tableau de résultats)</div>
                    </div>
                    <div class="form-group">
                        <label>Description pour l'élève</label>
                        <textarea class="form-input" id="evalDescriptionEleve" rows="3" placeholder="Ex : Apporter ses affaires à chaque cours, réviser le vocabulaire...">${escapeHtml(this.wizardData.description_eleve || '')}</textarea>
                        <div class="form-help">Ce texte sera visible par l'élève sur la carte de ce bonus</div>
                    </div>
                `;
            } else if (value === 'competence' || value === 'ponctuel') {
                container.innerHTML = `
                    <div class="form-group">
                        <label>Description pour l'élève</label>
                        <textarea class="form-input" id="evalDescriptionEleve" rows="3" placeholder="Ex : Présenter un document à l'oral en 5 minutes...">${escapeHtml(this.wizardData.description_eleve || '')}</textarea>
                        <div class="form-help">Ce texte sera visible par l'élève sur la carte de ce bonus</div>
                    </div>
                `;
            } else {
                container.innerHTML = '';
            }
        }
        // Update stepper (step count changes based on sous-type)
        this._updateWizardStepper();
    },

    // ========== STEP 3: SUJET (cascade dropdowns) ==========

    _renderStep3() {
        // Uniquement pour conn/SF (les TC/bonus sont gérés via _renderWizardStep)
        const type = this.wizardData.type;
        if (type === 'connaissances' || type === 'savoir-faire') {
            return this._renderStep3Auto();
        }
        return '';
    },

    _renderStep3Auto() {
        const type = this.wizardData.type;
        const matiere = this.wizardData.matiere || this.currentMatiere;
        const allBanques = type === 'connaissances'
            ? [...this.banquesExercicesConn]
            : [...this.banquesSF];
        const banques = allBanques
            .filter(b => !b.matiere || b.matiere === matiere)
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        const banquesList = banques.map((b, i) =>
            `<div class="attribution-banque-item">
                <span class="attribution-banque-order">${i + 1}</span>
                <span>${escapeHtml(b.titre || 'Sans titre')}</span>
            </div>`
        ).join('');

        return `
            <div class="eval-wizard-step-content">
                <div class="step-header">
                    <h3>Attribution des sujets</h3>
                    <p>Les sujets seront attribués automatiquement selon la progression de chaque élève</p>
                </div>
                <div class="wizard-form">
                    <div class="attribution-auto-info">
                        <div class="attribution-auto-icon">👥</div>
                        <div class="attribution-auto-text">
                            <strong>Attribution automatique</strong>
                            <p>Chaque élève recevra un sujet de sa prochaine banque non validée.
                            Après création, utilisez le bouton <strong>👥 Attribuer</strong> sur la carte
                            de l'évaluation pour visualiser et ajuster les attributions.</p>
                        </div>
                    </div>
                    <div class="attribution-banques-preview">
                        <label>Ordre des banques (${banques.length})</label>
                        ${banquesList}
                    </div>
                </div>
            </div>
        `;
    },

    // ========== PHASE 9: WIZARD STEPS FOR TC / BONUS COMP / BONUS PONCTUEL ==========

    // --- ÉTAPE COMPÉTENCES (TC : sélection multiple) ---

    _renderStepCompetences() {
        const d = this.wizardData;
        let selectedIds = [];
        if (d.competence_ids) {
            try {
                const parsed = typeof d.competence_ids === 'string' ? JSON.parse(d.competence_ids) : d.competence_ids;
                if (Array.isArray(parsed)) selectedIds = parsed.map(id => String(id));
            } catch (_e) { /* ignore */ }
        }

        // Lire les points par compétence existants
        let ppc = {};
        if (d.points_par_competence) {
            try {
                ppc = typeof d.points_par_competence === 'string' ? JSON.parse(d.points_par_competence) : d.points_par_competence;
            } catch (_e) { /* ignore */ }
        }

        const comps = (this.competencesReferentiel || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        const groups = {};
        comps.forEach(c => {
            const mat = c.matiere || 'Transversal';
            if (!groups[mat]) groups[mat] = [];
            groups[mat].push(c);
        });

        const matiereOrder = ['FR', 'HG-EMC', 'Transversal'];
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const ia = matiereOrder.indexOf(a) === -1 ? 99 : matiereOrder.indexOf(a);
            const ib = matiereOrder.indexOf(b) === -1 ? 99 : matiereOrder.indexOf(b);
            return ia - ib;
        });

        const matiereLabels = { 'FR': 'Français', 'HG-EMC': 'Histoire-Géo · EMC', 'Transversal': 'Transversal' };
        const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };

        let groupsHtml = '';
        sortedKeys.forEach(mat => {
            const label = matiereLabels[mat] || mat;
            const color = matiereColors[mat] || '#6b7280';
            const items = groups[mat];
            const selectedInGroup = items.filter(c => selectedIds.indexOf(String(c.id)) !== -1).length;
            const hasSelection = selectedInGroup > 0;
            groupsHtml += `<div class="cw-comp-group${hasSelection ? ' open' : ''}" data-matiere="${escapeHtml(mat)}">
                <button type="button" class="cw-comp-group-toggle" style="border-left: 3px solid ${color};" onclick="AdminEvaluations._toggleCompGroup(this)">
                    <span class="cw-comp-group-arrow">${hasSelection ? '▾' : '▸'}</span>
                    <span class="cw-comp-group-label" style="color: ${color};">${label}</span>
                    <span class="cw-comp-group-count">${selectedInGroup > 0 ? selectedInGroup + '/' : ''}${items.length}</span>
                </button>
                <div class="cw-comp-group-items"${hasSelection ? '' : ' style="display:none;"'}>`;
            items.forEach(c => {
                const checked = selectedIds.indexOf(String(c.id)) !== -1 ? ' checked' : '';
                const pts = ppc[String(c.id)] !== undefined ? ppc[String(c.id)] : 1;
                const isSelected = selectedIds.indexOf(String(c.id)) !== -1;
                groupsHtml += `<div class="cw-comp-checkbox-item" data-comp-name="${escapeHtml((c.nom || '').toLowerCase())}">
                    <label class="cw-comp-checkbox-row">
                        <input type="checkbox" value="${c.id}"${checked} onchange="AdminEvaluations._onCompCheckChange(this)">
                        <span class="cw-comp-checkbox-label">${escapeHtml(c.nom)}</span>
                        <span class="cw-comp-matiere-tag" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; white-space: nowrap;">${mat}</span>
                    </label>
                    <div class="cw-comp-points-input" style="${isSelected ? '' : 'display:none;'}">
                        <input type="number" class="form-input cw-comp-pts" data-comp-id="${c.id}" value="${pts}" min="0.25" max="20" step="0.25" onchange="AdminEvaluations._updateCompPointsTotal()" style="width: 70px; padding: 4px 8px; font-size: 0.85rem;">
                        <span style="font-size: 0.8rem; color: var(--gray-500);">pt${pts > 1 ? 's' : ''}</span>
                    </div>
                </div>`;
            });
            groupsHtml += '</div></div>';
        });

        if (comps.length === 0) {
            groupsHtml = '<div style="padding: 24px; text-align: center; color: var(--gray-400);">Aucune compétence dans le référentiel</div>';
        }

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Compétences évaluées</h3><p>Sélectionnez les compétences et définissez les points mis en jeu pour chacune</p></div>
            <div class="cw-comp-search-bar"><input type="text" class="form-input" id="evalCompSearch" placeholder="Rechercher une compétence..."></div>
            <div class="cw-comp-counter" id="evalCompCounter">${selectedIds.length} compétence${selectedIds.length > 1 ? 's' : ''} sélectionnée${selectedIds.length > 1 ? 's' : ''}</div>
            <div class="cw-comp-list" id="evalCompetencesCheckboxes">${groupsHtml}</div>
            <div class="cw-comp-points-total" id="evalCompPointsTotal" style="margin-top: 12px; padding: 10px 16px; background: var(--gray-50, #f9fafb); border-radius: 8px; font-weight: 600; font-size: 0.9rem;"></div>
        </div>`;
    },

    _onCompCheckChange(checkbox) {
        const item = checkbox.closest('.cw-comp-checkbox-item');
        if (!item) return;
        const ptsDiv = item.querySelector('.cw-comp-points-input');
        if (ptsDiv) ptsDiv.style.display = checkbox.checked ? '' : 'none';
        // Update counters and total
        const container = document.getElementById('evalCompetencesCheckboxes');
        if (container) {
            const n = container.querySelectorAll('input[type="checkbox"]:checked').length;
            const counter = document.getElementById('evalCompCounter');
            if (counter) {
                counter.textContent = `${n} compétence${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
                counter.style.color = n > 0 ? 'var(--accent-green, #10b981)' : 'var(--gray-400)';
            }
        }
        this._updateCompGroupCounters();
        this._updateCompPointsTotal();
    },

    _updateCompPointsTotal() {
        const container = document.getElementById('evalCompetencesCheckboxes');
        const totalEl = document.getElementById('evalCompPointsTotal');
        if (!container || !totalEl) return;

        const matiereLabels = { 'FR': 'Français', 'HG-EMC': 'HG-EMC', 'Transversal': 'Transversal' };
        const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
        const byMatiere = {};
        let total = 0;

        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const compId = cb.value;
            const item = cb.closest('.cw-comp-checkbox-item');
            const ptsInput = item ? item.querySelector('.cw-comp-pts') : null;
            const pts = ptsInput ? (parseFloat(ptsInput.value) || 0) : 1;
            total += pts;

            // Trouver la matière de la compétence
            const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
            const mat = comp ? (comp.matiere || 'Transversal') : 'Transversal';
            byMatiere[mat] = (byMatiere[mat] || 0) + pts;
        });

        if (total === 0) {
            totalEl.innerHTML = '';
            return;
        }

        let detailParts = [];
        ['FR', 'HG-EMC', 'Transversal'].forEach(mat => {
            if (byMatiere[mat]) {
                detailParts.push(`<span style="color: ${matiereColors[mat]};">${byMatiere[mat]} pt${byMatiere[mat] > 1 ? 's' : ''} ${matiereLabels[mat]}</span>`);
            }
        });

        totalEl.innerHTML = `Total : ${total} pt${total > 1 ? 's' : ''} mis en jeu` +
            (detailParts.length > 1 ? ` <span style="color: var(--gray-400); font-weight: 400;">(${detailParts.join(' · ')})</span>` : '');
    },

    _toggleCompGroup(btn) {
        const group = btn.closest('.cw-comp-group');
        if (!group) return;
        const items = group.querySelector('.cw-comp-group-items');
        const arrow = group.querySelector('.cw-comp-group-arrow');
        const isOpen = group.classList.toggle('open');
        if (items) items.style.display = isOpen ? '' : 'none';
        if (arrow) arrow.textContent = isOpen ? '▾' : '▸';
    },

    _updateCompGroupCounters() {
        document.querySelectorAll('#evalCompetencesCheckboxes .cw-comp-group').forEach(group => {
            const total = group.querySelectorAll('input[type="checkbox"]').length;
            const selected = group.querySelectorAll('input[type="checkbox"]:checked').length;
            const countEl = group.querySelector('.cw-comp-group-count');
            if (countEl) countEl.textContent = selected > 0 ? `${selected}/${total}` : `${total}`;
        });
    },

    _initStepCompetences() {
        const searchInput = document.getElementById('evalCompSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const query = this.value.toLowerCase().trim();
                document.querySelectorAll('#evalCompetencesCheckboxes .cw-comp-checkbox-item').forEach(item => {
                    item.style.display = (!query || (item.dataset.compName || '').indexOf(query) !== -1) ? '' : 'none';
                });
                document.querySelectorAll('#evalCompetencesCheckboxes .cw-comp-group').forEach(group => {
                    const visible = group.querySelectorAll('.cw-comp-checkbox-item:not([style*="display: none"])');
                    group.style.display = visible.length > 0 ? '' : 'none';
                    // Ouvrir automatiquement les groupes filtrés
                    if (query && visible.length > 0) {
                        group.classList.add('open');
                        const items = group.querySelector('.cw-comp-group-items');
                        const arrow = group.querySelector('.cw-comp-group-arrow');
                        if (items) items.style.display = '';
                        if (arrow) arrow.textContent = '▾';
                    }
                });
            });
        }
        // Calculer le total initial
        this._updateCompPointsTotal();
    },

    // --- ÉTAPE COMPÉTENCE UNIQUE (bonus compétence : sélection d'une seule) ---

    _renderStepCompetenceUnique() {
        const d = this.wizardData;
        let selectedId = '';
        if (d.competence_ids) {
            try {
                const parsed = typeof d.competence_ids === 'string' ? JSON.parse(d.competence_ids) : d.competence_ids;
                if (Array.isArray(parsed) && parsed.length > 0) selectedId = String(parsed[0]);
                else if (parsed) selectedId = String(parsed);
            } catch (_e) { /* ignore */ }
        }

        const comps = (this.competencesReferentiel || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        const groups = {};
        comps.forEach(c => {
            const mat = c.matiere || 'Transversal';
            if (!groups[mat]) groups[mat] = [];
            groups[mat].push(c);
        });

        const matiereOrder = ['FR', 'HG-EMC', 'Transversal'];
        const matiereLabels = { 'FR': 'Français', 'HG-EMC': 'Histoire-Géo · EMC', 'Transversal': 'Transversal' };
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const ia = matiereOrder.indexOf(a) === -1 ? 99 : matiereOrder.indexOf(a);
            const ib = matiereOrder.indexOf(b) === -1 ? 99 : matiereOrder.indexOf(b);
            return ia - ib;
        });

        // Déterminer la discipline pré-sélectionnée (celle de la compétence déjà choisie, ou la 1ère dispo)
        let selectedMatiere = sortedKeys[0] || '';
        if (selectedId) {
            const selComp = comps.find(c => String(c.id) === selectedId);
            if (selComp) selectedMatiere = selComp.matiere || 'Transversal';
        }

        // Dropdown disciplines
        const matiereOptions = sortedKeys.map(mat =>
            `<option value="${mat}" ${mat === selectedMatiere ? 'selected' : ''}>${escapeHtml(matiereLabels[mat] || mat)}</option>`
        ).join('');

        // Dropdown compétences de la discipline sélectionnée
        const compOptions = this._buildCompOptions(groups[selectedMatiere] || [], selectedId);

        // Lire les points existants
        let existingPts = 1;
        if (d.points_par_competence) {
            try {
                const ppc = typeof d.points_par_competence === 'string' ? JSON.parse(d.points_par_competence) : d.points_par_competence;
                const vals = Object.values(ppc);
                if (vals.length > 0) existingPts = parseFloat(vals[0]) || 1;
            } catch (_e) { /* ignore */ }
        }

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Compétence ciblée</h3><p>Sélectionnez la compétence évaluée par ce bonus</p></div>
            <div class="form-row">
                <div class="form-group">
                    <label>Discipline</label>
                    <select class="form-select" id="evalCompMatiere" onchange="AdminEvaluations._onCompMatiereChange()">
                        ${matiereOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Compétence <span class="req">*</span></label>
                    <select class="form-select" id="evalCompSelect">
                        ${compOptions}
                    </select>
                </div>
            </div>
            <div style="margin-top: 12px; padding: 10px 16px; background: var(--gray-50, #f9fafb); border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                <label style="font-weight: 600; font-size: 0.9rem;">Points mis en jeu :</label>
                <input type="number" class="form-input" id="evalBonusCompPts" value="${existingPts}" min="0.25" max="20" step="0.25" style="width: 70px; padding: 4px 8px;">
                <span style="font-size: 0.85rem; color: var(--gray-500);">pt${existingPts > 1 ? 's' : ''}</span>
            </div>
        </div>`;
    },

    _buildCompOptions(comps, selectedId) {
        if (!comps || comps.length === 0) return '<option value="">Aucune compétence</option>';
        return comps.map(c =>
            `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${escapeHtml(c.nom)}</option>`
        ).join('');
    },

    _onCompMatiereChange() {
        const matiere = document.getElementById('evalCompMatiere')?.value;
        if (!matiere) return;
        const comps = (this.competencesReferentiel || [])
            .filter(c => (c.matiere || 'Transversal') === matiere)
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        const select = document.getElementById('evalCompSelect');
        if (select) select.innerHTML = this._buildCompOptions(comps, '');
    },

    _initStepCompetenceUnique() {
        // Plus de recherche — les 2 dropdowns gèrent la navigation
    },

    // --- ÉTAPE DOCUMENT (block editor) ---

    _renderStepDocument() {
        const d = this.wizardData;
        const description = d.description || '';

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Document / Sujet</h3><p>Construisez le sujet que l'élève verra</p></div>
            <div class="wizard-form">
                <div class="form-group">
                    <label>Consigne (optionnel)</label>
                    <textarea class="form-input" id="evalDescription" rows="2" placeholder="Consigne générale pour l'élève...">${escapeHtml(description)}</textarea>
                </div>
            </div>
            <div class="tb-tabs">
                <button type="button" class="tb-tab active" id="evalTabConstruction" onclick="AdminEvaluations._ewSwitchDocTab('construction')">Construction</button>
                <button type="button" class="tb-tab" id="evalTabPreview" onclick="AdminEvaluations._ewSwitchDocTab('preview')">Vue élève</button>
            </div>
            <div id="evalConstructionPanel">
                <div id="evalBlockEditorContainer" class="block-editor"></div>
                ${this._renderBlockAddBar()}
            </div>
            <div id="evalPreviewPanel" class="tb-preview-panel" style="display:none;">
                <div id="evalPreviewContainer" class="cw-preview-frame">
                    <div class="cw-preview-empty">Ajoutez du contenu pour voir l'aperçu</div>
                </div>
            </div>
        </div>`;
    },

    _initStepDocument() {
        this._blockEditorContainerId = 'evalBlockEditorContainer';
        this._ewPreviewContainerId = 'evalPreviewContainer';

        const d = this.wizardData;
        let blocks = null;
        if (d.document_contenu) {
            try {
                const parsed = JSON.parse(d.document_contenu);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (_e) {
                blocks = [{ type: 'text', content: d.document_contenu }];
            }
        }

        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }
        this.initBlockEditor(blocks);
    },

    /**
     * Barre d'ajout de blocs (réutilise les onclick du mixin block editor).
     */
    _renderBlockAddBar() {
        return `<div class="block-add-bar">
            <button type="button" class="block-add-btn" onclick="AdminEvaluations.addBlock('text')" title="Texte">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                Texte
            </button>
            <button type="button" class="block-add-btn" onclick="AdminEvaluations.addBlock('document')" title="Document Google">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Document
            </button>
            <button type="button" class="block-add-btn" onclick="AdminEvaluations.addBlock('image')" title="Image">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Image
            </button>
            <button type="button" class="block-add-btn" onclick="AdminEvaluations.addBlock('video')" title="Vidéo">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                Vidéo
            </button>
        </div>`;
    },

    _ewSwitchDocTab(tab) {
        const constructionPanel = document.getElementById('evalConstructionPanel');
        const previewPanel = document.getElementById('evalPreviewPanel');
        const tabConstruction = document.getElementById('evalTabConstruction');
        const tabPreview = document.getElementById('evalTabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this._saveEditorsState();
            this._ewUpdatePreview();
            constructionPanel.style.display = 'none';
            previewPanel.style.display = '';
            if (tabConstruction) tabConstruction.classList.remove('active');
            if (tabPreview) tabPreview.classList.add('active');
        } else {
            constructionPanel.style.display = '';
            previewPanel.style.display = 'none';
            if (tabConstruction) tabConstruction.classList.add('active');
            if (tabPreview) tabPreview.classList.remove('active');
        }
    },

    _ewUpdatePreview() {
        const previewContainer = document.getElementById(this._ewPreviewContainerId);
        if (!previewContainer) return;
        this._saveEditorsState();
        const blocks = (this._blocks || []).map(b => this._serializeBlock(b))
            .filter(b => {
                if (b.type === 'text') return b.content && b.content.trim() !== '';
                if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
                if (b.type === 'group') return b.children && b.children.length > 0;
                return false;
            });
        if (blocks.length === 0) {
            previewContainer.innerHTML = '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\'aperçu</div>';
            return;
        }
        // Use the read-only block renderer from eleve-evaluation
        let html = '<div class="comp-blocks-container">';
        blocks.forEach(block => {
            html += this._renderPreviewBlockEval(block);
        });
        html += '</div>';
        previewContainer.innerHTML = html;
    },

    /** Rendu simplifié d'un bloc pour la preview. */
    _renderPreviewBlockEval(block) {
        if (!block) return '';
        switch (block.type) {
            case 'text':
                return `<div class="comp-block-text">${block.content || ''}</div>`;
            case 'document': {
                const url = block.url || '';
                if (!url) return '<div class="cw-preview-placeholder">Saisissez l\'URL du document</div>';
                const embedUrl = url.includes('/edit') ? url.replace('/edit', '/preview') : url;
                return `<div class="comp-block-document"><iframe src="${escapeHtml(embedUrl)}" style="width:100%;height:400px;border:none;border-radius:8px;"></iframe></div>`;
            }
            case 'image': {
                let imgUrl = block.url || '';
                const driveMatch = imgUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (driveMatch) imgUrl = 'https://lh3.googleusercontent.com/d/' + driveMatch[1];
                const legende = block.legende ? `<div class="comp-block-legende">${escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>` : '';
                if (!block.url) return '<div class="cw-preview-placeholder">Saisissez l\'URL de l\'image</div>';
                return `<div class="comp-block-image"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(block.legende || 'Image')}"></div>${legende}`;
            }
            case 'video': {
                const vidUrl = block.url || '';
                if (!vidUrl) return '<div class="cw-preview-placeholder">Saisissez l\'URL de la vidéo</div>';
                const ytMatch = vidUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                let embedVid = '';
                if (ytMatch) embedVid = 'https://www.youtube-nocookie.com/embed/' + ytMatch[1];
                else {
                    const driveVid = vidUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (driveVid) embedVid = 'https://drive.google.com/file/d/' + driveVid[1] + '/preview';
                }
                return embedVid
                    ? `<div class="comp-block-video"><iframe src="${embedVid}" allowfullscreen frameborder="0" style="width:100%;height:350px;border-radius:8px;"></iframe></div>`
                    : `<div class="comp-block-video"><a href="${escapeHtml(vidUrl)}" target="_blank">Voir la vidéo</a></div>`;
            }
            case 'group': {
                const ratios = (block.ratio || '50-50').split('-').map(Number);
                let html = '<div class="comp-blocks-group" style="display:flex;gap:12px;">';
                (block.children || []).forEach((child, idx) => {
                    const flex = ratios[idx] || 50;
                    html += `<div style="flex:${flex}">${this._renderPreviewBlockEval(child)}</div>`;
                });
                return html + '</div>';
            }
            default: return '';
        }
    },

    // --- ÉTAPE CORRIGÉ (block editor ou lien Google Doc) ---

    _renderStepCorrige() {
        const d = this.wizardData;
        let hasCorrectionBlocks = false;
        if (d.correction_contenu) {
            try {
                const parsed = JSON.parse(d.correction_contenu);
                if (Array.isArray(parsed)) hasCorrectionBlocks = true;
            } catch (_e) { hasCorrectionBlocks = true; }
        }
        const corrUrl = d.correction_commentee || '';
        const corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Corrigé commenté</h3><p>Construisez le corrigé que l'élève verra après correction (optionnel)</p></div>
            <div class="source-toggle" id="evalCorrectionToggle">
                <button type="button" class="source-toggle-btn${corrMode === 'url' ? ' active' : ''}" data-mode="url" onclick="AdminEvaluations._ewToggleCorrectionMode('url')">Lien Google Doc</button>
                <button type="button" class="source-toggle-btn${corrMode === 'editor' ? ' active' : ''}" data-mode="editor" onclick="AdminEvaluations._ewToggleCorrectionMode('editor')">Éditeur</button>
            </div>
            <div class="source-panel" id="evalCorrectionUrlPanel"${corrMode !== 'url' ? ' style="display:none;"' : ''}>
                <div class="form-group">
                    <label>Lien Google Doc du corrigé</label>
                    <input type="text" class="form-input" id="evalCorrectionUrl" value="${escapeHtml(corrUrl)}" placeholder="https://docs.google.com/document/d/...">
                    <div class="form-help">Collez le lien de partage du Google Doc (doit être accessible en lecture)</div>
                </div>
            </div>
            <div class="source-panel" id="evalCorrectionEditorPanel"${corrMode !== 'editor' ? ' style="display:none;"' : ''}>
                <div id="evalCorrBlockEditorContainer" class="block-editor"></div>
                ${this._renderBlockAddBar()}
            </div>
        </div>`;
    },

    _initStepCorrige() {
        const d = this.wizardData;
        let hasCorrectionBlocks = false;
        if (d.correction_contenu) {
            try {
                const parsed = JSON.parse(d.correction_contenu);
                if (Array.isArray(parsed)) hasCorrectionBlocks = true;
            } catch (_e) { hasCorrectionBlocks = true; }
        }
        if (hasCorrectionBlocks) {
            this._initCorrectionBlockEditor();
        }
    },

    _initCorrectionBlockEditor() {
        this._blockEditorContainerId = 'evalCorrBlockEditorContainer';
        this._ewPreviewContainerId = null;

        const d = this.wizardData;
        let blocks = null;
        if (d.correction_contenu) {
            try {
                const parsed = JSON.parse(d.correction_contenu);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (_e) {
                blocks = [{ type: 'text', content: d.correction_contenu }];
            }
        }

        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }
        this.initBlockEditor(blocks);
    },

    _ewToggleCorrectionMode(mode) {
        const toggle = document.getElementById('evalCorrectionToggle');
        if (!toggle) return;
        toggle.querySelectorAll('.source-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        const urlPanel = document.getElementById('evalCorrectionUrlPanel');
        const editorPanel = document.getElementById('evalCorrectionEditorPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (editorPanel) editorPanel.style.display = mode === 'editor' ? '' : 'none';

        if (mode === 'editor') {
            const container = document.getElementById('evalCorrBlockEditorContainer');
            if (container && !container.hasChildNodes()) {
                this._initCorrectionBlockEditor();
            }
        }
    },

    // --- ÉTAPE CRITÈRES LIBRES (bonus ponctuel) ---

    _renderStepCriteresLibres() {
        const d = this.wizardData;
        let criteres = [];
        if (d.criteres_libres) {
            try {
                const parsed = typeof d.criteres_libres === 'string' ? JSON.parse(d.criteres_libres) : d.criteres_libres;
                if (Array.isArray(parsed)) criteres = parsed;
            } catch (_e) { /* ignore */ }
        }
        if (criteres.length === 0) criteres.push('');

        const rows = criteres.map((c, i) =>
            `<div class="critere-libre-row">
                <span class="critere-libre-num">${i + 1}</span>
                <input type="text" class="form-input critere-libre-input" value="${escapeHtml(c)}" placeholder="Ex: Répondre avec une phrase complète">
                <button class="btn-icon btn-remove" onclick="AdminEvaluations._ewRemoveCritere(${i})" title="Supprimer">&times;</button>
            </div>`
        ).join('');

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Critères de réussite</h3><p>Définissez les critères pour évaluer cet exercice</p></div>
            <div id="evalCriteresList" class="cw-criteres-list">${rows}</div>
            <button class="btn btn-secondary btn-sm" onclick="AdminEvaluations._ewAddCritere()" style="margin-top: 8px;">+ Ajouter un critère</button>
        </div>`;
    },

    _initStepCriteresLibres() {
        const inputs = document.querySelectorAll('#evalCriteresList .critere-libre-input');
        if (inputs.length > 0) {
            const last = inputs[inputs.length - 1];
            if (!last.value) last.focus();
        }
    },

    _ewAddCritere() {
        const container = document.getElementById('evalCriteresList');
        if (!container) return;
        const count = container.querySelectorAll('.critere-libre-row').length;
        const div = document.createElement('div');
        div.className = 'critere-libre-row';
        div.innerHTML = `<span class="critere-libre-num">${count + 1}</span>
            <input type="text" class="form-input critere-libre-input" value="" placeholder="Ex: Répondre avec une phrase complète">
            <button class="btn-icon btn-remove" onclick="AdminEvaluations._ewRemoveCritere(${count})" title="Supprimer">&times;</button>`;
        container.appendChild(div);
        div.querySelector('.critere-libre-input').focus();
    },

    _ewRemoveCritere(index) {
        const inputs = document.querySelectorAll('#evalCriteresList .critere-libre-input');
        const values = [];
        inputs.forEach(input => values.push(input.value));
        values.splice(index, 1);
        if (values.length === 0) values.push('');

        const container = document.getElementById('evalCriteresList');
        if (container) {
            container.innerHTML = values.map((c, i) =>
                `<div class="critere-libre-row">
                    <span class="critere-libre-num">${i + 1}</span>
                    <input type="text" class="form-input critere-libre-input" value="${escapeHtml(c)}" placeholder="Ex: Répondre avec une phrase complète">
                    <button class="btn-icon btn-remove" onclick="AdminEvaluations._ewRemoveCritere(${i})" title="Supprimer">&times;</button>
                </div>`
            ).join('');
        }
    },

    // --- ÉTAPE RÉSUMÉ ---

    _renderStepResume() {
        const d = this.wizardData;
        const type = d.type;
        const sousType = d.sous_type_bonus || '';

        // Titre
        let typeLabel = 'Évaluation';
        if (type === 'competences') typeLabel = 'Évaluation de compétences (TC)';
        else if (type === 'bonus' && sousType === 'competence') typeLabel = 'Bonus compétence';
        else if (type === 'bonus' && sousType === 'ponctuel') typeLabel = 'Bonus ponctuel';

        // Compétences + points par compétence
        let compHtml = '';
        if (type === 'competences' || (type === 'bonus' && sousType === 'competence')) {
            let ids = [];
            if (d.competence_ids) {
                try {
                    const parsed = typeof d.competence_ids === 'string' ? JSON.parse(d.competence_ids) : d.competence_ids;
                    if (Array.isArray(parsed)) ids = parsed;
                } catch (_e) { /* ignore */ }
            }
            let ppc = {};
            if (d.points_par_competence) {
                try {
                    ppc = typeof d.points_par_competence === 'string' ? JSON.parse(d.points_par_competence) : d.points_par_competence;
                } catch (_e) { /* ignore */ }
            }
            const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
            const matiereLabels = { 'FR': 'FR', 'HG-EMC': 'HG-EMC', 'Transversal': 'Trans.' };
            const badges = ids.map(cid => {
                const c = (this.competencesReferentiel || []).find(r => String(r.id) === String(cid));
                if (!c) return '';
                const color = matiereColors[c.matiere] || '#6b7280';
                const pts = ppc[String(cid)] !== undefined ? ppc[String(cid)] : '?';
                return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                    <span style="display:inline-block;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:${color}20;color:${color};font-weight:600;">${escapeHtml(matiereLabels[c.matiere] || c.matiere)}</span>
                    <span style="font-size:0.85rem;">${escapeHtml(c.nom)}</span>
                    <span style="font-size:0.8rem;font-weight:600;color:var(--gray-600);">${pts} pt${pts > 1 ? 's' : ''}</span>
                </div>`;
            }).join('');
            compHtml = `<div class="summary-row" style="align-items:flex-start;"><span class="label">Compétences</span><span class="value" style="flex-direction:column;gap:0;">${badges || 'Aucune'}</span></div>`;
        }

        // Critères libres
        let criteresHtml = '';
        if (type === 'bonus' && sousType === 'ponctuel' && d.criteres_libres) {
            let criteres = [];
            try {
                const parsed = typeof d.criteres_libres === 'string' ? JSON.parse(d.criteres_libres) : d.criteres_libres;
                if (Array.isArray(parsed)) criteres = parsed;
            } catch (_e) { /* ignore */ }
            if (criteres.length > 0) {
                const list = criteres.map((c, i) => `<div style="font-size:0.8rem;padding:2px 0;">${i + 1}. ${escapeHtml(c)}</div>`).join('');
                criteresHtml = `<div class="summary-row"><span class="label">Critères</span><span class="value" style="flex-direction:column;">${list}</span></div>`;
            }
        }

        // Document blocs count
        let nbDocBlocks = 0;
        if (d.document_contenu) {
            try {
                const parsed = JSON.parse(d.document_contenu);
                if (Array.isArray(parsed)) nbDocBlocks = parsed.length;
            } catch (_e) { nbDocBlocks = 1; }
        }

        // Corrigé
        let corrLabel = 'Aucun';
        if (d.correction_commentee) corrLabel = 'Lien Google Doc';
        else if (d.correction_contenu) {
            try {
                const parsed = JSON.parse(d.correction_contenu);
                const n = Array.isArray(parsed) ? parsed.length : 1;
                corrLabel = `${n} bloc${n > 1 ? 's' : ''}`;
            } catch (_e) { corrLabel = '1 bloc'; }
        }

        return `<div class="eval-wizard-step-content">
            <div class="step-header"><h3>Résumé de l'évaluation</h3><p>Vérifiez les informations avant d'enregistrer</p></div>
            <div class="cw-summary"><div class="summary-card">
                <div class="summary-row"><span class="label">Type</span><span class="value">${escapeHtml(typeLabel)}</span></div>
                <div class="summary-row"><span class="label">Titre</span><span class="value">${escapeHtml(d.titre || '(vide)')}</span></div>
                ${d.description ? `<div class="summary-row"><span class="label">Consigne</span><span class="value">${escapeHtml(d.description)}</span></div>` : ''}
                ${d.description_eleve ? `<div class="summary-row"><span class="label">Description élève</span><span class="value">${escapeHtml(d.description_eleve)}</span></div>` : ''}
                ${compHtml}
                ${criteresHtml}
                <div class="summary-row"><span class="label">Points</span><span class="value">${d.briques || 3} pt${(d.briques || 3) > 1 ? 's' : ''}</span></div>
                <div class="summary-row"><span class="label">Blocs de contenu</span><span class="value">${nbDocBlocks}</span></div>
                <div class="summary-row"><span class="label">Corrigé</span><span class="value">${corrLabel}</span></div>
                <div class="summary-row"><span class="label">Matière</span><span class="value">${d.matiere || 'FR'}</span></div>
            </div></div>
        </div>`;
    },

    // Legacy methods kept for backward compatibility with existing evaluations
    _onBanqueConnChange(banqueId) {
        this.wizardData._selectedBanqueConn = banqueId;
        this.wizardData.entrainement_conn_id = '';

        const select = document.getElementById('evalEntrainementConn');
        if (!select) return;
        if (!banqueId) {
            select.innerHTML = '<option value="">-- Sélectionnez d\'abord une banque --</option>';
            return;
        }

        const entrainements = this.entrainementsConn
            .filter(e => e.banque_exercice_id === banqueId && e.statut !== 'evaluation')
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        select.innerHTML = '<option value="">Sélectionner...</option>' +
            entrainements.map(e =>
                `<option value="${e.id}">${escapeHtml(e.titre || 'Sans titre')} ${e.statut === 'publie' ? '(Publié)' : '(Brouillon)'}</option>`
            ).join('');
    },

    _onEntrainementConnChange(entrId) {
        this.wizardData.entrainement_conn_id = entrId;
        const el = document.getElementById('evalEntrainementConnId');
        if (el) el.value = entrId;
    },

    _renderStep3SF() {
        const d = this.wizardData;
        const banques = [...this.banquesSF].sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        let selectedBanqueId = d._selectedBanqueSF || '';
        if (!selectedBanqueId && d.exercice_sf_id) {
            const linked = this.exercicesSF.find(e => String(e.id) === String(d.exercice_sf_id));
            if (linked) selectedBanqueId = String(linked.banque_id);
        }

        const banqueOptions = banques.map(b =>
            `<option value="${b.id}" ${String(b.id) === String(selectedBanqueId) ? 'selected' : ''}>${escapeHtml(b.titre || 'Sans titre')}</option>`
        ).join('');

        let exerciceOptions = '<option value="">-- Sélectionnez d\'abord une banque --</option>';
        if (selectedBanqueId) {
            const banqueExos = this.exercicesSF
                .filter(e => String(e.banque_id) === String(selectedBanqueId))
                .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));
            exerciceOptions = '<option value="">Sélectionner...</option>' +
                banqueExos.map(e =>
                    `<option value="${e.id}" ${String(e.id) === String(d.exercice_sf_id) ? 'selected' : ''}>${escapeHtml(e.titre || 'Sans titre')}</option>`
                ).join('');
        }

        return `
            <div class="eval-wizard-step-content">
                <div class="step-header">
                    <h3>Sujet de l'évaluation</h3>
                    <p>Sélectionnez l'exercice à utiliser comme sujet</p>
                </div>
                <div class="wizard-form">
                    <div class="form-group">
                        <label>Banque d'exercices</label>
                        <select class="form-select" id="evalBanqueSF" onchange="AdminEvaluations._onBanqueSFChange(this.value)">
                            <option value="">Sélectionner une banque...</option>
                            ${banqueOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Exercice</label>
                        <select class="form-select" id="evalExerciceSF" onchange="AdminEvaluations._onExerciceSFChange(this.value)">
                            ${exerciceOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    _onBanqueSFChange(banqueId) {
        this.wizardData._selectedBanqueSF = banqueId;
        this.wizardData.exercice_sf_id = '';

        const select = document.getElementById('evalExerciceSF');
        if (!banqueId) {
            select.innerHTML = '<option value="">-- Sélectionnez d\'abord une banque --</option>';
            return;
        }

        const exercices = this.exercicesSF
            .filter(e => String(e.banque_id) === String(banqueId))
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        select.innerHTML = '<option value="">Sélectionner...</option>' +
            exercices.map(e =>
                `<option value="${e.id}">${escapeHtml(e.titre || 'Sans titre')}</option>`
            ).join('');
    },

    _onExerciceSFChange(exoId) {
        this.wizardData.exercice_sf_id = exoId;
    },

    // ========== WIZARD DATA COLLECTION ==========

    _collectWizardStepData() {
        const type = this.wizardData.type;
        const sousType = this.wizardData.sous_type_bonus || '';
        const step = this.wizardStep;

        // Step 1 = Paramètres (all types)
        if (step === 1) {
            const titre = document.getElementById('evalTitre')?.value.trim();
            if (!titre) {
                this.showNotification('Le titre est requis', 'error');
                return false;
            }
            this.wizardData.titre = titre;
            this.wizardData.briques = parseFloat(document.getElementById('evalBriques')?.value) || 3;
            this.wizardData.mode_passation = (type === 'competences' || type === 'bonus') ? 'papier' : (document.getElementById('evalModePassation')?.value || 'numerique');
            const matiereGroup = document.getElementById('evalMatiereGroup');
            const matiereVisible = matiereGroup && matiereGroup.style.display !== 'none';
            this.wizardData.matiere = matiereVisible ? (document.getElementById('evalMatiere')?.value || 'FR') : this.currentMatiere;
            if (type === 'bonus') {
                this.wizardData.categorie = sousType === 'competence' ? 'competences' : 'bonus';
            } else {
                this.wizardData.categorie = '';
            }
            if (type === 'connaissances') {
                this.wizardData.seuil = parseInt(document.getElementById('evalSeuil')?.value) || 80;
            }
            if (type === 'competences') {
                this.wizardData.methodologie_id = document.getElementById('evalMethodologieTC')?.value || '';
                this.wizardData.sujet_disponible_avance = document.getElementById('evalSujetAvance')?.checked || false;
            }
            if (type === 'bonus' && sousType === 'suivi') {
                this.wizardData.nb_validations = parseInt(document.getElementById('evalNbValidations')?.value) || 5;
            }
            if (type === 'bonus') {
                this.wizardData.description_eleve = (document.getElementById('evalDescriptionEleve')?.value || '').trim();
            }
            return true;
        }

        // Conn/SF Step 2 = Sujet selection (unchanged)
        if ((type === 'connaissances' || type === 'savoir-faire') && step === 2) {
            return true;
        }

        // Determine logical step name for TC/bonus
        const logicalStep = this._getLogicalStepName(step);

        // Collect data based on logical step
        switch (logicalStep) {
            case 'competences': {
                // TC : multiple checkboxes + points par compétence
                const checked = document.querySelectorAll('#evalCompetencesCheckboxes input[type="checkbox"]:checked');
                const ids = [];
                const ptsParComp = {};
                checked.forEach(cb => {
                    ids.push(cb.value);
                    const item = cb.closest('.cw-comp-checkbox-item');
                    const ptsInput = item ? item.querySelector('.cw-comp-pts') : null;
                    ptsParComp[cb.value] = ptsInput ? (parseFloat(ptsInput.value) || 1) : 1;
                });
                if (ids.length === 0) {
                    this.showNotification('Sélectionnez au moins une compétence', 'error');
                    return false;
                }
                this.wizardData.competence_ids = JSON.stringify(ids);
                this.wizardData.points_par_competence = JSON.stringify(ptsParComp);
                // Calculer briques comme total
                let totalBriques = 0;
                for (const k in ptsParComp) totalBriques += ptsParComp[k];
                this.wizardData.briques = totalBriques;
                return true;
            }
            case 'competence_unique': {
                // Bonus comp : dropdown select + points
                const compId = document.getElementById('evalCompSelect')?.value;
                if (!compId) {
                    this.showNotification('Sélectionnez une compétence', 'error');
                    return false;
                }
                const ptsEl = document.getElementById('evalBonusCompPts');
                const pts = ptsEl ? (parseFloat(ptsEl.value) || 1) : 1;
                this.wizardData.competence_ids = JSON.stringify([compId]);
                this.wizardData.points_par_competence = JSON.stringify({ [compId]: pts });
                this.wizardData.briques = pts;
                return true;
            }
            case 'document': {
                // Save block editor state + description
                const descEl = document.getElementById('evalDescription');
                if (descEl) this.wizardData.description = descEl.value.trim();
                if (this._blocks && this._blocks.length > 0) {
                    this._saveEditorsState();
                    const blocks = this._blocks.map(b => this._serializeBlock(b))
                        .filter(b => {
                            if (b.type === 'text') return b.content && b.content.trim() !== '';
                            if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
                            if (b.type === 'group') return b.children && b.children.length > 0;
                            return false;
                        });
                    this.wizardData.document_contenu = blocks.length > 0 ? JSON.stringify(blocks) : '';
                }
                return true;
            }
            case 'corrige': {
                // Save correction mode
                const toggle = document.getElementById('evalCorrectionToggle');
                const mode = toggle ? (toggle.querySelector('.source-toggle-btn.active')?.dataset.mode || 'url') : 'url';
                if (mode === 'url') {
                    const url = document.getElementById('evalCorrectionUrl')?.value.trim() || '';
                    this.wizardData.correction_commentee = url;
                    this.wizardData.correction_contenu = '';
                } else {
                    this.wizardData.correction_commentee = '';
                    if (this._blocks && this._blocks.length > 0) {
                        this._saveEditorsState();
                        const blocks = this._blocks.map(b => this._serializeBlock(b))
                            .filter(b => {
                                if (b.type === 'text') return b.content && b.content.trim() !== '';
                                if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
                                if (b.type === 'group') return b.children && b.children.length > 0;
                                return false;
                            });
                        this.wizardData.correction_contenu = blocks.length > 0 ? JSON.stringify(blocks) : '';
                    }
                }
                return true;
            }
            case 'criteres': {
                // Bonus ponctuel : collect free-form criteria
                const inputs = document.querySelectorAll('#evalCriteresList .critere-libre-input');
                const criteres = [];
                inputs.forEach(input => {
                    const v = input.value.trim();
                    if (v) criteres.push(v);
                });
                if (criteres.length === 0) {
                    this.showNotification('Ajoutez au moins un critère', 'error');
                    return false;
                }
                this.wizardData.criteres_libres = JSON.stringify(criteres);
                return true;
            }
            case 'resume':
                return true;
        }
        return true;
    },

    /**
     * Map wizard step number to logical step name based on type.
     */
    _getLogicalStepName(step) {
        const type = this.wizardData.type;
        const sousType = this.wizardData.sous_type_bonus || '';

        if (type === 'competences') {
            return ['params', 'competences', 'document', 'corrige', 'resume'][step - 1];
        }
        if (type === 'bonus' && sousType === 'competence') {
            return ['params', 'competence_unique', 'document', 'corrige', 'resume'][step - 1];
        }
        if (type === 'bonus' && sousType === 'ponctuel') {
            return ['params', 'document', 'corrige', 'criteres', 'resume'][step - 1];
        }
        return 'params';
    },

    // ========== SAVE EVALUATION ==========
    async saveEvaluation() {
        // Collect last step data
        if (!this._collectWizardStepData()) return;

        const d = this.wizardData;
        const id = document.getElementById('editEvaluationId').value;

        if (!d.titre) {
            this.showNotification('Le titre est requis', 'error');
            return;
        }

        const data = {
            type: d.type,
            titre: d.titre,
            briques: d.briques || 3,
            matiere: d.matiere || 'FR',
            categorie: d.categorie || d.type,
            date_creation: new Date().toISOString().split('T')[0],
            date_ouverture: d.date_ouverture || '',
            date_fermeture: d.date_fermeture || '',
            mode_passation: d.mode_passation || 'numerique'
        };

        // Statut : seulement pour la création (pas de changement via le wizard en édition)
        if (!id) {
            data.statut = 'brouillon';
        }

        // Durée : résolue automatiquement par le backend depuis l'entraînement attribué à chaque élève

        if (d.type === 'connaissances') {
            data.seuil = d.seuil || 80;
            data.source_questions = 'banque';
        }
        if (d.type === 'competences') {
            data.methodologie_id = d.methodologie_id || '';
            data.sous_type_comp = d.sous_type_comp || 'tache_complexe';
            data.sujet_disponible_avance = d.sujet_disponible_avance ? 'true' : 'false';
            // Phase 9 : contenu intégré directement
            data.document_contenu = d.document_contenu || '';
            data.correction_contenu = d.correction_contenu || '';
            data.correction_commentee = d.correction_commentee || '';
            data.competence_ids = d.competence_ids || '';
            data.points_par_competence = d.points_par_competence || '';
            data.description = d.description || '';
        }
        if (d.type === 'bonus') {
            data.sous_type_bonus = d.sous_type_bonus || 'competence';
            if (d.sous_type_bonus === 'competence' || d.sous_type_bonus === 'ponctuel') {
                // Phase 9 : contenu intégré directement
                data.document_contenu = d.document_contenu || '';
                data.correction_contenu = d.correction_contenu || '';
                data.correction_commentee = d.correction_commentee || '';
                data.description = d.description || '';
                data.description_eleve = d.description_eleve || '';
                if (d.sous_type_bonus === 'competence') {
                    data.competence_ids = d.competence_ids || '';
                    data.points_par_competence = d.points_par_competence || '';
                }
                if (d.sous_type_bonus === 'ponctuel') {
                    data.criteres_libres = d.criteres_libres || '';
                }
            } else if (d.sous_type_bonus === 'suivi') {
                data.nb_validations = d.nb_validations || 5;
                data.description_eleve = d.description_eleve || '';
            }
        }

        const nextBtn = document.getElementById('evalWizardNextBtn');
        try {
            nextBtn.disabled = true;
            nextBtn.textContent = 'Enregistrement...';

            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateEvaluation', data);
            } else {
                result = await this.callAPI('createEvaluation', data);
            }

            if (result.success) {
                this.closeModal();
                SheetsAPI.clearCache();
                await this.loadData();
                this.updateCounts();
                this.renderEvaluations();
                this.showNotification(id ? 'Évaluation modifiée' : 'Évaluation créée');
            } else {
                this.showNotification('Erreur: ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            nextBtn.disabled = false;
            nextBtn.textContent = this.wizardStep >= this._getMaxStep() ? 'Enregistrer' : 'Suivant →';
        }
    },

    // ========== SOMMATIVE MODAL ==========
    openSommativeModal(sommative = null) {
        const modal = document.getElementById('sommativeModal');
        const title = document.getElementById('sommativeModalTitle');

        if (sommative) {
            title.textContent = 'Modifier la sommative';
            document.getElementById('editSommativeId').value = sommative.id;
            document.getElementById('somTitre').value = sommative.titre || '';
            document.getElementById('somMatiere').value = sommative.matiere || 'FR';
            document.getElementById('somBareme').value = sommative.bareme || 20;
            document.getElementById('somCoefficient').value = sommative.coefficient || 1;
            document.getElementById('somDate').value = sommative.date || '';
            document.getElementById('somSemestre').value = sommative.semestre || '1';
        } else {
            title.textContent = 'Nouvelle évaluation sommative';
            document.getElementById('editSommativeId').value = '';
            document.getElementById('somTitre').value = '';
            document.getElementById('somMatiere').value = this.currentMatiere;
            document.getElementById('somBareme').value = 20;
            document.getElementById('somCoefficient').value = 1;
            document.getElementById('somDate').value = '';
            document.getElementById('somSemestre').value = '1';
        }

        modal.classList.remove('hidden');
    },

    closeSommativeModal() {
        document.getElementById('sommativeModal').classList.add('hidden');
    },

    editSommative(id) {
        const sommative = this.sommatives.find(s => s.id === id);
        if (sommative) this.openSommativeModal(sommative);
    },

    async saveSommative() {
        const id = document.getElementById('editSommativeId').value;
        const titre = document.getElementById('somTitre').value.trim();

        if (!titre) {
            this.showNotification('Veuillez saisir un titre', 'error');
            return;
        }

        const data = {
            titre,
            matiere: document.getElementById('somMatiere').value,
            bareme: parseInt(document.getElementById('somBareme').value) || 20,
            coefficient: parseFloat(document.getElementById('somCoefficient').value) || 1,
            date: document.getElementById('somDate').value,
            semestre: document.getElementById('somSemestre').value
        };

        try {
            const saveBtn = document.getElementById('saveSommativeBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Enregistrement...';

            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateNoteSommative', data);
            } else {
                result = await this.callAPI('createNoteSommative', data);
            }

            if (result.success) {
                this.closeSommativeModal();
                SheetsAPI.clearCache();
                await this.loadData();
                this.updateCounts();
                this.renderEvaluations();
                this.showNotification(id ? 'Sommative modifiée' : 'Sommative créée');
            } else {
                this.showNotification('Erreur: ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde sommative:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            const saveBtn = document.getElementById('saveSommativeBtn');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer';
        }
    },

    // ========== SAISIE DES RÉSULTATS (progression) ==========
    async openSaisie(evaluationId) {
        const evaluation = this.evaluations.find(e => String(e.id) === String(evaluationId));
        if (!evaluation) return;

        this.saisieEvaluation = evaluation;
        this.saisieSommative = null;
        this.saisieChanges = {};
        this._saisieAttributions = {};

        // Show saisie view with loader
        document.getElementById('evaluations-content').style.display = 'none';
        document.getElementById('saisie-content').style.display = 'block';
        document.getElementById('saisieLoader').style.display = 'block';
        document.getElementById('saisieTableContainer').style.display = 'none';

        // Recharger les résultats frais (sans cache) pour capter les passages récents
        try {
            localStorage.removeItem(SheetsAPI._cachePrefix + 'EVALUATION_RESULTATS_');
            const freshResultats = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
            this.resultats = SheetsAPI.parseSheetData(freshResultats);
        } catch (_e) {
            console.warn('Erreur rechargement résultats, utilisation des données en mémoire');
        }

        // Get existing results for this evaluation
        const evalResults = this.resultats.filter(r =>
            String(r.evaluation_id).trim() === String(evaluationId).trim()
        );
        const resultsMap = {};
        evalResults.forEach(r => { resultsMap[String(r.eleve_id).trim()] = r; });

        // Load existing attributions
        let attributionsMap = {};
        try {
            const attrResult = await this.callAPI('getAttributionsSujets', { evaluation_id: evaluationId });
            if (attrResult.success && attrResult.data) {
                attrResult.data.forEach(a => { attributionsMap[String(a.eleve_id).trim()] = a; });
            }
        } catch (_e) { /* ignore */ }

        // Update header
        document.getElementById('saisieTitle').textContent = escapeHtml(evaluation.titre || 'Sans titre');

        const matLabel = evaluation.matiere === 'FR' ? '🇫🇷 Français' :
            evaluation.matiere === 'HG-EMC' ? '🌍 HG-EMC' :
            evaluation.matiere === 'Les deux' ? '🔗 Les deux matières' : '';

        let subtitleParts = [`${this._capitalizeType(evaluation.type)} · ${matLabel} · ${evaluation.briques || 0} pts`];
        if (evaluation.date_ouverture) {
            subtitleParts.push(`📅 Date : ${this._formatDateShort(evaluation.date_ouverture)}`);
        }
        document.getElementById('saisieSubtitle').textContent = subtitleParts.join(' · ');

        const showSujet = evaluation.type === 'connaissances' || evaluation.type === 'savoir-faire';
        const isConn = evaluation.type === 'connaissances';
        const isTC = evaluation.type === 'competences';
        const sousTypeBonus = String(evaluation.sous_type_bonus || '').trim();

        // Bonus suivi → tableau spécial avec checkboxes progressives
        if (evaluation.type === 'bonus' && sousTypeBonus === 'suivi') {
            this._renderSaisieSuivi(evaluation, evalResults, resultsMap);
            return;
        }

        // Bonus comp/ponctuel → tableau spécial avec demandes + correction
        if (evaluation.type === 'bonus' && sousTypeBonus !== 'suivi') {
            this._renderSaisieBonus(evaluation, evalResults, resultsMap);
            return;
        }

        // Prepare banques for attribution dropdowns
        let banques = [];
        if (showSujet) {
            const allBanques = isConn ? [...this.banquesExercicesConn] : [...this.banquesSF];
            const evalMatiere = evaluation.matiere || this.currentMatiere;
            banques = allBanques
                .filter(b => !b.matiere || b.matiere === evalMatiere)
                .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));
        }

        // Build table headers — adapté selon le type (conn, SF, TC)
        // Note : les bonus comp/ponctuel sortent plus haut via _renderSaisieBonus
        const showScoreDuree = !isTC;
        document.getElementById('saisieTableHead').innerHTML = `
            <th class="col-eleve">Élève</th>
            ${showSujet ? '<th class="col-banque">Banque</th>' : ''}
            ${showSujet ? '<th class="col-entrainement">Exercice</th>' : ''}
            ${showScoreDuree ? '<th class="col-score">Score (%)</th>' : ''}
            ${showScoreDuree ? '<th class="col-duree">Durée</th>' : ''}
            <th class="col-resultat">${isTC ? 'Points' : 'Résultat'}</th>
            ${isTC ? '<th class="col-criteres-resume">Compétences</th>' : ''}
            ${isTC ? '<th class="col-correction-action">Correction</th>' : ''}
            ${isTC ? '<th class="col-statut-correction">Statut</th>' : ''}
        `;

        // Render student rows
        const maxPts = evaluation.briques || 10;
        const tbody = document.getElementById('saisieTableBody');
        tbody.innerHTML = this.eleves.map(eleve => {
            const r = resultsMap[String(eleve.id).trim()] || {};
            const score = r.score !== undefined && r.score !== '' ? r.score : '';
            // Si statut_resultat = non_rendu/absent, afficher NR/ABS au lieu de 0
            const statutRes = String(r.statut_resultat || '').trim();
            const validations = (statutRes === 'non_rendu' || statutRes === 'absent')
                ? statutRes
                : (r.validations !== undefined && r.validations !== '' ? r.validations : '');
            const isAuto = r.source === 'auto' || (!r.source && r.id);
            const sourceBadge = r.id ? (isAuto ? '<span class="source-badge auto">🤖</span>' : '<span class="source-badge manuel">✏️</span>') : '';

            // Ligne verte si élève a réussi, orange si absent, rouge si non rendu
            const isSuccess = r.is_validated === true || r.is_validated === 'true' || (r.validations && parseInt(r.validations) > 0 && r.validations !== 'non_rendu' && r.validations !== 'absent');
            const isAbsent = validations === 'absent';
            const isNR = validations === 'non_rendu';

            // Score : lecture seule (affiche uniquement les remontées auto)
            const scoreCell = showScoreDuree ? `<td class="col-score">${score !== '' ? score + '%' : '—'}</td>` : '';

            // Durée : lecture seule
            const dureeCell = showScoreDuree ? `<td class="col-duree">${r.temps_passe ? this._formatDuree(r.temps_passe) : '—'}</td>` : '';

            // Colonnes TC : critères, bouton corriger, statut
            let criteresResumeCell = '';
            let correctionActionCell = '';
            let statutCorrectionCell = '';
            if (isTC) {
                const criteresValides = r.criteres_valides ? (() => { try { return JSON.parse(r.criteres_valides); } catch (_e) { return []; } })() : [];
                const compIds = this._getCompetenceIdsForEval(evaluation);
                const totalComps = compIds.length;
                let nbCompsValidees = 0;
                compIds.forEach(cid => {
                    const compCriteres = (this.criteresReussite || []).filter(c => String(c.competence_id) === String(cid));
                    if (compCriteres.length > 0 && compCriteres.every(c => criteresValides.indexOf(String(c.id)) !== -1)) {
                        nbCompsValidees++;
                    }
                });
                criteresResumeCell = `<td class="col-criteres-resume">${totalComps > 0 && nbCompsValidees > 0 ? `<span class="criteres-badge">${nbCompsValidees}/${totalComps}</span>` : '—'}</td>`;

                // Bouton corriger
                const hasCorrection = r.correction_prof || (criteresValides.length > 0);
                const corrBtnLabel = hasCorrection ? 'Modifier' : 'Corriger';
                const corrBtnClass = hasCorrection ? 'btn-modifier' : 'btn-corriger';
                const isSpecialStatus = isAbsent || isNR;
                correctionActionCell = `<td class="col-correction-action">${!isSpecialStatus ? `<button class="btn btn-sm ${corrBtnClass}" onclick="event.stopPropagation(); AdminEvaluations.openCorrectionWizard('${eleve.id}')">${corrBtnLabel}</button>` : ''}</td>`;

                // Statut correction
                const statutCorr = String(r.statut_correction || '').trim();
                let statutCorrLabel = '—';
                let statutCorrClass = '';
                if (statutCorr === 'brouillon') { statutCorrLabel = 'Brouillon'; statutCorrClass = 'statut-brouillon'; }
                else if (statutCorr === 'publie') { statutCorrLabel = 'Publié'; statutCorrClass = 'statut-publie'; }
                statutCorrectionCell = `<td class="col-statut-correction"><span class="saisie-statut ${statutCorrClass}">${statutCorrLabel}</span></td>`;
            }


            // Attribution: banque + entraînement dropdowns
            let banqueCell = '';
            let entrainementCell = '';
            if (showSujet) {
                // Si l'élève a déjà passé l'éval, afficher ce qu'il a réellement fait (lecture seule)
                const hasResult = r.id && r.banque_id;
                if (hasResult) {
                    const resultBanqueId = String(r.banque_id).trim();
                    const resultEntrId = String(r.entrainement_id || '').trim();
                    const resultBanque = banques.find(b => String(b.id).trim() === resultBanqueId);
                    const banqueLabel = resultBanque ? (resultBanque.titre || 'Sans titre') : resultBanqueId;

                    let entrLabel = '—';
                    if (resultEntrId) {
                        const entrList = isConn ? this.entrainementsConn : this.exercicesSF;
                        const entrObj = entrList.find(e => String(e.id).trim() === resultEntrId);
                        entrLabel = entrObj ? (entrObj.titre || entrObj.nom || resultEntrId) : resultEntrId;
                    }

                    // Stocker l'attribution réelle (pas de modification possible)
                    this._saisieAttributions[String(eleve.id).trim()] = {
                        banque_id: resultBanqueId,
                        entrainement_id: resultEntrId,
                        source: r.source || 'auto',
                        auto_banque_id: resultBanqueId
                    };

                    banqueCell = `<td class="col-banque"><span class="attribution-locked" title="Sujet réellement passé">${escapeHtml(banqueLabel)}</span></td>`;
                    entrainementCell = `<td class="col-entrainement"><span class="attribution-locked" title="Exercice réellement passé">${escapeHtml(entrLabel)}</span></td>`;
                } else {
                    // Pas encore passé : dropdowns modifiables
                    const existingAttr = attributionsMap[String(eleve.id).trim()];

                    // Compute auto banque from progression (résultats validés + fallback PROGRESSION_EVALUATION)
                    const autoBanqueIndex = this._getAutoBanqueIndex(
                        eleve.id, evaluation.type, evaluation.matiere || this.currentMatiere, banques
                    );
                    const autoBanque = banques[autoBanqueIndex];
                    const allowedBanques = banques.filter((_b, idx) => idx <= autoBanqueIndex);

                    // Determine current selection
                    const isManual = existingAttr && String(existingAttr.source).trim() === 'manuel';
                    const currentBanqueId = isManual ? String(existingAttr.banque_id || '').trim() : '';
                    const currentEntrId = existingAttr ? String(existingAttr.entrainement_id || '').trim() : '';
                    const effectiveBanqueId = currentBanqueId || (autoBanque ? autoBanque.id : '');

                    // Auto-assign an exercise if none specified (connaissances + SF)
                    let effectiveEntrId = currentEntrId;
                    if (!effectiveEntrId) {
                        const exerciseList = isConn
                            ? this.entrainementsConn.filter(e => String(e.banque_exercice_id).trim() === String(effectiveBanqueId).trim() && e.statut !== 'evaluation')
                            : this.exercicesSF.filter(e => String(e.banque_id).trim() === String(effectiveBanqueId).trim());
                        if (exerciseList.length > 0) {
                            const randomIndex = Math.floor(Math.random() * exerciseList.length);
                            effectiveEntrId = String(exerciseList[randomIndex].id).trim();
                        }
                    }

                    // Store initial attribution state
                    this._saisieAttributions[String(eleve.id).trim()] = {
                        banque_id: effectiveBanqueId,
                        entrainement_id: effectiveEntrId,
                        source: isManual ? 'manuel' : 'auto',
                        auto_banque_id: autoBanque ? autoBanque.id : ''
                    };

                    // Banque dropdown
                    const banqueOptions = `<option value="">${escapeHtml('Auto' + (autoBanque ? ' (' + (autoBanque.titre || '') + ')' : ''))}</option>` +
                        allowedBanques.map(b => {
                            const sel = currentBanqueId === String(b.id).trim() ? 'selected' : '';
                            return `<option value="${b.id}" ${sel}>${escapeHtml(b.titre || 'Sans titre')}</option>`;
                        }).join('');

                    banqueCell = `<td class="col-banque">
                        <select class="saisie-select banque-select" data-eleve="${eleve.id}"
                            onchange="AdminEvaluations._onSaisieBanqueChange('${eleve.id}', this.value)">
                            ${banqueOptions}
                        </select>
                    </td>`;

                    // Exercice dropdown (connaissances + SF)
                    const exerciceOptions = isConn
                        ? this._buildEntrainementOptions(effectiveBanqueId, effectiveEntrId)
                        : this._buildExerciceSFOptions(effectiveBanqueId, effectiveEntrId);
                    entrainementCell = `<td class="col-entrainement">
                        <select class="saisie-select entrainement-select" data-eleve="${eleve.id}"
                            onchange="AdminEvaluations._onSaisieEntrainementChange('${eleve.id}', this.value)">
                            ${exerciceOptions}
                        </select>
                    </td>`;
                }
            }

            // Build résultat select options
            let resultatOptions = '<option value="">—</option>';
            for (let i = 0; i <= maxPts; i++) {
                const selected = String(validations) === String(i) ? 'selected' : '';
                resultatOptions += `<option value="${i}" ${selected}>${i}</option>`;
            }
            const nrSelected = validations === 'non_rendu' ? 'selected' : '';
            const absSelected = validations === 'absent' ? 'selected' : '';
            resultatOptions += `<option value="non_rendu" ${nrSelected}>NR</option>`;
            resultatOptions += `<option value="absent" ${absSelected}>ABS</option>`;

            return `
                <tr data-eleve-id="${eleve.id}" class="${isSuccess ? 'success-row' : ''} ${isAbsent ? 'absent-row' : ''} ${isNR ? 'nr-row' : ''} ${!r.id ? 'no-result' : ''}">
                    <td class="col-eleve">
                        <span class="eleve-name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</span>
                        ${sourceBadge}
                    </td>
                    ${banqueCell}
                    ${entrainementCell}
                    ${scoreCell}
                    ${dureeCell}
                    <td class="col-resultat">
                        <select class="saisie-select resultat-select"
                            onchange="AdminEvaluations.onSaisieChange('${eleve.id}', 'validations', this.value)">
                            ${resultatOptions}
                        </select>
                    </td>
                    ${criteresResumeCell}
                    ${correctionActionCell}
                    ${statutCorrectionCell}
                </tr>
            `;
        }).join('');

        // Hide loader, show table
        document.getElementById('saisieLoader').style.display = 'none';
        document.getElementById('saisieTableContainer').style.display = '';

        // Afficher la barre "Tout publier" si c'est une TC avec des brouillons
        const publishBar = document.getElementById('saisiePublishBar');
        if (publishBar) {
            if (isTC) {
                const hasBrouillons = evalResults.some(r => r.correction_prof && String(r.statut_correction).trim() === 'brouillon');
                publishBar.style.display = hasBrouillons ? 'flex' : 'none';
            } else {
                publishBar.style.display = 'none';
            }
        }
    },

    /**
     * Changement de banque dans la saisie — met à jour le dropdown entraînement
     */
    _onSaisieBanqueChange(eleveId, banqueId) {
        const attr = this._saisieAttributions[eleveId];
        if (!attr) return;

        const effectiveBanqueId = banqueId || attr.auto_banque_id;
        attr.banque_id = effectiveBanqueId;
        attr.source = banqueId ? 'manuel' : 'auto';
        attr._changed = true;

        // Update exercice dropdown — auto-assign random (conn + SF)
        const entrSelect = document.querySelector(`.entrainement-select[data-eleve="${eleveId}"]`);
        if (entrSelect) {
            const isConn = this.saisieEvaluation && this.saisieEvaluation.type === 'connaissances';
            entrSelect.innerHTML = isConn
                ? this._buildEntrainementOptions(effectiveBanqueId, '')
                : this._buildExerciceSFOptions(effectiveBanqueId, '');
            attr.entrainement_id = entrSelect.value || '';
        }

        document.getElementById('saisieSaveBar').style.display = 'flex';
    },

    _onSaisieEntrainementChange(eleveId, entrainementId) {
        const attr = this._saisieAttributions[eleveId];
        if (!attr) return;
        attr.entrainement_id = entrainementId;
        attr._changed = true;
        document.getElementById('saisieSaveBar').style.display = 'flex';
    },

    _formatDuree(seconds) {
        const s = parseInt(seconds) || 0;
        if (s <= 0) return '';
        const min = Math.floor(s / 60);
        const sec = s % 60;
        return `${min}:${String(sec).padStart(2, '0')}`;
    },

    // ========== SAISIE DES RÉSULTATS (sommative) ==========
    openSaisieSommative(sommativeId) {
        const sommative = this.sommatives.find(s => s.id === sommativeId);
        if (!sommative) return;

        this.saisieSommative = sommative;
        this.saisieEvaluation = null;
        this.saisieChanges = {};

        // Get existing results
        const somResults = this.resultatsSommatives.filter(r =>
            String(r.sommative_id).trim() === String(sommativeId).trim()
        );
        const resultsMap = {};
        somResults.forEach(r => { resultsMap[String(r.eleve_id).trim()] = r; });

        // Update header
        document.getElementById('saisieTitle').textContent = escapeHtml(sommative.titre || 'Sans titre');
        document.getElementById('saisieSubtitle').textContent =
            `Sommative · /${sommative.bareme || 20} · Coef. ${sommative.coefficient || 1}`;

        // Update table headers for sommative
        document.getElementById('saisieTableHead').innerHTML = `
            <th class="col-eleve">Élève</th>
            <th class="col-note">Note /${sommative.bareme || 20}</th>
            <th class="col-remarque">Remarque</th>
            <th class="col-actions">Actions</th>
        `;

        // Render student rows
        const bareme = sommative.bareme || 20;
        const tbody = document.getElementById('saisieTableBody');
        tbody.innerHTML = this.eleves.map(eleve => {
            const r = resultsMap[String(eleve.id).trim()] || {};
            const note = r.note !== undefined && r.note !== '' ? r.note : '';
            const remarque = r.remarque_texte || '';

            return `
                <tr data-eleve-id="${eleve.id}">
                    <td class="col-eleve">
                        <span class="eleve-name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</span>
                    </td>
                    <td class="col-note">
                        <input type="number" class="saisie-input note-input" value="${note}" min="0" max="${bareme}" step="0.5"
                            placeholder="—"
                            onchange="AdminEvaluations.onSaisieChange('${eleve.id}', 'note', this.value)">
                    </td>
                    <td class="col-remarque">
                        <input type="text" class="saisie-input remarque-input" value="${escapeHtml(remarque)}"
                            placeholder="Remarque..."
                            onchange="AdminEvaluations.onSaisieChange('${eleve.id}', 'remarque_texte', this.value)">
                    </td>
                    <td class="col-actions">
                        ${r.id ? '<span class="saisie-saved">✓</span>' : ''}
                    </td>
                </tr>
            `;
        }).join('');

        // Show saisie view
        document.getElementById('evaluations-content').style.display = 'none';
        document.getElementById('saisie-content').style.display = 'block';
        document.getElementById('saisieLoader').style.display = 'none';
        document.getElementById('saisieTableContainer').style.display = '';
    },

    onSaisieChange(eleveId, field, value) {
        if (!this.saisieChanges[eleveId]) {
            this.saisieChanges[eleveId] = {};
        }
        this.saisieChanges[eleveId][field] = value;
        // Saisie manuelle → marquer la source comme 'manuel'
        this.saisieChanges[eleveId].source = 'manuel';

        const row = document.querySelector(`tr[data-eleve-id="${eleveId}"]`);
        if (row) {
            // Mettre à jour le badge source visuellement
            const badge = row.querySelector('.source-badge');
            if (badge) {
                badge.className = 'source-badge manuel';
                badge.textContent = '✏️ Manuel';
            }

            // Mettre à jour la couleur de ligne quand on change le résultat
            if (field === 'validations') {
                const isSuccess = value && parseInt(value) > 0 && value !== 'non_rendu' && value !== 'absent';
                row.classList.toggle('success-row', isSuccess);
                row.classList.toggle('absent-row', value === 'absent');
                row.classList.toggle('nr-row', value === 'non_rendu');
                row.classList.toggle('no-result', false);
            }
        }

        // Show save bar
        document.getElementById('saisieSaveBar').style.display = 'flex';
    },

    /**
     * Changement de score : calcule auto les points (seuil atteint → max pts, sinon 0)
     */
    onSaisieScoreChange(eleveId, scoreValue, maxPts, seuil) {
        const score = parseInt(scoreValue);
        this.onSaisieChange(eleveId, 'score', scoreValue);

        if (!isNaN(score)) {
            const points = score >= seuil ? maxPts : 0;
            this.saisieChanges[eleveId].validations = points;
            // Mettre à jour le select résultat dans le DOM
            const row = document.querySelector(`tr[data-eleve-id="${eleveId}"]`);
            if (row) {
                const select = row.querySelector('.resultat-select');
                if (select) select.value = String(points);
            }
        }
    },

    cancelSaisie() {
        this.saisieChanges = {};
        document.getElementById('saisieSaveBar').style.display = 'none';
        this.closeSaisie();
    },

    closeSaisie() {
        document.getElementById('saisie-content').style.display = 'none';
        document.getElementById('evaluations-content').style.display = 'block';
        document.getElementById('saisieSaveBar').style.display = 'none';
        this.saisieEvaluation = null;
        this.saisieSommative = null;
        this.saisieChanges = {};
        this._saisieAttributions = {};
    },

    async saveSaisie() {
        // Check for attribution changes too
        const hasAttrChanges = this._saisieAttributions && Object.values(this._saisieAttributions).some(a => a._changed);
        const changedIds = Object.keys(this.saisieChanges);
        if (changedIds.length === 0 && !hasAttrChanges) {
            this.showNotification('Aucune modification à enregistrer');
            return;
        }

        const saveBtn = document.getElementById('saisieSaveBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        let errors = 0;

        try {
            for (const eleveId of changedIds) {
                const changes = this.saisieChanges[eleveId];
                let result;

                if (this.saisieEvaluation) {
                    // Handle NR/ABS special values
                    const validations = changes.validations;
                    const isSpecial = validations === 'non_rendu' || validations === 'absent';
                    const numericValidations = isSpecial ? 0 : validations;

                    // Include attribution banque_id + entrainement_id for traceability
                    // Clé normalisée (trim) pour matcher _saisieAttributions
                    const attrKey = String(eleveId).trim();
                    const attr = this._saisieAttributions ? this._saisieAttributions[attrKey] : null;

                    // Déterminer is_validated :
                    // - NR/ABS → false
                    // - Score saisi → score >= seuil
                    // - Pas de score mais points > 0 (mode papier) → true
                    let isValidated;
                    if (isSpecial) {
                        isValidated = false;
                    } else if (changes.score !== undefined && changes.score !== '') {
                        isValidated = parseInt(changes.score) >= (this.saisieEvaluation.seuil || 80);
                    } else if (numericValidations !== undefined && parseInt(numericValidations) > 0) {
                        isValidated = true;
                    }

                    // Progression evaluation result
                    result = await this.callAPI('saveEvaluationResult', {
                        evaluation_id: this.saisieEvaluation.id,
                        eleve_id: eleveId,
                        ...changes,
                        validations: numericValidations,
                        statut_resultat: isSpecial ? validations : '',
                        is_validated: isValidated,
                        banque_id: attr ? attr.banque_id : '',
                        entrainement_id: attr ? attr.entrainement_id : ''
                    });
                } else if (this.saisieSommative) {
                    // Sommative result
                    result = await this.callAPI('saveResultatSommative', {
                        sommative_id: this.saisieSommative.id,
                        eleve_id: eleveId,
                        ...changes
                    });
                }

                if (!result || !result.success) {
                    errors++;
                    console.error('Erreur sauvegarde pour élève', eleveId, result);
                }
            }

            // Save attributions if changed
            if (this.saisieEvaluation && this._saisieAttributions) {
                const attributions = [];
                for (const [eleveId, attr] of Object.entries(this._saisieAttributions)) {
                    attributions.push({
                        eleve_id: eleveId,
                        banque_id: attr.banque_id || '',
                        entrainement_id: attr.entrainement_id || '',
                        source: attr.source || 'auto'
                    });
                }
                try {
                    await this.callAPI('saveAttributionsSujets', {
                        evaluation_id: this.saisieEvaluation.id,
                        attributions: JSON.stringify(attributions)
                    });
                } catch (_e) {
                    console.warn('Erreur sauvegarde attributions:', _e);
                }
            }

            if (errors === 0) {
                const nbResults = changedIds.length;
                this.showNotification(nbResults > 0 ? `${nbResults} résultat(s) enregistré(s)` : 'Attributions enregistrées');
                this.saisieChanges = {};
                document.getElementById('saisieSaveBar').style.display = 'none';

                // Reload data and re-open saisie
                SheetsAPI.clearCache();
                await this.loadData();

                if (this.saisieEvaluation) {
                    this.openSaisie(this.saisieEvaluation.id);
                } else if (this.saisieSommative) {
                    this.openSaisieSommative(this.saisieSommative.id);
                }
            } else {
                this.showNotification(`${errors} erreur(s) lors de la sauvegarde`, 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde saisie:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer';
        }
    },

    // ========== ATTRIBUTION MODAL ==========
    async openAttributionModal(evaluationId) {
        const modal = document.getElementById('attributionModal');
        document.getElementById('attributionEvaluationId').value = evaluationId;

        const evaluation = this.evaluations.find(e => String(e.id) === String(evaluationId));
        if (!evaluation) return;

        // Show modal with loading state
        modal.classList.remove('hidden');
        document.getElementById('attributionLoading').style.display = '';
        document.getElementById('attributionTable').style.display = 'none';

        const type = evaluation.type;
        const matiere = evaluation.matiere || this.currentMatiere;
        const isConn = type === 'connaissances';

        // Show/hide entrainement column for connaissances
        document.getElementById('attributionEntrainementHeader').style.display = isConn ? '' : 'none';

        // Get banques sorted by ordre, filtered by matière
        const allBanques = isConn ? [...this.banquesExercicesConn] : [...this.banquesSF];
        const banques = allBanques
            .filter(b => !b.matiere || b.matiere === matiere)
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        if (banques.length === 0) {
            document.getElementById('attributionLoading').innerHTML = 'Aucune banque disponible pour ce type.';
            return;
        }

        // Load existing attributions
        let existingAttributions = [];
        try {
            const attrResult = await this.callAPI('getAttributionsSujets', { evaluation_id: evaluationId });
            if (attrResult.success) existingAttributions = attrResult.data || [];
        } catch (_e) { /* ignore */ }

        // Build rows
        const tbody = document.getElementById('attributionTableBody');
        tbody.innerHTML = this.eleves.map(eleve => {
            // Compute auto banque from progression (résultats validés + fallback PROGRESSION_EVALUATION)
            const autoBanqueIndex = this._getAutoBanqueIndex(eleve.id, type, matiere, banques);
            const autoBanque = banques[autoBanqueIndex];
            const autoBanqueName = autoBanque ? escapeHtml(autoBanque.titre || 'Sans titre') : '-';

            // Check existing attribution
            const existing = existingAttributions.find(a =>
                String(a.eleve_id).trim() === String(eleve.id).trim()
            );
            const existingBanqueId = existing ? String(existing.banque_id).trim() : '';
            const existingEntrainementId = existing ? String(existing.entrainement_id || '').trim() : '';
            const isManual = existing && String(existing.source).trim() === 'manuel';

            // Build banque dropdown — only validated banques + current auto banque
            const allowedBanques = banques.filter((_b, idx) => idx <= autoBanqueIndex);
            const banqueOptions = `<option value="">Auto (${escapeHtml(autoBanque?.titre || '')})</option>` +
                allowedBanques.map(b => {
                    const selected = isManual && existingBanqueId === String(b.id).trim() ? 'selected' : '';
                    return `<option value="${b.id}" ${selected}>${escapeHtml(b.titre || 'Sans titre')}</option>`;
                }).join('');

            // Entrainement column (connaissances only)
            let entrainementCell = '';
            if (isConn) {
                const selectedBanqueId = isManual && existingBanqueId ? existingBanqueId : (autoBanque ? autoBanque.id : '');
                entrainementCell = `<td>
                    <select class="form-select attribution-entrainement-select" data-eleve="${eleve.id}">
                        ${this._buildEntrainementOptions(selectedBanqueId, existingEntrainementId)}
                    </select>
                </td>`;
            }

            return `
                <tr data-eleve-id="${eleve.id}" data-auto-banque="${autoBanque ? autoBanque.id : ''}">
                    <td>${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</td>
                    <td><span class="attribution-auto-badge">${autoBanqueName}</span></td>
                    <td>
                        <select class="form-select attribution-banque-select" data-eleve="${eleve.id}"
                            onchange="AdminEvaluations._onAttributionBanqueChange('${eleve.id}', this.value)">
                            ${banqueOptions}
                        </select>
                    </td>
                    ${entrainementCell}
                </tr>`;
        }).join('');

        // Hide loading, show table
        document.getElementById('attributionLoading').style.display = 'none';
        document.getElementById('attributionTable').style.display = '';
    },

    _buildEntrainementOptions(banqueId, selectedId) {
        if (!banqueId) return '<option value="">-</option>';
        const entrainements = this.entrainementsConn
            .filter(e => String(e.banque_exercice_id).trim() === String(banqueId).trim() && e.statut !== 'evaluation')
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        if (entrainements.length === 0) return '<option value="">Aucun exercice</option>';

        // Si pas de sélection existante, tirer au sort un exercice
        let effectiveSelectedId = selectedId;
        if (!effectiveSelectedId && entrainements.length > 0) {
            const randomIndex = Math.floor(Math.random() * entrainements.length);
            effectiveSelectedId = String(entrainements[randomIndex].id).trim();
        }

        return entrainements.map(e => {
                const selected = String(e.id).trim() === String(effectiveSelectedId).trim() ? 'selected' : '';
                return `<option value="${e.id}" ${selected}>${escapeHtml(e.titre || 'Sans titre')}</option>`;
            }).join('');
    },

    _buildExerciceSFOptions(banqueId, selectedId) {
        if (!banqueId) return '<option value="">-</option>';
        const exercices = this.exercicesSF
            .filter(e => String(e.banque_id).trim() === String(banqueId).trim())
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));

        if (exercices.length === 0) return '<option value="">Aucun exercice</option>';

        // Si pas de sélection existante, tirer au sort
        let effectiveSelectedId = selectedId;
        if (!effectiveSelectedId && exercices.length > 0) {
            const randomIndex = Math.floor(Math.random() * exercices.length);
            effectiveSelectedId = String(exercices[randomIndex].id).trim();
        }

        return exercices.map(e => {
            const selected = String(e.id).trim() === String(effectiveSelectedId).trim() ? 'selected' : '';
            return `<option value="${e.id}" ${selected}>${escapeHtml(e.titre || 'Sans titre')}</option>`;
        }).join('');
    },

    _onAttributionBanqueChange(eleveId, banqueId) {
        // Update entrainement dropdown if connaissances
        const entrSelect = document.querySelector(`.attribution-entrainement-select[data-eleve="${eleveId}"]`);
        if (!entrSelect) return;

        const row = entrSelect.closest('tr');
        const autoBanqueId = row.dataset.autoBanque;
        const effectiveBanqueId = banqueId || autoBanqueId;

        entrSelect.innerHTML = this._buildEntrainementOptions(effectiveBanqueId, '');
    },

    closeAttributionModal() {
        document.getElementById('attributionModal').classList.add('hidden');
    },

    async saveAttributions() {
        const evaluationId = document.getElementById('attributionEvaluationId').value;
        if (!evaluationId) return;

        const evaluation = this.evaluations.find(e => String(e.id) === String(evaluationId));
        if (!evaluation) return;

        const isConn = evaluation.type === 'connaissances';
        const rows = document.querySelectorAll('#attributionTableBody tr');
        const attributions = [];

        rows.forEach(row => {
            const eleveId = row.dataset.eleveId;
            const autoBanqueId = row.dataset.autoBanque;
            const banqueSelect = row.querySelector('.attribution-banque-select');
            const overrideBanqueId = banqueSelect ? banqueSelect.value : '';

            const effectiveBanqueId = overrideBanqueId || autoBanqueId;
            const source = overrideBanqueId ? 'manuel' : 'auto';

            let entrainementId = '';
            if (isConn) {
                const entrSelect = row.querySelector('.attribution-entrainement-select');
                entrainementId = entrSelect ? entrSelect.value : '';
            }

            attributions.push({
                eleve_id: eleveId,
                banque_id: effectiveBanqueId,
                entrainement_id: entrainementId,
                source: source
            });
        });

        const saveBtn = document.getElementById('saveAttributionBtn');
        try {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Enregistrement...';

            const result = await this.callAPI('saveAttributionsSujets', {
                evaluation_id: evaluationId,
                attributions: JSON.stringify(attributions)
            });

            if (result.success) {
                this.closeAttributionModal();
                this.showNotification('Attributions enregistrées');
            } else {
                this.showNotification('Erreur: ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde attributions:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les attributions';
        }
    },

    // ========== DELETE ==========
    editEvaluation(id) {
        const evaluation = this.evaluations.find(e => String(e.id) === String(id));
        if (evaluation) this.openModal(evaluation);
    },

    toggleStatusDropdown(event, evalId) {
        event.stopPropagation();
        const dropdown = document.getElementById(`status-dropdown-${evalId}`);
        // Fermer tous les autres dropdowns
        document.querySelectorAll('.status-dropdown.open').forEach(d => {
            if (d.id !== `status-dropdown-${evalId}`) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    },

    async changeStatut(evalId, newStatut) {
        // Fermer le dropdown
        document.querySelectorAll('.status-dropdown.open').forEach(d => d.classList.remove('open'));

        const evaluation = this.evaluations.find(e => String(e.id) === String(evalId));
        if (!evaluation) return;

        const oldStatut = evaluation.statut;
        if (oldStatut === newStatut) return;

        // Mise à jour optimiste
        evaluation.statut = newStatut;
        this.renderEvaluations();

        try {
            const result = await this.callAPI('updateEvaluation', { id: evalId, statut: newStatut });
            if (!result.success) {
                evaluation.statut = oldStatut;
                this.renderEvaluations();
                this.showNotification('Erreur lors du changement de statut', 'error');
            } else {
                // Invalider le cache pour que le rechargement reflète le changement
                SheetsAPI.clearCacheFor('EVALUATIONS');
            }
        } catch (err) {
            evaluation.statut = oldStatut;
            this.renderEvaluations();
            this.showNotification('Erreur réseau', 'error');
        }
    },

    confirmDelete(id, type) {
        document.getElementById('deleteEvaluationId').value = id;
        document.getElementById('deleteEvaluationType').value = type || 'evaluation';
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async deleteEvaluation() {
        const id = document.getElementById('deleteEvaluationId').value;
        const type = document.getElementById('deleteEvaluationType').value;

        try {
            document.getElementById('confirmDeleteBtn').disabled = true;
            document.getElementById('confirmDeleteBtn').textContent = 'Suppression...';

            let result;
            if (type === 'sommative') {
                result = await this.callAPI('deleteNoteSommative', { id });
            } else {
                result = await this.callAPI('deleteEvaluation', { id });
            }

            if (result.success) {
                this.closeDeleteModal();
                SheetsAPI.clearCache();
                await this.loadData();
                this.updateCounts();
                this.renderEvaluations();
                this.showNotification('Supprimé avec succès');
            } else {
                this.showNotification('Erreur: ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            this.showNotification('Erreur lors de la suppression', 'error');
        } finally {
            document.getElementById('confirmDeleteBtn').disabled = false;
            document.getElementById('confirmDeleteBtn').textContent = 'Supprimer';
        }
    },

    // ========== AUTO-ATTRIBUTION HELPERS ==========

    /**
     * Détermine l'index de la prochaine banque à attribuer à un élève.
     * Source de vérité : EVALUATION_RESULTATS (résultats validés avec banque_id).
     * Fallback : PROGRESSION_EVALUATION (derniere_banque_validee_id).
     *
     * @param {string} eleveId - ID de l'élève
     * @param {string} type - 'connaissances' ou 'savoir-faire'
     * @param {string} matiere - 'FR', 'HG-EMC', etc.
     * @param {Array} banques - banques triées par ordre
     * @returns {number} index dans le tableau banques (0 = première banque)
     */
    _getAutoBanqueIndex(eleveId, type, matiere, banques) {
        if (!banques.length) return 0;

        // 1. Chercher les résultats validés de cet élève pour ce type/matière
        // On parcourt TOUTES les évaluations du même type/matière
        const sameTypeEvals = this.evaluations.filter(ev =>
            String(ev.type).trim() === type &&
            (String(ev.matiere || '').trim() === matiere || String(ev.matiere || '').trim() === 'Les deux')
        );
        const sameTypeEvalIds = new Set(sameTypeEvals.map(ev => String(ev.id).trim()));

        // Résultats validés de cet élève pour ces évaluations
        const validatedResults = this.resultats.filter(r =>
            String(r.eleve_id).trim() === String(eleveId).trim() &&
            sameTypeEvalIds.has(String(r.evaluation_id).trim()) &&
            (r.is_validated === true || r.is_validated === 'true' || r.is_validated === 'TRUE')
        );

        // Collecter les banque_id validées
        const validatedBanqueIds = new Set();
        validatedResults.forEach(r => {
            const bid = String(r.banque_id || '').trim();
            if (bid) validatedBanqueIds.add(bid);
        });

        // 2. Trouver l'index de la dernière banque validée (la plus avancée dans l'ordre)
        let lastValidatedIndex = -1;
        banques.forEach((b, idx) => {
            if (validatedBanqueIds.has(String(b.id).trim())) {
                if (idx > lastValidatedIndex) lastValidatedIndex = idx;
            }
        });

        // 3. Fallback sur PROGRESSION_EVALUATION si aucun résultat validé trouvé
        if (lastValidatedIndex < 0) {
            const prog = this.progressionsEvaluation.find(p =>
                String(p.eleve_id).trim() === String(eleveId).trim() &&
                String(p.type).trim() === type &&
                (!p.matiere || String(p.matiere).trim() === matiere)
            );
            const lastValidatedId = prog ? String(prog.derniere_banque_validee_id || '').trim() : '';
            if (lastValidatedId) {
                lastValidatedIndex = banques.findIndex(b => String(b.id).trim() === lastValidatedId);
            }
        }

        // 4. Prochaine banque = index + 1, ou même banque si déjà à la dernière
        if (lastValidatedIndex >= 0) {
            return Math.min(lastValidatedIndex + 1, banques.length - 1);
        }
        return 0; // Aucune banque validée → première banque
    },

    // ========== SAISIE SUIVI (bonus suivi — checkboxes progressives) ==========

    /**
     * Rendu spécial pour le bonus suivi : checkboxes progressives (1/5, 2/5...)
     */
    _renderSaisieSuivi(evaluation, evalResults, resultsMap) {
        const nbValidations = parseInt(evaluation.nb_validations) || 5;
        const maxPts = evaluation.briques || 10;

        // Build header: Élève + N colonnes de validation + Total + Points
        let headerCols = '<th class="col-eleve">Élève</th>';
        for (let i = 1; i <= nbValidations; i++) {
            headerCols += `<th class="col-validation">V${i}</th>`;
        }
        headerCols += '<th class="col-total">Total</th>';
        headerCols += '<th class="col-points">Points</th>';
        document.getElementById('saisieTableHead').innerHTML = headerCols;

        const tbody = document.getElementById('saisieTableBody');
        tbody.innerHTML = this.eleves.map(eleve => {
            const r = resultsMap[String(eleve.id).trim()] || {};
            const currentValidations = parseInt(r.validation_numero) || 0;
            const isComplete = currentValidations >= nbValidations;
            const points = isComplete ? maxPts : 0;

            // Build checkbox cells
            let checkboxCells = '';
            for (let i = 1; i <= nbValidations; i++) {
                const checked = i <= currentValidations ? 'checked' : '';
                const disabled = i > currentValidations + 1 ? 'disabled' : ''; // Only next one is clickable
                checkboxCells += `
                    <td class="col-validation">
                        <input type="checkbox" class="suivi-checkbox" ${checked} ${disabled}
                            data-eleve="${eleve.id}" data-validation="${i}"
                            onchange="AdminEvaluations.onSuiviCheckChange('${eleve.id}', ${i}, this.checked)">
                    </td>`;
            }

            return `
                <tr data-eleve-id="${eleve.id}" class="${isComplete ? 'success-row' : ''}">
                    <td class="col-eleve">
                        <span class="eleve-name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</span>
                    </td>
                    ${checkboxCells}
                    <td class="col-total">
                        <span class="suivi-progress">${currentValidations}/${nbValidations}</span>
                    </td>
                    <td class="col-points">
                        <span class="suivi-points ${isComplete ? 'complete' : ''}">${points}/${maxPts}</span>
                    </td>
                </tr>
            `;
        }).join('');

        // Hide loader, show table
        document.getElementById('saisieLoader').style.display = 'none';
        document.getElementById('saisieTableContainer').style.display = '';
    },

    /**
     * Gère le clic sur une checkbox suivi
     */
    async onSuiviCheckChange(eleveId, validationNum, checked) {
        // Si on décoche, on revient à validation_numero - 1
        const newValidation = checked ? validationNum : validationNum - 1;

        // Disable all checkboxes during save
        document.querySelectorAll('.suivi-checkbox').forEach(cb => cb.disabled = true);

        try {
            const result = await this.callAPI('saveValidationSuivi', {
                evaluation_id: this.saisieEvaluation.id,
                eleve_id: eleveId,
                validation_numero: newValidation
            });

            if (result.success) {
                const nbValidations = parseInt(this.saisieEvaluation.nb_validations) || 5;
                const maxPts = this.saisieEvaluation.briques || 10;
                const isComplete = newValidation >= nbValidations;

                // Update row visually
                const row = document.querySelector(`tr[data-eleve-id="${eleveId}"]`);
                if (row) {
                    // Update checkboxes
                    row.querySelectorAll('.suivi-checkbox').forEach(cb => {
                        const vNum = parseInt(cb.dataset.validation);
                        cb.checked = vNum <= newValidation;
                        cb.disabled = vNum > newValidation + 1;
                    });
                    // Update total
                    const totalEl = row.querySelector('.suivi-progress');
                    if (totalEl) totalEl.textContent = `${newValidation}/${nbValidations}`;
                    // Update points
                    const ptsEl = row.querySelector('.suivi-points');
                    if (ptsEl) {
                        const pts = isComplete ? maxPts : 0;
                        ptsEl.textContent = `${pts}/${maxPts}`;
                        ptsEl.classList.toggle('complete', isComplete);
                    }
                    row.classList.toggle('success-row', isComplete);
                }

                // Si complet → aussi sauvegarder comme résultat d'évaluation validé
                if (isComplete) {
                    await this.callAPI('saveEvaluationResult', {
                        evaluation_id: this.saisieEvaluation.id,
                        eleve_id: eleveId,
                        validations: maxPts,
                        is_validated: true,
                        source: 'saisie_admin'
                    });
                }

                this.showNotification(`Validation ${newValidation}/${nbValidations} enregistrée`);
            } else {
                this.showNotification(result.error || 'Erreur', 'error');
                // Revert checkbox
                const cb = document.querySelector(`.suivi-checkbox[data-eleve="${eleveId}"][data-validation="${validationNum}"]`);
                if (cb) cb.checked = !checked;
            }
        } catch (error) {
            console.error('Erreur sauvegarde suivi:', error);
            this.showNotification('Erreur réseau', 'error');
            const cb = document.querySelector(`.suivi-checkbox[data-eleve="${eleveId}"][data-validation="${validationNum}"]`);
            if (cb) cb.checked = !checked;
        } finally {
            // Re-enable checkboxes
            document.querySelectorAll('.suivi-checkbox').forEach(cb => {
                const vNum = parseInt(cb.dataset.validation);
                const row = cb.closest('tr');
                const currentVal = parseInt(row.querySelector('.suivi-progress').textContent) || 0;
                cb.disabled = vNum > currentVal + 1;
            });
        }
    },

    // ========== SAISIE BONUS (comp/ponctuel — demandes + correction) ==========

    /**
     * Rendu spécial pour bonus compétence et bonus ponctuel :
     * seuls les élèves ayant fait une demande apparaissent.
     * Colonnes : Élève | Demande [actions] | Date | Correction | Statut | Points
     */
    _renderSaisieBonus(evaluation, evalResults, resultsMap) {
        const maxPts = evaluation.briques || 10;

        // Filtrer : uniquement les élèves avec une demande (demande_statut non vide)
        const elevesAvecDemande = this.eleves.filter(eleve => {
            const r = resultsMap[String(eleve.id).trim()];
            return r && String(r.demande_statut || '').trim();
        });

        // Headers
        document.getElementById('saisieTableHead').innerHTML = `
            <th class="col-bonus-eleve">Élève</th>
            <th class="col-bonus-demande">Demande</th>
            <th class="col-bonus-date">Date</th>
            <th class="col-bonus-correction">Correction</th>
            <th class="col-bonus-statut">Statut</th>
            <th class="col-bonus-points">Points</th>
        `;

        const tbody = document.getElementById('saisieTableBody');

        if (elevesAvecDemande.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray-400);">Aucun élève n'a encore demandé cette évaluation.</td></tr>`;
        } else {
            tbody.innerHTML = elevesAvecDemande.map(eleve => {
                const r = resultsMap[String(eleve.id).trim()] || {};
                const demandeStatut = String(r.demande_statut || '').trim();

                // --- Colonne Demande : badge cliquable ---
                let demandeHtml = '';
                if (demandeStatut === 'demande') {
                    demandeHtml = `<button class="saisie-badge-btn badge-en-attente" onclick="event.stopPropagation(); AdminEvaluations.openReponseModal('${evaluation.id}', '${eleve.id}')">🟡 En attente</button>`;
                } else if (demandeStatut === 'accepte' || demandeStatut === 'corrige') {
                    demandeHtml = `<button class="saisie-badge-btn badge-acceptee" onclick="event.stopPropagation(); AdminEvaluations.openReponseModal('${evaluation.id}', '${eleve.id}')">🟢 Acceptée</button>`;
                } else if (demandeStatut === 'refuse') {
                    demandeHtml = `<button class="saisie-badge-btn badge-refusee" onclick="event.stopPropagation(); AdminEvaluations.openReponseModal('${evaluation.id}', '${eleve.id}')">🔴 Refusée</button>`;
                }

                // --- Colonne Date ---
                let dateHtml = '—';
                if (demandeStatut === 'accepte' || demandeStatut === 'corrige') {
                    const typeDate = r.type_date || '';
                    const dateRendu = r.date_rendu || r.date_acceptation || '';
                    if (dateRendu) {
                        const dateLabel = typeDate === 'date_butoir' ? 'Date butoir' : 'Passage classe';
                        const dateFormatted = new Date(dateRendu).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                        dateHtml = `<div class="date-info">${dateFormatted}</div><div class="date-type">${dateLabel}</div>`;
                    }
                }

                // --- Colonne Correction ---
                const criteresValides = r.criteres_valides ? (() => { try { return JSON.parse(r.criteres_valides); } catch (_e) { return []; } })() : [];
                const hasCorrection = r.correction_prof || criteresValides.length > 0;
                const corrBtnLabel = hasCorrection ? 'Modifier' : 'Corriger';
                const corrBtnClass = hasCorrection ? 'btn-modifier' : 'btn-corriger';
                const canCorrect = demandeStatut === 'accepte' || demandeStatut === 'corrige';
                const correctionHtml = canCorrect
                    ? `<button class="btn btn-sm ${corrBtnClass}" onclick="event.stopPropagation(); AdminEvaluations.openCorrectionWizard('${eleve.id}')">${corrBtnLabel}</button>`
                    : '—';

                // --- Colonne Statut correction : toggle cliquable ---
                const statutCorr = String(r.statut_correction || '').trim();
                let statutCorrHtml = '—';
                if (statutCorr === 'brouillon') {
                    statutCorrHtml = `<button class="saisie-badge-btn badge-brouillon" onclick="event.stopPropagation(); AdminEvaluations._toggleStatutCorrection('${evaluation.id}', '${eleve.id}', 'publie', this)">🟠 Brouillon</button>`;
                } else if (statutCorr === 'publie') {
                    statutCorrHtml = `<button class="saisie-badge-btn badge-publie" onclick="event.stopPropagation(); AdminEvaluations._toggleStatutCorrection('${evaluation.id}', '${eleve.id}', 'brouillon', this)">🟢 Publié</button>`;
                }

                // --- Colonne Points ---
                let pointsHtml = '—';
                if (hasCorrection) {
                    const pts = parseInt(r.validations) || 0;
                    pointsHtml = `<span class="points-display">${pts}/${maxPts} pt${maxPts > 1 ? 's' : ''}</span>`;
                }

                // Row class
                const isValidated = r.is_validated === true || r.is_validated === 'true';
                const rowClass = isValidated ? 'success-row' : (demandeStatut === 'refuse' ? 'nr-row' : '');

                return `
                    <tr data-eleve-id="${eleve.id}" class="${rowClass}">
                        <td class="col-bonus-eleve"><span class="eleve-name">${escapeHtml(eleve.prenom || '')} ${escapeHtml((eleve.nom || '').charAt(0) + '.')}</span></td>
                        <td class="col-bonus-demande">${demandeHtml}</td>
                        <td class="col-bonus-date">${dateHtml}</td>
                        <td class="col-bonus-correction">${correctionHtml}</td>
                        <td class="col-bonus-statut">${statutCorrHtml}</td>
                        <td class="col-bonus-points">${pointsHtml}</td>
                    </tr>
                `;
            }).join('');
        }

        // Hide loader, show table
        document.getElementById('saisieLoader').style.display = 'none';
        document.getElementById('saisieTableContainer').style.display = '';

        // Barre "Tout publier" si des brouillons existent
        const publishBar = document.getElementById('saisiePublishBar');
        if (publishBar) {
            const hasBrouillons = evalResults.some(r => r.correction_prof && String(r.statut_correction).trim() === 'brouillon');
            publishBar.style.display = hasBrouillons ? 'flex' : 'none';
        }
    },

    /**
     * Toggle le statut de correction (brouillon ↔ publié) directement depuis le tableau.
     */
    async _toggleStatutCorrection(evaluationId, eleveId, newStatut, btnEl) {
        // Mise à jour optimiste du bouton
        const prevHtml = btnEl.outerHTML;
        if (newStatut === 'publie') {
            btnEl.className = 'saisie-badge-btn badge-publie';
            btnEl.textContent = '🟢 Publié';
            btnEl.setAttribute('onclick', `event.stopPropagation(); AdminEvaluations._toggleStatutCorrection('${evaluationId}', '${eleveId}', 'brouillon', this)`);
        } else {
            btnEl.className = 'saisie-badge-btn badge-brouillon';
            btnEl.textContent = '🟠 Brouillon';
            btnEl.setAttribute('onclick', `event.stopPropagation(); AdminEvaluations._toggleStatutCorrection('${evaluationId}', '${eleveId}', 'publie', this)`);
        }

        try {
            const result = await this.callAPI('saveEvaluationCorrection', {
                evaluation_id: evaluationId,
                eleve_id: eleveId,
                statut_correction: newStatut
            });
            if (!result || !result.success) throw new Error('Échec');
            // Mettre à jour le cache local
            const r = (this.resultats || []).find(res =>
                String(res.evaluation_id).trim() === String(evaluationId).trim() &&
                String(res.eleve_id).trim() === String(eleveId).trim()
            );
            if (r) r.statut_correction = newStatut;
        } catch (_e) {
            // Rollback
            btnEl.outerHTML = prevHtml;
            this.showNotification('Erreur lors du changement de statut', 'error');
        }
    },

    // ========== DEMANDES D'ÉVALUATION ==========

    /**
     * Retourne les demandes en attente (demande_statut === 'demande')
     */
    _getDemandesEnAttente() {
        return (this.resultats || []).filter(r =>
            String(r.demande_statut || '').trim() === 'demande'
        );
    },

    _getDemandesTraitees() {
        return (this.resultats || []).filter(r => {
            const ds = String(r.demande_statut || '').trim();
            return ds === 'accepte' || ds === 'refuse';
        });
    },

    /**
     * Met à jour le bandeau des demandes en attente
     * (Le bandeau est désactivé — remplacé par le toggle dans l'onglet Bonus)
     */
    updateDemandesBanner() {
        const banner = document.getElementById('demandesBanner');
        if (banner) banner.style.display = 'none';
        // Re-render l'onglet bonus si actif pour mettre à jour le compteur du toggle
        if (this.currentType === 'bonus') {
            this.renderEvaluations();
        }
    },

    /**
     * Ouvre la modal avec la liste des demandes en attente
     */
    openDemandesList() {
        const modal = document.getElementById('demandesModal');
        modal.classList.remove('hidden');

        const demandes = this._getDemandesEnAttente();
        const loading = document.getElementById('demandesLoading');
        const container = document.getElementById('demandesListContainer');
        const empty = document.getElementById('demandesEmpty');
        const content = document.getElementById('demandesListContent');

        loading.style.display = 'none';
        container.style.display = '';

        if (demandes.length === 0) {
            empty.style.display = '';
            content.innerHTML = '';
            return;
        }
        empty.style.display = 'none';

        content.innerHTML = demandes.map(d => {
            const eleve = (this.eleves || []).find(e => String(e.id).trim() === String(d.eleve_id).trim());
            const evaluation = (this.evaluations || []).find(e => String(e.id).trim() === String(d.evaluation_id).trim());
            const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() : d.eleve_id;
            const evalTitle = evaluation ? (evaluation.titre || 'Sans titre') : d.evaluation_id;
            const evalType = evaluation ? (evaluation.type || '') : '';
            const sousType = evaluation ? (evaluation.sous_type_bonus || evaluation.sous_type_comp || '') : '';
            const dateStr = d.date_demande ? new Date(d.date_demande).toLocaleDateString('fr-FR') : '';

            // Badge type
            let typeBadge = '';
            if (evalType === 'bonus' && sousType === 'competence') {
                typeBadge = '<span class="demande-badge purple">Bonus compétence</span>';
            } else if (evalType === 'bonus' && sousType === 'ponctuel') {
                typeBadge = '<span class="demande-badge teal">Bonus ponctuel</span>';
            } else if (evalType === 'competences') {
                typeBadge = '<span class="demande-badge red">Tâche complexe</span>';
            } else {
                typeBadge = `<span class="demande-badge gray">${escapeHtml(evalType)}</span>`;
            }

            return `
                <div class="demande-card">
                    <div class="demande-card-left">
                        <div class="demande-eleve">${escapeHtml(eleveName)}</div>
                        <div class="demande-eval">
                            ${typeBadge}
                            <span class="demande-eval-title">${escapeHtml(evalTitle)}</span>
                        </div>
                        <div class="demande-date">Demandé le ${escapeHtml(dateStr)}</div>
                    </div>
                    <div class="demande-card-actions">
                        <button class="btn btn-sm btn-primary" onclick="AdminEvaluations.openReponseModal('${d.evaluation_id}', '${d.eleve_id}')">Répondre</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    closeDemandesModal() {
        document.getElementById('demandesModal').classList.add('hidden');
    },

    /**
     * Ouvre la modal de réponse pour une demande
     */
    openReponseModal(evaluationId, eleveId) {
        // Si la demande est déjà traitée (acceptée/refusée), déléguer vers le détail
        const existingResult = (this.resultats || []).find(r =>
            String(r.evaluation_id).trim() === String(evaluationId).trim() &&
            String(r.eleve_id).trim() === String(eleveId).trim()
        );
        const ds = String(existingResult?.demande_statut || '').trim();
        if (ds === 'accepte' || ds === 'refuse' || ds === 'corrige') {
            return this.openDemandeDetailModal(evaluationId, eleveId);
        }

        const modal = document.getElementById('reponseDemandeModal');
        document.getElementById('reponseEvaluationId').value = evaluationId;
        document.getElementById('reponseEleveId').value = eleveId;

        // Reset state
        this._editingDemande = null;
        document.getElementById('reponseDemandeTitle').textContent = 'Répondre à la demande';
        document.getElementById('acceptFields').style.display = 'none';
        const btnAccepter = document.getElementById('btnAccepter');
        const btnRefuser = document.getElementById('btnRefuser');
        btnAccepter.classList.remove('selected');
        btnRefuser.classList.remove('selected');
        btnAccepter.disabled = false;
        btnRefuser.disabled = false;
        const saveBtn = document.getElementById('saveReponseBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Confirmer';
        document.getElementById('reponseRemarque').value = '';
        document.getElementById('reponseDate').value = '';
        const timeInput = document.getElementById('reponseTime');
        if (timeInput) timeInput.value = '';
        this._reponseDecision = null;

        // Info about the demande
        const eleve = (this.eleves || []).find(e => String(e.id).trim() === String(eleveId).trim());
        const evaluation = (this.evaluations || []).find(e => String(e.id).trim() === String(evaluationId).trim());
        const demande = (this.resultats || []).find(r =>
            String(r.evaluation_id).trim() === String(evaluationId).trim() &&
            String(r.eleve_id).trim() === String(eleveId).trim() &&
            String(r.demande_statut || '').trim() === 'demande'
        );
        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() : eleveId;
        const evalTitle = evaluation ? (evaluation.titre || 'Sans titre') : evaluationId;

        // Formater la date/heure de la demande
        let dateDemandeHtml = '';
        if (demande && demande.date_demande) {
            try {
                const d = new Date(demande.date_demande);
                const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                dateDemandeHtml = `<p><strong>Demandé le :</strong> ${escapeHtml(dateStr)} à ${escapeHtml(timeStr)}</p>`;
            } catch (_e) { /* ignore */ }
        }

        document.getElementById('reponseDemandeInfo').innerHTML = `
            <p><strong>Élève :</strong> ${escapeHtml(eleveName)}</p>
            <p><strong>Évaluation :</strong> ${escapeHtml(evalTitle)}</p>
            ${dateDemandeHtml}
        `;

        modal.classList.remove('hidden');
    },

    closeReponseModal() {
        document.getElementById('reponseDemandeModal').classList.add('hidden');
        this._reponseDecision = null;
        this._editingDemande = null;
    },

    /**
     * Ouvre le modal de détail pour une demande déjà traitée (consultation + édition dates)
     */
    openDemandeDetailModal(evaluationId, eleveId) {
        const modal = document.getElementById('reponseDemandeModal');
        document.getElementById('reponseEvaluationId').value = evaluationId;
        document.getElementById('reponseEleveId').value = eleveId;

        const eleve = (this.eleves || []).find(e => String(e.id).trim() === String(eleveId).trim());
        const evaluation = (this.evaluations || []).find(e => String(e.id).trim() === String(evaluationId).trim());
        const demande = (this.resultats || []).find(r =>
            String(r.evaluation_id).trim() === String(evaluationId).trim() &&
            String(r.eleve_id).trim() === String(eleveId).trim() &&
            ['accepte', 'refuse', 'corrige'].includes(String(r.demande_statut || '').trim())
        );

        if (!demande) return;

        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() : eleveId;
        const evalTitle = evaluation ? (evaluation.titre || 'Sans titre') : evaluationId;
        const ds = String(demande.demande_statut || '').trim();
        const dsNormalized = ds === 'corrige' ? 'accepte' : ds;
        this._editingDemande = demande;
        this._reponseDecision = dsNormalized;

        // Titre du modal
        document.getElementById('reponseDemandeTitle').textContent = 'Détail de la demande';

        // Infos
        let dateDemandeHtml = '';
        if (demande.date_demande) {
            try {
                const d = new Date(demande.date_demande);
                const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                dateDemandeHtml = `<p><strong>Demandé le :</strong> ${escapeHtml(dateStr)} à ${escapeHtml(timeStr)}</p>`;
            } catch (_e) { /* ignore */ }
        }

        let dateAcceptHtml = '';
        if (demande.date_acceptation) {
            try {
                const d = new Date(demande.date_acceptation);
                const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
                dateAcceptHtml = `<p><strong>${dsNormalized === 'accepte' ? 'Acceptée' : 'Refusée'} le :</strong> ${escapeHtml(dateStr)}</p>`;
            } catch (_e) { /* ignore */ }
        }

        document.getElementById('reponseDemandeInfo').innerHTML = `
            <p><strong>Élève :</strong> ${escapeHtml(eleveName)}</p>
            <p><strong>Évaluation :</strong> ${escapeHtml(evalTitle)}</p>
            ${dateDemandeHtml}
            ${dateAcceptHtml}
        `;

        // Décision : boutons figés (non modifiables)
        const btnAccepter = document.getElementById('btnAccepter');
        const btnRefuser = document.getElementById('btnRefuser');
        btnAccepter.classList.toggle('selected', dsNormalized === 'accepte');
        btnRefuser.classList.toggle('selected', dsNormalized === 'refuse');
        btnAccepter.disabled = true;
        btnRefuser.disabled = true;

        // Champs d'acceptation : visibles et pré-remplis si acceptée
        const acceptFields = document.getElementById('acceptFields');
        if (dsNormalized === 'accepte') {
            acceptFields.style.display = '';

            // Type de date
            const typeDateSel = document.getElementById('reponseTypeDate');
            typeDateSel.value = demande.type_date || 'passage_classe';

            // Date et heure
            const rawDate = String(demande.date_rendu || '');
            let dateOnly = '';
            let timeValue = '';
            if (rawDate.includes('T')) {
                const parts = rawDate.split('T');
                dateOnly = parts[0];
                timeValue = parts[1] || '';
            } else if (rawDate.includes(' ') && rawDate.length > 10) {
                dateOnly = rawDate.substring(0, 10);
                timeValue = rawDate.substring(11).trim();
            } else if (rawDate.length >= 10) {
                dateOnly = rawDate.substring(0, 10);
            }
            document.getElementById('reponseDate').value = dateOnly;
            const timeInput = document.getElementById('reponseTime');
            if (timeInput) timeInput.value = timeValue;

            // Sujet visible
            const sujetCb = document.getElementById('reponseSujetVisible');
            if (sujetCb) sujetCb.checked = demande.sujet_visible === true || demande.sujet_visible === 'true' || demande.sujet_visible === 'TRUE';
        } else {
            acceptFields.style.display = 'none';
        }

        // Remarque
        document.getElementById('reponseRemarque').value = demande.remarque_prof || '';

        // Bouton : "Enregistrer" au lieu de "Confirmer"
        const saveBtn = document.getElementById('saveReponseBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer';

        modal.classList.remove('hidden');
    },

    setDecision(decision) {
        this._reponseDecision = decision;
        document.getElementById('btnAccepter').classList.toggle('selected', decision === 'accepte');
        document.getElementById('btnRefuser').classList.toggle('selected', decision === 'refuse');
        document.getElementById('acceptFields').style.display = decision === 'accepte' ? '' : 'none';
        document.getElementById('saveReponseBtn').disabled = false;
    },

    async saveReponse() {
        if (!this._reponseDecision) return;

        const evaluationId = document.getElementById('reponseEvaluationId').value;
        const eleveId = document.getElementById('reponseEleveId').value;
        const typeDate = document.getElementById('reponseTypeDate').value;
        const dateOnly = document.getElementById('reponseDate').value;
        const timeValue = (document.getElementById('reponseTime') || {}).value || '';
        // Combiner date + heure : "2026-03-10" ou "2026-03-10T14:30" si heure précisée
        const dateRendu = dateOnly && timeValue ? `${dateOnly}T${timeValue}` : dateOnly;
        const remarque = document.getElementById('reponseRemarque').value;
        const sujetVisible = document.getElementById('reponseSujetVisible')?.checked || false;

        const saveBtn = document.getElementById('saveReponseBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Envoi...';

        try {
            // Mode édition : mise à jour d'une demande déjà traitée
            const isEditing = !!this._editingDemande;
            const apiAction = isEditing ? 'updateDemandeAcceptee' : 'repondreDemandeEvaluation';

            const params = isEditing ? {
                evaluation_id: evaluationId,
                eleve_id: eleveId,
                date_rendu: dateRendu,
                type_date: typeDate,
                remarque_prof: remarque,
                sujet_visible: sujetVisible
            } : {
                evaluation_id: evaluationId,
                eleve_id: eleveId,
                decision: this._reponseDecision,
                date_rendu: this._reponseDecision === 'accepte' ? dateRendu : '',
                type_date: this._reponseDecision === 'accepte' ? typeDate : '',
                remarque_prof: remarque,
                sujet_visible: this._reponseDecision === 'accepte' ? sujetVisible : false
            };

            const result = await this.callAPI(apiAction, params);

            if (result.success) {
                this.showNotification(
                    isEditing ? 'Demande mise à jour' :
                    this._reponseDecision === 'accepte' ? 'Demande acceptée' : 'Demande refusée'
                );
                this.closeReponseModal();

                // Refresh data
                SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
                const freshResultats = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
                this.resultats = SheetsAPI.parseSheetData(freshResultats);
                this.updateDemandesBanner();

                // Refresh demandes list if modal is still open
                if (!document.getElementById('demandesModal').classList.contains('hidden')) {
                    this.openDemandesList();
                }

                // Si la vue saisie est ouverte, la rafraîchir
                if (this.saisieEvaluation && String(this.saisieEvaluation.id) === String(evaluationId)) {
                    this.openSaisie(evaluationId);
                }
            } else {
                this.showNotification(result.error || 'Erreur lors de la réponse', 'error');
            }
        } catch (error) {
            console.error('Erreur réponse demande:', error);
            this.showNotification('Erreur réseau', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Confirmer';
        }
    },

    // ========== API ==========
    async callAPI(action, data = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        return new Promise((resolve, reject) => {
            const callbackName = 'adminEvaluationsCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = (response) => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(response);
            };

            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur reseau'));
            };

            Object.keys(data).forEach(key => {
                url.searchParams.set(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
            });

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    },

    // ========== CORRECTION (wizard intégré à la saisie — TC, bonus comp, bonus ponctuel) ==========

    /**
     * Parse les critères libres d'une évaluation bonus ponctuel (JSON array de strings).
     */
    _getCriteresLibresForEval(evaluation) {
        const raw = evaluation ? evaluation.criteres_libres : '';
        if (!raw) return [];
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) { return []; }
    },

    /**
     * Parse les competence_ids d'une évaluation (JSON array de strings).
     */
    _getCompetenceIdsForEval(evaluation) {
        if (!evaluation.competence_ids) return [];
        try {
            const parsed = typeof evaluation.competence_ids === 'string' ? JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch (_e) { return []; }
    },

    /**
     * Retourne les critères de réussite pour une compétence donnée.
     */
    _getCriteresByCompetence(competenceId) {
        return (this.criteresReussite || [])
            .filter(c => String(c.competence_id) === String(competenceId))
            .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
    },

    /**
     * Retourne un map { compId: { pts, matiere, color, label } } pour une évaluation.
     */
    _getCompPointsMapForEval(evaluation) {
        const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
        const matiereLabels = { 'FR': 'FR', 'HG-EMC': 'HG-EMC', 'Transversal': 'Trans.' };

        let evalPpc = {};
        if (evaluation && evaluation.points_par_competence) {
            try {
                evalPpc = typeof evaluation.points_par_competence === 'string' ? JSON.parse(evaluation.points_par_competence) : evaluation.points_par_competence;
            } catch (_e) { /* ignore */ }
        }
        const hasEvalPpc = Object.keys(evalPpc).length > 0;

        const compIds = this._getCompetenceIdsForEval(evaluation);
        const totalBriques = parseFloat(evaluation ? evaluation.briques : 0) || 0;
        const fallbackPerComp = compIds.length > 0 ? totalBriques / compIds.length : 1;
        const map = {};

        compIds.forEach(compId => {
            const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
            const compMat = comp ? (comp.matiere || 'Transversal') : 'Transversal';
            const pts = hasEvalPpc ? (parseFloat(evalPpc[String(compId)]) || 1) : (fallbackPerComp || 1);
            map[String(compId)] = {
                pts: pts,
                matiere: compMat,
                color: matiereColors[compMat] || '#6b7280',
                label: matiereLabels[compMat] || compMat
            };
        });
        return map;
    },

    /**
     * Calcule automatiquement les points par compétence depuis les critères validés.
     * Tous critères cochés = points gagnés, sinon 0.
     */
    _computePointsParCompetence(evaluation, wd) {
        const ptsMap = this._getCompPointsMapForEval(evaluation);
        const ppc = {};
        let total = 0;

        for (const compId in ptsMap) {
            const info = ptsMap[compId];
            const criteres = this._getCriteresByCompetence(compId);
            const valides = (wd.competenceValidees && wd.competenceValidees[compId]) ? wd.competenceValidees[compId] : [];
            const allValid = criteres.length > 0 && criteres.every(c => valides.indexOf(String(c.id)) !== -1);
            const pts = allValid ? info.pts : 0;
            ppc[compId] = pts;
            total += pts;
        }

        return { ppc, total };
    },

    /**
     * Ouvre le wizard de correction pour un élève (TC, bonus comp, bonus ponctuel).
     */
    openCorrectionWizard(eleveId) {
        const evaluation = this.saisieEvaluation;
        if (!evaluation) return;

        const eleve = this.eleves.find(e => String(e.id) === String(eleveId));
        if (!eleve) return;

        // Charger le résultat existant
        const resultat = this.resultats.find(r =>
            String(r.evaluation_id).trim() === String(evaluation.id).trim() &&
            String(r.eleve_id).trim() === String(eleveId).trim()
        ) || {};

        // Initialiser wizardData de correction
        this._corrWizardData = {
            eleveId: eleveId,
            eleveName: `${eleve.prenom || ''} ${eleve.nom || ''}`.trim(),
            evaluationId: evaluation.id,
            step: 1,
            // Remarque (block editor)
            correctionType: null,
            correctionValue: '',
            // Critères
            criteresValides: [],
            competenceValidees: {},
            // Statut publication
            statutCorrection: resultat.statut_correction || 'brouillon'
        };

        // Parser correction existante
        if (resultat.correction_prof) {
            try {
                const blocks = JSON.parse(resultat.correction_prof);
                if (Array.isArray(blocks)) {
                    this._corrWizardData.correctionType = 'blocks';
                    this._corrWizardData.correctionValue = resultat.correction_prof;
                }
            } catch (_e) {
                if (resultat.correction_prof.indexOf('http') === 0) {
                    this._corrWizardData.correctionType = 'url';
                    this._corrWizardData.correctionValue = resultat.correction_prof;
                } else {
                    this._corrWizardData.correctionType = 'blocks';
                    this._corrWizardData.correctionValue = JSON.stringify([{ type: 'text', content: resultat.correction_prof }]);
                }
            }
        }

        // Parser critères validés existants
        if (resultat.criteres_valides) {
            try {
                this._corrWizardData.criteresValides = JSON.parse(resultat.criteres_valides);
            } catch (_e) { /* ignore */ }
        }

        // Parser competenceValidees (TC multi-compétences)
        const compIds = this._getCompetenceIdsForEval(evaluation);
        compIds.forEach(compId => {
            const criteres = this._getCriteresByCompetence(compId);
            this._corrWizardData.competenceValidees[compId] = criteres
                .filter(c => this._corrWizardData.criteresValides.indexOf(String(c.id)) !== -1)
                .map(c => String(c.id));
        });

        // Afficher le modal
        this._renderCorrectionWizard();
        document.getElementById('correctionTCModal').classList.remove('hidden');
        window.addEventListener('beforeunload', this._corrBeforeUnload);
    },

    _corrBeforeUnload(e) {
        e.preventDefault();
        e.returnValue = '';
    },

    /**
     * Ferme le wizard de correction.
     */
    closeCorrectionWizard() {
        document.getElementById('correctionTCModal').classList.add('hidden');
        window.removeEventListener('beforeunload', this._corrBeforeUnload);
        this._corrWizardData = null;
    },

    /**
     * Navigue entre les étapes du wizard.
     */
    corrWizardNav(direction) {
        const wd = this._corrWizardData;
        if (!wd) return;

        // Sauvegarder l'état de l'étape courante avant de naviguer
        this._saveCorrStepState();

        if (direction === 'next' && wd.step < 3) wd.step++;
        else if (direction === 'prev' && wd.step > 1) wd.step--;

        this._renderCorrectionWizard();
    },

    /**
     * Sauvegarde l'état de l'étape courante du wizard.
     */
    _saveCorrStepState() {
        const wd = this._corrWizardData;
        if (!wd) return;

        if (wd.step === 1) {
            // Sauver le block editor
            const urlInput = document.getElementById('corrTCUrlInput');
            const modeUrl = document.getElementById('corrTCUrlPanel')?.style.display !== 'none';
            if (modeUrl && urlInput) {
                wd.correctionType = urlInput.value.trim() ? 'url' : null;
                wd.correctionValue = urlInput.value.trim();
            } else {
                const blocksJson = this.getBlocksJSON();
                wd.correctionType = blocksJson ? 'blocks' : null;
                wd.correctionValue = blocksJson || '';
            }
        }
    },

    /**
     * Rendu du wizard de correction TC.
     */
    _renderCorrectionWizard() {
        const wd = this._corrWizardData;
        if (!wd) return;

        const modal = document.getElementById('correctionTCModal');
        if (!modal) return;

        // Stepper
        const steps = modal.querySelectorAll('.wizard-step');
        steps.forEach((s, i) => {
            s.classList.toggle('active', i + 1 === wd.step);
            s.classList.toggle('completed', i + 1 < wd.step);
        });

        const body = document.getElementById('corrTCWizardBody');
        const footer = document.getElementById('corrTCWizardFooter');

        if (wd.step === 1) {
            body.innerHTML = this._renderCorrStep1();
            footer.innerHTML = `<div></div><button class="btn btn-primary" onclick="AdminEvaluations.corrWizardNav('next')">Suivant →</button>`;
            this._initCorrStep1();
        } else if (wd.step === 2) {
            body.innerHTML = this._renderCorrStep2();
            footer.innerHTML = `<button class="btn btn-secondary" onclick="AdminEvaluations.corrWizardNav('prev')">← Précédent</button><button class="btn btn-primary" onclick="AdminEvaluations.corrWizardNav('next')">Suivant →</button>`;
        } else if (wd.step === 3) {
            body.innerHTML = this._renderCorrStep3();
            footer.innerHTML = `<button class="btn btn-secondary" onclick="AdminEvaluations.corrWizardNav('prev')">← Précédent</button><button class="btn btn-primary btn-confirm" id="corrTCSaveBtn" onclick="AdminEvaluations.saveCorrectionTC()">Enregistrer</button>`;
        }
    },

    // ----- Étape 1 : Remarque individuelle (block editor) -----

    _renderCorrStep1() {
        const wd = this._corrWizardData;
        const corrMode = wd.correctionType === 'url' ? 'url' : 'editor';

        return `
            <div class="step-header">
                <span class="step-icon">📝</span>
                <div><h3>Remarque individuelle</h3>
                <p>Construisez la remarque que ${escapeHtml(wd.eleveName)} verra (optionnel)</p></div>
            </div>

            <div class="source-toggle" id="corrTCToggle">
                <button type="button" class="source-toggle-btn${corrMode === 'url' ? ' active' : ''}" data-mode="url" onclick="AdminEvaluations._switchCorrTCMode('url')">Lien externe</button>
                <button type="button" class="source-toggle-btn${corrMode === 'editor' ? ' active' : ''}" data-mode="editor" onclick="AdminEvaluations._switchCorrTCMode('editor')">Éditeur</button>
            </div>

            <div class="source-panel" id="corrTCUrlPanel"${corrMode !== 'url' ? ' style="display:none"' : ''}>
                <div class="form-group">
                    <label>Lien (Google Doc, vidéo Loom, etc.)</label>
                    <input type="text" class="form-input" id="corrTCUrlInput" placeholder="https://..." value="${escapeHtml(wd.correctionType === 'url' ? wd.correctionValue : '')}">
                </div>
            </div>

            <div class="source-panel" id="corrTCEditorPanel"${corrMode !== 'editor' ? ' style="display:none"' : ''}>
                <div id="corrTCBlockEditorContainer" class="block-editor"></div>
                ${this.renderBlockAddBar()}
            </div>
        `;
    },

    _initCorrStep1() {
        const wd = this._corrWizardData;
        if (!wd || wd.correctionType === 'url') return;

        // Initialiser le block editor
        let blocks = [];
        if (wd.correctionValue) {
            try {
                blocks = JSON.parse(wd.correctionValue);
                if (!Array.isArray(blocks)) blocks = [];
            } catch (_e) { blocks = []; }
        }

        this._blockEditorContainerId = 'corrTCBlockEditorContainer';
        this.initBlockEditor(blocks);
    },

    _switchCorrTCMode(mode) {
        document.getElementById('corrTCUrlPanel').style.display = mode === 'url' ? '' : 'none';
        document.getElementById('corrTCEditorPanel').style.display = mode === 'editor' ? '' : 'none';
        document.querySelectorAll('#corrTCToggle .source-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        if (mode === 'editor') {
            this._blockEditorContainerId = 'corrTCBlockEditorContainer';
            if (!document.querySelector('#corrTCBlockEditorContainer .block-item')) {
                this._initCorrStep1();
            }
        }
    },

    // ----- Étape 2 : Critères + Points -----

    _renderCorrStep2() {
        const wd = this._corrWizardData;
        const evaluation = this.saisieEvaluation;
        const sousType = String(evaluation.sous_type_bonus || '').trim();
        const isBonusPonctuel = evaluation.type === 'bonus' && sousType === 'ponctuel';

        let criteresHtml = '';

        if (isBonusPonctuel) {
            // Bonus ponctuel : critères libres
            const criteresLibres = this._getCriteresLibresForEval(evaluation);
            if (criteresLibres.length === 0) {
                criteresHtml = '<div class="empty-criteres">Aucun critère libre défini pour cette évaluation.</div>';
            } else {
                const maxPts = evaluation.briques || 10;
                const nbValides = criteresLibres.filter((_l, idx) => wd.criteresValides.indexOf('libre_' + idx) !== -1).length;
                const allChecked = nbValides === criteresLibres.length;
                criteresHtml += `<div class="tc-competence-section${allChecked ? ' comp-validated' : ''}">
                    <div class="tc-comp-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="tc-comp-icon">📋</span>
                        <h4 style="flex:1;margin:0;">Critères libres</h4>
                        <span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:#0d9488;color:white;font-weight:600;white-space:nowrap;">${maxPts} pt${maxPts > 1 ? 's' : ''}</span>
                        <span class="comp-valid-badge" id="compBadge_ponctuel" style="font-size:0.75rem;padding:2px 8px;border-radius:4px;font-weight:600;white-space:nowrap;${allChecked ? 'background:#dcfce7;color:#16a34a;">✅ Validé' : 'background:#fee2e2;color:#dc2626;">❌ Non validé'}</span>
                    </div>
                    <div class="criteres-correction-list">`;
                criteresLibres.forEach((label, idx) => {
                    const critId = 'libre_' + idx;
                    const checked = wd.criteresValides.indexOf(critId) !== -1;
                    criteresHtml += `<div class="critere-check${checked ? ' checked' : ''}" onclick="AdminEvaluations._toggleCritereLibre('${critId}', this)">
                        <input type="checkbox"${checked ? ' checked' : ''}>
                        <label>${escapeHtml(label)}</label>
                    </div>`;
                });
                criteresHtml += '</div></div>';
            }

            return `
                <div class="step-header">
                    <span class="step-icon">✅</span>
                    <div><h3>Critères</h3>
                    <p>Cochez les critères validés — tous cochés = points gagnés</p></div>
                </div>
                ${criteresHtml}
            `;
        }

        // TC ou bonus compétence : critères par compétence
        const compIds = this._getCompetenceIdsForEval(evaluation);
        const ptsMap = this._getCompPointsMapForEval(evaluation);

        if (compIds.length === 0) {
            criteresHtml = '<div class="empty-criteres">Aucune compétence associée à cette évaluation.</div>';
        } else {
            compIds.forEach(compId => {
                const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
                const criteres = this._getCriteresByCompetence(compId);
                const compValides = wd.competenceValidees[compId] || [];
                const allChecked = criteres.length > 0 && criteres.every(c => compValides.indexOf(String(c.id)) !== -1);
                const info = ptsMap[String(compId)] || { pts: 1, matiere: 'Transversal', color: '#6b7280', label: 'Trans.' };

                criteresHtml += `<div class="tc-competence-section${allChecked ? ' comp-validated' : ''}" data-comp-id="${compId}">
                    <div class="tc-comp-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="tc-comp-icon">🎯</span>
                        <h4 style="flex:1;margin:0;">${escapeHtml(comp ? comp.nom : 'Compétence inconnue')}</h4>
                        <span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:${info.color}20;color:${info.color};font-weight:600;white-space:nowrap;">${info.pts} pt${info.pts > 1 ? 's' : ''} · ${escapeHtml(info.label)}</span>
                        <span class="comp-valid-badge" id="compBadge_${compId}" style="font-size:0.75rem;padding:2px 8px;border-radius:4px;font-weight:600;white-space:nowrap;${allChecked ? 'background:#dcfce7;color:#16a34a;">✅ Validée' : 'background:#fee2e2;color:#dc2626;">❌ Non validée'}</span>
                    </div>`;

                if (criteres.length > 0) {
                    criteresHtml += '<div class="criteres-correction-list">';
                    criteres.forEach(c => {
                        const checked = compValides.indexOf(String(c.id)) !== -1;
                        criteresHtml += `<div class="critere-check${checked ? ' checked' : ''}" onclick="AdminEvaluations._toggleCritereTC('${compId}', '${c.id}', this)">
                            <input type="checkbox"${checked ? ' checked' : ''}>
                            <label>${escapeHtml(c.libelle)}</label>
                        </div>`;
                    });
                    criteresHtml += '</div>';
                } else {
                    criteresHtml += '<div class="empty-criteres">Aucun critère défini.</div>';
                }
                criteresHtml += '</div>';
            });
        }

        return `
            <div class="step-header">
                <span class="step-icon">✅</span>
                <div><h3>Compétences</h3>
                <p>Cochez les critères validés — tous les critères cochés = compétence validée = points gagnés</p></div>
            </div>
            ${criteresHtml}
        `;
    },

    _toggleCritereTC(compId, critereId, el) {
        const wd = this._corrWizardData;
        if (!wd) return;

        if (!wd.competenceValidees[compId]) wd.competenceValidees[compId] = [];
        const arr = wd.competenceValidees[compId];
        const idx = arr.indexOf(critereId);
        if (idx >= 0) {
            arr.splice(idx, 1);
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
        } else {
            arr.push(critereId);
            el.classList.add('checked');
            el.querySelector('input').checked = true;
        }

        // Mettre à jour criteresValides (flat list)
        wd.criteresValides = [];
        Object.values(wd.competenceValidees).forEach(ids => {
            ids.forEach(id => { if (wd.criteresValides.indexOf(id) === -1) wd.criteresValides.push(id); });
        });

        // Mettre à jour le badge de la compétence parente
        const section = el.closest('.tc-competence-section');
        if (section) {
            const criteres = this._getCriteresByCompetence(compId);
            const compValides = wd.competenceValidees[compId] || [];
            const allChecked = criteres.length > 0 && criteres.every(c => compValides.indexOf(String(c.id)) !== -1);
            const badgeEl = document.getElementById('compBadge_' + compId);
            if (badgeEl) {
                badgeEl.style.background = allChecked ? '#dcfce7' : '#fee2e2';
                badgeEl.style.color = allChecked ? '#16a34a' : '#dc2626';
                badgeEl.innerHTML = allChecked ? '✅ Validée' : '❌ Non validée';
            }
            section.classList.toggle('comp-validated', allChecked);
        }
    },

    /**
     * Toggle un critère libre (bonus ponctuel) dans le wizard de correction.
     */
    _toggleCritereLibre(critereId, el) {
        const wd = this._corrWizardData;
        if (!wd) return;

        const idx = wd.criteresValides.indexOf(critereId);
        if (idx >= 0) {
            wd.criteresValides.splice(idx, 1);
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
        } else {
            wd.criteresValides.push(critereId);
            el.classList.add('checked');
            el.querySelector('input').checked = true;
        }

        // Mettre à jour le badge
        const evaluation = this.saisieEvaluation;
        const criteresLibres = this._getCriteresLibresForEval(evaluation);
        const nbValides = criteresLibres.filter((_l, i) => wd.criteresValides.indexOf('libre_' + i) !== -1).length;
        const allChecked = nbValides === criteresLibres.length && criteresLibres.length > 0;
        const badgeEl = document.getElementById('compBadge_ponctuel');
        if (badgeEl) {
            badgeEl.style.background = allChecked ? '#dcfce7' : '#fee2e2';
            badgeEl.style.color = allChecked ? '#16a34a' : '#dc2626';
            badgeEl.innerHTML = allChecked ? '✅ Validé' : '❌ Non validé';
        }
        const section = el.closest('.tc-competence-section');
        if (section) section.classList.toggle('comp-validated', allChecked);
    },

    // ----- Étape 3 : Résumé -----

    _renderCorrStep3() {
        const wd = this._corrWizardData;
        const evaluation = this.saisieEvaluation;
        const sousType = String(evaluation.sous_type_bonus || '').trim();
        const isBonusPonctuel = evaluation.type === 'bonus' && sousType === 'ponctuel';
        const hasRemarque = wd.correctionType === 'blocks' ? !!wd.correctionValue : (wd.correctionType === 'url' ? !!wd.correctionValue : false);

        let pointsHtml = '';

        if (isBonusPonctuel) {
            // Bonus ponctuel : résumé simple (critères libres)
            const criteresLibres = this._getCriteresLibresForEval(evaluation);
            const maxPts = evaluation.briques || 10;
            const nbValides = criteresLibres.filter((_l, idx) => wd.criteresValides.indexOf('libre_' + idx) !== -1).length;
            const allValid = nbValides === criteresLibres.length && criteresLibres.length > 0;
            const earnedPts = allValid ? maxPts : 0;

            pointsHtml = `<div class="bilan-section">
                <h4>Points gagnés</h4>
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;">
                    <span style="font-size:1.1rem;font-weight:700;">${earnedPts} / ${maxPts} pt${maxPts > 1 ? 's' : ''}</span>
                    ${allValid ? '<span style="color:#16a34a;">✅</span>' : ''}
                </div>
                <div style="font-size:0.85rem;color:var(--gray-400);">Critères validés : ${nbValides}/${criteresLibres.length}</div>
            </div>`;
        } else {
            // TC ou bonus comp : résumé par matière
            const ptsMap = this._getCompPointsMapForEval(evaluation);
            const computed = this._computePointsParCompetence(evaluation, wd);
            const compIds = this._getCompetenceIdsForEval(evaluation);
            const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };

            const byMatiere = {};
            compIds.forEach(compId => {
                const info = ptsMap[String(compId)] || { pts: 1, matiere: 'Transversal', color: '#6b7280' };
                const mat = info.matiere;
                if (!byMatiere[mat]) byMatiere[mat] = { earned: 0, max: 0, color: info.color };
                byMatiere[mat].max += info.pts;
                byMatiere[mat].earned += computed.ppc[compId] || 0;
            });

            let matiereHtml = '';
            ['FR', 'HG-EMC', 'Transversal'].forEach(mat => {
                if (!byMatiere[mat]) return;
                const m = byMatiere[mat];
                const color = m.color || matiereColors[mat] || '#6b7280';
                const matLabel = mat === 'Transversal' ? 'Transversal (FR + HG-EMC)' : mat;
                matiereHtml += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-100, #f3f4f6);">
                    <span style="display:inline-block;font-size:0.8rem;padding:3px 10px;border-radius:4px;background:${color}20;color:${color};font-weight:600;min-width:60px;text-align:center;">${escapeHtml(matLabel)}</span>
                    <span style="font-size:0.95rem;font-weight:600;">${m.earned} / ${m.max} pt${m.max > 1 ? 's' : ''}</span>
                    ${m.earned >= m.max && m.max > 0 ? '<span style="color:#16a34a;">✅</span>' : m.earned > 0 ? '<span style="color:#f59e0b;">⚠️</span>' : ''}
                </div>`;
            });

            let compDetailHtml = '';
            compIds.forEach(compId => {
                const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
                const info = ptsMap[String(compId)] || { pts: 1 };
                const earned = computed.ppc[compId] || 0;
                compDetailHtml += `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.8rem;">
                    <span>${earned > 0 ? '✅' : '❌'}</span>
                    <span style="flex:1;">${escapeHtml(comp ? comp.nom : 'Compétence')}</span>
                    <span style="font-weight:600;">${earned} / ${info.pts}</span>
                </div>`;
            });

            pointsHtml = `<div class="bilan-section">
                <h4>Points gagnés par matière</h4>
                ${matiereHtml}
                <div style="margin-top:12px;">
                    <details><summary style="cursor:pointer;font-size:0.85rem;color:var(--gray-400);margin-bottom:6px;">Détail par compétence</summary>${compDetailHtml}</details>
                </div>
            </div>`;
        }

        return `
            <div class="step-header">
                <span class="step-icon">📋</span>
                <div><h3>Résumé</h3>
                <p>Vérifiez avant d'enregistrer la correction de ${escapeHtml(wd.eleveName)}</p></div>
            </div>

            ${pointsHtml}

            <div class="bilan-section">
                <div class="summary-row"><span class="label">Remarque</span><span class="value">${hasRemarque ? '✅ Rédigée' : '— Aucune'}</span></div>
            </div>

            <div class="statut-toggle-section">
                <h4>Visibilité pour l'élève</h4>
                <div class="statut-toggle">
                    <button type="button" class="statut-btn${wd.statutCorrection === 'brouillon' ? ' active' : ''}" onclick="AdminEvaluations._setCorrStatut('brouillon')">📝 Brouillon</button>
                    <button type="button" class="statut-btn${wd.statutCorrection === 'publie' ? ' active' : ''}" onclick="AdminEvaluations._setCorrStatut('publie')">✅ Publié</button>
                </div>
                <p class="form-help">${wd.statutCorrection === 'brouillon' ? 'L\'élève ne voit pas encore la correction.' : 'L\'élève peut voir sa correction.'}</p>
            </div>
        `;
    },

    _setCorrStatut(statut) {
        if (!this._corrWizardData) return;
        this._corrWizardData.statutCorrection = statut;
        // Re-render step 3
        document.getElementById('corrTCWizardBody').innerHTML = this._renderCorrStep3();
    },

    // ----- Sauvegarde -----

    async saveCorrectionTC() {
        const wd = this._corrWizardData;
        if (!wd) return;

        // Sauvegarder l'état de l'étape courante
        this._saveCorrStepState();

        const btn = document.getElementById('corrTCSaveBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        try {
            const evaluation = this.saisieEvaluation;
            const sousType = String(evaluation.sous_type_bonus || '').trim();
            const isBonusPonctuel = evaluation.type === 'bonus' && sousType === 'ponctuel';

            let validatedCompIds = [];
            let total = 0;
            let ppc = {};

            if (isBonusPonctuel) {
                // Bonus ponctuel : points = briques si tous critères validés, sinon 0
                const criteresLibres = this._getCriteresLibresForEval(evaluation);
                const maxPts = evaluation.briques || 10;
                const nbValides = criteresLibres.filter((_l, idx) => wd.criteresValides.indexOf('libre_' + idx) !== -1).length;
                const allValid = nbValides === criteresLibres.length && criteresLibres.length > 0;
                total = allValid ? maxPts : 0;
            } else {
                // TC ou bonus comp : points par compétence
                const compIds = this._getCompetenceIdsForEval(evaluation);
                validatedCompIds = compIds.filter(cid => {
                    const criteres = this._getCriteresByCompetence(cid);
                    const compValides = wd.competenceValidees[cid] || [];
                    return criteres.length > 0 && criteres.every(c => compValides.indexOf(String(c.id)) !== -1);
                });
                const computed = this._computePointsParCompetence(evaluation, wd);
                total = computed.total;
                ppc = computed.ppc;
            }

            const params = {
                evaluation_id: wd.evaluationId,
                eleve_id: wd.eleveId,
                correction_prof: wd.correctionValue || '',
                statut_correction: wd.statutCorrection || 'brouillon',
                criteres_valides: JSON.stringify(wd.criteresValides),
                competence_ids_validees: JSON.stringify(validatedCompIds),
                is_validated: isBonusPonctuel ? total > 0 : validatedCompIds.length > 0,
                validations: String(total),
                score: String(total),
                points_par_competence: JSON.stringify(ppc)
            };

            const result = await this.callAPI('saveEvaluationCorrection', params);

            if (result.success) {
                this.showNotification('Correction enregistrée !');
                this.closeCorrectionWizard();

                // Recharger les données et réafficher la saisie
                SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
                try {
                    const freshData = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
                    this.resultats = SheetsAPI.parseSheetData(freshData);
                } catch (_e) { /* ignore */ }
                this.openSaisie(wd.evaluationId);
            } else {
                this.showNotification(result.error || 'Erreur lors de la sauvegarde', 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde correction TC:', error);
            this.showNotification('Erreur réseau', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
        }
    },

    // ----- Tout publier -----

    async publishAllCorrections() {
        const evaluation = this.saisieEvaluation;
        if (!evaluation) return;

        const evalResults = this.resultats.filter(r =>
            String(r.evaluation_id).trim() === String(evaluation.id).trim() &&
            r.correction_prof &&
            String(r.statut_correction).trim() === 'brouillon'
        );

        if (evalResults.length === 0) {
            this.showNotification('Aucune correction en brouillon à publier');
            return;
        }

        const btn = document.getElementById('publishAllBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Publication...'; }

        let errors = 0;
        for (const r of evalResults) {
            try {
                const result = await this.callAPI('saveEvaluationCorrection', {
                    evaluation_id: evaluation.id,
                    eleve_id: r.eleve_id,
                    correction_prof: r.correction_prof,
                    statut_correction: 'publie',
                    criteres_valides: r.criteres_valides || '[]',
                    competence_ids_validees: r.competence_ids_validees || '[]',
                    is_validated: r.is_validated,
                    validations: r.validations
                });
                if (!result.success) errors++;
            } catch (_e) { errors++; }
        }

        if (errors === 0) {
            this.showNotification(`${evalResults.length} correction(s) publiée(s) !`);
        } else {
            this.showNotification(`${errors} erreur(s) sur ${evalResults.length}`, 'error');
        }

        // Recharger
        SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
        try {
            const freshData = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
            this.resultats = SheetsAPI.parseSheetData(freshData);
        } catch (_e) { /* ignore */ }
        this.openSaisie(evaluation.id);
        if (btn) { btn.disabled = false; btn.textContent = 'Tout publier'; }
    },
};

// Mount block editor mixin (Phase 9: TC/bonus wizards with block editor)
Object.assign(AdminEvaluations, createBlockEditorMixin('AdminEvaluations'));

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AdminEvaluations.init();
    }, 100);
});

window.AdminEvaluations = AdminEvaluations;
