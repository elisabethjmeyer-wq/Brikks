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

