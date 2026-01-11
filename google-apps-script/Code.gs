/**
 * Brikks - Google Apps Script Backend
 * Web App pour les opérations CRUD sur les thèmes et chapitres
 *
 * DÉPLOIEMENT :
 * 1. Ouvrir Google Sheets > Extensions > Apps Script
 * 2. Copier ce code dans Code.gs
 * 3. Déployer > Nouveau déploiement > Application Web
 * 4. Exécuter en tant que : Moi
 * 5. Accès : Tout le monde
 * 6. Copier l'URL et la mettre dans config.js
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
  // Anciennes tables (conservées pour compatibilité)
  METHODOLOGIE_CATEGORIES: 'METHODOLOGIE_CATEGORIES',
  METHODOLOGIE_COMPETENCES: 'METHODOLOGIE_COMPETENCES',
  METHODOLOGIE_ETAPES: 'METHODOLOGIE_ETAPES',
  // Entraînements
  FORMATS: 'FORMATS',
  QUESTIONS: 'QUESTIONS',
  TAGS: 'TAGS',
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
  HISTORIQUE_PRATIQUES_SF: 'HISTORIQUE_PRATIQUES_SF'
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
    const action = params.action;
    const callback = params.callback; // Support JSONP

    // Si POST avec body JSON
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // Fusionner params et data
    const request = { ...params, ...data };

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

      // PROGRESSION ENTRAINEMENTS
      case 'saveProgressionEntrainement':
        result = saveProgressionEntrainement(request);
        break;
      case 'getProgressionEntrainements':
        result = getProgressionEntrainements(request);
        break;

      // SYSTÈME DE MÉMORISATION
      case 'getProgressionMemorisation':
        result = getProgressionMemorisation(request);
        break;
      case 'saveProgressionMemorisation':
        result = saveProgressionMemorisation(request);
        break;
      case 'checkEntrainementDisponible':
        result = checkEntrainementDisponible(request);
        break;
      case 'getProgressionBanque':
        result = getProgressionBanque(request);
        break;

      // EVALUATIONS
      case 'getEvaluations':
        result = getEvaluations(request);
        break;
      case 'getEvaluation':
        result = getEvaluation(request);
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
      case 'getEleveEvaluations':
        result = getEleveEvaluations(request);
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

      // TACHES COMPLEXES (Compétences)
      case 'getTachesComplexes':
        result = getTachesComplexes(request);
        break;
      case 'getTacheComplexe':
        result = getTacheComplexe(request);
        break;
      case 'createTacheComplexe':
        result = createTacheComplexe(request);
        break;
      case 'updateTacheComplexe':
        result = updateTacheComplexe(request);
        break;
      case 'deleteTacheComplexe':
        result = deleteTacheComplexe(request);
        break;

      // ELEVE TACHES COMPLEXES (progress tracking)
      case 'getEleveTacheComplexe':
        result = getEleveTacheComplexe(request);
        break;

      case 'getEleveTachesComplexes':
        result = getEleveTachesComplexes(request);
        break;

      case 'startEleveTacheComplexe':
        result = startEleveTacheComplexe(request);
        break;

      case 'finishEleveTacheComplexe':
        result = finishEleveTacheComplexe(request);
        break;

      case 'submitEleveTacheComplexe':
        result = submitEleveTacheComplexe(request);
        break;

      case 'updateEleveTacheComplexe':
        result = updateEleveTacheComplexe(request);
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
 * Supprime un utilisateur
 * @param {Object} data - { id }
 */
