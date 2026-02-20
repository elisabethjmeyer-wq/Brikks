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
    sheet.appendRow(['id', 'banque_id', 'type', 'titre_prof', 'donnees', 'difficulte', 'date_creation']);
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

  const updates = ['type', 'titre_prof', 'donnees', 'difficulte'];
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
      // CASCADE: Supprimer les références à cette question dans ETAPE_QUESTIONS_CONN
      deleteEtapeQuestionsForQuestion(data.id);
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Question supprimée' };
    }
  }

  return { success: false, error: 'Question non trouvée' };
}

/**
 * Supprime toutes les références à une question dans ETAPE_QUESTIONS_CONN
 */
function deleteEtapeQuestionsForQuestion(questionId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const questionIdCol = headers.indexOf('question_id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][questionIdCol]).trim() === String(questionId).trim()) {
      sheet.deleteRow(i + 1);
    }
  }
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
      ['fmt_carte', 'Image cliquable', 'carte', '🗺️', 'Localiser des éléments sur une carte ou image', '{}', 'oui', 7],
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
      // CASCADE: Supprimer tous les entraînements de cette banque (et leurs étapes/questions)
      deleteEntrainementsForBanque(data.id);
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Banque et ses entraînements supprimés' };
    }
  }

  return { success: false, error: 'Banque non trouvée' };
}

/**
 * Supprime tous les entraînements d'une banque (cascade)
 */
function deleteEntrainementsForBanque(banqueId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');
  const banqueCol = headers.indexOf('banque_exercice_id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][banqueCol]).trim() === String(banqueId).trim()) {
      // CASCADE: supprimer les étapes de cet entraînement (et leurs questions)
      deleteEtapesForEntrainement(allData[i][idCol]);
      sheet.deleteRow(i + 1);
    }
  }
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
      // Supprimer aussi la progression de mémorisation
      deleteProgressionForEntrainement(data.id);
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
    sheet.appendRow(['id', 'entrainement_id', 'format_code', 'ordre', 'mode_selection', 'nb_questions', 'banque_source_id']);
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
    data.ordre || 1,
    data.mode_selection || 'manuel',
    data.nb_questions || 5,
    data.banque_source_id || ''
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
      ['format_code', 'titre', 'ordre', 'mode_selection', 'banque_source_id', 'nb_questions'].forEach(col => {
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
 * Nettoie les données de PROGRESSION_MEMORISATION quand un entraînement est supprimé
 * Évite les données orphelines
 */
function deleteProgressionForEntrainement(entrainementId) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.PROGRESSION_MEMORISATION);
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const entrainementIdCol = headers.indexOf('entrainement_id');

  if (entrainementIdCol === -1) {
    // Colonne entrainement_id non trouvée
    return;
  }

  // Collecter les numéros de ligne à supprimer (en sens inverse pour éviter les décalages)
  const rowsToDelete = [];
  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][entrainementIdCol]).trim() === String(entrainementId).trim()) {
      rowsToDelete.push(i + 1); // Google Sheets utilise 1-indexing
    }
  }

  // Supprimer les lignes (déjà en sens inverse, donc pas de décalage)
  for (const rowIndex of rowsToDelete) {
    sheet.deleteRow(rowIndex);
  }
}

/**
 * Remplace toutes les questions d'une étape
 */
