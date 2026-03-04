/**
 * Layout Élève - Composants réutilisables
 * Header + Sidebar pour toutes les pages élève
 * Charge dynamiquement les paramètres et la config du menu
 */

const EleveLayout = {
    /**
     * Configuration par défaut du menu (fallback)
     */
    defaultMenuItems: [
        {
            section: '📅 Organisation',
            sectionId: 'organisation',
            items: [
                { icon: '📆', label: 'Emploi du temps', href: '/Brikks/eleve/emploi-du-temps.html', id: 'emploi-du-temps' },
                { icon: '📂', label: 'Classeur modèle', href: '/Brikks/eleve/classeur.html', id: 'classeur' }
            ]
        },
        {
            section: '📖 Cours',
            sectionId: 'cours',
            items: [
                { icon: '📖', label: 'Leçons', href: '/Brikks/eleve/lecons.html', id: 'lecons' },
                { icon: '🧠', label: 'Méthodologie', href: '/Brikks/eleve/methodologie.html', id: 'methodologie' }
            ]
        },
        {
            section: "📝 S'entraîner",
            sectionId: 'entrainement',
            items: [
                { icon: '🔵', label: 'Connaissances', href: '/Brikks/eleve/entrainements-conn.html', id: 'connaissances' },
                { icon: '🟠', label: 'Savoir-faire', href: '/Brikks/eleve/entrainements-sf.html', id: 'savoir-faire' },
                { icon: '🔴', label: 'Compétences', href: '/Brikks/eleve/entrainements-comp.html', id: 'competences' }
            ]
        },
        {
            section: '📋 Évaluations',
            sectionId: 'evaluations',
            items: [
                { icon: '📋', label: 'Mes évaluations', href: '/Brikks/eleve/evaluations.html', id: 'evaluations' },
                { icon: '📊', label: 'Mes notes', href: '/Brikks/eleve/notes.html', id: 'notes' }
            ]
        },
        {
            section: '📺 Ressources',
            sectionId: 'ressources',
            items: [
                { icon: '🎬', label: 'Vidéos', href: '/Brikks/eleve/videos.html', id: 'videos' },
                { icon: '💡', label: 'Recommandations', href: '/Brikks/eleve/recommandations.html', id: 'recommandations' }
            ]
        },
        {
            section: '❓ Aide',
            sectionId: 'aide',
            items: [
                { icon: '❓', label: 'FAQ', href: '/Brikks/eleve/faq.html', id: 'faq' },
                { icon: '✉️', label: 'Messagerie', href: '/Brikks/eleve/messagerie.html', id: 'messagerie' }
            ]
        }
    ],

    // Menu items actif (sera mis à jour dynamiquement)
    menuItems: [],

    // Feuilles communes à précharger pour navigation instantanée
    commonSheets: [
        'DISCIPLINES',
        'THEMES',
        'CHAPITRES',
        'VIDEOS',
        'RECOMMANDATIONS',
        'METHODOLOGIE'
    ],

    // Paramètres du site
    siteParams: {
        titre: 'Brikks',
        sousTitre: 'Espace élève',
        emoji: '📚',
        couleur: '#6366f1'
    },

    /**
     * Vérifie si on est en mode prévisualisation
     */
    isPreviewMode() {
        return sessionStorage.getItem('brikks_preview') === 'true';
    },

    /**
     * Charge les paramètres du site depuis PARAMETRES
     */
    async loadSiteParams() {
        try {
            const params = await SheetsAPI.fetchAndParse('PARAMETRES');

            params.forEach(p => {
                const key = p.cle || p.parametre || p.nom || p.key;
                const value = p.valeur || p.value || '';

                switch (key) {
                    case 'site_titre':
                        if (value) this.siteParams.titre = value;
                        break;
                    case 'site_sous_titre':
                        if (value) this.siteParams.sousTitre = value;
                        break;
                    case 'site_emoji':
                        if (value) this.siteParams.emoji = value;
                        break;
                    case 'site_couleur':
                        if (value) this.siteParams.couleur = value;
                        break;
                }
            });

        } catch (error) {
            // parse error expected
        }
    },

    /**
     * Charge la configuration du menu depuis CONFIG_MENU
     */
    /**
     * Parse une valeur booléenne provenant de Google Sheets (TRUE/true/1/oui/yes)
     */
    parseBool(val) {
        const v = String(val || '').toLowerCase().trim();
        return v === 'true' || v === '1' || v === 'oui' || v === 'yes';
    },

    async loadMenuConfig() {
        try {
            const menuConfig = await SheetsAPI.fetchAndParse('CONFIG_MENU');
            const isPreview = this.isPreviewMode();

            if (menuConfig && menuConfig.length > 0) {
                // Grouper par catégorie
                const grouped = {};

                menuConfig.forEach(item => {
                    const isVisible = this.parseBool(item.visible);
                    const isBloque = this.parseBool(item.bloque);

                    // 3 états : visible, bloque (dans le menu mais cadenas), masque (absent du menu)
                    // masque = visible:false → on l'exclut complètement SAUF en mode preview
                    if (!isVisible && !isPreview) return;

                    const cat = item.categorie || 'Autres';
                    if (!grouped[cat]) {
                        grouped[cat] = {
                            section: `${item.categorie_icon || '📁'} ${cat}`,
                            sectionId: cat.toLowerCase().replace(/\s+/g, '-'),
                            items: []
                        };
                    }

                    const elementCode = item.element_code || item.id;
                    const pageMapping = {
                        'accueil': '',
                        'index': '',
                        'savoir-faire': 'entrainements-sf',
                        'connaissances': 'entrainements-conn',
                        'competences': 'entrainements-comp'
                    };
                    const pageName = pageMapping[elementCode] !== undefined
                        ? pageMapping[elementCode]
                        : elementCode;
                    const href = pageName === ''
                        ? '/Brikks/eleve/'
                        : `/Brikks/eleve/${pageName}.html`;

                    // En mode preview : tout est cliquable, on stocke l'état réel pour les badges
                    // En mode normal : bloqué = disabled, masqué = déjà filtré au-dessus
                    grouped[cat].items.push({
                        icon: item.icon || '📄',
                        label: item.nom_affiche || item.nom,
                        href: href,
                        id: elementCode,
                        disabled: isPreview ? false : isBloque,
                        state: !isVisible ? 'masque' : (isBloque ? 'bloque' : 'visible')
                    });
                });

                // Filtrer les sections vides (catégories dont tous les items sont masqués)
                const sections = Object.values(grouped).filter(s => s.items.length > 0);

                if (sections.length > 0) {
                    this.menuItems = sections;
                    return;
                }
            }

            this.menuItems = this.defaultMenuItems;
        } catch (error) {
            this.menuItems = this.defaultMenuItems;
        }
    },

    /**
     * Applique la couleur primaire personnalisée
     */
    applyCustomColor() {
        if (this.siteParams.couleur && this.siteParams.couleur !== '#6366f1') {
            document.documentElement.style.setProperty('--primary', this.siteParams.couleur);
            // Calculer une version plus sombre pour hover
            const darkerColor = this.adjustColor(this.siteParams.couleur, -20);
            document.documentElement.style.setProperty('--primary-dark', darkerColor);
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
     * Génère la bannière de prévisualisation
     */
    getPreviewBannerHTML() {
        if (!this.isPreviewMode()) return '';

        return `
            <div class="preview-banner" id="preview-banner">
                <span>👁️ Mode test — Vous voyez toutes les pages (les élèves non)</span>
                <button class="preview-banner-btn" onclick="EleveLayout.exitPreview()">
                    ← Retour admin
                </button>
            </div>
        `;
    },

    /**
     * Quitte le mode prévisualisation
     */
    exitPreview() {
        sessionStorage.removeItem('brikks_preview');
        window.location.href = '/Brikks/admin/';
    },

    /**
     * Génère le HTML du header
     */
    getHeaderHTML() {
        const { titre, sousTitre, emoji } = this.siteParams;

        return `
            ${this.getPreviewBannerHTML()}
            <header class="eleve-header${this.isPreviewMode() ? ' with-preview-banner' : ''}">
                <div class="header-left">
                    <button class="menu-toggle" id="menuToggle" title="Menu">
                        ☰
                    </button>
                    <a href="/Brikks/eleve/" class="logo">
                        <div class="logo-icon">${emoji}</div>
                        <div class="logo-text">${titre} <span>• ${sousTitre}</span></div>
                    </a>
                </div>
                <div class="header-right">
                    <div class="user-menu">
                        <div class="user-pill" id="userPill">
                            <div class="user-avatar" id="user-avatar">--</div>
                            <div class="user-info">
                                <div class="user-name" id="user-name">Chargement...</div>
                                <div class="user-class" id="user-class"></div>
                            </div>
                            <span class="user-chevron">▼</span>
                        </div>
                        <div class="user-dropdown" id="user-dropdown">
                            <button class="user-dropdown-item danger" onclick="Auth.logout()">
                                🚪 Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    /**
     * Génère le HTML de la sidebar
     */
    getSidebarHTML() {
        let menuHTML = '';
        const isPreview = this.isPreviewMode();

        this.menuItems.forEach(section => {
            menuHTML += `
                <div class="sidebar-section">
                    <div class="sidebar-section-title">${section.section}</div>
                    ${section.items.map(item => {
                        // Badge de preview (état réel de la page pour les élèves)
                        const previewBadge = isPreview && item.state && item.state !== 'visible'
                            ? `<span class="sidebar-preview-badge ${item.state}">${item.state === 'masque' ? 'masqué' : 'bloqué'}</span>`
                            : '';

                        if (item.disabled && !isPreview) {
                            // Élément bloqué pour les élèves : dans le menu mais grisé
                            return `
                                <div class="sidebar-item disabled" data-page="${item.id}" title="Non disponible">
                                    <span class="sidebar-item-icon">${item.icon}</span>
                                    <span class="sidebar-item-text">${item.label}</span>
                                    <span class="sidebar-item-lock">🔒</span>
                                </div>
                            `;
                        } else {
                            // Élément cliquable (normal ou preview)
                            return `
                                <a href="${item.href}" class="sidebar-item${isPreview && item.state !== 'visible' ? ' preview-alt' : ''}" data-page="${item.id}">
                                    <span class="sidebar-item-icon">${item.icon}</span>
                                    <span class="sidebar-item-text">${item.label}</span>
                                    ${previewBadge}
                                </a>
                            `;
                        }
                    }).join('')}
                </div>
            `;
        });

        return `
            <aside class="eleve-sidebar" id="sidebar">
                <div class="sidebar-inner">
                    ${menuHTML}
                </div>
            </aside>
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
        `;
    },

    /**
     * Génère le fil d'Ariane
     */
    getBreadcrumbHTML(pageTitle = 'Accueil') {
        return `
            <nav class="breadcrumb">
                <a href="/Brikks/eleve/">🏠 Accueil</a>
                ${pageTitle !== 'Accueil' ? `
                    <span class="separator">›</span>
                    <span class="current">${pageTitle}</span>
                ` : ''}
            </nav>
        `;
    },

    /**
     * Initialise le layout élève
     * @param {string} pageId - ID de la page active (pour highlight menu)
     * @param {string} pageTitle - Titre pour le fil d'Ariane
     */
    async init(pageId, pageTitle) {
        // Cacher le contenu pendant le chargement du layout
        document.body.classList.add('loading-layout');

        // Vérifier l'accès
        const user = Auth.checkAccess(['eleve', 'élève', 'etudiant', 'étudiant']);
        if (!user) return;

        // Charger les paramètres et config du menu en parallèle
        await Promise.all([
            this.loadSiteParams(),
            this.loadMenuConfig()
        ]);

        // Appliquer la couleur personnalisée
        this.applyCustomColor();

        // Créer le conteneur layout
        const body = document.body;
        const existingContent = body.innerHTML;

        body.innerHTML = `
            ${this.getHeaderHTML()}
            ${this.getSidebarHTML()}
            <main class="eleve-main" id="main">
                ${this.getBreadcrumbHTML(pageTitle)}
                ${existingContent}
            </main>
        `;

        // Highlight le menu actif
        this.setActiveMenu(pageId);

        // Afficher les infos utilisateur
        this.displayUserInfo(user);

        // Événements
        this.initEvents();

        // Initialiser sidebar selon la taille écran
        this.initSidebar();

        // Afficher le contenu (layout prêt)
        body.classList.remove('loading-layout');
        body.classList.add('layout-ready');

        // Tracker la visite de page (non bloquant)
        this.trackPageVisit(user, pageId);

        // Précharger les données communes pour navigation instantanée (non bloquant)
        this.preloadCommonData();
    },

    /**
     * Précharge les données communes pour que les navigations soient instantanées
     * Utilise le cache localStorage de SheetsAPI
     */
    async preloadCommonData() {
        try {
            // Précharger en arrière-plan sans bloquer
            await SheetsAPI.preload(this.commonSheets);
        } catch (error) {
            // Ignorer les erreurs de préchargement
        }
    },

    /**
     * Enregistre la visite de page pour le suivi
     */
    async trackPageVisit(user, pageId) {
        // Ne pas tracker en mode prévisualisation
        if (this.isPreviewMode()) return;

        try {
            await this.callAPI('trackEleveConnexion', {
                eleve_id: user.id,
                page: pageId || window.location.pathname,
                action: 'visit',
                user_agent: navigator.userAgent.substring(0, 200)
            });
        } catch (error) {
            // Ignorer les erreurs de tracking
        }
    },

    /**
     * Appel API simplifié
     */
    callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const url = new URL(CONFIG.WEBAPP_URL);
            url.searchParams.append('action', action);
            url.searchParams.append('callback', callbackName);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            });

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(response);
            };

            const script = document.createElement('script');
            script.src = url.toString();
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };
            document.body.appendChild(script);
        });
    },

    /**
     * Highlight le menu actif
     */
    setActiveMenu(pageId) {
        const links = document.querySelectorAll('.sidebar-item');
        links.forEach(link => {
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            }
        });
    },

    /**
     * Affiche les infos utilisateur
     */
    displayUserInfo(user) {
        const prenom = (user.prenom || '').trim();
        const nom = (user.nom || '').trim();

        // Initiales
        const initials = (prenom && nom)
            ? (prenom[0] + nom[0]).toUpperCase()
            : (user.identifiant || 'E')[0].toUpperCase();
        document.getElementById('user-avatar').textContent = initials;

        // Nom complet
        const displayName = (prenom && nom) ? `${prenom} ${nom}` : user.identifiant;
        document.getElementById('user-name').textContent = displayName;

        // Classe
        if (user.classe_id) {
            document.getElementById('user-class').textContent = user.classe_id;
        }
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        const main = document.getElementById('main');
        const isDesktop = window.innerWidth >= 1024;

        if (isDesktop) {
            sidebar.classList.toggle('closed');
            main.classList.toggle('expanded');
            menuToggle.classList.toggle('active', !sidebar.classList.contains('closed'));
        } else {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show', sidebar.classList.contains('open'));
            menuToggle.classList.toggle('active', sidebar.classList.contains('open'));
        }
    },

    /**
     * Ferme la sidebar (mobile)
     */
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        menuToggle.classList.remove('active');
    },

    /**
     * Toggle menu utilisateur
     */
    toggleUserMenu() {
        const userPill = document.getElementById('userPill');
        const dropdown = document.getElementById('user-dropdown');
        userPill.classList.toggle('active');
        dropdown.classList.toggle('show');
    },

    /**
     * Initialise la sidebar selon la taille d'écran
     */
    initSidebar() {
        const menuToggle = document.getElementById('menuToggle');
        if (window.innerWidth >= 1024) {
            menuToggle.classList.add('active');
        }
    },

    /**
     * Initialise les événements (une seule fois)
     */
    initEvents() {
        // Éviter l'initialisation multiple
        if (this._eventsInitialized) return;
        this._eventsInitialized = true;

        const menuToggle = document.getElementById('menuToggle');
        const userPill = document.getElementById('userPill');
        const overlay = document.getElementById('sidebarOverlay');

        // Toggle sidebar
        menuToggle.addEventListener('click', () => this.toggleSidebar());

        // Toggle menu utilisateur
        userPill.addEventListener('click', () => this.toggleUserMenu());

        // Fermer sidebar sur overlay
        overlay.addEventListener('click', () => this.closeSidebar());

        // Fermer menu utilisateur si clic ailleurs
        document.addEventListener('click', (e) => {
            if (!userPill.contains(e.target)) {
                userPill.classList.remove('active');
                document.getElementById('user-dropdown').classList.remove('show');
            }
        });

        // Gérer le resize
        window.addEventListener('resize', () => {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');

            if (window.innerWidth >= 1024) {
                overlay.classList.remove('show');
                sidebar.classList.remove('open');
                if (!sidebar.classList.contains('closed')) {
                    menuToggle.classList.add('active');
                }
            } else {
                sidebar.classList.add('closed');
                menuToggle.classList.remove('active');
            }
        });
    }
};

// Export global
window.EleveLayout = EleveLayout;
