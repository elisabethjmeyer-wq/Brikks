/**
 * Layout Admin - Composants réutilisables
 * Sidebar + Top Bar pour toutes les pages admin
 */

const AdminLayout = {
    /**
     * Configuration du menu sidebar
     */
    menuItems: [
        {
            section: '📌 Principal',
            items: [
                { icon: '🏠', label: "Page d'accueil", href: '/Brikks/admin/', id: 'accueil' },
                { icon: '📬', label: 'Messagerie', href: '/Brikks/admin/messagerie.html', id: 'messagerie' }
            ]
        },
        {
            section: '📚 Ressources',
            items: [
                { icon: '📖', label: 'Leçons', href: '/Brikks/admin/lecons.html', id: 'lecons' },
                { icon: '🧠', label: 'Méthodologie', href: '/Brikks/admin/methodologie.html', id: 'methodologie' },
                { icon: '🎬', label: 'Vidéos', href: '/Brikks/admin/videos.html', id: 'videos' },
                { icon: '💡', label: 'Recommandations', href: '/Brikks/admin/recommandations.html', id: 'recommandations' },
                { icon: '❓', label: 'FAQ', href: '/Brikks/admin/faq.html', id: 'faq' }
            ]
        },
        {
            section: '🎯 Exercices',
            items: [
                { icon: '📚', label: "Banques d'exercices", href: '/Brikks/admin/banques-exercices.html', id: 'banques-exercices' }
            ]
        },
        {
            section: '📊 Évaluations',
            items: [
                { icon: '📋', label: 'Évaluations', href: '/Brikks/admin/evaluations.html', id: 'evaluations' },
                { icon: '🟣', label: 'Compétences', href: '/Brikks/admin/competences.html', id: 'competences' },
                { icon: '✏️', label: 'Corrections', href: '/Brikks/admin/corrections.html', id: 'corrections', badge: true },
                { icon: '📊', label: 'Notes', href: '/Brikks/admin/notes.html', id: 'notes' },
                { icon: '👁️', label: 'Suivi', href: '/Brikks/admin/suivi.html', id: 'suivi' }
            ]
        },
        {
            section: '⚙️ Configuration',
            items: [
                { icon: '👥', label: 'Utilisateurs', href: '/Brikks/admin/utilisateurs.html', id: 'utilisateurs' },
                { icon: '⚙️', label: 'Paramètres', href: '/Brikks/admin/parametres.html', id: 'parametres' }
            ]
        }
    ],

    /**
     * Génère le HTML de la sidebar
     */
    getSidebarHTML() {
        let menuHTML = '';

        this.menuItems.forEach(section => {
            menuHTML += `
                <div class="sidebar-section">
                    <div class="sidebar-section-title">${section.section}</div>
                    ${section.items.map(item => `
                        <a href="${item.href}" class="sidebar-link" data-page="${item.id}">
                            <span class="icon">${item.icon}</span>
                            ${item.label}
                            ${item.badge ? `<span class="menu-badge" id="badge-${item.id}" style="display:none;">0</span>` : ''}
                        </a>
                    `).join('')}
                </div>
            `;
        });

        return `
            <aside class="admin-sidebar" id="admin-sidebar">
                <div class="admin-logo">
                    <h1>
                        <span>📚</span>
                        Brikks
                        <span class="badge">Admin</span>
                    </h1>
                </div>
                <nav>
                    ${menuHTML}
                </nav>
            </aside>
        `;
    },

    /**
     * Génère le HTML de la top bar
     */
    getTopBarHTML(pageTitle = "Page d'accueil") {
        return `
            <header class="top-bar">
                <div class="top-bar-left">
                    <button class="toggle-sidebar-btn" onclick="AdminLayout.toggleSidebar()" title="Afficher/Masquer le menu">
                        ☰
                    </button>
                    <div class="top-bar-breadcrumb">
                        <a href="/Brikks/admin/">Admin</a>
                        <span class="separator">/</span>
                        <span id="breadcrumb-current">${pageTitle}</span>
                    </div>
                </div>
                <div class="top-bar-right">
                    <button class="top-bar-btn" title="Prévisualiser le site élève" onclick="AdminLayout.openPreview()">
                        👁️
                    </button>
                    <div class="notification-wrapper" id="notification-wrapper">
                        <button class="top-bar-btn notification-btn" title="Copies à corriger" onclick="AdminLayout.toggleNotificationDropdown(event)">
                            🔔
                            <span class="notification-badge" id="header-notification-badge" style="display:none;">0</span>
                        </button>
                        <div class="notification-dropdown" id="notification-dropdown" style="display:none;">
                            <div class="notification-dropdown-header">Notifications</div>
                            <div class="notification-dropdown-body" id="notification-dropdown-body">
                                Aucune notification
                            </div>
                        </div>
                    </div>
                    <div class="top-bar-user" onclick="AdminLayout.toggleUserMenu()">
                        <div class="top-bar-user-avatar" id="user-avatar">--</div>
                        <div class="top-bar-user-info">
                            <div class="top-bar-user-name" id="user-name">Chargement...</div>
                            <div class="top-bar-user-role" id="user-role">Professeur</div>
                        </div>
                        <div class="user-dropdown" id="user-dropdown">
                            <button class="user-dropdown-item danger" onclick="Auth.logout()">
                                <span>🚪</span>
                                Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    /**
     * Initialise le layout admin
     * @param {string} pageId - ID de la page active (pour highlight menu)
     * @param {string} pageTitle - Titre pour le fil d'Ariane
     */
    async init(pageId, pageTitle) {
        // Cacher le contenu pendant le chargement du layout
        document.body.classList.add('loading-layout');

        // Vérifier l'accès
        const user = Auth.checkAccess(['prof', 'admin', 'professeur']);
        if (!user) return;

        // Créer le conteneur layout
        const body = document.body;
        const existingContent = body.innerHTML;

        body.innerHTML = `
            <div class="layout">
                ${this.getSidebarHTML()}
                <main class="main-content" id="main-content">
                    ${this.getTopBarHTML(pageTitle)}
                    <div class="page-content">
                        ${existingContent}
                    </div>
                </main>
            </div>
        `;

        // Highlight le menu actif
        this.setActiveMenu(pageId);

        // Afficher les infos utilisateur (données en cache)
        this.displayUserInfo(user);

        // Événements
        this.initEvents();

        // Afficher le contenu (layout prêt)
        body.classList.remove('loading-layout');
        body.classList.add('layout-ready');

        // Rafraîchir les données utilisateur depuis Google Sheets (async)
        const updatedUser = await Auth.refreshCurrentUser();
        if (updatedUser) {
            this.displayUserInfo(updatedUser);
        }

        // Vérifier les notifications (copies à corriger, etc.)
        this.checkPendingActivities();

        // Si on est sur la page corrections, marquer comme vu
        if (pageId === 'corrections') {
            this._onCorrectionsPage = true;
        }
    },

    /**
     * Highlight le menu actif
     */
    setActiveMenu(pageId) {
        const links = document.querySelectorAll('.sidebar-link');
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
            : (user.identifiant || 'A')[0].toUpperCase();
        document.getElementById('user-avatar').textContent = initials;

        // Nom complet
        const displayName = (prenom && nom) ? `${prenom} ${nom}` : user.identifiant;
        document.getElementById('user-name').textContent = displayName;
    },

    /**
     * Toggle sidebar
     */
    toggleSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        const mainContent = document.getElementById('main-content');
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    },

    /**
     * Toggle menu utilisateur
     */
    toggleUserMenu() {
        const dropdown = document.getElementById('user-dropdown');
        dropdown.classList.toggle('show');
    },

    /**
     * Initialise les événements (une seule fois)
     */
    initEvents() {
        // Éviter l'initialisation multiple
        if (this._eventsInitialized) return;
        this._eventsInitialized = true;

        // Fermer le menu utilisateur et le dropdown notifications si clic ailleurs
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.top-bar-user');
            const dropdown = document.getElementById('user-dropdown');
            if (userMenu && dropdown && !userMenu.contains(e.target)) {
                dropdown.classList.remove('show');
            }

            var notifWrapper = document.getElementById('notification-wrapper');
            var notifDropdown = document.getElementById('notification-dropdown');
            if (notifWrapper && notifDropdown && !notifWrapper.contains(e.target)) {
                notifDropdown.style.display = 'none';
            }
        });
    },

    /**
     * Ouvre le mode prévisualisation élève
     */
    openPreview() {
        // Stocker le flag de prévisualisation
        sessionStorage.setItem('brikks_preview', 'true');
        // Rediriger vers l'espace élève
        window.location.href = '/Brikks/eleve/';
    },

    /**
     * Redirige vers la page Corrections
     */
    goToCorrections() {
        window.location.href = '/Brikks/admin/corrections.html';
    },

    /**
     * Toggle le dropdown de notifications
     */
    toggleNotificationDropdown(e) {
        if (e) e.stopPropagation();
        var dropdown = document.getElementById('notification-dropdown');
        if (!dropdown) return;

        var isVisible = dropdown.style.display !== 'none';
        if (isVisible) {
            dropdown.style.display = 'none';
        } else {
            dropdown.style.display = 'block';
            // Marquer comme vu → cacher les badges
            this._markNotificationsAsSeen();
        }
    },

    /**
     * Marque les notifications comme vues (localStorage)
     */
    _markNotificationsAsSeen() {
        var count = this._pendingCount || 0;
        try {
            localStorage.setItem('brikks_notif_seen_count', String(count));
        } catch (_e) { /* ignore */ }
        // Cacher les badges
        var headerBadge = document.getElementById('header-notification-badge');
        if (headerBadge) headerBadge.style.display = 'none';
        var menuBadge = document.getElementById('badge-corrections');
        if (menuBadge) menuBadge.style.display = 'none';
    },

    /**
     * Construit le contenu du dropdown de notifications
     */
    _renderNotificationDropdown(pendingSubmissions) {
        var body = document.getElementById('notification-dropdown-body');
        if (!body) return;

        if (!pendingSubmissions || pendingSubmissions.length === 0) {
            body.innerHTML = '<div class="notification-empty">Aucune copie à corriger</div>';
            return;
        }

        var count = pendingSubmissions.length;
        var html = '<a href="/Brikks/admin/corrections.html" class="notification-item">';
        html += '<span class="notification-item-icon">✏️</span>';
        html += '<span class="notification-item-text">' + count + ' copie' + (count > 1 ? 's' : '') + ' à corriger</span>';
        html += '</a>';
        body.innerHTML = html;
    },

    /**
     * Met à jour les badges de notification
     */
    updateNotificationBadges(count) {
        // Badge dans le header
        const headerBadge = document.getElementById('header-notification-badge');
        if (headerBadge) {
            if (count > 0) {
                headerBadge.textContent = count > 99 ? '99+' : count;
                headerBadge.style.display = 'flex';
            } else {
                headerBadge.style.display = 'none';
            }
        }

        // Badge dans le menu Corrections
        const menuBadge = document.getElementById('badge-corrections');
        if (menuBadge) {
            if (count > 0) {
                menuBadge.textContent = count > 99 ? '99+' : count;
                menuBadge.style.display = 'flex';
            } else {
                menuBadge.style.display = 'none';
            }
        }
    },

    /**
     * Vérifie les activités en attente (copies à corriger, etc.)
     */
    async checkPendingActivities() {
        try {
            var result = await this.callAPI('getEleveTachesComplexes', {});
            if (result.success && result.data) {
                var pending = result.data.filter(function(t) { return t.statut === 'soumis'; });
                var count = pending.length;
                this._pendingCount = count;

                // Construire le contenu du dropdown
                this._renderNotificationDropdown(pending);

                // Si on est sur la page corrections, marquer comme vu automatiquement
                if (this._onCorrectionsPage) {
                    try { localStorage.setItem('brikks_notif_seen_count', String(count)); } catch (_e) { /* ignore */ }
                    this.updateNotificationBadges(0);
                } else {
                    // Vérifier si l'utilisateur a déjà vu ce nombre
                    var seenCount = 0;
                    try { seenCount = parseInt(localStorage.getItem('brikks_notif_seen_count') || '0', 10); } catch (_e) { /* ignore */ }

                    // Afficher les badges seulement si nouvelles soumissions depuis la dernière consultation
                    if (count > seenCount) {
                        this.updateNotificationBadges(count);
                    } else {
                        this.updateNotificationBadges(0);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur vérification activités:', error);
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
    }
};

// Export global
window.AdminLayout = AdminLayout;
