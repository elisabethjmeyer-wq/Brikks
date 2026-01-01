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
  PROGRESSION_ENTRAINEMENTS: 'PROGRESSION_ENTRAINEMENTS',
  // Evaluations
  EVALUATIONS: 'EVALUATIONS',
  EVALUATION_QUESTIONS: 'EVALUATION_QUESTIONS',
  EVALUATION_RESULTATS: 'EVALUATION_RESULTATS'
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

  // 3. Récupérer les questions
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

  // 4. Récupérer les formats
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

    // Parser le JSON des données
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
 * Sauvegarde la progression d'un entraînement
 * @param {Object} data - { eleve_id, entrainement_id, score, temps_passe, reponses, complete }
 */
function saveProgressionEntrainement(data) {
  if (!data.eleve_id || !data.entrainement_id) {
    return { success: false, error: 'eleve_id et entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRESSION_ENTRAINEMENTS);
  if (!sheet) {
    return { success: false, error: 'Sheet PROGRESSION_ENTRAINEMENTS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Vérifier si une progression existe déjà
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

  if (existingRow > 0) {
    // Mettre à jour
    const updates = ['score', 'temps_passe', 'reponses', 'complete', 'date_completion'];
    updates.forEach(col => {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        let value = data[col];
        if (col === 'reponses' && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        if (col === 'date_completion' && data.complete) {
          value = new Date().toISOString().split('T')[0];
        }
        if (value !== undefined) {
          sheet.getRange(existingRow, colIndex + 1).setValue(value);
        }
      }
    });

    return { success: true, message: 'Progression mise à jour' };
  } else {
    // Créer
    const id = 'prog_entr_' + new Date().getTime();
    const newRow = headers.map(header => {
      if (header === 'id') return id;
      if (header === 'eleve_id') return data.eleve_id;
      if (header === 'entrainement_id') return data.entrainement_id;
      if (header === 'score') return data.score || 0;
      if (header === 'temps_passe') return data.temps_passe || 0;
      if (header === 'reponses') return typeof data.reponses === 'object' ? JSON.stringify(data.reponses) : (data.reponses || '{}');
      if (header === 'complete') return data.complete ? 'TRUE' : 'FALSE';
      if (header === 'date_completion') return data.complete ? new Date().toISOString().split('T')[0] : '';
      return '';
    });

    sheet.appendRow(newRow);
    return { success: true, id: id, message: 'Progression créée' };
  }
}

/**
 * Récupère les progressions d'un élève
 * @param {Object} data - { eleve_id, entrainement_id? }
 */
function getProgressionEntrainements(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRESSION_ENTRAINEMENTS);
  if (!sheet) {
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
      item[header] = row[index];
    });

    if (String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.entrainement_id && String(item.entrainement_id).trim() !== String(data.entrainement_id).trim()) continue;

    // Parser le JSON des réponses
    if (item.reponses) {
      try {
        item.reponses = JSON.parse(item.reponses);
      } catch (e) {
        item.reponses = {};
      }
    }

    progressions.push(item);
  }

  return { success: true, data: progressions };
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