function deleteUser(data) {
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

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Utilisateur supprimé avec succès'
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
// FONCTIONS PROGRESSION ENTRAINEMENTS
// ========================================

/**
 * Sauvegarde le résultat d'un entraînement
 * @param {Object} data - { eleve_id, entrainement_id, score, score_max, pourcentage, termine }
 * Colonnes GSheet: id, eleve_id, entrainement_id, score, score_max, pourcentage, termine, date
 */
function saveProgressionEntrainement(data) {
  if (!data.eleve_id || !data.entrainement_id) {
    return { success: false, error: 'eleve_id et entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RESULTATS_ENTRAINEMENT);
  if (!sheet) {
    return { success: false, error: 'Sheet RESULTATS_ENTRAINEMENT non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Vérifier si un résultat existe déjà
  const eleveIdCol = headers.indexOf('eleve_id');
  const entrIdCol = headers.indexOf('entrainement_id');

  let existingRow = -1;
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][entrIdCol]).trim() === String(data.entrainement_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  // Calculer le pourcentage si non fourni
  const scoreMax = data.score_max || data.total || 1;
  const score = data.score || 0;
  const pourcentage = data.pourcentage !== undefined ? data.pourcentage : Math.round((score / scoreMax) * 100);
  const termine = data.termine !== undefined ? data.termine : (data.complete ? true : false);

  if (existingRow > 0) {
    // Mettre à jour
    const updates = {
      'score': score,
      'score_max': scoreMax,
      'pourcentage': pourcentage,
      'termine': termine ? 'TRUE' : 'FALSE',
      'date': new Date().toISOString().split('T')[0]
    };

    Object.keys(updates).forEach(col => {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(existingRow, colIndex + 1).setValue(updates[col]);
      }
    });

    return { success: true, message: 'Résultat mis à jour' };
  } else {
    // Créer
    const id = 'res_entr_' + new Date().getTime();
    const newRow = headers.map(header => {
      if (header === 'id') return id;
      if (header === 'eleve_id') return data.eleve_id;
      if (header === 'entrainement_id') return data.entrainement_id;
      if (header === 'score') return score;
      if (header === 'score_max') return scoreMax;
      if (header === 'pourcentage') return pourcentage;
      if (header === 'termine') return termine ? 'TRUE' : 'FALSE';
      if (header === 'date') return new Date().toISOString().split('T')[0];
      return '';
    });

    sheet.appendRow(newRow);
    return { success: true, id: id, message: 'Résultat créé' };
  }
}

/**
 * Récupère les résultats d'entraînement d'un élève
 * @param {Object} data - { eleve_id, entrainement_id? }
 * Colonnes GSheet: id, eleve_id, entrainement_id, score, score_max, pourcentage, termine, date
 */
function getProgressionEntrainements(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.RESULTATS_ENTRAINEMENT);
  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const resultats = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    if (String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.entrainement_id && String(item.entrainement_id).trim() !== String(data.entrainement_id).trim()) continue;

    resultats.push(item);
  }

  return { success: true, data: resultats };
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

/**
 * Vérifie si un élève peut faire un entraînement (pas verrouillé)
 * @param {Object} data - { eleve_id, entrainement_id }
 */
function checkEntrainementDisponible(data) {
  if (!data.eleve_id || !data.entrainement_id) {
    return { success: false, error: 'eleve_id et entrainement_id requis' };
  }

  const progression = getProgressionMemorisation({
    eleve_id: data.eleve_id,
    entrainement_id: data.entrainement_id
  });

  if (!progression.success) {
    return progression;
  }

  if (progression.data.length === 0) {
    // Jamais fait = disponible
    return { success: true, disponible: true, statut: 'nouveau' };
  }

  const prog = progression.data[0];

  if (prog.statut === 'memorise') {
    // Mémorisé = disponible pour s'entraîner mais ça ne compte pas
    return {
      success: true,
      disponible: true,
      statut: 'memorise',
      message: 'Cet exercice est déjà mémorisé. Tu peux t\'entraîner mais ça ne changera pas ta progression.'
    };
  }

  const now = new Date();
  const prochaineRevision = prog.prochaine_revision ? new Date(prog.prochaine_revision) : null;

  if (!prochaineRevision || now >= prochaineRevision) {
    // Révision due ou passée = disponible
    return {
      success: true,
      disponible: true,
      statut: prog.statut,
      etape: prog.etape,
      etape_max: ETAPE_MAX,
      pret_evaluation: prog.etape >= ETAPE_PRET_EVALUATION,
      revision_due: true
    };
  } else {
    // Pas encore le moment
    const joursRestants = Math.ceil((prochaineRevision - now) / (1000 * 60 * 60 * 24));
    return {
      success: true,
      disponible: false,
      statut: 'verrouille',
      etape: prog.etape,
      etape_max: ETAPE_MAX,
      pret_evaluation: prog.etape >= ETAPE_PRET_EVALUATION,
      prochaine_revision: prog.prochaine_revision,
      jours_restants: joursRestants,
      message: `Prochaine révision efficace dans ${joursRestants} jour${joursRestants > 1 ? 's' : ''}.`
    };
  }
}

/**
 * Récupère un résumé de progression pour une banque d'exercices
 * @param {Object} data - { eleve_id, banque_id }
 */
function getProgressionBanque(data) {
  if (!data.eleve_id || !data.banque_id) {
    return { success: false, error: 'eleve_id et banque_id requis' };
  }

  // Récupérer tous les entraînements de cette banque
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);

  if (!entrSheet) {
    return { success: true, data: { total: 0, stats: {} } };
  }

  const entrData = entrSheet.getDataRange().getValues();
  if (entrData.length < 2) {
    return { success: true, data: { total: 0, stats: {} } };
  }

  const entrHeaders = entrData[0].map(h => String(h).toLowerCase().trim());
  const banqueIdCol = entrHeaders.indexOf('banque_id');
  const idCol = entrHeaders.indexOf('id');

  const entrainementIds = [];
  for (let i = 1; i < entrData.length; i++) {
    if (String(entrData[i][banqueIdCol]).trim() === String(data.banque_id).trim()) {
      entrainementIds.push(String(entrData[i][idCol]).trim());
    }
  }

  if (entrainementIds.length === 0) {
    return { success: true, data: { total: 0, stats: {} } };
  }

  // Récupérer les progressions
  const progressions = getProgressionMemorisation({
    eleve_id: data.eleve_id,
    banque_id: data.banque_id
  });

  const stats = {
    nouveau: 0,
    en_cours: 0,
    memorise: 0,
    a_reviser: 0,
    verrouille: 0
  };

  const now = new Date();
  const progressionMap = {};

  if (progressions.success && progressions.data) {
    progressions.data.forEach(p => {
      progressionMap[p.entrainement_id] = p;
    });
  }

  entrainementIds.forEach(entrId => {
    const prog = progressionMap[entrId];
    if (!prog) {
      stats.nouveau++;
    } else if (prog.statut === 'memorise') {
      stats.memorise++;
    } else {
      const prochaineRevision = prog.prochaine_revision ? new Date(prog.prochaine_revision) : null;
      if (!prochaineRevision || now >= prochaineRevision) {
        stats.a_reviser++;
      } else {
        stats.verrouille++;
      }
      stats.en_cours++;
    }
  });

  const total = entrainementIds.length;
  const pourcentageMemorise = total > 0 ? Math.round((stats.memorise / total) * 100) : 0;

  return {
    success: true,
    data: {
      total: total,
      stats: stats,
      pourcentage_memorise: pourcentageMemorise,
      pret_evaluation: pourcentageMemorise >= 100
    }
  };
}

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

  const updates = ['type', 'titre', 'description', 'chapitre_id', 'statut', 'briques', 'seuil', 'duree', 'date_debut', 'date_fin', 'methodologie_id', 'criteres'];
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

  // Supprimer les liens evaluation_questions
  const eqSheet = ss.getSheetByName(SHEETS.EVALUATION_QUESTIONS);
  if (eqSheet) {
    const eqData = eqSheet.getDataRange().getValues();
    const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
    const eqIdCol = eqHeaders.indexOf('evaluation_id');

    for (let i = eqData.length - 1; i >= 1; i--) {
      if (String(eqData[i][eqIdCol]).trim() === String(data.id).trim()) {
        eqSheet.deleteRow(i + 1);
      }
    }
  }

  // Supprimer l'evaluation
  const sheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Evaluation supprimee' };
    }
  }

  return { success: false, error: 'Evaluation non trouvee' };
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
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'score', 'validations', 'is_validated', 'temps_passe', 'date_passage', 'details']);
  }

  const id = 'res_' + new Date().getTime();
  const datePassage = new Date().toISOString();

  const newRow = [
    id,
    data.evaluation_id,
    data.eleve_id,
    data.score || 0,
    data.validations || 0,
    data.is_validated === true || data.is_validated === 'true',
    data.temps_passe || 0,
    datePassage,
    data.details || ''
  ];

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Resultat sauvegarde' };
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

    // Ne garder que les evaluations publiees ou terminees
    if (item.statut !== 'publiee' && item.statut !== 'terminee') continue;

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

  const updates = ['type', 'titre', 'description', 'ordre', 'statut'];
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
    if (col === 'duree') return data.duree || 600;
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

  // Créer la feuille si elle n'existe pas (avec nouvelles colonnes)
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow([
      'id', 'eleve_id', 'exercice_id', 'banque_id', 'score', 'est_parfait',
      'temps_passe', 'temps_prevu', 'date',
      'repetition_numero', 'dans_temps', 'est_entrainement_libre'
    ]);
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
      case 'est_entrainement_libre': return data.est_entrainement_libre ? 'TRUE' : 'FALSE';
      default: return '';
    }
  });

  // Toujours ajouter une nouvelle ligne (historique)
  sheet.appendRow(rowData);

  return {
    success: true,
    message: 'Pratique enregistrée',
    id: id,
    est_parfait: score === 100,
    dans_temps: tempsPasse <= tempsPrevu,
    repetition_numero: data.repetition_numero || 0
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
    return { success: true, data: [], stats: {} };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [], stats: {} };
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
  const ESPACEMENTS = { 0: 0, 1: 1, 2: 3, 3: 7 };
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

    // Maîtrise = 4 répétitions validées
    stats.est_maitrise = stats.repetitions_validees >= 4;

    // Calculer prochaine disponibilité
    if (stats.repetitions_validees > 0 && stats.repetitions_validees < 4 && stats.date_derniere_validation) {
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

  return {
    success: true,
    data: results,
    stats: statsParExercice
  };
}

