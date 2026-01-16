/**
 * Admin Utilisateurs - Gestion des utilisateurs
 */

const AdminUtilisateurs = {
    // Données
    users: [],
    classes: [],        // Liste des classes [{id, nom, annee_scolaire}]
    classesMap: {},     // Mapping id -> nom pour affichage
    groupes: [],        // Liste des groupes [{id, nom, classe_id, type}]
    groupesMap: {},     // Mapping id -> nom pour affichage

    // Pagination
    currentPage: 1,
    itemsPerPage: 10,

    // Filtres
    filters: { search: '', classe: '', groupe: '', role: '' },

    // Couleurs pour les avatars par rôle
    avatarColors: {
        eleve: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        prof: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        professeur: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        invite: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderStats();
            this.renderFilters();
            this.renderTable();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        // Charger utilisateurs, classes et groupes en parallèle
        const [users, classesData, groupesData] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.UTILISATEURS),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CLASSES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.GROUPES)
        ]);

        this.users = users || [];

        // Charger les classes depuis l'onglet CLASSES
        this.classes = classesData || [];
        this.classesMap = {};
        this.classes.forEach(c => {
            this.classesMap[c.id] = c.nom || c.id;
        });

        // Charger les groupes depuis l'onglet GROUPES
        this.groupes = groupesData || [];
        this.groupesMap = {};
        this.groupes.forEach(g => {
            this.groupesMap[g.id] = g.nom || g.id;
        });

        console.log('Données chargées:', {
            users: this.users.length,
            classes: this.classes.length,
            groupes: this.groupes.length
        });
    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('users-content');
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';
    },

    /**
     * Affiche les statistiques
     */
    renderStats() {
        const total = this.users.length;
        const eleves = this.users.filter(u => (u.role || '').toLowerCase() === 'eleve').length;
        const profs = this.users.filter(u => ['prof', 'professeur'].includes((u.role || '').toLowerCase())).length;
        const invites = this.users.filter(u => (u.role || '').toLowerCase() === 'invite').length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statEleves').textContent = eleves;
        document.getElementById('statProfs').textContent = profs;
        document.getElementById('statInvites').textContent = invites;
    },

    /**
     * Affiche les options des filtres
     */
    renderFilters() {
        // Classes - afficher le nom, stocker l'ID
        const classeSelect = document.getElementById('filterClasse');
        classeSelect.innerHTML = '<option value="">Toutes les classes</option>';
        this.classes.forEach(c => {
            const displayName = c.nom || c.id;
            classeSelect.innerHTML += `<option value="${c.id}">${displayName}</option>`;
        });

        // Groupes - afficher le nom, stocker l'ID
        const groupeSelect = document.getElementById('filterGroupe');
        groupeSelect.innerHTML = '<option value="">Tous les groupes</option>';
        this.groupes.forEach(g => {
            const displayName = g.nom || g.id;
            groupeSelect.innerHTML += `<option value="${g.id}">${displayName}</option>`;
        });

        // Classes dans le modal utilisateur
        const userClasseSelect = document.getElementById('userClasse');
        if (userClasseSelect) {
            userClasseSelect.innerHTML = '<option value="">Sélectionner...</option>';
            this.classes.forEach(c => {
                const displayName = c.nom || c.id;
                userClasseSelect.innerHTML += `<option value="${c.id}">${displayName}</option>`;
            });
        }

        // Groupes dans le modal utilisateur
        const userGroupeSelect = document.getElementById('userGroupe');
        if (userGroupeSelect) {
            userGroupeSelect.innerHTML = '<option value="">Aucun</option>';
            this.groupes.forEach(g => {
                const displayName = g.nom || g.id;
                userGroupeSelect.innerHTML += `<option value="${g.id}">${displayName}</option>`;
            });
        }
    },

    /**
     * Récupère les utilisateurs filtrés
     */
    getFilteredUsers() {
        return this.users.filter(user => {
            // Recherche
            if (this.filters.search) {
                const search = this.filters.search.toLowerCase();
                const fullName = `${user.nom || ''} ${user.prenom || ''} ${user.identifiant || ''}`.toLowerCase();
                if (!fullName.includes(search)) return false;
            }

            // Classe
            if (this.filters.classe) {
                const classeValue = (user.classe_id || user.classes || '').toString();
                const userClasses = classeValue.split(',').map(c => c.trim());
                if (!userClasses.includes(this.filters.classe)) return false;
            }

            // Groupe
            if (this.filters.groupe) {
                const groupeValue = (user.groupe || user.groupes || '').toString();
                const userGroupes = groupeValue.split(',').map(g => g.trim());
                if (!userGroupes.includes(this.filters.groupe)) return false;
            }

            // Rôle
            if (this.filters.role) {
                if ((user.role || '').toLowerCase() !== this.filters.role) return false;
            }

            return true;
        });
    },

    /**
     * Affiche le tableau des utilisateurs
     */
    renderTable() {
        const tbody = document.getElementById('usersTableBody');
        const emptyState = document.getElementById('emptyState');
        const tableFooter = document.getElementById('tableFooter');

        const filteredUsers = this.getFilteredUsers();

        // Calculer la pagination
        const totalUsers = filteredUsers.length;
        const totalPages = Math.ceil(totalUsers / this.itemsPerPage);

        // S'assurer que la page courante est valide
        if (this.currentPage > totalPages) {
            this.currentPage = Math.max(1, totalPages);
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalUsers);
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

        // Mettre à jour le compteur
        document.getElementById('tableCount').textContent = `${totalUsers} utilisateur${totalUsers > 1 ? 's' : ''}`;

        // Afficher
        if (totalUsers === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'flex';
            tableFooter.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        tableFooter.style.display = 'flex';
        tbody.innerHTML = paginatedUsers.map(user => this.renderUserRow(user)).join('');

        // Pagination info
        document.getElementById('paginationInfo').textContent =
            `Affichage ${startIndex + 1}-${endIndex} sur ${totalUsers} utilisateurs`;

        // Rendre la pagination
        this.renderPagination(totalPages);
    },

    /**
     * Génère une ligne du tableau
     */
    renderUserRow(user) {
        const role = (user.role || 'eleve').toLowerCase();
        const prenom = user.prenom || '';
        const nom = user.nom || '';

        // Avatar avec initiales
        const initials = (prenom.charAt(0) + nom.charAt(0)).toUpperCase() || '?';
        const avatarColor = this.avatarColors[role] || this.avatarColors.eleve;

        // Badge du rôle
        let roleLabel, roleClass;
        if (role === 'prof' || role === 'professeur') {
            roleLabel = 'Prof';
            roleClass = 'prof';
        } else if (role === 'invite') {
            roleLabel = 'Invité';
            roleClass = 'invite';
        } else {
            roleLabel = 'Élève';
            roleClass = 'eleve';
        }

        // Classe - afficher le nom au lieu de l'ID
        const classeId = (user.classe_id || user.classes || '').toString().trim();
        const classeName = this.classesMap[classeId] || classeId;
        const classeHtml = classeId
            ? `<span class="class-badge">${classeName}</span>`
            : '<span class="no-data">—</span>';

        // Groupe - afficher le nom au lieu de l'ID
        const groupeId = (user.groupe || user.groupes || '').toString().trim();
        const groupeName = this.groupesMap[groupeId] || groupeId;
        const groupeHtml = groupeId
            ? `<span class="group-badge">${groupeName}</span>`
            : '<span class="no-data">—</span>';

        // Date dernière connexion
        const derniereConnexion = user.derniere_connexion || '';
        const dateCreation = user.date_creation || '';

        let dateHtml = '<span class="no-data">Jamais</span>';
        if (derniereConnexion) {
            dateHtml = `
                <div class="date-cell">
                    <span class="date-main">${this.formatDate(derniereConnexion)}</span>
                    ${dateCreation ? `<span class="date-sub">Inscrit le ${this.formatDate(dateCreation)}</span>` : ''}
                </div>
            `;
        } else if (dateCreation) {
            dateHtml = `
                <div class="date-cell">
                    <span class="date-main no-data">Jamais connecté</span>
                    <span class="date-sub">Inscrit le ${this.formatDate(dateCreation)}</span>
                </div>
            `;
        }

        return `
            <tr data-id="${user.id}">
                <td>
                    <div class="user-info">
                        <div class="user-avatar" style="background: ${avatarColor};">${initials}</div>
                        <div class="user-details">
                            <span class="user-name">${prenom} ${nom}</span>
                            <span class="user-id">${user.identifiant || ''}</span>
                        </div>
                    </div>
                </td>
                <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
                <td>${classeHtml}</td>
                <td>${groupeHtml}</td>
                <td>${dateHtml}</td>
                <td>
                    <div class="actions-cell">
                        <button class="action-btn edit" onclick="AdminUtilisateurs.openEditModal('${user.id}')" title="Modifier">✏️</button>
                        <button class="action-btn password" onclick="AdminUtilisateurs.openPasswordModal('${user.id}')" title="Réinitialiser mot de passe">🔑</button>
                        <button class="action-btn delete" onclick="AdminUtilisateurs.openDeleteModal('${user.id}')" title="Supprimer">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    },

    /**
     * Formate une date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                // Essayer le format DD/MM/YYYY
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    return dateStr;
                }
                return dateStr;
            }
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    },

    /**
     * Rend la pagination
     */
    renderPagination(totalPages) {
        const pagination = document.getElementById('pagination');

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = '';

        // Bouton précédent
        html += `<button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}"
                         onclick="AdminUtilisateurs.goToPage(${this.currentPage - 1})"
                         ${this.currentPage === 1 ? 'disabled' : ''}>←</button>`;

        // Pages
        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            html += `<button class="page-btn" onclick="AdminUtilisateurs.goToPage(1)">1</button>`;
            if (startPage > 2) {
                html += `<span class="page-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}"
                             onclick="AdminUtilisateurs.goToPage(${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="page-ellipsis">...</span>`;
            }
            html += `<button class="page-btn" onclick="AdminUtilisateurs.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Bouton suivant
        html += `<button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}"
                         onclick="AdminUtilisateurs.goToPage(${this.currentPage + 1})"
                         ${this.currentPage === totalPages ? 'disabled' : ''}>→</button>`;

        pagination.innerHTML = html;
    },

    /**
     * Aller à une page
     */
    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredUsers().length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;

        this.currentPage = page;
        this.renderTable();
    },

    /**
     * Bind les événements
     */
    bindEvents() {
        // Recherche
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.currentPage = 1;
            this.renderTable();
        });

        // Filtres
        document.getElementById('filterClasse').addEventListener('change', (e) => {
            this.filters.classe = e.target.value;
            this.currentPage = 1;
            this.renderTable();
        });

        document.getElementById('filterGroupe').addEventListener('change', (e) => {
            this.filters.groupe = e.target.value;
            this.currentPage = 1;
            this.renderTable();
        });

        document.getElementById('filterRole').addEventListener('change', (e) => {
            this.filters.role = e.target.value;
            this.currentPage = 1;
            this.renderTable();
        });

        // Bouton ajouter
        document.getElementById('addUserBtn').addEventListener('click', () => this.openAddModal());

        // Bouton gérer classes/groupes
        document.getElementById('manageBtn').addEventListener('click', () => this.openManageModal());

        // Modal utilisateur
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeModal('userModal'));
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.closeModal('userModal'));
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());
        document.getElementById('generatePasswordBtn').addEventListener('click', () => {
            document.getElementById('userPassword').value = this.generatePassword();
        });
        document.getElementById('showPasswordBtn').addEventListener('click', () => this.toggleShowPassword());

        // Changement de rôle
        document.getElementById('userRole').addEventListener('change', (e) => {
            const fields = document.getElementById('classeGroupeFields');
            const role = e.target.value;
            fields.style.display = (role === 'prof' || role === 'professeur') ? 'none' : 'block';
        });

        // Modal mot de passe
        document.getElementById('closePasswordModal').addEventListener('click', () => this.closeModal('passwordModal'));
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => this.closeModal('passwordModal'));
        document.getElementById('confirmPasswordBtn').addEventListener('click', () => this.resetPassword());
        document.getElementById('generateNewPasswordBtn').addEventListener('click', () => {
            document.getElementById('newPassword').value = this.generatePassword();
        });

        // Modal suppression
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeModal('deleteModal'));
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeModal('deleteModal'));
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteUser());

        // Modal gestion classes/groupes
        document.getElementById('closeManageModal').addEventListener('click', () => this.closeModal('manageModal'));
        document.getElementById('closeManageBtn').addEventListener('click', () => this.closeModal('manageModal'));
        document.getElementById('addClasseBtn').addEventListener('click', () => this.addClasse());
        document.getElementById('addGroupeBtn').addEventListener('click', () => this.addGroupe());

        // Fermer les modals en cliquant à l'extérieur
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    },

    /**
     * Génère un mot de passe aléatoire
     */
    generatePassword() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    },

    // Mot de passe actuel de l'utilisateur en cours d'édition
    currentEditPassword: '',

    /**
     * Ouvre le modal d'ajout
     */
    openAddModal() {
        document.getElementById('userModalTitle').textContent = 'Ajouter un utilisateur';
        document.getElementById('editUserId').value = '';
        document.getElementById('userPrenom').value = '';
        document.getElementById('userNom').value = '';
        document.getElementById('userRole').value = 'eleve';
        document.getElementById('userClasse').value = '';
        document.getElementById('userGroupe').value = '';
        document.getElementById('userIdentifiant').value = '';
        document.getElementById('userPassword').value = '';

        document.getElementById('passwordRequired').style.display = 'inline';
        document.getElementById('passwordHelp').textContent = 'Minimum 6 caractères';
        document.getElementById('classeGroupeFields').style.display = 'block';
        document.getElementById('showPasswordBtn').style.display = 'none';

        this.currentEditPassword = '';
        this.renderFilters();
        this.openModal('userModal');
    },

    /**
     * Ouvre le modal d'édition
     */
    openEditModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('userModalTitle').textContent = 'Modifier l\'utilisateur';
        document.getElementById('editUserId').value = user.id;
        document.getElementById('userPrenom').value = user.prenom || '';
        document.getElementById('userNom').value = user.nom || '';
        document.getElementById('userRole').value = (user.role || 'eleve').toLowerCase();
        document.getElementById('userClasse').value = (user.classe_id || user.classes || '').toString().trim();
        document.getElementById('userGroupe').value = (user.groupe || user.groupes || '').toString().trim();
        document.getElementById('userIdentifiant').value = user.identifiant || '';
        document.getElementById('userPassword').value = '';

        document.getElementById('passwordRequired').style.display = 'none';
        document.getElementById('passwordHelp').textContent = 'Laisser vide pour ne pas changer';

        // Stocker le mot de passe actuel et afficher le bouton "Voir"
        this.currentEditPassword = user.mot_de_passe || user.password || '';
        const showBtn = document.getElementById('showPasswordBtn');
        if (this.currentEditPassword) {
            showBtn.style.display = 'inline-flex';
            showBtn.textContent = '👁️ Voir';
        } else {
            showBtn.style.display = 'none';
        }

        const role = (user.role || 'eleve').toLowerCase();
        document.getElementById('classeGroupeFields').style.display =
            (role === 'prof' || role === 'professeur') ? 'none' : 'block';

        this.renderFilters();
        this.openModal('userModal');
    },

    /**
     * Affiche/masque le mot de passe actuel
     */
    toggleShowPassword() {
        const passwordInput = document.getElementById('userPassword');
        const showBtn = document.getElementById('showPasswordBtn');

        if (passwordInput.value === this.currentEditPassword) {
            // Masquer
            passwordInput.value = '';
            showBtn.textContent = '👁️ Voir';
        } else {
            // Afficher
            passwordInput.value = this.currentEditPassword;
            showBtn.textContent = '🙈 Masquer';
        }
    },

    /**
     * Sauvegarde l'utilisateur
     */
    async saveUser() {
        const prenom = document.getElementById('userPrenom').value.trim();
        const nom = document.getElementById('userNom').value.trim();
        const identifiant = document.getElementById('userIdentifiant').value.trim();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const classe = document.getElementById('userClasse').value;
        const groupe = document.getElementById('userGroupe').value;
        const userId = document.getElementById('editUserId').value;

        // Validation
        if (!prenom || !nom || !identifiant) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        if (!userId && !password) {
            alert('Le mot de passe est obligatoire pour un nouvel utilisateur.');
            return;
        }

        if (!userId && password.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        // Vérifier si l'identifiant existe déjà
        const existingUser = this.users.find(u => u.identifiant === identifiant && u.id !== userId);
        if (existingUser) {
            alert('Cet identifiant est déjà utilisé.');
            return;
        }

        const isProf = role === 'prof' || role === 'professeur';
        const userData = {
            id: userId || this.generateId(),
            prenom,
            nom,
            identifiant,
            role,
            classe_id: isProf ? '' : classe,
            groupe: isProf ? '' : groupe
        };

        if (password) {
            userData.mot_de_passe = password;
        }

        if (!userId) {
            userData.date_creation = new Date().toLocaleDateString('fr-FR');
        }

        try {
            const saveBtn = document.getElementById('saveUserBtn');
            saveBtn.disabled = true;
            saveBtn.textContent = '⏳ Enregistrement...';

            const action = userId ? 'updateUser' : 'createUser';
            await this.postToAppsScript(action, userData);

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Mettre à jour localement
            if (userId) {
                const index = this.users.findIndex(u => u.id === userId);
                if (index >= 0) {
                    this.users[index] = { ...this.users[index], ...userData };
                }
            } else {
                this.users.push(userData);
            }

            this.closeModal('userModal');
            this.renderStats();
            this.renderFilters();
            this.renderTable();

            alert(userId ? 'Utilisateur modifié avec succès.' : 'Utilisateur créé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement.');
        } finally {
            const saveBtn = document.getElementById('saveUserBtn');
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Enregistrer';
        }
    },

    /**
     * Ouvre le modal de réinitialisation de mot de passe
     */
    openPasswordModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('passwordUserId').value = userId;
        document.getElementById('passwordUserName').textContent = `${user.prenom} ${user.nom}`;
        document.getElementById('newPassword').value = '';

        this.openModal('passwordModal');
    },

    /**
     * Réinitialise le mot de passe
     */
    async resetPassword() {
        const userId = document.getElementById('passwordUserId').value;
        const newPassword = document.getElementById('newPassword').value;

        if (!newPassword) {
            alert('Veuillez saisir un nouveau mot de passe.');
            return;
        }

        if (newPassword.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }

        try {
            const btn = document.getElementById('confirmPasswordBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Réinitialisation...';

            await this.postToAppsScript('resetPassword', { id: userId, password: newPassword });

            this.closeModal('passwordModal');
            alert('Mot de passe réinitialisé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la réinitialisation.');
        } finally {
            const btn = document.getElementById('confirmPasswordBtn');
            btn.disabled = false;
            btn.textContent = '✓ Réinitialiser';
        }
    },

    /**
     * Ouvre le modal de suppression
     */
    openDeleteModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('deleteUserId').value = userId;
        document.getElementById('deleteUserName').textContent = `${user.prenom} ${user.nom}`;

        this.openModal('deleteModal');
    },

    /**
     * Supprime l'utilisateur
     */
    async deleteUser() {
        const userId = document.getElementById('deleteUserId').value;

        try {
            const btn = document.getElementById('confirmDeleteBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Suppression...';

            await this.postToAppsScript('deleteUser', { id: userId });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Supprimer localement
            this.users = this.users.filter(u => u.id !== userId);

            this.closeModal('deleteModal');
            this.renderStats();
            this.renderFilters();
            this.renderTable();

            alert('Utilisateur supprimé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression.');
        } finally {
            const btn = document.getElementById('confirmDeleteBtn');
            btn.disabled = false;
            btn.textContent = '🗑️ Supprimer';
        }
    },

    /**
     * Ouvre le modal de gestion des classes/groupes
     */
    openManageModal() {
        this.renderManageLists();
        this.openModal('manageModal');
    },

    /**
     * Affiche les listes de gestion
     */
    renderManageLists() {
        // Classes
        const classesList = document.getElementById('classesList');
        if (this.classes.length === 0) {
            classesList.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">Aucune classe</p>';
        } else {
            classesList.innerHTML = this.classes.map(classe => {
                const count = this.users.filter(u => {
                    const classeValue = (u.classe_id || u.classes || '').toString();
                    return classeValue === classe.id;
                }).length;
                return `
                    <div class="tag-item">
                        <span class="tag-name">${classe.nom || classe.id}</span>
                        <span class="tag-count">${count} élève${count > 1 ? 's' : ''}</span>
                        <button class="remove" onclick="AdminUtilisateurs.deleteClasse('${classe.id}')" title="Supprimer">✕</button>
                    </div>
                `;
            }).join('');
        }

        // Groupes
        const groupesList = document.getElementById('groupesList');
        if (this.groupes.length === 0) {
            groupesList.innerHTML = '<p style="color: var(--gray-500); font-size: 14px;">Aucun groupe</p>';
        } else {
            groupesList.innerHTML = this.groupes.map(groupe => {
                const count = this.users.filter(u => {
                    const groupeValue = (u.groupe || u.groupes || '').toString();
                    return groupeValue === groupe.id;
                }).length;
                return `
                    <div class="tag-item">
                        <span class="tag-name">${groupe.nom || groupe.id}</span>
                        <span class="tag-count">${count} élève${count > 1 ? 's' : ''}</span>
                        <button class="remove" onclick="AdminUtilisateurs.deleteGroupe('${groupe.id}')" title="Supprimer">✕</button>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Ajoute une nouvelle classe
     */
    async addClasse() {
        const input = document.getElementById('newClasseName');
        const name = input.value.trim();

        if (!name) {
            alert('Veuillez saisir un nom de classe.');
            return;
        }

        // Vérifier si le nom existe déjà
        if (this.classes.some(c => c.nom === name)) {
            alert('Cette classe existe déjà.');
            return;
        }

        try {
            const btn = document.getElementById('addClasseBtn');
            btn.disabled = true;
            btn.textContent = '⏳';

            const result = await this.postToAppsScript('createClasse', {
                nom: name,
                annee_scolaire: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1)
            });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Ajouter localement
            const newClasse = { id: result.id, nom: name };
            this.classes.push(newClasse);
            this.classesMap[result.id] = name;

            input.value = '';
            this.renderManageLists();
            this.renderFilters();

            alert('Classe créée avec succès !');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la création: ' + error.message);
        } finally {
            const btn = document.getElementById('addClasseBtn');
            btn.disabled = false;
            btn.textContent = '+ Ajouter';
        }
    },

    /**
     * Supprime une classe
     */
    async deleteClasse(classeId) {
        const classe = this.classes.find(c => c.id === classeId);
        if (!classe) return;

        const usersWithClasse = this.users.filter(u => {
            const classeValue = (u.classe_id || u.classes || '').toString();
            return classeValue === classeId;
        });

        if (usersWithClasse.length > 0) {
            alert(`Impossible de supprimer "${classe.nom}" car ${usersWithClasse.length} utilisateur(s) y sont assignés.\n\nRetirez d'abord les utilisateurs de cette classe.`);
            return;
        }

        if (!confirm(`Supprimer la classe "${classe.nom}" ?`)) {
            return;
        }

        try {
            await this.postToAppsScript('deleteClasse', { id: classeId });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Supprimer localement
            this.classes = this.classes.filter(c => c.id !== classeId);
            delete this.classesMap[classeId];

            this.renderManageLists();
            this.renderFilters();
            alert('Classe supprimée avec succès !');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression: ' + error.message);
        }
    },

    /**
     * Ajoute un nouveau groupe
     */
    async addGroupe() {
        const input = document.getElementById('newGroupeName');
        const name = input.value.trim();

        if (!name) {
            alert('Veuillez saisir un nom de groupe.');
            return;
        }

        // Vérifier si le nom existe déjà
        if (this.groupes.some(g => g.nom === name)) {
            alert('Ce groupe existe déjà.');
            return;
        }

        try {
            const btn = document.getElementById('addGroupeBtn');
            btn.disabled = true;
            btn.textContent = '⏳';

            const result = await this.postToAppsScript('createGroupe', {
                nom: name,
                type: 'standard'
            });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Ajouter localement
            const newGroupe = { id: result.id, nom: name };
            this.groupes.push(newGroupe);
            this.groupesMap[result.id] = name;

            input.value = '';
            this.renderManageLists();
            this.renderFilters();

            alert('Groupe créé avec succès !');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la création: ' + error.message);
        } finally {
            const btn = document.getElementById('addGroupeBtn');
            btn.disabled = false;
            btn.textContent = '+ Ajouter';
        }
    },

    /**
     * Supprime un groupe
     */
    async deleteGroupe(groupeId) {
        const groupe = this.groupes.find(g => g.id === groupeId);
        if (!groupe) return;

        const usersWithGroupe = this.users.filter(u => {
            const groupeValue = (u.groupe || u.groupes || '').toString();
            return groupeValue === groupeId;
        });

        if (usersWithGroupe.length > 0) {
            alert(`Impossible de supprimer "${groupe.nom}" car ${usersWithGroupe.length} utilisateur(s) y sont assignés.\n\nRetirez d'abord les utilisateurs de ce groupe.`);
            return;
        }

        if (!confirm(`Supprimer le groupe "${groupe.nom}" ?`)) {
            return;
        }

        try {
            await this.postToAppsScript('deleteGroupe', { id: groupeId });

            // Vider le cache pour que les modifications soient visibles immédiatement
            SheetsAPI.clearCache();

            // Supprimer localement
            this.groupes = this.groupes.filter(g => g.id !== groupeId);
            delete this.groupesMap[groupeId];

            this.renderManageLists();
            this.renderFilters();
            alert('Groupe supprimé avec succès !');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression: ' + error.message);
        }
    },

    /**
     * Génère un ID unique
     */
    generateId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Ouvre un modal
     */
    openModal(modalId) {
        document.getElementById(modalId).classList.remove('hidden');
    },

    /**
     * Ferme un modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    /**
     * Envoie une requête POST via JSONP
     */
    postToAppsScript(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);

                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur inconnue'));
                }
            };

            const params = new URLSearchParams();
            params.append('action', action);
            params.append('data', JSON.stringify(data));
            params.append('callback', callbackName);

            const script = document.createElement('script');
            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            document.body.appendChild(script);
        });
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <div class="icon">❌</div>
                <h3>Erreur</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    }
};

// Export
window.AdminUtilisateurs = AdminUtilisateurs;
