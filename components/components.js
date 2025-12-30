/**
 * Composants réutilisables Brikks
 * Sidebar, Header, et fonctions communes
 */

const Components = {
    /**
     * Génère les initiales d'un utilisateur
     */
    getInitials(user) {
        const prenom = (user.prenom || '').trim();
        const nom = (user.nom || '').trim();
        if (prenom && nom) {
            return (prenom[0] + nom[0]).toUpperCase();
        }
        return (user.identifiant || 'U')[0].toUpperCase();
    },

    /**
     * Génère le nom d'affichage
     */
    getDisplayName(user) {
        const prenom = (user.prenom || '').trim();
        const nom = (user.nom || '').trim();
        if (prenom && nom) {
            return `${prenom} ${nom}`;
        }
        return user.identifiant || 'Utilisateur';
    },

    /**
     * Toggle sidebar (admin)
     */
    toggleAdminSidebar() {
        const sidebar = document.querySelector('.admin-sidebar');
        const mainContent = document.querySelector('.main-content');
        if (sidebar && mainContent) {
            sidebar.classList.toggle('collapsed');
            mainContent.classList.toggle('expanded');
        }
    },

    /**
     * Toggle sidebar (élève)
     */
    toggleEleveSidebar() {
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
    closeEleveSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');
        if (sidebar) {
            sidebar.classList.remove('open');
            overlay?.classList.remove('show');
            menuToggle?.classList.remove('active');
        }
    },

    /**
     * Toggle menu utilisateur
     */
    toggleUserMenu() {
        const dropdown = document.getElementById('user-dropdown');
        const userPill = document.getElementById('userPill');
        if (dropdown) {
            dropdown.classList.toggle('show');
            userPill?.classList.toggle('active');
        }
    },

    /**
     * Initialise les événements communs
     */
    initCommonEvents() {
        // Fermer le menu utilisateur si clic ailleurs
        document.addEventListener('click', function(e) {
            const userMenu = document.querySelector('.top-bar-user, .user-menu');
            const dropdown = document.getElementById('user-dropdown');
            if (userMenu && dropdown && !userMenu.contains(e.target)) {
                dropdown.classList.remove('show');
                document.getElementById('userPill')?.classList.remove('active');
            }
        });
    },

    /**
     * Initialise la page avec les données utilisateur
     */
    initUserDisplay(user) {
        // Initiales
        const avatarEl = document.querySelector('.top-bar-user-avatar, .user-avatar');
        if (avatarEl) {
            avatarEl.textContent = this.getInitials(user);
        }

        // Nom complet
        const nameEl = document.querySelector('.top-bar-user-name, .user-name');
        if (nameEl) {
            nameEl.textContent = this.getDisplayName(user);
        }

        // Rôle
        const roleEl = document.querySelector('.top-bar-user-role');
        if (roleEl) {
            const role = (user.role || '').toLowerCase();
            roleEl.textContent = role === 'prof' ? 'Professeur' : 'Élève';
        }

        // Classe (pour élève)
        const classEl = document.querySelector('.user-class');
        if (classEl && user.classe_id) {
            classEl.textContent = user.classe_id;
        }
    },

    /**
     * Gère le responsive de la sidebar élève
     */
    handleEleveResize() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const menuToggle = document.getElementById('menuToggle');

        if (!sidebar) return;

        if (window.innerWidth >= 1024) {
            overlay?.classList.remove('show');
            sidebar.classList.remove('open');
            if (!sidebar.classList.contains('closed')) {
                menuToggle?.classList.add('active');
            }
        } else {
            sidebar.classList.add('closed');
            menuToggle?.classList.remove('active');
        }
    }
};

// Export pour utilisation globale
window.Components = Components;