// ========================================
// REFERENTIEL COMPETENCES
// ========================================

/**
 * Récupère toutes les compétences du référentiel
 */
function getCompetencesReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const competences = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const competence = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('CompetencesReferentiel');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CompetencesReferentiel');
    sheet.appendRow(['id', 'nom', 'description', 'categorie', 'ordre', 'statut']);
  }

  const id = 'comp_' + new Date().getTime();
  const rowData = [
    id,
    data.nom || '',
    data.description || '',
    data.categorie || '',
    data.ordre || 1,
    data.statut || 'actif'
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une compétence du référentiel
 */
function updateCompetenceReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.nom || allData[i][headers.indexOf('nom')],
        data.description || allData[i][headers.indexOf('description')],
        data.categorie || allData[i][headers.indexOf('categorie')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')],
        data.statut || allData[i][headers.indexOf('statut')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

/**
 * Supprime une compétence du référentiel
 */
function deleteCompetenceReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

// ========================================
// CRITERES DE REUSSITE
// ========================================

/**
 * Récupère tous les critères de réussite
 */
function getCriteresReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const result = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet || !data.competence_id) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const compIdCol = headers.indexOf('competence_id');
  const result = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (String(row[compIdCol]) === String(data.competence_id)) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      result.push(item);
    }
  }

  // Trier par ordre
  result.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  return { success: true, data: result };
}

