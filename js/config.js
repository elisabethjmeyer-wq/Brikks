/**
 * Configuration Brikks
 * Paramètres globaux de l'application
 */

const CONFIG = {
    // Google Sheets
    SPREADSHEET_ID: '1rsWXHwP2fyuJ0VZKL9UAzFws9UMFqyHXDt5_j8O2Ry0',
    API_KEY: 'AIzaSyBPh3rpAu3YKLMC66VnhikqpN8ovYip6Ac',

    // URL du Web App Google Apps Script (à remplir après déploiement)
    // Voir google-apps-script/DEPLOIEMENT.md pour les instructions
    WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwoxqiWIYM4m3exZMghd_gYQJEMbJCIfPKJRLWJ_Ad7F8qzlid48Rtxofyyqk-mK2YLqQ/exec',

    // Onglets Google Sheets
    SHEETS: {
        UTILISATEURS: 'UTILISATEURS',
        CLASSES: 'CLASSES',
        GROUPES: 'GROUPES',
        DISCIPLINES: 'DISCIPLINES',
        THEMES: 'THEMES',
        CHAPITRES: 'CHAPITRES',
        SUPPORTS_CHAPITRE: 'SUPPORTS_CHAPITRE',
        PARAMETRES: 'PARAMETRES',
        AGENDAS: 'AGENDAS',
        CONFIG_MENU: 'CONFIG_MENU',
        VIDEOS: 'VIDEOS',
        RECOMMANDATIONS: 'RECOMMANDATIONS',
        CATEGORIES_FAQ: 'CATEGORIES_FAQ',
        QUESTIONS_FAQ: 'QUESTIONS_FAQ',
        METHODOLOGIE: 'METHODOLOGIE',
        PROGRESSION_METHODOLOGIE: 'PROGRESSION_METHODOLOGIE',
        PROGRESSION_LECONS: 'PROGRESSION_LECONS'
    },

    // URLs de redirection (avec préfixe GitHub Pages)
    ROUTES: {
        ADMIN: '/Brikks/admin/',
        ELEVE: '/Brikks/eleve/',
        LOGIN: '/Brikks/'
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
