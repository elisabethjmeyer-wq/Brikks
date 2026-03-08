// ================================================================
// FICHIER AUTO-GÉNÉRÉ — ne pas modifier directement
// Généré par : npm run build:gas
// Date : 2026-03-08
// ================================================================

// ================================================================
// FILE: Code.gs
// ================================================================

/**
 * Brikks - Google Apps Script Backend
 * Routeur principal et configuration
 *
 * STRUCTURE DES FICHIERS :
 * - Code.gs         : Config, constantes, routeur (handleRequest), utilitaires
 * - Themes.gs       : Thèmes, chapitres, supports
 * - Parametres.gs   : Paramètres, config menu, test
 * - Users.gs        : Utilisateurs, classes, groupes
 * - Videos.gs       : Vidéos, recommandations
 * - FAQ.gs          : Catégories FAQ, questions FAQ
 * - Methodologie.gs : Méthodologie, progression leçons
 * - Entrainements.gs: Entraînements SF, questions, progression, mémorisation
 * - Evaluations.gs  : Évaluations
 * - Exercices.gs    : Banques, formats, exercices SF, résultats, pratiques SF
 * - Competences.gs  : Compétences, critères, tâches complexes, connexions
 * - Connaissances.gs: Banques questions, questions conn, système connaissances
 *
 * DÉPLOIEMENT :
 * 1. Ouvrir Google Sheets > Extensions > Apps Script
 * 2. Créer un fichier .gs par fichier ci-dessus
 * 3. Copier le contenu de chaque fichier
 * 4. Déployer > Nouveau déploiement > Application Web
 * 5. Exécuter en tant que : Moi
 * 6. Accès : Tout le monde
 * 7. Copier l'URL et la mettre dans config.js
 */

// Configuration
const SPREADSHEET_ID = '1rsWXHwP2fyuJ0VZKL9UAzFws9UMFqyHXDt5_j8O2Ry0';

// Noms des onglets
const SHEETS = {
  THEMES: 'THEMES',
  CHAPITRES: 'CHAPITRES',
  SUPPORTS_CHAPITRE: 'SUPPORTS_CHAPITRE',
  PARAMETRES: 'PARAMETRES',
  CONFIG_MENU: 'CONFIG_MENU',
  UTILISATEURS: 'UTILISATEURS',
  CLASSES: 'CLASSES',
  GROUPES: 'GROUPES',
  VIDEOS: 'VIDEOS',
  RECOMMANDATIONS: 'RECOMMANDATIONS',
  CATEGORIES_FAQ: 'CATEGORIES_FAQ',
  QUESTIONS_FAQ: 'QUESTIONS_FAQ',
  // Nouvelle structure méthodologie (table unique avec tree flexible)
  METHODOLOGIE: 'METHODOLOGIE',
  PROGRESSION_METHODOLOGIE: 'PROGRESSION_METHODOLOGIE',
  PROGRESSION_LECONS: 'PROGRESSION_LECONS',
  // Entraînements
  FORMATS: 'FORMATS',
  QUESTIONS: 'QUESTIONS',
  ENTRAINEMENTS: 'ENTRAINEMENTS',
  ENTRAINEMENT_QUESTIONS: 'ENTRAINEMENT_QUESTIONS',
  RESULTATS_ENTRAINEMENT: 'RESULTATS_ENTRAINEMENT',
  // Evaluations
  EVALUATIONS: 'EVALUATIONS',
  EVALUATION_QUESTIONS: 'EVALUATION_QUESTIONS',
  EVALUATION_RESULTATS: 'EVALUATION_RESULTATS',
  // Banques d'exercices (nouveau système)
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
  // Système de mémorisation (répétition espacée)
  PROGRESSION_MEMORISATION: 'PROGRESSION_MEMORISATION',
  // Historique des pratiques savoir-faire (pour calcul automatisation)
  HISTORIQUE_PRATIQUES_SF: 'HISTORIQUE_PRATIQUES_SF',
  // Notes & évaluations
  PARAMETRES_NOTES: 'PARAMETRES_NOTES',
  OBJECTIFS_ELEVES: 'OBJECTIFS_ELEVES',
  NOTES_SOMMATIVES: 'NOTES_SOMMATIVES',
  RESULTATS_SOMMATIVES: 'RESULTATS_SOMMATIVES',
  // Suivi et compétences
  EleveConnexions: 'EleveConnexions',
  CompetencesReferentiel: 'CompetencesReferentiel',
  CriteresReussite: 'CriteresReussite',
  BanquesCompetences: 'BanquesCompetences',
  EntrainementsCompetences: 'EntrainementsCompetences',
  EleveEntrainementsCompetences: 'EleveEntrainementsCompetences',
  // Progression évaluations & attribution sujets
  PROGRESSION_EVALUATION: 'PROGRESSION_EVALUATION',
  ATTRIBUTION_SUJETS: 'ATTRIBUTION_SUJETS'
};

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

/**
 * Trouve l'index d'une colonne de manière insensible à la casse
 * @param {Array} headers - Tableau des en-têtes
 * @param {string} columnName - Nom de la colonne à chercher
 * @returns {number} - Index de la colonne ou -1 si non trouvée
 */
function findColumnIndex(headers, columnName) {
  const lowerName = columnName.toLowerCase().trim();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase().trim() === lowerName) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse les données de la requête (supporte JSONP et JSON)
 * @param {Object} data - Données brutes de la requête
 * @returns {Object} - Données parsées
 */
function parseRequestData(data) {
  if (typeof data.data === 'string') {
    return JSON.parse(data.data);
  } else if (data.data) {
    return data.data;
  }
  return data;
}

/**
 * Valide qu'un ID est présent et valide
 * @param {*} id - L'ID à valider
 * @returns {boolean} - true si l'ID est valide
 */
function isValidId(id) {
  return id && id !== 'undefined' && id !== 'null' && String(id).trim() !== '';
}

/**
 * Gère les requêtes GET (lecture)
 */
function doGet(e) {
  return handleRequest(e);
}

/**
 * Gère les requêtes POST (écriture)
 */
function doPost(e) {
  return handleRequest(e);
}

/**
 * Gestionnaire principal des requêtes
 */
function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const callback = params.callback; // Support JSONP

    // Si POST avec body JSON
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // Fusionner params et data
    const request = { ...params, ...data };

    // Action : query params (JSONP) ou body (POST)
    const action = params.action || data.action;

    let result;

    switch(action) {
      // THEMES
      case 'addTheme':
        result = addTheme(request);
        break;
      case 'updateTheme':
        result = updateTheme(request);
        break;
      case 'deleteTheme':
        result = deleteTheme(request);
        break;

      // CHAPITRES
      case 'addChapter':
        result = addChapter(request);
        break;
      case 'updateChapter':
        result = updateChapter(request);
        break;
      case 'deleteChapter':
        result = deleteChapter(request);
        break;

      // SUPPORTS
      case 'addSupport':
        result = addSupport(request);
        break;
      case 'deleteChapterSupports':
        result = deleteChapterSupports(request);
        break;

      // PARAMETRES
      case 'updateParametres':
        result = updateParametres(request);
        break;

      // CONFIG_MENU
      case 'updateMenuConfig':
        result = updateMenuConfig(request);
        break;

      // UTILISATEURS
      case 'createUser':
        result = createUser(request);
        break;
      case 'updateUser':
        result = updateUser(request);
        break;
      case 'deleteUser':
        result = deleteUser(request);
        break;
      case 'resetPassword':
        result = resetPassword(request);
        break;

      // CLASSES
      case 'createClasse':
        result = createClasse(request);
        break;
      case 'deleteClasse':
        result = deleteClasse(request);
        break;

      // GROUPES
      case 'createGroupe':
        result = createGroupe(request);
        break;
      case 'deleteGroupe':
        result = deleteGroupe(request);
        break;

      // VIDEOS
      case 'createVideo':
        result = createVideo(request);
        break;
      case 'updateVideo':
        result = updateVideo(request);
        break;
      case 'deleteVideo':
        result = deleteVideo(request);
        break;

      // RECOMMANDATIONS
      case 'createRecommandation':
        result = createRecommandation(request);
        break;
      case 'updateRecommandation':
        result = updateRecommandation(request);
        break;
      case 'deleteRecommandation':
        result = deleteRecommandation(request);
        break;

      // CATEGORIES FAQ
      case 'createCategorieFAQ':
        result = createCategorieFAQ(request);
        break;
      case 'updateCategorieFAQ':
        result = updateCategorieFAQ(request);
        break;
      case 'deleteCategorieFAQ':
        result = deleteCategorieFAQ(request);
        break;

      // QUESTIONS FAQ
      case 'createQuestionFAQ':
        result = createQuestionFAQ(request);
        break;
      case 'updateQuestionFAQ':
        result = updateQuestionFAQ(request);
        break;
      case 'deleteQuestionFAQ':
        result = deleteQuestionFAQ(request);
        break;

      // METHODOLOGIE CATEGORIES
      case 'createMethodologieCategorie':
        result = createMethodologieCategorie(request);
        break;
      case 'updateMethodologieCategorie':
        result = updateMethodologieCategorie(request);
        break;
      case 'deleteMethodologieCategorie':
        result = deleteMethodologieCategorie(request);
        break;

      // METHODOLOGIE COMPETENCES
      case 'createMethodologieCompetence':
        result = createMethodologieCompetence(request);
        break;
      case 'updateMethodologieCompetence':
        result = updateMethodologieCompetence(request);
        break;
      case 'deleteMethodologieCompetence':
        result = deleteMethodologieCompetence(request);
        break;

      // METHODOLOGIE ETAPES
      case 'createMethodologieEtape':
        result = createMethodologieEtape(request);
        break;
      case 'updateMethodologieEtape':
        result = updateMethodologieEtape(request);
        break;
      case 'deleteMethodologieEtape':
        result = deleteMethodologieEtape(request);
        break;

      // PROGRESSION METHODOLOGIE
      case 'addProgressionMethodologie':
        result = addProgressionMethodologie(request);
        break;

      // NOUVELLE METHODOLOGIE (table unique avec tree flexible)
      case 'createMethodologie':
        result = createMethodologie(request);
        break;
      case 'updateMethodologie':
        result = updateMethodologie(request);
        break;
      case 'deleteMethodologie':
        result = deleteMethodologie(request);
        break;

      // PROGRESSION LECONS
      case 'addProgressionLecons':
        result = addProgressionLecons(request);
        break;

      // ENTRAINEMENTS
      case 'getEntrainements':
        result = getEntrainements(request);
        break;
      case 'getEntrainement':
        result = getEntrainement(request);
        break;
      case 'createEntrainement':
        result = createEntrainement(request);
        break;
      case 'updateEntrainement':
        result = updateEntrainement(request);
        break;
      case 'deleteEntrainement':
        result = deleteEntrainement(request);
        break;
      case 'createEntrainementQuestion':
        result = createEntrainementQuestion(request);
        break;
      case 'deleteEntrainementQuestions':
        result = deleteEntrainementQuestions(request);
        break;
      case 'deleteEntrainementQuestion':
        result = deleteEntrainementQuestion(request);
        break;

      // QUESTIONS D'ENTRAINEMENT
      case 'getQuestions':
        result = getQuestions(request);
        break;
      case 'createQuestion':
        result = createQuestion(request);
        break;
      case 'updateQuestion':
        result = updateQuestion(request);
        break;
      case 'deleteQuestion':
        result = deleteQuestion(request);
        break;

      // SYSTÈME DE MÉMORISATION
      case 'getProgressionMemorisation':
        result = getProgressionMemorisation(request);
        break;
      case 'saveProgressionMemorisation':
        result = saveProgressionMemorisation(request);
        break;

      // EVALUATIONS
      case 'getEvaluations':
        result = getEvaluations(request);
        break;
      case 'getEvaluation':
        result = getEvaluation(request);
        break;
      case 'getEvaluationForEleve':
        result = getEvaluationForEleve(request);
        break;
      case 'createEvaluation':
        result = createEvaluation(request);
        break;
      case 'updateEvaluation':
        result = updateEvaluation(request);
        break;
      case 'deleteEvaluation':
        result = deleteEvaluation(request);
        break;
      case 'saveEvaluationResult':
        result = saveEvaluationResult(request);
        break;
      case 'getEvaluationResults':
        result = getEvaluationResults(request);
        break;
      case 'getEvaluationResultForReview':
        result = getEvaluationResultForReview(request);
        break;
      case 'getEleveEvaluations':
        result = getEleveEvaluations(request);
        break;

      // PROGRESSION EVALUATION & ATTRIBUTION SUJETS
      case 'getProgressionEvaluation':
        result = getProgressionEvaluation(request);
        break;
      case 'getAttributionsSujets':
        result = getAttributionsSujets(request);
        break;
      case 'saveAttributionsSujets':
        result = saveAttributionsSujets(request);
        break;
      case 'getAttributionSujetEleve':
        result = getAttributionSujetEleve(request);
        break;

      // WORKFLOW DEMANDE D'ÉVALUATION
      case 'demanderEvaluation':
        result = demanderEvaluation(request);
        break;
      case 'repondreDemandeEvaluation':
        result = repondreDemandeEvaluation(request);
        break;
      case 'saveValidationSuivi':
        result = saveValidationSuivi(request);
        break;

      // PARAMETRES NOTES & SOMMATIVES
      case 'getParametresNotes':
        result = getParametresNotes(request);
        break;
      case 'saveParametresNotes':
        result = saveParametresNotes(request);
        break;
      case 'getNotesSommatives':
        result = getNotesSommatives(request);
        break;
      case 'createNoteSommative':
        result = createNoteSommative(request);
        break;
      case 'updateNoteSommative':
        result = updateNoteSommative(request);
        break;
      case 'deleteNoteSommative':
        result = deleteNoteSommative(request);
        break;
      case 'getResultatsSommatives':
        result = getResultatsSommatives(request);
        break;
      case 'saveResultatSommative':
        result = saveResultatSommative(request);
        break;
      case 'getObjectifsEleves':
        result = getObjectifsEleves(request);
        break;
      case 'saveObjectifEleve':
        result = saveObjectifEleve(request);
        break;

      // BANQUES D'EXERCICES
      case 'getBanquesExercices':
        result = getBanquesExercices(request);
        break;
      case 'getBanqueExercices':
        result = getBanqueExercices(request);
        break;
      case 'createBanqueExercices':
        result = createBanqueExercices(request);
        break;
      case 'updateBanqueExercices':
        result = updateBanqueExercices(request);
        break;
      case 'deleteBanqueExercices':
        result = deleteBanqueExercices(request);
        break;

      // FORMATS D'EXERCICES
      case 'getFormatsExercices':
        result = getFormatsExercices(request);
        break;
      case 'createFormatExercices':
        result = createFormatExercices(request);
        break;
      case 'updateFormatExercices':
        result = updateFormatExercices(request);
        break;
      case 'deleteFormatExercices':
        result = deleteFormatExercices(request);
        break;

      // EXERCICES
      case 'getExercices':
        result = getExercices(request);
        break;
      case 'getExercice':
        result = getExercice(request);
        break;
      case 'createExercice':
        result = createExercice(request);
        break;
      case 'updateExercice':
        result = updateExercice(request);
        break;
      case 'deleteExercice':
        result = deleteExercice(request);
        break;

      // RESULTATS EXERCICES (suivi de progression)
      case 'getResultatsEleve':
        result = getResultatsEleve(request);
        break;
      case 'saveResultatExercice':
        result = saveResultatExercice(request);
        break;

      // HISTORIQUE PRATIQUES SAVOIR-FAIRE
      case 'savePratiqueSF':
        result = savePratiqueSF(request);
        break;
      case 'getHistoriquePratiquesSF':
        result = getHistoriquePratiquesSF(request);
        break;

      // REFERENTIEL COMPETENCES
      case 'getCompetencesReferentiel':
        result = getCompetencesReferentiel(request);
        break;
      case 'createCompetenceReferentiel':
        result = createCompetenceReferentiel(request);
        break;
      case 'updateCompetenceReferentiel':
        result = updateCompetenceReferentiel(request);
        break;
      case 'deleteCompetenceReferentiel':
        result = deleteCompetenceReferentiel(request);
        break;

      // CRITERES DE REUSSITE
      case 'getCriteresReussite':
        result = getCriteresReussite(request);
        break;
      case 'getCriteresForCompetence':
        result = getCriteresForCompetence(request);
        break;
      case 'createCritereReussite':
        result = createCritereReussite(request);
        break;
      case 'updateCritereReussite':
        result = updateCritereReussite(request);
        break;
      case 'deleteCritereReussite':
        result = deleteCritereReussite(request);
        break;

      // BANQUES COMPETENCES
      case 'getBanquesCompetences':
        result = getBanquesCompetences(request);
        break;
      case 'createBanqueCompetence':
        result = createBanqueCompetence(request);
        break;
      case 'updateBanqueCompetence':
        result = updateBanqueCompetence(request);
        break;
      case 'deleteBanqueCompetence':
        result = deleteBanqueCompetence(request);
        break;

      // ENTRAINEMENTS COMPETENCES (nouvelles routes)
      case 'getEntrainementsCompetences':
        result = getEntrainementsCompetences(request);
        break;
      case 'getEntrainementCompetence':
        result = getEntrainementCompetence(request);
        break;
      case 'createEntrainementCompetence':
        result = createEntrainementCompetence(request);
        break;
      case 'updateEntrainementCompetence':
        result = updateEntrainementCompetence(request);
        break;
      case 'deleteEntrainementCompetence':
        result = deleteEntrainementCompetence(request);
        break;

      // ELEVE ENTRAINEMENTS COMPETENCES
      case 'getEleveEntrainementCompetence':
        result = getEleveEntrainementCompetence(request);
        break;
      case 'getEleveEntrainementsCompetences':
        result = getEleveEntrainementsCompetences(request);
        break;
      case 'startEleveEntrainementCompetence':
        result = startEleveEntrainementCompetence(request);
        break;
      case 'finishEleveEntrainementCompetence':
        result = finishEleveEntrainementCompetence(request);
        break;
      case 'validateEleveEntrainementCompetence':
        result = validateEleveEntrainementCompetence(request);
        break;
      case 'saveEnvoiCompetence':
        result = saveEnvoiCompetence(request);
        break;

      // ALIASES rétro-compatibilité (anciens noms « tâches complexes »)
      case 'getTachesComplexes':
        result = getEntrainementsCompetences(request);
        break;
      case 'getTacheComplexe':
        result = getEntrainementCompetence(request);
        break;
      case 'createTacheComplexe':
        result = createEntrainementCompetence(request);
        break;
      case 'updateTacheComplexe':
        result = updateEntrainementCompetence(request);
        break;
      case 'deleteTacheComplexe':
        result = deleteEntrainementCompetence(request);
        break;
      case 'getEleveTacheComplexe':
        result = getEleveEntrainementCompetence(request);
        break;
      case 'getEleveTachesComplexes':
        result = getEleveEntrainementsCompetences(request);
        break;
      case 'startEleveTacheComplexe':
        result = startEleveEntrainementCompetence(request);
        break;
      case 'finishEleveTacheComplexe':
        result = finishEleveEntrainementCompetence(request);
        break;
      case 'submitEleveTacheComplexe':
        result = finishEleveEntrainementCompetence(request);
        break;
      case 'updateEleveTacheComplexe':
        result = validateEleveEntrainementCompetence(request);
        break;

      case 'trackEleveConnexion':
        result = trackEleveConnexion(request);
        break;

      case 'getEleveConnexions':
        result = getEleveConnexions(request);
        break;

      case 'getEleveStats':
        result = getEleveStats(request);
        break;

      // BANQUES DE QUESTIONS (entraînements connaissances)
      case 'getBanquesQuestions':
        result = getBanquesQuestions(request);
        break;
      case 'createBanqueQuestions':
        result = createBanqueQuestions(request);
        break;
      case 'updateBanqueQuestions':
        result = updateBanqueQuestions(request);
        break;
      case 'deleteBanqueQuestions':
        result = deleteBanqueQuestions(request);
        break;

      // QUESTIONS CONNAISSANCES
      case 'getQuestionsConnaissances':
        result = getQuestionsConnaissances(request);
        break;
      case 'createQuestionConnaissances':
        result = createQuestionConnaissances(request);
        break;
      case 'updateQuestionConnaissances':
        result = updateQuestionConnaissances(request);
        break;
      case 'deleteQuestionConnaissances':
        result = deleteQuestionConnaissances(request);
        break;
      case 'updateQuestionsConnaissancesOrdre':
        result = updateQuestionsConnaissancesOrdre(request);
        break;
      case 'updateBanquesQuestionsOrdre':
        result = updateBanquesQuestionsOrdre(request);
        break;
      case 'updateBanquesExercicesConnOrdre':
        result = updateBanquesExercicesConnOrdre(request);
        break;
      case 'updateEntrainementsConnOrdre':
        result = updateEntrainementsConnOrdre(request);
        break;
      case 'updateBanquesExercicesOrdre':
        result = updateBanquesExercicesOrdre(request);
        break;
      case 'updateExercicesOrdre':
        result = updateExercicesOrdre(request);
        break;
      case 'updateBanquesCompetencesOrdre':
        result = updateBanquesCompetencesOrdre(request);
        break;
      case 'updateEntrainementsCompetencesOrdre':
        result = updateEntrainementsCompetencesOrdre(request);
        break;

      // NOUVEAU SYSTÈME CONNAISSANCES
      // Formats de questions
      case 'getFormatsQuestions':
        result = getFormatsQuestions();
        break;
      case 'createFormatQuestion':
        result = createFormatQuestion(request);
        break;
      case 'updateFormatQuestion':
        result = updateFormatQuestion(request);
        break;

      // Banques d'exercices connaissances
      case 'getBanquesExercicesConn':
        result = getBanquesExercicesConn();
        break;
      case 'createBanqueExercicesConn':
        result = createBanqueExercicesConn(request);
        break;
      case 'updateBanqueExercicesConn':
        result = updateBanqueExercicesConn(request);
        break;
      case 'deleteBanqueExercicesConn':
        result = deleteBanqueExercicesConn(request);
        break;

      // Entraînements connaissances
      case 'getEntrainementsConn':
        result = getEntrainementsConn();
        break;
      case 'createEntrainementConn':
        result = createEntrainementConn(request);
        break;
      case 'updateEntrainementConn':
        result = updateEntrainementConn(request);
        break;
      case 'deleteEntrainementConn':
        result = deleteEntrainementConn(request);
        break;

      // Étapes connaissances
      case 'getEtapesConn':
        result = getEtapesConn();
        break;
      case 'createEtapeConn':
        result = createEtapeConn(request);
        break;
      case 'updateEtapeConn':
        result = updateEtapeConn(request);
        break;
      case 'deleteEtapeConn':
        result = deleteEtapeConn(request);
        break;
      case 'updateEtapesOrdre':
        result = updateEtapesOrdre(request);
        break;

      // Questions des étapes
      case 'getEtapeQuestionsConn':
        result = getEtapeQuestionsConn(request);
        break;
      case 'createEtapeQuestionConn':
        result = createEtapeQuestionConn(request);
        break;
      case 'deleteEtapeQuestionConn':
        result = deleteEtapeQuestionConn(request);
        break;
      case 'setEtapeQuestionsConn':
        result = setEtapeQuestionsConn(request);
        break;
      case 'cleanupOrphanedData':
        result = cleanupOrphanedData();
        break;

      case 'migrateDureeToMinutes':
        result = migrateDureeToMinutes_();
        break;

      default:
        result = { success: false, error: 'Action non reconnue: ' + action };
    }

    return createResponse(result, callback);

  } catch (error) {
    const callback = e.parameter ? e.parameter.callback : null;
    return createResponse({
      success: false,
      error: error.message
    }, callback);
  }
}

/**
 * Migration one-shot : convertit les duree de secondes en minutes
 * pour les tables Exercices et EntrainementsCompetences.
 * Les connaissances stockent déjà en minutes, pas besoin de migrer.
 * Seuil : toute valeur > 120 est considérée comme étant en secondes.
 */
function migrateDureeToMinutes_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var migrated = { exercices: 0, competences: 0 };

  // 1. Table Exercices (SF)
  var exSheet = ss.getSheetByName(SHEETS.EXERCICES);
  if (exSheet) {
    var exData = exSheet.getDataRange().getValues();
    if (exData.length >= 2) {
      var exHeaders = exData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var dureeCol = exHeaders.indexOf('duree');
      if (dureeCol >= 0) {
        for (var i = 1; i < exData.length; i++) {
          var val = parseInt(exData[i][dureeCol]);
          if (val > 120) {
            var newVal = Math.round(val / 60);
            exSheet.getRange(i + 1, dureeCol + 1).setValue(newVal);
            migrated.exercices++;
          }
        }
      }
    }
  }

  // 2. Table EntrainementsCompetences
  var compSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_COMPETENCES);
  if (compSheet) {
    var compData = compSheet.getDataRange().getValues();
    if (compData.length >= 2) {
      var compHeaders = compData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var dureeCol2 = compHeaders.indexOf('duree');
      if (dureeCol2 >= 0) {
        for (var j = 1; j < compData.length; j++) {
          var val2 = parseInt(compData[j][dureeCol2]);
          if (val2 > 120) {
            var newVal2 = Math.round(val2 / 60);
            compSheet.getRange(j + 1, dureeCol2 + 1).setValue(newVal2);
            migrated.competences++;
          }
        }
      }
    }
  }

  return { success: true, migrated: migrated };
}

/**
 * Crée une réponse (JSONP si callback, sinon JSON)
 */
function createResponse(data, callback) {
  if (callback) {
    // JSONP : retourne du JavaScript qui appelle le callback
    const jsonData = JSON.stringify(data);
    return ContentService
      .createTextOutput(callback + '(' + jsonData + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // JSON classique
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ================================================================
// FILE: Competences.gs
// ================================================================

// ========================================
// REFERENTIEL COMPETENCES
// Colonnes : id, nom, description, consigne, ordre, visible, matiere
// ========================================

/**
 * Récupère toutes les compétences du référentiel
 */
function getCompetencesReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var competences = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var competence = {};
    headers.forEach(function(header, index) {
      competence[header] = row[index];
    });
    competences.push(competence);
  }

  return { success: true, data: competences };
}

/**
 * Crée une nouvelle compétence dans le référentiel
 */
function createCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CompetencesReferentiel);
    sheet.appendRow(['id', 'nom', 'description', 'consigne', 'ordre', 'visible', 'matiere']);
  }

  // Migration progressive : ajouter la colonne matiere si elle manque
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('matiere') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('matiere');
    headers.push('matiere');
  }

  var id = 'comp_' + new Date().getTime();

  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'nom': return data.nom || '';
      case 'description': return data.description || '';
      case 'consigne': return data.consigne || '';
      case 'ordre': return data.ordre || 1;
      case 'visible': return data.visible !== undefined ? data.visible : true;
      case 'matiere': return data.matiere || 'Transversal';
      default: return '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une compétence du référentiel
 */
function updateCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter la colonne matiere si elle manque
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('matiere') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('matiere');
    currentHeaders.push('matiere');
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

/**
 * Supprime une compétence du référentiel
 */
function deleteCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

// ========================================
// CRITERES DE REUSSITE
// Colonnes : id, competence_id, libelle, ordre
// (inchangé)
// ========================================

/**
 * Récupère tous les critères de réussite
 */
function getCriteresReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Récupère les critères pour une compétence spécifique
 */
function getCriteresForCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  if (!sheet || !data.competence_id) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var compIdCol = headers.indexOf('competence_id');
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (String(row[compIdCol]) === String(data.competence_id)) {
      var item = {};
      headers.forEach(function(header, index) {
        item[header] = row[index];
      });
      result.push(item);
    }
  }

  // Trier par ordre
  result.sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });

  return { success: true, data: result };
}

/**
 * Crée un nouveau critère de réussite
 */
function createCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CriteresReussite);
    sheet.appendRow(['id', 'competence_id', 'libelle', 'ordre']);
  }

  var id = 'crit_' + new Date().getTime();
  var rowData = [
    id,
    data.competence_id || '',
    data.libelle || '',
    data.ordre || 1
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour un critère de réussite
 */
function updateCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

/**
 * Supprime un critère de réussite
 */
function deleteCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

// ========================================
// BANQUES COMPETENCES
// Couche intermédiaire entre le référentiel et les entraînements.
// Chaque banque est liée à une compétence et contrôle la visibilité élève.
// Colonnes : id, competence_id, titre, description, ordre, statut, date_creation
// ========================================

/**
 * Récupère toutes les banques de compétences
 * @param {Object} data - {competence_id?} filtre optionnel
 */
function getBanquesCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var banques = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var banque = {};
    headers.forEach(function(header, index) {
      banque[header] = row[index];
    });
    banques.push(banque);
  }

  // Filtrer par competence_id si fourni
  if (data && data.competence_id) {
    banques = banques.filter(function(b) {
      return String(b.competence_id) === String(data.competence_id);
    });
  }

  // Filtrer par type_usage si fourni (entrainement, eval_bonus, tache_complexe)
  if (data && data.type_usage) {
    banques = banques.filter(function(b) {
      return String(b.type_usage || 'entrainement') === String(data.type_usage);
    });
  }

  return { success: true, data: banques };
}