/**
 * Crée un nouveau critère de réussite
 */
function createCritereReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('CriteresReussite');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CriteresReussite');
    sheet.appendRow(['id', 'competence_id', 'libelle', 'ordre']);
  }

  const id = 'crit_' + new Date().getTime();
  const rowData = [
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.competence_id || allData[i][headers.indexOf('competence_id')],
        data.libelle || allData[i][headers.indexOf('libelle')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

/**
 * Supprime un critère de réussite
 */
function deleteCritereReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

// ========================================
// TACHES COMPLEXES (Exercices Compétences)
// ========================================

/**
 * Récupère toutes les tâches complexes
 */
function getTachesComplexes(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const taches = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const tache = {};
    headers.forEach((header, index) => {
      tache[header] = row[index];
    });
    taches.push(tache);
  }

  // Filter by chapitre_id if provided
  if (data && data.chapitre_id) {
    return {
      success: true,
      data: taches.filter(t => t.chapitre_id === data.chapitre_id)
    };
  }

  return { success: true, data: taches };
}

/**
 * Récupère une tâche complexe par son ID
 */
function getTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const tache = {};
      headers.forEach((header, index) => {
        if (header === 'competences_ids' && allData[i][index]) {
          try {
            tache[header] = JSON.parse(allData[i][index]);
          } catch (e) {
            tache[header] = [];
          }
        } else {
          tache[header] = allData[i][index];
        }
      });
      return { success: true, data: tache };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

/**
 * Crée une nouvelle tâche complexe
 */
function createTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('TachesComplexes');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('TachesComplexes');
    sheet.appendRow(['id', 'titre', 'chapitre_id', 'description', 'document_url', 'correction_url', 'duree', 'competences_ids', 'ordre', 'statut', 'date_creation']);
  }

  const id = 'tc_' + new Date().getTime();
  const rowData = [
    id,
    data.titre || '',
    data.chapitre_id || '',
    data.description || '',
    data.document_url || '',
    data.correction_url || '',
    data.duree || 2700,
    data.competences_ids || '',
    data.ordre || 1,
    data.statut || 'brouillon',
    new Date().toISOString()
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une tâche complexe
 */
function updateTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.titre !== undefined ? data.titre : allData[i][headers.indexOf('titre')],
        data.chapitre_id !== undefined ? data.chapitre_id : allData[i][headers.indexOf('chapitre_id')],
        data.description !== undefined ? data.description : allData[i][headers.indexOf('description')],
        data.document_url !== undefined ? data.document_url : allData[i][headers.indexOf('document_url')],
        data.correction_url !== undefined ? data.correction_url : allData[i][headers.indexOf('correction_url')],
        data.duree !== undefined ? data.duree : allData[i][headers.indexOf('duree')],
        data.competences_ids !== undefined ? data.competences_ids : allData[i][headers.indexOf('competences_ids')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')],
        data.statut !== undefined ? data.statut : allData[i][headers.indexOf('statut')],
        allData[i][headers.indexOf('date_creation')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

/**
 * Supprime une tâche complexe
 */
function deleteTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

// ========== ELEVE TACHES COMPLEXES ==========

/**
 * Récupère le statut d'une tâche complexe pour un élève
 * @param {Object} data - {eleve_id, tache_id}
 */
function getEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: true, data: null };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: null };
  }

  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = allData[i][index];
      });
      return { success: true, data: record };
    }
  }

  return { success: true, data: null };
}

