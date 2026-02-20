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

