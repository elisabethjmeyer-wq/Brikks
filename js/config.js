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
        PROGRESSION_LECONS: 'PROGRESSION_LECONS',
        BEX_CONFIG: 'BEX_CONFIG',
        // Entraînements (ancien système)
        FORMATS: 'FORMATS',
        QUESTIONS: 'QUESTIONS',
        ENTRAINEMENTS: 'ENTRAINEMENTS',
        ENTRAINEMENT_QUESTIONS: 'ENTRAINEMENT_QUESTIONS',
        RESULTATS_ENTRAINEMENT: 'RESULTATS_ENTRAINEMENT',
        // Évaluations
        EVALUATIONS: 'EVALUATIONS',
        EVALUATION_QUESTIONS: 'EVALUATION_QUESTIONS',
        EVALUATION_RESULTATS: 'EVALUATION_RESULTATS',
        // Banques d'exercices
        BANQUES_EXERCICES: 'BANQUES_EXERCICES',
        FORMATS_EXERCICES: 'FORMATS_EXERCICES',
        EXERCICES: 'EXERCICES',
        RESULTATS_EXERCICES: 'RESULTATS_EXERCICES',
        // Banques de questions (entraînements connaissances)
        BANQUES_QUESTIONS: 'BANQUES_QUESTIONS',
        QUESTIONS_CONNAISSANCES: 'QUESTIONS_CONNAISSANCES',
        // Nouveau système Connaissances (structure complète)
        BANQUES_EXERCICES_CONN: 'BANQUES_EXERCICES_CONN',
        ENTRAINEMENTS_CONN: 'ENTRAINEMENTS_CONN',
        ETAPES_CONN: 'ETAPES_CONN',
        ETAPE_QUESTIONS_CONN: 'ETAPE_QUESTIONS_CONN',
        FORMATS_QUESTIONS: 'FORMATS_QUESTIONS',
        // Système de mémorisation
        PROGRESSION_MEMORISATION: 'PROGRESSION_MEMORISATION',
        // Historique des pratiques
        HISTORIQUE_PRATIQUES_SF: 'HISTORIQUE_PRATIQUES_SF',
        // Suivi et compétences
        EleveConnexions: 'EleveConnexions',
        CompetencesReferentiel: 'CompetencesReferentiel',
        CriteresReussite: 'CriteresReussite',
        TachesComplexes: 'TachesComplexes',
        EleveTachesComplexes: 'EleveTachesComplexes'
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