/**
 * Crée une nouvelle banque de compétence
 */
function createBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.BanquesCompetences);
    sheet.appendRow(['id', 'competence_id', 'titre', 'description', 'ordre', 'statut', 'date_creation']);
  }

  // Migration progressive : nouvelles colonnes
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['type_usage', 'competence_ids'];
  newCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headers.push(col);
    }
  });

  var id = 'bc_' + new Date().getTime();

  // Relire les headers après migration
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'competence_id': return data.competence_id || '';
      case 'titre': return data.titre || '';
      case 'description': return data.description || '';
      case 'ordre': return data.ordre || 1;
      case 'statut': return data.statut || 'brouillon';
      case 'date_creation': return new Date().toISOString();
      case 'type_usage': return data.type_usage || 'entrainement';
      case 'competence_ids': return data.competence_ids || '';
      default: return data[h] !== undefined ? data[h] : '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une banque de compétence
 */
function updateBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (header === 'date_creation') return allData[i][index]; // Immutable
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Banque non trouvée' };
}

/**
 * Supprime une banque de compétence et ses entraînements associés
 */
function deleteBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  var found = false;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, error: 'Banque non trouvée' };
  }

  // Cascade : supprimer les entraînements associés à cette banque
  var entrSheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);
  if (entrSheet) {
    var entrData = entrSheet.getDataRange().getValues();
    var entrHeaders = entrData[0];
    var banqueIdCol = entrHeaders.indexOf('banque_id');
    if (banqueIdCol !== -1) {
      var rowsToDelete = [];
      for (var j = 1; j < entrData.length; j++) {
        if (String(entrData[j][banqueIdCol]) === String(data.id)) {
          rowsToDelete.push(j + 1);
        }
      }
      // Supprimer du bas vers le haut
      for (var k = rowsToDelete.length - 1; k >= 0; k--) {
        entrSheet.deleteRow(rowsToDelete[k]);
      }
    }
  }

  return { success: true };
}

// ========================================
// ENTRAINEMENTS COMPETENCES
// (anciennement « Tâches Complexes »)
// Colonnes : id, titre, competence_id, banque_id, description, document_url,
//            document_contenu, document_legende, correction_commentee,
//            correction_contenu, duree, ordre, statut, date_creation
// ========================================

/**
 * Récupère tous les entraînements de compétences
 * @param {Object} data - {competence_id?} filtre optionnel
 */
function getEntrainementsCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var entrainements = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var entry = {};
    headers.forEach(function(header, index) {
      // Parser correction_commentee en JSON si présent
      if (header === 'correction_commentee' && row[index]) {
        try {
          entry[header] = JSON.parse(row[index]);
        } catch (e) {
          entry[header] = row[index];
        }
      } else {
        entry[header] = row[index];
      }
    });
    entrainements.push(entry);
  }

  // Filtrer par banque_id si fourni
  if (data && data.banque_id) {
    entrainements = entrainements.filter(function(e) {
      return String(e.banque_id) === String(data.banque_id);
    });
  }
  // Filtrer par competence_id si fourni (rétro-compatibilité)
  else if (data && data.competence_id) {
    entrainements = entrainements.filter(function(e) {
      return String(e.competence_id) === String(data.competence_id);
    });
  }

  return { success: true, data: entrainements };
}

/**
 * Récupère un entraînement de compétence par son ID
 * @param {Object} data - {id}
 */
function getEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var entry = {};
      headers.forEach(function(header, index) {
        if (header === 'correction_commentee' && allData[i][index]) {
          try {
            entry[header] = JSON.parse(allData[i][index]);
          } catch (e) {
            entry[header] = allData[i][index];
          }
        } else {
          entry[header] = allData[i][index];
        }
      });
      return { success: true, data: entry };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Crée un nouvel entraînement de compétence
 */
function createEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EntrainementsCompetences);
    sheet.appendRow([
      'id', 'titre', 'competence_id', 'banque_id', 'description', 'document_url',
      'document_contenu', 'document_legende', 'correction_commentee',
      'correction_contenu', 'duree', 'ordre', 'statut', 'date_creation'
    ]);
  }

  // Migration progressive : ajouter les colonnes manquantes
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['banque_id', 'document_contenu', 'correction_contenu', 'delai_mail_minutes', 'delai_papier_jours', 'competence_ids', 'criteres_libres'];
  newCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
      headers.push(col);
    }
  });

  var id = 'ec_' + new Date().getTime();

  // Sérialiser correction_commentee si c'est un objet
  var correction = data.correction_commentee || '';
  if (typeof correction === 'object') {
    correction = JSON.stringify(correction);
  }

  // Relire les headers après éventuel ajout de colonne
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'titre': return data.titre || '';
      case 'competence_id': return data.competence_id || '';
      case 'banque_id': return data.banque_id || '';
      case 'description': return data.description || '';
      case 'document_url': return data.document_url || '';
      case 'document_contenu': return data.document_contenu || '';
      case 'document_legende': return data.document_legende || '';
      case 'correction_commentee': return correction;
      case 'correction_contenu': return data.correction_contenu || '';
      case 'duree': return data.duree || 30;
      case 'ordre': return data.ordre || 1;
      case 'statut': return data.statut || 'brouillon';
      case 'date_creation': return new Date().toISOString();
      case 'delai_mail_minutes': return data.delai_mail_minutes || 30;
      case 'delai_papier_jours': return data.delai_papier_jours || 1;
      case 'competence_ids': return data.competence_ids || '';
      case 'criteres_libres': return data.criteres_libres || '';
      default: return '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour un entraînement de compétence
 */
function updateEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes manquantes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['banque_id', 'document_contenu', 'correction_contenu', 'delai_mail_minutes', 'delai_papier_jours', 'competence_ids', 'criteres_libres'];
  newCols.forEach(function(col) {
    if (currentHeaders.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
      currentHeaders.push(col);
    }
  });

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (header === 'date_creation') return allData[i][index]; // Immutable
        if (data[header] !== undefined) {
          // Sérialiser correction_commentee si c'est un objet
          if (header === 'correction_commentee' && typeof data[header] === 'object') {
            return JSON.stringify(data[header]);
          }
          return data[header];
        }
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Supprime un entraînement de compétence et ses progressions élèves associées
 */
function deleteEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille EntrainementsCompetences non trouvée' };
  }

  if (!data.id) {
    return { success: false, error: 'id manquant dans la requête' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  if (idCol === -1) {
    return { success: false, error: 'Colonne id non trouvée dans EntrainementsCompetences' };
  }

  var found = false;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, error: 'Entraînement non trouvé: ' + String(data.id) };
  }

  // Cascade : supprimer les progressions élèves pour cet entraînement
  var eleveSheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);
  if (eleveSheet) {
    var eleveData = eleveSheet.getDataRange().getValues();
    var eleveHeaders = eleveData[0];
    var entrIdCol = eleveHeaders.indexOf('entrainement_id');
    if (entrIdCol !== -1) {
      var rowsToDelete = [];
      for (var j = 1; j < eleveData.length; j++) {
        if (String(eleveData[j][entrIdCol]) === String(data.id)) {
          rowsToDelete.push(j + 1);
        }
      }
      for (var k = rowsToDelete.length - 1; k >= 0; k--) {
        eleveSheet.deleteRow(rowsToDelete[k]);
      }
    }
  }

  return { success: true, deleted_id: String(data.id) };
}

// ========================================
// ELEVE — ENTRAINEMENTS COMPETENCES
// (anciennement « Élève Tâches Complexes »)
// Colonnes : id, eleve_id, entrainement_id, mode, statut,
//            date_debut, date_fin, date_soumission, temps_passe,
//            date_correction
// Modes : entrainement | evalue
// Statuts : en_cours | entraine | soumis | valide
// ========================================

/**
 * Récupère le statut d'un entraînement pour un élève
 * @param {Object} data - {eleve_id, entrainement_id}
 */
function getEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: true, data: null };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: null };
  }

  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {
      var record = {};
      headers.forEach(function(header, index) {
        record[header] = allData[i][index];
      });
      return { success: true, data: record };
    }
  }

  return { success: true, data: null };
}

/**
 * Récupère tous les entraînements de compétences d'un élève (ou tous si admin)
 * @param {Object} data - {eleve_id} ou {} pour admin
 */
function getEleveEntrainementsCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var records = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (data && data.eleve_id) {
      if (String(record.eleve_id) === String(data.eleve_id)) {
        records.push(record);
      }
    } else {
      records.push(record);
    }
  }

  return { success: true, data: records };
}

/**
 * Démarre un entraînement de compétence pour un élève
 * - Si pas d'enregistrement : crée un nouveau
 * - Si déjà entraîné et nouveau mode = évalué : met à jour
 * - Si soumis ou validé : refuse
 * @param {Object} data - {eleve_id, entrainement_id, mode: 'entrainement'|'evalue'}
 */
function startEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EleveEntrainementsCompetences);
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'mode', 'statut',
      'date_debut', 'date_fin', 'date_soumission', 'temps_passe',
      'date_correction'
    ]);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');

  // Chercher un enregistrement existant
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var existingRecord = {};
      headers.forEach(function(header, index) {
        existingRecord[header] = allData[i][index];
      });

      var existingStatut = String(existingRecord.statut);

      // En cours : reprendre
      if (existingStatut === 'en_cours') {
        return { success: true, id: existingRecord.id, resumed: true };
      }

      // Déjà entraîné et on veut passer en mode évalué : autoriser
      if (existingStatut === 'entraine' && data.mode === 'evalue') {
        var modeCol = headers.indexOf('mode');
        var statutCol = headers.indexOf('statut');
        var dateDebutCol = headers.indexOf('date_debut');
        sheet.getRange(i + 1, modeCol + 1).setValue('evalue');
        sheet.getRange(i + 1, statutCol + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, upgraded: true };
      }

      // Déjà soumis, corrigé ou validé : refuser
      if (existingStatut === 'soumis' || existingStatut === 'corrige' || existingStatut === 'valide') {
        var errorMsg = 'Compétence déjà validée sur cet exercice';
        if (existingStatut === 'soumis') errorMsg = 'Production déjà soumise, en attente de correction';
        if (existingStatut === 'corrige') errorMsg = 'Production corrigée, en attente de validation';
        return {
          success: false,
          error: errorMsg,
          existing: existingRecord
        };
      }

      // Non soumis (l'élève avait refusé) : autoriser à recommencer
      if (existingStatut === 'non_soumis') {
        var modeCol3 = headers.indexOf('mode');
        var statutCol3 = headers.indexOf('statut');
        var dateDebutCol3 = headers.indexOf('date_debut');
        sheet.getRange(i + 1, modeCol3 + 1).setValue(data.mode || 'entrainement');
        sheet.getRange(i + 1, statutCol3 + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol3 + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, resumed: true };
      }

      // Entraîné et on veut s'entraîner à nouveau : autoriser
      if (existingStatut === 'entraine' && data.mode === 'entrainement') {
        var statutCol2 = headers.indexOf('statut');
        var dateDebutCol2 = headers.indexOf('date_debut');
        sheet.getRange(i + 1, statutCol2 + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol2 + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, resumed: true };
      }
    }
  }

  // Pas d'enregistrement existant : créer
  var id = 'eec_' + new Date().getTime();
  var rowData = [
    id,
    data.eleve_id,
    data.entrainement_id,
    data.mode || 'entrainement',
    'en_cours',
    new Date().toISOString(),
    '', // date_fin
    '', // date_soumission
    '', // temps_passe
    '', // date_correction
    ''  // date_envoi
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Termine un entraînement de compétence pour un élève
 * - Mode entrainement → statut = entraine
 * - Mode évalué → statut = soumis (ou non_soumis si l'élève refuse)
 * @param {Object} data - {eleve_id, entrainement_id, temps_passe?, mode_rendu?}
 *   mode_rendu : 'papier' | 'numerique' | 'non_soumis' (optionnel, mode évaluation)
 */
function finishEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes mode_rendu et date_envoi si absentes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('mode_rendu') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('mode_rendu');
  }
  currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('date_envoi') === -1) {
    var nextCol2 = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol2).setValue('date_envoi');
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var modeCol = headers.indexOf('mode');
  var statutCol = headers.indexOf('statut');
  var dateFinCol = headers.indexOf('date_fin');
  var dateSoumissionCol = headers.indexOf('date_soumission');
  var tempsPasseCol = headers.indexOf('temps_passe');
  var modeRenduCol = headers.indexOf('mode_rendu');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var mode = String(allData[i][modeCol]);
      var now = new Date().toISOString();

      if (mode === 'evalue') {
        // Déterminer le statut selon le mode de rendu
        var statut = (data.mode_rendu === 'non_soumis') ? 'non_soumis' : 'soumis';
        sheet.getRange(i + 1, statutCol + 1).setValue(statut);
        sheet.getRange(i + 1, dateSoumissionCol + 1).setValue(now);
      } else {
        // Mode entraînement : marquer comme entraîné
        sheet.getRange(i + 1, statutCol + 1).setValue('entraine');
        sheet.getRange(i + 1, dateFinCol + 1).setValue(now);
      }

      // Temps passé (optionnel)
      if (data.temps_passe && tempsPasseCol !== -1) {
        sheet.getRange(i + 1, tempsPasseCol + 1).setValue(data.temps_passe);
      }

      // Mode de rendu (optionnel)
      if (data.mode_rendu && modeRenduCol !== -1) {
        sheet.getRange(i + 1, modeRenduCol + 1).setValue(data.mode_rendu);
      }

      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Enregistre la date d'envoi du travail par l'élève (déclaratif)
 * L'élève clique "J'ai envoyé mon travail" → horodatage automatique
 * @param {Object} data - {eleve_id, entrainement_id}
 */
function saveEnvoiCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter date_envoi si absente
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('date_envoi') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('date_envoi');
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var dateEnvoiCol = headers.indexOf('date_envoi');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var now = new Date().toISOString();
      sheet.getRange(i + 1, dateEnvoiCol + 1).setValue(now);
      return { success: true, date_envoi: now };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Valide un entraînement de compétence (action enseignante)
 * @param {Object} data - {id} ou {eleve_id, entrainement_id}
 */
function validateEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes manquantes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colsToAdd = ['remarque_prof', 'correction_prof', 'criteres_valides', 'statut_correction'];
  for (var c = 0; c < colsToAdd.length; c++) {
    if (currentHeaders.indexOf(colsToAdd[c]) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(colsToAdd[c]);
      currentHeaders.push(colsToAdd[c]);
    }
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var statutCol = headers.indexOf('statut');
  var dateCorrectionCol = headers.indexOf('date_correction');
  var remarqueProfCol = headers.indexOf('remarque_prof');
  var correctionProfCol = headers.indexOf('correction_prof');
  var criteresValidesCol = headers.indexOf('criteres_valides');
  var statutCorrectionCol = headers.indexOf('statut_correction');

  for (var i = 1; i < allData.length; i++) {
    var match = false;

    // Recherche par id
    if (data.id) {
      match = String(allData[i][idCol]) === String(data.id);
    }
    // Recherche par eleve_id + entrainement_id
    else if (data.eleve_id && data.entrainement_id) {
      match = String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
              String(allData[i][entrainementIdCol]) === String(data.entrainement_id);
    }

    if (match) {
      var newStatut = data.statut || 'valide';
      sheet.getRange(i + 1, statutCol + 1).setValue(newStatut);
      if (dateCorrectionCol !== -1) {
        sheet.getRange(i + 1, dateCorrectionCol + 1).setValue(new Date().toISOString());
      }
      // Remarque prof (texte court)
      if (remarqueProfCol !== -1 && data.remarque_prof !== undefined) {
        sheet.getRange(i + 1, remarqueProfCol + 1).setValue(data.remarque_prof);
      }
      // Correction personnalisée (URL ou HTML)
      if (correctionProfCol !== -1 && data.correction_prof !== undefined) {
        sheet.getRange(i + 1, correctionProfCol + 1).setValue(data.correction_prof);
      }
      // Critères de réussite validés (JSON array d'IDs)
      if (criteresValidesCol !== -1 && data.criteres_valides !== undefined) {
        sheet.getRange(i + 1, criteresValidesCol + 1).setValue(data.criteres_valides);
      }
      // Visibilité correction (brouillon / publie)
      if (statutCorrectionCol !== -1 && data.statut_correction !== undefined) {
        sheet.getRange(i + 1, statutCorrectionCol + 1).setValue(data.statut_correction);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

// ========================================
// DRAG & DROP : ORDRE DES BANQUES ET ENTRAÎNEMENTS COMPÉTENCES
// ========================================

/**
 * Met à jour l'ordre des banques de compétences (pour drag & drop).
 */
function updateBanquesCompetencesOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BanquesCompetences);
  if (!sheet) return { success: false, error: 'Feuille BanquesCompetences non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) { allData[r].push(''); }
  }
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) { ordreMap[String(b.id).trim()] = b.ordre; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true, message: 'Ordre des banques de compétences mis à jour' };
}

/**
 * Met à jour l'ordre des entraînements de compétences (pour drag & drop).
 */
function updateEntrainementsCompetencesOrdre(data) {
  var entrainements = data.entrainements;
  if (typeof entrainements === 'string') {
    try { entrainements = JSON.parse(entrainements); } catch (e) {
      return { success: false, error: 'Format entrainements invalide' };
    }
  }
  if (!entrainements || !Array.isArray(entrainements)) {
    return { success: false, error: 'entrainements array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EntrainementsCompetences);
  if (!sheet) return { success: false, error: 'Feuille EntrainementsCompetences non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) { allData[r].push(''); }
  }
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  entrainements.forEach(function(e) { ordreMap[String(e.id).trim()] = e.ordre; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true, message: 'Ordre des entraînements de compétences mis à jour' };
}

// ========================================
// ALIASES — Rétro-compatibilité
// Les anciens noms d'actions continuent de fonctionner
// pendant la transition vers la nouvelle terminologie.
// ========================================

function getTachesComplexes(data)          { return getEntrainementsCompetences(data); }
function getTacheComplexe(data)            { return getEntrainementCompetence(data); }
function createTacheComplexe(data)         { return createEntrainementCompetence(data); }
function updateTacheComplexe(data)         { return updateEntrainementCompetence(data); }
function deleteTacheComplexe(data)         { return deleteEntrainementCompetence(data); }
function getEleveTacheComplexe(data)       { return getEleveEntrainementCompetence(data); }
function getEleveTachesComplexes(data)     { return getEleveEntrainementsCompetences(data); }
function startEleveTacheComplexe(data)     { return startEleveEntrainementCompetence(data); }
function finishEleveTacheComplexe(data)    { return finishEleveEntrainementCompetence(data); }
function submitEleveTacheComplexe(data)    { return finishEleveEntrainementCompetence(data); }
function updateEleveTacheComplexe(data)    { return validateEleveEntrainementCompetence(data); }

// ========================================
// TRACKING (inchangé)
// ========================================

/**
 * Enregistre une connexion/visite d'élève
 * @param {Object} data - {eleve_id, page, action}
 */
function trackEleveConnexion(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveConnexions);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EleveConnexions);
    sheet.appendRow(['id', 'eleve_id', 'page', 'action', 'timestamp', 'user_agent']);
  }

  var id = 'conn_' + new Date().getTime();
  sheet.appendRow([
    id,
    data.eleve_id,
    data.page || '',
    data.action || 'visit',
    new Date().toISOString(),
    data.user_agent || ''
  ]);

  // Mettre à jour la dernière connexion de l'utilisateur
  updateUserLastConnexion(data.eleve_id);

  return { success: true, id: id };
}

/**
 * Met à jour la dernière connexion d'un utilisateur
 */
function updateUserLastConnexion(userId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.UTILISATEURS);
  if (!sheet) return;

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  var lastConnexionCol = headers.indexOf('derniere_connexion');
  if (lastConnexionCol === -1) {
    lastConnexionCol = headers.length;
    sheet.getRange(1, lastConnexionCol + 1).setValue('derniere_connexion');
  }

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(userId)) {
      sheet.getRange(i + 1, lastConnexionCol + 1).setValue(new Date().toISOString());
      break;
    }
  }
}

/**
 * Récupère les connexions d'un élève
 * @param {Object} data - {eleve_id} ou {} pour toutes
 */
function getEleveConnexions(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveConnexions);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var records = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (data && data.eleve_id) {
      if (String(record.eleve_id) === String(data.eleve_id)) {
        records.push(record);
      }
    } else {
      records.push(record);
    }
  }

  return { success: true, data: records };
}

/**
 * Récupère les statistiques d'un élève
 * @param {Object} data - {eleve_id}
 */
function getEleveStats(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Stats de connexions
  var connexionsSheet = ss.getSheetByName(SHEETS.EleveConnexions);
  var totalConnexions = 0;
  var pagesVisitees = {};
  var derniereConnexion = null;

  if (connexionsSheet) {
    var connData = connexionsSheet.getDataRange().getValues();
    var connHeaders = connData[0];
    var eleveIdCol = connHeaders.indexOf('eleve_id');
    var pageCol = connHeaders.indexOf('page');
    var timestampCol = connHeaders.indexOf('timestamp');

    for (var i = 1; i < connData.length; i++) {
      if (String(connData[i][eleveIdCol]) === String(data.eleve_id)) {
        totalConnexions++;
        var page = connData[i][pageCol];
        pagesVisitees[page] = (pagesVisitees[page] || 0) + 1;

        var timestamp = connData[i][timestampCol];
        if (!derniereConnexion || new Date(timestamp) > new Date(derniereConnexion)) {
          derniereConnexion = timestamp;
        }
      }
    }
  }

  // Stats des entraînements de compétences
  var entrSheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);
  var entrStats = { total: 0, en_cours: 0, entraine: 0, soumis: 0, valide: 0 };

  if (entrSheet) {
    var entrData = entrSheet.getDataRange().getValues();
    var entrHeaders = entrData[0];
    var entrEleveIdCol = entrHeaders.indexOf('eleve_id');
    var entrStatutCol = entrHeaders.indexOf('statut');

    for (var j = 1; j < entrData.length; j++) {
      if (String(entrData[j][entrEleveIdCol]) === String(data.eleve_id)) {
        entrStats.total++;
        var statut = entrData[j][entrStatutCol];
        if (entrStats[statut] !== undefined) {
          entrStats[statut]++;
        }
      }
    }
  }

  return {
    success: true,
    data: {
      connexions: {
        total: totalConnexions,
        derniere: derniereConnexion,
        pages: pagesVisitees
      },
      entrainements_competences: entrStats
    }
  };
}

// ================================================================
// FILE: Connaissances.gs
// ================================================================

// ========================================
// BANQUES DE QUESTIONS (entraînements connaissances)
// ========================================

/**
 * Récupère toutes les banques de questions
 */
function getBanquesQuestions() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_QUESTIONS);
  if (!sheet) {
    return { success: true, data: [] };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const banques = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => {
      row[h] = data[i][j];
    });
    banques.push(row);
  }

  return { success: true, data: banques };
}

/**
 * Crée une banque de questions
 */
function createBanqueQuestions(data) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_QUESTIONS);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.BANQUES_QUESTIONS);
    sheet.appendRow(['id', 'titre', 'description', 'theme_id', 'chapitre_id', 'date_creation', 'statut']);
  }

  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  const id = 'bq_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'statut') return data.statut || 'brouillon';
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Banque de questions créée' };
}

/**
 * Met à jour une banque de questions.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.BANQUES_QUESTIONS, data, ['titre', 'description', 'theme_id', 'chapitre_id', 'statut'], 'Banque');
}

/**
 * Supprime une banque de questions et ses questions.
 * Optimisé : 1 seule ouverture du tableur, suppression en batch par feuille.
 */
function deleteBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var banqueId = String(data.id).trim();

  // 1. Supprimer les questions liées
  deleteRowsByColumnValue_(ss, SHEETS.QUESTIONS_CONNAISSANCES, 'banque_id', banqueId);

  // 2. Supprimer la banque elle-même
  deleteRowsByColumnValue_(ss, SHEETS.BANQUES_QUESTIONS, 'id', banqueId);

  return { success: true, message: 'Banque supprimée' };
}

// ========================================
// QUESTIONS CONNAISSANCES
// ========================================

/**
 * Récupère les questions (optionnellement filtrées par banque_id et/ou type)
 */
function getQuestionsConnaissances(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const banqueIdCol = headers.indexOf('banque_id');
  const typeCol = headers.indexOf('type');

  const questions = [];

  for (let i = 1; i < allData.length; i++) {
    // Filtrer par banque_id si fourni
    if (data && data.banque_id && banqueIdCol >= 0) {
      if (String(allData[i][banqueIdCol]).trim() !== String(data.banque_id).trim()) {
        continue;
      }
    }

    // Filtrer par type si fourni
    if (data && data.type && typeCol >= 0) {
      if (String(allData[i][typeCol]).trim() !== String(data.type).trim()) {
        continue;
      }
    }

    const row = {};
    headers.forEach((h, j) => {
      row[h] = allData[i][j];
    });
    questions.push(row);
  }

  return { success: true, data: questions };
}

/**
 * Crée une question de connaissances
 * Types supportés: qcm, vrai_faux, chronologie, timeline, association, texte_trou
 */
function createQuestionConnaissances(data) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.QUESTIONS_CONNAISSANCES);
    sheet.appendRow(['id', 'banque_id', 'type', 'titre_prof', 'donnees', 'difficulte', 'date_creation']);
  }

  if (!data.banque_id || !data.type || !data.donnees) {
    return { success: false, error: 'banque_id, type et donnees requis' };
  }

  const id = 'qc_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Question créée' };
}

/**
 * Met à jour une question de connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.QUESTIONS_CONNAISSANCES, data, ['type', 'titre_prof', 'donnees', 'difficulte'], 'Question');
}

/**
 * Supprime une question de connaissances.
 * Optimisé : 1 seule ouverture du tableur, cascade batch.
 */
function deleteQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var questionId = String(data.id).trim();

  // CASCADE: Supprimer les références dans ETAPE_QUESTIONS_CONN
  deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'question_id', questionId);

  // Supprimer la question elle-même
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.QUESTIONS_CONNAISSANCES, 'id', questionId);
  if (deleted === 0) {
    return { success: false, error: 'Question non trouvée' };
  }

  return { success: true, message: 'Question supprimée' };
}

// ========================================
// NOUVEAU SYSTÈME CONNAISSANCES
// ========================================

// ========== FORMATS QUESTIONS ==========

/**
 * Récupère tous les formats de questions
 */
function getFormatsQuestions() {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_QUESTIONS);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.FORMATS_QUESTIONS);
    sheet.appendRow(['id', 'nom', 'code', 'icone', 'description', 'config_defaut', 'actif', 'ordre']);
    // Ajouter les formats par défaut pour les entraînements de connaissances
    const defaultFormats = [
      ['fmt_qcm', 'QCM', 'qcm', '🔘', 'Question à choix multiples', '{}', 'oui', 1],
      ['fmt_vrai_faux', 'Vrai/Faux', 'vrai_faux', '✓✗', 'Question vrai ou faux', '{}', 'oui', 2],
      ['fmt_chronologie', 'Chronologie', 'chronologie', '📊', 'Compléter une frise chronologique (dates et/ou événements)', '{}', 'oui', 3],
      ['fmt_timeline', 'Timeline', 'timeline', '🎴', 'Cartes à ordonner chronologiquement (retournables après correction)', '{}', 'oui', 4],
      ['fmt_association', 'Association', 'association', '🔗', 'Associer des éléments entre eux', '{}', 'oui', 5],
      ['fmt_texte_trou', 'Texte à trous', 'texte_trou', '📝', 'Compléter un texte avec les mots manquants', '{}', 'oui', 6],
      ['fmt_carte', 'Image cliquable', 'carte', '🗺️', 'Localiser des éléments sur une carte ou image', '{}', 'oui', 7],
      ['fmt_question_ouverte', 'Question ouverte', 'question_ouverte', '✏️', 'Question avec réponse libre (texte)', '{}', 'oui', 8]
    ];
    defaultFormats.forEach(row => sheet.appendRow(row));
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const formats = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(f => f.actif === 'oui' || f.actif === true);

  return { success: true, data: formats };
}

/**
 * Crée un nouveau format de question
 */
function createFormatQuestion(data) {
  if (!data.nom || !data.code) {
    return { success: false, error: 'nom et code requis' };
  }

  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_QUESTIONS);
  if (!sheet) {
    getFormatsQuestions(); // Créer la feuille
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_QUESTIONS);
  }

  const id = 'fmt_' + data.code.toLowerCase().replace(/[^a-z0-9]/g, '_');

  sheet.appendRow([
    id,
    data.nom,
    data.code,
    data.icone || '❓',
    data.description || '',
    data.config_defaut || '{}',
    'oui',
    data.ordre || 99
  ]);

  return { success: true, id: id, message: 'Format créé' };
}

/**
 * Met à jour un format de question.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateFormatQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.FORMATS_QUESTIONS, data, ['nom', 'code', 'icone', 'description', 'config_defaut', 'actif', 'ordre'], 'Format');
}

// ========== BANQUES D'EXERCICES CONNAISSANCES ==========

/**
 * Récupère toutes les banques d'exercices connaissances
 */
