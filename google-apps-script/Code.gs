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
      case 'saveEvaluationCorrection':
        result = saveEvaluationCorrection(request);
        break;
      case 'signalerRendu':
        result = signalerRendu(request);
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

