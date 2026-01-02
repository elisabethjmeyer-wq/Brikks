/**
 * Admin Banques d'exercices - Gestion des banques, formats et exercices
 */

const AdminBanquesExercices = {
    // Data
    banques: [],
    formats: [],
    exercices: [],

    // Current tab type
    currentType: 'savoir-faire',

    // Filters
    filters: {
        search: '',
        statut: ''
    },

    // Table builder state
    tableBuilder: {
        columns: [],
        rows: []
    },

    // Type config
    typeConfig: {
        'savoir-faire': { icon: '&#128310;', color: 'orange', label: 'Savoir-faire' },
        'connaissances': { icon: '&#128994;', color: 'green', label: 'Connaissances' },
        'competences': { icon: '&#128995;', color: 'purple', label: 'Competences' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateCounts();
            this.renderBanques();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    async loadData() {
        try {
            // Load banques via API
            const banquesResult = await this.callAPI('getBanquesExercices', {});
            if (banquesResult.success) {
                this.banques = banquesResult.data || [];
            }

            // Load formats via API
            const formatsResult = await this.callAPI('getFormatsExercices', {});
            if (formatsResult.success) {
                this.formats = formatsResult.data || [];
            }

            // Load exercices via API
            const exercicesResult = await this.callAPI('getExercices', {});
            if (exercicesResult.success) {
                this.exercices = exercicesResult.data || [];
            }
        } catch (error) {
            console.error('Erreur chargement donnees:', error);
            // Initialize with empty arrays if API fails
            this.banques = [];
            this.formats = [];
            this.exercices = [];
        }
    },

    callAPI(action, params) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const removeScript = (script) => {
                try {
                    if (script && script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                } catch (e) {
                    // Ignore removal errors
                }
            };

            const script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                removeScript(script);
                resolve(response);
            };

            const queryParams = new URLSearchParams({
                action: action,
                callback: callbackName,
                ...params
            });

            script.src = `${CONFIG.WEBAPP_URL}?${queryParams.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                removeScript(script);
                reject(new Error('API call failed'));
            };

            document.body.appendChild(script);

            // Timeout
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    removeScript(script);
                    reject(new Error('API timeout'));
                }
            }, 15000);
        });
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('banques-content').style.display = 'block';
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
        // Add banque buttons
        document.getElementById('addBanqueBtn').addEventListener('click', () => this.openBanqueModal());
        const addBtnEmpty = document.getElementById('addBanqueBtnEmpty');
        if (addBtnEmpty) {
            addBtnEmpty.addEventListener('click', () => this.openBanqueModal());
        }

        // Manage formats button
        document.getElementById('manageFormatsBtn').addEventListener('click', () => this.openFormatsModal());

        // Tab clicks
        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                this.switchTab(type);
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderBanques();
        });

        // Filter statut
        document.getElementById('filterStatut').addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.renderBanques();
        });

        // Banque modal
        document.getElementById('closeBanqueModal').addEventListener('click', () => this.closeBanqueModal());
        document.getElementById('cancelBanqueBtn').addEventListener('click', () => this.closeBanqueModal());
        document.getElementById('saveBanqueBtn').addEventListener('click', () => this.saveBanque());

        // Type selection in banque modal
        document.querySelectorAll('.type-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                option.querySelector('input').checked = true;
            });
        });

        // Exercice modal
        document.getElementById('closeExerciceModal').addEventListener('click', () => this.closeExerciceModal());
        document.getElementById('cancelExerciceBtn').addEventListener('click', () => this.closeExerciceModal());
        document.getElementById('saveExerciceBtn').addEventListener('click', () => this.saveExercice());

        // Formats modal
        document.getElementById('closeFormatsModal').addEventListener('click', () => this.closeFormatsModal());
        document.getElementById('closeFormatsBtn').addEventListener('click', () => this.closeFormatsModal());
        document.getElementById('addFormatBtn').addEventListener('click', () => this.openFormatEditModal());

        // Format edit modal
        document.getElementById('closeFormatEditModal').addEventListener('click', () => this.closeFormatEditModal());
        document.getElementById('cancelFormatBtn').addEventListener('click', () => this.closeFormatEditModal());
        document.getElementById('saveFormatBtn').addEventListener('click', () => this.saveFormat());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());

        // Table builder
        document.getElementById('addColumnBtn').addEventListener('click', () => this.addColumn());
        document.getElementById('addRowBtn').addEventListener('click', () => this.addRow());
        document.getElementById('previewExerciceBtn').addEventListener('click', () => this.previewExercice());

        // Modal overlays
        ['banqueModal', 'exerciceModal', 'formatsModal', 'formatEditModal', 'deleteModal'].forEach(id => {
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

        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === type) {
                tab.classList.add('active');
            }
        });

        this.renderBanques();
    },

    updateCounts() {
        const types = ['savoir-faire', 'connaissances', 'competences'];
        types.forEach(type => {
            const count = this.banques.filter(b => b.type === type).length;
            const id = 'count' + type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
            const el = document.getElementById(id);
            if (el) el.textContent = count;
        });
    },

    // ========== RENDER ==========
    renderBanques() {
        const container = document.getElementById('banquesList');
        const emptyState = document.getElementById('emptyState');

        // Filter banques
        let filtered = this.banques.filter(b => b.type === this.currentType);

        if (this.filters.search) {
            filtered = filtered.filter(b =>
                (b.titre || '').toLowerCase().includes(this.filters.search) ||
                (b.description || '').toLowerCase().includes(this.filters.search)
            );
        }

        if (this.filters.statut) {
            filtered = filtered.filter(b => b.statut === this.filters.statut);
        }

        // Sort by ordre
        filtered.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = filtered.map(banque => {
            const exercices = this.exercices.filter(e => e.banque_id === banque.id);
            const config = this.typeConfig[banque.type] || this.typeConfig['savoir-faire'];

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon ${banque.type}">${config.icon}</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                                <span class="status-badge ${banque.statut}">${banque.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${exercices.length}</div>
                                <div class="banque-stat-label">exercices</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanque('${banque.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanque('${banque.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Exercices</h4>
                            <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addExercice('${banque.id}')">+ Ajouter</button>
                        </div>
                        ${this.renderExercices(exercices, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderExercices(exercices, banqueId) {
        if (exercices.length === 0) {
            return '<div class="exercices-empty">Aucun exercice dans cette banque</div>';
        }

        // Sort by numero
        exercices.sort((a, b) => (a.numero || 0) - (b.numero || 0));

        return `
            <div class="exercices-list">
                ${exercices.map(exo => {
                    const format = this.formats.find(f => f.id === exo.format_id);
                    const formatName = format ? format.nom : 'Format inconnu';
                    const dureeMin = Math.round((exo.duree || 600) / 60);

                    return `
                        <div class="exercice-item" data-id="${exo.id}">
                            <div class="exercice-numero">${exo.numero || '?'}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                                <div class="exercice-meta">${formatName} - ${dureeMin} min</div>
                            </div>
                            <span class="status-badge ${exo.statut}">${exo.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editExercice('${exo.id}')" title="Modifier">&#9998;</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteExercice('${exo.id}')" title="Supprimer">&#128465;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    toggleBanque(id) {
        const card = document.querySelector(`.banque-card[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('expanded');
        }
    },

    // ========== BANQUE MODAL ==========
    openBanqueModal(banque = null) {
        const modal = document.getElementById('banqueModal');
        const title = document.getElementById('banqueModalTitle');

        if (banque) {
            title.textContent = 'Modifier la banque';
            document.getElementById('editBanqueId').value = banque.id;
            document.getElementById('banqueTitre').value = banque.titre || '';
            document.getElementById('banqueDescription').value = banque.description || '';
            document.getElementById('banqueOrdre').value = banque.ordre || 1;
            document.getElementById('banqueStatut').value = banque.statut || 'brouillon';

            // Select type
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.type === banque.type) {
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                }
            });
        } else {
            title.textContent = 'Nouvelle banque';
            document.getElementById('editBanqueId').value = '';
            document.getElementById('banqueTitre').value = '';
            document.getElementById('banqueDescription').value = '';
            document.getElementById('banqueOrdre').value = 1;
            document.getElementById('banqueStatut').value = 'brouillon';

            // Select current type
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.type === this.currentType) {
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                }
            });
        }

        modal.classList.remove('hidden');
    },

    closeBanqueModal() {
        document.getElementById('banqueModal').classList.add('hidden');
    },

    editBanque(id) {
        const banque = this.banques.find(b => b.id === id);
        if (banque) {
            this.openBanqueModal(banque);
        }
    },

    async saveBanque() {
        const id = document.getElementById('editBanqueId').value;
        const type = document.querySelector('input[name="banqueType"]:checked').value;
        const titre = document.getElementById('banqueTitre').value.trim();
        const description = document.getElementById('banqueDescription').value.trim();
        const ordre = parseInt(document.getElementById('banqueOrdre').value) || 1;
        const statut = document.getElementById('banqueStatut').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        const data = { type, titre, description, ordre, statut };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateBanqueExercices', data);
            } else {
                result = await this.callAPI('createBanqueExercices', data);
            }

            if (result.success) {
                await this.loadData();
                this.updateCounts();
                this.renderBanques();
                this.closeBanqueModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde banque:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteBanque(id) {
        const banque = this.banques.find(b => b.id === id);
        if (!banque) return;

        document.getElementById('deleteType').value = 'banque';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer la banque "${banque.titre}" et tous ses exercices ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== EXERCICE MODAL ==========
    addExercice(banqueId) {
        this.openExerciceModal(null, banqueId);
    },

    openExerciceModal(exercice = null, banqueId = null) {
        const modal = document.getElementById('exerciceModal');
        const title = document.getElementById('exerciceModalTitle');

        // Populate formats dropdown
        this.populateFormatsDropdown();

        if (exercice) {
            title.textContent = 'Modifier l\'exercice';
            document.getElementById('editExerciceId').value = exercice.id;
            document.getElementById('exerciceBanqueId').value = exercice.banque_id;
            document.getElementById('exerciceNumero').value = exercice.numero || 1;
            document.getElementById('exerciceTitre').value = exercice.titre || '';
            document.getElementById('exerciceFormat').value = exercice.format_id || '';
            document.getElementById('exerciceConsigne').value = exercice.consigne || '';
            document.getElementById('exerciceDuree').value = exercice.duree || 600;
            document.getElementById('exerciceStatut').value = exercice.statut || 'brouillon';
            document.getElementById('exercicePeutTomber').checked = exercice.peut_tomber_en_eval !== false;

            // Load table builder data from exercice.donnees
            let donnees = exercice.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }
            this.loadTableBuilderFromData(donnees);
        } else {
            title.textContent = 'Nouvel exercice';
            document.getElementById('editExerciceId').value = '';
            document.getElementById('exerciceBanqueId').value = banqueId;

            // Get next numero
            const banqueExercices = this.exercices.filter(e => e.banque_id === banqueId);
            const nextNumero = banqueExercices.length + 1;

            document.getElementById('exerciceNumero').value = nextNumero;
            document.getElementById('exerciceTitre').value = 'Exercice ' + nextNumero;
            document.getElementById('exerciceFormat').value = '';
            document.getElementById('exerciceConsigne').value = '';
            document.getElementById('exerciceDuree').value = 600;
            document.getElementById('exerciceStatut').value = 'brouillon';
            document.getElementById('exercicePeutTomber').checked = true;

            // Initialize table builder with default structure
            this.initTableBuilder();
        }

        modal.classList.remove('hidden');
    },

    populateFormatsDropdown() {
        const select = document.getElementById('exerciceFormat');
        select.innerHTML = '<option value="">Selectionner un format...</option>' +
            this.formats.map(f => `<option value="${f.id}">${this.escapeHtml(f.nom)}</option>`).join('');
    },

    closeExerciceModal() {
        document.getElementById('exerciceModal').classList.add('hidden');
    },

    editExercice(id) {
        const exercice = this.exercices.find(e => e.id === id);
        if (exercice) {
            this.openExerciceModal(exercice);
        }
    },

    async saveExercice() {
        const id = document.getElementById('editExerciceId').value;
        const banque_id = document.getElementById('exerciceBanqueId').value;
        const numero = parseInt(document.getElementById('exerciceNumero').value) || 1;
        const titre = document.getElementById('exerciceTitre').value.trim();
        const format_id = document.getElementById('exerciceFormat').value;
        const consigne = document.getElementById('exerciceConsigne').value.trim();
        const duree = parseInt(document.getElementById('exerciceDuree').value) || 600;
        const statut = document.getElementById('exerciceStatut').value;
        const peut_tomber_en_eval = document.getElementById('exercicePeutTomber').checked;

        // Build donnees from table builder
        const donnees = this.buildDataFromTableBuilder();

        if (!donnees || donnees.colonnes.length === 0) {
            alert('Ajoutez au moins une colonne au tableau');
            return;
        }

        if (donnees.lignes.length === 0) {
            alert('Ajoutez au moins une ligne au tableau');
            return;
        }

        if (!format_id) {
            alert('Le format est requis');
            return;
        }

        const data = {
            banque_id, format_id, numero, titre, consigne, duree,
            donnees: JSON.stringify(donnees),
            peut_tomber_en_eval, statut
        };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateExercice', data);
            } else {
                result = await this.callAPI('createExercice', data);
            }

            if (result.success) {
                await this.loadData();
                this.renderBanques();
                this.closeExerciceModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde exercice:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteExercice(id) {
        const exercice = this.exercices.find(e => e.id === id);
        if (!exercice) return;

        document.getElementById('deleteType').value = 'exercice';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer l'exercice "${exercice.titre || 'Exercice ' + exercice.numero}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== FORMATS MODAL ==========
    openFormatsModal() {
        this.renderFormatsList();
        document.getElementById('formatsModal').classList.remove('hidden');
    },

    closeFormatsModal() {
        document.getElementById('formatsModal').classList.add('hidden');
    },

    renderFormatsList() {
        const container = document.getElementById('formatsList');

        if (this.formats.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucun format defini</div>';
            return;
        }

        container.innerHTML = this.formats.map(format => {
            const types = (format.type_compatible || '').split(',').filter(t => t.trim());

            return `
                <div class="format-item" data-id="${format.id}">
                    <div class="format-item-icon">&#128221;</div>
                    <div class="format-item-content">
                        <div class="format-item-name">${this.escapeHtml(format.nom)}</div>
                        <div class="format-item-desc">${this.escapeHtml(format.description || 'Aucune description')}</div>
                    </div>
                    <div class="format-item-types">
                        ${types.map(t => `<span class="format-type-badge ${t.trim()}">${t.trim()}</span>`).join('')}
                    </div>
                    <div class="format-item-actions">
                        <button class="btn-icon" onclick="AdminBanquesExercices.editFormat('${format.id}')" title="Modifier">&#9998;</button>
                        <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteFormat('${format.id}')" title="Supprimer">&#128465;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ========== FORMAT EDIT MODAL ==========
    openFormatEditModal(format = null) {
        const modal = document.getElementById('formatEditModal');
        const title = document.getElementById('formatEditModalTitle');

        if (format) {
            title.textContent = 'Modifier le format';
            document.getElementById('editFormatId').value = format.id;
            document.getElementById('formatNom').value = format.nom || '';
            document.getElementById('formatDescription').value = format.description || '';

            // Set type checkboxes
            const types = (format.type_compatible || '').split(',').map(t => t.trim());
            document.querySelectorAll('input[name="formatTypes"]').forEach(cb => {
                cb.checked = types.includes(cb.value);
            });

            // Format structure
            const structure = typeof format.structure === 'object' ?
                JSON.stringify(format.structure, null, 2) : (format.structure || '');
            document.getElementById('formatStructure').value = structure;
        } else {
            title.textContent = 'Nouveau format';
            document.getElementById('editFormatId').value = '';
            document.getElementById('formatNom').value = '';
            document.getElementById('formatDescription').value = '';

            // Reset checkboxes
            document.querySelectorAll('input[name="formatTypes"]').forEach(cb => {
                cb.checked = cb.value === 'savoir-faire';
            });

            document.getElementById('formatStructure').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeFormatEditModal() {
        document.getElementById('formatEditModal').classList.add('hidden');
    },

    editFormat(id) {
        const format = this.formats.find(f => f.id === id);
        if (format) {
            this.openFormatEditModal(format);
        }
    },

    async saveFormat() {
        const id = document.getElementById('editFormatId').value;
        const nom = document.getElementById('formatNom').value.trim();
        const description = document.getElementById('formatDescription').value.trim();

        // Get selected types
        const types = [];
        document.querySelectorAll('input[name="formatTypes"]:checked').forEach(cb => {
            types.push(cb.value);
        });
        const type_compatible = types.join(',');

        // Parse structure JSON
        let structure;
        const structureStr = document.getElementById('formatStructure').value.trim();
        if (structureStr) {
            try {
                structure = JSON.parse(structureStr);
            } catch (e) {
                alert('Erreur: Le JSON de la structure n\'est pas valide');
                return;
            }
        } else {
            structure = {};
        }

        if (!nom) {
            alert('Le nom est requis');
            return;
        }

        const data = { nom, description, type_compatible, structure: JSON.stringify(structure) };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateFormatExercices', data);
            } else {
                result = await this.callAPI('createFormatExercices', data);
            }

            if (result.success) {
                await this.loadData();
                this.renderFormatsList();
                this.closeFormatEditModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde format:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteFormat(id) {
        const format = this.formats.find(f => f.id === id);
        if (!format) return;

        document.getElementById('deleteType').value = 'format';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer le format "${format.nom}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== DELETE MODAL ==========
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        const type = document.getElementById('deleteType').value;
        const id = document.getElementById('deleteId').value;

        try {
            let result;
            if (type === 'banque') {
                result = await this.callAPI('deleteBanqueExercices', { id });
            } else if (type === 'exercice') {
                result = await this.callAPI('deleteExercice', { id });
            } else if (type === 'format') {
                result = await this.callAPI('deleteFormatExercices', { id });
            }

            if (result && result.success) {
                await this.loadData();
                this.updateCounts();
                this.renderBanques();
                if (type === 'format') {
                    this.renderFormatsList();
                }
                this.closeDeleteModal();
            } else {
                alert('Erreur: ' + (result?.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    // ========== TABLE BUILDER ==========
    initTableBuilder() {
        // Default: 2 columns (Date = display, Siècle = editable)
        this.tableBuilder = {
            columns: [
                { titre: 'Date', editable: false },
                { titre: 'Siècle', editable: true }
            ],
            rows: [
                ['', '']
            ]
        };
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    loadTableBuilderFromData(donnees) {
        if (donnees && donnees.colonnes && donnees.lignes) {
            this.tableBuilder = {
                columns: donnees.colonnes.map(c => ({
                    titre: c.titre || '',
                    editable: c.editable !== false
                })),
                rows: donnees.lignes.map(ligne => ligne.cells || [])
            };
        } else if (donnees && donnees.lignes && Array.isArray(donnees.lignes)) {
            // Legacy format: lignes with named properties
            // Try to infer columns from first row
            const firstRow = donnees.lignes[0];
            const keys = Object.keys(firstRow);
            this.tableBuilder = {
                columns: keys.map(key => ({
                    titre: key.charAt(0).toUpperCase() + key.slice(1),
                    editable: key !== 'date'
                })),
                rows: donnees.lignes.map(ligne => keys.map(k => ligne[k] || ''))
            };
        } else {
            this.initTableBuilder();
            return;
        }
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    buildDataFromTableBuilder() {
        // Read current values from DOM
        this.readTableBuilderValues();

        return {
            colonnes: this.tableBuilder.columns.map(c => ({
                titre: c.titre,
                editable: c.editable
            })),
            lignes: this.tableBuilder.rows.map(row => ({
                cells: row
            }))
        };
    },

    readTableBuilderValues() {
        // Read columns
        const colDefs = document.querySelectorAll('.column-def');
        this.tableBuilder.columns = Array.from(colDefs).map(def => ({
            titre: def.querySelector('.col-title-input').value || '',
            editable: def.querySelector('.col-editable-check').checked
        }));

        // Read rows
        const tbody = document.getElementById('tableBuilderBody');
        const rows = tbody.querySelectorAll('tr');
        this.tableBuilder.rows = Array.from(rows).map(tr => {
            const inputs = tr.querySelectorAll('input[type="text"]');
            return Array.from(inputs).map(input => input.value || '');
        });
    },

    renderColumnsBuilder() {
        const container = document.getElementById('columnsBuilder');
        container.innerHTML = this.tableBuilder.columns.map((col, index) => `
            <div class="column-def" data-index="${index}">
                <span class="column-num">${index + 1}</span>
                <input type="text" class="col-title-input" value="${this.escapeHtml(col.titre)}" placeholder="Nom de la colonne">
                <label class="column-editable">
                    <input type="checkbox" class="col-editable-check" ${col.editable ? 'checked' : ''}>
                    <span>Réponse élève</span>
                </label>
                <button type="button" class="btn-remove-col" onclick="AdminBanquesExercices.removeColumn(${index})" title="Supprimer">&times;</button>
            </div>
        `).join('');

        // Add change listeners
        container.querySelectorAll('.col-title-input, .col-editable-check').forEach(input => {
            input.addEventListener('change', () => this.onColumnChange());
        });
    },

    renderTableBuilder() {
        const thead = document.getElementById('tableBuilderHead');
        const tbody = document.getElementById('tableBuilderBody');

        // Render headers
        thead.innerHTML = `
            <tr>
                ${this.tableBuilder.columns.map((col, i) => `
                    <th class="${col.editable ? 'editable-col' : ''}">
                        ${this.escapeHtml(col.titre) || 'Colonne ' + (i + 1)}
                        <span class="col-hint">${col.editable ? '(réponse)' : '(donnée)'}</span>
                    </th>
                `).join('')}
                <th class="row-actions"></th>
            </tr>
        `;

        // Ensure rows have correct number of cells
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            const newRow = [...row];
            while (newRow.length < this.tableBuilder.columns.length) {
                newRow.push('');
            }
            return newRow.slice(0, this.tableBuilder.columns.length);
        });

        // Render rows
        if (this.tableBuilder.rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100" class="table-builder-empty">Aucune ligne. Cliquez sur "Ajouter une ligne".</td></tr>';
        } else {
            tbody.innerHTML = this.tableBuilder.rows.map((row, rowIndex) => `
                <tr data-row="${rowIndex}">
                    ${this.tableBuilder.columns.map((col, colIndex) => `
                        <td>
                            <input type="text"
                                   class="${col.editable ? 'editable-input' : ''}"
                                   value="${this.escapeHtml(row[colIndex] || '')}"
                                   placeholder="${col.editable ? 'Réponse attendue' : 'Donnée affichée'}">
                        </td>
                    `).join('')}
                    <td class="row-actions">
                        <button type="button" class="btn-remove-row" onclick="AdminBanquesExercices.removeRow(${rowIndex})" title="Supprimer">&times;</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    onColumnChange() {
        this.readTableBuilderValues();
        this.renderTableBuilder();
    },

    addColumn() {
        this.readTableBuilderValues();
        this.tableBuilder.columns.push({ titre: '', editable: true });
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => [...row, '']);
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    removeColumn(index) {
        if (this.tableBuilder.columns.length <= 1) {
            alert('Il faut au moins une colonne');
            return;
        }
        this.readTableBuilderValues();
        this.tableBuilder.columns.splice(index, 1);
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            row.splice(index, 1);
            return row;
        });
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    addRow() {
        this.readTableBuilderValues();
        const newRow = this.tableBuilder.columns.map(() => '');
        this.tableBuilder.rows.push(newRow);
        this.renderTableBuilder();
    },

    removeRow(index) {
        if (this.tableBuilder.rows.length <= 1) {
            alert('Il faut au moins une ligne');
            return;
        }
        this.readTableBuilderValues();
        this.tableBuilder.rows.splice(index, 1);
        this.renderTableBuilder();
    },

    previewExercice() {
        this.readTableBuilderValues();
        const donnees = this.buildDataFromTableBuilder();
        const consigne = document.getElementById('exerciceConsigne').value;
        const titre = document.getElementById('exerciceTitre').value || 'Exercice';

        // Open preview in new window
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation - ${this.escapeHtml(titre)}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; padding: 2rem; background: #f5f5f5; }
                    .preview-card { background: white; border-radius: 12px; max-width: 700px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    .preview-header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; }
                    .preview-header h1 { margin: 0; font-size: 1.3rem; }
                    .preview-consigne { background: #f8f9ff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
                    .preview-content { padding: 1.5rem; }
                    table { width: 100%; border-collapse: collapse; }
                    th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                    th.editable { background: #dbeafe; color: #2563eb; }
                    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                    .data-cell { font-weight: 500; }
                    .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
                    .input-cell input:focus { outline: none; border-color: #3b82f6; }
                </style>
            </head>
            <body>
                <div class="preview-card">
                    <div class="preview-header">
                        <h1>${this.escapeHtml(titre)}</h1>
                    </div>
                    ${consigne ? `<div class="preview-consigne">${this.escapeHtml(consigne)}</div>` : ''}
                    <div class="preview-content">
                        <table>
                            <thead>
                                <tr>
                                    ${donnees.colonnes.map(col => `<th class="${col.editable ? 'editable' : ''}">${this.escapeHtml(col.titre)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${donnees.lignes.map(ligne => `
                                    <tr>
                                        ${donnees.colonnes.map((col, i) => col.editable
                                            ? `<td class="input-cell"><input type="text" placeholder="..."></td>`
                                            : `<td class="data-cell">${this.escapeHtml(ligne.cells[i] || '')}</td>`
                                        ).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `);
    },

    // ========== UTILS ==========
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    AdminBanquesExercices.init();
});
