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
        // Calendrier scolaire
        JOURS_NON_COURS: 'JOURS_NON_COURS',
        // Suivi et compétences
        EleveConnexions: 'EleveConnexions',
        CompetencesReferentiel: 'CompetencesReferentiel',
        CriteresReussite: 'CriteresReussite',
        BanquesCompetences: 'BanquesCompetences',
        EntrainementsCompetences: 'EntrainementsCompetences',
        EleveEntrainementsCompetences: 'EleveEntrainementsCompetences',
        // Notes & évaluations
        PARAMETRES_NOTES: 'PARAMETRES_NOTES',
        OBJECTIFS_ELEVES: 'OBJECTIFS_ELEVES',
        NOTES_SOMMATIVES: 'NOTES_SOMMATIVES',
        RESULTATS_SOMMATIVES: 'RESULTATS_SOMMATIVES',
        // Progression évaluations & attribution sujets
        PROGRESSION_EVALUATION: 'PROGRESSION_EVALUATION',
        ATTRIBUTION_SUJETS: 'ATTRIBUTION_SUJETS'
    },

    // URLs de redirection (avec préfixe GitHub Pages)
    ROUTES: {
        ADMIN: '/Brikks/admin/',
        ELEVE: '/Brikks/eleve/',
        LOGIN: '/Brikks/'
    },

    // Seuils de mémorisation (répétition espacée)
    SEUIL_CONNAISSANCES: 7,   // 7 niveaux pour les entraînements connaissances
    SEUIL_SAVOIR_FAIRE: 5,    // 5 niveaux pour les exercices savoir-faire

    // Clés de stockage local
    STORAGE_KEYS: {
        USER: 'brikks_user',
        TOKEN: 'brikks_token',
        PREVIEW: 'brikks_preview',
        CACHE_CONN: 'brikks_conn_eleve_cache',
        CACHE_EXERCICES: 'brikks_exercices_cache',
        CACHE_RESULTATS: 'brikks_resultats_cache',
        CACHE_HISTORIQUE_SF: 'brikks_historique_sf_cache',
        CACHE_HISTORIQUE_SF_BANQUE: 'brikks_historique_sf_banque_cache',
        CACHE_COMPETENCES: 'brikks_competences_eleve_cache',
        CACHE_ADMIN_BANQUES: 'brikks_admin_banques_cache',
        WATCHED_VIDEOS: 'brikks_watched_videos'
    }
};

// Gel de la configuration pour éviter les modifications accidentelles
Object.freeze(CONFIG);
Object.freeze(CONFIG.SHEETS);
Object.freeze(CONFIG.ROUTES);
Object.freeze(CONFIG.STORAGE_KEYS);
