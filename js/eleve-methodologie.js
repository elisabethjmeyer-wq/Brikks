/**
 * Élève Méthodologie - Structure arborescente flexible
 */

const EleveMethodologie = {
    items: [],
    progression: [],
    user: null,
    currentFilter: 'all',
    searchQuery: '',
    expandedItems: new Set(),

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));

            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('[EleveMethodologie] Erreur:', error);
            this.renderError();
        }
    },

    async loadData() {
        const [items, progression] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE),
            this.loadProgression()
        ]);

        this.items = (items || []).sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
        this.progression = progression || [];
    },

    async loadProgression() {
        try {
            const allProgression = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.PROGRESSION_METHODOLOGIE);
            if (!allProgression || !this.user) return [];
            return allProgression.filter(p => p.eleve_id === this.user.id);
        } catch (e) {
            return [];
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
        return !!item.video_url;
    },

    // Vérifie si un élément est complété
    isItemCompleted(itemId) {
        return this.progression.some(p => p.item_id === itemId && p.completed === 'TRUE');
    },

    // Compte les contenus descendants et leur progression
    getItemProgress(itemId, visited = new Set()) {
        if (visited.has(itemId)) return { completed: 0, total: 0 };
        visited.add(itemId);

        const item = this.items.find(i => i.id === itemId);
        if (!item) return { completed: 0, total: 0 };

        // Si c'est un contenu (a une vidéo), compter cet élément
        if (this.isContent(item)) {
            const completed = this.isItemCompleted(itemId) ? 1 : 0;
            return { completed, total: 1 };
        }

        // Sinon, compter les enfants récursivement
        const children = this.getChildren(itemId);
        let totalCompleted = 0;
        let totalItems = 0;

        children.forEach(child => {
            const childProgress = this.getItemProgress(child.id, visited);
            totalCompleted += childProgress.completed;
            totalItems += childProgress.total;
        });

        return { completed: totalCompleted, total: totalItems };
    },

    // Détermine le statut d'un élément
    getItemStatus(itemId) {
        const progress = this.getItemProgress(itemId);

        if (progress.total === 0) return 'empty';
        if (progress.completed === 0) return 'new';
        if (progress.completed === progress.total) return 'completed';
        return 'in-progress';
    },

    // Trouve le premier contenu non complété dans une branche
    findFirstUncompletedContent(itemId, visited = new Set()) {
        if (visited.has(itemId)) return null;
        visited.add(itemId);

        const item = this.items.find(i => i.id === itemId);
        if (!item) return null;

        // Si c'est un contenu non complété, le retourner
        if (this.isContent(item) && !this.isItemCompleted(itemId)) {
            return item;
        }

        // Sinon parcourir les enfants
        const children = this.getChildren(itemId);
        for (const child of children) {
            const uncompleted = this.findFirstUncompletedContent(child.id, visited);
            if (uncompleted) return uncompleted;
        }

        // Si tous complétés, retourner le premier contenu
        if (this.isContent(item)) return item;

        for (const child of children) {
            if (this.isContent(child)) return child;
            const content = this.findFirstContentInBranch(child.id, new Set());
            if (content) return content;
        }

        return null;
    },

    findFirstContentInBranch(itemId, visited = new Set()) {
        if (visited.has(itemId)) return null;
        visited.add(itemId);

        const item = this.items.find(i => i.id === itemId);
        if (!item) return null;

        if (this.isContent(item)) return item;

        const children = this.getChildren(itemId);
        for (const child of children) {
            const content = this.findFirstContentInBranch(child.id, visited);
            if (content) return content;
        }

        return null;
    },

    // Filtrer les éléments selon la recherche et le filtre
    matchesFilter(item, visited = new Set()) {
        // Protection contre les boucles infinies
        if (visited.has(item.id)) return false;
        visited.add(item.id);

        // Filtre par recherche
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            const matches = item.titre?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query);
            if (!matches) {
                // Vérifier si un descendant correspond
                const children = this.getChildren(item.id);
                if (!children.some(child => this.matchesFilter(child, new Set(visited)))) {
                    return false;
                }
            }
        }

        // Filtre par statut
        if (this.currentFilter !== 'all') {
            const status = this.getItemStatus(item.id);
            if (status !== this.currentFilter) {
                // Vérifier si un descendant correspond
                const children = this.getChildren(item.id);
                if (!children.some(child => this.matchesFilter(child, new Set(visited)))) {
                    return false;
                }
            }
        }

        return true;
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const rootItems = this.getRootItems();

        // Vérifier s'il y a des données
        if (!rootItems.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📚</span>
                    <p>Aucun contenu méthodologique disponible pour le moment</p>
                </div>
            `;
            return;
        }

        // Calculer la progression globale
        let totalItems = 0;
        let completedItems = 0;
        rootItems.forEach(root => {
            const progress = this.getItemProgress(root.id);
            totalItems += progress.total;
            completedItems += progress.completed;
        });
        const globalPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        let html = `
            <!-- Global Progress -->
            <div class="global-progress-card">
                <div class="global-progress-info">
                    <span class="global-progress-label">Ta progression globale</span>
                    <span class="global-progress-value">${completedItems}/${totalItems} contenus</span>
                </div>
                <div class="global-progress-bar">
                    <div class="global-progress-fill" style="width: ${globalPercent}%;"></div>
                </div>
            </div>

            <!-- Search -->
            <div class="search-bar">
                <input type="text" id="search-input" placeholder="Rechercher..." value="${this.escapeHtml(this.searchQuery)}">
            </div>

            <!-- Filters -->
            <div class="filter-section">
                <span class="filter-label">Filtrer :</span>
                <div class="filter-tabs">
                    <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Tout</button>
                    <button class="filter-tab ${this.currentFilter === 'new' ? 'active' : ''}" data-filter="new">🆕 Nouveau</button>
                    <button class="filter-tab ${this.currentFilter === 'in-progress' ? 'active' : ''}" data-filter="in-progress">🔄 En cours</button>
                    <button class="filter-tab ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">✅ Terminé</button>
                </div>
            </div>

            <!-- Tree -->
            <div class="tree-container">
        `;

        // Afficher les éléments racines
        const filteredRoots = rootItems.filter(item => this.matchesFilter(item, new Set()));

        if (filteredRoots.length === 0) {
            html += `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>Aucun résultat pour cette recherche</p>
                </div>
            `;
        } else {
            html += filteredRoots.map(item => this.renderItem(item, 0)).join('');
        }

        html += '</div>';

        container.innerHTML = html;
    },

    renderItem(item, depth, rendered = new Set()) {
        // Protection contre les boucles infinies
        if (rendered.has(item.id) || depth > 10) return '';
        rendered.add(item.id);

        const children = this.getChildren(item.id);
        const hasChildren = children.length > 0;
        const isContent = this.isContent(item);
        const progress = this.getItemProgress(item.id);
        const status = this.getItemStatus(item.id);
        const isExpanded = this.expandedItems.has(item.id);

        const statusIcons = {
            'new': '',
            'in-progress': '🔄',
            'completed': '✓',
            'empty': ''
        };

        const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

        // Lien vers le parcours
        let href = '#';
        if (isContent) {
            href = `methodologie-parcours.html?item=${item.id}`;
        } else {
            const firstContent = this.findFirstUncompletedContent(item.id, new Set());
            if (firstContent) {
                href = `methodologie-parcours.html?item=${firstContent.id}`;
            }
        }

        return `
            <div class="tree-item depth-${Math.min(depth, 4)} ${status}" data-id="${item.id}">
                <div class="tree-item-header">
                    ${hasChildren ? `
                        <button class="tree-toggle ${isExpanded ? 'expanded' : ''}" onclick="EleveMethodologie.toggleItem('${item.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                    ` : '<span class="tree-toggle-placeholder"></span>'}

                    <a href="${href}" class="tree-item-content">
                        <span class="tree-item-icon ${item.couleur || ''}">${item.icon || (isContent ? '🎬' : '📁')}</span>
                        <div class="tree-item-info">
                            <span class="tree-item-title">${this.escapeHtml(item.titre)}</span>
                            ${item.description ? `<span class="tree-item-desc">${this.escapeHtml(item.description).substring(0, 60)}${item.description.length > 60 ? '...' : ''}</span>` : ''}
                        </div>
                    </a>

                    <div class="tree-item-right">
                        ${status === 'completed' ? '<span class="status-badge completed">✓</span>' : ''}
                        ${status === 'in-progress' ? `
                            <div class="mini-progress">
                                <div class="mini-progress-bar">
                                    <div class="mini-progress-fill" style="width: ${percent}%;"></div>
                                </div>
                                <span class="mini-progress-text">${progress.completed}/${progress.total}</span>
                            </div>
                        ` : ''}
                        ${isContent && status === 'new' ? '<span class="status-badge new">Nouveau</span>' : ''}
                    </div>
                </div>

                ${hasChildren ? `
                    <div class="tree-item-children ${isExpanded ? 'expanded' : ''}">
                        ${children.filter(child => this.matchesFilter(child, new Set())).map(child => this.renderItem(child, depth + 1, new Set(rendered))).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    toggleItem(itemId) {
        if (this.expandedItems.has(itemId)) {
            this.expandedItems.delete(itemId);
        } else {
            this.expandedItems.add(itemId);
        }

        const element = document.querySelector(`.tree-item[data-id="${itemId}"]`);
        if (element) {
            const toggle = element.querySelector('.tree-toggle');
            const children = element.querySelector('.tree-item-children');

            if (toggle) toggle.classList.toggle('expanded');
            if (children) children.classList.toggle('expanded');
        }
    },

    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.render();
                    this.bindEvents();
                }, 300);
            });
        }

        // Filtres
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentFilter = tab.dataset.filter;
                this.render();
                this.bindEvents();
            });
        });

        // Développer automatiquement les éléments en cours
        if (this.expandedItems.size === 0) {
            this.getRootItems().forEach(root => {
                const status = this.getItemStatus(root.id);
                if (status === 'in-progress') {
                    this.expandedItems.add(root.id);
                }
            });
        }
    },

    renderError() {
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>Erreur lors du chargement des données</p>
                </div>
            `;
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveMethodologie = EleveMethodologie;
