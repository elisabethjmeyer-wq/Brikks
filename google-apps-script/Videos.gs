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

