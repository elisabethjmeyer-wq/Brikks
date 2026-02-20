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