/**
 * Récupère toutes les tâches complexes d'un élève (ou toutes si admin)
 * @param {Object} data - {eleve_id} ou {} pour admin
 */
function getEleveTachesComplexes(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const records = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });

    // Filter by eleve_id if provided
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
 * Démarre une tâche complexe pour un élève (enregistre son choix)
 * @param {Object} data - {eleve_id, tache_id, mode: 'entrainement'|'points_bonus'}
 */
function startEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('EleveTachesComplexes');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveTachesComplexes');
    sheet.appendRow(['id', 'eleve_id', 'tache_id', 'mode', 'statut', 'date_debut', 'date_fin']);
  }

  // Vérifier si l'élève a déjà fait un choix pour cette tâche
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Déjà enregistré
      const existingRecord = {};
      headers.forEach((header, index) => {
        existingRecord[header] = allData[i][index];
      });
      return {
        success: false,
        error: 'Choix deja effectue',
        existing: existingRecord
      };
    }
  }

  const id = 'etc_' + new Date().getTime();
  const rowData = [
    id,
    data.eleve_id,
    data.tache_id,
    data.mode || 'entrainement',
    'en_cours',
    new Date().toISOString(),
    ''
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Termine une tâche complexe pour un élève
 * @param {Object} data - {eleve_id, tache_id}
 */
function finishEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');
  const statutCol = headers.indexOf('statut');
  const dateFinCol = headers.indexOf('date_fin');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Mettre à jour le statut et la date de fin
      sheet.getRange(i + 1, statutCol + 1).setValue('termine');
      sheet.getRange(i + 1, dateFinCol + 1).setValue(new Date().toISOString());
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Soumet une tâche complexe pour correction (mode points_bonus)
 * @param {Object} data - {eleve_id, tache_id, temps_passe}
 */
function submitEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');
  const statutCol = headers.indexOf('statut');

  // Ajouter colonnes si nécessaire
  let dateSoumissionCol = headers.indexOf('date_soumission');
  let tempsPasseCol = headers.indexOf('temps_passe');

  if (dateSoumissionCol === -1) {
    dateSoumissionCol = headers.length;
    sheet.getRange(1, dateSoumissionCol + 1).setValue('date_soumission');
  }
  if (tempsPasseCol === -1) {
    tempsPasseCol = headers.length + (dateSoumissionCol === headers.length ? 1 : 0);
    sheet.getRange(1, tempsPasseCol + 1).setValue('temps_passe');
  }

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Mettre à jour le statut à 'soumis' (en attente de correction)
      sheet.getRange(i + 1, statutCol + 1).setValue('soumis');
      sheet.getRange(i + 1, dateSoumissionCol + 1).setValue(new Date().toISOString());
      if (data.temps_passe) {
        sheet.getRange(i + 1, tempsPasseCol + 1).setValue(data.temps_passe);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Met à jour une tâche complexe élève (admin)
 * @param {Object} data - {id, statut, date_correction, ...}
 */
function updateEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Ajouter date_correction si nécessaire
  let dateCorrectionCol = headers.indexOf('date_correction');
  if (dateCorrectionCol === -1 && data.date_correction) {
    dateCorrectionCol = headers.length;
    sheet.getRange(1, dateCorrectionCol + 1).setValue('date_correction');
  }

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      // Mettre à jour les champs fournis
      if (data.statut !== undefined) {
        const statutCol = headers.indexOf('statut');
        if (statutCol !== -1) {
          sheet.getRange(i + 1, statutCol + 1).setValue(data.statut);
        }
      }
      if (data.date_correction !== undefined && dateCorrectionCol !== -1) {
        sheet.getRange(i + 1, dateCorrectionCol + 1).setValue(data.date_correction);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Enregistre une connexion/visite d'élève
 * @param {Object} data - {eleve_id, page, action}
 */
function trackEleveConnexion(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('EleveConnexions');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveConnexions');
    sheet.appendRow(['id', 'eleve_id', 'page', 'action', 'timestamp', 'user_agent']);
  }

  const id = 'conn_' + new Date().getTime();
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Utilisateurs');
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  let lastConnexionCol = headers.indexOf('derniere_connexion');
  if (lastConnexionCol === -1) {
    lastConnexionCol = headers.length;
    sheet.getRange(1, lastConnexionCol + 1).setValue('derniere_connexion');
  }

  for (let i = 1; i < allData.length; i++) {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveConnexions');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const records = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const record = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Stats de connexions
  const connexionsSheet = ss.getSheetByName('EleveConnexions');
  let totalConnexions = 0;
  let pagesVisitees = {};
  let derniereConnexion = null;

  if (connexionsSheet) {
    const connData = connexionsSheet.getDataRange().getValues();
    const connHeaders = connData[0];
    const eleveIdCol = connHeaders.indexOf('eleve_id');
    const pageCol = connHeaders.indexOf('page');
    const timestampCol = connHeaders.indexOf('timestamp');

    for (let i = 1; i < connData.length; i++) {
      if (String(connData[i][eleveIdCol]) === String(data.eleve_id)) {
        totalConnexions++;
        const page = connData[i][pageCol];
        pagesVisitees[page] = (pagesVisitees[page] || 0) + 1;

        const timestamp = connData[i][timestampCol];
        if (!derniereConnexion || new Date(timestamp) > new Date(derniereConnexion)) {
          derniereConnexion = timestamp;
        }
      }
    }
  }

  // Stats de tâches complexes
  const tachesSheet = ss.getSheetByName('EleveTachesComplexes');
  let tachesStats = { total: 0, en_cours: 0, termine: 0, soumis: 0 };

  if (tachesSheet) {
    const tachesData = tachesSheet.getDataRange().getValues();
    const tachesHeaders = tachesData[0];
    const eleveIdCol = tachesHeaders.indexOf('eleve_id');
    const statutCol = tachesHeaders.indexOf('statut');

    for (let i = 1; i < tachesData.length; i++) {
      if (String(tachesData[i][eleveIdCol]) === String(data.eleve_id)) {
        tachesStats.total++;
        const statut = tachesData[i][statutCol];
        if (tachesStats[statut] !== undefined) {
          tachesStats[statut]++;
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
      taches: tachesStats
    }
  };
}

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
 * Met à jour une banque de questions
 */
function updateBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
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
    return { success: false, error: 'Banque non trouvée' };
  }

  const updates = ['titre', 'description', 'theme_id', 'chapitre_id', 'statut'];
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
 * Supprime une banque de questions et ses questions
 */
function deleteBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Supprimer les questions liées
  const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (questionsSheet) {
    const questionsData = questionsSheet.getDataRange().getValues();
    const questionsHeaders = questionsData[0].map(h => String(h).toLowerCase().trim());
    const banqueIdCol = questionsHeaders.indexOf('banque_id');

    for (let i = questionsData.length - 1; i >= 1; i--) {
      if (String(questionsData[i][banqueIdCol]).trim() === String(data.id).trim()) {
        questionsSheet.deleteRow(i + 1);
      }
    }
  }

  // 2. Supprimer la banque
  const banqueSheet = ss.getSheetByName(SHEETS.BANQUES_QUESTIONS);
  if (banqueSheet) {
    const banqueData = banqueSheet.getDataRange().getValues();
    const banqueHeaders = banqueData[0].map(h => String(h).toLowerCase().trim());
    const idCol = banqueHeaders.indexOf('id');

    for (let i = banqueData.length - 1; i >= 1; i--) {
      if (String(banqueData[i][idCol]).trim() === String(data.id).trim()) {
        banqueSheet.deleteRow(i + 1);
        break;
      }
    }
  }

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
    sheet.appendRow(['id', 'banque_id', 'type', 'donnees', 'difficulte', 'date_creation']);
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
 * Met à jour une question de connaissances
 */
function updateQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
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
    return { success: false, error: 'Question non trouvée' };
  }

  const updates = ['type', 'donnees', 'difficulte'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return { success: true, message: 'Question mise à jour' };
}

/**
 * Supprime une question de connaissances
 */
function deleteQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

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
      ['fmt_carte', 'Carte cliquable', 'carte', '🗺️', 'Localiser des éléments sur une carte ou image', '{}', 'oui', 7],
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
 * Met à jour un format de question
 */
function updateFormatQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.FORMATS_QUESTIONS);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      ['nom', 'code', 'icone', 'description', 'config_defaut', 'actif', 'ordre'].forEach(col => {
        if (data[col] !== undefined) {
          const colIndex = headers.indexOf(col);
          if (colIndex >= 0) sheet.getRange(i + 1, colIndex + 1).setValue(data[col]);
        }
      });
      return { success: true, message: 'Format mis à jour' };
    }
  }

  return { success: false, error: 'Format non trouvé' };
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
    sheet.appendRow(['id', 'titre', 'description', 'type', 'statut', 'ordre', 'date_creation']);
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
    new Date().toISOString().split('T')[0]
  ]);

  return { success: true, id: id, message: 'Banque créée' };
}