function getBanquesExercicesConn() {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);

  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.BANQUES_EXERCICES_CONN);
    sheet.appendRow(['id', 'titre', 'description', 'type', 'statut', 'ordre', 'date_creation', 'matiere']);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const banques = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(b => b.id);

  return { success: true, data: banques };
}

/**
 * Crée une banque d'exercices connaissances
 */
function createBanqueExercicesConn(data) {
  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  if (!sheet) {
    getBanquesExercicesConn();
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  }

  const id = 'bec_' + new Date().getTime();

  sheet.appendRow([
    id,
    data.titre,
    data.description || '',
    data.type || 'lecon',
    data.statut || 'brouillon',
    data.ordre || 1,
    new Date().toISOString().split('T')[0],
    data.matiere || ''
  ]);

  return { success: true, id: id, message: 'Banque créée' };
}

/**
 * Met à jour une banque d'exercices connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.BANQUES_EXERCICES_CONN, data, ['titre', 'description', 'type', 'statut', 'ordre', 'matiere'], 'Banque');
}

/**
 * Supprime une banque d'exercices connaissances.
 * Optimisé : cascade complète en 1 passe (1 lecture par feuille, suppressions en batch).
 */
function deleteBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var banqueId = String(data.id).trim();

  // 1. Collecter les IDs d'entraînements de cette banque
  var entrainementIds = collectColumnValues_(ss, SHEETS.ENTRAINEMENTS_CONN, 'banque_exercice_id', banqueId, 'id');

  // 2. Collecter les IDs d'étapes de ces entraînements
  var etapeIds = [];
  if (entrainementIds.length > 0) {
    etapeIds = collectColumnValuesMulti_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementIds, 'id');
  }

  // 3. Supprimer en cascade (du plus profond au plus haut)
  if (etapeIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeIds);
  }
  if (entrainementIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementIds);
    deleteRowsByColumnValueMulti_(ss, SHEETS.PROGRESSION_MEMORISATION, 'entrainement_id', entrainementIds);
    deleteRowsByColumnValueMulti_(ss, SHEETS.ENTRAINEMENTS_CONN, 'id', entrainementIds);
  }

  // 4. Supprimer la banque
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.BANQUES_EXERCICES_CONN, 'id', banqueId);
  if (deleted === 0) {
    return { success: false, error: 'Banque non trouvée' };
  }

  return { success: true, message: 'Banque et ses entraînements supprimés' };
}

// ========== ENTRAINEMENTS CONNAISSANCES ==========

/**
 * Récupère tous les entraînements connaissances
 */
function getEntrainementsConn() {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);

  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.ENTRAINEMENTS_CONN);
    sheet.appendRow(['id', 'banque_exercice_id', 'titre', 'description', 'duree', 'seuil', 'statut', 'ordre', 'date_creation']);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const entrainements = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(e => e.id);

  return { success: true, data: entrainements };
}

/**
 * Crée un entraînement connaissances
 */
function createEntrainementConn(data) {
  if (!data.banque_exercice_id || !data.titre) {
    return { success: false, error: 'banque_exercice_id et titre requis' };
  }

  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) {
    getEntrainementsConn();
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  }

  const id = 'etr_' + new Date().getTime();

  sheet.appendRow([
    id,
    data.banque_exercice_id,
    data.titre,
    data.description || '',
    data.duree || 15,
    data.seuil || 80,
    data.statut || 'brouillon',
    data.ordre || 1,
    new Date().toISOString().split('T')[0]
  ]);

  return { success: true, id: id, message: 'Entraînement créé' };
}

/**
 * Met à jour un entraînement connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.ENTRAINEMENTS_CONN, data, ['titre', 'description', 'duree', 'seuil', 'statut', 'ordre'], 'Entraînement');
}

/**
 * Supprime un entraînement connaissances.
 * Optimisé : cascade complète en 1 passe.
 */
function deleteEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var entrainementId = String(data.id).trim();

  // 1. Collecter les IDs d'étapes
  var etapeIds = collectColumnValues_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementId, 'id');

  // 2. Supprimer en cascade (du plus profond au plus haut)
  if (etapeIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeIds);
  }
  deleteRowsByColumnValue_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementId);
  deleteRowsByColumnValue_(ss, SHEETS.PROGRESSION_MEMORISATION, 'entrainement_id', entrainementId);

  // 3. Supprimer l'entraînement
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.ENTRAINEMENTS_CONN, 'id', entrainementId);
  if (deleted === 0) {
    return { success: false, error: 'Entraînement non trouvé' };
  }

  return { success: true, message: 'Entraînement supprimé' };
}

// ========== ETAPES CONNAISSANCES ==========

/**
 * Récupère toutes les étapes
 */
function getEtapesConn() {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);

  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.ETAPES_CONN);
    sheet.appendRow(['id', 'entrainement_id', 'format_code', 'ordre', 'mode_selection', 'nb_questions', 'banque_source_id']);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, data: [] };

  const headers = data[0].map(h => String(h).toLowerCase().trim());
  const etapes = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(e => e.id);

  return { success: true, data: etapes };
}

/**
 * Crée une étape
 */
function createEtapeConn(data) {
  if (!data.entrainement_id || !data.format_code) {
    return { success: false, error: 'entrainement_id et format_code requis' };
  }

  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) {
    getEtapesConn();
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  }

  const id = 'etp_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 5);

  sheet.appendRow([
    id,
    data.entrainement_id,
    data.format_code,
    data.ordre || 1,
    data.mode_selection || 'manuel',
    data.nb_questions || 5,
    data.banque_source_id || ''
  ]);

  return { success: true, id: id, message: 'Étape créée' };
}

/**
 * Met à jour une étape.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.ETAPES_CONN, data, ['format_code', 'titre', 'ordre', 'mode_selection', 'banque_source_id', 'nb_questions'], 'Étape');
}

/**
 * Supprime une étape.
 * Optimisé : 1 seule ouverture du tableur.
 */
function deleteEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var etapeId = String(data.id).trim();

  // CASCADE : supprimer les questions de l'étape
  deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeId);

  // Supprimer l'étape
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.ETAPES_CONN, 'id', etapeId);
  if (deleted === 0) {
    return { success: false, error: 'Étape non trouvée' };
  }

  return { success: true, message: 'Étape supprimée' };
}

/**
 * Met à jour l'ordre des étapes (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les étapes modifiées.
 */
function updateEtapesOrdre(data) {
  if (!data.etapes || !Array.isArray(data.etapes)) {
    return { success: false, error: 'etapes array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');
  if (idCol === -1 || ordreCol === -1) return { success: false, error: 'Colonnes id/ordre non trouvées' };

  // Construire un map id → nouvel ordre
  var ordreMap = {};
  data.etapes.forEach(function(e) {
    ordreMap[String(e.id).trim()] = e.ordre;
  });

  // Modifier les données en mémoire
  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  // Écrire toute la feuille en une seule opération
  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre mis à jour' };
}

/**
 * Supprime toutes les étapes d'un entraînement
 */
function deleteEtapesForEntrainement(entrainementId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');
  const entrainementIdCol = headers.indexOf('entrainement_id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][entrainementIdCol]).trim() === String(entrainementId).trim()) {
      deleteEtapeQuestionsForEtape(allData[i][idCol]);
      sheet.deleteRow(i + 1);
    }
  }
}

// ========== ETAPE QUESTIONS ==========

/**
 * Récupère les questions d'une étape
 */
function getEtapeQuestionsConn(data) {
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);

  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(SHEETS.ETAPE_QUESTIONS_CONN);
    sheet.appendRow(['id', 'etape_id', 'question_id', 'banque_question_id', 'ordre']);
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return { success: true, data: [] };

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  let questions = allData.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(q => q.id);

  // Filtrer par étape si spécifié
  if (data && data.etape_id) {
    questions = questions.filter(q => String(q.etape_id) === String(data.etape_id));
  }

  return { success: true, data: questions };
}

/**
 * Ajoute une question à une étape
 */
function createEtapeQuestionConn(data) {
  if (!data.etape_id || !data.question_id) {
    return { success: false, error: 'etape_id et question_id requis' };
  }

  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!sheet) {
    getEtapeQuestionsConn({});
    sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  }

  const id = 'eq_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 5);

  sheet.appendRow([
    id,
    data.etape_id,
    data.question_id,
    data.banque_question_id || '',
    data.ordre || 1
  ]);

  return { success: true, id: id, message: 'Question ajoutée à l\'étape' };
}

/**
 * Supprime une question d'une étape
 */
function deleteEtapeQuestionConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Question retirée de l\'étape' };
    }
  }

  return { success: false, error: 'Question non trouvée' };
}

/**
 * Remplace toutes les questions d'une étape
 */
function setEtapeQuestionsConn(data) {
  if (!data.etape_id || !data.questions) {
    return { success: false, error: 'etape_id et questions requis' };
  }

  // Verrou pour éviter les modifications concurrentes sur le sheet
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Attendre max 15 secondes
  } catch (e) {
    return { success: false, error: 'Opération en cours, veuillez réessayer' };
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Supprimer les questions existantes
    deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', String(data.etape_id).trim());

    // Parser les questions si c'est une string JSON (envoyé via URL)
    var questions = data.questions;
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        return { success: false, error: 'Format questions invalide: ' + e.message };
      }
    }

    // S'assurer que c'est un tableau
    if (!Array.isArray(questions)) {
      questions = [];
    }

    // Dédupliquer par question_id pour éviter les doublons
    var seen = {};
    questions = questions.filter(function(q) {
      if (!q.question_id || seen[q.question_id]) return false;
      seen[q.question_id] = true;
      return true;
    });

    // Ajouter les nouvelles questions
    questions.forEach(function(q, index) {
      createEtapeQuestionConn({
        etape_id: data.etape_id,
        question_id: q.question_id,
        banque_question_id: q.banque_question_id || '',
        ordre: index + 1
      });
    });

    return { success: true, message: questions.length + ' questions définies pour l\'étape' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Nettoie les données orphelines dans toutes les feuilles connaissances.
 * Supprime en cascade : entrainements sans banque, étapes sans entrainement,
 * liens étape-questions sans étape ou sans question valide.
 * Optimisé : 1 seule ouverture du tableur, chaque feuille lue 1 fois.
 */
function cleanupOrphanedData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cleaned = { entrainements: 0, etapes: 0, etapeQuestions: 0 };

  // 1. Collecter les IDs existants des banques
  var banqueIds = collectAllIds_(ss, SHEETS.BANQUES_EXERCICES_CONN);

  // 2. Identifier les entraînements orphelins (banque_exercice_id n'existe plus)
  var entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  var validEntrIds = new Set();
  var orphanEntrIds = [];
  if (entrSheet) {
    var eData = entrSheet.getDataRange().getValues();
    var eHeaders = eData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var eIdCol = eHeaders.indexOf('id');
    var eBanqueCol = eHeaders.indexOf('banque_exercice_id');
    var rowsToDelete = [];

    for (var i = 1; i < eData.length; i++) {
      var banqueId = String(eData[i][eBanqueCol]).trim();
      var entrId = String(eData[i][eIdCol]).trim();
      if (!banqueId || !banqueIds.has(banqueId)) {
        orphanEntrIds.push(entrId);
        rowsToDelete.push(i + 1);
      } else {
        validEntrIds.add(entrId);
      }
    }
    deleteRowNumbers_(entrSheet, rowsToDelete);
    cleaned.entrainements = rowsToDelete.length;
  }

  // 3. Nettoyer les étapes des entraînements orphelins + étapes dont entrainement_id n'existe plus
  var etapesSheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  var validEtapeIds = new Set();
  var orphanEtapeIds = [];
  if (etapesSheet) {
    var stData = etapesSheet.getDataRange().getValues();
    var stHeaders = stData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var stIdCol = stHeaders.indexOf('id');
    var stEntrCol = stHeaders.indexOf('entrainement_id');
    var stRowsToDelete = [];

    for (var j = 1; j < stData.length; j++) {
      var stEntrId = String(stData[j][stEntrCol]).trim();
      var stEtapeId = String(stData[j][stIdCol]).trim();
      if (!stEntrId || !validEntrIds.has(stEntrId)) {
        orphanEtapeIds.push(stEtapeId);
        stRowsToDelete.push(j + 1);
      } else {
        validEtapeIds.add(stEtapeId);
      }
    }
    deleteRowNumbers_(etapesSheet, stRowsToDelete);
    cleaned.etapes = stRowsToDelete.length;
  }

  // 4. Nettoyer ETAPE_QUESTIONS_CONN : liens vers étapes ou questions inexistantes
  var eqSheet = ss.getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (eqSheet) {
    var questionIds = collectAllIds_(ss, SHEETS.QUESTIONS_CONNAISSANCES);

    var eqData = eqSheet.getDataRange().getValues();
    var eqHeaders = eqData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var eqEtapeCol = eqHeaders.indexOf('etape_id');
    var eqQuestionCol = eqHeaders.indexOf('question_id');
    var eqRowsToDelete = [];

    for (var k = 1; k < eqData.length; k++) {
      var eqEtapeId = String(eqData[k][eqEtapeCol]).trim();
      var eqQuestionId = String(eqData[k][eqQuestionCol]).trim();
      if (!eqEtapeId || !validEtapeIds.has(eqEtapeId) || !eqQuestionId || !questionIds.has(eqQuestionId)) {
        eqRowsToDelete.push(k + 1);
      }
    }
    deleteRowNumbers_(eqSheet, eqRowsToDelete);
    cleaned.etapeQuestions = eqRowsToDelete.length;
  }

  return {
    success: true,
    message: 'Nettoyage terminé: ' + cleaned.entrainements + ' entraînements, ' + cleaned.etapes + ' étapes, ' + cleaned.etapeQuestions + ' liens question supprimés',
    cleaned: cleaned
  };
}

// ========================================
// MISE À JOUR D'ORDRE (drag & drop)
// ========================================

/**
 * Met à jour l'ordre des questions de connaissances (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les questions modifiées.
 */
function updateQuestionsConnaissancesOrdre(data) {
  var questions = data.questions;
  if (typeof questions === 'string') {
    try { questions = JSON.parse(questions); } catch (e) {
      return { success: false, error: 'Format questions invalide' };
    }
  }
  if (!questions || !Array.isArray(questions)) {
    return { success: false, error: 'questions array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  // Si la colonne ordre n'existe pas encore, l'ajouter
  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  questions.forEach(function(q) {
    ordreMap[String(q.id).trim()] = q.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des questions mis à jour' };
}

/**
 * Met à jour l'ordre des banques de questions (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les banques modifiées.
 */
function updateBanquesQuestionsOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_QUESTIONS);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  // Si la colonne ordre n'existe pas encore, l'ajouter
  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) {
    ordreMap[String(b.id).trim()] = b.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des banques mis à jour' };
}

/**
 * Met à jour l'ordre des banques d'exercices connaissances (pour drag & drop).
 */
function updateBanquesExercicesConnOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) {
    ordreMap[String(b.id).trim()] = b.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des banques exercices mis à jour' };
}

/**
 * Met à jour l'ordre des entraînements connaissances (pour drag & drop).
 */
function updateEntrainementsConnOrdre(data) {
  var entrainements = data.entrainements;
  if (typeof entrainements === 'string') {
    try { entrainements = JSON.parse(entrainements); } catch (e) {
      return { success: false, error: 'Format entrainements invalide' };
    }
  }
  if (!entrainements || !Array.isArray(entrainements)) {
    return { success: false, error: 'entrainements array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  entrainements.forEach(function(e) {
    ordreMap[String(e.id).trim()] = e.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des entrainements mis à jour' };
}

/**
 * Met à jour l'ordre des banques d'exercices SF (pour drag & drop).
 */
function updateBanquesExercicesOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) { allData[r].push(''); }
  }
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) { ordreMap[String(b.id).trim()] = b.ordre; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true };
}

/**
 * Met à jour le numéro des exercices SF (pour drag & drop).
 */
function updateExercicesOrdre(data) {
  var exercices = data.exercices;
  if (typeof exercices === 'string') {
    try { exercices = JSON.parse(exercices); } catch (e) {
      return { success: false, error: 'Format exercices invalide' };
    }
  }
  if (!exercices || !Array.isArray(exercices)) {
    return { success: false, error: 'exercices array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var numeroCol = headers.indexOf('numero');

  if (numeroCol === -1) return { success: false, error: 'Colonne numero non trouvée' };
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  exercices.forEach(function(e) { ordreMap[String(e.id).trim()] = e.numero; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][numeroCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true };
}
// ========================================

/**
 * Met à jour une ligne identifiée par data.id dans la feuille donnée.
 * Écrit toutes les colonnes modifiées en 1 seul setValues() au lieu de N setValue().
 * @param {string} sheetName
 * @param {Object} data — doit contenir .id + les champs à modifier
 * @param {string[]} allowedCols — liste des colonnes autorisées à modifier
 * @param {string} entityLabel — nom pour le message d'erreur ('Banque', 'Question', etc.)
 */
function updateRowById_(sheetName, data, allowedCols, entityLabel) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var targetId = String(data.id).trim();
  var rowIndex = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === targetId) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: entityLabel + ' non trouvé(e)' };
  }

  // Modifier les colonnes en mémoire
  var modified = false;
  for (var c = 0; c < allowedCols.length; c++) {
    var col = allowedCols[c];
    if (data[col] !== undefined) {
      var colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        allData[rowIndex][colIndex] = data[col];
        modified = true;
      }
    }
  }

  // Écrire la ligne entière en 1 appel
  if (modified) {
    sheet.getRange(rowIndex + 1, 1, 1, allData[rowIndex].length).setValues([allData[rowIndex]]);
  }

  return { success: true, message: entityLabel + ' mis(e) à jour' };
}

// ========================================
// HELPERS DE SUPPRESSION EN BATCH
// ========================================

/**
 * Supprime toutes les lignes d'une feuille où la colonne `colName` vaut `value`.
 * @param {Spreadsheet} ss — tableur déjà ouvert
 * @param {string} sheetName — nom de la feuille
 * @param {string} colName — nom de la colonne (en minuscule)
 * @param {string} value — valeur à matcher (déjà trimmée)
 * @returns {number} nombre de lignes supprimées
 */
function deleteRowsByColumnValue_(ss, sheetName, colName, value) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var col = headers.indexOf(colName);
  if (col === -1) return 0;

  var rowsToDelete = [];
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][col]).trim() === value) {
      rowsToDelete.push(i + 1);
    }
  }

  deleteRowNumbers_(sheet, rowsToDelete);
  return rowsToDelete.length;
}

/**
 * Supprime les lignes où la colonne `colName` est dans le Set de valeurs.
 * @param {Spreadsheet} ss
 * @param {string} sheetName
 * @param {string} colName
 * @param {string[]} values — tableau de valeurs à matcher
 * @returns {number} nombre de lignes supprimées
 */
function deleteRowsByColumnValueMulti_(ss, sheetName, colName, values) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var col = headers.indexOf(colName);
  if (col === -1) return 0;

  var valueSet = {};
  for (var v = 0; v < values.length; v++) {
    valueSet[String(values[v]).trim()] = true;
  }

  var rowsToDelete = [];
  for (var i = 1; i < allData.length; i++) {
    if (valueSet[String(allData[i][col]).trim()]) {
      rowsToDelete.push(i + 1);
    }
  }

  deleteRowNumbers_(sheet, rowsToDelete);
  return rowsToDelete.length;
}

/**
 * Collecte les valeurs de `returnCol` pour les lignes où `filterCol` === `filterValue`.
 * @returns {string[]}
 */
function collectColumnValues_(ss, sheetName, filterCol, filterValue, returnCol) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return [];

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var fCol = headers.indexOf(filterCol);
  var rCol = headers.indexOf(returnCol);
  if (fCol === -1 || rCol === -1) return [];

  var results = [];
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][fCol]).trim() === filterValue) {
      results.push(String(allData[i][rCol]).trim());
    }
  }
  return results;
}

/**
 * Comme collectColumnValues_ mais filtre par un ensemble de valeurs.
 * @returns {string[]}
 */
function collectColumnValuesMulti_(ss, sheetName, filterCol, filterValues, returnCol) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return [];

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var fCol = headers.indexOf(filterCol);
  var rCol = headers.indexOf(returnCol);
  if (fCol === -1 || rCol === -1) return [];

  var filterSet = {};
  for (var v = 0; v < filterValues.length; v++) {
    filterSet[String(filterValues[v]).trim()] = true;
  }

  var results = [];
  for (var i = 1; i < allData.length; i++) {
    if (filterSet[String(allData[i][fCol]).trim()]) {
      results.push(String(allData[i][rCol]).trim());
    }
  }
  return results;
}

/**
 * Collecte tous les IDs (colonne 'id') d'une feuille.
 * @returns {Set}
 */
function collectAllIds_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var ids = new Set();
  if (!sheet) return ids;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return ids;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) return ids;

  for (var i = 1; i < allData.length; i++) {
    var id = String(allData[i][idCol]).trim();
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Supprime les lignes par numéro (1-indexed). Les supprime en ordre inverse
 * pour éviter les décalages d'index.
 */
function deleteRowNumbers_(sheet, rowNumbers) {
  if (!rowNumbers.length) return;
  // Trier en ordre décroissant
  rowNumbers.sort(function(a, b) { return b - a; });
  for (var i = 0; i < rowNumbers.length; i++) {
    sheet.deleteRow(rowNumbers[i]);
  }
}

// ================================================================
// FILE: Entrainements.gs
// ================================================================

// ========================================
// FONCTIONS ENTRAINEMENTS
// ========================================

/**
 * Récupère la liste des entraînements
 * @param {Object} data - { niveau?, chapitre_id?, statut? }
 */
function getEntrainements(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENTS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const entrainements = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtrer si paramètres fournis
    if (data.niveau && item.niveau !== data.niveau) continue;
    if (data.chapitre_id && item.chapitre_id !== data.chapitre_id) continue;
    if (data.statut && item.statut !== data.statut) continue;

    if (item.id) {
      entrainements.push(item);
    }
  }

  return { success: true, data: entrainements };
}

/**
 * Récupère un entraînement avec ses questions
 * @param {Object} data - { id }
 */
function getEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Récupérer l'entraînement
  const entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS);
  const entrData = entrSheet.getDataRange().getValues();
  const entrHeaders = entrData[0].map(h => String(h).toLowerCase().trim());

  let entrainement = null;
  for (let i = 1; i < entrData.length; i++) {
    const row = entrData[i];
    const idCol = entrHeaders.indexOf('id');
    if (idCol >= 0 && String(row[idCol]).trim() === String(data.id).trim()) {
      entrainement = {};
      entrHeaders.forEach((header, index) => {
        entrainement[header] = row[index];
      });
      break;
    }
  }

  if (!entrainement) {
    return { success: false, error: 'Entraînement non trouvé: ' + data.id };
  }

  // 1b. Enrichir avec les infos du chapitre
  if (entrainement.chapitre_id) {
    const chapSheet = ss.getSheetByName(SHEETS.CHAPITRES);
    if (chapSheet) {
      const chapData = chapSheet.getDataRange().getValues();
      const chapHeaders = chapData[0].map(h => String(h).toLowerCase().trim());
      const chapIdCol = chapHeaders.indexOf('id');
      const chapNomCol = chapHeaders.indexOf('nom');
      const chapThemeCol = chapHeaders.indexOf('theme_id');

      for (let i = 1; i < chapData.length; i++) {
        if (String(chapData[i][chapIdCol]).trim() === String(entrainement.chapitre_id).trim()) {
          if (chapNomCol >= 0) entrainement.chapitre_nom = chapData[i][chapNomCol];

          // Récupérer le thème pour avoir la discipline
          if (chapThemeCol >= 0) {
            const themeId = chapData[i][chapThemeCol];
            const themeSheet = ss.getSheetByName(SHEETS.THEMES);
            if (themeSheet) {
              const themeData = themeSheet.getDataRange().getValues();
              const themeHeaders = themeData[0].map(h => String(h).toLowerCase().trim());
              const themeIdCol = themeHeaders.indexOf('id');
              const themeNomCol = themeHeaders.indexOf('nom');
              const disciplineCol = themeHeaders.indexOf('discipline_id');

              for (let j = 1; j < themeData.length; j++) {
                if (String(themeData[j][themeIdCol]).trim() === String(themeId).trim()) {
                  if (themeNomCol >= 0) entrainement.theme_nom = themeData[j][themeNomCol];
                  if (disciplineCol >= 0) entrainement.discipline = themeData[j][disciplineCol];
                  break;
                }
              }
            }
          }
          break;
        }
      }
    }
  }

  // 2. Récupérer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());

  const questionLinks = [];
  for (let i = 1; i < eqData.length; i++) {
    const row = eqData[i];
    const entrIdCol = eqHeaders.indexOf('entrainement_id');
    if (entrIdCol >= 0 && String(row[entrIdCol]).trim() === String(data.id).trim()) {
      const link = {};
      eqHeaders.forEach((header, index) => {
        link[header] = row[index];
      });
      questionLinks.push(link);
    }
  }

  // Trier par ordre
  questionLinks.sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

  // 3. Récupérer les questions (selon le type d'entraînement)
  const isConnaissances = entrainement.niveau === 'connaissances';

  // Pour connaissances, on utilise QUESTIONS_CONNAISSANCES sinon QUESTIONS
  const qSheetName = isConnaissances ? SHEETS.QUESTIONS_CONNAISSANCES : SHEETS.QUESTIONS;
  const qSheet = ss.getSheetByName(qSheetName);

  let questionsMap = {};
  if (qSheet) {
    const qData = qSheet.getDataRange().getValues();
    const qHeaders = qData[0].map(h => String(h).toLowerCase().trim());

    for (let i = 1; i < qData.length; i++) {
      const row = qData[i];
      const idCol = qHeaders.indexOf('id');
      if (idCol >= 0 && row[idCol]) {
        const question = {};
        qHeaders.forEach((header, index) => {
          question[header] = row[index];
        });
        questionsMap[String(row[idCol]).trim()] = question;
      }
    }
  }

  // 4. Récupérer les formats (seulement pour entraînements non-connaissances)
  let formatsMap = {};
  if (!isConnaissances) {
    const fSheet = ss.getSheetByName(SHEETS.FORMATS);
    if (fSheet) {
      const fData = fSheet.getDataRange().getValues();
      const fHeaders = fData[0].map(h => String(h).toLowerCase().trim());

      for (let i = 1; i < fData.length; i++) {
        const row = fData[i];
        const idCol = fHeaders.indexOf('id');
        if (idCol >= 0 && row[idCol]) {
          const format = {};
          fHeaders.forEach((header, index) => {
            format[header] = row[index];
          });
          formatsMap[String(row[idCol]).trim()] = format;
        }
      }
    }
  }

  // 5. Assembler les questions
  const questions = questionLinks.map(link => {
    const questionId = String(link.question_id || '').trim();
    let question = {};
    let donnees = {};
    let format = {};

    if (isConnaissances) {
      // Pour les entraînements de connaissances
      if (questionId && questionsMap[questionId]) {
        question = questionsMap[questionId];

        // Parser le JSON des données
        if (question.donnees) {
          try {
            donnees = JSON.parse(question.donnees);
          } catch (e) {
            donnees = {};
          }
        }
      } else {
        // Sélection aléatoire si question_id est vide
        const banqueId = link.banque_id;
        const questionType = link.question_type;

        // Trouver les questions de cette banque et type
        const candidates = Object.values(questionsMap).filter(q =>
          String(q.banque_id || '').trim() === String(banqueId).trim() &&
          String(q.type || '').trim() === String(questionType).trim()
        );

        if (candidates.length > 0) {
          question = candidates[Math.floor(Math.random() * candidates.length)];
          if (question.donnees) {
            try {
              donnees = JSON.parse(question.donnees);
            } catch (e) {
              donnees = {};
            }
          }
        }
      }

      // Pour connaissances, le type est dans le champ 'type' de la question
      format = { type_base: question.type || link.question_type || 'qcm' };

    } else {
      // Pour les autres types d'entraînements
      question = questionsMap[questionId] || {};
      format = formatsMap[String(question.format_id).trim()] || {};

      // Parser le JSON des données
      if (question.donnees) {
        try {
          donnees = JSON.parse(question.donnees);
        } catch (e) {
          donnees = {};
        }
      }
    }

    return {
      ...question,
      donnees: donnees,
      format: format,
      ordre: link.ordre,
      points: link.points || 1
    };
  });

  entrainement.questions = questions;

  return { success: true, data: entrainement };
}

/**
 * Crée un nouvel entraînement
 * @param {Object} data - { titre, niveau, chapitre_id, description, duree_estimee, statut, ordre }
 */
function createEntrainement(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);

  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  const id = 'entr_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'statut') return data.statut || 'brouillon';
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Entraînement créé' };
}

/**
 * Met à jour un entraînement
 * @param {Object} data - { id, ...fields }
 */
function updateEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Entraînement non trouvé' };
  }

  const updates = ['titre', 'niveau', 'chapitre_id', 'description', 'duree_estimee', 'statut', 'ordre'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return { success: true, message: 'Entraînement mis à jour' };
}

/**
 * Supprime un entraînement
 * @param {Object} data - { id }
 */
function deleteEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
  const eqIdCol = eqHeaders.indexOf('entrainement_id');

  for (let i = eqData.length - 1; i >= 1; i--) {
    if (String(eqData[i][eqIdCol]).trim() === String(data.id).trim()) {
      eqSheet.deleteRow(i + 1);
    }
  }

  // Supprimer l'entraînement
  const sheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Entraînement supprimé' };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Crée un lien entre un entraînement et une question
 * @param {Object} data - { entrainement_id, question_id, format_id, ordre, etape }
 */
function createEntrainementQuestion(data) {
  if (!data.entrainement_id) {
    return { success: false, error: 'entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const id = 'eq_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
  const ordre = data.ordre || 1;
  const etape = data.etape || 1;

  // Colonnes : id | entrainement_id | question_id | format_id | ordre | banque_id | question_type | etape
  sheet.appendRow([
    id,
    data.entrainement_id,
    data.question_id || '',
    data.format_id || '',
    ordre,
    data.banque_id || '',
    data.question_type || '',
    etape
  ]);

  return {
    success: true,
    id: id,
    message: 'Lien entraînement-question créé'
  };
}

/**
 * Supprime tous les liens pour un entraînement
 * @param {Object} data - { entrainement_id }
 */
function deleteEntrainementQuestions(data) {
  if (!data.entrainement_id) {
    return { success: false, error: 'entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const entrIdCol = headers.indexOf('entrainement_id');

  let deletedCount = 0;
  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][entrIdCol]).trim() === String(data.entrainement_id).trim()) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return {
    success: true,
    message: deletedCount + ' liens supprimés'
  };
}

/**
 * Supprime un lien entraînement-question par son ID
 * @param {Object} data - { id }
 */
function deleteEntrainementQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Lien supprimé' };
    }
  }

  return { success: false, error: 'Lien non trouvé' };
}

// ========================================
// FONCTIONS QUESTIONS
// ========================================

/**
 * Récupère les questions (avec filtres optionnels)
 * @param {Object} data - { format_id?, discipline_id?, theme_id?, chapitre_id?, difficulte? }
 */
function getQuestions(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Récupérer les formats pour enrichir
  const fSheet = ss.getSheetByName(SHEETS.FORMATS);
  const fData = fSheet.getDataRange().getValues();
  const fHeaders = fData[0].map(h => String(h).toLowerCase().trim());
  const formatsMap = {};
  for (let i = 1; i < fData.length; i++) {
    const row = fData[i];
    const idCol = fHeaders.indexOf('id');
    if (idCol >= 0 && row[idCol]) {
      const format = {};
      fHeaders.forEach((header, index) => {
        format[header] = row[index];
      });
      formatsMap[String(row[idCol]).trim()] = format;
    }
  }

  const questions = [];
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtrer
    if (data.format_id && item.format_id !== data.format_id) continue;
    if (data.discipline_id && item.discipline_id !== data.discipline_id) continue;
    if (data.theme_id && item.theme_id !== data.theme_id) continue;
    if (data.chapitre_id && item.chapitre_id !== data.chapitre_id) continue;
    if (data.difficulte && item.difficulte !== data.difficulte) continue;

    if (item.id) {
      // Parser le JSON des données
      if (item.donnees) {
        try {
          item.donnees = JSON.parse(item.donnees);
        } catch (e) {
          item.donnees = {};
        }
      }
      item.format = formatsMap[String(item.format_id).trim()] || {};
      questions.push(item);
    }
  }

  return { success: true, data: questions };
}

/**
 * Crée un nouvel élément (structure atomique)
 * @param {Object} data - { type, chapitre_id, contenu, donnees, tags, explication, difficulte }
 * Types: qcm, evenement, paire, point_carte, item_categorie, reponse_libre
 */
function createQuestion(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS);

  if (!data.type || !data.contenu) {
    return { success: false, error: 'type et contenu requis' };
  }

  const id = 'elem_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'donnees') {
      if (typeof data.donnees === 'object') return JSON.stringify(data.donnees);
      return data.donnees || '';
    }
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Element cree' };
}

/**
 * Met à jour un élément (structure atomique)
 * @param {Object} data - { id, type?, chapitre_id?, contenu?, donnees?, tags?, explication?, difficulte? }
 */
function updateQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Element non trouve' };
  }

  // Champs de la nouvelle structure atomique
  const updates = ['type', 'chapitre_id', 'contenu', 'donnees', 'tags', 'explication', 'difficulte'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        let value = data[col];
        if (col === 'donnees' && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        sheet.getRange(rowIndex, colIndex + 1).setValue(value);
      }
    }
  });

  return { success: true, message: 'Element mis a jour' };
}

/**
 * Supprime une question
 * @param {Object} data - { id }
 */
function deleteQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
  const qIdCol = eqHeaders.indexOf('question_id');

  for (let i = eqData.length - 1; i >= 1; i--) {
    if (String(eqData[i][qIdCol]).trim() === String(data.id).trim()) {
      eqSheet.deleteRow(i + 1);
    }
  }

  // Supprimer la question
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Question supprimée' };
    }
  }

  return { success: false, error: 'Question non trouvée' };
}

// ========================================
// SYSTÈME DE MÉMORISATION (Répétition espacée)
// ========================================

/**
 * Système de répétition espacée - 7 étapes
 *
 * PRÉ-ÉVALUATION (~2 semaines):
 * - Étape 1: Jour 0 (premier succès ≥80%)
 * - Étape 2: +1 jour (verrouillé jusque-là)
 * - Étape 3: +3 jours
 * - Étape 4: +7 jours
 * - Étape 5: +14 jours → "Prêt pour l'évaluation"
 *
 * POST-ÉVALUATION:
 * - Étape 6: +7 jours après étape 5
 * - Étape 7: +14 jours → "Mémorisé définitivement"
 */
const INTERVALLES_MEMORISATION = [0, 1, 3, 7, 14, 7, 14];
const SEUIL_REUSSITE = 80; // 80% pour toutes les étapes
const ETAPE_MAX = 7;
const ETAPE_PRET_EVALUATION = 5; // À partir de cette étape = prêt pour évaluation

/**
 * Récupère la progression de mémorisation d'un élève
 * @param {Object} data - { eleve_id, entrainement_id?, banque_id? }
 * Colonnes GSheet: id, eleve_id, entrainement_id, banque_id, etape, statut, prochaine_revision, historique, date_creation, date_modification
 */
function getProgressionMemorisation(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.PROGRESSION_MEMORISATION);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_MEMORISATION);
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'banque_id', 'etape', 'statut',
      'prochaine_revision', 'historique', 'date_creation', 'date_modification'
    ]);
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const progressions = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      let value = row[index];
      // Parser l'historique JSON
      if (header === 'historique' && value) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = [];
        }
      }
      item[header] = value;
    });

    // Filtres
    if (String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.entrainement_id && String(item.entrainement_id).trim() !== String(data.entrainement_id).trim()) continue;
    if (data.banque_id && String(item.banque_id).trim() !== String(data.banque_id).trim()) continue;

    // Calculer si révision est due
    if (item.prochaine_revision && item.statut === 'en_cours') {
      const now = new Date();
      const revisionDate = new Date(item.prochaine_revision);
      item.revision_due = now >= revisionDate;
      item.jours_restants = Math.ceil((revisionDate - now) / (1000 * 60 * 60 * 24));
    }

    progressions.push(item);
  }

  return { success: true, data: progressions };
}

/**
 * Récupère le seuil de réussite d'un entraînement
 */
function getSeuilEntrainement(entrainementId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return SEUIL_REUSSITE; // Fallback au seuil par défaut

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');
  const seuilCol = headers.indexOf('seuil');

  if (seuilCol < 0) return SEUIL_REUSSITE;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(entrainementId).trim()) {
      const seuil = parseInt(allData[i][seuilCol]);
      return isNaN(seuil) ? SEUIL_REUSSITE : seuil;
    }
  }

  return SEUIL_REUSSITE;
}

/**
 * Sauvegarde une tentative et met à jour la progression de mémorisation
 * @param {Object} data - { eleve_id, entrainement_id, banque_id, score, score_max }
 */
function saveProgressionMemorisation(data) {
  if (!data.eleve_id || !data.entrainement_id) {
    return { success: false, error: 'eleve_id et entrainement_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.PROGRESSION_MEMORISATION);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_MEMORISATION);
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'banque_id', 'etape', 'statut',
      'prochaine_revision', 'historique', 'date_creation', 'date_modification'
    ]);
  }

  // Récupérer le seuil de réussite défini pour cet entraînement
  const seuilReussite = getSeuilEntrainement(data.entrainement_id);

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Chercher une progression existante
  const eleveIdCol = headers.indexOf('eleve_id');
  const entrIdCol = headers.indexOf('entrainement_id');
  let existingRow = -1;
  let existingData = null;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][entrIdCol]).trim() === String(data.entrainement_id).trim()) {
      existingRow = i + 1;
      existingData = {};
      headers.forEach((header, index) => {
        existingData[header] = allData[i][index];
      });
      break;
    }
  }

  // Calculer le pourcentage
  const scoreMax = data.score_max || 1;
  const score = data.score || 0;
  const pourcentage = Math.round((score / scoreMax) * 100);
  const now = new Date();
  const nowISO = now.toISOString();
  const todayISO = nowISO.split('T')[0];

  // Nouvelle tentative à ajouter à l'historique
  const nouvelleTentative = {
    date: nowISO,
    score: score,
    score_max: scoreMax,
    pourcentage: pourcentage
  };

  if (existingRow > 0) {
    // Progression existante - mettre à jour
    let historique = [];
    try {
      historique = JSON.parse(existingData.historique || '[]');
    } catch (e) {
      historique = [];
    }
    historique.push(nouvelleTentative);

    let etape = parseInt(existingData.etape) || 1;
    let statut = existingData.statut || 'en_cours';
    let prochaineRevision = existingData.prochaine_revision;

    // Vérifier si c'est le bon moment pour réviser (pas trop tôt)
    const peutReviser = !prochaineRevision || new Date(prochaineRevision) <= now;

    if (peutReviser) {
      // Utiliser le seuil défini pour cet entraînement
      const reussi = pourcentage >= seuilReussite;

      if (reussi) {
        // Avancer d'une étape
        etape = Math.min(etape + 1, ETAPE_MAX);
        if (etape >= ETAPE_MAX) {
          statut = 'memorise';
          prochaineRevision = null;
        } else {
          statut = 'en_cours';
          // Calculer la prochaine date de révision
          const intervalleJours = INTERVALLES_MEMORISATION[etape - 1] || 14;
          const prochaineDate = new Date(now);
          prochaineDate.setDate(prochaineDate.getDate() + intervalleJours);
          prochaineRevision = prochaineDate.toISOString().split('T')[0];
        }
      } else {
        // Reculer d'une étape (minimum 1)
        etape = Math.max(etape - 1, 1);
        statut = 'en_cours';
        // Peut réessayer immédiatement si échec
        prochaineRevision = todayISO;
      }
    }

    // Mettre à jour la ligne
    const updates = {
      'etape': etape,
      'statut': statut,
      'prochaine_revision': prochaineRevision || '',
      'historique': JSON.stringify(historique),
      'date_modification': nowISO
    };

    Object.keys(updates).forEach(col => {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(existingRow, colIndex + 1).setValue(updates[col]);
      }
    });

    return {
      success: true,
      message: 'Progression mise à jour',
      etape: etape,
      etape_max: ETAPE_MAX,
      statut: statut,
      pret_evaluation: etape >= ETAPE_PRET_EVALUATION,
      prochaine_revision: prochaineRevision,
      pourcentage: pourcentage,
      reussi: peutReviser ? (pourcentage >= seuilReussite) : null,
      seuil: seuilReussite
    };

  } else {
    // Nouvelle progression
    const id = 'prog_mem_' + now.getTime();
    const etape = 1;
    const statut = 'en_cours';
    // Première tentative réussie = prochaine révision dans 1 jour
    // Première tentative échouée = peut réessayer immédiatement
    const reussi = pourcentage >= seuilReussite;

    let prochaineRevision;
    let nouvelleEtape = 1;
    if (reussi) {
      nouvelleEtape = 2;
      const prochaineDate = new Date(now);
      prochaineDate.setDate(prochaineDate.getDate() + INTERVALLES_MEMORISATION[1]); // 1 jour
      prochaineRevision = prochaineDate.toISOString().split('T')[0];
    } else {
      prochaineRevision = todayISO; // Peut réessayer immédiatement
    }

    const historique = [nouvelleTentative];

    const newRow = headers.map(header => {
      if (header === 'id') return id;
      if (header === 'eleve_id') return data.eleve_id;
      if (header === 'entrainement_id') return data.entrainement_id;
      if (header === 'banque_id') return data.banque_id || '';
      if (header === 'etape') return nouvelleEtape;
      if (header === 'statut') return 'en_cours';
      if (header === 'prochaine_revision') return prochaineRevision;
      if (header === 'historique') return JSON.stringify(historique);
      if (header === 'date_creation') return nowISO;
      if (header === 'date_modification') return nowISO;
      return '';
    });

    sheet.appendRow(newRow);

    return {
      success: true,
      id: id,
      message: 'Progression créée',
      etape: nouvelleEtape,
      etape_max: ETAPE_MAX,
      statut: 'en_cours',
      pret_evaluation: nouvelleEtape >= ETAPE_PRET_EVALUATION,
      prochaine_revision: prochaineRevision,
      pourcentage: pourcentage,
      reussi: reussi,
      seuil: seuilReussite
    };
  }
}

// ================================================================
// FILE: Evaluations.gs
// ================================================================

// ========================================
// FONCTIONS EVALUATIONS
// ========================================

/**
 * Recupere la liste des evaluations (avec filtres optionnels)
 * @param {Object} data - { type?, chapitre_id?, statut? }
 */
function getEvaluations(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const evaluations = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtres
    if (data.type && item.type !== data.type) continue;
    if (data.chapitre_id && item.chapitre_id !== data.chapitre_id) continue;
    if (data.statut && item.statut !== data.statut) continue;

    if (item.id) {
      evaluations.push(item);
    }
  }

  return { success: true, data: evaluations };
}

/**
 * Recupere une evaluation avec ses questions
 * @param {Object} data - { id }
 */
function getEvaluation(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Recuperer l'evaluation
  const evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  const evalData = evalSheet.getDataRange().getValues();
  const evalHeaders = evalData[0].map(h => String(h).toLowerCase().trim());

  let evaluation = null;
  for (let i = 1; i < evalData.length; i++) {
    const row = evalData[i];
    const idCol = evalHeaders.indexOf('id');
    if (idCol >= 0 && String(row[idCol]).trim() === String(data.id).trim()) {
      evaluation = {};
      evalHeaders.forEach((header, index) => {
        evaluation[header] = row[index];
      });
      break;
    }
  }

  if (!evaluation) {
    return { success: false, error: 'Evaluation non trouvee: ' + data.id };
  }

  // 2. Recuperer les liens evaluation_questions
  const eqSheet = ss.getSheetByName(SHEETS.EVALUATION_QUESTIONS);
  const questionLinks = [];

  if (eqSheet) {
    const eqData = eqSheet.getDataRange().getValues();
    const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());

    for (let i = 1; i < eqData.length; i++) {
      const row = eqData[i];
      const evalIdCol = eqHeaders.indexOf('evaluation_id');
      if (evalIdCol >= 0 && String(row[evalIdCol]).trim() === String(data.id).trim()) {
        const link = {};
        eqHeaders.forEach((header, index) => {
          link[header] = row[index];
        });
        questionLinks.push(link);
      }
    }
  }

  // Trier par ordre
  questionLinks.sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

  // 3. Recuperer les questions
  const qSheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const qData = qSheet.getDataRange().getValues();
  const qHeaders = qData[0].map(h => String(h).toLowerCase().trim());

  const questionsMap = {};
  for (let i = 1; i < qData.length; i++) {
    const row = qData[i];
    const idCol = qHeaders.indexOf('id');
    if (idCol >= 0 && row[idCol]) {
      const question = {};
      qHeaders.forEach((header, index) => {
        question[header] = row[index];
      });
      questionsMap[String(row[idCol]).trim()] = question;
    }
  }

  // 4. Recuperer les formats
  const fSheet = ss.getSheetByName(SHEETS.FORMATS);
  const fData = fSheet.getDataRange().getValues();
  const fHeaders = fData[0].map(h => String(h).toLowerCase().trim());

  const formatsMap = {};
  for (let i = 1; i < fData.length; i++) {
    const row = fData[i];
    const idCol = fHeaders.indexOf('id');
    if (idCol >= 0 && row[idCol]) {
      const format = {};
      fHeaders.forEach((header, index) => {
        format[header] = row[index];
      });
      formatsMap[String(row[idCol]).trim()] = format;
    }
  }

  // 5. Assembler les questions avec leurs formats
  const questions = questionLinks.map(link => {
    const question = questionsMap[String(link.question_id).trim()] || {};
    const format = formatsMap[String(question.format_id).trim()] || {};

    // Parser le JSON des donnees
    let donnees = {};
    if (question.donnees) {
      try {
        donnees = JSON.parse(question.donnees);
      } catch (e) {
        donnees = {};
      }
    }

    return {
      ...question,
      donnees: donnees,
      format: format,
      ordre: link.ordre,
      points: link.points
    };
  });

  // Recuperer le nom du chapitre
  const chapSheet = ss.getSheetByName(SHEETS.CHAPITRES);
  if (chapSheet && evaluation.chapitre_id) {
    const chapData = chapSheet.getDataRange().getValues();
    const chapHeaders = chapData[0].map(h => String(h).toLowerCase().trim());
    for (let i = 1; i < chapData.length; i++) {
      const idCol = chapHeaders.indexOf('id');
      if (idCol >= 0 && String(chapData[i][idCol]).trim() === String(evaluation.chapitre_id).trim()) {
        const nomCol = chapHeaders.indexOf('nom');
        if (nomCol >= 0) {
          evaluation.chapitre_nom = chapData[i][nomCol];
        }
        break;
      }
    }
  }

  evaluation.questions = questions;

  return { success: true, data: evaluation };
}

/**
 * Recupere une evaluation avec les questions personnalisees pour un eleve
 * Utilise l'attribution de sujet si elle existe, sinon calcule automatiquement
 * la prochaine banque non validee selon la progression
 * @param {Object} data - { id, eleve_id }
 */
function getEvaluationForEleve(data) {
  if (!data.id || !data.eleve_id) {
    return { success: false, error: 'id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Recuperer l'evaluation
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var evaluation = null;
  for (var i = 1; i < evalData.length; i++) {
    var row = evalData[i];
    var idCol = evalHeaders.indexOf('id');
    if (idCol >= 0 && String(row[idCol]).trim() === String(data.id).trim()) {
      evaluation = {};
      evalHeaders.forEach(function(header, index) {
        evaluation[header] = row[index];
      });
      break;
    }
  }

  if (!evaluation) {
    return { success: false, error: 'Evaluation non trouvee: ' + data.id };
  }

  // Vérifier que l'évaluation est accessible (pas brouillon, pas planifiée)
  var effectiveStatut = _computeEffectiveStatut_(evaluation);
  if (effectiveStatut === 'brouillon') {
    return { success: false, error: 'Cette évaluation n\'est pas encore disponible' };
  }
  if (effectiveStatut === 'planifiee') {
    return { success: false, error: 'Cette évaluation n\'est pas encore ouverte' };
  }
  if (effectiveStatut === 'terminee') {
    return { success: false, error: 'Cette évaluation est terminée' };
  }

  var type = String(evaluation.type).trim();
  var matiere = String(evaluation.matiere || '').trim();

  // 2. Si pas connaissances/SF, fallback sur getEvaluation classique
  if (type !== 'connaissances' && type !== 'savoir-faire') {
    return getEvaluation(data);
  }

  // 3. Determiner la banque : attribution manuelle ou auto-calcul
  var banqueId = '';
  var entrainementId = '';
  var source = 'auto';

  // 3a. Chercher une attribution existante
  var attrSheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (attrSheet) {
    var attrData = attrSheet.getDataRange().getValues();
    if (attrData.length >= 2) {
      var attrHeaders = attrData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var j = 1; j < attrData.length; j++) {
        var attr = {};
        attrHeaders.forEach(function(header, index) {
          attr[header] = attrData[j][index];
        });
        if (String(attr.evaluation_id).trim() === String(data.id).trim() &&
            String(attr.eleve_id).trim() === String(data.eleve_id).trim()) {
          banqueId = String(attr.banque_id || '').trim();
          entrainementId = String(attr.entrainement_id || '').trim();
          source = String(attr.source || 'auto').trim();
          break;
        }
      }
    }
  }

  // 3b. Si pas d'attribution, calculer automatiquement la prochaine banque
  //     et la sauvegarder dans ATTRIBUTION_SUJETS pour verrouiller le sujet
  if (!banqueId) {
    banqueId = computeNextBanque_(ss, type, matiere, String(data.eleve_id).trim());
    if (banqueId) {
      source = 'auto';
      // Sauvegarder l'attribution pour que le prochain appel retombe sur la même banque
      saveAutoAttribution_(ss, String(data.id).trim(), String(data.eleve_id).trim(), banqueId, '', source);
    }
  }

  if (!banqueId) {
    return { success: false, error: 'Aucune banque disponible pour cette matière' };
  }

  // 4. Charger les questions selon le type
  var result;
  if (type === 'connaissances') {
    result = loadConnQuestionsForEval_(ss, banqueId, entrainementId);
  } else {
    result = loadSFQuestionsForEval_(ss, banqueId);
  }

  evaluation.duree = result.duree || evaluation.duree || 15;

  // Retourner l'ID de l'exercice effectivement choisi (peut différer si aléatoire)
  var actualEntrainementId = entrainementId;
  if (type === 'connaissances' && result.entrainement && result.entrainement.id) {
    actualEntrainementId = String(result.entrainement.id).trim();
  } else if (type === 'savoir-faire' && result.questions && result.questions.length > 0) {
    actualEntrainementId = String(result.questions[0].id || '').trim();
  }

  // Mettre à jour l'entrainement_id dans l'attribution si auto (tirage aléatoire)
  if (source === 'auto' && actualEntrainementId && actualEntrainementId !== entrainementId) {
    updateAttributionEntrainement_(ss, String(data.id).trim(), String(data.eleve_id).trim(), actualEntrainementId);
  }

  // 5. Recuperer le titre de la banque pour le message conseil
  var banqueTitre = '';
  var banqueSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banqueSheet = ss.getSheetByName(banqueSheetName);
  if (banqueSheet) {
    var bData = banqueSheet.getDataRange().getValues();
    if (bData.length >= 2) {
      var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var bIdCol = bHeaders.indexOf('id');
      var bTitreCol = bHeaders.indexOf('titre');
      if (bIdCol >= 0 && bTitreCol >= 0) {
        for (var k = 1; k < bData.length; k++) {
          if (String(bData[k][bIdCol]).trim() === String(banqueId).trim()) {
            banqueTitre = String(bData[k][bTitreCol]).trim();
            break;
          }
        }
      }
    }
  }

  evaluation.attribution = {
    banque_id: banqueId,
    entrainement_id: actualEntrainementId,
    source: source,
    banque_titre: banqueTitre
  };

  // Pour connaissances : retourner les donnees structurees par etape
  // (meme format que le module d'entrainement)
  if (type === 'connaissances') {
    evaluation.etapes = result.etapes || [];
    evaluation.etapeQuestions = result.etapeQuestions || [];
    evaluation.questionsConnaissances = result.questions || [];
    evaluation.entrainementData = result.entrainement || {};
  } else {
    // SF : garder le format plat
    evaluation.questions = result.questions || [];
  }

  return { success: true, data: evaluation };
}

/**
 * Calcule la prochaine banque non validee pour un eleve
 * Lit la progression, trouve la derniere banque validee, retourne la suivante
 * @param {Spreadsheet} ss
 * @param {string} type - 'connaissances' ou 'savoir-faire'
 * @param {string} matiere - 'FR' ou 'HG-EMC'
 * @param {string} eleveId
 * @returns {string} banqueId ou '' si aucune trouvee
 */
function computeNextBanque_(ss, type, matiere, eleveId) {
  // 1. Charger les banques de ce type et matiere, triees par ordre
  var isConn = type === 'connaissances';
  var sheetName = isConn ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banqueSheet = ss.getSheetByName(sheetName);
  if (!banqueSheet) return '';

  var bData = banqueSheet.getDataRange().getValues();
  if (bData.length < 2) return '';
  var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var banques = [];
  for (var i = 1; i < bData.length; i++) {
    var b = {};
    bHeaders.forEach(function(h, idx) { b[h] = bData[i][idx]; });
    if (!b.id) continue;
    // Filtrer par matiere si renseignee
    // "Les deux" accepte toutes les banques (FR et HG-EMC)
    if (matiere && matiere !== 'Les deux' && b.matiere && String(b.matiere).trim() !== matiere) continue;
    // Pour SF, filtrer par type
    if (!isConn && String(b.type || '').trim() !== 'savoir-faire') continue;
    banques.push(b);
  }

  banques.sort(function(a, b) { return (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999); });
  if (banques.length === 0) return '';

  // 2. Chercher la progression de cet eleve
  var progSheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  var lastValidatedId = '';

  if (progSheet) {
    var pData = progSheet.getDataRange().getValues();
    if (pData.length >= 2) {
      var pHeaders = pData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var pi = 1; pi < pData.length; pi++) {
        var p = {};
        pHeaders.forEach(function(h, idx) { p[h] = pData[pi][idx]; });
        if (String(p.eleve_id).trim() === eleveId &&
            String(p.type).trim() === type &&
            (!p.matiere || matiere === 'Les deux' || String(p.matiere).trim() === matiere)) {
          lastValidatedId = String(p.derniere_banque_validee_id || '').trim();
          break;
        }
      }
    }
  }

  // 3. Trouver la prochaine banque
  if (!lastValidatedId) {
    return String(banques[0].id).trim();
  }

  var lastIdx = -1;
  for (var bi = 0; bi < banques.length; bi++) {
    if (String(banques[bi].id).trim() === lastValidatedId) {
      lastIdx = bi;
      break;
    }
  }

  if (lastIdx >= 0 && lastIdx < banques.length - 1) {
    return String(banques[lastIdx + 1].id).trim();
  }

  // Toutes les banques validees → rester sur la derniere
  return String(banques[banques.length - 1].id).trim();
}

/**
 * Sauvegarde une attribution automatique dans ATTRIBUTION_SUJETS
 * pour verrouiller le sujet lors des prochains appels.
 * @param {Spreadsheet} ss
 * @param {string} evaluationId
 * @param {string} eleveId
 * @param {string} banqueId
 * @param {string} entrainementId
 * @param {string} source
 */
function saveAutoAttribution_(ss, evaluationId, eleveId, banqueId, entrainementId, source) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
      sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
    }
    var id = 'attr_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 4);
    sheet.appendRow([id, evaluationId, eleveId, banqueId, entrainementId || '', source || 'auto']);
  } catch (e) {
    // Silencieux : ne pas bloquer l'évaluation si la sauvegarde échoue
    Logger.log('saveAutoAttribution_ erreur: ' + e.message);
  }
}

/**
 * Met à jour l'entrainement_id dans ATTRIBUTION_SUJETS (après tirage aléatoire)
 */
function updateAttributionEntrainement_(ss, evaluationId, eleveId, entrainementId) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) return;
    var allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return;
    var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evalCol = headers.indexOf('evaluation_id');
    var eleveCol = headers.indexOf('eleve_id');
    var entCol = headers.indexOf('entrainement_id');
    if (evalCol < 0 || eleveCol < 0 || entCol < 0) return;
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][evalCol]).trim() === evaluationId &&
          String(allData[i][eleveCol]).trim() === eleveId) {
        sheet.getRange(i + 1, entCol + 1).setValue(entrainementId);
        break;
      }
    }
  } catch (e) {
    Logger.log('updateAttributionEntrainement_ erreur: ' + e.message);
  }
}

/**
 * Synchronise ATTRIBUTION_SUJETS avec la banque/exercice réellement passés par l'élève.
 * Met à jour la ligne existante ou en crée une nouvelle.
 */
function syncAttributionFromResult_(ss, evaluationId, eleveId, banqueId, entrainementId) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
      sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
    }
    var allData = sheet.getDataRange().getValues();
    var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evalCol = headers.indexOf('evaluation_id');
    var eleveCol = headers.indexOf('eleve_id');
    var banqueCol = headers.indexOf('banque_id');
    var entCol = headers.indexOf('entrainement_id');
    if (evalCol < 0 || eleveCol < 0) return;

    // Chercher une ligne existante
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][evalCol]).trim() === String(evaluationId).trim() &&
          String(allData[i][eleveCol]).trim() === String(eleveId).trim()) {
        // Mettre à jour banque + exercice
        if (banqueCol >= 0) sheet.getRange(i + 1, banqueCol + 1).setValue(banqueId);
        if (entCol >= 0) sheet.getRange(i + 1, entCol + 1).setValue(entrainementId);
        return;
      }
    }

    // Pas de ligne existante → en créer une
    var id = 'attr_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 4);
    sheet.appendRow([id, evaluationId, eleveId, banqueId, entrainementId || '', 'auto']);
  } catch (e) {
    Logger.log('syncAttributionFromResult_ erreur: ' + e.message);
  }
}

