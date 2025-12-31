/**
 * Admin Utilisateurs - Gestion des utilisateurs
 */

const AdminUtilisateurs = {
    // Données
    users: [],
    classes: [],
    groupes: [],

    // État
    currentSort: { field: 'nom', direction: 'asc' },
    filters: { search: '', classe: '', groupe: '', role: '' },

    // Utilisateur en cours d'édition
    editingUser: null,
    selectedClasses: [],
    selectedGroupes: [],

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
        const users = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.UTILISATEURS);
        this.users = users || [];

        // Extraire les classes et groupes uniques
        const classesSet = new Set();
        const groupesSet = new Set();

        this.users.forEach(user => {
            if (user.classes) {
                user.classes.split(',').map(c => c.trim()).filter(c => c).forEach(c => classesSet.add(c));
            }
            if (user.groupes) {
                user.groupes.split(',').map(g => g.trim()).filter(g => g).forEach(g => groupesSet.add(g));
            }
        });

        this.classes = Array.from(classesSet).sort();
        this.groupes = Array.from(groupesSet).sort();

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
        document.getElementById('loader').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    },

    /**
     * Affiche les statistiques
     */
    renderStats() {
        const total = this.users.length;
        const eleves = this.users.filter(u => (u.role || '').toLowerCase() === 'eleve').length;
        const admins = this.users.filter(u => (u.role || '').toLowerCase() === 'admin').length;

        document.getElementById('statTotal').textContent = total;
        document.getElementById('statEleves').textContent = eleves;
        document.getElementById('statAdmins').textContent = admins;
        document.getElementById('statClasses').textContent = this.classes.length;
    },

    /**
     * Affiche les options des filtres
     */
    renderFilters() {
        // Classes
        const classeSelect = document.getElementById('filterClasse');
        classeSelect.innerHTML = '<option value="">Toutes les classes</option>';
        this.classes.forEach(c => {
            classeSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });

        // Groupes
        const groupeSelect = document.getElementById('filterGroupe');
        groupeSelect.innerHTML = '<option value="">Tous les groupes</option>';
        this.groupes.forEach(g => {
            groupeSelect.innerHTML += `<option value="${g}">${g}</option>`;
        });
    },

    /**
     * Affiche le tableau des utilisateurs
     */
    renderTable() {
        const tbody = document.getElementById('usersTableBody');
        const emptyState = document.getElementById('emptyState');

        // Appliquer les filtres
        let filteredUsers = this.users.filter(user => {
            // Recherche
            if (this.filters.search) {
                const search = this.filters.search.toLowerCase();
                const fullName = `${user.nom || ''} ${user.prenom || ''} ${user.identifiant || ''}`.toLowerCase();
                if (!fullName.includes(search)) return false;
            }

            // Classe
            if (this.filters.classe) {
                const userClasses = (user.classes || '').split(',').map(c => c.trim());
                if (!userClasses.includes(this.filters.classe)) return false;
            }

            // Groupe
            if (this.filters.groupe) {
                const userGroupes = (user.groupes || '').split(',').map(g => g.trim());
                if (!userGroupes.includes(this.filters.groupe)) return false;
            }

            // Rôle
            if (this.filters.role) {
                if ((user.role || '').toLowerCase() !== this.filters.role) return false;
            }

            return true;
        });

        // Appliquer le tri
        filteredUsers.sort((a, b) => {
            const field = this.currentSort.field;
            const valA = (a[field] || '').toLowerCase();
            const valB = (b[field] || '').toLowerCase();
            const direction = this.currentSort.direction === 'asc' ? 1 : -1;
            return valA.localeCompare(valB) * direction;
        });

        // Afficher
        if (filteredUsers.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        tbody.innerHTML = filteredUsers.map(user => this.renderUserRow(user)).join('');
    },

    /**
     * Génère une ligne du tableau
     */
    renderUserRow(user) {
        const role = (user.role || 'eleve').toLowerCase();
        const roleLabel = role === 'admin' ? '👑 Admin' : '🎓 Élève';
        const roleClass = role === 'admin' ? 'admin' : 'eleve';

        // Classes
        const classesHtml = user.classes
            ? user.classes.split(',').map(c => `<span class="tag classe">${c.trim()}</span>`).join('')
            : '<span class="no-data">—</span>';

        // Groupes
        const groupesHtml = user.groupes
            ? user.groupes.split(',').map(g => `<span class="tag groupe">${g.trim()}</span>`).join('')
            : '<span class="no-data">—</span>';

        return `
            <tr data-id="${user.id}">
                <td class="user-name">${user.nom || '—'}</td>
                <td>${user.prenom || '—'}</td>
                <td>${user.identifiant || '—'}</td>
                <td><div class="tags-container">${classesHtml}</div></td>
                <td><div class="tags-container">${groupesHtml}</div></td>
                <td><span class="role-badge ${roleClass}">${roleLabel}</span></td>
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
     * Bind les événements
     */
    bindEvents() {
        // Recherche
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.renderTable();
        });

        // Filtres
        document.getElementById('filterClasse').addEventListener('change', (e) => {
            this.filters.classe = e.target.value;
            this.renderTable();
        });

        document.getElementById('filterGroupe').addEventListener('change', (e) => {
            this.filters.groupe = e.target.value;
            this.renderTable();
        });

        document.getElementById('filterRole').addEventListener('change', (e) => {
            this.filters.role = e.target.value;
            this.renderTable();
        });

        // Tri des colonnes
        document.querySelectorAll('.users-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (this.currentSort.field === field) {
                    this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.currentSort.field = field;
                    this.currentSort.direction = 'asc';
                }
                this.updateSortIndicators();
                this.renderTable();
            });
        });

        // Bouton ajouter
        document.getElementById('addUserBtn').addEventListener('click', () => this.openAddModal());

        // Modal utilisateur
        document.getElementById('closeUserModal').addEventListener('click', () => this.closeModal('userModal'));
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.closeModal('userModal'));
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());

        // Modal mot de passe
        document.getElementById('closePasswordModal').addEventListener('click', () => this.closeModal('passwordModal'));
        document.getElementById('cancelPasswordBtn').addEventListener('click', () => this.closeModal('passwordModal'));
        document.getElementById('confirmPasswordBtn').addEventListener('click', () => this.resetPassword());

        // Modal suppression
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeModal('deleteModal'));
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeModal('deleteModal'));
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteUser());

        // Modal gestion classes/groupes
        document.getElementById('manageBtn').addEventListener('click', () => this.openManageModal());
        document.getElementById('closeManageModal').addEventListener('click', () => this.closeModal('manageModal'));
        document.getElementById('closeManageBtn').addEventListener('click', () => this.closeModal('manageModal'));

        // Tabs gestion
        document.querySelectorAll('.manage-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.manage-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.manage-tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`manageTab${e.target.dataset.tab.charAt(0).toUpperCase() + e.target.dataset.tab.slice(1)}`).classList.add('active');
            });
        });

        // Ajout classe/groupe dans gestion
        document.getElementById('addClasseBtn').addEventListener('click', () => this.addClasse());
        document.getElementById('addGroupeBtn').addEventListener('click', () => this.addGroupe());

        // Sélection classes/groupes dans modal utilisateur
        document.getElementById('addClasseSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.addSelectedClasse(e.target.value);
                e.target.value = '';
            }
        });

        document.getElementById('addGroupeSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.addSelectedGroupe(e.target.value);
                e.target.value = '';
            }
        });

        // Changement de rôle
        document.getElementById('userRole').addEventListener('change', (e) => {
            const row = document.getElementById('classeGroupeRow');
            row.style.display = e.target.value === 'admin' ? 'none' : 'grid';
        });

        // Fermer les modals en cliquant à l'extérieur
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });
    },

    /**
     * Met à jour les indicateurs de tri
     */
    updateSortIndicators() {
        document.querySelectorAll('.users-table th.sortable').forEach(th => {
            th.classList.remove('sorted-asc', 'sorted-desc');
            if (th.dataset.sort === this.currentSort.field) {
                th.classList.add(`sorted-${this.currentSort.direction}`);
            }
        });
    },

    /**
     * Ouvre le modal d'ajout
     */
    openAddModal() {
        this.editingUser = null;
        this.selectedClasses = [];
        this.selectedGroupes = [];

        document.getElementById('userModalTitle').textContent = '➕ Nouvel utilisateur';
        document.getElementById('editUserId').value = '';
        document.getElementById('userNom').value = '';
        document.getElementById('userPrenom').value = '';
        document.getElementById('userIdentifiant').value = '';
        document.getElementById('userPassword').value = '';
        document.getElementById('userRole').value = 'eleve';

        document.getElementById('passwordHint').textContent = '(obligatoire)';
        document.getElementById('passwordEditHint').style.display = 'none';
        document.getElementById('classeGroupeRow').style.display = 'grid';

        this.renderClassesChips();
        this.renderGroupesChips();
        this.updateClasseSelect();
        this.updateGroupeSelect();

        this.openModal('userModal');
    },

    /**
     * Ouvre le modal d'édition
     */
    openEditModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        this.editingUser = user;
        this.selectedClasses = user.classes ? user.classes.split(',').map(c => c.trim()).filter(c => c) : [];
        this.selectedGroupes = user.groupes ? user.groupes.split(',').map(g => g.trim()).filter(g => g) : [];

        document.getElementById('userModalTitle').textContent = '✏️ Modifier l\'utilisateur';
        document.getElementById('editUserId').value = user.id;
        document.getElementById('userNom').value = user.nom || '';
        document.getElementById('userPrenom').value = user.prenom || '';
        document.getElementById('userIdentifiant').value = user.identifiant || '';
        document.getElementById('userPassword').value = '';
        document.getElementById('userRole').value = (user.role || 'eleve').toLowerCase();

        document.getElementById('passwordHint').textContent = '';
        document.getElementById('passwordEditHint').style.display = 'block';

        const isAdmin = (user.role || '').toLowerCase() === 'admin';
        document.getElementById('classeGroupeRow').style.display = isAdmin ? 'none' : 'grid';

        this.renderClassesChips();
        this.renderGroupesChips();
        this.updateClasseSelect();
        this.updateGroupeSelect();

        this.openModal('userModal');
    },

    /**
     * Affiche les chips des classes sélectionnées
     */
    renderClassesChips() {
        const container = document.getElementById('userClassesChips');
        container.innerHTML = this.selectedClasses.map(c =>
            `<span class="chip">${c}<button class="chip-remove" onclick="AdminUtilisateurs.removeSelectedClasse('${c}')">✕</button></span>`
        ).join('');
    },

    /**
     * Affiche les chips des groupes sélectionnés
     */
    renderGroupesChips() {
        const container = document.getElementById('userGroupesChips');
        container.innerHTML = this.selectedGroupes.map(g =>
            `<span class="chip">${g}<button class="chip-remove" onclick="AdminUtilisateurs.removeSelectedGroupe('${g}')">✕</button></span>`
        ).join('');
    },

    /**
     * Met à jour le select des classes
     */
    updateClasseSelect() {
        const select = document.getElementById('addClasseSelect');
        select.innerHTML = '<option value="">+ Ajouter une classe</option>';
        this.classes
            .filter(c => !this.selectedClasses.includes(c))
            .forEach(c => {
                select.innerHTML += `<option value="${c}">${c}</option>`;
            });
    },

    /**
     * Met à jour le select des groupes
     */
    updateGroupeSelect() {
        const select = document.getElementById('addGroupeSelect');
        select.innerHTML = '<option value="">+ Ajouter un groupe</option>';
        this.groupes
            .filter(g => !this.selectedGroupes.includes(g))
            .forEach(g => {
                select.innerHTML += `<option value="${g}">${g}</option>`;
            });
    },

    /**
     * Ajoute une classe à la sélection
     */
    addSelectedClasse(classe) {
        if (!this.selectedClasses.includes(classe)) {
            this.selectedClasses.push(classe);
            this.renderClassesChips();
            this.updateClasseSelect();
        }
    },

    /**
     * Retire une classe de la sélection
     */
    removeSelectedClasse(classe) {
        this.selectedClasses = this.selectedClasses.filter(c => c !== classe);
        this.renderClassesChips();
        this.updateClasseSelect();
    },

    /**
     * Ajoute un groupe à la sélection
     */
    addSelectedGroupe(groupe) {
        if (!this.selectedGroupes.includes(groupe)) {
            this.selectedGroupes.push(groupe);
            this.renderGroupesChips();
            this.updateGroupeSelect();
        }
    },

    /**
     * Retire un groupe de la sélection
     */
    removeSelectedGroupe(groupe) {
        this.selectedGroupes = this.selectedGroupes.filter(g => g !== groupe);
        this.renderGroupesChips();
        this.updateGroupeSelect();
    },

    /**
     * Sauvegarde l'utilisateur
     */
    async saveUser() {
        const nom = document.getElementById('userNom').value.trim();
        const prenom = document.getElementById('userPrenom').value.trim();
        const identifiant = document.getElementById('userIdentifiant').value.trim();
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;
        const userId = document.getElementById('editUserId').value;

        // Validation
        if (!nom || !prenom || !identifiant) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        if (!userId && !password) {
            alert('Le mot de passe est obligatoire pour un nouvel utilisateur.');
            return;
        }

        // Vérifier si l'identifiant existe déjà
        const existingUser = this.users.find(u => u.identifiant === identifiant && u.id !== userId);
        if (existingUser) {
            alert('Cet identifiant est déjà utilisé.');
            return;
        }

        const userData = {
            id: userId || this.generateId(),
            nom,
            prenom,
            identifiant,
            role,
            classes: role === 'admin' ? '' : this.selectedClasses.join(', '),
            groupes: role === 'admin' ? '' : this.selectedGroupes.join(', ')
        };

        if (password) {
            userData.password = password;
        }

        try {
            document.getElementById('saveUserBtn').disabled = true;
            document.getElementById('saveUserBtn').textContent = '⏳ Enregistrement...';

            const action = userId ? 'updateUser' : 'createUser';
            await this.postToAppsScript(action, userData);

            // Mettre à jour localement
            if (userId) {
                const index = this.users.findIndex(u => u.id === userId);
                if (index >= 0) {
                    this.users[index] = { ...this.users[index], ...userData };
                }
            } else {
                this.users.push(userData);
            }

            // Rafraîchir les classes et groupes
            this.updateClassesAndGroupes();

            this.closeModal('userModal');
            this.renderStats();
            this.renderFilters();
            this.renderTable();

            alert(userId ? 'Utilisateur modifié avec succès.' : 'Utilisateur créé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de l\'enregistrement.');
        } finally {
            document.getElementById('saveUserBtn').disabled = false;
            document.getElementById('saveUserBtn').textContent = '💾 Enregistrer';
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
        document.getElementById('confirmPassword').value = '';

        this.openModal('passwordModal');
    },

    /**
     * Réinitialise le mot de passe
     */
    async resetPassword() {
        const userId = document.getElementById('passwordUserId').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!newPassword) {
            alert('Veuillez saisir un nouveau mot de passe.');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas.');
            return;
        }

        try {
            document.getElementById('confirmPasswordBtn').disabled = true;
            document.getElementById('confirmPasswordBtn').textContent = '⏳ Réinitialisation...';

            await this.postToAppsScript('resetPassword', { id: userId, password: newPassword });

            this.closeModal('passwordModal');
            alert('Mot de passe réinitialisé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la réinitialisation.');
        } finally {
            document.getElementById('confirmPasswordBtn').disabled = false;
            document.getElementById('confirmPasswordBtn').textContent = '🔑 Réinitialiser';
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
            document.getElementById('confirmDeleteBtn').disabled = true;
            document.getElementById('confirmDeleteBtn').textContent = '⏳ Suppression...';

            await this.postToAppsScript('deleteUser', { id: userId });

            // Supprimer localement
            this.users = this.users.filter(u => u.id !== userId);
            this.updateClassesAndGroupes();

            this.closeModal('deleteModal');
            this.renderStats();
            this.renderFilters();
            this.renderTable();

            alert('Utilisateur supprimé avec succès.');

        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la suppression.');
        } finally {
            document.getElementById('confirmDeleteBtn').disabled = false;
            document.getElementById('confirmDeleteBtn').textContent = '🗑️ Supprimer';
        }
    },

    /**
     * Met à jour la liste des classes et groupes
     */
    updateClassesAndGroupes() {
        const classesSet = new Set();
        const groupesSet = new Set();

        this.users.forEach(user => {
            if (user.classes) {
                user.classes.split(',').map(c => c.trim()).filter(c => c).forEach(c => classesSet.add(c));
            }
            if (user.groupes) {
                user.groupes.split(',').map(g => g.trim()).filter(g => g).forEach(g => groupesSet.add(g));
            }
        });

        this.classes = Array.from(classesSet).sort();
        this.groupes = Array.from(groupesSet).sort();
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
        classesList.innerHTML = this.classes.map(classe => {
            const count = this.users.filter(u => (u.classes || '').split(',').map(c => c.trim()).includes(classe)).length;
            return `
                <div class="manage-item">
                    <div>
                        <span class="manage-item-name">${classe}</span>
                        <span class="manage-item-count">${count} élève${count > 1 ? 's' : ''}</span>
                    </div>
                    <div class="manage-item-actions">
                        <button class="action-btn delete" onclick="AdminUtilisateurs.deleteClasse('${classe}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `;
        }).join('') || '<p style="text-align: center; color: var(--text-muted);">Aucune classe</p>';

        // Groupes
        const groupesList = document.getElementById('groupesList');
        groupesList.innerHTML = this.groupes.map(groupe => {
            const count = this.users.filter(u => (u.groupes || '').split(',').map(g => g.trim()).includes(groupe)).length;
            return `
                <div class="manage-item">
                    <div>
                        <span class="manage-item-name">${groupe}</span>
                        <span class="manage-item-count">${count} élève${count > 1 ? 's' : ''}</span>
                    </div>
                    <div class="manage-item-actions">
                        <button class="action-btn delete" onclick="AdminUtilisateurs.deleteGroupe('${groupe}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `;
        }).join('') || '<p style="text-align: center; color: var(--text-muted);">Aucun groupe</p>';
    },

    /**
     * Ajoute une nouvelle classe
     */
    addClasse() {
        const input = document.getElementById('newClasseName');
        const name = input.value.trim();

        if (!name) {
            alert('Veuillez saisir un nom de classe.');
            return;
        }

        if (this.classes.includes(name)) {
            alert('Cette classe existe déjà.');
            return;
        }

        this.classes.push(name);
        this.classes.sort();
        input.value = '';

        this.renderManageLists();
        this.renderFilters();
    },

    /**
     * Supprime une classe
     */
    async deleteClasse(classe) {
        const usersWithClasse = this.users.filter(u => (u.classes || '').split(',').map(c => c.trim()).includes(classe));

        if (usersWithClasse.length > 0) {
            if (!confirm(`${usersWithClasse.length} utilisateur(s) utilisent cette classe. Voulez-vous vraiment la supprimer ? Elle sera retirée de tous les utilisateurs.`)) {
                return;
            }

            // Retirer la classe de tous les utilisateurs
            for (const user of usersWithClasse) {
                const newClasses = user.classes.split(',').map(c => c.trim()).filter(c => c !== classe).join(', ');
                user.classes = newClasses;
                await this.postToAppsScript('updateUser', { id: user.id, classes: newClasses });
            }
        }

        this.classes = this.classes.filter(c => c !== classe);
        this.renderManageLists();
        this.renderFilters();
        this.renderTable();
    },

    /**
     * Ajoute un nouveau groupe
     */
    addGroupe() {
        const input = document.getElementById('newGroupeName');
        const name = input.value.trim();

        if (!name) {
            alert('Veuillez saisir un nom de groupe.');
            return;
        }

        if (this.groupes.includes(name)) {
            alert('Ce groupe existe déjà.');
            return;
        }

        this.groupes.push(name);
        this.groupes.sort();
        input.value = '';

        this.renderManageLists();
        this.renderFilters();
    },

    /**
     * Supprime un groupe
     */
    async deleteGroupe(groupe) {
        const usersWithGroupe = this.users.filter(u => (u.groupes || '').split(',').map(g => g.trim()).includes(groupe));

        if (usersWithGroupe.length > 0) {
            if (!confirm(`${usersWithGroupe.length} utilisateur(s) utilisent ce groupe. Voulez-vous vraiment le supprimer ? Il sera retiré de tous les utilisateurs.`)) {
                return;
            }

            // Retirer le groupe de tous les utilisateurs
            for (const user of usersWithGroupe) {
                const newGroupes = user.groupes.split(',').map(g => g.trim()).filter(g => g !== groupe).join(', ');
                user.groupes = newGroupes;
                await this.postToAppsScript('updateUser', { id: user.id, groupes: newGroupes });
            }
        }

        this.groupes = this.groupes.filter(g => g !== groupe);
        this.renderManageLists();
        this.renderFilters();
        this.renderTable();
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
        document.getElementById(modalId).classList.add('active');
    },

    /**
     * Ferme un modal
     */
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
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