/**
 * Met à jour une banque d'exercices connaissances
 */
function updateBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      ['titre', 'description', 'type', 'statut', 'ordre'].forEach(col => {
        if (data[col] !== undefined) {
          const colIndex = headers.indexOf(col);
          if (colIndex >= 0) sheet.getRange(i + 1, colIndex + 1).setValue(data[col]);
        }
      });
      return { success: true, message: 'Banque mise à jour' };
    }
  }

  return { success: false, error: 'Banque non trouvée' };
}

/**
 * Supprime une banque d'exercices connaissances
 */
function deleteBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Banque supprimée' };
    }
  }

  return { success: false, error: 'Banque non trouvée' };
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
 * Met à jour un entraînement connaissances
 */
function updateEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      ['titre', 'description', 'duree', 'seuil', 'statut', 'ordre'].forEach(col => {
        if (data[col] !== undefined) {
          const colIndex = headers.indexOf(col);
          if (colIndex >= 0) sheet.getRange(i + 1, colIndex + 1).setValue(data[col]);
        }
      });
      return { success: true, message: 'Entraînement mis à jour' };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Supprime un entraînement connaissances
 */
function deleteEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      // Supprimer aussi les étapes associées
      deleteEtapesForEntrainement(data.id);
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Entraînement supprimé' };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
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
    sheet.appendRow(['id', 'entrainement_id', 'format_code', 'titre', 'ordre', 'mode_selection', 'banques_source', 'nb_questions_aleatoire']);
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
    data.titre || '',
    data.ordre || 1,
    data.mode_selection || 'manuel',
    data.banques_source || '',  // JSON array of banque_question_ids
    data.nb_questions_aleatoire || 5
  ]);

  return { success: true, id: id, message: 'Étape créée' };
}