/**
 * Charge les donnees d'un entrainement connaissances pour une evaluation.
 * Retourne les etapes, liens etape-questions et questions dans le meme format
 * que le module d'entrainement (EleveConnaissances) pour reutiliser le moteur de rendu.
 * @param {Spreadsheet} ss
 * @param {string} banqueId
 * @param {string} entrainementId - si vide, prend un entrainement aleatoire de la banque
 * @returns {{ etapes: Array, etapeQuestions: Array, questions: Array, duree: number, entrainement: Object }}
 */
function loadConnQuestionsForEval_(ss, banqueId, entrainementId) {
  var empty = { etapes: [], etapeQuestions: [], questions: [], duree: 15, entrainement: {} };

  // 1. Trouver l'entrainement
  var entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!entrSheet) return empty;

  var entrData = entrSheet.getDataRange().getValues();
  if (entrData.length < 2) return empty;
  var entrHeaders = entrData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var banqueEntrs = [];
  for (var i = 1; i < entrData.length; i++) {
    var e = {};
    entrHeaders.forEach(function(h, idx) { e[h] = entrData[i][idx]; });
    if (String(e.banque_exercice_id).trim() === banqueId && e.id) {
      banqueEntrs.push(e);
    }
  }

  if (banqueEntrs.length === 0) return empty;

  var entrainement;
  if (entrainementId) {
    entrainement = banqueEntrs.find(function(e) { return String(e.id).trim() === entrainementId; });
  }
  if (!entrainement) {
    entrainement = banqueEntrs[Math.floor(Math.random() * banqueEntrs.length)];
  }

  // 2. Trouver les etapes de cet entrainement
  var etapesSheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  if (!etapesSheet) return empty;

  var etapesData = etapesSheet.getDataRange().getValues();
  if (etapesData.length < 2) return empty;
  var etapesHeaders = etapesData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var etapes = [];
  for (var ei = 1; ei < etapesData.length; ei++) {
    var etape = {};
    etapesHeaders.forEach(function(h, idx) { etape[h] = etapesData[ei][idx]; });
    if (String(etape.entrainement_id).trim() === String(entrainement.id).trim()) {
      etapes.push(etape);
    }
  }
  etapes.sort(function(a, b) { return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0); });

  // 3. Trouver les liens etape-questions
  var eqSheet = ss.getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!eqSheet) return empty;

  var eqData = eqSheet.getDataRange().getValues();
  if (eqData.length < 2) return empty;
  var eqHeaders = eqData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var etapeIds = etapes.map(function(et) { return String(et.id).trim(); });
  var etapeQuestions = [];
  for (var qi = 1; qi < eqData.length; qi++) {
    var ql = {};
    eqHeaders.forEach(function(h, idx) { ql[h] = eqData[qi][idx]; });
    if (etapeIds.indexOf(String(ql.etape_id).trim()) >= 0) {
      etapeQuestions.push(ql);
    }
  }

  // 4. Charger les questions connaissances
  var qSheet = ss.getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!qSheet) return empty;

  var qData = qSheet.getDataRange().getValues();
  if (qData.length < 2) return empty;
  var qHeaders = qData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Collecter les IDs de questions necessaires
  var neededQuestionIds = {};
  etapeQuestions.forEach(function(eq) {
    neededQuestionIds[String(eq.question_id).trim()] = true;
  });

  var questions = [];
  for (var qj = 1; qj < qData.length; qj++) {
    var q = {};
    qHeaders.forEach(function(h, idx) { q[h] = qData[qj][idx]; });
    if (q.id && neededQuestionIds[String(q.id).trim()]) {
      questions.push(q);
    }
  }

  var duree = parseInt(entrainement.duree) || 15;
  return {
    etapes: etapes,
    etapeQuestions: etapeQuestions,
    questions: questions,
    duree: duree,
    entrainement: {
      id: entrainement.id,
      titre: entrainement.titre || '',
      duree: duree,
      seuil: parseInt(entrainement.seuil) || 80
    }
  };
}

/**
 * Charge les questions d'un exercice SF pour une evaluation
 * Pour le SF, un exercice aleatoire est choisi dans la banque
 * @param {Spreadsheet} ss
 * @param {string} banqueId
 * @returns {{ questions: Array, duree: number }}
 */
function loadSFQuestionsForEval_(ss, banqueId) {
  var empty = { questions: [], duree: 15 };

  // 1. Trouver les exercices de la banque
  var exSheet = ss.getSheetByName(SHEETS.EXERCICES);
  if (!exSheet) return empty;

  var exData = exSheet.getDataRange().getValues();
  if (exData.length < 2) return empty;
  var exHeaders = exData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var exercices = [];
  for (var i = 1; i < exData.length; i++) {
    var ex = {};
    exHeaders.forEach(function(h, idx) { ex[h] = exData[i][idx]; });
    if (String(ex.banque_id).trim() === banqueId && ex.id) {
      exercices.push(ex);
    }
  }

  if (exercices.length === 0) return empty;

  // Choisir un exercice aleatoire
  var exercice = exercices[Math.floor(Math.random() * exercices.length)];

  // 2. Charger le format
  var fSheet = ss.getSheetByName(SHEETS.FORMATS_EXERCICES);
  var format = {};
  if (fSheet && exercice.format_id) {
    var fData = fSheet.getDataRange().getValues();
    if (fData.length >= 2) {
      var fHeaders = fData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var fi = 1; fi < fData.length; fi++) {
        var f = {};
        fHeaders.forEach(function(h, idx) { f[h] = fData[fi][idx]; });
        if (String(f.id).trim() === String(exercice.format_id).trim()) {
          format = f;
          break;
        }
      }
    }
  }

  // 3. Assembler dans le format evaluation
  var donnees = {};
  if (exercice.donnees) {
    try { donnees = JSON.parse(exercice.donnees); } catch (_e) { donnees = {}; }
  }

  var duree = parseInt(exercice.duree) || 15;

  return {
    questions: [{
      id: exercice.id,
      enonce: exercice.titre || exercice.enonce || '',
      explication: exercice.correction || '',
      donnees: donnees,
      format: format,
      format_id: format.id || exercice.format_id || '',
      ordre: 1,
      points: 1
    }],
    duree: duree
  };
}

/**
 * Cree une nouvelle evaluation
 * @param {Object} data - { type, titre, chapitre_id, briques, seuil, duree, ... }
 */
function createEvaluation(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EVALUATIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  if (!data.titre || !data.type) {
    return { success: false, error: 'titre et type requis' };
  }

  // Migration progressive : ajouter les colonnes manquantes
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var requiredCols = ['date_ouverture', 'date_fermeture', 'mode_passation',
    'sous_type_bonus', 'nb_validations', 'competence_id', 'banque_comp_id',
    'points_par_competence', 'competence_ids'];
  requiredCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(col);
      headerNames.push(col);
    }
  });

  const id = 'eval_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'statut') return data.statut || 'brouillon';
    if (col === 'briques') return data.briques || 1;
    if (col === 'seuil') return data.seuil || 80;
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Evaluation creee' };
}

/**
 * Met a jour une evaluation
 * @param {Object} data - { id, ...fields }
 */
function updateEvaluation(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EVALUATIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Evaluation non trouvee' };
  }

  const updates = ['type', 'titre', 'description', 'chapitre_id', 'statut', 'briques', 'seuil', 'duree', 'date_debut', 'date_fin', 'date_ouverture', 'date_fermeture', 'methodologie_id', 'criteres', 'matiere', 'categorie', 'points_mises', 'entrainement_conn_id', 'source_questions', 'exercice_sf_id', 'mode_passation', 'sous_type_bonus', 'nb_validations', 'competence_id', 'banque_comp_id', 'points_par_competence', 'competence_ids'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return { success: true, message: 'Evaluation mise a jour' };
}

/**
 * Supprime une evaluation
 * @param {Object} data - { id }
 */
function deleteEvaluation(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var evalId = String(data.id).trim();

  // 1. Lire l'évaluation pour connaître type/matière (nécessaire pour recalcul progression)
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }
  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = evalHeaders.indexOf('id');
  var evaluation = null;
  var evalRow = -1;

  for (var i = 1; i < evalData.length; i++) {
    if (String(evalData[i][evalIdCol]).trim() === evalId) {
      evaluation = {};
      evalHeaders.forEach(function(h, idx) { evaluation[h] = evalData[i][idx]; });
      evalRow = i + 1;
      break;
    }
  }

  if (!evaluation) {
    return { success: false, error: 'Evaluation non trouvee' };
  }

  var type = String(evaluation.type || '').trim();
  var matiere = String(evaluation.matiere || '').trim();

  // 2. Collecter les élèves ayant un résultat validé (pour recalcul progression)
  var affectedEleves = [];
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (resSheet && resSheet.getLastRow() > 1) {
    var resData = resSheet.getDataRange().getValues();
    var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var resEvalCol = resHeaders.indexOf('evaluation_id');
    var resEleveCol = resHeaders.indexOf('eleve_id');
    var resValidCol = resHeaders.indexOf('is_validated');

    for (var j = 1; j < resData.length; j++) {
      if (String(resData[j][resEvalCol]).trim() === evalId) {
        var isValid = resData[j][resValidCol] === true || String(resData[j][resValidCol]).toUpperCase() === 'TRUE';
        if (isValid) {
          affectedEleves.push(String(resData[j][resEleveCol]).trim());
        }
      }
    }
  }

  // 3. Supprimer en cascade (ordre inverse des dépendances)
  deleteRowsByValue_(ss, SHEETS.EVALUATION_QUESTIONS, 'evaluation_id', evalId);
  deleteRowsByValue_(ss, SHEETS.EVALUATION_RESULTATS, 'evaluation_id', evalId);
  deleteRowsByValue_(ss, SHEETS.ATTRIBUTION_SUJETS, 'evaluation_id', evalId);

  // 4. Supprimer l'évaluation elle-même
  evalSheet.deleteRow(evalRow);

  // 5. Recalculer la progression pour les élèves affectés
  if (affectedEleves.length > 0 && (type === 'connaissances' || type === 'savoir-faire')) {
    try {
      recalcProgressionForEleves_(ss, affectedEleves, type, matiere);
    } catch (e) {
      Logger.log('Erreur recalcul progression après suppression: ' + e.message);
    }
  }

  return { success: true, message: 'Evaluation et donnees associees supprimees' };
}

/**
 * Recalcule la progression pour une liste d'élèves après suppression d'une évaluation.
 * Parcourt tous les résultats validés restants pour trouver la dernière banque validée.
 */
function recalcProgressionForEleves_(ss, eleveIds, type, matiere) {
  // Charger toutes les évaluations du même type/matière
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) return;
  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var sameTypeEvalIds = new Set();
  for (var i = 1; i < evalData.length; i++) {
    var ev = {};
    evalHeaders.forEach(function(h, idx) { ev[h] = evalData[i][idx]; });
    if (String(ev.type).trim() === type &&
        (String(ev.matiere || '').trim() === matiere || String(ev.matiere || '').trim() === 'Les deux')) {
      sameTypeEvalIds.add(String(ev.id).trim());
    }
  }

  // Charger les banques triées par ordre
  var banquesSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banquesSheet = ss.getSheetByName(banquesSheetName);
  var banques = [];
  if (banquesSheet && banquesSheet.getLastRow() > 1) {
    var bData = banquesSheet.getDataRange().getValues();
    var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    for (var b = 1; b < bData.length; b++) {
      var bq = {};
      bHeaders.forEach(function(h, idx) { bq[h] = bData[b][idx]; });
      var bqMatiere = String(bq.matiere || '').trim();
      if (!bqMatiere || bqMatiere === matiere || bqMatiere === 'Les deux') {
        banques.push(bq);
      }
    }
  }
  banques.sort(function(a, b) { return (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999); });
  var banqueOrder = {};
  banques.forEach(function(bq, idx) { banqueOrder[String(bq.id).trim()] = idx; });

  // Charger tous les résultats
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!resSheet || resSheet.getLastRow() <= 1) {
    // Plus aucun résultat → supprimer les progressions
    eleveIds.forEach(function(eid) {
      deleteProgressionEvaluation_(ss, eid, type, matiere);
    });
    return;
  }
  var resData = resSheet.getDataRange().getValues();
  var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Pour chaque élève affecté, trouver la banque validée la plus avancée
  eleveIds.forEach(function(eleveId) {
    var lastValidatedIdx = -1;
    var lastBanqueId = '';

    for (var r = 1; r < resData.length; r++) {
      var res = {};
      resHeaders.forEach(function(h, idx) { res[h] = resData[r][idx]; });

      if (String(res.eleve_id).trim() !== eleveId) continue;
      if (!sameTypeEvalIds.has(String(res.evaluation_id).trim())) continue;
      var isValid = res.is_validated === true || String(res.is_validated).toUpperCase() === 'TRUE';
      if (!isValid) continue;

      var bid = String(res.banque_id || '').trim();
      if (bid && banqueOrder[bid] !== undefined && banqueOrder[bid] > lastValidatedIdx) {
        lastValidatedIdx = banqueOrder[bid];
        lastBanqueId = bid;
      }
    }

    if (lastBanqueId) {
      updateProgressionEvaluation_(eleveId, type, matiere, lastBanqueId);
    } else {
      // Plus aucune banque validée → supprimer la progression
      deleteProgressionEvaluation_(ss, eleveId, type, matiere);
    }
  });
}

/**
 * Supprime la ligne de progression d'un élève pour un type/matière donné.
 */
function deleteProgressionEvaluation_(ss, eleveId, type, matiere) {
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  if (!sheet || sheet.getLastRow() <= 1) return;

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var typeCol = headers.indexOf('type');
  var matiereCol = headers.indexOf('matiere');

  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][eleveIdCol]).trim() === String(eleveId).trim() &&
        String(allData[i][typeCol]).trim() === String(type).trim() &&
        (matiereCol < 0 || String(allData[i][matiereCol]).trim() === String(matiere).trim())) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Sauvegarde le resultat d'une evaluation pour un eleve
 * @param {Object} data - { evaluation_id, eleve_id, score, validations, is_validated, temps_passe, details }
 */
function saveEvaluationResult(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);

  // Creer la sheet si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EVALUATION_RESULTATS);
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'score', 'validations', 'is_validated', 'temps_passe', 'date_passage', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut', 'banque_id', 'entrainement_id']);
  }

  // Migration progressive : ajouter les colonnes manquantes
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var migrationCols = ['banque_id', 'entrainement_id', 'correction_html', 'detailed_results', 'statut_resultat',
    'validation_numero', 'competence_ids_validees', 'demande_statut', 'date_demande', 'date_acceptation', 'date_rendu'];
  migrationCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  // Vérifier si un résultat existe déjà pour cet élève/évaluation (mise à jour)
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour du résultat existant
    // banque_id et entrainement_id ne sont PAS dans cette liste :
    // ils sont posés à la création et ne doivent pas être écrasés lors d'un repassage
    var updatableFields = ['score', 'validations', 'is_validated', 'temps_passe', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut', 'statut_resultat', 'correction_html', 'detailed_results'];
    updatableFields.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          var value = data[field];
          if (field === 'is_validated') value = (value === true || value === 'true');
          sheet.getRange(existingRow, colIdx + 1).setValue(value);
        }
      }
    });
    // Mettre à jour la date de passage (manuelle si fournie, sinon auto)
    var dateCol = headers.indexOf('date_passage');
    if (dateCol >= 0) {
      var dateValue = data.date_passage ? data.date_passage : new Date().toISOString();
      sheet.getRange(existingRow, dateCol + 1).setValue(dateValue);
    }

    // Mettre a jour la progression evaluation si valide
    var isValidUpdate = data.is_validated === true || data.is_validated === 'true';
    if (isValidUpdate) {
      updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id || '');
    }

    // Auto-terminée : si évaluation papier et saisie manuelle, passer en terminée
    autoTerminePapier_(ss, data.evaluation_id);

    return { success: true, id: String(allData[existingRow - 1][0]), message: 'Resultat mis a jour' };
  }

  // Nouveau résultat
  const id = 'res_' + new Date().getTime();
  const datePassage = new Date().toISOString();

  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'score') return data.score || 0;
    if (col === 'validations') return data.validations || 0;
    if (col === 'is_validated') return data.is_validated === true || data.is_validated === 'true';
    if (col === 'temps_passe') return data.temps_passe || 0;
    if (col === 'date_passage') return data.date_passage || datePassage;
    if (col === 'details') return data.details || '';
    if (col === 'mode') return data.mode || 'numerique';
    if (col === 'source') return data.source || 'auto';
    if (col === 'remarque_texte') return data.remarque_texte || '';
    if (col === 'remarque_media') return data.remarque_media || '';
    if (col === 'statut') return data.statut || '';
    if (col === 'banque_id') return data.banque_id || '';
    if (col === 'entrainement_id') return data.entrainement_id || '';
    if (col === 'correction_html') return data.correction_html || '';
    if (col === 'detailed_results') return data.detailed_results || '';
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  // Synchroniser ATTRIBUTION_SUJETS avec la banque/exercice réellement passés
  if (data.banque_id) {
    syncAttributionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id, data.entrainement_id || '');
  }

  // Mettre a jour la progression evaluation si valide
  var isValid = data.is_validated === true || data.is_validated === 'true';
  if (isValid) {
    updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id || '');
  }

  // Auto-terminée : si évaluation papier et saisie manuelle, passer en terminée
  autoTerminePapier_(ss, data.evaluation_id);

  return { success: true, id: id, message: 'Resultat sauvegarde' };
}

/**
 * Si l'evaluation est en mode papier et pas encore terminee, passe son statut a 'terminee'
 * Appelee automatiquement apres chaque saisie de resultat
 */
function autoTerminePapier_(ss, evaluationId) {
  try {
    var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
    if (!evalSheet) return;

    var evalData = evalSheet.getDataRange().getValues();
    var headers = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var idCol = headers.indexOf('id');
    var modeCol = headers.indexOf('mode_passation');
    var statutCol = headers.indexOf('statut');
    if (idCol < 0 || modeCol < 0 || statutCol < 0) return;

    for (var i = 1; i < evalData.length; i++) {
      if (String(evalData[i][idCol]).trim() === String(evaluationId).trim()) {
        var mode = String(evalData[i][modeCol]).trim().toLowerCase();
        var statut = String(evalData[i][statutCol]).trim().toLowerCase();
        if (mode === 'papier' && statut !== 'terminee') {
          evalSheet.getRange(i + 1, statutCol + 1).setValue('terminee');
        }
        break;
      }
    }
  } catch (e) {
    // Non bloquant
  }
}

/**
 * Met a jour la progression evaluation apres validation d'un resultat
 * Utilise la banque_id passee en parametre (depuis le resultat), ou cherche dans ATTRIBUTION_SUJETS en fallback
 * @param {Spreadsheet} ss
 * @param {string} evaluationId
 * @param {string} eleveId
 * @param {string} banqueIdFromResult - banque_id provenant du resultat (prioritaire)
 */
function updateProgressionFromResult_(ss, evaluationId, eleveId, banqueIdFromResult) {
  try {
    // 1. Trouver le type de l'evaluation
    var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
    if (!evalSheet) return;

    var evalData = evalSheet.getDataRange().getValues();
    var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evaluation = null;

    for (var i = 1; i < evalData.length; i++) {
      var item = {};
      evalHeaders.forEach(function(header, index) { item[header] = evalData[i][index]; });
      if (String(item.id).trim() === String(evaluationId).trim()) {
        evaluation = item;
        break;
      }
    }

    if (!evaluation) return;
    var type = String(evaluation.type).trim();
    var matiere = String(evaluation.matiere || '').trim();
    if (type !== 'connaissances' && type !== 'savoir-faire') return;

    // 2. Determiner la banque : priorite au parametre, sinon fallback sur ATTRIBUTION_SUJETS
    var banqueId = banqueIdFromResult ? String(banqueIdFromResult).trim() : '';

    if (!banqueId) {
      var attrSheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
      if (attrSheet) {
        var attrData = attrSheet.getDataRange().getValues();
        if (attrData.length >= 2) {
          var attrHeaders = attrData[0].map(function(h) { return String(h).toLowerCase().trim(); });
          for (var j = 1; j < attrData.length; j++) {
            var attr = {};
            attrHeaders.forEach(function(header, index) { attr[header] = attrData[j][index]; });
            if (String(attr.evaluation_id).trim() === String(evaluationId).trim() &&
                String(attr.eleve_id).trim() === String(eleveId).trim()) {
              banqueId = String(attr.banque_id || '').trim();
              break;
            }
          }
        }
      }
    }

    if (!banqueId) return;

    // 3. Mettre a jour la progression
    updateProgressionEvaluation_(eleveId, type, matiere, banqueId);
  } catch (e) {
    // Ne pas bloquer la sauvegarde du resultat si la progression echoue
    Logger.log('Erreur updateProgressionFromResult_: ' + e.message);
  }
}

/**
 * Recupere les resultats d'une evaluation
 * @param {Object} data - { evaluation_id?, eleve_id? }
 */
function getEvaluationResults(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const results = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtres
    if (data.evaluation_id && String(item.evaluation_id).trim() !== String(data.evaluation_id).trim()) continue;
    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;

    // Parser details si JSON
    if (item.details) {
      try {
        item.details = JSON.parse(item.details);
      } catch (e) {
        // Garder comme string
      }
    }

    results.push(item);
  }

  return { success: true, data: results };
}

/**
 * Recupere un resultat d'evaluation avec les infos enrichies pour le mode review
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function getEvaluationResultForReview(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Trouver le resultat
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!resSheet) {
    return { success: false, error: 'Aucun resultat trouve' };
  }

  var resData = resSheet.getDataRange().getValues();
  var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var resultat = null;

  for (var i = 1; i < resData.length; i++) {
    var row = {};
    resHeaders.forEach(function(h, idx) { row[h] = resData[i][idx]; });
    if (String(row.evaluation_id).trim() === String(data.evaluation_id).trim() &&
        String(row.eleve_id).trim() === String(data.eleve_id).trim()) {
      resultat = row;
      break;
    }
  }

  if (!resultat) {
    return { success: false, error: 'Resultat non trouve' };
  }

  // Parser JSON fields
  if (resultat.details) {
    try { resultat.details = JSON.parse(resultat.details); } catch (e) { /* keep string */ }
  }
  if (resultat.detailed_results) {
    try { resultat.detailed_results = JSON.parse(resultat.detailed_results); } catch (e) { /* keep string */ }
  }

  // 2. Recuperer les infos de l'evaluation
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  var evaluation = null;
  if (evalSheet) {
    var evalData = evalSheet.getDataRange().getValues();
    var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    for (var j = 1; j < evalData.length; j++) {
      var evalRow = {};
      evalHeaders.forEach(function(h, idx) { evalRow[h] = evalData[j][idx]; });
      if (String(evalRow.id).trim() === String(data.evaluation_id).trim()) {
        evaluation = evalRow;
        break;
      }
    }
  }

  // 3. Recuperer le titre de la banque si banque_id present
  var banqueTitre = '';
  if (resultat.banque_id && evaluation) {
    var type = String(evaluation.type || '').trim();
    var bSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
    var bSheet = ss.getSheetByName(bSheetName);
    if (bSheet) {
      var bData = bSheet.getDataRange().getValues();
      var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var bIdCol = bHeaders.indexOf('id');
      var bTitreCol = bHeaders.indexOf('titre');
      if (bIdCol >= 0 && bTitreCol >= 0) {
        for (var k = 1; k < bData.length; k++) {
          if (String(bData[k][bIdCol]).trim() === String(resultat.banque_id).trim()) {
            banqueTitre = String(bData[k][bTitreCol]).trim();
            break;
          }
        }
      }
    }
  }

  return {
    success: true,
    data: {
      resultat: resultat,
      evaluation: evaluation,
      banque_titre: banqueTitre
    }
  };
}

/**
 * Recupere les evaluations disponibles pour un eleve avec leur statut
 * @param {Object} data - { eleve_id, classe_id? }
 */
function getEleveEvaluations(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Recuperer toutes les evaluations publiees
  const evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: true, data: [] };
  }

  const evalData = evalSheet.getDataRange().getValues();
  if (evalData.length < 2) {
    return { success: true, data: [] };
  }

  const evalHeaders = evalData[0].map(h => String(h).toLowerCase().trim());
  const evaluations = [];

  for (let i = 1; i < evalData.length; i++) {
    const row = evalData[i];
    const item = {};
    evalHeaders.forEach((header, index) => {
      item[header] = row[index];
    });

    // Calculer le statut effectif depuis les dates
    var effectiveStatut = _computeEffectiveStatut_(item);
    // Ne garder que les évaluations visibles pour les élèves (planifiée, publiée, terminée)
    if (effectiveStatut !== 'planifiee' && effectiveStatut !== 'publiee' && effectiveStatut !== 'terminee') continue;
    item.statut = effectiveStatut;

    if (item.id) {
      evaluations.push(item);
    }
  }

  // 2. Recuperer les resultats de cet eleve
  const resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  const resultsMap = {};

  if (resSheet) {
    const resData = resSheet.getDataRange().getValues();
    if (resData.length >= 2) {
      const resHeaders = resData[0].map(h => String(h).toLowerCase().trim());

      for (let i = 1; i < resData.length; i++) {
        const row = resData[i];
        const item = {};
        resHeaders.forEach((header, index) => {
          item[header] = row[index];
        });

        if (String(item.eleve_id).trim() === String(data.eleve_id).trim()) {
          const evalId = String(item.evaluation_id).trim();
          // Garder le dernier resultat pour chaque evaluation
          if (!resultsMap[evalId] || new Date(item.date_passage) > new Date(resultsMap[evalId].date_passage)) {
            resultsMap[evalId] = item;
          }
        }
      }
    }
  }

  // 3. Enrichir les evaluations avec le statut eleve
  const now = new Date();
  const enrichedEvaluations = evaluations.map(eval => {
    const result = resultsMap[String(eval.id).trim()];

    let eleveStatut = 'disponible';
    if (result) {
      if (result.is_validated === true || result.is_validated === 'true') {
        eleveStatut = 'validee';
      } else {
        eleveStatut = 'a_repasser';
      }
    } else {
      // Verifier les dates
      if (eval.date_debut && new Date(eval.date_debut) > now) {
        eleveStatut = 'a_venir';
      }
      if (eval.date_fin && new Date(eval.date_fin) < now) {
        eleveStatut = 'expiree';
      }
    }

    return {
      ...eval,
      eleve_statut: eleveStatut,
      dernier_resultat: result || null
    };
  });

  return { success: true, data: enrichedEvaluations };
}

// ========================================
// PARAMETRES NOTES
// Table : PARAMETRES_NOTES
// Colonnes : id, matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin
// ========================================

/**
 * Récupère les paramètres de notes (tous ou filtrés par matière/semestre)
 * @param {Object} data - { matiere?, semestre? }
 */
function getParametresNotes(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PARAMETRES_NOTES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (!item.id) continue;
    if (data.matiere && item.matiere !== data.matiere) continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde les paramètres de notes (crée ou met à jour)
 * @param {Object} data - { matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin }
 */
function saveParametresNotes(data) {
  if (!data.matiere || !data.semestre) {
    return { success: false, error: 'matiere et semestre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PARAMETRES_NOTES);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PARAMETRES_NOTES);
    sheet.appendRow(['id', 'matiere', 'semestre', 'note_depart', 'budget_estime', 'coefficient_progression', 'date_debut', 'date_fin']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Chercher si un paramètre existe déjà pour cette matière/semestre
  var matiereCol = headers.indexOf('matiere');
  var semestreCol = headers.indexOf('semestre');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][matiereCol]).trim() === String(data.matiere).trim() &&
        String(allData[i][semestreCol]).trim() === String(data.semestre).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour
    var updatable = ['note_depart', 'budget_estime', 'coefficient_progression', 'date_debut', 'date_fin'];
    updatable.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          sheet.getRange(existingRow, colIdx + 1).setValue(data[field]);
        }
      }
    });
    return { success: true, message: 'Parametres mis a jour' };
  }

  // Création
  var id = 'pn_' + new Date().getTime();
  var newRow = [
    id,
    data.matiere,
    data.semestre,
    data.note_depart !== undefined ? data.note_depart : 8,
    data.budget_estime !== undefined ? data.budget_estime : 100,
    data.coefficient_progression !== undefined ? data.coefficient_progression : 3,
    data.date_debut || '',
    data.date_fin || ''
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Parametres crees' };
}

// ========================================
// NOTES SOMMATIVES
// Table : NOTES_SOMMATIVES
// Colonnes : id, titre, matiere, bareme, coefficient, date, semestre
// ========================================

/**
 * Récupère les évaluations sommatives
 * @param {Object} data - { matiere?, semestre? }
 */
