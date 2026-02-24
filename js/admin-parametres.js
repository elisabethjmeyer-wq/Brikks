/**
 * Module Paramètres Admin
 * Gestion des paramètres du site, classeur et menu élève
 */

const AdminParametres = {
    // État
    hasChanges: false,
    originalData: {},
    currentData: {},
    selectedEmoji: '📚',
    selectedCategoryEmoji: '⭐',
    menuConfig: [],

    /**
     * Initialise le module
     */
    async init() {
        this.bindEvents();
        await this.loadData();
        this.hideLoader();
    },

    /**
     * Attache les événements
     */
    bindEvents() {
        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Inputs avec suivi des changements
        document.getElementById('siteName')?.addEventListener('input', () => {
            this.updatePreview();
            this.markAsChanged();
        });

        document.getElementById('siteSubtitle')?.addEventListener('input', () => {
            this.updatePreview();
            this.markAsChanged();
        });

        document.getElementById('primaryColor')?.addEventListener('input', () => {
            this.updatePreview();
            this.markAsChanged();
        });

        document.getElementById('classeurUrl')?.addEventListener('input', () => {
            this.markAsChanged();
        });

        // Emoji picker pour logo
        document.getElementById('logoEmojiPicker')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-option');
            if (btn) {
                document.querySelectorAll('#logoEmojiPicker .emoji-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedEmoji = btn.dataset.emoji;
                this.updatePreview();
                this.markAsChanged();
            }
        });

        // Color presets
        document.querySelectorAll('.color-preset').forEach(preset => {
            preset.addEventListener('click', () => {
                document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('active'));
                preset.classList.add('active');
                document.getElementById('primaryColor').value = preset.dataset.color;
                this.updatePreview();
                this.markAsChanged();
            });
        });

        // Category emoji picker
        document.getElementById('newCategoryEmoji')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.emoji-option');
            if (btn) {
                document.querySelectorAll('#newCategoryEmoji .emoji-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedCategoryEmoji = btn.dataset.emoji;
            }
        });

        // Save bar buttons
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveChanges());
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.cancelChanges());

        // Modal buttons
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.openNewCategoryModal());
        document.getElementById('closeCategoryModal')?.addEventListener('click', () => this.closeNewCategoryModal());
        document.getElementById('cancelCategoryBtn')?.addEventListener('click', () => this.closeNewCategoryModal());
        document.getElementById('createCategoryBtn')?.addEventListener('click', () => this.createCategory());

        document.getElementById('closeEditModal')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveEditBtn')?.addEventListener('click', () => this.saveEditItem());

        // Modal overlay click to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) overlay.classList.remove('show');
            });
        });

        // Warn before leave
        window.addEventListener('beforeunload', (e) => {
            if (this.hasChanges) {
                e.preventDefault();
                e.returnValue = 'Modifications non enregistrées';
            }
        });
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        try {
            // Charger PARAMETRES
            const params = await SheetsAPI.fetchAndParse('PARAMETRES');
            console.log('[Parametres] PARAMETRES data:', params);

            // Extraire les valeurs
            this.originalData = {
                site_titre: this.getParamValue(params, 'site_titre', 'Espace cours'),
                site_sous_titre: this.getParamValue(params, 'site_sous_titre', ''),
                site_emoji: this.getParamValue(params, 'site_emoji', '📚'),
                site_couleur: this.getParamValue(params, 'site_couleur', '#6366f1'),
                classeur_url: this.getParamValue(params, 'classeur_url', '')
            };

            this.currentData = { ...this.originalData };

            // Remplir les champs
            document.getElementById('siteName').value = this.currentData.site_titre;
            document.getElementById('siteSubtitle').value = this.currentData.site_sous_titre;
            document.getElementById('primaryColor').value = this.currentData.site_couleur;
            document.getElementById('classeurUrl').value = this.currentData.classeur_url;

            // Sélectionner l'emoji
            this.selectedEmoji = this.currentData.site_emoji;
            document.querySelectorAll('#logoEmojiPicker .emoji-option').forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.emoji === this.selectedEmoji);
            });

            // Sélectionner la couleur preset
            document.querySelectorAll('.color-preset').forEach(preset => {
                preset.classList.toggle('active', preset.dataset.color === this.currentData.site_couleur);
            });

            // Mettre à jour la prévisualisation
            this.updatePreview();

            // Charger le preview classeur si URL existe
            if (this.currentData.classeur_url) {
                this.refreshClasseurPreview();
            }

            // Charger CONFIG_MENU
            await this.loadMenuConfig();

        } catch (error) {
            console.error('[Parametres] Erreur chargement:', error);
        }
    },

    /**
     * Extrait une valeur des paramètres
     */
    getParamValue(params, key, defaultValue = '') {
        const param = params.find(p =>
            p.cle === key || p.parametre === key || p.nom === key || p.key === key
        );
        return param ? (param.valeur || param.value || defaultValue) : defaultValue;
    },

    /**
     * Cache le loader
     */
    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    },

    /**
     * Change d'onglet
     */
    switchTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add('active');
        document.getElementById('tab-' + tabId)?.classList.add('active');
    },

    /**
     * Met à jour la prévisualisation du header
     */
    updatePreview() {
        const name = document.getElementById('siteName')?.value || 'Espace cours';
        const subtitle = document.getElementById('siteSubtitle')?.value || '';
        const color = document.getElementById('primaryColor')?.value || '#6366f1';

        document.getElementById('previewName').textContent = name;
        document.getElementById('previewSubtitle').textContent = subtitle;

        const previewIcon = document.getElementById('previewIcon');
        if (previewIcon) {
            previewIcon.textContent = this.selectedEmoji;
            previewIcon.style.background = `linear-gradient(135deg, ${color}, ${this.adjustColor(color, -20)})`;
        }
    },

    /**
     * Ajuste une couleur (plus sombre/clair)
     */
    adjustColor(color, amount) {
        const num = parseInt(color.slice(1), 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    },

    /**
     * Rafraîchit l'aperçu du classeur
     */
    refreshClasseurPreview() {
        const url = document.getElementById('classeurUrl')?.value;
        const iframe = document.getElementById('classeurPreview');
        const placeholder = document.getElementById('classeurPlaceholder');

        if (url && url.includes('publuu.com')) {
            let embedUrl = url;
            if (!url.includes('/page/')) {
                embedUrl = url.replace(/\/$/, '') + '/page/1';
            }
            if (!embedUrl.includes('?embed')) {
                embedUrl += '?embed';
            }

            iframe.src = embedUrl;
            iframe.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            iframe.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    },

    /**
     * Charge la configuration du menu
     */
    async loadMenuConfig() {
        try {
            const menuItems = await SheetsAPI.fetchAndParse('CONFIG_MENU');
            console.log('[Parametres] CONFIG_MENU data:', menuItems);

            this.menuConfig = menuItems;
            this.renderMenuConfig();
        } catch (error) {
            console.log('[Parametres] CONFIG_MENU non disponible, utilisation config par défaut');
            this.renderDefaultMenuConfig();
        }
    },

    /**
     * Affiche la configuration par défaut du menu
     */
    renderDefaultMenuConfig() {
        const defaultConfig = [
            {
                id: 'organisation',
                titre: 'Organisation',
                icon: '📅',
                items: [
                    { id: 'emploi-du-temps', nom: 'Emploi du temps', icon: '📆', visible: true, bloque: false },
                    { id: 'classeur', nom: 'Classeur modèle', icon: '📂', visible: true, bloque: false }
                ]
            },
            {
                id: 'cours',
                titre: 'Cours',
                icon: '📖',
                items: [
                    { id: 'lecons', nom: 'Leçons', icon: '📖', visible: true, bloque: false },
                    { id: 'methodologie', nom: 'Méthodologie', icon: '🧠', visible: true, bloque: false }
                ]
            },
            {
                id: 'entrainement',
                titre: "S'entraîner",
                icon: '📝',
                items: [
                    { id: 'connaissances', nom: 'Connaissances', icon: '🟢', visible: true, bloque: false },
                    { id: 'savoir-faire', nom: 'Savoir-faire', icon: '🟠', visible: true, bloque: false },
                    { id: 'competences', nom: 'Compétences', icon: '🟣', visible: false, bloque: false }
                ]
            },
            {
                id: 'evaluations',
                titre: 'Évaluations',
                icon: '📋',
                items: [
                    { id: 'mes-evaluations', nom: 'Mes évaluations', icon: '📋', visible: true, bloque: false },
                    { id: 'mes-notes', nom: 'Mes notes', icon: '📊', visible: true, bloque: false }
                ]
            }
        ];

        this.renderMenuSections(defaultConfig);
    },

    /**
     * Affiche la configuration du menu depuis les données
     */
    renderMenuConfig() {
        // Grouper par catégorie
        const grouped = {};
        this.menuConfig.forEach(item => {
            const cat = item.categorie || 'Autres';
            if (!grouped[cat]) {
                grouped[cat] = {
                    id: cat.toLowerCase().replace(/\s+/g, '-'),
                    titre: cat,
                    icon: item.categorie_icon || '📁',
                    items: []
                };
            }
            // Handle TRUE/true/1/oui variations for visible
            const visibleValue = String(item.visible || '').toLowerCase().trim();
            const isVisible = visibleValue === 'true' || visibleValue === '1' || visibleValue === 'oui' || visibleValue === 'yes' || item.visible === true;

            const bloqueValue = String(item.bloque || '').toLowerCase().trim();
            const isBloque = bloqueValue === 'true' || bloqueValue === '1' || bloqueValue === 'oui' || bloqueValue === 'yes' || item.bloque === true;

            grouped[cat].items.push({
                id: item.element_code || item.id,
                nom: item.nom_affiche || item.nom,
                icon: item.icon || '📄',
                visible: isVisible,
                bloque: isBloque
            });
        });

        const sections = Object.values(grouped);
        if (sections.length > 0) {
            this.renderMenuSections(sections);
        } else {
            this.renderDefaultMenuConfig();
        }
    },

    /**
     * Génère le HTML des sections de menu
     */
    renderMenuSections(sections) {
        const container = document.getElementById('menuSectionsContainer');
        if (!container) return;

        container.innerHTML = sections.map(section => `
            <div class="menu-section" data-section-id="${section.id}">
                <div class="menu-section-header">
                    <span class="menu-section-drag">⋮⋮</span>
                    <span class="menu-section-icon">${section.icon}</span>
                    <span class="menu-section-title">${section.titre}</span>
                    <button class="menu-section-btn" title="Modifier" onclick="AdminParametres.editSection('${section.id}')">✏️</button>
                    <button class="menu-section-btn delete" title="Supprimer" onclick="AdminParametres.deleteSection('${section.id}')">🗑️</button>
                </div>
                <div class="menu-section-body">
                    ${section.items.map(item => this.renderMenuItem(item)).join('')}
                </div>
            </div>
        `).join('');

        // Attacher les événements de drag & drop
        this.initDragDrop();
    },

    /**
     * Liste des emojis disponibles pour les éléments de menu
     */
    menuEmojis: ['📆', '📅', '📂', '📁', '📖', '📚', '🧠', '💡', '🟢', '🟠', '🟣', '🔵', '📝', '✏️', '📋', '📊', '🎬', '📺', '🎵', '🎮', '❓', '✉️', '💬', '🏠', '⭐', '🔔', '📌', '🎯', '🏆', '🎓'],

    /**
     * Détermine l'état d'un item : 'visible', 'bloque' ou 'masque'
     */
    getItemState(item) {
        if (!item.visible) return 'masque';
        if (item.bloque) return 'bloque';
        return 'visible';
    },

    /**
     * Label et classe CSS pour un état donné
     */
    stateDisplay: {
        visible: { text: 'Visible', cssClass: 'visible' },
        bloque:  { text: 'Bloqué', cssClass: 'locked' },
        masque:  { text: 'Masqué', cssClass: 'hidden' }
    },

    /**
     * Génère le HTML d'un élément de menu
     */
    renderMenuItem(item) {
        const state = this.getItemState(item);
        const display = this.stateDisplay[state];
        const itemClass = state === 'masque' ? ' disabled' : '';

        return `
            <div class="menu-item${itemClass}" data-id="${item.id}" data-icon="${item.icon}" data-state="${state}" draggable="true">
                <span class="menu-item-drag">⋮⋮</span>
                <div class="menu-item-icon" onclick="AdminParametres.openIconPicker(this, '${item.id}')" title="Cliquer pour changer l'icône">${item.icon}</div>
                <span class="menu-item-name">${item.nom}</span>
                <button class="menu-state-btn ${display.cssClass}" onclick="AdminParametres.cycleItemState(this)" title="Cliquer pour changer l'état">
                    ${display.text}
                </button>
                <div class="menu-item-actions">
                    <button class="menu-item-btn" onclick="AdminParametres.editItem('${item.id}')">✏️</button>
                </div>
            </div>
        `;
    },

    /**
     * Ouvre le picker d'icône pour un élément
     */
    openIconPicker(iconEl, itemId) {
        // Fermer tout picker existant
        this.closeIconPicker();

        const picker = document.createElement('div');
        picker.className = 'icon-picker-dropdown';
        picker.id = 'iconPickerDropdown';
        picker.innerHTML = this.menuEmojis.map(emoji =>
            `<button class="icon-picker-option" data-emoji="${emoji}">${emoji}</button>`
        ).join('');

        // Positionner le picker
        const rect = iconEl.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = `${rect.bottom + 5}px`;
        picker.style.left = `${rect.left}px`;

        // Gestionnaire de clic sur emoji
        picker.addEventListener('click', (e) => {
            const btn = e.target.closest('.icon-picker-option');
            if (btn) {
                const emoji = btn.dataset.emoji;
                iconEl.textContent = emoji;
                iconEl.closest('.menu-item').dataset.icon = emoji;
                this.closeIconPicker();
                this.markAsChanged();
            }
        });

        document.body.appendChild(picker);

        // Fermer au clic ailleurs
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 10);
    },

    /**
     * Gestionnaire pour fermer le picker au clic extérieur
     */
    handleOutsideClick(e) {
        if (!e.target.closest('.icon-picker-dropdown') && !e.target.closest('.menu-item-icon')) {
            AdminParametres.closeIconPicker();
        }
    },

    /**
     * Ferme le picker d'icône
     */
    closeIconPicker() {
        const existing = document.getElementById('iconPickerDropdown');
        if (existing) {
            existing.remove();
        }
        document.removeEventListener('click', this.handleOutsideClick);
    },

    /**
     * Cycle l'état d'un élément : visible → bloqué → masqué → visible
     */
    cycleItemState(btnEl) {
        const menuItem = btnEl.closest('.menu-item');
        const currentState = menuItem.dataset.state || 'visible';

        // Cycle : visible → bloque → masque → visible
        const nextMap = { visible: 'bloque', bloque: 'masque', masque: 'visible' };
        const newState = nextMap[currentState];
        const display = this.stateDisplay[newState];

        menuItem.dataset.state = newState;
        menuItem.classList.toggle('disabled', newState === 'masque');
        btnEl.className = `menu-state-btn ${display.cssClass}`;
        btnEl.textContent = display.text;

        this.markAsChanged();
    },

    /**
     * Initialise le drag & drop
     */
    initDragDrop() {
        const items = document.querySelectorAll('.menu-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });

        const bodies = document.querySelectorAll('.menu-section-body');
        bodies.forEach(body => {
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    const afterElement = this.getDragAfterElement(body, e.clientY);
                    if (afterElement) {
                        body.insertBefore(dragging, afterElement);
                    } else {
                        body.appendChild(dragging);
                    }
                }
            });
        });
    },

    /**
     * Trouve l'élément après lequel insérer lors du drag
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.menu-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    /**
     * Marque qu'il y a des modifications
     */
    markAsChanged() {
        this.hasChanges = true;
        document.getElementById('saveBar')?.classList.add('show');
    },

    /**
     * Collecte l'état actuel du menu depuis le DOM
     */
    collectMenuState() {
        const menuItems = [];
        const menuElements = document.querySelectorAll('.menu-item');

        menuElements.forEach((el, index) => {
            const state = el.dataset.state || 'visible';
            const name = el.querySelector('.menu-item-name')?.textContent || '';
            const icon = el.dataset.icon || el.querySelector('.menu-item-icon')?.textContent || '📄';

            menuItems.push({
                element_code: el.dataset.id,
                visible: state !== 'masque',
                bloque: state === 'bloque',
                nom_affiche: name,
                icon: icon,
                ordre: index + 1
            });
        });

        return menuItems;
    },

    /**
     * Envoie une requête POST vers Google Apps Script via JSONP
     * (contourne les problèmes CORS)
     */
    postToAppsScript(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Créer le callback global
            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur inconnue'));
                }
            };

            // Créer le script JSONP
            const script = document.createElement('script');
            const params = new URLSearchParams({
                action: action,
                data: JSON.stringify(data),
                callback: callbackName
            });
            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            // Timeout de 30 secondes
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) {
                        document.body.removeChild(script);
                    }
                    reject(new Error('Timeout'));
                }
            }, 30000);

            document.body.appendChild(script);
        });
    },

    /**
     * Sauvegarde les modifications
     */
    async saveChanges() {
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '⏳ Enregistrement...';
        }

        try {
            // Collecter les données des paramètres
            const params = [
                { cle: 'site_titre', valeur: document.getElementById('siteName')?.value || '' },
                { cle: 'site_sous_titre', valeur: document.getElementById('siteSubtitle')?.value || '' },
                { cle: 'site_emoji', valeur: this.selectedEmoji },
                { cle: 'site_couleur', valeur: document.getElementById('primaryColor')?.value || '#6366f1' },
                { cle: 'classeur_url', valeur: document.getElementById('classeurUrl')?.value || '' }
            ];

            // Collecter les données du menu
            const menuItems = this.collectMenuState();

            console.log('[Parametres] Saving params:', params);
            console.log('[Parametres] Saving menu:', menuItems);

            // Envoyer les paramètres via JSONP
            const paramsResult = await this.postToAppsScript('updateParametres', params);
            console.log('[Parametres] Params saved:', paramsResult);

            // Envoyer le menu via JSONP
            const menuResult = await this.postToAppsScript('updateMenuConfig', menuItems);
            console.log('[Parametres] Menu saved:', menuResult);

            // Vider le cache pour que les nouvelles valeurs soient utilisées immédiatement
            SheetsAPI.clearCache();
            console.log('[Parametres] Cache cleared');

            this.hasChanges = false;
            document.getElementById('saveBar')?.classList.remove('show');
            alert('✅ Paramètres enregistrés !');

        } catch (error) {
            console.error('[Parametres] Erreur sauvegarde:', error);
            alert('❌ Erreur lors de la sauvegarde: ' + error.message);

        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾 Enregistrer';
            }
        }
    },

    /**
     * Annule les modifications
     */
    cancelChanges() {
        if (confirm('Annuler toutes les modifications ?')) {
            location.reload();
        }
    },

    /**
     * Ouvre le modal nouvelle catégorie
     */
    openNewCategoryModal() {
        document.getElementById('newCategoryName').value = '';
        document.querySelectorAll('#newCategoryEmoji .emoji-option').forEach((b, i) => {
            b.classList.toggle('selected', i === 0);
        });
        this.selectedCategoryEmoji = '⭐';
        document.getElementById('newCategoryModal')?.classList.add('show');
    },

    /**
     * Ferme le modal nouvelle catégorie
     */
    closeNewCategoryModal() {
        document.getElementById('newCategoryModal')?.classList.remove('show');
    },

    /**
     * Crée une nouvelle catégorie
     */
    createCategory() {
        const name = document.getElementById('newCategoryName')?.value.trim();
        if (!name) {
            alert('Veuillez entrer un nom pour la catégorie');
            return;
        }

        const container = document.getElementById('menuSectionsContainer');
        const newSection = document.createElement('div');
        newSection.className = 'menu-section';
        newSection.dataset.sectionId = name.toLowerCase().replace(/\s+/g, '-');
        newSection.innerHTML = `
            <div class="menu-section-header">
                <span class="menu-section-drag">⋮⋮</span>
                <span class="menu-section-icon">${this.selectedCategoryEmoji}</span>
                <span class="menu-section-title">${name}</span>
                <button class="menu-section-btn" title="Modifier">✏️</button>
                <button class="menu-section-btn delete" title="Supprimer">🗑️</button>
            </div>
            <div class="menu-section-body">
                <div style="padding: 20px; text-align: center; color: var(--gray-400); font-size: 13px;">
                    Glisse des éléments ici
                </div>
            </div>
        `;

        container.appendChild(newSection);
        this.closeNewCategoryModal();
        this.markAsChanged();
    },

    /**
     * Édite un élément du menu
     */
    editItem(itemId) {
        const menuItem = document.querySelector(`.menu-item[data-id="${itemId}"]`);
        if (!menuItem) return;

        const currentName = menuItem.querySelector('.menu-item-name')?.textContent || '';
        document.getElementById('editItemName').value = currentName;
        document.getElementById('editItemModal').dataset.itemId = itemId;
        document.getElementById('editItemModal')?.classList.add('show');
    },

    /**
     * Ferme le modal d'édition
     */
    closeEditModal() {
        document.getElementById('editItemModal')?.classList.remove('show');
    },

    /**
     * Sauvegarde l'édition d'un élément
     */
    saveEditItem() {
        const modal = document.getElementById('editItemModal');
        const itemId = modal?.dataset.itemId;
        const newName = document.getElementById('editItemName')?.value.trim();

        if (itemId && newName) {
            const menuItem = document.querySelector(`.menu-item[data-id="${itemId}"]`);
            if (menuItem) {
                menuItem.querySelector('.menu-item-name').textContent = newName;
                this.markAsChanged();
            }
        }

        this.closeEditModal();
    },

    /**
     * Édite une section
     */
    editSection(sectionId) {
        const section = document.querySelector(`.menu-section[data-section-id="${sectionId}"]`);
        if (!section) return;

        const title = section.querySelector('.menu-section-title')?.textContent || '';
        const newTitle = prompt('Nouveau nom de la catégorie:', title);

        if (newTitle && newTitle.trim()) {
            section.querySelector('.menu-section-title').textContent = newTitle.trim();
            this.markAsChanged();
        }
    },

    /**
     * Supprime une section
     */
    deleteSection(sectionId) {
        if (confirm('Supprimer cette catégorie et tous ses éléments ?')) {
            const section = document.querySelector(`.menu-section[data-section-id="${sectionId}"]`);
            if (section) {
                section.remove();
                this.markAsChanged();
            }
        }
    }
};

// Export global
window.AdminParametres = AdminParametres;
