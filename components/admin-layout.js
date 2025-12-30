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
                { icon: '📐', label: 'Banque de formats', href: '/Brikks/admin/formats.html', id: 'formats' },
                { icon: '🧩', label: "Banque d'éléments", href: '/Brikks/admin/elements.html', id: 'elements' },
                { icon: '📝', label: 'Entraînements', href: '/Brikks/admin/entrainements.html', id: 'entrainements' }
            ]
        },
        {
            section: '📊 Évaluations',
            items: [
                { icon: '📋', label: 'Évaluations', href: '/Brikks/admin/evaluations.html', id: 'evaluations' },
                { icon: '🟣', label: 'Compétences', href: '/Brikks/admin/competences.html', id: 'competences' },
                { icon: '📊', label: 'Notes & Suivi', href: '/Brikks/admin/notes.html', id: 'notes' }
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
                    <button class="top-bar-btn" title="Notifications">
                        🔔
                    </button>
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
    init(pageId, pageTitle) {
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

        // Afficher les infos utilisateur
        this.displayUserInfo(user);

        // Événements
        this.initEvents();
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
     * Initialise les événements
     */
    initEvents() {
        // Fermer le menu utilisateur si clic ailleurs
        document.addEventListener('click', (e) => {
            const userMenu = document.querySelector('.top-bar-user');
            const dropdown = document.getElementById('user-dropdown');
            if (userMenu && dropdown && !userMenu.contains(e.target)) {
                dropdown.classList.remove('show');
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
    }
};

// Export global
window.AdminLayout = AdminLayout;
