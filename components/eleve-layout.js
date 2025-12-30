/**
 * Layout Élève - Composants réutilisables
 * Header + Sidebar pour toutes les pages élève
 */

const EleveLayout = {
    /**
     * Configuration du menu sidebar
     */
    menuItems: [
        {
            section: '📅 Organisation',
            items: [
                { icon: '📆', label: 'Emploi du temps', href: '/Brikks/eleve/emploi-du-temps.html', id: 'emploi-du-temps' },
                { icon: '📂', label: 'Classeur modèle', href: '/Brikks/eleve/classeur.html', id: 'classeur' }
            ]
        },
        {
            section: '📖 Cours',
            items: [
                { icon: '📖', label: 'Leçons', href: '/Brikks/eleve/lecons.html', id: 'lecons' },
                { icon: '🧠', label: 'Méthodologie', href: '/Brikks/eleve/methodologie.html', id: 'methodologie' }
            ]
        },
        {
            section: "📝 S'entraîner",
            items: [
                { icon: '🟢', label: 'Connaissances', href: '/Brikks/eleve/connaissances.html', id: 'connaissances' },
                { icon: '🟠', label: 'Savoir-faire', href: '/Brikks/eleve/savoir-faire.html', id: 'savoir-faire' },
                { icon: '🟣', label: 'Compétences', href: '/Brikks/eleve/competences.html', id: 'competences' }
            ]
        },
        {
            section: '📋 Évaluations',
            items: [
                { icon: '📋', label: 'Mes évaluations', href: '/Brikks/eleve/evaluations.html', id: 'evaluations' },
                { icon: '📊', label: 'Mes notes', href: '/Brikks/eleve/notes.html', id: 'notes' }
            ]
        },
        {
            section: '📺 Ressources',
            items: [
                { icon: '🎬', label: 'Vidéos', href: '/Brikks/eleve/videos.html', id: 'videos' },
                { icon: '💡', label: 'Recommandations', href: '/Brikks/eleve/recommandations.html', id: 'recommandations' }
            ]
        },
        {
            section: '❓ Aide',
            items: [
                { icon: '❓', label: 'FAQ', href: '/Brikks/eleve/faq.html', id: 'faq' },
                { icon: '✉️', label: 'Messagerie', href: '/Brikks/eleve/messagerie.html', id: 'messagerie' }
            ]
        }
    ],

    /**
     * Vérifie si on est en mode prévisualisation
     */
    isPreviewMode() {
        return sessionStorage.getItem('brikks_preview') === 'true';
    },

    /**
     * Génère la bannière de prévisualisation
     */
    getPreviewBannerHTML() {
        if (!this.isPreviewMode()) return '';

        return `
            <div class="preview-banner" id="preview-banner">
                <span>👁️ Mode prévisualisation</span>
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
        return `
            ${this.getPreviewBannerHTML()}
            <header class="eleve-header${this.isPreviewMode() ? ' with-preview-banner' : ''}">
                <div class="header-left">
                    <button class="menu-toggle" id="menuToggle" title="Menu">
                        ☰
                    </button>
                    <a href="/Brikks/eleve/" class="logo">
                        <div class="logo-icon">📚</div>
                        <div class="logo-text">Brikks <span>• Espace élève</span></div>
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

        this.menuItems.forEach(section => {
            menuHTML += `
                <div class="sidebar-section">
                    <div class="sidebar-section-title">${section.section}</div>
                    ${section.items.map(item => `
                        <a href="${item.href}" class="sidebar-item" data-page="${item.id}">
                            <span class="sidebar-item-icon">${item.icon}</span>
                            <span class="sidebar-item-text">${item.label}</span>
                        </a>
                    `).join('')}
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
    init(pageId, pageTitle) {
        // Vérifier l'accès
        const user = Auth.checkAccess(['eleve', 'élève', 'etudiant', 'étudiant']);
        if (!user) return;

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
     * Initialise les événements
     */
    initEvents() {
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
