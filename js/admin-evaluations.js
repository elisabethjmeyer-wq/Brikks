/**
 * Admin Evaluations - Gestion des evaluations
 */

const AdminEvaluations = {
    // Data
    evaluations: [],
    chapitres: [],
    themes: [],
    disciplines: [],
    methodologies: [],
    bexConfig: [],
    eleves: [],

    // Current tab type
    currentType: 'connaissances',

    // Filters
    filters: {
        search: '',
        statut: '',
        chapitre: ''
    },

    // Type colors
    typeColors: {
        'connaissances': 'green',
        'savoir-faire': 'orange',
        'competences': 'purple',
        'bonus': 'yellow'
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.populateFilters();
            this.updateCounts();
            this.renderEvaluations();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    async loadData() {
        // Note: EVALUATIONS table needs to be created in Google Sheets
        // Columns: id, type, titre, description, chapitre_id, statut, briques, seuil,
        //          methodologie_id, criteres, date_creation, date_publication

        const [
            disciplinesData,
            themesData,
            chapitresData,
            methodologiesData,
            bexConfigData,
            elevesData
        ] = await Promise.all([
            SheetsAPI.getSheetData('DISCIPLINES'),
            SheetsAPI.getSheetData('THEMES'),
            SheetsAPI.getSheetData('CHAPITRES'),
            SheetsAPI.getSheetData('METHODOLOGIE').catch(() => []),
            SheetsAPI.getSheetData('BEX_CONFIG').catch(() => []),
            SheetsAPI.getSheetData('UTILISATEURS').catch(() => [])
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.methodologies = SheetsAPI.parseSheetData(methodologiesData);
        this.bexConfig = SheetsAPI.parseSheetData(bexConfigData);
        this.eleves = SheetsAPI.parseSheetData(elevesData).filter(u => u.role === 'eleve');

        // Try to load evaluations (may not exist yet)
        try {
            const evaluationsData = await SheetsAPI.getSheetData('EVALUATIONS');
            this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        } catch (e) {
            console.log('Table EVALUATIONS not found, using empty array');
            this.evaluations = [];
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
                <p>${message}</p>
            </div>
        `;
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Add button
        document.getElementById('addEvaluationBtn').addEventListener('click', () => this.openModal());

        // Tab clicks
        document.querySelectorAll('.eval-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.switchTab(type);
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderEvaluations();
        });

        // Filter statut
        document.getElementById('filterStatut').addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.renderEvaluations();
        });

        // Filter chapitre
        document.getElementById('filterChapitre').addEventListener('change', (e) => {
            this.filters.chapitre = e.target.value;
            this.renderEvaluations();
        });

        // Modal events
        document.getElementById('closeEvaluationModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelEvaluationBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveEvaluationBtn').addEventListener('click', () => this.saveEvaluation());

        // Type selection in modal
        document.querySelectorAll('.type-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                card.querySelector('input').checked = true;
                this.onTypeChange(card.dataset.type);
            });
        });

        // Attribution modal
        document.getElementById('closeAttributionModal').addEventListener('click', () => this.closeAttributionModal());
        document.getElementById('cancelAttributionBtn').addEventListener('click', () => this.closeAttributionModal());
        document.getElementById('saveAttributionBtn').addEventListener('click', () => this.saveAttributions());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteEvaluation());

        // Modal overlays
        ['evaluationModal', 'attributionModal', 'deleteModal'].forEach(id => {
            document.getElementById(id).addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    document.getElementById(id).classList.add('hidden');
                }
            });
        });
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

        this.renderEvaluations();
    },

    updateCounts() {
        const types = ['connaissances', 'savoir-faire', 'competences', 'bonus'];
        types.forEach(type => {
            const count = this.evaluations.filter(e => e.type === type).length;
            const countEl = document.getElementById(`count${this.capitalizeFirst(type.replace('-', ''))}`);
            if (countEl) countEl.textContent = count;
        });
    },

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).replace('Faire', 'Faire');
    },

    // ========== FILTERS ==========
    populateFilters() {
        const chapitreSelect = document.getElementById('filterChapitre');
        chapitreSelect.innerHTML = '<option value="">Tous les chapitres</option>' +
            this.chapitres.map(c => `<option value="${c.id}">${this.escapeHtml(c.titre || c.id)}</option>`).join('');
    },

    // ========== RENDER ==========
    renderEvaluations() {
        const container = document.getElementById('evaluationsList');
        const emptyState = document.getElementById('emptyState');

        // Filter by current type and other filters
        let filtered = this.evaluations.filter(e => {
            if (e.type !== this.currentType) return false;
            if (this.filters.search) {
                const searchIn = `${e.titre || ''} ${e.description || ''}`.toLowerCase();
                if (!searchIn.includes(this.filters.search)) return false;
            }
            if (this.filters.statut && e.statut !== this.filters.statut) return false;
            if (this.filters.chapitre && e.chapitre_id !== this.filters.chapitre) return false;
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = filtered.map(e => this.renderEvaluationCard(e)).join('');
        }
    },

    renderEvaluationCard(evaluation) {
        const chapitre = this.chapitres.find(c => c.id === evaluation.chapitre_id);
        const chapterName = chapitre?.titre || 'Non défini';

        const typeClass = evaluation.type || 'connaissances';
        const statusClass = evaluation.statut || 'brouillon';
        const order = evaluation.ordre || this.getEvaluationOrder(evaluation);

        // Status labels with emoji
        const statusLabels = {
            'brouillon': '📝 Brouillon',
            'planifiee': '📅 Planifiée',
            'publiee': '🟢 En cours',
            'terminee': '✅ Terminée'
        };

        // Type icons for order badge
        const typeIcons = {
            'connaissances': order,
            'savoir-faire': `B${order}`,
            'competences': order,
            'bonus': '⭐'
        };

        // Type-specific meta info
        let metaItems = [];
        let statsHtml = '';
        let extraButtons = '';

        if (evaluation.type === 'connaissances') {
            metaItems = [
                `📅 ${evaluation.date_creation || 'Non planifié'}`,
                `🎯 ${evaluation.briques || 2} briques`,
                `📊 Seuil: ${evaluation.seuil || 80}%`
            ];
            if (chapitre) {
                extraButtons = `<a href="#" class="link-badge" onclick="return false;">📚 Voir le cours</a>`;
            }
            // Progress stats (mock data)
            const validated = evaluation.validated || 0;
            const total = this.eleves.length || 25;
            const percent = total > 0 ? Math.round((validated / total) * 100) : 0;
            statsHtml = `
                <div class="eval-card-stats">
                    <div class="eval-stat">
                        <div class="eval-stat-value">${validated}/${total}</div>
                        <div class="eval-stat-label">Validés</div>
                    </div>
                    <div class="progress-mini">
                        <div class="progress-mini-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        } else if (evaluation.type === 'savoir-faire') {
            const methodo = this.bexConfig.find(b => b.id === evaluation.methodologie_id);
            metaItems = [
                `📅 ${evaluation.date_creation || 'Depuis le ...'}`,
                `🎯 ${evaluation.briques || '1-2'} briques`,
                `📄 ${evaluation.sujets_count || 0} sujets`
            ];
            if (methodo) {
                extraButtons = `<a href="#" class="link-badge" onclick="return false;">🧠 Méthodologie</a>`;
            }
            const unlocked = evaluation.unlocked || 0;
            const total = this.eleves.length || 25;
            statsHtml = `
                <div class="eval-card-stats">
                    <div class="eval-stat">
                        <div class="eval-stat-value">${unlocked}/${total}</div>
                        <div class="eval-stat-label">Débloqué</div>
                    </div>
                </div>
            `;
        } else if (evaluation.type === 'competences') {
            metaItems = [
                `📅 ${evaluation.date_creation || 'Non planifié'}`,
                `🎯 ${evaluation.competences_count || 0} compétences`
            ];
            const briques = evaluation.briques_attribuees || 0;
            statsHtml = `
                <div class="eval-card-stats">
                    <div class="eval-stat">
                        <div class="eval-stat-value">${briques}</div>
                        <div class="eval-stat-label">Briques attribuées</div>
                    </div>
                </div>
            `;
        } else if (evaluation.type === 'bonus') {
            metaItems = [
                `🎯 ${evaluation.briques || 5} briques max`,
                `📊 ${evaluation.validation_rule || '3 validations = 1 brique'}`
            ];
            const validations = evaluation.validations_count || 0;
            statsHtml = `
                <div class="eval-card-stats">
                    <div class="eval-stat">
                        <div class="eval-stat-value">${validations}</div>
                        <div class="eval-stat-label">Validations</div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="eval-card ${typeClass}" data-id="${evaluation.id}">
                <div class="eval-card-main">
                    <div class="eval-card-order ${typeClass}">${typeIcons[typeClass]}</div>
                    <div class="eval-card-content">
                        <div class="eval-card-title">
                            ${this.escapeHtml(evaluation.titre || 'Sans titre')}
                            <span class="status-badge ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                        </div>
                        <div class="eval-card-meta">
                            ${metaItems.map(item => `<span>${item}</span>`).join('')}
                            ${extraButtons}
                        </div>
                    </div>
                    ${statsHtml}
                    <div class="eval-card-actions">
                        ${evaluation.type === 'connaissances' || evaluation.type === 'savoir-faire' ?
                            `<button class="btn-icon" onclick="AdminEvaluations.openAttributionModal('${evaluation.id}')" title="Attribuer sujets">👥</button>` : ''}
                        <button class="btn-icon" onclick="AdminEvaluations.editEvaluation('${evaluation.id}')" title="Modifier">✏️</button>
                        ${statusClass === 'publiee' ? `<button class="btn-icon" title="Saisir résultats">📝</button>` : ''}
                        <button class="btn-icon danger" onclick="AdminEvaluations.confirmDelete('${evaluation.id}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    },

    getEvaluationOrder(evaluation) {
        const sameType = this.evaluations.filter(e => e.type === evaluation.type);
        const index = sameType.findIndex(e => e.id === evaluation.id);
        return index >= 0 ? index + 1 : 1;
    },

    // ========== MODAL ==========
    openModal(evaluation = null) {
        const modal = document.getElementById('evaluationModal');
        const title = document.getElementById('evaluationModalTitle');
        const typeSelector = document.getElementById('typeSelector');

        // Populate selects
        this.populateChapitreSelect();
        this.populateMethodologieSelects();

        if (evaluation) {
            title.textContent = 'Modifier l\'evaluation';
            typeSelector.style.display = 'none';
            document.getElementById('editEvaluationId').value = evaluation.id;
            document.getElementById('evalTitre').value = evaluation.titre || '';
            document.getElementById('evalBriques').value = evaluation.briques || 3;
            document.getElementById('evalStatut').value = evaluation.statut || 'brouillon';
            document.getElementById('evalDescription').value = evaluation.description || '';

            // Type-specific
            if (evaluation.type === 'connaissances') {
                document.getElementById('evalSeuil').value = evaluation.seuil || 80;
                document.getElementById('evalChapitre').value = evaluation.chapitre_id || '';
            }
            if (evaluation.type === 'savoir-faire') {
                document.getElementById('evalMethodologie').value = evaluation.methodologie_id || '';
            }
            if (evaluation.type === 'competences') {
                document.getElementById('evalMethodologieTC').value = evaluation.methodologie_id || '';
            }
            if (evaluation.type === 'bonus') {
                document.getElementById('evalCriteres').value = evaluation.criteres || '';
            }

            this.onTypeChange(evaluation.type);
        } else {
            title.textContent = 'Creer une evaluation';
            typeSelector.style.display = 'block';
            document.getElementById('editEvaluationId').value = '';
            document.getElementById('evalTitre').value = '';
            document.getElementById('evalBriques').value = 3;
            document.getElementById('evalStatut').value = 'brouillon';
            document.getElementById('evalDescription').value = '';
            document.getElementById('evalSeuil').value = 80;
            document.getElementById('evalChapitre').value = '';
            document.getElementById('evalMethodologie').value = '';
            document.getElementById('evalMethodologieTC').value = '';
            document.getElementById('evalCriteres').value = '';

            // Reset type selector
            document.querySelectorAll('.type-card').forEach(c => c.classList.remove('selected'));
            document.querySelector('.type-card[data-type="connaissances"]').classList.add('selected');
            document.querySelector('input[name="evalType"][value="connaissances"]').checked = true;

            this.onTypeChange('connaissances');
        }

        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('evaluationModal').classList.add('hidden');
    },

    populateChapitreSelect() {
        const select = document.getElementById('evalChapitre');
        select.innerHTML = '<option value="">Selectionner...</option>' +
            this.chapitres.map(c => `<option value="${c.id}">${this.escapeHtml(c.titre || c.id)}</option>`).join('');
    },

    populateMethodologieSelects() {
        const savoirFaire = this.bexConfig.filter(b => b.type === 'savoir-faire');
        const competences = this.bexConfig.filter(b => b.type === 'competences');

        const selectSF = document.getElementById('evalMethodologie');
        selectSF.innerHTML = '<option value="">Selectionner...</option>' +
            savoirFaire.map(m => `<option value="${m.id}">${this.escapeHtml(m.titre || m.id)}</option>`).join('');

        const selectTC = document.getElementById('evalMethodologieTC');
        selectTC.innerHTML = '<option value="">Selectionner...</option>' +
            competences.map(m => `<option value="${m.id}">${this.escapeHtml(m.titre || m.id)}</option>`).join('');
    },

    onTypeChange(type) {
        // Hide all type-specific fields
        document.querySelectorAll('.type-fields').forEach(el => {
            el.style.display = 'none';
        });

        // Show relevant fields
        switch (type) {
            case 'connaissances':
                document.getElementById('connaissancesFields').style.display = 'block';
                break;
            case 'savoir-faire':
                document.getElementById('savoirFaireFields').style.display = 'block';
                break;
            case 'competences':
                document.getElementById('competencesFields').style.display = 'block';
                break;
            case 'bonus':
                document.getElementById('bonusFields').style.display = 'block';
                break;
        }
    },

    // ========== SAVE ==========
    async saveEvaluation() {
        const id = document.getElementById('editEvaluationId').value;
        const type = id ? this.evaluations.find(e => e.id === id)?.type :
            document.querySelector('input[name="evalType"]:checked')?.value;
        const titre = document.getElementById('evalTitre').value.trim();
        const briques = parseInt(document.getElementById('evalBriques').value) || 3;
        const statut = document.getElementById('evalStatut').value;
        const description = document.getElementById('evalDescription').value.trim();

        if (!titre) {
            alert('Veuillez saisir un titre');
            return;
        }

        const data = {
            type,
            titre,
            briques,
            statut,
            description,
            date_creation: new Date().toISOString().split('T')[0]
        };

        // Type-specific data
        if (type === 'connaissances') {
            data.seuil = parseInt(document.getElementById('evalSeuil').value) || 80;
            data.chapitre_id = document.getElementById('evalChapitre').value;
        }
        if (type === 'savoir-faire') {
            data.methodologie_id = document.getElementById('evalMethodologie').value;
        }
        if (type === 'competences') {
            data.methodologie_id = document.getElementById('evalMethodologieTC').value;
        }
        if (type === 'bonus') {
            data.criteres = document.getElementById('evalCriteres').value.trim();
        }

        try {
            document.getElementById('saveEvaluationBtn').disabled = true;
            document.getElementById('saveEvaluationBtn').textContent = 'Enregistrement...';

            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateEvaluation', data);
            } else {
                result = await this.callAPI('createEvaluation', data);
            }

            if (result.success) {
                this.closeModal();
                await this.loadData();
                this.updateCounts();
                this.renderEvaluations();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            // For now, simulate success since table might not exist
            alert('Note: La table EVALUATIONS doit etre creee dans Google Sheets.\nColonnes: id, type, titre, description, chapitre_id, statut, briques, seuil, methodologie_id, criteres, date_creation');
        } finally {
            document.getElementById('saveEvaluationBtn').disabled = false;
            document.getElementById('saveEvaluationBtn').textContent = 'Enregistrer';
        }
    },

    // ========== ATTRIBUTION MODAL ==========
    openAttributionModal(evaluationId) {
        const modal = document.getElementById('attributionModal');
        document.getElementById('attributionEvaluationId').value = evaluationId;

        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;

        // Render students table
        const tbody = document.getElementById('attributionTableBody');
        tbody.innerHTML = this.eleves.map(eleve => `
            <tr>
                <td>${this.escapeHtml(eleve.prenom || '')} ${this.escapeHtml(eleve.nom || '')}</td>
                <td>${eleve.classe_id || '-'}</td>
                <td><span class="progress-badge not-started">Non commence</span></td>
                <td>
                    <select class="subject-select" data-eleve="${eleve.id}">
                        <option value="">Aleatoire</option>
                        <option value="sujet_1">Sujet 1</option>
                        <option value="sujet_2">Sujet 2</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-icon" title="Voir details">V</button>
                </td>
            </tr>
        `).join('');

        modal.classList.remove('hidden');
    },

    closeAttributionModal() {
        document.getElementById('attributionModal').classList.add('hidden');
    },

    async saveAttributions() {
        // TODO: Implement attribution saving
        alert('Fonctionnalite en cours de developpement');
        this.closeAttributionModal();
    },

    // ========== DELETE ==========
    editEvaluation(id) {
        const evaluation = this.evaluations.find(e => e.id === id);
        if (evaluation) {
            this.openModal(evaluation);
        }
    },

    confirmDelete(id) {
        document.getElementById('deleteEvaluationId').value = id;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async deleteEvaluation() {
        const id = document.getElementById('deleteEvaluationId').value;

        try {
            document.getElementById('confirmDeleteBtn').disabled = true;
            document.getElementById('confirmDeleteBtn').textContent = 'Suppression...';

            const result = await this.callAPI('deleteEvaluation', { id });

            if (result.success) {
                this.closeDeleteModal();
                await this.loadData();
                this.updateCounts();
                this.renderEvaluations();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
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

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AdminEvaluations.init();
    }, 100);
});

window.AdminEvaluations = AdminEvaluations;
