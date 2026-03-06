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

