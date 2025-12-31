/**
 * Admin Méthodologie - Gestion des compétences et étapes
 */

const AdminMethodologie = {
    categories: [],
    competences: [],
    etapes: [],

    editingItem: null,
    editingType: null, // 'category', 'competence', 'etape'
    deletingItem: null,
    deletingType: null,

    // Icônes disponibles
    icons: ['📄', '📋', '📝', '📊', '📈', '🔍', '✍️', '📖', '🗺️', '⏳', '🌍', '📅', '⏰', '📁', '💡', '🎯', '✅', '⭐'],
    colors: ['blue', 'purple', 'teal', 'orange', 'green', 'pink'],

    async init() {
        try {
            await this.loadData();
            this.renderStats();
            this.renderCategories();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    async loadData() {
        const [categories, competences, etapes] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_CATEGORIES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_COMPETENCES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_ETAPES)
        ]);

        this.categories = (categories || []).sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
        this.competences = (competences || []).sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
        this.etapes = (etapes || []).sort((a, b) => {
            const nA = parseInt(a.niveau) || 1;
            const nB = parseInt(b.niveau) || 1;
            if (nA !== nB) return nA - nB;
            return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
        });
    },

    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('main-content');
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';
    },

    showError(message) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.innerHTML = `
                <div style="color: #ef4444; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <p>${message}</p>
                    <button onclick="AdminMethodologie.init()" class="btn btn-primary" style="margin-top: 16px;">Réessayer</button>
                </div>
            `;
        }
    },

    // ========== STATS ==========
    renderStats() {
        document.getElementById('totalCategories').textContent = this.categories.length;
        document.getElementById('totalCompetences').textContent = this.competences.length;
        document.getElementById('totalEtapes').textContent = this.etapes.length;

        const niveaux = [...new Set(this.etapes.map(e => parseInt(e.niveau) || 1))];
        document.getElementById('totalNiveaux').textContent = niveaux.length;
    },

    // ========== RENDER CATEGORIES ==========
    renderCategories() {
        const container = document.getElementById('categories-container');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <h3>Aucune catégorie</h3>
                    <p>Créez votre première catégorie pour commencer</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.categories.map(cat => {
            const competences = this.competences.filter(c => c.categorie_id === cat.id);
            const etapesCount = this.etapes.filter(e =>
                competences.some(c => c.id === e.competence_id)
            ).length;

            return `
                <div class="category-card" data-id="${cat.id}">
                    <div class="category-header" onclick="AdminMethodologie.toggleCategory('${cat.id}')">
                        <div class="category-icon ${cat.couleur || 'blue'}">${cat.icon || '📁'}</div>
                        <div class="category-info">
                            <h3 class="category-title">${this.escapeHtml(cat.nom)}</h3>
                            <p class="category-meta">${competences.length} compétence(s) • ${etapesCount} étape(s)</p>
                        </div>
                        <div class="category-actions">
                            <button class="action-btn edit" onclick="event.stopPropagation(); AdminMethodologie.editCategory('${cat.id}')" title="Modifier">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="action-btn delete" onclick="event.stopPropagation(); AdminMethodologie.confirmDelete('category', '${cat.id}')" title="Supprimer">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                            <button class="chevron-btn">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="category-content">
                        <div class="competences-list">
                            ${competences.map(comp => this.renderCompetence(comp)).join('')}
                            <button class="add-competence-btn" onclick="AdminMethodologie.addCompetence('${cat.id}')">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Ajouter une compétence
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCompetence(comp) {
        const etapes = this.etapes.filter(e => e.competence_id === comp.id);
        const niveaux = [...new Set(etapes.map(e => parseInt(e.niveau) || 1))].length;

        return `
            <div class="competence-card" data-id="${comp.id}">
                <div class="competence-header" onclick="AdminMethodologie.toggleCompetence('${comp.id}')">
                    <div class="competence-icon">${comp.icon || '📋'}</div>
                    <div class="competence-info">
                        <h4 class="competence-title">${this.escapeHtml(comp.titre)}</h4>
                        <p class="competence-stats">${niveaux} niveau(x) • ${etapes.length} étape(s)</p>
                    </div>
                    <div class="competence-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); AdminMethodologie.editCompetence('${comp.id}')" title="Modifier">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" onclick="event.stopPropagation(); AdminMethodologie.confirmDelete('competence', '${comp.id}')" title="Supprimer">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        <button class="chevron-btn">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="competence-content">
                    <div class="etapes-list">
                        ${etapes.map(etape => this.renderEtape(etape)).join('')}
                        <button class="add-etape-btn" onclick="AdminMethodologie.addEtape('${comp.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            Ajouter une étape
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderEtape(etape) {
        const niveau = parseInt(etape.niveau) || 1;
        const ordre = parseInt(etape.ordre) || 1;
        const hasVideo = !!etape.video_url;
        const hasDocs = !!etape.documents;
        const hasBex = !!etape.bex_id;

        return `
            <div class="etape-item" data-id="${etape.id}">
                <span class="etape-order">${ordre}</span>
                <span class="etape-niveau n${niveau}">N${niveau}</span>
                <span class="etape-title">${this.escapeHtml(etape.titre)}</span>
                <div class="etape-indicators">
                    <span class="etape-indicator ${hasVideo ? 'active' : ''}" title="Vidéo">🎬</span>
                    <span class="etape-indicator ${hasDocs ? 'active' : ''}" title="Documents">📄</span>
                    <span class="etape-indicator ${hasBex ? 'active' : ''}" title="BEX">⭐</span>
                </div>
                <div class="etape-actions">
                    <button class="action-btn edit" onclick="AdminMethodologie.editEtape('${etape.id}')" title="Modifier">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" onclick="AdminMethodologie.confirmDelete('etape', '${etape.id}')" title="Supprimer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    // ========== TOGGLE ==========
    toggleCategory(catId) {
        const card = document.querySelector(`.category-card[data-id="${catId}"]`);
        if (card) card.classList.toggle('open');
    },

    toggleCompetence(compId) {
        const card = document.querySelector(`.competence-card[data-id="${compId}"]`);
        if (card) card.classList.toggle('open');
    },

    // ========== CATEGORY CRUD ==========
    openAddCategoryModal() {
        this.editingItem = null;
        this.editingType = 'category';

        document.getElementById('categoryModalTitle').textContent = 'Nouvelle catégorie';
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryNom').value = '';
        document.getElementById('categoryDescription').value = '';

        this.renderIconSelector('categoryIconSelector', '📁');
        this.renderColorSelector('categoryColorSelector', 'blue');

        document.getElementById('categoryModal').classList.remove('hidden');
    },

    editCategory(catId) {
        const category = this.categories.find(c => c.id === catId);
        if (!category) return;

        this.editingItem = category;
        this.editingType = 'category';

        document.getElementById('categoryModalTitle').textContent = 'Modifier la catégorie';
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryNom').value = category.nom || '';
        document.getElementById('categoryDescription').value = category.description || '';

        this.renderIconSelector('categoryIconSelector', category.icon || '📁');
        this.renderColorSelector('categoryColorSelector', category.couleur || 'blue');

        document.getElementById('categoryModal').classList.remove('hidden');
    },

    async saveCategory() {
        const nom = document.getElementById('categoryNom').value.trim();
        const description = document.getElementById('categoryDescription').value.trim();
        const icon = document.querySelector('#categoryIconSelector .icon-option.selected')?.textContent || '📁';
        const couleur = document.querySelector('#categoryColorSelector .color-option.selected')?.dataset.color || 'blue';

        if (!nom) {
            alert('Veuillez entrer un nom');
            return;
        }

        const btn = document.getElementById('saveCategoryBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Enregistrement...';

        try {
            const data = { nom, description, icon, couleur };

            if (this.editingItem) {
                data.id = this.editingItem.id;
                data.ordre = this.editingItem.ordre;
                await this.callWebApp('updateMethodologieCategorie', data);
            } else {
                data.ordre = String(this.categories.length + 1);
                await this.callWebApp('createMethodologieCategorie', data);
            }

            await this.loadData();
            this.renderStats();
            this.renderCategories();
            this.closeCategoryModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Enregistrer';
        }
    },

    closeCategoryModal() {
        document.getElementById('categoryModal').classList.add('hidden');
        this.editingItem = null;
    },

    // ========== COMPETENCE CRUD ==========
    addCompetence(categorieId) {
        this.editingItem = null;
        this.editingType = 'competence';

        document.getElementById('competenceModalTitle').textContent = 'Nouvelle compétence';
        document.getElementById('competenceId').value = '';
        document.getElementById('competenceCategorieId').value = categorieId;
        document.getElementById('competenceTitre').value = '';
        document.getElementById('competenceDescription').value = '';

        this.renderIconSelector('competenceIconSelector', '📋');

        document.getElementById('competenceModal').classList.remove('hidden');
    },

    editCompetence(compId) {
        const competence = this.competences.find(c => c.id === compId);
        if (!competence) return;

        this.editingItem = competence;
        this.editingType = 'competence';

        document.getElementById('competenceModalTitle').textContent = 'Modifier la compétence';
        document.getElementById('competenceId').value = competence.id;
        document.getElementById('competenceCategorieId').value = competence.categorie_id;
        document.getElementById('competenceTitre').value = competence.titre || '';
        document.getElementById('competenceDescription').value = competence.description || '';

        this.renderIconSelector('competenceIconSelector', competence.icon || '📋');

        document.getElementById('competenceModal').classList.remove('hidden');
    },

    async saveCompetence() {
        const titre = document.getElementById('competenceTitre').value.trim();
        const description = document.getElementById('competenceDescription').value.trim();
        const categorieId = document.getElementById('competenceCategorieId').value;
        const icon = document.querySelector('#competenceIconSelector .icon-option.selected')?.textContent || '📋';

        if (!titre) {
            alert('Veuillez entrer un titre');
            return;
        }

        const btn = document.getElementById('saveCompetenceBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Enregistrement...';

        try {
            const data = { titre, description, icon, categorie_id: categorieId };

            if (this.editingItem) {
                data.id = this.editingItem.id;
                data.ordre = this.editingItem.ordre;
                await this.callWebApp('updateMethodologieCompetence', data);
            } else {
                const sameCategory = this.competences.filter(c => c.categorie_id === categorieId);
                data.ordre = String(sameCategory.length + 1);
                await this.callWebApp('createMethodologieCompetence', data);
            }

            await this.loadData();
            this.renderStats();
            this.renderCategories();
            this.closeCompetenceModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Enregistrer';
        }
    },

    closeCompetenceModal() {
        document.getElementById('competenceModal').classList.add('hidden');
        this.editingItem = null;
    },

    // ========== ETAPE CRUD ==========
    addEtape(competenceId) {
        this.editingItem = null;
        this.editingType = 'etape';

        document.getElementById('etapeModalTitle').textContent = 'Nouvelle étape';
        document.getElementById('etapeId').value = '';
        document.getElementById('etapeCompetenceId').value = competenceId;
        document.getElementById('etapeTitre').value = '';
        document.getElementById('etapeNiveau').value = '1';
        document.getElementById('etapeNiveauTitre').value = '';
        document.getElementById('etapeVideoUrl').value = '';
        document.getElementById('etapeDocuments').value = '';
        document.getElementById('etapeContenu').value = '';
        document.getElementById('etapeBexId').value = '';
        document.getElementById('etapeBexTitre').value = '';

        document.getElementById('etapeModal').classList.remove('hidden');
    },

    editEtape(etapeId) {
        const etape = this.etapes.find(e => e.id === etapeId);
        if (!etape) return;

        this.editingItem = etape;
        this.editingType = 'etape';

        document.getElementById('etapeModalTitle').textContent = 'Modifier l\'étape';
        document.getElementById('etapeId').value = etape.id;
        document.getElementById('etapeCompetenceId').value = etape.competence_id;
        document.getElementById('etapeTitre').value = etape.titre || '';
        document.getElementById('etapeNiveau').value = etape.niveau || '1';
        document.getElementById('etapeNiveauTitre').value = etape.niveau_titre || '';
        document.getElementById('etapeVideoUrl').value = etape.video_url || '';
        document.getElementById('etapeDocuments').value = etape.documents || '';
        document.getElementById('etapeContenu').value = etape.contenu_html || '';
        document.getElementById('etapeBexId').value = etape.bex_id || '';
        document.getElementById('etapeBexTitre').value = etape.bex_titre || '';

        document.getElementById('etapeModal').classList.remove('hidden');
    },

    async saveEtape() {
        const titre = document.getElementById('etapeTitre').value.trim();
        const competenceId = document.getElementById('etapeCompetenceId').value;
        const niveau = document.getElementById('etapeNiveau').value;
        const niveauTitre = document.getElementById('etapeNiveauTitre').value.trim();
        const videoUrl = document.getElementById('etapeVideoUrl').value.trim();
        const documents = document.getElementById('etapeDocuments').value.trim();
        const contenuHtml = document.getElementById('etapeContenu').value.trim();
        const bexId = document.getElementById('etapeBexId').value.trim();
        const bexTitre = document.getElementById('etapeBexTitre').value.trim();

        if (!titre) {
            alert('Veuillez entrer un titre');
            return;
        }

        const btn = document.getElementById('saveEtapeBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Enregistrement...';

        try {
            const data = {
                titre,
                competence_id: competenceId,
                niveau,
                niveau_titre: niveauTitre,
                video_url: videoUrl,
                documents,
                contenu_html: contenuHtml,
                bex_id: bexId,
                bex_titre: bexTitre
            };

            if (this.editingItem) {
                data.id = this.editingItem.id;
                data.ordre = this.editingItem.ordre;
                await this.callWebApp('updateMethodologieEtape', data);
            } else {
                const sameCompetence = this.etapes.filter(e =>
                    e.competence_id === competenceId && e.niveau === niveau
                );
                data.ordre = String(sameCompetence.length + 1);
                await this.callWebApp('createMethodologieEtape', data);
            }

            await this.loadData();
            this.renderStats();
            this.renderCategories();
            this.closeEtapeModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Enregistrer';
        }
    },

    closeEtapeModal() {
        document.getElementById('etapeModal').classList.add('hidden');
        this.editingItem = null;
    },

    // ========== DELETE ==========
    confirmDelete(type, itemId) {
        let item, title, text;

        if (type === 'category') {
            item = this.categories.find(c => c.id === itemId);
            const comps = this.competences.filter(c => c.categorie_id === itemId);
            title = 'Supprimer cette catégorie ?';
            text = comps.length > 0
                ? `"${item?.nom}" et ses ${comps.length} compétence(s) seront supprimées.`
                : `"${item?.nom}"`;
        } else if (type === 'competence') {
            item = this.competences.find(c => c.id === itemId);
            const etapes = this.etapes.filter(e => e.competence_id === itemId);
            title = 'Supprimer cette compétence ?';
            text = etapes.length > 0
                ? `"${item?.titre}" et ses ${etapes.length} étape(s) seront supprimées.`
                : `"${item?.titre}"`;
        } else if (type === 'etape') {
            item = this.etapes.find(e => e.id === itemId);
            title = 'Supprimer cette étape ?';
            text = `"${item?.titre}"`;
        }

        this.deletingItem = itemId;
        this.deletingType = type;

        document.getElementById('deleteTitle').textContent = title;
        document.getElementById('deleteText').textContent = text;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    async executeDelete() {
        if (!this.deletingItem || !this.deletingType) return;

        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Suppression...';

        try {
            const actionMap = {
                category: 'deleteMethodologieCategorie',
                competence: 'deleteMethodologieCompetence',
                etape: 'deleteMethodologieEtape'
            };

            await this.callWebApp(actionMap[this.deletingType], { id: this.deletingItem });

            await this.loadData();
            this.renderStats();
            this.renderCategories();
            this.closeDeleteModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Supprimer';
        }
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
        this.deletingItem = null;
        this.deletingType = null;
    },

    // ========== SELECTORS ==========
    renderIconSelector(containerId, selected) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = this.icons.map(icon => `
            <div class="icon-option ${icon === selected ? 'selected' : ''}" onclick="AdminMethodologie.selectIcon('${containerId}', '${icon}')">${icon}</div>
        `).join('');
    },

    selectIcon(containerId, icon) {
        const container = document.getElementById(containerId);
        container.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
        container.querySelector(`.icon-option:nth-child(${this.icons.indexOf(icon) + 1})`).classList.add('selected');
    },

    renderColorSelector(containerId, selected) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = this.colors.map(color => `
            <div class="color-option ${color} ${color === selected ? 'selected' : ''}"
                 data-color="${color}"
                 onclick="AdminMethodologie.selectColor('${containerId}', '${color}')"></div>
        `).join('');
    },

    selectColor(containerId, color) {
        const container = document.getElementById(containerId);
        container.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        container.querySelector(`.color-option[data-color="${color}"]`).classList.add('selected');
    },

    // ========== EVENTS ==========
    bindEvents() {
        // Category modal
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.openAddCategoryModal());
        document.getElementById('closeCategoryModal')?.addEventListener('click', () => this.closeCategoryModal());
        document.getElementById('cancelCategoryBtn')?.addEventListener('click', () => this.closeCategoryModal());
        document.getElementById('saveCategoryBtn')?.addEventListener('click', () => this.saveCategory());

        // Competence modal
        document.getElementById('closeCompetenceModal')?.addEventListener('click', () => this.closeCompetenceModal());
        document.getElementById('cancelCompetenceBtn')?.addEventListener('click', () => this.closeCompetenceModal());
        document.getElementById('saveCompetenceBtn')?.addEventListener('click', () => this.saveCompetence());

        // Etape modal
        document.getElementById('closeEtapeModal')?.addEventListener('click', () => this.closeEtapeModal());
        document.getElementById('cancelEtapeBtn')?.addEventListener('click', () => this.closeEtapeModal());
        document.getElementById('saveEtapeBtn')?.addEventListener('click', () => this.saveEtape());

        // Delete modal
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.executeDelete());

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.add('hidden');
            });
        });
    },

    // ========== UTILS ==========
    async callWebApp(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const timeout = setTimeout(() => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Timeout'));
            }, 30000);

            window[callbackName] = (response) => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);

                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur inconnue'));
                }
            };

            const params = new URLSearchParams({
                action,
                callback: callbackName,
                data: JSON.stringify(data)
            });

            const script = document.createElement('script');
            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            document.body.appendChild(script);
        });
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.AdminMethodologie = AdminMethodologie;
