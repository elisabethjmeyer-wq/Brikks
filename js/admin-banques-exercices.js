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

    // Carte cliquable builder state
    carteBuilder: {
        imageUrl: '',
        marqueurs: []
    },

    // Question ouverte builder state
    questionBuilder: {
        document: { type: 'texte', contenu: '' },
        questions: []
    },

    // Current format type_ui
    currentFormatUI: 'tableau_saisie',

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

        // Format change - switch builders
        document.getElementById('exerciceFormat').addEventListener('change', (e) => this.onFormatChange(e.target.value));

        // Carte cliquable builder
        document.getElementById('carteImageUrl').addEventListener('input', (e) => this.updateCartePreview(e.target.value));
        document.getElementById('addMarqueurBtn').addEventListener('click', () => this.addMarqueurManual());

        // Question ouverte builder
        document.getElementById('addQuestionBtn').addEventListener('click', () => this.addQuestion());

        // Document mixte builder
        document.getElementById('toggleDocument')?.addEventListener('change', (e) => this.onMixteToggle('document', e.target.checked));
        document.getElementById('toggleTableau')?.addEventListener('change', (e) => this.onMixteToggle('tableau', e.target.checked));
        document.getElementById('toggleQuestions')?.addEventListener('change', (e) => this.onMixteToggle('questions', e.target.checked));
        document.getElementById('docUrlMixte')?.addEventListener('input', () => this.updateMixtePreview());
        document.getElementById('docTitreMixte')?.addEventListener('input', () => this.updateMixtePreview());
        document.getElementById('docLegendeMixte')?.addEventListener('input', () => this.updateMixtePreview());
        document.getElementById('tableauTitreMixte')?.addEventListener('input', () => this.updateMixtePreview());
        document.getElementById('addColumnMixteBtn')?.addEventListener('click', () => this.addColumnMixte());
        document.getElementById('addRowMixteBtn')?.addEventListener('click', () => this.addRowMixte());
        document.getElementById('addQuestionMixteBtn')?.addEventListener('click', () => this.addQuestionMixte());

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

        // Hide all builders first
        document.querySelectorAll('.format-builder').forEach(el => el.style.display = 'none');
        document.getElementById('documentSectionTableau').style.display = 'none';

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

            // Parse donnees
            let donnees = exercice.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }

            // Get format type_ui
            const format = this.formats.find(f => f.id === exercice.format_id);
            let structure = format ? format.structure : null;
            if (typeof structure === 'string') {
                try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
            }
            const typeUI = structure ? structure.type_ui : 'tableau_saisie';
            this.currentFormatUI = typeUI;

            // Load data into appropriate builder
            if (typeUI === 'carte_cliquable') {
                document.getElementById('builderCarte').style.display = 'block';
                this.loadCarteBuilderFromData(donnees);
            } else if (typeUI === 'question_ouverte') {
                document.getElementById('builderQuestionOuverte').style.display = 'block';
                this.loadQuestionBuilderFromData(donnees);
            } else if (typeUI === 'document_tableau') {
                document.getElementById('builderTableau').style.display = 'block';
                document.getElementById('documentSectionTableau').style.display = 'block';
                if (donnees.document) {
                    document.getElementById('docTypeTableau').value = donnees.document.type || 'texte';
                    document.getElementById('docContenuTableau').value = donnees.document.contenu || '';
                }
                this.loadTableBuilderFromData(donnees);
            } else if (typeUI === 'document_mixte') {
                document.getElementById('builderDocumentMixte').style.display = 'block';
                this.loadDocumentMixteFromData(donnees);
            } else {
                document.getElementById('builderTableau').style.display = 'block';
                this.loadTableBuilderFromData(donnees);
            }
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

            // Reset to default format
            this.currentFormatUI = 'tableau_saisie';
            document.getElementById('builderTableau').style.display = 'block';
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

        if (!format_id) {
            alert('Le format est requis');
            return;
        }

        // Build donnees from the appropriate builder
        let donnees;
        if (this.currentFormatUI === 'carte_cliquable') {
            donnees = this.buildDataFromCarteBuilder();
            if (!donnees.image_url) {
                alert('L\'URL de l\'image est requise');
                return;
            }
            if (donnees.marqueurs.length === 0) {
                alert('Ajoutez au moins un marqueur');
                return;
            }
        } else if (this.currentFormatUI === 'question_ouverte') {
            donnees = this.buildDataFromQuestionBuilder();
            if (donnees.questions.length === 0) {
                alert('Ajoutez au moins une question');
                return;
            }
        } else if (this.currentFormatUI === 'document_tableau') {
            donnees = this.buildDataFromTableBuilder();
            donnees.document = {
                type: document.getElementById('docTypeTableau').value,
                contenu: document.getElementById('docContenuTableau').value
            };
            if (!donnees || donnees.colonnes.length === 0) {
                alert('Ajoutez au moins une colonne au tableau');
                return;
            }
            if (donnees.lignes.length === 0) {
                alert('Ajoutez au moins une ligne au tableau');
                return;
            }
        } else if (this.currentFormatUI === 'document_mixte') {
            donnees = this.buildDataFromDocumentMixte();
            // Validate: at least one section must be active
            const hasContent = donnees.document.actif || donnees.tableau.actif || donnees.questions.actif;
            if (!hasContent) {
                alert('Activez au moins une section (Document, Tableau ou Questions)');
                return;
            }
            // Validate tableau if active
            if (donnees.tableau.actif && donnees.tableau.colonnes.length === 0) {
                alert('Le tableau nécessite au moins une colonne');
                return;
            }
        } else {
            // Default: tableau_saisie
            donnees = this.buildDataFromTableBuilder();
            if (!donnees || donnees.colonnes.length === 0) {
                alert('Ajoutez au moins une colonne au tableau');
                return;
            }
            if (donnees.lignes.length === 0) {
                alert('Ajoutez au moins une ligne au tableau');
                return;
            }
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
        const consigne = document.getElementById('exerciceConsigne').value;
        const titre = document.getElementById('exerciceTitre').value || 'Exercice';
        const formatUI = this.currentFormatUI || 'tableau_saisie';

        let contentHTML = '';
        let extraStyles = '';

        if (formatUI === 'carte_cliquable') {
            const donnees = this.buildDataFromCarteBuilder();
            extraStyles = `
                .carte-container { position: relative; display: inline-block; max-width: 100%; }
                .carte-image { max-width: 100%; height: auto; display: block; border-radius: 8px; }
                .carte-marker { position: absolute; width: 32px; height: 32px; background: #6366f1; color: white;
                    border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 14px; transform: translate(-50%, -50%); cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
                .carte-marker:hover { background: #4f46e5; transform: translate(-50%, -50%) scale(1.1); }
                .carte-marker .badge { position: absolute; top: -8px; left: 100%; margin-left: 4px; background: white;
                    color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
                .preview-note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 1rem;
                    font-size: 0.875rem; color: #92400e; }
            `;
            const imageUrl = this.convertToDirectImageUrl(donnees.imageUrl);
            contentHTML = `
                <div class="carte-container">
                    <img src="${this.escapeHtml(imageUrl)}" class="carte-image" alt="Carte" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display:none; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;">
                        ⚠️ Impossible de charger l'image. Vérifiez le lien.
                    </div>
                    ${donnees.marqueurs.map((m, i) => `
                        <div class="carte-marker" style="left: ${m.x}%; top: ${m.y}%;">
                            ${i + 1}
                            <span class="badge">${this.escapeHtml(m.reponse)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="preview-note">
                    <strong>Aperçu admin:</strong> Les élèves cliqueront sur les numéros pour saisir leur réponse dans un popup.
                    Les réponses attendues (${donnees.marqueurs.length}) sont affichées ici à titre indicatif.
                </div>
            `;
        } else if (formatUI === 'question_ouverte') {
            const donnees = this.buildDataFromQuestionBuilder();
            extraStyles = `
                .qo-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .qo-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .qo-document img { max-width: 100%; height: auto; }
                .qo-questions { display: flex; flex-direction: column; gap: 1rem; }
                .qo-question { background: #fafafa; padding: 1rem; border-radius: 8px; }
                .qo-question-text { font-weight: 500; margin-bottom: 0.5rem; }
                .qo-textarea { width: 100%; min-height: 80px; padding: 10px; border: 2px solid #dbeafe; border-radius: 6px; resize: vertical; }
            `;
            const docImgUrl = this.convertToDirectImageUrl(donnees.document.contenu);
            const docContent = donnees.document.type === 'image'
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(donnees.document.contenu)}</p>`;
            contentHTML = `
                <div class="qo-layout">
                    <div class="qo-document">${docContent}</div>
                    <div class="qo-questions">
                        ${donnees.questions.map((q, i) => `
                            <div class="qo-question">
                                <div class="qo-question-text">${i + 1}. ${this.escapeHtml(q.question)}</div>
                                <textarea class="qo-textarea" placeholder="Votre réponse..."></textarea>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_tableau') {
            // Document + Table format
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            const docType = document.getElementById('docTypeTableau').value;
            const docContenu = document.getElementById('docContenuTableau').value;
            const docImgUrl = this.convertToDirectImageUrl(docContenu);
            extraStyles = `
                .dt-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .dt-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .dt-document img { max-width: 100%; height: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            const docContent = docType === 'image'
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(docContenu)}</p>`;
            contentHTML = `
                <div class="dt-layout">
                    <div class="dt-document">${docContent}</div>
                    <div class="dt-table">
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
            `;
        } else {
            // Default: tableau_saisie
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            extraStyles = `
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            contentHTML = `
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
            `;
        }

        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation - ${this.escapeHtml(titre)}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; padding: 2rem; background: #f5f5f5; }
                    .preview-card { background: white; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    .preview-header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; }
                    .preview-header h1 { margin: 0; font-size: 1.3rem; }
                    .preview-consigne { background: #f8f9ff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
                    .preview-content { padding: 1.5rem; }
                    ${extraStyles}
                </style>
            </head>
            <body>
                <div class="preview-card">
                    <div class="preview-header">
                        <h1>${this.escapeHtml(titre)}</h1>
                    </div>
                    ${consigne ? `<div class="preview-consigne">${this.escapeHtml(consigne)}</div>` : ''}
                    <div class="preview-content">
                        ${contentHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
    },

    // ========== FORMAT SWITCHING ==========
    onFormatChange(formatId) {
        // Compare as strings to handle type mismatch
        const format = this.formats.find(f => String(f.id) === String(formatId));
        let structure = format ? format.structure : null;

        // Handle double-stringified JSON from Google Sheets
        if (typeof structure === 'string') {
            try {
                structure = JSON.parse(structure);
                // Check if it's still a string (double-encoded)
                if (typeof structure === 'string') {
                    structure = JSON.parse(structure);
                }
            } catch (e) {
                structure = {};
            }
        }

        const typeUI = structure ? structure.type_ui : 'tableau_saisie';
        this.currentFormatUI = typeUI;

        console.log('Format change:', { formatId, format, structure, typeUI });

        // Hide all builders
        document.querySelectorAll('.format-builder').forEach(el => el.style.display = 'none');

        // Show appropriate builder
        if (typeUI === 'carte_cliquable') {
            document.getElementById('builderCarte').style.display = 'block';
            this.initCarteBuilder();
        } else if (typeUI === 'question_ouverte') {
            document.getElementById('builderQuestionOuverte').style.display = 'block';
            this.initQuestionBuilder();
        } else if (typeUI === 'document_tableau') {
            document.getElementById('builderTableau').style.display = 'block';
            document.getElementById('documentSectionTableau').style.display = 'block';
            this.initTableBuilder();
        } else if (typeUI === 'document_mixte') {
            document.getElementById('builderDocumentMixte').style.display = 'block';
            this.initDocumentMixteBuilder();
        } else {
            // Default: tableau_saisie
            document.getElementById('builderTableau').style.display = 'block';
            document.getElementById('documentSectionTableau').style.display = 'none';
            this.initTableBuilder();
        }
    },

    // ========== CARTE CLIQUABLE BUILDER ==========
    initCarteBuilder() {
        this.carteBuilder = { imageUrl: '', marqueurs: [] };
        document.getElementById('carteImageUrl').value = '';
        document.getElementById('cartePreviewWrapper').style.display = 'none';
        document.getElementById('cartePreviewPlaceholder').style.display = 'block';
        this.renderMarqueursList();
    },

    loadCarteBuilderFromData(donnees) {
        this.carteBuilder = {
            imageUrl: donnees.image_url || '',
            marqueurs: (donnees.marqueurs || []).map(m => ({
                x: m.x,
                y: m.y,
                reponse: m.reponse || ''
            }))
        };
        document.getElementById('carteImageUrl').value = this.carteBuilder.imageUrl;
        if (this.carteBuilder.imageUrl) {
            this.updateCartePreview(this.carteBuilder.imageUrl);
        }
        this.renderMarqueursList();
    },

    updateCartePreview(url) {
        // Convert Google Drive share links to direct image URLs
        url = this.convertToDirectImageUrl(url);
        this.carteBuilder.imageUrl = url;

        const wrapper = document.getElementById('cartePreviewWrapper');
        const placeholder = document.getElementById('cartePreviewPlaceholder');
        const img = document.getElementById('cartePreviewImage');

        if (url) {
            img.src = url;
            img.onload = () => {
                wrapper.style.display = 'block';
                placeholder.style.display = 'none';
                this.renderCarteMarkers();
            };
            img.onerror = () => {
                wrapper.style.display = 'none';
                placeholder.style.display = 'block';
                placeholder.textContent = 'Erreur de chargement de l\'image';
            };
        } else {
            wrapper.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = 'Entrez une URL d\'image ci-dessus pour voir l\'apercu';
        }
    },

    // Convert Google Drive share links to direct image URLs
    convertToDirectImageUrl(url) {
        if (!url) return url;

        // Pattern: https://drive.google.com/file/d/FILE_ID/view...
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            const fileId = driveMatch[1];
            // Use lh3.googleusercontent.com format which works better for embedding
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }

        // Already a direct link or other URL format
        return url;
    },

    renderCarteMarkers() {
        const container = document.getElementById('cartePreviewMarkers');
        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => `
            <div class="carte-marker-preview"
                 style="left: ${m.x}%; top: ${m.y}%;"
                 title="Marqueur ${i + 1}: ${this.escapeHtml(m.reponse)}">
                ${i + 1}
            </div>
        `).join('');

        // Add click handler to image for adding markers
        const wrapper = document.getElementById('cartePreviewWrapper');
        wrapper.onclick = (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
            const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
            this.addMarqueur(parseFloat(x), parseFloat(y));
        };
    },

    addMarqueur(x, y) {
        this.carteBuilder.marqueurs.push({ x, y, reponse: '' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    addMarqueurManual() {
        this.carteBuilder.marqueurs.push({ x: 50, y: 50, reponse: '' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    removeMarqueur(index) {
        this.carteBuilder.marqueurs.splice(index, 1);
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    renderMarqueursList() {
        const container = document.getElementById('marqueursList');
        if (this.carteBuilder.marqueurs.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucun marqueur. Cliquez sur l\'image ou ajoutez manuellement.</div>';
            return;
        }

        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => `
            <div class="marqueur-item">
                <span class="marqueur-num">${i + 1}</span>
                <div class="marqueur-coords">X: ${m.x}% Y: ${m.y}%</div>
                <input type="text" class="form-input marqueur-reponse" data-index="${i}"
                       value="${this.escapeHtml(m.reponse)}" placeholder="Reponse attendue...">
                <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeMarqueur(${i})">&times;</button>
            </div>
        `).join('');

        // Add listeners for reponse inputs
        container.querySelectorAll('.marqueur-reponse').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.carteBuilder.marqueurs[idx].reponse = e.target.value;
            });
        });
    },

    buildDataFromCarteBuilder() {
        return {
            image_url: this.carteBuilder.imageUrl,
            marqueurs: this.carteBuilder.marqueurs.map((m, i) => ({
                id: i,
                x: m.x,
                y: m.y,
                reponse: m.reponse
            }))
        };
    },

    // ========== QUESTION OUVERTE BUILDER ==========
    initQuestionBuilder() {
        this.questionBuilder = {
            document: { type: 'texte', contenu: '' },
            questions: []
        };
        document.getElementById('docTypeQO').value = 'texte';
        document.getElementById('docContenuQO').value = '';
        this.renderQuestionsList();
    },

    loadQuestionBuilderFromData(donnees) {
        this.questionBuilder = {
            document: donnees.document || { type: 'texte', contenu: '' },
            questions: (donnees.questions || []).map(q => ({
                titre: q.titre || '',
                etapes: q.etapes || [],
                reponse_attendue: q.reponse_attendue || ''
            }))
        };
        document.getElementById('docTypeQO').value = this.questionBuilder.document.type || 'texte';
        document.getElementById('docContenuQO').value = this.questionBuilder.document.contenu || '';
        this.renderQuestionsList();
    },

    addQuestion() {
        this.questionBuilder.questions.push({
            titre: 'Question ' + (this.questionBuilder.questions.length + 1),
            etapes: [''],
            reponse_attendue: ''
        });
        this.renderQuestionsList();
    },

    removeQuestion(index) {
        this.questionBuilder.questions.splice(index, 1);
        this.renderQuestionsList();
    },

    addEtape(qIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.push('');
        this.renderQuestionsList();
    },

    removeEtape(qIndex, eIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.splice(eIndex, 1);
        this.renderQuestionsList();
    },

    readQuestionsFromDOM() {
        const container = document.getElementById('questionsList');
        const items = container.querySelectorAll('.question-item');

        this.questionBuilder.questions = Array.from(items).map((item, qIndex) => {
            const titre = item.querySelector('.question-titre').value;
            const etapes = Array.from(item.querySelectorAll('.etape-input')).map(inp => inp.value);
            const reponse = item.querySelector('.question-correction').value;
            return { titre, etapes, reponse_attendue: reponse };
        });
    },

    renderQuestionsList() {
        const container = document.getElementById('questionsList');
        if (this.questionBuilder.questions.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucune question. Cliquez sur "Ajouter une question".</div>';
            return;
        }

        container.innerHTML = this.questionBuilder.questions.map((q, qIndex) => `
            <div class="question-item" data-index="${qIndex}">
                <div class="question-header">
                    <span class="question-num">${qIndex + 1}</span>
                    <input type="text" class="form-input question-titre" value="${this.escapeHtml(q.titre)}" placeholder="Titre de la question">
                    <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeQuestion(${qIndex})">&times;</button>
                </div>
                <div class="question-etapes">
                    <label>Etapes/Guidage</label>
                    ${q.etapes.map((e, eIndex) => `
                        <div class="etape-row">
                            <input type="text" class="form-input etape-input" value="${this.escapeHtml(e)}" placeholder="Ex: Identifiez les elements cles...">
                            <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeEtape(${qIndex}, ${eIndex})">&times;</button>
                        </div>
                    `).join('')}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addEtape(${qIndex})">+ Etape</button>
                </div>
                <div class="question-correction-wrap">
                    <label>Correction attendue</label>
                    <textarea class="form-textarea question-correction" rows="3" placeholder="Reponse modele...">${this.escapeHtml(q.reponse_attendue)}</textarea>
                </div>
            </div>
        `).join('');
    },

    buildDataFromQuestionBuilder() {
        this.readQuestionsFromDOM();
        return {
            document: {
                type: document.getElementById('docTypeQO').value,
                contenu: document.getElementById('docContenuQO').value
            },
            questions: this.questionBuilder.questions
        };
    },

    // ========== DOCUMENT MIXTE BUILDER ==========
    initDocumentMixteBuilder() {
        this.mixteBuilder = {
            document: { actif: true, url: '', titre: '', legende: '' },
            tableau: { actif: false, titre: '', colonnes: [], lignes: [] },
            questions: { actif: false, liste: [] },
            sectionOrder: ['document', 'tableau', 'questions']
        };

        // Reset UI
        document.getElementById('toggleDocument').checked = true;
        document.getElementById('toggleTableau').checked = false;
        document.getElementById('toggleQuestions').checked = false;
        document.getElementById('docUrlMixte').value = '';
        document.getElementById('docTitreMixte').value = '';
        document.getElementById('docLegendeMixte').value = '';
        document.getElementById('tableauTitreMixte').value = '';
        document.getElementById('columnsBuilderMixte').innerHTML = '';
        document.getElementById('tableBuilderMixteHead').innerHTML = '';
        document.getElementById('tableBuilderMixteBody').innerHTML = '';
        document.getElementById('questionsListMixte').innerHTML = '';

        // Show/hide sections
        document.getElementById('sectionDocument').style.display = 'block';
        document.getElementById('sectionTableau').style.display = 'none';
        document.getElementById('sectionQuestions').style.display = 'none';

        // Add default column
        this.addColumnMixte();

        // Initialize drag and drop
        this.initMixteDragDrop();

        // Update preview
        this.updateMixtePreview();
    },

    loadDocumentMixteFromData(donnees) {
        if (!donnees) return;

        this.mixteBuilder = {
            document: donnees.document || { actif: true, url: '', titre: '', legende: '' },
            tableau: donnees.tableau || { actif: false, titre: '', colonnes: [], lignes: [] },
            questions: donnees.questions || { actif: false, liste: [] },
            sectionOrder: donnees.sectionOrder || ['document', 'tableau', 'questions']
        };

        // Set toggles
        document.getElementById('toggleDocument').checked = this.mixteBuilder.document.actif;
        document.getElementById('toggleTableau').checked = this.mixteBuilder.tableau.actif;
        document.getElementById('toggleQuestions').checked = this.mixteBuilder.questions.actif;

        // Set document fields
        document.getElementById('docUrlMixte').value = this.mixteBuilder.document.url || '';
        document.getElementById('docTitreMixte').value = this.mixteBuilder.document.titre || '';
        document.getElementById('docLegendeMixte').value = this.mixteBuilder.document.legende || '';

        // Set tableau fields
        document.getElementById('tableauTitreMixte').value = this.mixteBuilder.tableau.titre || '';
        this.renderMixteColumns();
        this.renderMixteTable();

        // Set questions
        this.renderMixteQuestions();

        // Show/hide sections based on toggles
        document.getElementById('sectionDocument').style.display = this.mixteBuilder.document.actif ? 'block' : 'none';
        document.getElementById('sectionTableau').style.display = this.mixteBuilder.tableau.actif ? 'block' : 'none';
        document.getElementById('sectionQuestions').style.display = this.mixteBuilder.questions.actif ? 'block' : 'none';

        // Reorder sections
        this.reorderMixteSections();

        this.initMixteDragDrop();
        this.updateMixtePreview();
    },

    onMixteToggle(section, checked) {
        this.mixteBuilder[section].actif = checked;

        const sectionEl = document.getElementById(`section${section.charAt(0).toUpperCase() + section.slice(1)}`);
        if (sectionEl) {
            sectionEl.style.display = checked ? 'block' : 'none';
        }

        // Add to order if not present
        if (checked && !this.mixteBuilder.sectionOrder.includes(section)) {
            this.mixteBuilder.sectionOrder.push(section);
        }

        this.updateMixtePreview();
    },

    initMixteDragDrop() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');

        sections.forEach(section => {
            const handle = section.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', (e) => {
                section.setAttribute('draggable', 'true');
            });

            section.addEventListener('dragstart', (e) => {
                section.classList.add('dragging');
                e.dataTransfer.setData('text/plain', section.dataset.section);
            });

            section.addEventListener('dragend', () => {
                section.classList.remove('dragging');
                section.removeAttribute('draggable');
                this.updateSectionOrder();
                this.updateMixtePreview();
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== section) {
                    section.classList.add('drag-over');
                    const rect = section.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, section);
                    } else {
                        container.insertBefore(dragging, section.nextSibling);
                    }
                }
            });

            section.addEventListener('dragleave', () => {
                section.classList.remove('drag-over');
            });

            section.addEventListener('drop', () => {
                section.classList.remove('drag-over');
            });
        });
    },

    updateSectionOrder() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');
        this.mixteBuilder.sectionOrder = Array.from(sections).map(s => s.dataset.section);
    },

    reorderMixteSections() {
        const container = document.getElementById('mixteBuilderSections');
        const order = this.mixteBuilder.sectionOrder;

        order.forEach(sectionName => {
            const section = container.querySelector(`[data-section="${sectionName}"]`);
            if (section) {
                container.appendChild(section);
            }
        });
    },

    // Columns for mixte tableau
    addColumnMixte() {
        const colonnes = this.mixteBuilder.tableau.colonnes;
        colonnes.push({ titre: '', editable: false });
        this.renderMixteColumns();
        this.renderMixteTable();
        this.updateMixtePreview();
    },

    removeColumnMixte(index) {
        this.mixteBuilder.tableau.colonnes.splice(index, 1);
        this.mixteBuilder.tableau.lignes.forEach(ligne => {
            ligne.cells.splice(index, 1);
        });
        this.renderMixteColumns();
        this.renderMixteTable();
        this.updateMixtePreview();
    },

    renderMixteColumns() {
        const container = document.getElementById('columnsBuilderMixte');
        container.innerHTML = this.mixteBuilder.tableau.colonnes.map((col, i) => `
            <div class="column-item-mixte">
                <span>${i + 1}</span>
                <input type="text" value="${this.escapeHtml(col.titre)}" placeholder="Titre colonne"
                       onchange="AdminBanquesExercices.updateMixteColumn(${i}, 'titre', this.value)">
                <label>
                    <input type="checkbox" ${col.editable ? 'checked' : ''}
                           onchange="AdminBanquesExercices.updateMixteColumn(${i}, 'editable', this.checked)">
                    Réponse élève
                </label>
                <button type="button" class="btn-icon" onclick="AdminBanquesExercices.removeColumnMixte(${i})">×</button>
            </div>
        `).join('');
    },

    updateMixteColumn(index, field, value) {
        this.mixteBuilder.tableau.colonnes[index][field] = value;
        if (field === 'titre') {
            this.renderMixteTable();
        }
        this.updateMixtePreview();
    },

    // Rows for mixte tableau
    addRowMixte() {
        const numCols = this.mixteBuilder.tableau.colonnes.length;
        this.mixteBuilder.tableau.lignes.push({
            cells: new Array(numCols).fill('')
        });
        this.renderMixteTable();
        this.updateMixtePreview();
    },

    removeRowMixte(index) {
        this.mixteBuilder.tableau.lignes.splice(index, 1);
        this.renderMixteTable();
        this.updateMixtePreview();
    },

    renderMixteTable() {
        const colonnes = this.mixteBuilder.tableau.colonnes;
        const lignes = this.mixteBuilder.tableau.lignes;

        document.getElementById('tableBuilderMixteHead').innerHTML = `
            <tr>
                ${colonnes.map(col => `<th>${this.escapeHtml(col.titre) || '...'}</th>`).join('')}
                <th style="width:40px"></th>
            </tr>
        `;

        document.getElementById('tableBuilderMixteBody').innerHTML = lignes.map((ligne, rowIdx) => `
            <tr>
                ${colonnes.map((col, colIdx) => `
                    <td class="${col.editable ? 'editable-cell' : ''}">
                        <input type="text" value="${this.escapeHtml(ligne.cells[colIdx] || '')}"
                               placeholder="${col.editable ? 'Réponse attendue' : '...'}"
                               onchange="AdminBanquesExercices.updateMixteCell(${rowIdx}, ${colIdx}, this.value)">
                    </td>
                `).join('')}
                <td>
                    <button type="button" class="btn-icon" onclick="AdminBanquesExercices.removeRowMixte(${rowIdx})">×</button>
                </td>
            </tr>
        `).join('');
    },

    updateMixteCell(rowIdx, colIdx, value) {
        this.mixteBuilder.tableau.lignes[rowIdx].cells[colIdx] = value;
        this.updateMixtePreview();
    },

    // Questions for mixte
    addQuestionMixte() {
        this.mixteBuilder.questions.liste.push({
            question: '',
            reponse_attendue: ''
        });
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    removeQuestionMixte(index) {
        this.mixteBuilder.questions.liste.splice(index, 1);
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    renderMixteQuestions() {
        const container = document.getElementById('questionsListMixte');
        container.innerHTML = this.mixteBuilder.questions.liste.map((q, i) => `
            <div class="question-item-mixte">
                <div class="question-header">
                    <span class="question-label">Question ${i + 1}</span>
                    <button type="button" class="btn-icon" onclick="AdminBanquesExercices.removeQuestionMixte(${i})">×</button>
                </div>
                <textarea placeholder="Texte de la question..."
                          onchange="AdminBanquesExercices.updateMixteQuestion(${i}, 'question', this.value)">${this.escapeHtml(q.question)}</textarea>
                <div class="question-label" style="margin-top:0.5rem;">Réponse attendue (pour correction)</div>
                <textarea placeholder="Réponse modèle..."
                          onchange="AdminBanquesExercices.updateMixteQuestion(${i}, 'reponse_attendue', this.value)">${this.escapeHtml(q.reponse_attendue)}</textarea>
            </div>
        `).join('');
    },

    updateMixteQuestion(index, field, value) {
        this.mixteBuilder.questions.liste[index][field] = value;
        this.updateMixtePreview();
    },

    // Convert various Google URLs to embeddable format
    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

        // Google Drive file: /file/d/ID/view
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

        // Google Docs: /document/d/ID/
        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            const docId = docsMatch[1];
            return {
                type: 'google_doc',
                id: docId,
                iframeUrl: `https://docs.google.com/document/d/${docId}/preview`
            };
        }

        // Google Sheets: /spreadsheets/d/ID/
        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            const sheetId = sheetsMatch[1];
            return {
                type: 'google_sheet',
                id: sheetId,
                iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/preview`
            };
        }

        // Google Slides: /presentation/d/ID/
        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            const slideId = slidesMatch[1];
            return {
                type: 'google_slide',
                id: slideId,
                iframeUrl: `https://docs.google.com/presentation/d/${slideId}/embed`
            };
        }

        // Regular URL - assume image
        return {
            type: 'direct_url',
            url: url,
            imageUrl: url
        };
    },

    updateMixtePreview() {
        const preview = document.getElementById('mixtePreviewContent');
        let html = '';

        // Get active sections in order
        const activeSections = this.mixteBuilder.sectionOrder.filter(s => this.mixteBuilder[s].actif);

        if (activeSections.length === 0) {
            preview.innerHTML = '<div class="preview-placeholder">Activez des sections pour voir l\'aperçu</div>';
            return;
        }

        activeSections.forEach(section => {
            if (section === 'document') {
                html += this.renderMixteDocumentPreview();
            } else if (section === 'tableau') {
                html += this.renderMixteTableauPreview();
            } else if (section === 'questions') {
                html += this.renderMixteQuestionsPreview();
            }
        });

        preview.innerHTML = html;
    },

    renderMixteDocumentPreview() {
        const doc = this.mixteBuilder.document;
        const url = document.getElementById('docUrlMixte').value;
        const titre = document.getElementById('docTitreMixte').value;
        const legende = document.getElementById('docLegendeMixte').value;

        // Parse legende for italics (*text*)
        const legendeHTML = legende.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        const converted = this.convertGoogleUrl(url);
        let contentHTML = '';

        if (!url) {
            contentHTML = '<div style="color:#999;font-style:italic;">Entrez une URL de document</div>';
        } else if (converted.type === 'drive_file') {
            // Try as image first, with iframe fallback
            contentHTML = `<img src="${converted.imageUrl}" alt="Document"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
        } else if (converted.iframeUrl) {
            contentHTML = `<iframe src="${converted.iframeUrl}"></iframe>`;
        } else {
            contentHTML = `<img src="${converted.imageUrl || url}" alt="Document"
                onerror="this.outerHTML='<div style=\\'color:#ef4444;\\'>Impossible de charger l\\'image</div>'">`;
        }

        return `
            <div class="preview-document">
                ${titre ? `<div class="preview-doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="preview-doc-content">${contentHTML}</div>
                ${legende ? `<div class="preview-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    renderMixteTableauPreview() {
        const titre = document.getElementById('tableauTitreMixte').value;
        const colonnes = this.mixteBuilder.tableau.colonnes;
        const lignes = this.mixteBuilder.tableau.lignes;

        if (colonnes.length === 0) {
            return '<div class="preview-tableau"><div class="preview-tableau-header">Tableau</div><div style="padding:1rem;color:#999;">Ajoutez des colonnes</div></div>';
        }

        return `
            <div class="preview-tableau">
                <div class="preview-tableau-header">${this.escapeHtml(titre) || 'À COMPLÉTER'}</div>
                <table>
                    <thead>
                        <tr>
                            ${colonnes.map(col => `<th>${this.escapeHtml(col.titre) || '...'}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${lignes.map(ligne => `
                            <tr>
                                ${colonnes.map((col, i) => `
                                    <td class="${col.editable ? 'editable-cell' : ''}">
                                        ${col.editable ? '<em style="color:#999;">Réponse élève</em>' : this.escapeHtml(ligne.cells[i] || '')}
                                    </td>
                                `).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderMixteQuestionsPreview() {
        const questions = this.mixteBuilder.questions.liste;

        if (questions.length === 0) {
            return '<div class="preview-questions"><div class="preview-questions-header">Questions</div><div style="padding:1rem;color:#999;">Ajoutez des questions</div></div>';
        }

        return `
            <div class="preview-questions">
                <div class="preview-questions-header">Questions ouvertes</div>
                ${questions.map((q, i) => `
                    <div class="preview-question-item">
                        <div class="preview-question-text">${i + 1}. ${this.escapeHtml(q.question) || 'Question...'}</div>
                        <div class="preview-question-answer">Zone de réponse élève</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    buildDataFromDocumentMixte() {
        // Read current values from DOM
        this.mixteBuilder.document.url = document.getElementById('docUrlMixte').value;
        this.mixteBuilder.document.titre = document.getElementById('docTitreMixte').value;
        this.mixteBuilder.document.legende = document.getElementById('docLegendeMixte').value;
        this.mixteBuilder.tableau.titre = document.getElementById('tableauTitreMixte').value;

        return {
            document: this.mixteBuilder.document,
            tableau: this.mixteBuilder.tableau,
            questions: this.mixteBuilder.questions,
            sectionOrder: this.mixteBuilder.sectionOrder
        };
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