function setEtapeQuestionsConn(data) {
  if (!data.etape_id || !data.questions) {
    return { success: false, error: 'etape_id et questions requis' };
  }

  // Verrou pour éviter les modifications concurrentes sur le sheet
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // Attendre max 15 secondes
  } catch (e) {
    return { success: false, error: 'Opération en cours, veuillez réessayer' };
  }

  try {
    // Supprimer les questions existantes
    deleteEtapeQuestionsForEtape(data.etape_id);

    // Parser les questions si c'est une string JSON (envoyé via URL)
    var questions = data.questions;
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

    // Dédupliquer par question_id pour éviter les doublons
    var seen = {};
    questions = questions.filter(function(q) {
      if (!q.question_id || seen[q.question_id]) return false;
      seen[q.question_id] = true;
      return true;
    });

    // Ajouter les nouvelles questions
    questions.forEach(function(q, index) {
      createEtapeQuestionConn({
        etape_id: data.etape_id,
        question_id: q.question_id,
        banque_question_id: q.banque_question_id || '',
        ordre: index + 1
      });
    });

    return { success: true, message: questions.length + ' questions définies pour l\'étape' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Nettoie les données orphelines dans toutes les feuilles connaissances.
 * Supprime en cascade : entrainements sans banque, étapes sans entrainement,
 * liens étape-questions sans étape ou sans question valide.
 */
function cleanupOrphanedData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let cleaned = { entrainements: 0, etapes: 0, etapeQuestions: 0 };

  // 1. Collecter les IDs existants des banques
  const banquesSheet = ss.getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  const banqueIds = new Set();
  if (banquesSheet) {
    const bData = banquesSheet.getDataRange().getValues();
    const bHeaders = bData[0].map(h => String(h).toLowerCase().trim());
    const bIdCol = bHeaders.indexOf('id');
    for (let i = 1; i < bData.length; i++) {
      const id = String(bData[i][bIdCol]).trim();
      if (id) banqueIds.add(id);
    }
  }

  // 2. Nettoyer ENTRAINEMENTS_CONN : supprimer ceux dont banque_exercice_id n'existe plus
  const entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  const entrainementIds = new Set();
  if (entrSheet) {
    const eData = entrSheet.getDataRange().getValues();
    const eHeaders = eData[0].map(h => String(h).toLowerCase().trim());
    const eIdCol = eHeaders.indexOf('id');
    const eBanqueCol = eHeaders.indexOf('banque_exercice_id');

    for (let i = eData.length - 1; i >= 1; i--) {
      const banqueId = String(eData[i][eBanqueCol]).trim();
      const entrId = String(eData[i][eIdCol]).trim();
      if (!banqueId || !banqueIds.has(banqueId)) {
        // Supprimer les étapes de cet entrainement orphelin
        deleteEtapesForEntrainement(entrId);
        entrSheet.deleteRow(i + 1);
        cleaned.entrainements++;
      } else {
        entrainementIds.add(entrId);
      }
    }
  }

  // 3. Nettoyer ETAPES_CONN : supprimer celles dont entrainement_id n'existe plus
  const etapesSheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  const etapeIds = new Set();
  if (etapesSheet) {
    const stData = etapesSheet.getDataRange().getValues();
    const stHeaders = stData[0].map(h => String(h).toLowerCase().trim());
    const stIdCol = stHeaders.indexOf('id');
    const stEntrCol = stHeaders.indexOf('entrainement_id');

    for (let i = stData.length - 1; i >= 1; i--) {
      const entrId = String(stData[i][stEntrCol]).trim();
      const etapeId = String(stData[i][stIdCol]).trim();
      if (!entrId || !entrainementIds.has(entrId)) {
        // Supprimer les liens question de cette étape orpheline
        deleteEtapeQuestionsForEtape(etapeId);
        etapesSheet.deleteRow(i + 1);
        cleaned.etapes++;
      } else {
        etapeIds.add(etapeId);
      }
    }
  }

  // 4. Nettoyer ETAPE_QUESTIONS_CONN : supprimer les liens vers étapes ou questions inexistantes
  const eqSheet = ss.getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (eqSheet) {
    // Collecter les IDs de questions existantes
    const questionsSheet = ss.getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
    const questionIds = new Set();
    if (questionsSheet) {
      const qData = questionsSheet.getDataRange().getValues();
      const qHeaders = qData[0].map(h => String(h).toLowerCase().trim());
      const qIdCol = qHeaders.indexOf('id');
      for (let i = 1; i < qData.length; i++) {
        const id = String(qData[i][qIdCol]).trim();
        if (id) questionIds.add(id);
      }
    }

    const eqData = eqSheet.getDataRange().getValues();
    const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
    const eqEtapeCol = eqHeaders.indexOf('etape_id');
    const eqQuestionCol = eqHeaders.indexOf('question_id');

    for (let i = eqData.length - 1; i >= 1; i--) {
      const etapeId = String(eqData[i][eqEtapeCol]).trim();
      const questionId = String(eqData[i][eqQuestionCol]).trim();
      if (!etapeId || !etapeIds.has(etapeId) || !questionId || !questionIds.has(questionId)) {
        eqSheet.deleteRow(i + 1);
        cleaned.etapeQuestions++;
      }
    }
  }

  return {
    success: true,
    message: `Nettoyage terminé: ${cleaned.entrainements} entraînements, ${cleaned.etapes} étapes, ${cleaned.etapeQuestions} liens question supprimés`,
    cleaned: cleaned
  };
}
