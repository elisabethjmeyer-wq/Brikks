/**
 * Module d'authentification
 * Gère la connexion, déconnexion et le routing par rôle
 */

const Auth = {
    /**
     * Vérifie les credentials dans l'onglet UTILISATEURS
     * @param {string} identifiant - Identifiant utilisateur
     * @param {string} motDePasse - Mot de passe
     * @returns {Promise<Object|null>} - Utilisateur trouvé ou null
     */
    async verifyCredentials(identifiant, motDePasse) {
        try {
            const utilisateurs = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.UTILISATEURS);

            // DEBUG: Données reçues du Google Sheets
            console.log('=== DEBUG AUTH ===');
            console.log('1. Données Google Sheets:', utilisateurs);
            console.log('2. Colonnes disponibles:', utilisateurs.length > 0 ? Object.keys(utilisateurs[0]) : 'Aucune donnée');

            // DEBUG: Identifiants saisis
            console.log('3. Identifiant saisi:', identifiant);
            console.log('4. Mot de passe saisi:', motDePasse);

            const user = utilisateurs.find(u => {
                // Trim des valeurs pour éviter les espaces parasites
                const sheetId = (u.identifiant || '').trim();
                const sheetPwd = (u.mot_de_passe || '').trim();
                // DEBUG: Comparaison pour chaque utilisateur
                console.log('5. Comparaison avec:', {
                    identifiant_sheets: sheetId,
                    mot_de_passe_sheets: sheetPwd,
                    match_identifiant: sheetId === identifiant,
                    match_mdp: sheetPwd === motDePasse
                });
                return sheetId === identifiant && sheetPwd === motDePasse;
            });

            // DEBUG: Résultat
            console.log('6. Utilisateur trouvé:', user || 'Aucun');
            console.log('=== FIN DEBUG ===');

            return user || null;
        } catch (error) {
            console.error('Erreur de vérification:', error);
            throw new Error('Impossible de vérifier les identifiants. Vérifiez votre connexion.');
        }
    },

    /**
     * Connecte l'utilisateur et le stocke en session
     * @param {Object} user - Données utilisateur
     */
    login(user) {
        // Stocker l'utilisateur (sans le mot de passe)
        const safeUser = { ...user };
        delete safeUser.mot_de_passe;

        sessionStorage.setItem(CONFIG.STORAGE_KEYS.USER, JSON.stringify(safeUser));
    },

    /**
     * Déconnecte l'utilisateur
     */
    logout() {
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.USER);
        sessionStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
        window.location.href = CONFIG.ROUTES.LOGIN;
    },

    /**
     * Récupère l'utilisateur connecté
     * @returns {Object|null} - Utilisateur ou null
     */
    getCurrentUser() {
        const userData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        return userData ? JSON.parse(userData) : null;
    },

    /**
     * Vérifie si l'utilisateur est connecté
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.getCurrentUser() !== null;
    },

    /**
     * Redirige selon le rôle de l'utilisateur
     * @param {Object} user - Utilisateur avec propriété 'role'
     */
    redirectByRole(user) {
        const role = (user.role || '').toLowerCase().trim();

        switch (role) {
            case 'prof':
            case 'admin':
            case 'professeur':
                window.location.href = CONFIG.ROUTES.ADMIN;
                break;
            case 'eleve':
            case 'élève':
            case 'etudiant':
            case 'étudiant':
                window.location.href = CONFIG.ROUTES.ELEVE;
                break;
            default:
                console.error('Rôle non reconnu:', role);
                throw new Error('Rôle utilisateur non reconnu');
        }
    },

    /**
     * Vérifie l'accès à une page protégée
     * @param {Array<string>} allowedRoles - Rôles autorisés
     * @returns {Object} - Utilisateur si autorisé
     */
    checkAccess(allowedRoles = []) {
        const user = this.getCurrentUser();

        if (!user) {
            window.location.href = CONFIG.ROUTES.LOGIN;
            return null;
        }

        if (allowedRoles.length > 0) {
            const userRole = (user.role || '').toLowerCase().trim();
            const allowed = allowedRoles.some(role =>
                role.toLowerCase() === userRole
            );

            if (!allowed) {
                this.logout();
                return null;
            }
        }

        return user;
    }
};
