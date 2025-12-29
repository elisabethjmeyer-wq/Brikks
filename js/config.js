/**
 * Configuration Brikks
 * Paramètres globaux de l'application
 */

const CONFIG = {
    // Google Sheets
    SPREADSHEET_ID: '1rsWXHwP2fyuJ0VZKL9UAzFws9UMFqyHXDt5_j8O2Ry0',
    API_KEY: 'AIzaSyBPh3rpAu3YKLMC66VnhikqpN8ovYip6Ac',

    // Onglets Google Sheets
    SHEETS: {
        UTILISATEURS: 'UTILISATEURS',
        // Autres onglets à ajouter selon les besoins
    },

    // URLs de redirection
    ROUTES: {
        ADMIN: '/admin/',
        ELEVE: '/eleve/',
        LOGIN: '/'
    },

    // Clés de stockage local
    STORAGE_KEYS: {
        USER: 'brikks_user',
        TOKEN: 'brikks_token'
    }
};

// Gel de la configuration pour éviter les modifications accidentelles
Object.freeze(CONFIG);
Object.freeze(CONFIG.SHEETS);
Object.freeze(CONFIG.ROUTES);
Object.freeze(CONFIG.STORAGE_KEYS);