function getNotesSommatives(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (!item.id) continue;
    if (data.matiere && item.matiere !== data.matiere && item.matiere !== 'Les deux') continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Crée une évaluation sommative
 * @param {Object} data - { titre, matiere, bareme, coefficient, date, semestre }
 */
function createNoteSommative(data) {
  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOTES_SOMMATIVES);
    sheet.appendRow(['id', 'titre', 'matiere', 'bareme', 'coefficient', 'date', 'semestre']);
  }

  var id = 'som_' + new Date().getTime();
  var newRow = [
    id,
    data.titre,
    data.matiere || 'FR',
    data.bareme !== undefined ? data.bareme : 20,
    data.coefficient !== undefined ? data.coefficient : 1,
    data.date || '',
    data.semestre || 1
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Sommative creee' };
}

/**
 * Met à jour une évaluation sommative
 * @param {Object} data - { id, titre?, matiere?, bareme?, coefficient?, date?, semestre? }
 */
function updateNoteSommative(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvee' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      var updatable = ['titre', 'matiere', 'bareme', 'coefficient', 'date', 'semestre'];
      updatable.forEach(function(field) {
        if (data[field] !== undefined) {
          var colIdx = headers.indexOf(field);
          if (colIdx >= 0) {
            sheet.getRange(i + 1, colIdx + 1).setValue(data[field]);
          }
        }
      });
      return { success: true, message: 'Sommative mise a jour' };
    }
  }

  return { success: false, error: 'Sommative non trouvee' };
}

/**
 * Supprime une évaluation sommative et ses résultats
 * @param {Object} data - { id }
 */
function deleteNoteSommative(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les résultats associés
  var resSheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);
  if (resSheet) {
    var resData = resSheet.getDataRange().getValues();
    var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var somIdCol = resHeaders.indexOf('sommative_id');
    for (var j = resData.length - 1; j >= 1; j--) {
      if (String(resData[j][somIdCol]).trim() === String(data.id).trim()) {
        resSheet.deleteRow(j + 1);
      }
    }
  }

  // Supprimer la sommative
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvee' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');

  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Sommative supprimee' };
    }
  }

  return { success: false, error: 'Sommative non trouvee' };
}

// ========================================
// RESULTATS SOMMATIVES
// Table : RESULTATS_SOMMATIVES
// Colonnes : id, sommative_id, eleve_id, note, statut, remarque_texte, remarque_media, date_saisie
// ========================================

/**
 * Récupère les résultats des sommatives
 * @param {Object} data - { sommative_id?, eleve_id? }
 */
function getResultatsSommatives(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.sommative_id && String(item.sommative_id).trim() !== String(data.sommative_id).trim()) continue;
    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde un résultat de sommative (crée ou met à jour)
 * @param {Object} data - { sommative_id, eleve_id, note, statut, remarque_texte, remarque_media }
 */
function saveResultatSommative(data) {
  if (!data.sommative_id || !data.eleve_id) {
    return { success: false, error: 'sommative_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RESULTATS_SOMMATIVES);
    sheet.appendRow(['id', 'sommative_id', 'eleve_id', 'note', 'statut', 'remarque_texte', 'remarque_media', 'date_saisie']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var somIdCol = headers.indexOf('sommative_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][somIdCol]).trim() === String(data.sommative_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour
    var updatable = ['note', 'statut', 'remarque_texte', 'remarque_media'];
    updatable.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          sheet.getRange(existingRow, colIdx + 1).setValue(data[field]);
        }
      }
    });
    var dateCol = headers.indexOf('date_saisie');
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(new Date().toISOString());
    return { success: true, message: 'Resultat sommative mis a jour' };
  }

  // Création
  var id = 'rsom_' + new Date().getTime();
  var newRow = [
    id,
    data.sommative_id,
    data.eleve_id,
    data.note !== undefined ? data.note : '',
    data.statut || '',
    data.remarque_texte || '',
    data.remarque_media || '',
    new Date().toISOString()
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Resultat sommative sauvegarde' };
}

// ========================================
// OBJECTIFS ELEVES
// Table : OBJECTIFS_ELEVES
// Colonnes : id, eleve_id, matiere, semestre, objectif_note
// ========================================

/**
 * Récupère les objectifs des élèves
 * @param {Object} data - { eleve_id?, matiere?, semestre? }
 */
function getObjectifsEleves(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.OBJECTIFS_ELEVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.matiere && item.matiere !== data.matiere) continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde l'objectif d'un élève (crée ou met à jour)
 * @param {Object} data - { eleve_id, matiere, semestre, objectif_note }
 */
function saveObjectifEleve(data) {
  if (!data.eleve_id || !data.matiere || !data.semestre) {
    return { success: false, error: 'eleve_id, matiere et semestre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.OBJECTIFS_ELEVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.OBJECTIFS_ELEVES);
    sheet.appendRow(['id', 'eleve_id', 'matiere', 'semestre', 'objectif_note']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var matiereCol = headers.indexOf('matiere');
  var semestreCol = headers.indexOf('semestre');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][matiereCol]).trim() === String(data.matiere).trim() &&
        String(allData[i][semestreCol]).trim() === String(data.semestre).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    var noteCol = headers.indexOf('objectif_note');
    if (noteCol >= 0) {
      sheet.getRange(existingRow, noteCol + 1).setValue(data.objectif_note);
    }
    return { success: true, message: 'Objectif mis a jour' };
  }

  var id = 'obj_' + new Date().getTime();
  var newRow = [id, data.eleve_id, data.matiere, data.semestre, data.objectif_note || 0];
  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Objectif sauvegarde' };
}

// ========================================
// PROGRESSION EVALUATION
// Table : PROGRESSION_EVALUATION
// Colonnes : id, eleve_id, type, derniere_banque_validee_id, date_validation
// ========================================

/**
 * Recupere la progression evaluation de tous les eleves (ou un seul)
 * @param {Object} data - { eleve_id?, type? }
 */
function getProgressionEvaluation(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.type && String(item.type).trim() !== String(data.type).trim()) continue;

    if (item.id) result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Avance la progression evaluation d'un eleve apres validation
 * Appelé quand is_validated=true lors de saveEvaluationResult
 * @param {string} eleveId
 * @param {string} type - 'connaissances' ou 'savoir-faire'
 * @param {string} matiere - 'FR' ou 'HG-EMC'
 * @param {string} banqueId - ID de la banque validée
 */
function updateProgressionEvaluation_(eleveId, type, matiere, banqueId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_EVALUATION);
    sheet.appendRow(['id', 'eleve_id', 'type', 'matiere', 'derniere_banque_validee_id', 'date_validation']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var typeCol = headers.indexOf('type');
  var matiereCol = headers.indexOf('matiere');
  var banqueCol = headers.indexOf('derniere_banque_validee_id');
  var dateCol = headers.indexOf('date_validation');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(eleveId).trim() &&
        String(allData[i][typeCol]).trim() === String(type).trim() &&
        (matiereCol < 0 || String(allData[i][matiereCol]).trim() === String(matiere).trim())) {
      existingRow = i + 1;
      break;
    }
  }

  var now = new Date().toISOString();

  if (existingRow > 0) {
    if (banqueCol >= 0) sheet.getRange(existingRow, banqueCol + 1).setValue(banqueId);
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(now);
  } else {
    var id = 'progeval_' + new Date().getTime();
    sheet.appendRow([id, eleveId, type, matiere || '', banqueId, now]);
  }
}

// ========================================
// ATTRIBUTION SUJETS
// Table : ATTRIBUTION_SUJETS
// Colonnes : id, evaluation_id, eleve_id, banque_id, entrainement_id, source
// ========================================

/**
 * Recupere les attributions pour une evaluation
 * @param {Object} data - { evaluation_id }
 */
function getAttributionsSujets(data) {
  if (!data.evaluation_id) {
    return { success: false, error: 'evaluation_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (String(item.evaluation_id).trim() === String(data.evaluation_id).trim() && item.id) {
      result.push(item);
    }
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde les attributions de sujets pour une evaluation
 * Remplace toutes les attributions existantes pour cette evaluation
 * @param {Object} data - { evaluation_id, attributions: JSON string of [{eleve_id, banque_id, entrainement_id, source}] }
 */
function saveAttributionsSujets(data) {
  if (!data.evaluation_id || !data.attributions) {
    return { success: false, error: 'evaluation_id et attributions requis' };
  }

  var attributions;
  try {
    attributions = typeof data.attributions === 'string' ? JSON.parse(data.attributions) : data.attributions;
  } catch (e) {
    return { success: false, error: 'Format attributions invalide' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
  }

  // Supprimer les attributions existantes pour cette evaluation
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');

  // Parcourir de bas en haut pour supprimer sans décalage
  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim()) {
      sheet.deleteRow(i + 1);
    }
  }

  // Inserer les nouvelles attributions
  var timestamp = new Date().getTime();
  for (var j = 0; j < attributions.length; j++) {
    var attr = attributions[j];
    var id = 'attr_' + timestamp + '_' + j;
    sheet.appendRow([
      id,
      data.evaluation_id,
      attr.eleve_id || '',
      attr.banque_id || '',
      attr.entrainement_id || '',
      attr.source || 'auto'
    ]);
  }

  return { success: true, message: attributions.length + ' attributions sauvegardees' };
}

/**
 * Recupere l'attribution de sujet pour un eleve specifique sur une evaluation
 * Utilise par le frontend eleve pour savoir quel sujet passer
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function getAttributionSujetEleve(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (!sheet) {
    return { success: true, data: null };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: null };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (String(item.evaluation_id).trim() === String(data.evaluation_id).trim() &&
        String(item.eleve_id).trim() === String(data.eleve_id).trim()) {
      return { success: true, data: item };
    }
  }

  return { success: true, data: null };
}

// ========================================
// HELPERS — STATUT EFFECTIF
// ========================================

/**
 * Calcule le statut effectif d'une évaluation à partir de ses dates.
 * Brouillon = décision manuelle de la prof, jamais écrasé.
 * Papier = pas d'auto-calcul depuis les dates.
 * @param {Object} evaluation - objet avec statut, date_ouverture, date_fermeture, mode_passation
 * @returns {string} statut effectif ('brouillon', 'planifiee', 'publiee', 'terminee')
 */
function _computeEffectiveStatut_(evaluation) {
  var statut = String(evaluation.statut || 'brouillon').trim();
  if (statut === 'brouillon') return 'brouillon';
  if (String(evaluation.mode_passation || '').trim() === 'papier') return statut;

  var now = new Date();
  var dateOuverture = evaluation.date_ouverture ? new Date(evaluation.date_ouverture) : null;
  var dateFermeture = evaluation.date_fermeture ? new Date(evaluation.date_fermeture) : null;

  if (!dateOuverture && !dateFermeture) return statut;

  if (dateOuverture && !isNaN(dateOuverture.getTime()) && dateOuverture > now) return 'planifiee';
  if (dateFermeture && !isNaN(dateFermeture.getTime()) && dateFermeture < now) return 'terminee';
  return 'publiee';
}

// ========================================
// WORKFLOW DEMANDE D'ÉVALUATION (bonus / tâches complexes)
// États : demande → accepte → soumis → corrige
// ========================================

/**
 * Élève demande à passer une évaluation (bonus compétence, bonus ponctuel, tâche complexe sur demande)
 * Crée un résultat avec demande_statut='demande'
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function demanderEvaluation(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet EVALUATION_RESULTATS non trouvée' };
  }

  // Migration progressive
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var migrationCols = ['demande_statut', 'date_demande', 'date_acceptation', 'date_rendu'];
  migrationCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  // Vérifier qu'il n'y a pas déjà une demande en cours
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var demandeCol = headers.indexOf('demande_statut');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      var existingStatut = demandeCol >= 0 ? String(allData[i][demandeCol]).trim() : '';
      if (existingStatut === 'demande' || existingStatut === 'accepte') {
        return { success: false, error: 'Une demande est déjà en cours' };
      }
    }
  }

  // Créer le résultat avec statut demande
  var id = 'res_' + new Date().getTime();
  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'demande_statut') return 'demande';
    if (col === 'date_demande') return new Date().toISOString();
    if (col === 'source') return 'demande_eleve';
    return '';
  });

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Demande enregistrée' };
}

/**
 * Prof accepte ou refuse une demande d'évaluation
 * @param {Object} data - { evaluation_id, eleve_id, decision: 'accepte'|'refuse', date_rendu? }
 */
function repondreDemandeEvaluation(data) {
  if (!data.evaluation_id || !data.eleve_id || !data.decision) {
    return { success: false, error: 'evaluation_id, eleve_id et decision requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var demandeCol = headers.indexOf('demande_statut');
  var dateAcceptCol = headers.indexOf('date_acceptation');
  var dateRenduCol = headers.indexOf('date_rendu');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        demandeCol >= 0 && String(allData[i][demandeCol]).trim() === 'demande') {
      // Mettre à jour le statut
      sheet.getRange(i + 1, demandeCol + 1).setValue(data.decision);
      if (dateAcceptCol >= 0) {
        sheet.getRange(i + 1, dateAcceptCol + 1).setValue(new Date().toISOString());
      }
      if (data.date_rendu && dateRenduCol >= 0) {
        sheet.getRange(i + 1, dateRenduCol + 1).setValue(data.date_rendu);
      }
      return { success: true, message: 'Demande ' + data.decision };
    }
  }

  return { success: false, error: 'Demande non trouvée' };
}

/**
 * Sauvegarde une validation de suivi (bonus suivi — ex: gestion du matériel)
 * Incrémente le compteur de validations pour un élève
 * @param {Object} data - { evaluation_id, eleve_id, validation_numero }
 */
function saveValidationSuivi(data) {
  if (!data.evaluation_id || !data.eleve_id || !data.validation_numero) {
    return { success: false, error: 'evaluation_id, eleve_id et validation_numero requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet non trouvée' };
  }

  // Migration progressive
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  ['validation_numero'].forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  // Chercher un résultat existant pour cet élève/évaluation
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var validNumCol = headers.indexOf('validation_numero');
  var validationsCol = headers.indexOf('validations');
  var dateCol = headers.indexOf('date_passage');

  var existingRow = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mettre à jour le nombre de validations et la date
    if (validNumCol >= 0) sheet.getRange(existingRow, validNumCol + 1).setValue(data.validation_numero);
    if (validationsCol >= 0) sheet.getRange(existingRow, validationsCol + 1).setValue(data.validation_numero);
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(new Date().toISOString());
    return { success: true, message: 'Validation ' + data.validation_numero + ' enregistrée' };
  }

  // Créer un nouveau résultat
  var id = 'res_' + new Date().getTime();
  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'validation_numero') return data.validation_numero;
    if (col === 'validations') return data.validation_numero;
    if (col === 'source') return 'saisie_admin';
    if (col === 'date_passage') return new Date().toISOString();
    return '';
  });

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Validation ' + data.validation_numero + ' enregistrée' };
}

// ================================================================
// FILE: Exercices.gs
// ================================================================

// ========================================
// BANQUES D'EXERCICES
// ========================================

/**
 * Récupère toutes les banques d'exercices
 * @param {Object} data - { type? } - Filtre optionnel par type
 */
function getBanquesExercices(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES);
  if (!sheet) {
    return { success: false, error: 'Sheet BANQUES_EXERCICES non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const banques = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtrer par type si spécifié
    if (data.type && item.type !== data.type) continue;
    // Filtrer par statut si spécifié
    if (data.statut && item.statut !== data.statut) continue;

    if (item.id) {
      banques.push(item);
    }
  }

  return { success: true, data: banques };
}

/**
 * Récupère une banque avec ses exercices
 * @param {Object} data - { id }
 */
function getBanqueExercices(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Récupérer la banque
  const banqueSheet = ss.getSheetByName(SHEETS.BANQUES_EXERCICES);
  const banqueData = banqueSheet.getDataRange().getValues();
  const banqueHeaders = banqueData[0].map(h => String(h).toLowerCase().trim());

  let banque = null;
  for (let i = 1; i < banqueData.length; i++) {
    const row = banqueData[i];
    const idCol = banqueHeaders.indexOf('id');
    if (String(row[idCol]).trim() === String(data.id).trim()) {
      banque = {};
      banqueHeaders.forEach((header, index) => {
        banque[header] = row[index];
      });
      break;
    }
  }

  if (!banque) {
    return { success: false, error: 'Banque non trouvée' };
  }

  // 2. Récupérer les exercices de cette banque
  const exoSheet = ss.getSheetByName(SHEETS.EXERCICES);
  const exoData = exoSheet.getDataRange().getValues();
  const exoHeaders = exoData[0].map(h => String(h).toLowerCase().trim());

  const exercices = [];
  for (let i = 1; i < exoData.length; i++) {
    const row = exoData[i];
    const item = {};
    exoHeaders.forEach((header, index) => {
      item[header] = row[index];
    });

    if (item.banque_id === data.id) {
      // Parser le JSON des données si présent
      if (item.donnees && typeof item.donnees === 'string') {
        try {
          item.donnees = JSON.parse(item.donnees);
        } catch (e) {
          // Garder comme string si erreur
        }
      }
      exercices.push(item);
    }
  }

  // Trier par numéro
  exercices.sort((a, b) => (a.numero || 0) - (b.numero || 0));

  banque.exercices = exercices;

  return { success: true, data: banque };
}

/**
 * Crée une nouvelle banque d'exercices
 * @param {Object} data - { type, titre, description?, ordre?, statut? }
 */
function createBanqueExercices(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES);

  if (!data.type || !data.titre) {
    return { success: false, error: 'type et titre requis' };
  }

  const id = 'banque_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'statut') return data.statut || 'brouillon';
    if (col === 'ordre') return data.ordre || 1;
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Banque créée' };
}

/**
 * Met à jour une banque d'exercices
 * @param {Object} data - { id, ...fields }
 */
function updateBanqueExercices(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Banque non trouvée' };
  }

  const updates = ['type', 'titre', 'description', 'ordre', 'statut', 'matiere'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return { success: true, message: 'Banque mise à jour' };
}

/**
 * Supprime une banque d'exercices et ses exercices
 * @param {Object} data - { id }
 */
function deleteBanqueExercices(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Supprimer les exercices liés
  const exoSheet = ss.getSheetByName(SHEETS.EXERCICES);
  const exoData = exoSheet.getDataRange().getValues();
  const exoHeaders = exoData[0].map(h => String(h).toLowerCase().trim());
  const banqueIdCol = exoHeaders.indexOf('banque_id');

  for (let i = exoData.length - 1; i >= 1; i--) {
    if (String(exoData[i][banqueIdCol]).trim() === String(data.id).trim()) {
      exoSheet.deleteRow(i + 1);
    }
  }

  // 2. Supprimer la banque
  const banqueSheet = ss.getSheetByName(SHEETS.BANQUES_EXERCICES);
  const banqueData = banqueSheet.getDataRange().getValues();
  const banqueHeaders = banqueData[0].map(h => String(h).toLowerCase().trim());
  const idCol = banqueHeaders.indexOf('id');

  for (let i = banqueData.length - 1; i >= 1; i--) {
    if (String(banqueData[i][idCol]).trim() === String(data.id).trim()) {
      banqueSheet.deleteRow(i + 1);
      break;
    }
  }

  return { success: true, message: 'Banque et exercices supprimés' };
}

// ========================================
// FORMATS D'EXERCICES
// ========================================

/**
 * Récupère tous les formats d'exercices
 * @param {Object} data - { type_compatible? } - Filtre optionnel
 */
function getFormatsExercices(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_EXERCICES);
  if (!sheet) {
    return { success: false, error: 'Sheet FORMATS_EXERCICES non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const formats = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Parser la structure JSON si présente
    if (item.structure && typeof item.structure === 'string') {
      try {
        item.structure = JSON.parse(item.structure);
      } catch (e) {
        // Garder comme string si erreur
      }
    }

    // Filtrer par type_compatible si spécifié
    if (data.type_compatible) {
      const types = String(item.type_compatible || '').split(',').map(t => t.trim());
      if (!types.includes(data.type_compatible)) continue;
    }

    if (item.id) {
      formats.push(item);
    }
  }

  return { success: true, data: formats };
}

/**
 * Crée un nouveau format d'exercice
 * @param {Object} data - { nom, description?, type_compatible?, structure }
 */
function createFormatExercices(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_EXERCICES);

  if (!data.nom) {
    return { success: false, error: 'nom requis' };
  }

  const id = 'format_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'structure' && typeof data.structure === 'object') {
      return JSON.stringify(data.structure);
    }
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Format créé' };
}

/**
 * Met à jour un format d'exercice
 * @param {Object} data - { id, ...fields }
 */
function updateFormatExercices(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_EXERCICES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Format non trouvé' };
  }

  const updates = ['nom', 'description', 'type_compatible', 'structure'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        let value = data[col];
        if (col === 'structure' && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        sheet.getRange(rowIndex, colIndex + 1).setValue(value);
      }
    }
  });

  return { success: true, message: 'Format mis à jour' };
}

/**
 * Supprime un format d'exercice
 * @param {Object} data - { id }
 */
function deleteFormatExercices(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_EXERCICES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Format supprimé' };
    }
  }

  return { success: false, error: 'Format non trouvé' };
}

// ========================================
// EXERCICES
// ========================================

/**
 * Récupère les exercices
 * @param {Object} data - { banque_id?, format_id?, statut? } - Filtres optionnels
 */
function getExercices(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);
  if (!sheet) {
    return { success: false, error: 'Sheet EXERCICES non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const exercices = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtres
    if (data.banque_id && item.banque_id !== data.banque_id) continue;
    if (data.format_id && item.format_id !== data.format_id) continue;
    if (data.statut && item.statut !== data.statut) continue;

    // Parser le JSON des données si présent
    if (item.donnees && typeof item.donnees === 'string') {
      try {
        item.donnees = JSON.parse(item.donnees);
      } catch (e) {
        // Garder comme string si erreur
      }
    }

    if (item.id) {
      exercices.push(item);
    }
  }

  return { success: true, data: exercices };
}

/**
 * Récupère un exercice avec son format
 * @param {Object} data - { id }
 */
function getExercice(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Récupérer l'exercice
  const exoSheet = ss.getSheetByName(SHEETS.EXERCICES);
  const exoData = exoSheet.getDataRange().getValues();
  const exoHeaders = exoData[0].map(h => String(h).toLowerCase().trim());

  let exercice = null;
  for (let i = 1; i < exoData.length; i++) {
    const row = exoData[i];
    const idCol = exoHeaders.indexOf('id');
    if (String(row[idCol]).trim() === String(data.id).trim()) {
      exercice = {};
      exoHeaders.forEach((header, index) => {
        exercice[header] = row[index];
      });
      break;
    }
  }

  if (!exercice) {
    return { success: false, error: 'Exercice non trouvé' };
  }

  // Parser le JSON des données
  if (exercice.donnees && typeof exercice.donnees === 'string') {
    try {
      exercice.donnees = JSON.parse(exercice.donnees);
    } catch (e) {
      // Garder comme string si erreur
    }
  }

  // 2. Récupérer le format associé
  if (exercice.format_id) {
    const formatSheet = ss.getSheetByName(SHEETS.FORMATS_EXERCICES);
    const formatData = formatSheet.getDataRange().getValues();
    const formatHeaders = formatData[0].map(h => String(h).toLowerCase().trim());

    for (let i = 1; i < formatData.length; i++) {
      const row = formatData[i];
      const idCol = formatHeaders.indexOf('id');
      if (String(row[idCol]).trim() === String(exercice.format_id).trim()) {
        exercice.format = {};
        formatHeaders.forEach((header, index) => {
          exercice.format[header] = row[index];
        });
        // Parser la structure JSON
        if (exercice.format.structure && typeof exercice.format.structure === 'string') {
          try {
            exercice.format.structure = JSON.parse(exercice.format.structure);
          } catch (e) {}
        }
        break;
      }
    }
  }

  // 3. Récupérer la banque associée
  if (exercice.banque_id) {
    const banqueSheet = ss.getSheetByName(SHEETS.BANQUES_EXERCICES);
    const banqueData = banqueSheet.getDataRange().getValues();
    const banqueHeaders = banqueData[0].map(h => String(h).toLowerCase().trim());

    for (let i = 1; i < banqueData.length; i++) {
      const row = banqueData[i];
      const idCol = banqueHeaders.indexOf('id');
      if (String(row[idCol]).trim() === String(exercice.banque_id).trim()) {
        exercice.banque = {};
        banqueHeaders.forEach((header, index) => {
          exercice.banque[header] = row[index];
        });
        break;
      }
    }
  }

  return { success: true, data: exercice };
}

/**
 * Crée un nouvel exercice
 * @param {Object} data - { banque_id, format_id, numero, titre, consigne?, duree?, donnees, peut_tomber_en_eval?, statut? }
 */
function createExercice(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);

  if (!data.banque_id || !data.format_id) {
    return { success: false, error: 'banque_id et format_id requis' };
  }

  const id = 'exo_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'statut') return data.statut || 'brouillon';
    if (col === 'peut_tomber_en_eval') return data.peut_tomber_en_eval !== undefined ? data.peut_tomber_en_eval : true;
    if (col === 'duree') return data.duree || 10;
    if (col === 'numero') return data.numero || 1;
    if (col === 'donnees' && typeof data.donnees === 'object') {
      return JSON.stringify(data.donnees);
    }
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Exercice créé' };
}

/**
 * Met à jour un exercice
 * @param {Object} data - { id, ...fields }
 */
function updateExercice(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Exercice non trouvé' };
  }

  const updates = ['banque_id', 'format_id', 'numero', 'titre', 'consigne', 'duree', 'donnees', 'peut_tomber_en_eval', 'statut'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        let value = data[col];
        if (col === 'donnees' && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        sheet.getRange(rowIndex, colIndex + 1).setValue(value);
      }
    }
  });

  return { success: true, message: 'Exercice mis à jour' };
}

/**
 * Supprime un exercice
 * @param {Object} data - { id }
 */
function deleteExercice(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Exercice supprimé' };
    }
  }

  return { success: false, error: 'Exercice non trouvé' };
}

// ========================================
// FONCTIONS RESULTATS EXERCICES
// ========================================

/**
 * Récupère les résultats d'un élève
 * @param {Object} data - { eleve_id }
 */
function getResultatsEleve(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const sheetName = SHEETS.RESULTATS_EXERCICES;
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['id', 'eleve_id', 'exercice_id', 'banque_id', 'score', 'bonnes_reponses', 'total_questions', 'temps_passe', 'date']);
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const eleveIdCol = headers.indexOf('eleve_id');

  const results = [];
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      const row = {};
      headers.forEach((header, colIndex) => {
        row[header] = allData[i][colIndex];
      });
      results.push(row);
    }
  }

  return { success: true, data: results };
}

/**
 * Enregistre un résultat d'exercice
 * @param {Object} data - { eleve_id, exercice_id, banque_id, score, bonnes_reponses, total_questions, temps_passe, date }
 */
function saveResultatExercice(data) {
  if (!data.eleve_id || !data.exercice_id) {
    return { success: false, error: 'eleve_id et exercice_id requis' };
  }

  const sheetName = SHEETS.RESULTATS_EXERCICES;
  let sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['id', 'eleve_id', 'exercice_id', 'banque_id', 'score', 'bonnes_reponses', 'total_questions', 'temps_passe', 'date']);
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  const eleveIdCol = headers.indexOf('eleve_id');
  const exerciceIdCol = headers.indexOf('exercice_id');
  const scoreCol = headers.indexOf('score');

  // Check if result already exists for this student + exercise
  let existingRowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][exerciceIdCol]).trim() === String(data.exercice_id).trim()) {
      existingRowIndex = i + 1; // +1 because sheets are 1-indexed
      break;
    }
  }

  const id = existingRowIndex > 0
    ? allData[existingRowIndex - 1][headers.indexOf('id')]
    : 'res_' + new Date().getTime();

  const rowData = [
    id,
    data.eleve_id,
    data.exercice_id,
    data.banque_id || '',
    data.score || 0,
    data.bonnes_reponses || 0,
    data.total_questions || 0,
    data.temps_passe || 0,
    data.date || new Date().toISOString()
  ];

  if (existingRowIndex > 0) {
    // Check if new score is better
    const existingScore = Number(allData[existingRowIndex - 1][scoreCol]) || 0;
    if (data.score > existingScore) {
      // Update existing row with better score
      const range = sheet.getRange(existingRowIndex, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true, message: 'Résultat mis à jour (meilleur score)', id: id };
    } else {
      return { success: true, message: 'Score précédent conservé (meilleur)', id: id };
    }
  } else {
    // Insert new row
    sheet.appendRow(rowData);
    return { success: true, message: 'Résultat enregistré', id: id };
  }
}

// ========================================
// HISTORIQUE PRATIQUES SAVOIR-FAIRE
// ========================================

/**
 * Enregistre une pratique d'exercice SF (historique complet)
 * Système 4 répétitions avec espacements
 * @param {Object} data - { eleve_id, exercice_id, banque_id, score, temps_passe, temps_prevu, repetition_numero, est_entrainement_libre }
 */
