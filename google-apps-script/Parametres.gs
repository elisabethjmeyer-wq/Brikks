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

