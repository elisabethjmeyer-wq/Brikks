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
    correctionsCount: 0,

    // Connaissances data (for cascade dropdown)
    banquesExercicesConn: [],
    entrainementsConn: [],

    // Savoir-faire data (for cascade dropdown)
    banquesSF: [],
    exercicesSF: [],

    // Progression evaluation data
    progressionsEvaluation: [],

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
            this.updateCounts();
            this.renderEvaluations();
            this.updateCorrectionsBanner();
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
            eleveCompetencesData,
            banquesExercicesConnData,
            entrainementsConnData,
            banquesExercicesData,
            exercicesData
        ] = await Promise.all([
            safeGet('DISCIPLINES'),
            safeGet('THEMES'),
            safeGet('CHAPITRES'),
            safeGet('METHODOLOGIE'),
            safeGet('UTILISATEURS'),
            safeGet('NOTES_SOMMATIVES'),
            safeGet('RESULTATS_SOMMATIVES'),
            safeGet('EleveEntrainementsCompetences'),
            safeGet('BANQUES_EXERCICES_CONN'),
            safeGet('ENTRAINEMENTS_CONN'),
            safeGet('BANQUES_EXERCICES'),
            safeGet('EXERCICES')
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.methodologies = SheetsAPI.parseSheetData(methodologiesData);
        this.eleves = SheetsAPI.parseSheetData(elevesData).filter(u => u.role === 'eleve');
        this.sommatives = SheetsAPI.parseSheetData(sommativesData);
        this.resultatsSommatives = SheetsAPI.parseSheetData(resultatsSommativesData);

        // Count corrections needed (competences with statut 'soumis')
        const eleveCompetences = SheetsAPI.parseSheetData(eleveCompetencesData);
        this.correctionsCount = eleveCompetences.filter(ec => ec.statut === 'soumis').length;

        // Connaissances data (for cascade dropdown)
        this.banquesExercicesConn = SheetsAPI.parseSheetData(banquesExercicesConnData);
        this.entrainementsConn = SheetsAPI.parseSheetData(entrainementsConnData);

        // Savoir-faire data (for cascade dropdown)
        const allBanques = SheetsAPI.parseSheetData(banquesExercicesData);
        this.banquesSF = allBanques.filter(b => b.type === 'savoir-faire');
        this.exercicesSF = SheetsAPI.parseSheetData(exercicesData);

        // Load evaluations
        try {
            const evaluationsData = await SheetsAPI.getSheetData('EVALUATIONS');
            this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        } catch (_e) {
            this.evaluations = [];
        }

        // Load evaluation results
        try {
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

    // ========== CORRECTIONS BANNER ==========
    updateCorrectionsBanner() {
        const banner = document.getElementById('correctionsBanner');
        const countEl = document.getElementById('correctionsCount');
        if (this.correctionsCount > 0) {
            countEl.textContent = this.correctionsCount;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    },

    goToCorrections() {
        window.location.href = '/Brikks/admin/corrections.html';
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

        // Filter by current type, matière and statut
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
        const totalEleves = this.eleves.length || 25;
        const saisis = evalResults.length;
        const validated = evalResults.filter(r => r.is_validated === true || r.is_validated === 'true').length;

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

        const statsHtml = `
            <div class="eval-card-stats">
                <div class="eval-stat">
                    <div class="eval-stat-value">${saisis}/${totalEleves}</div>
                    <div class="eval-stat-label">Saisis</div>
                </div>
                ${validated > 0 ? `
                <div class="eval-stat">
                    <div class="eval-stat-value">${validated}</div>
                    <div class="eval-stat-label">Validés</div>
                </div>` : ''}
            </div>
        `;

        const canSaisir = statusClass === 'publiee' || statusClass === 'terminee';

        return `
            <div class="eval-card ${typeClass}" data-id="${evaluation.id}">
                <div class="eval-card-main">
                    <div class="eval-card-order ${typeClass}">${typeIcons[typeClass] || order}</div>
                    <div class="eval-card-content">
                        <div class="eval-card-title">
                            ${escapeHtml(evaluation.titre || 'Sans titre')}
                            ${matiereBadge}
                            <span class="status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                        </div>
                        <div class="eval-card-meta">
                            ${metaItems.map(item => `<span>${item}</span>`).join('')}
                        </div>
                    </div>
                    ${statsHtml}
                    <div class="eval-card-actions">
                        <button class="btn-icon" onclick="AdminEvaluations.editEvaluation('${evaluation.id}')" title="Modifier">✏️</button>
                        ${evaluation.type === 'connaissances' || evaluation.type === 'savoir-faire' ?
                            `<button class="btn-icon" onclick="AdminEvaluations.openAttributionModal('${evaluation.id}')" title="Attribuer sujets">👥</button>` : ''}
                        ${canSaisir ? `<button class="btn-icon" onclick="AdminEvaluations.openSaisie('${evaluation.id}')" title="Saisir résultats">📝</button>` : ''}
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
    openModal(evaluation = null) {
        const title = document.getElementById('evaluationModalTitle');
        const isEdit = !!evaluation;

        if (isEdit) {
            title.textContent = 'Modifier l\'évaluation';
            document.getElementById('editEvaluationId').value = evaluation.id;
            document.getElementById('evalEntrainementConnId').value = evaluation.entrainement_conn_id || '';
            this.wizardData = { ...evaluation };
            this._wizardSkipType = false;
            this.wizardStep = 1;
        } else {
            const defaultType = this.currentType !== 'sommatives' ? this.currentType : 'connaissances';
            const typeLabels = { 'connaissances': 'évaluation de connaissances', 'savoir-faire': 'évaluation de savoir-faire', 'competences': 'évaluation de compétences', 'bonus': 'évaluation bonus' };
            title.textContent = `Nouvelle ${typeLabels[defaultType] || 'évaluation'}`;
            document.getElementById('editEvaluationId').value = '';
            document.getElementById('evalEntrainementConnId').value = '';
            this.wizardData = {
                type: defaultType,
                matiere: this.currentMatiere,
                briques: 3,
                statut: 'brouillon',
                seuil: 80
            };
            // Skip step 1 in creation — type is implicit from active tab
            this._wizardSkipType = true;
            this.wizardStep = 2;
        }

        this._renderWizardStep();
        document.getElementById('evaluationModal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('evaluationModal').classList.add('hidden');
        this.wizardStep = 1;
        this.wizardData = {};
    },

    // ========== WIZARD NAVIGATION ==========

    _getMinStep() {
        return this._wizardSkipType ? 2 : 1;
    },

    _getMaxStep() {
        const type = this.wizardData.type;
        // Step 3 (Sujet) only for connaissances and savoir-faire
        return (type === 'connaissances' || type === 'savoir-faire') ? 3 : 2;
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
        const minStep = this._getMinStep();
        if (this.wizardStep <= minStep) return;
        this._collectWizardStepData();
        this.wizardStep--;
        this._renderWizardStep();
    },

    _updateWizardStepper() {
        const minStep = this._getMinStep();
        const maxStep = this._getMaxStep();

        document.querySelectorAll('.eval-wizard-step').forEach(el => {
            const step = parseInt(el.dataset.step);
            el.classList.toggle('active', step === this.wizardStep);
            el.classList.toggle('completed', step < this.wizardStep && step >= minStep);
            // Hide steps outside range
            el.style.display = (step >= minStep && step <= maxStep) ? '' : 'none';
        });
        // Hide connectors for hidden steps
        document.querySelectorAll('.eval-step-connector').forEach((el, i) => {
            const fromStep = i + 1;
            const toStep = i + 2;
            el.style.display = (fromStep >= minStep && toStep <= maxStep) ? '' : 'none';
        });

        // Navigation buttons
        const prevBtn = document.getElementById('evalWizardPrevBtn');
        const nextBtn = document.getElementById('evalWizardNextBtn');
        prevBtn.style.display = this.wizardStep > minStep ? '' : 'none';
        nextBtn.textContent = this.wizardStep >= maxStep ? 'Enregistrer' : 'Suivant →';
    },

    _renderWizardStep() {
        const content = document.getElementById('evalWizardContent');
        this._updateWizardStepper();

        switch (this.wizardStep) {
            case 1:
                content.innerHTML = this._renderStep1();
                this._initStep1();
                break;
            case 2:
                content.innerHTML = this._renderStep2();
                break;
            case 3:
                content.innerHTML = this._renderStep3();
                break;
        }
    },

    // ========== STEP 1: TYPE ==========

    _renderStep1() {
        const d = this.wizardData;
        const isEdit = !!d.id;
        const selectedType = d.type || this.currentType;

        return `
            <div class="eval-wizard-step-content">
                <div class="step-header">
                    <h3>Type d'évaluation</h3>
                    <p>Choisissez le type d'évaluation à créer</p>
                </div>
                <div class="type-cards ${isEdit ? 'disabled' : ''}">
                    ${this._renderTypeCard('connaissances', '🟢', 'Connaissances', 'QCM, quiz sur les leçons', selectedType)}
                    ${this._renderTypeCard('savoir-faire', '🟠', 'Savoir-faire', 'Exercices méthodologiques', selectedType)}
                    ${this._renderTypeCard('competences', '🟣', 'Compétences', 'Tâches complexes', selectedType)}
                    ${this._renderTypeCard('bonus', '⭐', 'Bonus', 'Évaluations spéciales', selectedType)}
                </div>
            </div>
        `;
    },

    _renderTypeCard(type, icon, name, desc, selectedType) {
        const colorClass = { 'connaissances': 'green', 'savoir-faire': 'orange', 'competences': 'purple', 'bonus': 'yellow' }[type] || '';
        const selected = type === selectedType ? 'selected' : '';
        return `
            <label class="type-card ${colorClass} ${selected}" data-type="${type}" onclick="AdminEvaluations._selectType('${type}')">
                <input type="radio" name="evalType" value="${type}" ${selected ? 'checked' : ''}>
                <span class="type-icon">${icon}</span>
                <span class="type-name">${name}</span>
                <span class="type-desc">${desc}</span>
            </label>
        `;
    },

    _selectType(type) {
        this.wizardData.type = type;
        document.querySelectorAll('.type-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.type === type);
            c.querySelector('input').checked = c.dataset.type === type;
        });
        // Show/hide categorie field (only for bonus)
        const catGroup = document.getElementById('evalCategorieGroup');
        if (catGroup) catGroup.style.display = type === 'bonus' ? '' : 'none';
        // Show/hide matiere field (bonus always, others only if toggle=all)
        const matGroup = document.getElementById('evalMatiereGroup');
        if (matGroup) {
            matGroup.style.display = type === 'bonus' ? '' : 'none';
            const lesDeux = matGroup.querySelector('option[value="Les deux"]');
            if (lesDeux) lesDeux.hidden = type !== 'bonus';
        }
        // Update stepper visibility (step 3 depends on type)
        this._updateWizardStepper();
    },

    _initStep1() {
        // If editing, disable type change
        if (this.wizardData.id) {
            document.querySelectorAll('.type-card').forEach(c => {
                c.style.pointerEvents = 'none';
                c.style.opacity = c.classList.contains('selected') ? '1' : '0.4';
            });
        }
    },

    // ========== STEP 2: PARAMÈTRES ==========

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
                    <div class="form-group">
                        <label>Titre <span class="req">*</span></label>
                        <input type="text" class="form-input" id="evalTitre" value="${escapeHtml(d.titre || '')}" placeholder="Ex: Evaluation chapitre 1">
                    </div>
                    ${typeSpecificHTML}
                    <div class="form-group" id="evalMatiereGroup" style="${d.type !== 'bonus' ? 'display:none' : ''}">
                        <label>Matière <span class="req">*</span></label>
                        <select class="form-select" id="evalMatiere">
                            <option value="FR" ${d.matiere === 'FR' || !d.matiere ? 'selected' : ''}>🇫🇷 Français</option>
                            <option value="HG-EMC" ${d.matiere === 'HG-EMC' ? 'selected' : ''}>🌍 HG-EMC</option>
                            <option value="Les deux" ${d.matiere === 'Les deux' ? 'selected' : ''} ${d.type !== 'bonus' ? 'hidden' : ''}>🔗 Les deux</option>
                        </select>
                    </div>
                    <div class="form-group" id="evalCategorieGroup" style="${d.type === 'bonus' ? '' : 'display:none'}">
                        <label>Catégorie de points</label>
                        <select class="form-select" id="evalCategorie">
                            <option value="connaissances" ${d.categorie === 'connaissances' || !d.categorie ? 'selected' : ''}>Connaissances</option>
                            <option value="savoir-faire" ${d.categorie === 'savoir-faire' ? 'selected' : ''}>Savoir-faire</option>
                            <option value="competences" ${d.categorie === 'competences' ? 'selected' : ''}>Compétences</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    _renderConnFields(d) {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Points mis en jeu <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalBriques" value="${d.briques || 3}" min="1" max="50">
                </div>
                <div class="form-group">
                    <label>Seuil de réussite (%) <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalSeuil" value="${d.seuil || 80}" min="0" max="100">
                    <div class="form-help">Score minimum pour valider</div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"></div>
                ${this._renderStatutSelect(d)}
            </div>
        `;
    },

    _renderStatutSelect(d) {
        return `
                <div class="form-group">
                    <label>Statut</label>
                    <select class="form-select" id="evalStatut">
                        <option value="brouillon" ${d.statut === 'brouillon' || !d.statut ? 'selected' : ''}>Brouillon</option>
                        <option value="planifiee" ${d.statut === 'planifiee' ? 'selected' : ''}>Planifiée</option>
                        <option value="publiee" ${d.statut === 'publiee' ? 'selected' : ''}>Publiée</option>
                        <option value="terminee" ${d.statut === 'terminee' ? 'selected' : ''}>Terminée</option>
                    </select>
                </div>`;
    },

    _renderDefaultFields(d) {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Points mis en jeu <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalBriques" value="${d.briques || 3}" min="1" max="50">
                </div>
                ${this._renderStatutSelect(d)}
            </div>
        `;
    },

    _renderCompFields(d) {
        const compOptions = (this.bexConfig || []).filter(b => b.type === 'competences').map(m =>
            `<option value="${m.id}" ${d.methodologie_id === m.id ? 'selected' : ''}>${escapeHtml(m.titre || m.id)}</option>`
        ).join('');

        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Points mis en jeu <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalBriques" value="${d.briques || 3}" min="1" max="50">
                </div>
                <div class="form-group">
                    <label>Méthodologie liée</label>
                    <select class="form-select" id="evalMethodologieTC">
                        <option value="">Sélectionner...</option>
                        ${compOptions}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"></div>
                ${this._renderStatutSelect(d)}
            </div>
        `;
    },

    _renderBonusFields(d) {
        return `
            <div class="form-row">
                <div class="form-group">
                    <label>Points mis en jeu <span class="req">*</span></label>
                    <input type="number" class="form-input" id="evalBriques" value="${d.briques || 3}" min="1" max="50">
                </div>
                ${this._renderStatutSelect(d)}
            </div>
            <div class="form-group">
                <label>Critères de validation</label>
                <textarea class="form-textarea" id="evalCriteres" rows="3" placeholder="Décrivez les critères...">${escapeHtml(d.criteres || '')}</textarea>
            </div>
        `;
    },

    // ========== STEP 3: SUJET (cascade dropdowns) ==========

    _renderStep3() {
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
            const linked = this.exercicesSF.find(e => e.id === d.exercice_sf_id);
            if (linked) selectedBanqueId = linked.banque_id;
        }

        const banqueOptions = banques.map(b =>
            `<option value="${b.id}" ${b.id === selectedBanqueId ? 'selected' : ''}>${escapeHtml(b.titre || 'Sans titre')}</option>`
        ).join('');

        let exerciceOptions = '<option value="">-- Sélectionnez d\'abord une banque --</option>';
        if (selectedBanqueId) {
            const banqueExos = this.exercicesSF
                .filter(e => e.banque_id === selectedBanqueId)
                .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));
            exerciceOptions = '<option value="">Sélectionner...</option>' +
                banqueExos.map(e =>
                    `<option value="${e.id}" ${e.id === d.exercice_sf_id ? 'selected' : ''}>${escapeHtml(e.titre || 'Sans titre')}</option>`
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
            .filter(e => e.banque_id === banqueId)
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
        switch (this.wizardStep) {
            case 1: {
                const type = document.querySelector('input[name="evalType"]:checked')?.value;
                if (!type) {
                    this.showNotification('Sélectionnez un type d\'évaluation', 'error');
                    return false;
                }
                this.wizardData.type = type;
                return true;
            }
            case 2: {
                const titre = document.getElementById('evalTitre')?.value.trim();
                if (!titre) {
                    this.showNotification('Le titre est requis', 'error');
                    return false;
                }
                this.wizardData.titre = titre;
                this.wizardData.briques = parseInt(document.getElementById('evalBriques')?.value) || 3;
                const matiereVisible = document.getElementById('evalMatiereGroup')?.style.display !== 'none';
                this.wizardData.matiere = matiereVisible ? (document.getElementById('evalMatiere')?.value || 'FR') : this.currentMatiere;
                this.wizardData.statut = document.getElementById('evalStatut')?.value || 'brouillon';
                this.wizardData.categorie = this.wizardData.type === 'bonus' ? (document.getElementById('evalCategorie')?.value || 'connaissances') : '';

                if (this.wizardData.type === 'connaissances') {
                    this.wizardData.seuil = parseInt(document.getElementById('evalSeuil')?.value) || 80;
                }
                if (this.wizardData.type === 'competences') {
                    this.wizardData.methodologie_id = document.getElementById('evalMethodologieTC')?.value || '';
                }
                if (this.wizardData.type === 'bonus') {
                    this.wizardData.criteres = document.getElementById('evalCriteres')?.value.trim() || '';
                }
                return true;
            }
            case 3:
                // Data already collected via onchange handlers
                return true;
        }
        return true;
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
            statut: d.statut || 'brouillon',
            categorie: d.categorie || d.type,
            date_creation: new Date().toISOString().split('T')[0]
        };

        if (d.type === 'connaissances') {
            data.seuil = d.seuil || 80;
            data.source_questions = 'banque';
            // Copier la durée depuis l'entraînement lié
            if (d.entrainement_conn_id) {
                const entr = this.entrainementsConn.find(e => e.id === d.entrainement_conn_id);
                if (entr && entr.duree) data.duree = parseInt(entr.duree);
            }
        }
        if (d.type === 'savoir-faire') {
            // Copier la durée depuis l'exercice SF lié
            if (d.exercice_sf_id) {
                const exo = this.exercicesSF.find(e => e.id === d.exercice_sf_id);
                if (exo && exo.duree) data.duree = parseInt(exo.duree);
            }
        }
        if (d.type === 'competences') {
            data.methodologie_id = d.methodologie_id || '';
        }
        if (d.type === 'bonus') {
            data.criteres = d.criteres || '';
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
    openSaisie(evaluationId) {
        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;

        this.saisieEvaluation = evaluation;
        this.saisieSommative = null;
        this.saisieChanges = {};

        // Get existing results for this evaluation
        const evalResults = this.resultats.filter(r =>
            String(r.evaluation_id).trim() === String(evaluationId).trim()
        );
        const resultsMap = {};
        evalResults.forEach(r => { resultsMap[String(r.eleve_id).trim()] = r; });

        // Update header
        document.getElementById('saisieTitle').textContent = escapeHtml(evaluation.titre || 'Sans titre');

        const matLabel = evaluation.matiere === 'FR' ? '🇫🇷 Français' :
            evaluation.matiere === 'HG-EMC' ? '🌍 HG-EMC' :
            evaluation.matiere === 'Les deux' ? '🔗 Les deux matières' : '';
        document.getElementById('saisieSubtitle').textContent =
            `${this._capitalizeType(evaluation.type)} · ${matLabel} · ${evaluation.briques || 0} pts`;

        // Update table headers for progression eval
        document.getElementById('saisieTableHead').innerHTML = `
            <th class="col-eleve">Élève</th>
            <th class="col-score">Score (%)</th>
            <th class="col-validations">Points</th>
            <th class="col-source">Source</th>
        `;

        // Render student rows
        const maxPts = evaluation.briques || 10;
        const tbody = document.getElementById('saisieTableBody');
        tbody.innerHTML = this.eleves.map(eleve => {
            const r = resultsMap[String(eleve.id).trim()] || {};
            const score = r.score !== undefined && r.score !== '' ? r.score : '';
            const validations = r.validations !== undefined && r.validations !== '' ? r.validations : '';
            const isAuto = r.source === 'auto' || (!r.source && r.id);

            return `
                <tr data-eleve-id="${eleve.id}">
                    <td class="col-eleve">
                        <span class="eleve-name">${escapeHtml(eleve.prenom || '')} ${escapeHtml(eleve.nom || '')}</span>
                    </td>
                    <td class="col-score">
                        <input type="number" class="saisie-input" value="${score}" min="0" max="100"
                            placeholder="—"
                            onchange="AdminEvaluations.onSaisieScoreChange('${eleve.id}', this.value, ${maxPts}, ${evaluation.seuil || 80})">
                    </td>
                    <td class="col-validations">
                        <input type="number" class="saisie-input" value="${validations}" min="0" max="${maxPts}"
                            placeholder="—"
                            onchange="AdminEvaluations.onSaisieChange('${eleve.id}', 'validations', this.value)">
                    </td>
                    <td class="col-source">
                        <span class="source-badge ${isAuto && r.id ? 'auto' : r.id ? 'manuel' : ''}">${r.id ? (isAuto ? '🤖 Auto' : '✏️ Manuel') : ''}</span>
                    </td>
                </tr>
            `;
        }).join('');

        // Show saisie view, hide list
        document.getElementById('evaluations-content').style.display = 'none';
        document.getElementById('saisie-content').style.display = 'block';
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
    },

    onSaisieChange(eleveId, field, value) {
        if (!this.saisieChanges[eleveId]) {
            this.saisieChanges[eleveId] = {};
        }
        this.saisieChanges[eleveId][field] = value;
        // Saisie manuelle → marquer la source comme 'manuel'
        this.saisieChanges[eleveId].source = 'manuel';

        // Mettre à jour le badge source visuellement
        const row = document.querySelector(`tr[data-eleve-id="${eleveId}"]`);
        if (row) {
            const badge = row.querySelector('.source-badge');
            if (badge) {
                badge.className = 'source-badge manuel';
                badge.textContent = '✏️ Manuel';
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
            // Mettre à jour le champ points dans le DOM
            const row = document.querySelector(`tr[data-eleve-id="${eleveId}"]`);
            if (row) {
                const ptsInput = row.querySelector('.col-validations input');
                if (ptsInput) ptsInput.value = points;
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
    },

    async saveSaisie() {
        const changedIds = Object.keys(this.saisieChanges);
        if (changedIds.length === 0) {
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
                    // Progression evaluation result
                    result = await this.callAPI('saveEvaluationResult', {
                        evaluation_id: this.saisieEvaluation.id,
                        eleve_id: eleveId,
                        ...changes,
                        is_validated: changes.score !== undefined ? parseInt(changes.score) >= (this.saisieEvaluation.seuil || 80) : undefined
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

            if (errors === 0) {
                this.showNotification(`${changedIds.length} résultat(s) enregistré(s)`);
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

        const evaluation = this.evaluations.find(e => e.id === evaluationId);
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
            // Find progression for this student
            const prog = this.progressionsEvaluation.find(p =>
                String(p.eleve_id).trim() === String(eleve.id).trim() &&
                String(p.type).trim() === type &&
                (!p.matiere || String(p.matiere).trim() === matiere)
            );

            // Determine auto banque (next one after last validated)
            const lastValidatedId = prog ? String(prog.derniere_banque_validee_id).trim() : '';
            let autoBanqueIndex = 0; // default: first banque
            if (lastValidatedId) {
                const lastIdx = banques.findIndex(b => String(b.id).trim() === lastValidatedId);
                if (lastIdx >= 0 && lastIdx < banques.length - 1) {
                    autoBanqueIndex = lastIdx + 1;
                } else if (lastIdx === banques.length - 1) {
                    autoBanqueIndex = lastIdx; // already at last banque
                }
            }

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

        if (entrainements.length === 0) return '<option value="">Aucun entraînement</option>';

        return '<option value="">Aléatoire</option>' +
            entrainements.map(e => {
                const selected = String(e.id).trim() === String(selectedId).trim() ? 'selected' : '';
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

        const evaluation = this.evaluations.find(e => e.id === evaluationId);
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
        const evaluation = this.evaluations.find(e => e.id === id);
        if (evaluation) this.openModal(evaluation);
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
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AdminEvaluations.init();
    }, 100);
});

window.AdminEvaluations = AdminEvaluations;