function savePratiqueSF(data) {
  if (!data.eleve_id || !data.exercice_id) {
    return { success: false, error: 'eleve_id et exercice_id requis' };
  }

  const sheetName = SHEETS.HISTORIQUE_PRATIQUES_SF;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);
  let sheetCreated = false;

  // Créer la feuille si elle n'existe pas (avec nouvelles colonnes)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'id', 'eleve_id', 'exercice_id', 'banque_id', 'score', 'est_parfait',
      'temps_passe', 'temps_prevu', 'date',
      'repetition_numero', 'dans_temps', 'est_entrainement_libre'
    ]);
    sheetCreated = true;
  }

  // Vérifier/ajouter les nouvelles colonnes si elles n'existent pas
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headersLower = headers.map(h => String(h).toLowerCase().trim());

  const newCols = ['repetition_numero', 'dans_temps', 'est_entrainement_libre'];
  newCols.forEach(col => {
    if (!headersLower.includes(col)) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
    }
  });

  const id = 'prat_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
  const score = Number(data.score) || 0;
  const estParfait = score === 100 ? 'TRUE' : 'FALSE';
  const dateNow = new Date().toISOString();
  const tempsPasse = Number(data.temps_passe) || 0;
  const tempsPrevu = Number(data.temps_prevu) || 0;
  const dansTemps = tempsPasse <= tempsPrevu ? 'TRUE' : 'FALSE';

  // Récupérer les headers actuels (après ajout éventuel)
  const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rowData = updatedHeaders.map(header => {
    const col = String(header).toLowerCase().trim();
    switch(col) {
      case 'id': return id;
      case 'eleve_id': return data.eleve_id;
      case 'exercice_id': return data.exercice_id;
      case 'banque_id': return data.banque_id || '';
      case 'score': return score;
      case 'est_parfait': return estParfait;
      case 'temps_passe': return tempsPasse;
      case 'temps_prevu': return tempsPrevu;
      case 'date': return dateNow;
      case 'repetition_numero': return data.repetition_numero || 0;
      case 'dans_temps': return dansTemps;
      case 'est_entrainement_libre':
        // Gérer les cas où false arrive comme string "false" via JSONP
        const estLibre = data.est_entrainement_libre;
        if (estLibre === false || estLibre === 'false' || estLibre === 'FALSE' || estLibre === 0 || estLibre === '0' || !estLibre) {
          return 'FALSE';
        }
        return 'TRUE';
      default: return '';
    }
  });

  // Toujours ajouter une nouvelle ligne (historique)
  sheet.appendRow(rowData);

  // Retourner des infos de debug
  const rowCount = sheet.getLastRow();

  return {
    success: true,
    message: 'Pratique enregistrée',
    id: id,
    est_parfait: score === 100,
    dans_temps: tempsPasse <= tempsPrevu,
    repetition_numero: data.repetition_numero || 0,
    debug: {
      sheetName: sheetName,
      sheetCreated: sheetCreated,
      rowCount: rowCount,
      spreadsheetId: SPREADSHEET_ID
    }
  };
}

/**
 * Récupère l'historique des pratiques SF d'un élève avec calcul des répétitions
 * Système 4 répétitions avec espacements progressifs
 * @param {Object} data - { eleve_id, exercice_id?, banque_id? }
 */
function getHistoriquePratiquesSF(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const sheetName = SHEETS.HISTORIQUE_PRATIQUES_SF;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);

  if (!sheet) {
    return { success: true, data: [], stats: {}, debug: { sheetExists: false, sheetName: sheetName } };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [], stats: {}, debug: { sheetExists: true, rowCount: allData.length, message: 'No data rows' } };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const eleveIdCol = headers.indexOf('eleve_id');
  const exerciceIdCol = headers.indexOf('exercice_id');
  const banqueIdCol = headers.indexOf('banque_id');
  const scoreCol = headers.indexOf('score');
  const estParfaitCol = headers.indexOf('est_parfait');
  const tempsPasseCol = headers.indexOf('temps_passe');
  const tempsPrevuCol = headers.indexOf('temps_prevu');
  const dateCol = headers.indexOf('date');
  const repetitionNumeroCol = headers.indexOf('repetition_numero');
  const dansTempsCol = headers.indexOf('dans_temps');
  const estEntrainementLibreCol = headers.indexOf('est_entrainement_libre');

  // Espacements en jours selon la répétition validée
  // Index = répétition actuelle, valeur = jours avant prochaine
  const ESPACEMENTS = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14 };
  const SEUIL_REPETITIONS = 5; // 5 répétitions pour maîtriser
  const SEUIL_RAPPEL = 21; // Jours pour rappel suggéré après maîtrise

  const results = [];
  const statsParExercice = {};

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];

    // Filtrer par eleve_id
    if (String(row[eleveIdCol]).trim() !== String(data.eleve_id).trim()) continue;

    // Filtrer par exercice_id si spécifié
    if (data.exercice_id && String(row[exerciceIdCol]).trim() !== String(data.exercice_id).trim()) continue;

    // Filtrer par banque_id si spécifié
    if (data.banque_id && String(row[banqueIdCol]).trim() !== String(data.banque_id).trim()) continue;

    const pratique = {};
    headers.forEach((header, colIndex) => {
      pratique[header] = row[colIndex];
    });
    results.push(pratique);

    // Calculer les stats par exercice
    const exoId = String(row[exerciceIdCol]).trim();
    if (!statsParExercice[exoId]) {
      statsParExercice[exoId] = {
        exercice_id: exoId,
        banque_id: row[banqueIdCol],
        total_pratiques: 0,
        pratiques_parfaites: 0,
        repetitions_validees: 0,
        derniere_pratique: null,
        date_derniere_validation: null,
        prochaine_disponible: null,
        temps_moyen: 0,
        temps_prevu: row[tempsPrevuCol] || 0,
        temps_total: 0,
        est_maitrise: false
      };
    }

    const stats = statsParExercice[exoId];
    stats.total_pratiques++;

    const estParfait = String(row[estParfaitCol]).toUpperCase() === 'TRUE' || row[scoreCol] === 100;
    const estEntrainementLibre = estEntrainementLibreCol >= 0 &&
      String(row[estEntrainementLibreCol]).toUpperCase() === 'TRUE';

    if (estParfait) {
      stats.pratiques_parfaites++;
    }

    // Compter les répétitions validées (ignorer entraînements libres)
    if (!estEntrainementLibre && repetitionNumeroCol >= 0) {
      const repNum = parseInt(row[repetitionNumeroCol]) || 0;
      if (repNum > 0 && repNum > stats.repetitions_validees) {
        stats.repetitions_validees = repNum;
        stats.date_derniere_validation = row[dateCol];
      }
    }

    stats.temps_total += Number(row[tempsPasseCol]) || 0;

    // Mettre à jour la dernière pratique
    const dateStr = row[dateCol];
    if (!stats.derniere_pratique || dateStr > stats.derniere_pratique) {
      stats.derniere_pratique = dateStr;
    }
  }

  // Calculer les infos dérivées pour chaque exercice
  const now = new Date();
  Object.values(statsParExercice).forEach(stats => {
    // Temps moyen
    if (stats.total_pratiques > 0) {
      stats.temps_moyen = Math.round(stats.temps_total / stats.total_pratiques);
    }
    delete stats.temps_total;

    // Maîtrise = 5 répétitions validées
    stats.est_maitrise = stats.repetitions_validees >= SEUIL_REPETITIONS;

    // Calculer prochaine disponibilité
    if (stats.repetitions_validees > 0 && stats.repetitions_validees < SEUIL_REPETITIONS && stats.date_derniere_validation) {
      const dateValidation = new Date(stats.date_derniere_validation);
      const espacementJours = ESPACEMENTS[stats.repetitions_validees] || 7;
      const prochaineDate = new Date(dateValidation);
      prochaineDate.setDate(prochaineDate.getDate() + espacementJours);
      stats.prochaine_disponible = prochaineDate.toISOString();

      // Calculer jours restants
      const diffMs = prochaineDate - now;
      stats.jours_restants = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      stats.est_disponible = now >= prochaineDate;
    } else if (stats.repetitions_validees === 0) {
      // Jamais validé = disponible
      stats.est_disponible = true;
      stats.jours_restants = 0;
    } else if (stats.est_maitrise) {
      // Maîtrisé = toujours disponible (pour rappel)
      stats.est_disponible = true;
      stats.jours_restants = 0;

      // Vérifier si rappel suggéré (>21 jours depuis dernière validation)
      if (stats.date_derniere_validation) {
        const dateValidation = new Date(stats.date_derniere_validation);
        const joursDepuis = Math.floor((now - dateValidation) / (1000 * 60 * 60 * 24));
        stats.jours_depuis_validation = joursDepuis;
        stats.rappel_suggere = joursDepuis >= SEUIL_RAPPEL;
      }
    }
  });

  // ========== OPTION B: Calculer les stats par BANQUE ==========
  const statsParBanque = {};
  Object.entries(statsParExercice).forEach(([exoId, exoStats]) => {
    const banqueId = String(exoStats.banque_id);
    if (!banqueId) return;

    if (!statsParBanque[banqueId]) {
      statsParBanque[banqueId] = {
        banque_id: banqueId,
        repetitions_validees: 0,
        exercices_reussis: [],
        date_derniere_validation: null,
        total_pratiques: 0
      };
    }

    const sb = statsParBanque[banqueId];
    sb.total_pratiques += (exoStats.total_pratiques || 0);

    // Si l'exercice a au moins 1 rep validée, l'ajouter aux réussis
    if (exoStats.repetitions_validees > 0) {
      if (!sb.exercices_reussis.includes(exoId)) {
        sb.exercices_reussis.push(exoId);
      }
      // Le niveau de la banque = niveau max atteint parmi tous les exercices (pas le nb d'exercices)
      if (exoStats.repetitions_validees > sb.repetitions_validees) {
        sb.repetitions_validees = exoStats.repetitions_validees;
        // Date de dernière validation = celle de la pratique qui a atteint ce niveau
        sb.date_derniere_validation = exoStats.date_derniere_validation;
      }
    }
  });

  // Calculer les infos dérivées pour chaque banque
  Object.values(statsParBanque).forEach(sb => {
    sb.est_maitrise = sb.repetitions_validees >= SEUIL_REPETITIONS;

    // Calculer prochaine disponibilité si pas maîtrisée
    if (sb.repetitions_validees > 0 && sb.repetitions_validees < SEUIL_REPETITIONS && sb.date_derniere_validation) {
      const dateValidation = new Date(sb.date_derniere_validation);
      const espacementJours = ESPACEMENTS[sb.repetitions_validees] || 7;
      const prochaineDate = new Date(dateValidation);
      prochaineDate.setDate(prochaineDate.getDate() + espacementJours);
      sb.prochaine_disponible = prochaineDate.toISOString();

      const diffMs = prochaineDate - now;
      sb.jours_restants = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      sb.est_disponible = now >= prochaineDate;
    } else if (sb.repetitions_validees === 0) {
      sb.est_disponible = true;
      sb.jours_restants = 0;
    } else if (sb.est_maitrise) {
      sb.est_disponible = true;
      sb.jours_restants = 0;

      // Rappel suggéré si >21 jours
      if (sb.date_derniere_validation) {
        const dateValidation = new Date(sb.date_derniere_validation);
        const joursDepuis = Math.floor((now - dateValidation) / (1000 * 60 * 60 * 24));
        sb.jours_depuis_validation = joursDepuis;
        sb.rappel_suggere = joursDepuis >= SEUIL_RAPPEL;
      }
    }
  });

  return {
    success: true,
    data: results,
    stats: statsParExercice,
    statsBanque: statsParBanque,  // OPTION B: stats par banque
    debug: {
      sheetExists: true,
      totalRows: allData.length,
      filteredRows: results.length,
      exerciceCount: Object.keys(statsParExercice).length,
      banqueCount: Object.keys(statsParBanque).length,
      eleve_id: data.eleve_id
    }
  };
}

// ================================================================
// FILE: FAQ.gs
// ================================================================

// ========================================
// FONCTIONS CATEGORIES FAQ
// ========================================

/**
 * Crée une nouvelle catégorie FAQ
 * @param {Object} data - { nom, icone, ordre }
 */
function createCategorieFAQ(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CATEGORIES_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet CATEGORIES_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.nom) {
    return { success: false, error: 'Le nom de la catégorie est requis' };
  }

  // Générer un ID unique
  const id = catData.id || 'cat_faq_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (catData[colName] !== undefined) {
      newRow[index] = catData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Catégorie FAQ créée avec succès'
  };
}

/**
 * Met à jour une catégorie FAQ
 * @param {Object} data - { id, nom?, icone?, ordre? }
 */
function updateCategorieFAQ(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CATEGORIES_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet CATEGORIES_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === catData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Catégorie FAQ non trouvée: ' + catData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['nom', 'icone', 'couleur', 'ordre'];
  updates.forEach(col => {
    if (catData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(catData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Catégorie FAQ modifiée avec succès'
  };
}

/**
 * Supprime une catégorie FAQ
 * @param {Object} data - { id }
 */
function deleteCategorieFAQ(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CATEGORIES_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet CATEGORIES_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === catData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Catégorie FAQ non trouvée: ' + catData.id };
  }

  // Retirer cette catégorie des questions qui l'utilisent
  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS_FAQ);
  if (questionsSheet) {
    const questionsData = questionsSheet.getDataRange().getValues();
    const questionsHeaders = questionsData[0];
    const catIdCol = questionsHeaders.indexOf('categorie_id');
    const categoriesCol = questionsHeaders.indexOf('categories');

    // Parcourir les questions et retirer la catégorie
    for (let i = 1; i < questionsData.length; i++) {
      let updated = false;

      // Nettoyer categorie_id si c'est cette catégorie
      if (catIdCol >= 0 && questionsData[i][catIdCol] === catData.id) {
        questionsSheet.getRange(i + 1, catIdCol + 1).setValue('');
        updated = true;
      }

      // Nettoyer la colonne categories (multi-catégories)
      if (categoriesCol >= 0 && questionsData[i][categoriesCol]) {
        const categoryIds = String(questionsData[i][categoriesCol]).split(',').map(id => id.trim());
        const filteredIds = categoryIds.filter(id => id !== catData.id);
        if (filteredIds.length !== categoryIds.length) {
          questionsSheet.getRange(i + 1, categoriesCol + 1).setValue(filteredIds.join(','));
        }
      }
    }
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Catégorie FAQ supprimée avec succès'
  };
}

// ========================================
// FONCTIONS QUESTIONS FAQ
// ========================================

/**
 * Crée une nouvelle question FAQ
 * @param {Object} data - { categorie_id, question, reponse, ordre }
 */
function createQuestionFAQ(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet QUESTIONS_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let qData = data;
  if (typeof data.data === 'string') {
    qData = JSON.parse(data.data);
  } else if (data.data) {
    qData = data.data;
  }

  // Validation: question requise, et soit réponse texte, soit vidéo URL selon le type
  if (!qData.question) {
    return { success: false, error: 'La question est requise' };
  }

  const typeReponse = qData.type_reponse || 'texte';
  if ((typeReponse === 'texte' || typeReponse === 'mixte') && !qData.reponse) {
    return { success: false, error: 'La réponse texte est requise pour ce type de question' };
  }
  if ((typeReponse === 'video' || typeReponse === 'mixte') && !qData.video_url) {
    return { success: false, error: 'L\'URL vidéo est requise pour ce type de question' };
  }

  // Générer un ID unique
  const id = qData.id || 'faq_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (qData[colName] !== undefined) {
      newRow[index] = qData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Question FAQ créée avec succès'
  };
}

/**
 * Met à jour une question FAQ
 * @param {Object} data - { id, categorie_id?, question?, reponse?, ordre? }
 */
