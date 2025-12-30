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
  CHAPITRES: 'CHAPITRES'
};

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

      default:
        result = { success: false, error: 'Action non reconnue: ' + action };
    }

    return createJsonResponse(result);

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Crée une réponse JSON avec CORS
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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
 * @param {Object} data - { theme_id, numero, numero_lecon, titre, contenu, lien, statut }
 */
function addChapter(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CHAPITRES);

  if (!data.theme_id || !data.titre) {
    return { success: false, error: 'theme_id et titre sont requis' };
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
    const themeIdCol = allData[0].indexOf('theme_id');
    const numeroCol = allData[0].indexOf('numero');

    const themesChapters = allData.slice(1).filter(row => row[themeIdCol] === data.theme_id);
    numero = Math.max(0, ...themesChapters.map(row => parseInt(row[numeroCol]) || 0)) + 1;
  }

  // Colonnes : id | theme_id | numero | numero_lecon | titre | contenu | lien | statut | date_creation
  sheet.appendRow([
    id,
    data.theme_id,
    numero,
    data.numero_lecon || '',
    data.titre,
    data.contenu || '',
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
 * @param {Object} data - { id, theme_id?, numero?, numero_lecon?, titre?, contenu?, lien?, statut? }
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
  const updates = ['theme_id', 'numero', 'numero_lecon', 'titre', 'contenu', 'lien', 'statut'];
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

  Logger.log('Onglet THEMES: ' + (themesSheet ? 'OK' : 'NON TROUVÉ'));
  Logger.log('Onglet CHAPITRES: ' + (chapitresSheet ? 'OK' : 'NON TROUVÉ'));

  if (themesSheet) {
    Logger.log('Nombre de lignes THEMES: ' + themesSheet.getLastRow());
  }
  if (chapitresSheet) {
    Logger.log('Nombre de lignes CHAPITRES: ' + chapitresSheet.getLastRow());
  }
}