/**
 * Met à jour une étape
 */
function updateEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      ['format_code', 'titre', 'ordre', 'mode_selection', 'banques_source', 'nb_questions_aleatoire'].forEach(col => {
        if (data[col] !== undefined) {
          const colIndex = headers.indexOf(col);
          if (colIndex >= 0) sheet.getRange(i + 1, colIndex + 1).setValue(data[col]);
        }
      });
      return { success: true, message: 'Étape mise à jour' };
    }
  }

  return { success: false, error: 'Étape non trouvée' };
}

/**
 * Supprime une étape
 */
function deleteEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      // Supprimer aussi les questions de l'étape
      deleteEtapeQuestionsForEtape(data.id);
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Étape supprimée' };
    }
  }

  return { success: false, error: 'Étape non trouvée' };
}

/**
 * Met à jour l'ordre des étapes (pour drag & drop)
 */
function updateEtapesOrdre(data) {
  if (!data.etapes || !Array.isArray(data.etapes)) {
    return { success: false, error: 'etapes array requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');
  const ordreCol = headers.indexOf('ordre');

  data.etapes.forEach(({ id, ordre }) => {
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][idCol]).trim() === String(id).trim()) {
        sheet.getRange(i + 1, ordreCol + 1).setValue(ordre);
        break;
      }
    }
  });

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
 * Supprime toutes les questions d'une étape
 */
function deleteEtapeQuestionsForEtape(etapeId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const etapeIdCol = headers.indexOf('etape_id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][etapeIdCol]).trim() === String(etapeId).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Remplace toutes les questions d'une étape
 */
function setEtapeQuestionsConn(data) {
  if (!data.etape_id || !data.questions) {
    return { success: false, error: 'etape_id et questions requis' };
  }

  // Supprimer les questions existantes
  deleteEtapeQuestionsForEtape(data.etape_id);

  // Parser les questions si c'est une string JSON (envoyé via URL)
  let questions = data.questions;
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

  // Ajouter les nouvelles questions
  questions.forEach((q, index) => {
    createEtapeQuestionConn({
      etape_id: data.etape_id,
      question_id: q.question_id,
      banque_question_id: q.banque_question_id || '',
      ordre: index + 1
    });
  });

  return { success: true, message: `${questions.length} questions définies pour l'étape` };
}