function updateQuestionFAQ(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet QUESTIONS_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let qData = data;
  if (typeof data.data === 'string') {
    qData = JSON.parse(data.data);
  } else if (data.data) {
    qData = data.data;
  }

  if (!qData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === qData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Question FAQ non trouvée: ' + qData.id };
  }

  // Mettre à jour les colonnes spécifiées (including categories for multi-category support)
  const updates = ['categorie_id', 'categories', 'question', 'reponse', 'type_reponse', 'video_url', 'ordre'];
  updates.forEach(col => {
    if (qData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(qData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Question FAQ modifiée avec succès'
  };
}

/**
 * Supprime une question FAQ
 * @param {Object} data - { id }
 */
function deleteQuestionFAQ(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_FAQ);

  if (!sheet) {
    return { success: false, error: 'Onglet QUESTIONS_FAQ non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let qData = data;
  if (typeof data.data === 'string') {
    qData = JSON.parse(data.data);
  } else if (data.data) {
    qData = data.data;
  }

  if (!qData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === qData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Question FAQ non trouvée: ' + qData.id };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Question FAQ supprimée avec succès'
  };
}

// ================================================================
// FILE: Methodologie.gs
// ================================================================

// ========================================
// FONCTIONS METHODOLOGIE CATEGORIES
// ========================================

/**
 * Crée une nouvelle catégorie méthodologie
 * @param {Object} data - { nom, icon, couleur, description, ordre }
 */
function createMethodologieCategorie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_CATEGORIES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_CATEGORIES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.nom) {
    return { success: false, error: 'Le nom de la catégorie est requis' };
  }

  // Générer un ID unique
  const id = catData.id || 'meth_cat_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (catData[colName] !== undefined) {
      newRow[index] = catData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Catégorie méthodologie créée avec succès'
  };
}

/**
 * Met à jour une catégorie méthodologie
 * @param {Object} data - { id, nom?, icon?, couleur?, description?, ordre? }
 */
function updateMethodologieCategorie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_CATEGORIES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_CATEGORIES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === catData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Catégorie méthodologie non trouvée: ' + catData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['nom', 'icon', 'couleur', 'description', 'ordre'];
  updates.forEach(col => {
    if (catData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(catData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Catégorie méthodologie modifiée avec succès'
  };
}

/**
 * Supprime une catégorie méthodologie
 * @param {Object} data - { id }
 */
function deleteMethodologieCategorie(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.METHODOLOGIE_CATEGORIES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_CATEGORIES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let catData = data;
  if (typeof data.data === 'string') {
    catData = JSON.parse(data.data);
  } else if (data.data) {
    catData = data.data;
  }

  if (!catData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === catData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Catégorie méthodologie non trouvée: ' + catData.id };
  }

  // Supprimer les compétences liées (cascade)
  const compSheet = ss.getSheetByName(SHEETS.METHODOLOGIE_COMPETENCES);
  if (compSheet) {
    const compData = compSheet.getDataRange().getValues();
    const compHeaders = compData[0];
    const catIdCol = compHeaders.indexOf('categorie_id');
    const compIdCol = compHeaders.indexOf('id');

    // Récupérer les IDs des compétences à supprimer
    const compIds = [];
    for (let i = compData.length - 1; i >= 1; i--) {
      if (compData[i][catIdCol] === catData.id) {
        compIds.push(compData[i][compIdCol]);
        compSheet.deleteRow(i + 1);
      }
    }

    // Supprimer les étapes liées aux compétences supprimées
    const etapeSheet = ss.getSheetByName(SHEETS.METHODOLOGIE_ETAPES);
    if (etapeSheet && compIds.length > 0) {
      const etapeData = etapeSheet.getDataRange().getValues();
      const etapeHeaders = etapeData[0];
      const compIdColEtape = etapeHeaders.indexOf('competence_id');

      for (let i = etapeData.length - 1; i >= 1; i--) {
        if (compIds.includes(etapeData[i][compIdColEtape])) {
          etapeSheet.deleteRow(i + 1);
        }
      }
    }
  }

  // Supprimer la catégorie
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Catégorie méthodologie supprimée avec succès (avec ses compétences et étapes)'
  };
}

// ========================================
// FONCTIONS METHODOLOGIE COMPETENCES
// ========================================

/**
 * Crée une nouvelle compétence méthodologie
 * @param {Object} data - { categorie_id, titre, icon, description, ordre }
 */
function createMethodologieCompetence(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_COMPETENCES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_COMPETENCES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let compData = data;
  if (typeof data.data === 'string') {
    compData = JSON.parse(data.data);
  } else if (data.data) {
    compData = data.data;
  }

  if (!compData.categorie_id || !compData.titre) {
    return { success: false, error: 'categorie_id et titre sont requis' };
  }

  // Générer un ID unique
  const id = compData.id || 'meth_comp_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (compData[colName] !== undefined) {
      newRow[index] = compData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Compétence méthodologie créée avec succès'
  };
}

/**
 * Met à jour une compétence méthodologie
 * @param {Object} data - { id, categorie_id?, titre?, icon?, description?, ordre? }
 */
function updateMethodologieCompetence(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_COMPETENCES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_COMPETENCES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let compData = data;
  if (typeof data.data === 'string') {
    compData = JSON.parse(data.data);
  } else if (data.data) {
    compData = data.data;
  }

  if (!compData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === compData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Compétence méthodologie non trouvée: ' + compData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['categorie_id', 'titre', 'icon', 'description', 'ordre'];
  updates.forEach(col => {
    if (compData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(compData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Compétence méthodologie modifiée avec succès'
  };
}

/**
 * Supprime une compétence méthodologie
 * @param {Object} data - { id }
 */
function deleteMethodologieCompetence(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.METHODOLOGIE_COMPETENCES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_COMPETENCES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let compData = data;
  if (typeof data.data === 'string') {
    compData = JSON.parse(data.data);
  } else if (data.data) {
    compData = data.data;
  }

  if (!compData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === compData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Compétence méthodologie non trouvée: ' + compData.id };
  }

  // Supprimer les étapes liées (cascade)
  const etapeSheet = ss.getSheetByName(SHEETS.METHODOLOGIE_ETAPES);
  if (etapeSheet) {
    const etapeData = etapeSheet.getDataRange().getValues();
    const etapeHeaders = etapeData[0];
    const compIdCol = etapeHeaders.indexOf('competence_id');

    for (let i = etapeData.length - 1; i >= 1; i--) {
      if (etapeData[i][compIdCol] === compData.id) {
        etapeSheet.deleteRow(i + 1);
      }
    }
  }

  // Supprimer la compétence
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Compétence méthodologie supprimée avec succès (avec ses étapes)'
  };
}

// ========================================
// FONCTIONS METHODOLOGIE ETAPES
// ========================================

/**
 * Crée une nouvelle étape méthodologie
 * @param {Object} data - { competence_id, niveau, niveau_titre, ordre, titre, video_url, documents, contenu_html, bex_id, bex_titre }
 */
function createMethodologieEtape(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_ETAPES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_ETAPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let etapeData = data;
  if (typeof data.data === 'string') {
    etapeData = JSON.parse(data.data);
  } else if (data.data) {
    etapeData = data.data;
  }

  if (!etapeData.competence_id || !etapeData.titre) {
    return { success: false, error: 'competence_id et titre sont requis' };
  }

  // Générer un ID unique
  const id = etapeData.id || 'meth_etape_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (etapeData[colName] !== undefined) {
      newRow[index] = etapeData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Étape méthodologie créée avec succès'
  };
}

/**
 * Met à jour une étape méthodologie
 * @param {Object} data - { id, competence_id?, niveau?, niveau_titre?, ordre?, titre?, video_url?, documents?, contenu_html?, bex_id?, bex_titre? }
 */
function updateMethodologieEtape(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_ETAPES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_ETAPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let etapeData = data;
  if (typeof data.data === 'string') {
    etapeData = JSON.parse(data.data);
  } else if (data.data) {
    etapeData = data.data;
  }

  if (!etapeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === etapeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Étape méthodologie non trouvée: ' + etapeData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['competence_id', 'niveau', 'niveau_titre', 'ordre', 'titre', 'video_url', 'documents', 'contenu_html', 'bex_id', 'bex_titre'];
  updates.forEach(col => {
    if (etapeData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(etapeData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Étape méthodologie modifiée avec succès'
  };
}

/**
 * Supprime une étape méthodologie
 * @param {Object} data - { id }
 */
function deleteMethodologieEtape(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE_ETAPES);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE_ETAPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let etapeData = data;
  if (typeof data.data === 'string') {
    etapeData = JSON.parse(data.data);
  } else if (data.data) {
    etapeData = data.data;
  }

  if (!etapeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === etapeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Étape méthodologie non trouvée: ' + etapeData.id };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Étape méthodologie supprimée avec succès'
  };
}

// ========================================
// FONCTIONS PROGRESSION METHODOLOGIE
// ========================================

/**
 * Ajoute une progression méthodologie (marquer une étape comme terminée)
 * @param {Object} data - { eleve_id, etape_id }
 */
function addProgressionMethodologie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRESSION_METHODOLOGIE);

  if (!sheet) {
    return { success: false, error: 'Onglet PROGRESSION_METHODOLOGIE non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let progData = data;
  if (typeof data.data === 'string') {
    progData = JSON.parse(data.data);
  } else if (data.data) {
    progData = data.data;
  }

  // Le client peut envoyer item_id ou etape_id
  const itemId = progData.item_id || progData.etape_id;

  if (!progData.eleve_id || !itemId) {
    return { success: false, error: 'eleve_id et item_id sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Vérifier si cette progression existe déjà (chercher item_id ou etape_id selon la colonne présente)
  const eleveIdCol = findColumnIndex(headers, 'eleve_id');
  const itemIdCol = findColumnIndex(headers, 'item_id') >= 0 ? findColumnIndex(headers, 'item_id') : findColumnIndex(headers, 'etape_id');

  if (eleveIdCol >= 0 && itemIdCol >= 0) {
    const exists = allData.slice(1).some(row =>
      row[eleveIdCol] === progData.eleve_id && row[itemIdCol] === itemId
    );
    if (exists) {
      return { success: true, message: 'Progression déjà enregistrée' };
    }
  }

  // Ajouter la progression
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = String(header).toLowerCase().trim();
    if (colName === 'eleve_id') {
      newRow[index] = progData.eleve_id;
    } else if (colName === 'item_id' || colName === 'etape_id') {
      newRow[index] = itemId;
    } else if (colName === 'completed') {
      newRow[index] = 'TRUE';
    } else if (colName === 'date') {
      newRow[index] = new Date().toISOString().split('T')[0];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'Progression enregistrée avec succès'
  };
}

// ========================================
// NOUVELLE METHODOLOGIE (table unique avec tree flexible)
// ========================================

/**
 * Crée un nouvel élément méthodologie
 * @param {Object} data - { titre, parent_id, icon, couleur, description, ordre, type_contenu, video_url, fiche_url, bex_bank, competence_bank }
 */
function createMethodologie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE non trouvé' };
  }

  // Parse les données
  const itemData = parseRequestData(data);

  if (!itemData.titre) {
    return { success: false, error: 'Le titre est requis' };
  }

  // Générer un ID unique
  const id = itemData.id || 'meth_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = String(header).toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (itemData[colName] !== undefined) {
      newRow[index] = itemData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Élément méthodologie créé avec succès'
  };
}

/**
 * Met à jour un élément méthodologie
 * @param {Object} data - { id, titre?, parent_id?, icon?, couleur?, description?, ordre?, type_contenu?, video_url?, fiche_url?, bex_bank?, competence_bank?, ressources? }
 */
function updateMethodologie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE non trouvé' };
  }

  // Parse les données
  const itemData = parseRequestData(data);

  // Valider l'ID
  if (!isValidId(itemData.id)) {
    return { success: false, error: 'ID invalide ou manquant: ' + itemData.id };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la colonne ID (insensible à la casse)
  const idCol = findColumnIndex(headers, 'id');

  if (idCol === -1) {
    return { success: false, error: 'Colonne ID non trouvée dans METHODOLOGIE' };
  }

  // Trouver la ligne avec cet ID
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(itemData.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Élément méthodologie non trouvé: ' + itemData.id };
  }

  // Mettre à jour les colonnes spécifiées (incluant les nouveaux champs)
  const updates = ['titre', 'parent_id', 'icon', 'couleur', 'description', 'ordre', 'type_contenu', 'video_url', 'fiche_url', 'bex_bank', 'competence_bank', 'ressources', 'image_url', 'duree_estimee'];
  updates.forEach(col => {
    if (itemData[col] !== undefined) {
      const colIndex = findColumnIndex(headers, col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(itemData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Élément méthodologie modifié avec succès'
  };
}

/**
 * Supprime un élément méthodologie et tous ses descendants
 * @param {Object} data - { id }
 */
function deleteMethodologie(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.METHODOLOGIE);

  if (!sheet) {
    return { success: false, error: 'Onglet METHODOLOGIE non trouvé' };
  }

  // Parse les données
  const itemData = parseRequestData(data);

  // Valider l'ID
  if (!isValidId(itemData.id)) {
    return { success: false, error: 'ID invalide ou manquant: ' + itemData.id };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la colonne ID (insensible à la casse)
  const idCol = findColumnIndex(headers, 'id');
  const parentIdCol = findColumnIndex(headers, 'parent_id');

  if (idCol === -1) {
    return { success: false, error: 'Colonne ID non trouvée dans METHODOLOGIE' };
  }

  // Collecter tous les IDs à supprimer (l'élément + descendants)
  const idsToDelete = new Set();
  idsToDelete.add(String(itemData.id).trim());

  // Fonction récursive pour trouver les descendants
  function addDescendants(parentId) {
    for (let i = 1; i < allData.length; i++) {
      const rowParentId = parentIdCol >= 0 ? String(allData[i][parentIdCol]).trim() : '';
      const rowId = String(allData[i][idCol]).trim();
      if (rowParentId === parentId && !idsToDelete.has(rowId)) {
        idsToDelete.add(rowId);
        addDescendants(rowId);
      }
    }
  }

  addDescendants(String(itemData.id).trim());

  // Supprimer les lignes (en partant de la fin pour éviter les problèmes d'index)
  let deletedCount = 0;
  for (let i = allData.length - 1; i >= 1; i--) {
    const rowId = String(allData[i][idCol]).trim();
    if (idsToDelete.has(rowId)) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return {
    success: true,
    message: `${deletedCount} élément(s) méthodologie supprimé(s)`,
    deleted: deletedCount
  };
}

// ========================================
// PROGRESSION LECONS
// ========================================

/**
 * Ajoute une progression de leçon (marquer un chapitre comme terminé)
 * @param {Object} data - { eleve_id, chapitre_id }
 */
function addProgressionLecons(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRESSION_LECONS);

  if (!sheet) {
    return { success: false, error: 'Onglet PROGRESSION_LECONS non trouvé' };
  }

  // Parse les données
  const progData = parseRequestData(data);

  if (!isValidId(progData.eleve_id) || !isValidId(progData.chapitre_id)) {
    return { success: false, error: 'eleve_id et chapitre_id sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Vérifier si cette progression existe déjà
  const eleveIdCol = findColumnIndex(headers, 'eleve_id');
  const chapitreIdCol = findColumnIndex(headers, 'chapitre_id');

  if (eleveIdCol >= 0 && chapitreIdCol >= 0) {
    const exists = allData.slice(1).some(row =>
      String(row[eleveIdCol]).trim() === String(progData.eleve_id).trim() &&
      String(row[chapitreIdCol]).trim() === String(progData.chapitre_id).trim()
    );
    if (exists) {
      return { success: true, message: 'Progression déjà enregistrée' };
    }
  }

  // Ajouter la progression
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = String(header).toLowerCase().trim();
    if (colName === 'eleve_id') {
      newRow[index] = progData.eleve_id;
    } else if (colName === 'chapitre_id') {
      newRow[index] = progData.chapitre_id;
    } else if (colName === 'completed') {
      newRow[index] = 'TRUE';
    } else if (colName === 'date') {
      newRow[index] = new Date().toISOString().split('T')[0];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    message: 'Progression leçon enregistrée avec succès'
  };
}

// ================================================================
// FILE: Parametres.gs
// ================================================================

// ========================================
// FONCTIONS PARAMETRES
// ========================================

/**
 * Met à jour les paramètres du site
 * @param {Object} data - { data: JSON string of params array }
 */
function updateParametres(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PARAMETRES);

  if (!sheet) {
    return { success: false, error: 'Onglet PARAMETRES non trouvé' };
  }

  // Parse les données si elles sont en string
  let params;
  if (typeof data.data === 'string') {
    params = JSON.parse(data.data);
  } else {
    params = data.data || [];
  }

  if (!Array.isArray(params) || params.length === 0) {
    return { success: false, error: 'Aucun paramètre à mettre à jour' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver les colonnes clé et valeur
  const cleCol = headers.indexOf('cle');
  const valeurCol = headers.indexOf('valeur');

  if (cleCol === -1 || valeurCol === -1) {
    return { success: false, error: 'Colonnes cle/valeur non trouvées dans PARAMETRES' };
  }

  let updated = 0;
  let added = 0;

  params.forEach(param => {
    const key = param.cle;
    const value = param.valeur;

    // Chercher si le paramètre existe
    let rowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][cleCol] === key) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      // Mettre à jour
      sheet.getRange(rowIndex, valeurCol + 1).setValue(value);
      updated++;
    } else {
      // Ajouter une nouvelle ligne
      const newRow = new Array(headers.length).fill('');
      newRow[cleCol] = key;
      newRow[valeurCol] = value;
      sheet.appendRow(newRow);
      added++;
    }
  });

  return {
    success: true,
    message: `${updated} paramètre(s) modifié(s), ${added} ajouté(s)`,
    updated: updated,
    added: added
  };
}

// ========================================
// FONCTIONS CONFIG_MENU
// ========================================

/**
 * Met à jour la configuration du menu élève
 * @param {Object} data - { data: JSON string of menu items array }
 */
function updateMenuConfig(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CONFIG_MENU);

  if (!sheet) {
    return { success: false, error: 'Onglet CONFIG_MENU non trouvé' };
  }

  // Parse les données si elles sont en string
  let menuItems;
  if (typeof data.data === 'string') {
    menuItems = JSON.parse(data.data);
  } else {
    menuItems = data.data || [];
  }

  if (!Array.isArray(menuItems) || menuItems.length === 0) {
    return { success: false, error: 'Aucun élément de menu à mettre à jour' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver les colonnes
  const elementCodeCol = headers.indexOf('element_code');
  const visibleCol = headers.indexOf('visible');
  const bloqueCol = headers.indexOf('bloque');
  const nomAfficheCol = headers.indexOf('nom_affiche');
  const iconCol = headers.indexOf('icon');
  const ordreCol = headers.indexOf('ordre');

  if (elementCodeCol === -1) {
    return { success: false, error: 'Colonne element_code non trouvée dans CONFIG_MENU' };
  }

  let updated = 0;

  menuItems.forEach(item => {
    const elementCode = item.element_code || item.id;

    // Chercher la ligne
    let rowIndex = -1;
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][elementCodeCol] === elementCode) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex > 0) {
      // Mettre à jour les champs
      if (visibleCol >= 0 && item.visible !== undefined) {
        const visibleValue = item.visible === true || item.visible === 'true' || item.visible === 1 ? 'TRUE' : 'FALSE';
        sheet.getRange(rowIndex, visibleCol + 1).setValue(visibleValue);
      }
      if (bloqueCol >= 0 && item.bloque !== undefined) {
        const bloqueValue = item.bloque === true || item.bloque === 'true' || item.bloque === 1 ? 'TRUE' : 'FALSE';
        sheet.getRange(rowIndex, bloqueCol + 1).setValue(bloqueValue);
      }
      if (nomAfficheCol >= 0 && item.nom_affiche !== undefined) {
        sheet.getRange(rowIndex, nomAfficheCol + 1).setValue(item.nom_affiche);
      }
      if (iconCol >= 0 && item.icon !== undefined) {
        sheet.getRange(rowIndex, iconCol + 1).setValue(item.icon);
      }
      if (ordreCol >= 0 && item.ordre !== undefined) {
        sheet.getRange(rowIndex, ordreCol + 1).setValue(item.ordre);
      }
      updated++;
    }
  });

  return {
    success: true,
    message: `${updated} élément(s) de menu modifié(s)`,
    updated: updated
  };
}

// ========================================
// FONCTION DE TEST
// ========================================

/**
 * Fonction de test pour vérifier que le script fonctionne
 */
function testScript() {
  Logger.log('Test du script Brikks');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Spreadsheet ouvert: ' + ss.getName());

  const themesSheet = ss.getSheetByName(SHEETS.THEMES);
  const chapitresSheet = ss.getSheetByName(SHEETS.CHAPITRES);
  const supportsSheet = ss.getSheetByName(SHEETS.SUPPORTS_CHAPITRE);

  Logger.log('Onglet THEMES: ' + (themesSheet ? 'OK' : 'NON TROUVÉ'));
  Logger.log('Onglet CHAPITRES: ' + (chapitresSheet ? 'OK' : 'NON TROUVÉ'));
  Logger.log('Onglet SUPPORTS_CHAPITRE: ' + (supportsSheet ? 'OK' : 'NON TROUVÉ'));

  if (themesSheet) {
    Logger.log('Nombre de lignes THEMES: ' + themesSheet.getLastRow());
  }
  if (chapitresSheet) {
    Logger.log('Nombre de lignes CHAPITRES: ' + chapitresSheet.getLastRow());
  }
  if (supportsSheet) {
    Logger.log('Nombre de lignes SUPPORTS_CHAPITRE: ' + supportsSheet.getLastRow());
  }
}

// ================================================================
// FILE: Themes.gs
// ================================================================

// ========================================
// FONCTIONS THEMES
// ========================================

/**
 * Ajoute un thème
 * @param {Object} data - { discipline_id, nom, ordre }
 */
function addTheme(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.THEMES);

  if (!data.discipline_id || !data.nom) {
    return { success: false, error: 'discipline_id et nom sont requis' };
  }

  // Générer un ID unique
  const id = 'theme_' + new Date().getTime();

  // Trouver l'ordre max si non spécifié
  let ordre = data.ordre;
  if (!ordre) {
    const allData = sheet.getDataRange().getValues();
    const ordreCol = allData[0].indexOf('ordre');
    if (ordreCol >= 0) {
      ordre = Math.max(0, ...allData.slice(1).map(row => parseInt(row[ordreCol]) || 0)) + 1;
    } else {
      ordre = 1;
    }
  }

  // Colonnes : id | discipline_id | nom | ordre
  sheet.appendRow([id, data.discipline_id, data.nom, ordre]);

  return {
    success: true,
    id: id,
    message: 'Thème créé avec succès'
  };
}

/**
 * Modifie un thème
 * @param {Object} data - { id, discipline_id?, nom?, ordre? }
 */
function updateTheme(data) {
  if (!data.id) {
    return { success: false, error: 'id est requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.THEMES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1; // +1 car getRange est 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Thème non trouvé: ' + data.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['discipline_id', 'nom', 'ordre'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Thème modifié avec succès'
  };
}

/**
 * Supprime un thème
 * @param {Object} data - { id }
 */
function deleteTheme(data) {
  if (!data.id) {
    return { success: false, error: 'id est requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.THEMES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Thème non trouvé: ' + data.id };
  }

  // Vérifier s'il y a des chapitres liés
  const chapitresSheet = ss.getSheetByName(SHEETS.CHAPITRES);
  const chapitresData = chapitresSheet.getDataRange().getValues();
  const themeIdCol = chapitresData[0].indexOf('theme_id');

  const hasChapters = chapitresData.slice(1).some(row => row[themeIdCol] === data.id);

  if (hasChapters) {
    return {
      success: false,
      error: 'Impossible de supprimer ce thème car il contient des chapitres. Supprimez d\'abord les chapitres.'
    };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Thème supprimé avec succès'
  };
}

// ========================================
// FONCTIONS CHAPITRES
// ========================================

/**
 * Ajoute un chapitre
 * @param {Object} data - { theme_id, discipline_id, numero, numero_lecon, titre, contenu, contenu_texte, lien, statut }
 */
function addChapter(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CHAPITRES);

  // Un chapitre doit avoir soit un theme_id, soit un discipline_id (cours introductif)
  if (!data.theme_id && !data.discipline_id) {
    return { success: false, error: 'theme_id ou discipline_id est requis' };
  }
  if (!data.titre) {
    return { success: false, error: 'titre est requis' };
  }

  // Générer un ID unique
  const id = 'chap_' + new Date().getTime();

  // Date de création
  const dateCreation = new Date().toISOString().split('T')[0];

  // Statut par défaut
  const statut = data.statut || 'brouillon';

  // Trouver le prochain numéro si non spécifié
  let numero = data.numero;
  if (!numero) {
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const themeIdCol = headers.indexOf('theme_id');
    const disciplineIdCol = headers.indexOf('discipline_id');
    const numeroCol = headers.indexOf('numero');

    let relevantChapters;
    if (data.theme_id) {
      relevantChapters = allData.slice(1).filter(row => row[themeIdCol] === data.theme_id);
    } else {
      // Cours introductifs : sans theme_id, avec discipline_id
      relevantChapters = allData.slice(1).filter(row =>
        !row[themeIdCol] && row[disciplineIdCol] === data.discipline_id
      );
    }
    numero = Math.max(0, ...relevantChapters.map(row => parseInt(row[numeroCol]) || 0)) + 1;
  }

  // Colonnes : id | theme_id | discipline_id | numero | numero_lecon | titre | contenu | contenu_texte | lien | statut | date_creation
  sheet.appendRow([
    id,
    data.theme_id || '',
    data.discipline_id || '',
    numero,
    data.numero_lecon || '',
    data.titre,
    data.contenu || '',
    data.contenu_texte || '',
    data.lien || '',
    statut,
    dateCreation
  ]);

  return {
    success: true,
    id: id,
    message: 'Chapitre créé avec succès'
  };
}

/**
 * Modifie un chapitre
 * @param {Object} data - { id, theme_id?, discipline_id?, numero?, numero_lecon?, titre?, contenu?, contenu_texte?, lien?, statut? }
 */
function updateChapter(data) {
  if (!data.id) {
    return { success: false, error: 'id est requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CHAPITRES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Chapitre non trouvé: ' + data.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['theme_id', 'discipline_id', 'numero', 'numero_lecon', 'titre', 'contenu', 'contenu_texte', 'lien', 'statut'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Chapitre modifié avec succès'
  };
}

/**
 * Supprime un chapitre
 * @param {Object} data - { id }
 */
function deleteChapter(data) {
  if (!data.id) {
    return { success: false, error: 'id est requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CHAPITRES);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === data.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Chapitre non trouvé: ' + data.id };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Chapitre supprimé avec succès'
  };
}

// ========================================
// FONCTIONS SUPPORTS
// ========================================

/**
 * Ajoute un support à un chapitre
 * @param {Object} data - { chapitre_id, type, nom, url, ordre }
 */
function addSupport(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.SUPPORTS_CHAPITRE);

  if (!sheet) {
    return { success: false, error: 'Onglet SUPPORTS_CHAPITRE non trouvé' };
  }

  if (!data.chapitre_id || !data.url) {
    return { success: false, error: 'chapitre_id et url sont requis' };
  }

  // Générer un ID unique
  const id = 'support_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);

  // Colonnes : id | chapitre_id | type | nom | url | ordre
  sheet.appendRow([
    id,
    data.chapitre_id,
    data.type || 'document',
    data.nom || 'Support',
    data.url,
    data.ordre || 1
  ]);

  return {
    success: true,
    id: id,
    message: 'Support ajouté avec succès'
  };
}

/**
 * Supprime tous les supports d'un chapitre
 * @param {Object} data - { chapitre_id }
 */
function deleteChapterSupports(data) {
  if (!data.chapitre_id) {
    return { success: false, error: 'chapitre_id est requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.SUPPORTS_CHAPITRE);

  if (!sheet) {
    return { success: false, error: 'Onglet SUPPORTS_CHAPITRE non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, message: 'Aucun support à supprimer', deleted: 0 };
  }

  const headers = allData[0];
  const chapitreIdCol = headers.indexOf('chapitre_id');

  if (chapitreIdCol === -1) {
    return { success: false, error: 'Colonne chapitre_id non trouvée' };
  }

  // Trouver toutes les lignes à supprimer (en partant de la fin pour éviter les problèmes d'index)
  const rowsToDelete = [];
  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][chapitreIdCol] === data.chapitre_id) {
      rowsToDelete.push(i + 1); // +1 car getRange est 1-indexed
    }
  }

  // Supprimer les lignes
  rowsToDelete.forEach(rowIndex => {
    sheet.deleteRow(rowIndex);
  });

  return {
    success: true,
    message: `${rowsToDelete.length} support(s) supprimé(s)`,
    deleted: rowsToDelete.length
  };
}

// ================================================================
// FILE: Users.gs
// ================================================================

// ========================================
// FONCTIONS UTILISATEURS
// ========================================

/**
 * Crée un nouvel utilisateur
 * @param {Object} data - { id, nom, prenom, identifiant, password, role, classes, groupes }
 */
function createUser(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.identifiant || (!userData.mot_de_passe && !userData.password)) {
    return { success: false, error: 'identifiant et mot_de_passe sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Vérifier si l'identifiant existe déjà
  const identifiantCol = headers.indexOf('identifiant');
  if (identifiantCol >= 0) {
    const exists = allData.slice(1).some(row => row[identifiantCol] === userData.identifiant);
    if (exists) {
      return { success: false, error: 'Cet identifiant existe déjà' };
    }
  }

  // Générer un ID si non fourni
  const id = userData.id || 'user_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  // Colonnes attendues: id | identifiant | mot_de_passe | prenom | nom | role | classe_id | groupe | date_creation | derniere_connexion
  const newRow = [];

  // Mapping des noms alternatifs
  const fieldMapping = {
    'mot_de_passe': userData.mot_de_passe || userData.password || '',
    'classe_id': userData.classe_id || userData.classes || '',
    'groupe': userData.groupe || userData.groupes || ''
  };

  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (colName === 'date_creation') {
      newRow[index] = new Date().toISOString().split('T')[0];
    } else if (fieldMapping[colName] !== undefined) {
      newRow[index] = fieldMapping[colName];
    } else if (userData[colName] !== undefined) {
      newRow[index] = userData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Utilisateur créé avec succès'
  };
}

/**
 * Met à jour un utilisateur
 * @param {Object} data - { id, nom?, prenom?, identifiant?, password?, role?, classes?, groupes? }
 */
function updateUser(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Mettre à jour les colonnes spécifiées
  // Mapping des noms de colonnes (JS -> Sheet)
  const columnMapping = {
    'mot_de_passe': 'mot_de_passe',
    'password': 'mot_de_passe',
    'classe_id': 'classe_id',
    'classes': 'classe_id',
    'groupe': 'groupe',
    'groupes': 'groupe'
  };

  const updates = ['nom', 'prenom', 'identifiant', 'mot_de_passe', 'password', 'role', 'classe_id', 'classes', 'groupe', 'groupes'];
  updates.forEach(col => {
    if (userData[col] !== undefined) {
      // Trouver le nom de colonne réel dans le sheet
      const sheetCol = columnMapping[col] || col;
      const colIndex = headers.indexOf(sheetCol);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(userData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Utilisateur modifié avec succès'
  };
}

/**
 * Supprime toutes les lignes d'un onglet où une colonne a une valeur donnée
 * @param {Spreadsheet} ss - Le spreadsheet ouvert
 * @param {string} sheetName - Nom de l'onglet
 * @param {string} columnName - Nom de la colonne à chercher
 * @param {string} value - Valeur à supprimer
 * @returns {number} Nombre de lignes supprimées
 */
function deleteRowsByValue_(ss, sheetName, columnName, value) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  const headers = allData[0];
  const col = headers.indexOf(columnName);
  if (col === -1) return 0;

  // Collecter les indices de lignes à supprimer (du bas vers le haut pour ne pas décaler)
  const rowsToDelete = [];
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][col]) === String(value)) {
      rowsToDelete.push(i + 1); // +1 car getValues() est 0-indexé mais deleteRow() est 1-indexé
    }
  }

  // Supprimer du bas vers le haut
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  return rowsToDelete.length;
}

/**
 * Supprime un utilisateur et toutes ses données associées (cascade)
 * @param {Object} data - { id }
 */
function deleteUser(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Suppression en cascade : nettoyer toutes les tables contenant des données de cet élève
  const tablesToClean = [
    { sheet: 'PROGRESSION_MEMORISATION', column: 'eleve_id' },
    { sheet: 'RESULTATS_EXERCICES', column: 'eleve_id' },
    { sheet: 'HISTORIQUE_PRATIQUES_SF', column: 'eleve_id' },
    { sheet: 'RESULTATS_ENTRAINEMENT', column: 'eleve_id' },
    { sheet: 'EVALUATION_RESULTATS', column: 'eleve_id' },
    { sheet: 'PROGRESSION_METHODOLOGIE', column: 'eleve_id' },
    { sheet: 'PROGRESSION_LECONS', column: 'eleve_id' },
    { sheet: 'EleveConnexions', column: 'eleve_id' },
    { sheet: 'EleveEntrainementsCompetences', column: 'eleve_id' }
  ];

  let totalCleaned = 0;
  tablesToClean.forEach(function(table) {
    totalCleaned += deleteRowsByValue_(ss, table.sheet, table.column, userData.id);
  });

  // Supprimer l'utilisateur lui-même
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Utilisateur supprimé avec succès (' + totalCleaned + ' lignes associées nettoyées)'
  };
}

/**
 * Réinitialise le mot de passe d'un utilisateur
 * @param {Object} data - { id, password }
 */
function resetPassword(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  // Supporter les deux noms: password ou mot_de_passe
  const newPassword = userData.password || userData.mot_de_passe;
  if (!userData.id || !newPassword) {
    return { success: false, error: 'id et password/mot_de_passe sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  // Chercher d'abord mot_de_passe, sinon password
  let passwordCol = headers.indexOf('mot_de_passe');
  if (passwordCol === -1) {
    passwordCol = headers.indexOf('password');
  }

  if (passwordCol === -1) {
    return { success: false, error: 'Colonne mot_de_passe non trouvée' };
  }

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Mettre à jour le mot de passe
  sheet.getRange(rowIndex, passwordCol + 1).setValue(newPassword);

  return {
    success: true,
    message: 'Mot de passe réinitialisé avec succès'
  };
}

// ========================================
// FONCTIONS CLASSES
// ========================================

/**
 * Crée une nouvelle classe
 * @param {Object} data - { nom, annee_scolaire }
 */
function createClasse(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CLASSES);

  if (!sheet) {
    return { success: false, error: 'Onglet CLASSES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let classeData = data;
  if (typeof data.data === 'string') {
    classeData = JSON.parse(data.data);
  } else if (data.data) {
    classeData = data.data;
  }

  if (!classeData.nom) {
    return { success: false, error: 'Le nom de la classe est requis' };
  }

  // Vérifier si une classe avec ce nom existe déjà
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const nomCol = headers.indexOf('nom');

  if (nomCol >= 0) {
    const exists = allData.slice(1).some(row => row[nomCol] === classeData.nom);
    if (exists) {
      return { success: false, error: 'Une classe avec ce nom existe déjà' };
    }
  }

  // Générer un ID unique
  const id = classeData.id || 'classe_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (classeData[colName] !== undefined) {
      newRow[index] = classeData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Classe créée avec succès'
  };
}

/**
 * Supprime une classe
 * @param {Object} data - { id }
 */
function deleteClasse(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CLASSES);

  if (!sheet) {
    return { success: false, error: 'Onglet CLASSES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let classeData = data;
  if (typeof data.data === 'string') {
    classeData = JSON.parse(data.data);
  } else if (data.data) {
    classeData = data.data;
  }

  if (!classeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === classeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Classe non trouvée: ' + classeData.id };
  }

  // Vérifier s'il y a des utilisateurs dans cette classe
  const usersSheet = ss.getSheetByName(SHEETS.UTILISATEURS);
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    const classeIdCol = usersData[0].indexOf('classe_id');
    if (classeIdCol >= 0) {
      const hasUsers = usersData.slice(1).some(row => row[classeIdCol] === classeData.id);
      if (hasUsers) {
        return {
          success: false,
          error: 'Impossible de supprimer cette classe car elle contient des utilisateurs'
        };
      }
    }
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Classe supprimée avec succès'
  };
}

// ========================================
// FONCTIONS GROUPES
// ========================================

/**
 * Crée un nouveau groupe
 * @param {Object} data - { nom, classe_id, type }
 */
function createGroupe(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.GROUPES);

  if (!sheet) {
    return { success: false, error: 'Onglet GROUPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let groupeData = data;
  if (typeof data.data === 'string') {
    groupeData = JSON.parse(data.data);
  } else if (data.data) {
    groupeData = data.data;
  }

  if (!groupeData.nom) {
    return { success: false, error: 'Le nom du groupe est requis' };
  }

  // Vérifier si un groupe avec ce nom existe déjà
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const nomCol = headers.indexOf('nom');

  if (nomCol >= 0) {
    const exists = allData.slice(1).some(row => row[nomCol] === groupeData.nom);
    if (exists) {
      return { success: false, error: 'Un groupe avec ce nom existe déjà' };
    }
  }

  // Générer un ID unique
  const id = groupeData.id || 'groupe_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (groupeData[colName] !== undefined) {
      newRow[index] = groupeData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Groupe créé avec succès'
  };
}

/**
 * Supprime un groupe
 * @param {Object} data - { id }
 */
function deleteGroupe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.GROUPES);

  if (!sheet) {
    return { success: false, error: 'Onglet GROUPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let groupeData = data;
  if (typeof data.data === 'string') {
    groupeData = JSON.parse(data.data);
  } else if (data.data) {
    groupeData = data.data;
  }

  if (!groupeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === groupeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Groupe non trouvé: ' + groupeData.id };
  }

  // Vérifier s'il y a des utilisateurs dans ce groupe
  const usersSheet = ss.getSheetByName(SHEETS.UTILISATEURS);
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    const groupeCol = usersData[0].indexOf('groupe');
    if (groupeCol >= 0) {
      const hasUsers = usersData.slice(1).some(row => row[groupeCol] === groupeData.id);
      if (hasUsers) {
        return {
          success: false,
          error: 'Impossible de supprimer ce groupe car il contient des utilisateurs'
        };
      }
    }
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Groupe supprimé avec succès'
  };
}

// ================================================================
// FILE: Videos.gs
// ================================================================

// ========================================
// FONCTIONS VIDEOS
// ========================================

/**
 * Crée une nouvelle vidéo
 * @param {Object} data - { titre, description, url, discipline_id, tags, est_featured, date_publication, ordre }
 */
function createVideo(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.VIDEOS);

  if (!sheet) {
    return { success: false, error: 'Onglet VIDEOS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let videoData = data;
  if (typeof data.data === 'string') {
    videoData = JSON.parse(data.data);
  } else if (data.data) {
    videoData = data.data;
  }

  if (!videoData.titre || !videoData.url) {
    return { success: false, error: 'Le titre et l\'URL sont requis' };
  }

  // Générer un ID unique
  const id = videoData.id || 'video_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (videoData[colName] !== undefined) {
      newRow[index] = videoData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Vidéo créée avec succès'
  };
}

/**
 * Met à jour une vidéo
 * @param {Object} data - { id, titre?, description?, url?, discipline_id?, tags?, est_featured?, date_publication?, ordre? }
 */
function updateVideo(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.VIDEOS);

  if (!sheet) {
    return { success: false, error: 'Onglet VIDEOS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let videoData = data;
  if (typeof data.data === 'string') {
    videoData = JSON.parse(data.data);
  } else if (data.data) {
    videoData = data.data;
  }

  if (!videoData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === videoData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Vidéo non trouvée: ' + videoData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['titre', 'description', 'url', 'discipline_id', 'tags', 'est_featured', 'date_publication', 'ordre'];
  updates.forEach(col => {
    if (videoData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(videoData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Vidéo modifiée avec succès'
  };
}

/**
 * Supprime une vidéo
 * @param {Object} data - { id }
 */
function deleteVideo(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.VIDEOS);

  if (!sheet) {
    return { success: false, error: 'Onglet VIDEOS non trouvé' };
  }

  // Parse les données
  const videoData = parseRequestData(data);

  // Valider l'ID
  if (!isValidId(videoData.id)) {
    return { success: false, error: 'ID invalide ou manquant: ' + videoData.id };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Utiliser la recherche insensible à la casse
  const idCol = findColumnIndex(headers, 'id');

  if (idCol === -1) {
    return { success: false, error: 'Colonne ID non trouvée dans VIDEOS' };
  }

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(videoData.id).trim()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Vidéo non trouvée: ' + videoData.id };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Vidéo supprimée avec succès'
  };
}

// ========================================
// FONCTIONS RECOMMANDATIONS
// ========================================

/**
 * Crée une nouvelle recommandation
 * @param {Object} data - { titre, description, type, url, image_url, discipline_id, tags, est_featured, date_publication }
 */
function createRecommandation(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RECOMMANDATIONS);

  if (!sheet) {
    return { success: false, error: 'Onglet RECOMMANDATIONS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let recoData = data;
  if (typeof data.data === 'string') {
    recoData = JSON.parse(data.data);
  } else if (data.data) {
    recoData = data.data;
  }

  if (!recoData.titre || !recoData.url) {
    return { success: false, error: 'Le titre et l\'URL sont requis' };
  }

  // Générer un ID unique
  const id = recoData.id || 'reco_' + new Date().getTime();

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (recoData[colName] !== undefined) {
      newRow[index] = recoData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Recommandation créée avec succès'
  };
}

/**
 * Met à jour une recommandation
 * @param {Object} data - { id, titre?, description?, type?, url?, image_url?, discipline_id?, tags?, est_featured?, date_publication? }
 */
function updateRecommandation(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RECOMMANDATIONS);

  if (!sheet) {
    return { success: false, error: 'Onglet RECOMMANDATIONS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let recoData = data;
  if (typeof data.data === 'string') {
    recoData = JSON.parse(data.data);
  } else if (data.data) {
    recoData = data.data;
  }

  if (!recoData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === recoData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Recommandation non trouvée: ' + recoData.id };
  }

  // Mettre à jour les colonnes spécifiées
  const updates = ['titre', 'description', 'type', 'url', 'image_url', 'discipline_id', 'tags', 'est_featured', 'date_publication'];
  updates.forEach(col => {
    if (recoData[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(recoData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Recommandation modifiée avec succès'
  };
}

/**
 * Supprime une recommandation
 * @param {Object} data - { id }
 */
function deleteRecommandation(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RECOMMANDATIONS);

  if (!sheet) {
    return { success: false, error: 'Onglet RECOMMANDATIONS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let recoData = data;
  if (typeof data.data === 'string') {
    recoData = JSON.parse(data.data);
  } else if (data.data) {
    recoData = data.data;
  }

  if (!recoData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === recoData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Recommandation non trouvée: ' + recoData.id };
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Recommandation supprimée avec succès'
  };
}
