/**
 * Élève Méthodologie Parcours - Structure arborescente flexible
 * Affichage du contenu avec sidebar de navigation à droite
 */

const EleveMethodologieParcours = {
    items: [],
    currentItem: null,
    progression: [],
    bexConfig: [],
    user: null,

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));

            // Récupérer le paramètre d'URL
            const params = new URLSearchParams(window.location.search);
            const itemId = params.get('item');

            if (!itemId) {
                this.renderError('Aucun contenu spécifié');
                return;
            }

            await this.loadData();
            this.buildBexMaps();

            // Trouver l'élément courant
            this.currentItem = this.items.find(i => i.id === itemId);

            if (!this.currentItem) {
                this.renderError('Contenu non trouvé');
                return;
            }

            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('[EleveMethodologieParcours] Erreur:', error);
            this.renderError('Erreur lors du chargement');
        }
    },

    async loadData() {
        // Charger les données principales (obligatoires)
        const [items, progression] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE),
            this.loadProgression()
        ]);

        this.items = (items || []).sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
        this.progression = progression || [];

        // Charger BEX_CONFIG de manière optionnelle (ne bloque pas si absent)
        try {
            if (CONFIG.SHEETS.BEX_CONFIG) {
                this.bexConfig = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.BEX_CONFIG) || [];
            } else {
                this.bexConfig = [];
            }
        } catch (e) {
            console.log('[EleveMethodologieParcours] BEX_CONFIG non disponible, fonctionnalité désactivée');
            this.bexConfig = [];
        }
    },

    buildBexMaps() {
        // Construire les maps pour les BEX à partir de la config chargée
        this.bexBanks = {};
        this.competenceBanks = {};

        this.bexConfig.forEach(bex => {
            if (bex.type === 'savoir-faire') {
                this.bexBanks[bex.id] = {
                    titre: bex.titre,
                    url: bex.url || `entrainements-sf.html?bex=${bex.id}`
                };
            } else if (bex.type === 'competences') {
                this.competenceBanks[bex.id] = {
                    titre: bex.titre,
                    url: bex.url || `entrainements-competences.html?comp=${bex.id}`
                };
            }
        });
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

    getParent(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || !item.parent_id) return null;
        return this.items.find(i => i.id === item.parent_id);
    },

    isContent(item) {
        return !!item.video_url || !!item.fiche_url;
    },

    getContentType(item) {
        if (item.video_url) return 'video';
        if (item.fiche_url) return 'fiche';
        return null;
    },

    isItemCompleted(itemId) {
        return this.progression.some(p => p.item_id === itemId && p.completed === 'TRUE');
    },

    // Obtenir le chemin (breadcrumb) vers l'élément
    getPath(itemId, path = [], visited = new Set()) {
        // Protection contre les boucles infinies
        if (visited.has(itemId) || path.length > 20) return path;
        visited.add(itemId);

        const item = this.items.find(i => i.id === itemId);
        if (!item) return path;

        path.unshift(item);

        if (item.parent_id && item.parent_id !== item.id) {
            return this.getPath(item.parent_id, path, visited);
        }

        return path;
    },

    // Obtenir les frères/soeurs (siblings) du même niveau
    getSiblings(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return [];

        if (!item.parent_id) {
            return this.getRootItems();
        }

        return this.getChildren(item.parent_id);
    },

    // Obtenir l'élément précédent/suivant
    getPrevItem() {
        const siblings = this.getSiblings(this.currentItem.id);
        const idx = siblings.findIndex(s => s.id === this.currentItem.id);
        return idx > 0 ? siblings[idx - 1] : null;
    },

    getNextItem() {
        const siblings = this.getSiblings(this.currentItem.id);
        const idx = siblings.findIndex(s => s.id === this.currentItem.id);
        return idx < siblings.length - 1 ? siblings[idx + 1] : null;
    },

    // Obtenir la racine du parcours courant
    getCurrentParcoursRoot() {
        const path = this.getPath(this.currentItem.id);
        return path.length > 0 ? path[0] : null;
    },

    // Trouver le contenu précédent/suivant DANS LE MÊME PARCOURS uniquement
    findPrevContent() {
        const root = this.getCurrentParcoursRoot();
        if (!root) return null;

        const parcoursContents = this.getParcoursContents(root.id);
        const idx = parcoursContents.findIndex(c => c.id === this.currentItem.id);
        return idx > 0 ? parcoursContents[idx - 1] : null;
    },

    findNextContent() {
        const root = this.getCurrentParcoursRoot();
        if (!root) return null;

        const parcoursContents = this.getParcoursContents(root.id);
        const idx = parcoursContents.findIndex(c => c.id === this.currentItem.id);
        return idx < parcoursContents.length - 1 ? parcoursContents[idx + 1] : null;
    },

    // Obtenir tous les contenus d'un parcours spécifique (branche racine)
    getParcoursContents(rootId, result = [], visited = new Set()) {
        if (!rootId || visited.has(rootId)) return result;
        visited.add(rootId);

        const root = this.items.find(i => i.id === rootId);
        if (!root) return result;

        // Si c'est un contenu, l'ajouter
        if (this.isContent(root)) {
            result.push(root);
        }

        // Parcourir les enfants
        const children = this.getChildren(rootId);
        for (const child of children) {
            this.getParcoursContents(child.id, result, visited);
        }

        return result;
    },

    // Obtenir tous les contenus dans l'ordre de parcours (pour compatibilité)
    getAllContents(parentId = null, result = [], visited = new Set()) {
        const items = parentId === null ? this.getRootItems() : this.getChildren(parentId);

        for (const item of items) {
            if (visited.has(item.id)) continue;
            visited.add(item.id);

            if (this.isContent(item)) {
                result.push(item);
            }

            this.getAllContents(item.id, result, visited);
        }

        return result;
    },

    // Calculer la progression dans la branche courante
    getBranchProgress() {
        // Remonter jusqu'à la racine
        const path = this.getPath(this.currentItem.id);
        if (path.length === 0) return { completed: 0, total: 0, percent: 0 };

        const root = path[0];
        return this.getItemProgress(root.id);
    },

    getItemProgress(itemId, visited = new Set()) {
        if (visited.has(itemId)) return { completed: 0, total: 0 };
        visited.add(itemId);

        const item = this.items.find(i => i.id === itemId);
        if (!item) return { completed: 0, total: 0 };

        if (this.isContent(item)) {
            const completed = this.isItemCompleted(itemId) ? 1 : 0;
            return { completed, total: 1 };
        }

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

    // Parser les documents
    parseDocuments(documentsStr) {
        if (!documentsStr) return [];
        try {
            return JSON.parse(documentsStr);
        } catch {
            return documentsStr.split(';;').map(doc => {
                const [titre, url, taille] = doc.split('|');
                return { titre, url, taille };
            }).filter(d => d.url);
        }
    },

    // Parser les ressources supplémentaires
    parseRessources(ressourcesStr) {
        if (!ressourcesStr) return [];
        try {
            const parsed = JSON.parse(ressourcesStr);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    getRessourceIcon(type) {
        const icons = {
            video: '🎬',
            document: '📄',
            image: '🖼️',
            link: '🔗'
        };
        return icons[type] || '📎';
    },

    getRessourceLabel(type) {
        const labels = {
            video: 'Vidéo',
            document: 'Document',
            image: 'Image',
            link: 'Lien'
        };
        return labels[type] || 'Ressource';
    },

    // Obtenir l'URL de téléchargement direct (pour Google Drive notamment)
    getDownloadUrl(url) {
        if (!url) return url;

        // Google Drive : convertir en URL de téléchargement direct
        if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (match) {
                return `https://drive.google.com/uc?export=download&id=${match[1]}`;
            }
        }

        return url;
    },

    // Forcer le téléchargement d'un fichier
    downloadFile(url, filename) {
        const downloadUrl = this.getDownloadUrl(url);

        // Créer un lien temporaire pour déclencher le téléchargement
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename || 'document';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        // Pour Google Drive, on doit ouvrir dans un nouvel onglet car le téléchargement direct
        // peut être bloqué par le navigateur pour les fichiers cross-origin
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Obtenir l'URL embed pour vidéo
    getEmbedUrl(url) {
        if (!url) return null;
        if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/');
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
        const vimeo = url.match(/vimeo\.com\/(\d+)/);
        if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
        return null;
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const path = this.getPath(this.currentItem.id);
        const contentType = this.getContentType(this.currentItem);
        const embedUrl = this.getEmbedUrl(this.currentItem.video_url);
        const isCompleted = this.isItemCompleted(this.currentItem.id);
        const prevContent = this.findPrevContent();
        const nextContent = this.findNextContent();
        const branchProgress = this.getBranchProgress();
        const branchPercent = branchProgress.total > 0
            ? Math.round((branchProgress.completed / branchProgress.total) * 100)
            : 0;

        container.innerHTML = `
            <!-- Breadcrumb -->
            <div class="breadcrumb-bar">
                <nav class="breadcrumb">
                    <a href="methodologie.html">Méthodologie</a>
                    ${path.slice(0, -1).map(item => `
                        <span class="separator">›</span>
                        <a href="methodologie.html">${item.icon || ''} ${this.escapeHtml(item.titre)}</a>
                    `).join('')}
                    <span class="separator">›</span>
                    <span class="current">${this.escapeHtml(this.currentItem.titre)}</span>
                </nav>
            </div>

            <!-- Layout: Content + Sidebar à droite -->
            <div class="parcours-layout">
                <!-- Main Content -->
                <div class="parcours-content">
                    ${contentType === 'video' && embedUrl ? this.renderVideoSection(embedUrl) : ''}
                    ${contentType === 'fiche' ? this.renderFicheSection() : ''}
                    ${!contentType ? this.renderPlaceholder() : ''}
                    ${this.currentItem.contenu_html ? this.renderTextContent() : ''}
                    ${this.renderRessources()}
                    ${this.renderTrainingLinks()}
                    ${this.renderNavigation(prevContent, nextContent)}
                </div>

                <!-- Sidebar à droite -->
                <aside class="parcours-sidebar">
                    <div class="sidebar-card">
                        <div class="sidebar-header">
                            <h3>${path[0]?.icon || '📚'} ${this.escapeHtml(path[0]?.titre || 'Navigation')}</h3>
                        </div>

                        <div class="tree-menu">
                            ${this.renderTreeMenu(path[0]?.id)}
                        </div>

                        <div class="progress-section">
                            <div class="progress-header">
                                <span class="progress-label">Ta progression</span>
                                <span class="progress-value">${branchProgress.completed}/${branchProgress.total}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${branchPercent}%;"></div>
                            </div>

                            <button class="mark-complete-btn ${isCompleted ? 'completed' : ''}" id="mark-complete-btn">
                                ${isCompleted ? '✓ Terminé' : 'Marquer comme terminé'}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        `;
    },

    renderTreeMenu(rootId, visited = new Set()) {
        if (!rootId || visited.has(rootId)) return '';
        visited.add(rootId);

        const root = this.items.find(i => i.id === rootId);
        const children = this.getChildren(rootId);

        // Si la racine elle-même est un contenu (sans enfants), l'afficher directement
        if (children.length === 0 && root && this.isContent(root)) {
            return `
                <div class="tree-menu-items">
                    ${this.renderTreeMenuItem(root, new Set())}
                </div>
            `;
        }

        if (children.length === 0) return '';

        return `
            <div class="tree-menu-items">
                ${children.map(child => this.renderTreeMenuItem(child, new Set())).join('')}
            </div>
        `;
    },

    // Vérifie si un item est dans le chemin de l'élément courant
    isInCurrentPath(itemId) {
        const currentPath = this.getPath(this.currentItem.id);
        return currentPath.some(p => p.id === itemId);
    },

    // Vérifie si un item a un descendant actif (pour ouvrir les groupes parents)
    hasActiveDescendant(itemId, visited = new Set()) {
        if (visited.has(itemId)) return false;
        visited.add(itemId);

        const children = this.getChildren(itemId);
        for (const child of children) {
            if (child.id === this.currentItem.id) return true;
            if (this.hasActiveDescendant(child.id, visited)) return true;
        }
        return false;
    },

    renderTreeMenuItem(item, visited = new Set(), depth = 0) {
        if (visited.has(item.id) || depth > 10) return '';
        visited.add(item.id);

        const isActive = item.id === this.currentItem.id;
        const isContent = this.isContent(item);
        const isCompleted = this.isItemCompleted(item.id);
        const children = this.getChildren(item.id);
        const hasChildren = children.length > 0;

        // Ouvrir automatiquement si cet item ou un descendant est actif
        const shouldBeOpen = isActive || this.hasActiveDescendant(item.id, new Set());

        if (isContent) {
            return `
                <a href="methodologie-parcours.html?item=${item.id}"
                   class="tree-menu-item depth-${depth} ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                    <span class="tree-menu-status">${isCompleted ? '✓' : '○'}</span>
                    <span class="tree-menu-title">${this.escapeHtml(item.titre)}</span>
                </a>
            `;
        }

        // Dossier avec ou sans enfants
        return `
            <div class="tree-menu-group depth-${depth} ${shouldBeOpen ? 'open' : ''}">
                <div class="tree-menu-folder">
                    <span class="tree-menu-icon">${item.icon || '📁'}</span>
                    <span class="tree-menu-title">${this.escapeHtml(item.titre)}</span>
                    <span class="tree-menu-toggle">${hasChildren ? '▶' : ''}</span>
                </div>
                ${hasChildren ? `
                    <div class="tree-menu-children">
                        ${children.map(child => this.renderTreeMenuItem(child, new Set(visited), depth + 1)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderVideoSection(embedUrl) {
        return `
            <div class="video-section">
                <h1 class="content-title">${this.currentItem.icon || '🎬'} ${this.escapeHtml(this.currentItem.titre)}</h1>
                ${this.currentItem.description ? `<p class="content-description">${this.escapeHtml(this.currentItem.description)}</p>` : ''}
                <div class="video-container">
                    <iframe src="${embedUrl}" allowfullscreen allow="autoplay; encrypted-media"></iframe>
                </div>
            </div>
        `;
    },

    renderPlaceholder() {
        return `
            <div class="video-section">
                <h1 class="content-title">${this.currentItem.icon || '📄'} ${this.escapeHtml(this.currentItem.titre)}</h1>
                ${this.currentItem.description ? `<p class="content-description">${this.escapeHtml(this.currentItem.description)}</p>` : ''}
            </div>
        `;
    },

    renderDownloadsSection(documents) {
        return `
            <div class="downloads-section">
                <div class="downloads-header">
                    <h3>📥 Documents</h3>
                    ${documents.length > 1 ? `
                        <button class="download-all-btn" onclick="EleveMethodologieParcours.downloadAll()">
                            <span>↓</span> Tout télécharger
                        </button>
                    ` : ''}
                </div>
                <div class="downloads-list">
                    ${documents.map(doc => `
                        <a href="${doc.url}" class="download-item" target="_blank" rel="noopener">
                            <div class="download-icon">${this.getFileIcon(doc.titre)}</div>
                            <div class="download-info">
                                <div class="download-name">${this.escapeHtml(doc.titre)}</div>
                                ${doc.taille ? `<div class="download-size">${doc.taille}</div>` : ''}
                            </div>
                            <button class="download-btn">↓</button>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderTextContent() {
        return `
            <div class="text-content">
                ${this.currentItem.contenu_html}
            </div>
        `;
    },

    // bexBanks et competenceBanks sont construits dynamiquement dans buildBexMaps()

    renderFicheSection() {
        const ficheUrl = this.currentItem.fiche_url;
        const isGoogleDoc = ficheUrl && (ficheUrl.includes('docs.google.com') || ficheUrl.includes('drive.google.com'));
        const isPdf = ficheUrl && ficheUrl.toLowerCase().endsWith('.pdf');

        // Convertir Google Docs en URL embed
        let embedUrl = ficheUrl;
        if (isGoogleDoc) {
            if (ficheUrl.includes('/d/')) {
                // Format: https://docs.google.com/document/d/ID/...
                const match = ficheUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    embedUrl = `https://docs.google.com/document/d/${match[1]}/preview`;
                }
            } else if (ficheUrl.includes('id=')) {
                // Format: https://drive.google.com/file/d/ID/... ou ?id=ID
                const match = ficheUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) || ficheUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                }
            }
        }

        return `
            <div class="fiche-section">
                <h1 class="content-title">${this.currentItem.icon || '📄'} ${this.escapeHtml(this.currentItem.titre)}</h1>
                ${this.currentItem.description ? `<p class="content-description">${this.escapeHtml(this.currentItem.description)}</p>` : ''}

                <div class="fiche-container">
                    ${isGoogleDoc || isPdf ? `
                        <iframe src="${embedUrl}" class="fiche-embed" allowfullscreen></iframe>
                    ` : `
                        <div class="fiche-link-container">
                            <a href="${ficheUrl}" target="_blank" rel="noopener" class="fiche-link-btn">
                                <span class="fiche-link-icon">📄</span>
                                <span>Ouvrir la fiche méthode</span>
                                <span class="fiche-link-arrow">↗</span>
                            </a>
                        </div>
                    `}
                </div>
            </div>
        `;
    },

    renderRessources() {
        const ressources = this.parseRessources(this.currentItem.ressources);
        if (ressources.length === 0) return '';

        return `
            <div class="ressources-section">
                <h3 class="ressources-title">📎 Ressources complémentaires</h3>
                <div class="ressources-grid">
                    ${ressources.map((ressource, index) => `
                        <button class="ressource-btn" onclick="EleveMethodologieParcours.openRessource(${index})">
                            <span class="ressource-btn-icon">${this.getRessourceIcon(ressource.type)}</span>
                            <span class="ressource-btn-text">${this.escapeHtml(ressource.titre || this.getRessourceLabel(ressource.type))}</span>
                            <span class="ressource-btn-actions">
                                <span class="ressource-action view" title="Voir">👁️</span>
                                <span class="ressource-action download" title="Télécharger" onclick="event.stopPropagation(); EleveMethodologieParcours.downloadFile('${ressource.url}', '${this.escapeHtml(ressource.titre || 'document')}');">⬇️</span>
                            </span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    openRessource(index) {
        const ressources = this.parseRessources(this.currentItem.ressources);
        const ressource = ressources[index];
        if (!ressource) return;

        // Créer la popup
        const popup = document.createElement('div');
        popup.className = 'ressource-popup-overlay';
        popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

        let content = '';
        if (ressource.type === 'video') {
            const embedUrl = this.getEmbedUrl(ressource.url);
            if (embedUrl) {
                content = `<iframe src="${embedUrl}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
            } else {
                content = `<a href="${ressource.url}" target="_blank" class="popup-external-link">Ouvrir la vidéo ↗</a>`;
            }
        } else if (ressource.type === 'image') {
            content = `<img src="${ressource.url}" alt="${this.escapeHtml(ressource.titre || 'Image')}" />`;
        } else if (ressource.type === 'document') {
            // Tenter d'embedder les PDFs et Google Docs
            if (ressource.url.includes('docs.google.com') || ressource.url.includes('drive.google.com')) {
                const match = ressource.url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (match) {
                    content = `<iframe src="https://drive.google.com/file/d/${match[1]}/preview"></iframe>`;
                } else {
                    content = `<iframe src="${ressource.url}"></iframe>`;
                }
            } else if (ressource.url.toLowerCase().endsWith('.pdf')) {
                content = `<iframe src="${ressource.url}"></iframe>`;
            } else {
                content = `<a href="${ressource.url}" target="_blank" class="popup-external-link">Ouvrir le document ↗</a>`;
            }
        } else {
            content = `<a href="${ressource.url}" target="_blank" class="popup-external-link">Ouvrir le lien ↗</a>`;
        }

        const titre = this.escapeHtml(ressource.titre || this.getRessourceLabel(ressource.type));
        popup.innerHTML = `
            <div class="ressource-popup">
                <div class="ressource-popup-header">
                    <h3>${this.getRessourceIcon(ressource.type)} ${titre}</h3>
                    <div class="ressource-popup-actions">
                        <button class="popup-btn download" title="Télécharger" onclick="EleveMethodologieParcours.downloadFile('${ressource.url}', '${titre}')">⬇️</button>
                        <a href="${ressource.url}" target="_blank" class="popup-btn external" title="Ouvrir dans un nouvel onglet">↗️</a>
                        <button class="popup-btn close" onclick="this.closest('.ressource-popup-overlay').remove()">✕</button>
                    </div>
                </div>
                <div class="ressource-popup-content">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(popup);
    },

    renderTrainingLinks() {
        const bexBank = this.currentItem.bex_bank;
        const competenceBank = this.currentItem.competence_bank;

        if (!bexBank && !competenceBank) return '';

        const bexInfo = bexBank ? this.bexBanks[bexBank] : null;
        const compInfo = competenceBank ? this.competenceBanks[competenceBank] : null;

        return `
            <div class="training-links">
                <h3 class="training-links-title">🎯 Pour t'entraîner</h3>
                <div class="training-links-grid">
                    ${bexInfo ? `
                        <a href="${bexInfo.url}" class="training-link training-link-bex">
                            <div class="training-link-icon">🔧</div>
                            <div class="training-link-info">
                                <div class="training-link-label">BEX Savoir-faire</div>
                                <div class="training-link-title">${this.escapeHtml(bexInfo.titre)}</div>
                            </div>
                            <span class="training-link-arrow">→</span>
                        </a>
                    ` : ''}
                    ${compInfo ? `
                        <a href="${compInfo.url}" class="training-link training-link-comp">
                            <div class="training-link-icon">🎯</div>
                            <div class="training-link-info">
                                <div class="training-link-label">BEX Compétences</div>
                                <div class="training-link-title">${this.escapeHtml(compInfo.titre)}</div>
                            </div>
                            <span class="training-link-arrow">→</span>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderNavigation(prevContent, nextContent) {
        return `
            <nav class="step-navigation">
                ${prevContent ? `
                    <a href="methodologie-parcours.html?item=${prevContent.id}" class="nav-btn prev">
                        <span class="arrow">←</span>
                        <div>
                            <div class="label">Précédent</div>
                            <div class="title">${this.escapeHtml(prevContent.titre)}</div>
                        </div>
                    </a>
                ` : '<div class="nav-btn disabled"></div>'}

                ${nextContent ? `
                    <a href="methodologie-parcours.html?item=${nextContent.id}" class="nav-btn next">
                        <div>
                            <div class="label">Suivant</div>
                            <div class="title">${this.escapeHtml(nextContent.titre)}</div>
                        </div>
                        <span class="arrow">→</span>
                    </a>
                ` : '<div class="nav-btn disabled"></div>'}
            </nav>
        `;
    },

    getFileIcon(filename) {
        if (!filename) return '📄';
        const ext = filename.split('.').pop()?.toLowerCase();
        const icons = {
            pdf: '📄', doc: '📝', docx: '📝',
            xls: '📊', xlsx: '📊',
            ppt: '📽️', pptx: '📽️',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
            mp4: '🎬', mp3: '🎵', zip: '📦'
        };
        return icons[ext] || '📄';
    },

    bindEvents() {
        // Toggle des groupes dans le menu
        document.querySelectorAll('.tree-menu-folder').forEach(folder => {
            folder.addEventListener('click', () => {
                const group = folder.closest('.tree-menu-group');
                if (group) group.classList.toggle('open');
            });
        });

        // Bouton marquer comme terminé
        const markCompleteBtn = document.getElementById('mark-complete-btn');
        if (markCompleteBtn && !this.isItemCompleted(this.currentItem.id)) {
            markCompleteBtn.addEventListener('click', () => this.markAsComplete());
        }
    },

    async markAsComplete() {
        if (!this.user || !this.currentItem) return;

        const btn = document.getElementById('mark-complete-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Enregistrement...';
        }

        try {
            // Appeler le Web App via JSONP
            await this.callWebApp('addProgressionMethodologie', {
                eleve_id: this.user.id,
                item_id: this.currentItem.id
            });

            // Vider le cache pour que la progression soit à jour
            SheetsAPI.clearCache();

            // Mettre à jour localement
            this.progression.push({
                eleve_id: this.user.id,
                item_id: this.currentItem.id,
                completed: 'TRUE',
                date: new Date().toISOString()
            });

            // Re-render
            this.render();
            this.bindEvents();

            // Aller au contenu suivant après un délai
            const nextContent = this.findNextContent();
            if (nextContent) {
                setTimeout(() => {
                    window.location.href = `methodologie-parcours.html?item=${nextContent.id}`;
                }, 500);
            }
        } catch (error) {
            console.error('[EleveMethodologieParcours] Erreur:', error);
            alert('Erreur lors de l\'enregistrement de la progression');
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Marquer comme terminé';
            }
        }
    },

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

    downloadAll() {
        const documents = this.parseDocuments(this.currentItem.documents);
        documents.forEach(doc => {
            if (doc.url) {
                window.open(doc.url, '_blank');
            }
        });
    },

    renderError(message) {
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>${this.escapeHtml(message)}</p>
                    <a href="methodologie.html" style="margin-top: 16px; color: var(--primary);">← Retour à la méthodologie</a>
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

window.EleveMethodologieParcours = EleveMethodologieParcours;
