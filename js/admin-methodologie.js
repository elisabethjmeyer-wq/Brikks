/**
 * Admin Méthodologie - Structure arborescente flexible
 */

const AdminMethodologie = {
    items: [],
    progression: [],
    bexConfig: [],
    editingItem: null,
    deletingItem: null,
    currentRessources: [],

    icons: ['📁', '📄', '📋', '📝', '📊', '📈', '🔍', '✍️', '📖', '🗺️', '🌍', '📅', '⏰', '💡', '🎯', '✅', '⭐', '🎬'],
    colors: ['blue', 'purple', 'teal', 'orange', 'green', 'pink'],
    ressourceTypes: [
        { value: 'video', label: 'Vidéo', icon: '🎬' },
        { value: 'document', label: 'Document', icon: '📄' },
        { value: 'image', label: 'Image', icon: '🖼️' },
        { value: 'link', label: 'Lien', icon: '🔗' }
    ],

    async init() {
        try {
            await this.loadData();
            this.renderStats();
            this.renderTree();
            this.populateBexSelects();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    async loadData() {
        const [items, progression, bexConfig] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.PROGRESSION_METHODOLOGIE),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.BEX_CONFIG)
        ]);

        // Filtrer les items sans ID valide et trier par ordre
        this.items = (items || [])
            .filter(item => {
                if (!item.id || item.id.trim() === '') {
                    console.warn('Item méthodologie ignoré car sans ID:', item);
                    return false;
                }
                return true;
            })
            .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

        this.progression = progression || [];
        this.bexConfig = bexConfig || [];

        console.log('Items méthodologie chargés:', this.items.length);
        console.log('BEX config chargé:', this.bexConfig.length);
    },

    populateBexSelects() {
        const bexSelect = document.getElementById('itemBexBank');
        const compSelect = document.getElementById('itemCompetenceBank');

        if (!bexSelect || !compSelect) return;

        // Filtrer par type
        const bexSavoirFaire = this.bexConfig.filter(b => b.type === 'savoir-faire');
        const bexCompetences = this.bexConfig.filter(b => b.type === 'competences');

        // Remplir le select BEX Savoir-faire
        bexSelect.innerHTML = '<option value="">-- Aucune --</option>';
        bexSavoirFaire.forEach(bex => {
            const option = document.createElement('option');
            option.value = bex.id;
            option.textContent = bex.titre;
            bexSelect.appendChild(option);
        });

        // Remplir le select BEX Compétences
        compSelect.innerHTML = '<option value="">-- Aucune --</option>';
        bexCompetences.forEach(bex => {
            const option = document.createElement('option');
            option.value = bex.id;
            option.textContent = bex.titre;
            compSelect.appendChild(option);
        });

        console.log('Selects BEX remplis:', bexSavoirFaire.length, 'SF,', bexCompetences.length, 'Comp');
    },

    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('methodologie-content');
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

    // ========== HELPERS ==========
    getRootItems() {
        return this.items.filter(item => !item.parent_id || item.parent_id === '');
    },

    getChildren(parentId) {
        if (!parentId) return [];
        return this.items.filter(item => item.parent_id === parentId && item.id !== parentId)
            .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
    },

    hasChildren(itemId) {
        return this.items.some(item => item.parent_id === itemId);
    },

    isContent(item) {
        // Un élément est un "contenu" s'il a une vidéo ou une fiche
        return !!item.video_url || !!item.fiche_url;
    },

    getContentTypeLabel(item) {
        if (item.video_url) return { label: 'Vidéo', icon: '🎬', class: 'badge-video' };
        if (item.fiche_url) return { label: 'Fiche', icon: '📄', class: 'badge-fiche' };
        return null;
    },

    getDepth(itemId, depth = 0) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || !item.parent_id) return depth;
        return this.getDepth(item.parent_id, depth + 1);
    },

    countDescendants(itemId, visited = new Set()) {
        if (visited.has(itemId)) return 0; // Éviter les boucles infinies
        visited.add(itemId);
        const children = this.getChildren(itemId);
        let count = children.length;
        children.forEach(child => {
            count += this.countDescendants(child.id, visited);
        });
        return count;
    },

    getPath(itemId) {
        const path = [];
        let current = this.items.find(i => i.id === itemId);
        while (current) {
            path.unshift(current);
            current = current.parent_id ? this.items.find(i => i.id === current.parent_id) : null;
        }
        return path;
    },

    // ========== STATS ==========
    renderStats() {
        const rootItems = this.getRootItems();
        const contentItems = this.items.filter(item => this.isContent(item));
        const maxDepth = Math.max(0, ...this.items.map(item => this.getDepth(item.id)));

        document.getElementById('totalCategories').textContent = rootItems.length;
        document.getElementById('totalCompetences').textContent = this.items.length;
        document.getElementById('totalEtapes').textContent = contentItems.length;
        document.getElementById('totalNiveaux').textContent = maxDepth + 1;
    },

    // ========== RENDER TREE ==========
    renderTree() {
        const container = document.getElementById('categories-container');
        if (!container) return;

        const rootItems = this.getRootItems();

        if (rootItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <h3>Aucun élément</h3>
                    <p>Créez votre premier élément pour commencer</p>
                </div>
            `;
            return;
        }

        container.innerHTML = rootItems.map(item => this.renderItem(item, 0)).join('');
    },

    renderItem(item, depth, rendered = new Set()) {
        // Protection contre les boucles infinies
        if (rendered.has(item.id) || depth > 10) return '';
        rendered.add(item.id);

        const children = this.getChildren(item.id);
        const hasChildren = children.length > 0;
        const isContent = this.isContent(item);
        const contentType = this.getContentTypeLabel(item);
        const descendantCount = this.countDescendants(item.id);

        const depthClass = `depth-${Math.min(depth, 3)}`;
        const typeIcon = contentType ? contentType.icon : (hasChildren ? '📁' : '📄');

        return `
            <div class="tree-item ${depthClass}" data-id="${item.id}" data-depth="${depth}">
                <div class="tree-item-header" onclick="AdminMethodologie.toggleItem('${item.id}')">
                    <div class="tree-item-left">
                        ${hasChildren ? `
                            <button class="tree-toggle">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"/>
                                </svg>
                            </button>
                        ` : '<span class="tree-toggle-placeholder"></span>'}
                        <span class="tree-item-icon ${item.couleur || ''}">${item.icon || typeIcon}</span>
                        <div class="tree-item-info">
                            <span class="tree-item-title">${this.escapeHtml(item.titre)}</span>
                            ${item.description ? `<span class="tree-item-desc">${this.escapeHtml(item.description).substring(0, 50)}${item.description.length > 50 ? '...' : ''}</span>` : ''}
                        </div>
                    </div>
                    <div class="tree-item-right">
                        ${contentType ? `<span class="badge ${contentType.class}">${contentType.label}</span>` : ''}
                        ${hasChildren ? `<span class="badge badge-count">${descendantCount} élément${descendantCount > 1 ? 's' : ''}</span>` : ''}
                        <div class="tree-item-actions">
                            <button class="action-btn add" onclick="event.stopPropagation(); AdminMethodologie.openAddModal('${item.id}')" title="Ajouter un sous-élément">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                            </button>
                            <button class="action-btn edit" onclick="event.stopPropagation(); AdminMethodologie.editItem('${item.id}')" title="Modifier">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                            <button class="action-btn delete" onclick="event.stopPropagation(); AdminMethodologie.confirmDelete('${item.id}')" title="Supprimer">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                ${hasChildren ? `
                    <div class="tree-item-children">
                        ${children.map(child => this.renderItem(child, depth + 1, new Set(rendered))).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    toggleItem(itemId) {
        const element = document.querySelector(`.tree-item[data-id="${itemId}"]`);
        if (element) {
            element.classList.toggle('collapsed');
        }
    },

    // ========== ADD/EDIT MODAL ==========
    openAddModal(parentId = null) {
        this.editingItem = null;
        this.currentRessources = [];

        document.getElementById('itemModalTitle').textContent = parentId ? 'Ajouter un sous-élément' : 'Nouvel élément';
        document.getElementById('itemId').value = '';
        document.getElementById('itemParentId').value = parentId || '';
        document.getElementById('itemTitre').value = '';
        document.getElementById('itemDescription').value = '';
        document.getElementById('itemVideoUrl').value = '';
        document.getElementById('itemFicheUrl').value = '';
        document.getElementById('itemBexBank').value = '';
        document.getElementById('itemCompetenceBank').value = '';

        // Réinitialiser le type de contenu
        this.setContentType('');

        // Réinitialiser les ressources
        this.renderRessourcesList();

        // Afficher le parent si existe
        const parentInfo = document.getElementById('parentInfo');
        if (parentId) {
            const parent = this.items.find(i => i.id === parentId);
            if (parent) {
                parentInfo.innerHTML = `<span class="parent-badge">Dans : ${parent.icon || '📁'} ${this.escapeHtml(parent.titre)}</span>`;
                parentInfo.style.display = 'block';
            }
        } else {
            parentInfo.style.display = 'none';
        }

        this.renderIconSelector('itemIconSelector', '📁');
        this.renderColorSelector('itemColorSelector', 'blue');

        document.getElementById('itemModal').classList.remove('hidden');
    },

    setContentType(type) {
        // Sélectionner le bon radio button
        const radios = document.querySelectorAll('input[name="contentType"]');
        radios.forEach(radio => {
            radio.checked = radio.value === type;
        });

        // Afficher/masquer les sections
        const videoSection = document.getElementById('videoSection');
        const ficheSection = document.getElementById('ficheSection');

        if (videoSection) videoSection.style.display = type === 'video' ? 'block' : 'none';
        if (ficheSection) ficheSection.style.display = type === 'fiche' ? 'block' : 'none';
    },

    getContentType() {
        const selected = document.querySelector('input[name="contentType"]:checked');
        return selected ? selected.value : '';
    },

    editItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        this.editingItem = item;

        document.getElementById('itemModalTitle').textContent = 'Modifier l\'élément';
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemParentId').value = item.parent_id || '';
        document.getElementById('itemTitre').value = item.titre || '';
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemVideoUrl').value = item.video_url || '';
        document.getElementById('itemFicheUrl').value = item.fiche_url || '';
        document.getElementById('itemBexBank').value = item.bex_bank || '';
        document.getElementById('itemCompetenceBank').value = item.competence_bank || '';

        // Déterminer le type de contenu
        let contentType = '';
        if (item.video_url) {
            contentType = 'video';
        } else if (item.fiche_url) {
            contentType = 'fiche';
        }
        this.setContentType(contentType);

        // Charger les ressources existantes
        this.currentRessources = this.parseRessources(item.ressources);
        this.renderRessourcesList();

        // Afficher le parent si existe
        const parentInfo = document.getElementById('parentInfo');
        if (item.parent_id) {
            const parent = this.items.find(i => i.id === item.parent_id);
            if (parent) {
                parentInfo.innerHTML = `<span class="parent-badge">Dans : ${parent.icon || '📁'} ${this.escapeHtml(parent.titre)}</span>`;
                parentInfo.style.display = 'block';
            }
        } else {
            parentInfo.style.display = 'none';
        }

        this.renderIconSelector('itemIconSelector', item.icon || '📁');
        this.renderColorSelector('itemColorSelector', item.couleur || 'blue');

        document.getElementById('itemModal').classList.remove('hidden');
    },

    async saveItem() {
        const titre = document.getElementById('itemTitre').value.trim();
        const description = document.getElementById('itemDescription').value.trim();
        const parentId = document.getElementById('itemParentId').value.trim();
        const contentType = this.getContentType();
        const videoUrl = contentType === 'video' ? document.getElementById('itemVideoUrl').value.trim() : '';
        const ficheUrl = contentType === 'fiche' ? document.getElementById('itemFicheUrl').value.trim() : '';
        const bexBank = document.getElementById('itemBexBank').value.trim();
        const competenceBank = document.getElementById('itemCompetenceBank').value.trim();
        const icon = document.querySelector('#itemIconSelector .icon-option.selected')?.textContent || '📁';
        const couleur = document.querySelector('#itemColorSelector .color-option.selected')?.dataset.color || 'blue';

        if (!titre) {
            alert('Veuillez entrer un titre');
            return;
        }

        // Validation selon le type
        if (contentType === 'video' && !videoUrl) {
            alert('Veuillez entrer une URL vidéo');
            return;
        }
        if (contentType === 'fiche' && !ficheUrl) {
            alert('Veuillez entrer une URL pour la fiche méthode');
            return;
        }

        // Récupérer les ressources depuis le formulaire
        this.collectRessourcesFromForm();

        const btn = document.getElementById('saveItemBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Enregistrement...';

        try {
            const data = {
                titre,
                description,
                parent_id: parentId,
                icon,
                couleur,
                type_contenu: contentType,
                video_url: videoUrl,
                fiche_url: ficheUrl,
                bex_bank: bexBank,
                competence_bank: competenceBank,
                ressources: JSON.stringify(this.currentRessources)
            };

            if (this.editingItem) {
                data.id = this.editingItem.id;
                data.ordre = this.editingItem.ordre;
                await this.callWebApp('updateMethodologie', data);
            } else {
                // Calculer l'ordre pour le nouveau item
                const siblings = parentId
                    ? this.getChildren(parentId)
                    : this.getRootItems();
                data.ordre = String(siblings.length + 1);
                await this.callWebApp('createMethodologie', data);
            }

            await this.loadData();
            this.renderStats();
            this.renderTree();
            this.closeItemModal();
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Enregistrer';
        }
    },

    closeItemModal() {
        document.getElementById('itemModal').classList.add('hidden');
        this.editingItem = null;
        this.currentRessources = [];
    },

    // ========== RESSOURCES ==========
    parseRessources(ressourcesStr) {
        if (!ressourcesStr) return [];
        try {
            const parsed = JSON.parse(ressourcesStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    renderRessourcesList() {
        const container = document.getElementById('ressourcesList');
        if (!container) return;

        if (this.currentRessources.length === 0) {
            container.innerHTML = '<div class="ressources-empty">Aucune ressource supplémentaire</div>';
            return;
        }

        container.innerHTML = this.currentRessources.map((ressource, index) => `
            <div class="ressource-item" data-index="${index}" draggable="true">
                <div class="ressource-drag-handle" title="Glisser pour réorganiser">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                    </svg>
                </div>
                <div class="ressource-fields">
                    <select class="ressource-type" data-index="${index}">
                        ${this.ressourceTypes.map(t => `
                            <option value="${t.value}" ${ressource.type === t.value ? 'selected' : ''}>
                                ${t.icon} ${t.label}
                            </option>
                        `).join('')}
                    </select>
                    <input type="text" class="ressource-titre" data-index="${index}"
                           placeholder="Titre" value="${this.escapeHtml(ressource.titre || '')}">
                    <input type="url" class="ressource-url" data-index="${index}"
                           placeholder="URL" value="${this.escapeHtml(ressource.url || '')}">
                </div>
                <button type="button" class="ressource-remove" onclick="AdminMethodologie.removeRessource(${index})" title="Supprimer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');

        this.setupRessourcesDragDrop();
    },

    addRessource() {
        this.collectRessourcesFromForm();
        this.currentRessources.push({ type: 'document', titre: '', url: '' });
        this.renderRessourcesList();
    },

    removeRessource(index) {
        this.collectRessourcesFromForm();
        this.currentRessources.splice(index, 1);
        this.renderRessourcesList();
    },

    collectRessourcesFromForm() {
        const items = document.querySelectorAll('.ressource-item');
        const ressources = [];

        items.forEach(item => {
            const index = parseInt(item.dataset.index);
            const type = item.querySelector('.ressource-type')?.value || 'document';
            const titre = item.querySelector('.ressource-titre')?.value?.trim() || '';
            const url = item.querySelector('.ressource-url')?.value?.trim() || '';

            if (url) {
                ressources.push({ type, titre, url });
            }
        });

        this.currentRessources = ressources;
    },

    setupRessourcesDragDrop() {
        const container = document.getElementById('ressourcesList');
        if (!container) return;

        let draggedItem = null;

        container.querySelectorAll('.ressource-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                if (draggedItem) {
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                    // Recalculer les index après réorganisation
                    this.reindexRessources();
                }
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(draggedItem, item);
                    } else {
                        container.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    },

    reindexRessources() {
        this.collectRessourcesFromForm();
        this.renderRessourcesList();
    },

    // ========== DELETE ==========
    confirmDelete(itemId) {
        console.log('confirmDelete appelé avec itemId:', itemId);

        if (!itemId || itemId === 'undefined' || itemId === 'null') {
            console.error('ID item invalide:', itemId);
            alert('Erreur: ID de l\'élément invalide');
            return;
        }

        const item = this.items.find(i => i.id === itemId);
        if (!item) {
            console.error('Item non trouvé pour ID:', itemId);
            return;
        }

        const descendantCount = this.countDescendants(itemId);

        this.deletingItem = itemId;
        console.log('deletingItem défini à:', this.deletingItem);

        document.getElementById('deleteTitle').textContent = 'Supprimer cet élément ?';
        document.getElementById('deleteText').textContent = descendantCount > 0
            ? `"${item.titre}" et ses ${descendantCount} sous-élément(s) seront supprimés.`
            : `"${item.titre}"`;

        document.getElementById('deleteModal').classList.remove('hidden');
    },

    async executeDelete() {
        console.log('executeDelete appelé, deletingItem:', this.deletingItem);

        if (!this.deletingItem || this.deletingItem === 'undefined') {
            console.error('deletingItem invalide:', this.deletingItem);
            alert('Erreur: Aucun élément sélectionné pour suppression');
            return;
        }

        const btn = document.getElementById('confirmDeleteBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner">⏳</span> Suppression...';

        try {
            console.log('Appel WebApp deleteMethodologie avec id:', this.deletingItem);
            await this.callWebApp('deleteMethodologie', { id: this.deletingItem });

            await this.loadData();
            this.renderStats();
            this.renderTree();
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
        const index = this.icons.indexOf(icon);
        if (index >= 0) {
            container.children[index].classList.add('selected');
        }
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
        // Add button
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.openAddModal(null));

        // Item modal
        document.getElementById('closeItemModal')?.addEventListener('click', () => this.closeItemModal());
        document.getElementById('cancelItemBtn')?.addEventListener('click', () => this.closeItemModal());
        document.getElementById('saveItemBtn')?.addEventListener('click', () => this.saveItem());

        // Content type selector
        document.querySelectorAll('input[name="contentType"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.setContentType(e.target.value));
        });

        // Ressources
        document.getElementById('addRessourceBtn')?.addEventListener('click', () => this.addRessource());

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
