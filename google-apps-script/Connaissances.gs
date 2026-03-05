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
 * Met à jour une banque de questions.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.BANQUES_QUESTIONS, data, ['titre', 'description', 'theme_id', 'chapitre_id', 'statut'], 'Banque');
}

/**
 * Supprime une banque de questions et ses questions.
 * Optimisé : 1 seule ouverture du tableur, suppression en batch par feuille.
 */
function deleteBanqueQuestions(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var banqueId = String(data.id).trim();

  // 1. Supprimer les questions liées
  deleteRowsByColumnValue_(ss, SHEETS.QUESTIONS_CONNAISSANCES, 'banque_id', banqueId);

  // 2. Supprimer la banque elle-même
  deleteRowsByColumnValue_(ss, SHEETS.BANQUES_QUESTIONS, 'id', banqueId);

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
 * Met à jour une question de connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.QUESTIONS_CONNAISSANCES, data, ['type', 'titre_prof', 'donnees', 'difficulte'], 'Question');
}

/**
 * Supprime une question de connaissances.
 * Optimisé : 1 seule ouverture du tableur, cascade batch.
 */
function deleteQuestionConnaissances(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var questionId = String(data.id).trim();

  // CASCADE: Supprimer les références dans ETAPE_QUESTIONS_CONN
  deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'question_id', questionId);

  // Supprimer la question elle-même
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.QUESTIONS_CONNAISSANCES, 'id', questionId);
  if (deleted === 0) {
    return { success: false, error: 'Question non trouvée' };
  }

  return { success: true, message: 'Question supprimée' };
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
 * Met à jour un format de question.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateFormatQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.FORMATS_QUESTIONS, data, ['nom', 'code', 'icone', 'description', 'config_defaut', 'actif', 'ordre'], 'Format');
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
    sheet.appendRow(['id', 'titre', 'description', 'type', 'statut', 'ordre', 'date_creation', 'matiere']);
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
    new Date().toISOString().split('T')[0],
    data.matiere || ''
  ]);

  return { success: true, id: id, message: 'Banque créée' };
}

/**
 * Met à jour une banque d'exercices connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.BANQUES_EXERCICES_CONN, data, ['titre', 'description', 'type', 'statut', 'ordre', 'matiere'], 'Banque');
}

/**
 * Supprime une banque d'exercices connaissances.
 * Optimisé : cascade complète en 1 passe (1 lecture par feuille, suppressions en batch).
 */
function deleteBanqueExercicesConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var banqueId = String(data.id).trim();

  // 1. Collecter les IDs d'entraînements de cette banque
  var entrainementIds = collectColumnValues_(ss, SHEETS.ENTRAINEMENTS_CONN, 'banque_exercice_id', banqueId, 'id');

  // 2. Collecter les IDs d'étapes de ces entraînements
  var etapeIds = [];
  if (entrainementIds.length > 0) {
    etapeIds = collectColumnValuesMulti_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementIds, 'id');
  }

  // 3. Supprimer en cascade (du plus profond au plus haut)
  if (etapeIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeIds);
  }
  if (entrainementIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementIds);
    deleteRowsByColumnValueMulti_(ss, SHEETS.PROGRESSION_MEMORISATION, 'entrainement_id', entrainementIds);
    deleteRowsByColumnValueMulti_(ss, SHEETS.ENTRAINEMENTS_CONN, 'id', entrainementIds);
  }

  // 4. Supprimer la banque
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.BANQUES_EXERCICES_CONN, 'id', banqueId);
  if (deleted === 0) {
    return { success: false, error: 'Banque non trouvée' };
  }

  return { success: true, message: 'Banque et ses entraînements supprimés' };
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
 * Met à jour un entraînement connaissances.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.ENTRAINEMENTS_CONN, data, ['titre', 'description', 'duree', 'seuil', 'statut', 'ordre'], 'Entraînement');
}

/**
 * Supprime un entraînement connaissances.
 * Optimisé : cascade complète en 1 passe.
 */
function deleteEntrainementConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var entrainementId = String(data.id).trim();

  // 1. Collecter les IDs d'étapes
  var etapeIds = collectColumnValues_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementId, 'id');

  // 2. Supprimer en cascade (du plus profond au plus haut)
  if (etapeIds.length > 0) {
    deleteRowsByColumnValueMulti_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeIds);
  }
  deleteRowsByColumnValue_(ss, SHEETS.ETAPES_CONN, 'entrainement_id', entrainementId);
  deleteRowsByColumnValue_(ss, SHEETS.PROGRESSION_MEMORISATION, 'entrainement_id', entrainementId);

  // 3. Supprimer l'entraînement
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.ENTRAINEMENTS_CONN, 'id', entrainementId);
  if (deleted === 0) {
    return { success: false, error: 'Entraînement non trouvé' };
  }

  return { success: true, message: 'Entraînement supprimé' };
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
 * Met à jour une étape.
 * Optimisé : 1 seul setValues() au lieu de N setValue().
 */
function updateEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  return updateRowById_(SHEETS.ETAPES_CONN, data, ['format_code', 'titre', 'ordre', 'mode_selection', 'banque_source_id', 'nb_questions'], 'Étape');
}

/**
 * Supprime une étape.
 * Optimisé : 1 seule ouverture du tableur.
 */
function deleteEtapeConn(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var etapeId = String(data.id).trim();

  // CASCADE : supprimer les questions de l'étape
  deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', etapeId);

  // Supprimer l'étape
  var deleted = deleteRowsByColumnValue_(ss, SHEETS.ETAPES_CONN, 'id', etapeId);
  if (deleted === 0) {
    return { success: false, error: 'Étape non trouvée' };
  }

  return { success: true, message: 'Étape supprimée' };
}

/**
 * Met à jour l'ordre des étapes (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les étapes modifiées.
 */
function updateEtapesOrdre(data) {
  if (!data.etapes || !Array.isArray(data.etapes)) {
    return { success: false, error: 'etapes array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ETAPES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');
  if (idCol === -1 || ordreCol === -1) return { success: false, error: 'Colonnes id/ordre non trouvées' };

  // Construire un map id → nouvel ordre
  var ordreMap = {};
  data.etapes.forEach(function(e) {
    ordreMap[String(e.id).trim()] = e.ordre;
  });

  // Modifier les données en mémoire
  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  // Écrire toute la feuille en une seule opération
  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

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
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Supprimer les questions existantes
    deleteRowsByColumnValue_(ss, SHEETS.ETAPE_QUESTIONS_CONN, 'etape_id', String(data.etape_id).trim());

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
 * Optimisé : 1 seule ouverture du tableur, chaque feuille lue 1 fois.
 */
function cleanupOrphanedData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cleaned = { entrainements: 0, etapes: 0, etapeQuestions: 0 };

  // 1. Collecter les IDs existants des banques
  var banqueIds = collectAllIds_(ss, SHEETS.BANQUES_EXERCICES_CONN);

  // 2. Identifier les entraînements orphelins (banque_exercice_id n'existe plus)
  var entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  var validEntrIds = new Set();
  var orphanEntrIds = [];
  if (entrSheet) {
    var eData = entrSheet.getDataRange().getValues();
    var eHeaders = eData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var eIdCol = eHeaders.indexOf('id');
    var eBanqueCol = eHeaders.indexOf('banque_exercice_id');
    var rowsToDelete = [];

    for (var i = 1; i < eData.length; i++) {
      var banqueId = String(eData[i][eBanqueCol]).trim();
      var entrId = String(eData[i][eIdCol]).trim();
      if (!banqueId || !banqueIds.has(banqueId)) {
        orphanEntrIds.push(entrId);
        rowsToDelete.push(i + 1);
      } else {
        validEntrIds.add(entrId);
      }
    }
    deleteRowNumbers_(entrSheet, rowsToDelete);
    cleaned.entrainements = rowsToDelete.length;
  }

  // 3. Nettoyer les étapes des entraînements orphelins + étapes dont entrainement_id n'existe plus
  var etapesSheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  var validEtapeIds = new Set();
  var orphanEtapeIds = [];
  if (etapesSheet) {
    var stData = etapesSheet.getDataRange().getValues();
    var stHeaders = stData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var stIdCol = stHeaders.indexOf('id');
    var stEntrCol = stHeaders.indexOf('entrainement_id');
    var stRowsToDelete = [];

    for (var j = 1; j < stData.length; j++) {
      var stEntrId = String(stData[j][stEntrCol]).trim();
      var stEtapeId = String(stData[j][stIdCol]).trim();
      if (!stEntrId || !validEntrIds.has(stEntrId)) {
        orphanEtapeIds.push(stEtapeId);
        stRowsToDelete.push(j + 1);
      } else {
        validEtapeIds.add(stEtapeId);
      }
    }
    deleteRowNumbers_(etapesSheet, stRowsToDelete);
    cleaned.etapes = stRowsToDelete.length;
  }

  // 4. Nettoyer ETAPE_QUESTIONS_CONN : liens vers étapes ou questions inexistantes
  var eqSheet = ss.getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (eqSheet) {
    var questionIds = collectAllIds_(ss, SHEETS.QUESTIONS_CONNAISSANCES);

    var eqData = eqSheet.getDataRange().getValues();
    var eqHeaders = eqData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var eqEtapeCol = eqHeaders.indexOf('etape_id');
    var eqQuestionCol = eqHeaders.indexOf('question_id');
    var eqRowsToDelete = [];

    for (var k = 1; k < eqData.length; k++) {
      var eqEtapeId = String(eqData[k][eqEtapeCol]).trim();
      var eqQuestionId = String(eqData[k][eqQuestionCol]).trim();
      if (!eqEtapeId || !validEtapeIds.has(eqEtapeId) || !eqQuestionId || !questionIds.has(eqQuestionId)) {
        eqRowsToDelete.push(k + 1);
      }
    }
    deleteRowNumbers_(eqSheet, eqRowsToDelete);
    cleaned.etapeQuestions = eqRowsToDelete.length;
  }

  return {
    success: true,
    message: 'Nettoyage terminé: ' + cleaned.entrainements + ' entraînements, ' + cleaned.etapes + ' étapes, ' + cleaned.etapeQuestions + ' liens question supprimés',
    cleaned: cleaned
  };
}

// ========================================
// MISE À JOUR D'ORDRE (drag & drop)
// ========================================

/**
 * Met à jour l'ordre des questions de connaissances (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les questions modifiées.
 */
function updateQuestionsConnaissancesOrdre(data) {
  var questions = data.questions;
  if (typeof questions === 'string') {
    try { questions = JSON.parse(questions); } catch (e) {
      return { success: false, error: 'Format questions invalide' };
    }
  }
  if (!questions || !Array.isArray(questions)) {
    return { success: false, error: 'questions array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  // Si la colonne ordre n'existe pas encore, l'ajouter
  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  questions.forEach(function(q) {
    ordreMap[String(q.id).trim()] = q.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des questions mis à jour' };
}

/**
 * Met à jour l'ordre des banques de questions (pour drag & drop).
 * Optimisé : 1 seul setValues() pour toutes les banques modifiées.
 */
function updateBanquesQuestionsOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_QUESTIONS);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  // Si la colonne ordre n'existe pas encore, l'ajouter
  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) {
    ordreMap[String(b.id).trim()] = b.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des banques mis à jour' };
}

/**
 * Met à jour l'ordre des banques d'exercices connaissances (pour drag & drop).
 */
function updateBanquesExercicesConnOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) {
    ordreMap[String(b.id).trim()] = b.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des banques exercices mis à jour' };
}

/**
 * Met à jour l'ordre des entraînements connaissances (pour drag & drop).
 */
function updateEntrainementsConnOrdre(data) {
  var entrainements = data.entrainements;
  if (typeof entrainements === 'string') {
    try { entrainements = JSON.parse(entrainements); } catch (e) {
      return { success: false, error: 'Format entrainements invalide' };
    }
  }
  if (!entrainements || !Array.isArray(entrainements)) {
    return { success: false, error: 'entrainements array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) {
      allData[r].push('');
    }
  }

  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  entrainements.forEach(function(e) {
    ordreMap[String(e.id).trim()] = e.ordre;
  });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }

  return { success: true, message: 'Ordre des entrainements mis à jour' };
}

/**
 * Met à jour l'ordre des banques d'exercices SF (pour drag & drop).
 */
function updateBanquesExercicesOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BANQUES_EXERCICES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var ordreCol = headers.indexOf('ordre');

  if (ordreCol === -1) {
    ordreCol = headers.length;
    allData[0].push('ordre');
    for (var r = 1; r < allData.length; r++) { allData[r].push(''); }
  }
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  banques.forEach(function(b) { ordreMap[String(b.id).trim()] = b.ordre; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][ordreCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true };
}

/**
 * Met à jour le numéro des exercices SF (pour drag & drop).
 */
function updateExercicesOrdre(data) {
  var exercices = data.exercices;
  if (typeof exercices === 'string') {
    try { exercices = JSON.parse(exercices); } catch (e) {
      return { success: false, error: 'Format exercices invalide' };
    }
  }
  if (!exercices || !Array.isArray(exercices)) {
    return { success: false, error: 'exercices array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EXERCICES);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  var numeroCol = headers.indexOf('numero');

  if (numeroCol === -1) return { success: false, error: 'Colonne numero non trouvée' };
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var ordreMap = {};
  exercices.forEach(function(e) { ordreMap[String(e.id).trim()] = e.numero; });

  var modified = false;
  for (var i = 1; i < allData.length; i++) {
    var rowId = String(allData[i][idCol]).trim();
    if (ordreMap[rowId] !== undefined) {
      allData[i][numeroCol] = ordreMap[rowId];
      modified = true;
    }
  }

  if (modified) {
    sheet.getRange(1, 1, allData.length, allData[0].length).setValues(allData);
  }
  return { success: true };
}
// ========================================

/**
 * Met à jour une ligne identifiée par data.id dans la feuille donnée.
 * Écrit toutes les colonnes modifiées en 1 seul setValues() au lieu de N setValue().
 * @param {string} sheetName
 * @param {Object} data — doit contenir .id + les champs à modifier
 * @param {string[]} allowedCols — liste des colonnes autorisées à modifier
 * @param {string} entityLabel — nom pour le message d'erreur ('Banque', 'Question', etc.)
 */
function updateRowById_(sheetName, data, allowedCols, entityLabel) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return { success: false, error: 'Feuille non trouvée' };

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { success: false, error: 'Colonne id non trouvée' };

  var targetId = String(data.id).trim();
  var rowIndex = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === targetId) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: entityLabel + ' non trouvé(e)' };
  }

  // Modifier les colonnes en mémoire
  var modified = false;
  for (var c = 0; c < allowedCols.length; c++) {
    var col = allowedCols[c];
    if (data[col] !== undefined) {
      var colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        allData[rowIndex][colIndex] = data[col];
        modified = true;
      }
    }
  }

  // Écrire la ligne entière en 1 appel
  if (modified) {
    sheet.getRange(rowIndex + 1, 1, 1, allData[rowIndex].length).setValues([allData[rowIndex]]);
  }

  return { success: true, message: entityLabel + ' mis(e) à jour' };
}

// ========================================
// HELPERS DE SUPPRESSION EN BATCH
// ========================================

/**
 * Supprime toutes les lignes d'une feuille où la colonne `colName` vaut `value`.
 * @param {Spreadsheet} ss — tableur déjà ouvert
 * @param {string} sheetName — nom de la feuille
 * @param {string} colName — nom de la colonne (en minuscule)
 * @param {string} value — valeur à matcher (déjà trimmée)
 * @returns {number} nombre de lignes supprimées
 */
function deleteRowsByColumnValue_(ss, sheetName, colName, value) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var col = headers.indexOf(colName);
  if (col === -1) return 0;

  var rowsToDelete = [];
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][col]).trim() === value) {
      rowsToDelete.push(i + 1);
    }
  }

  deleteRowNumbers_(sheet, rowsToDelete);
  return rowsToDelete.length;
}

/**
 * Supprime les lignes où la colonne `colName` est dans le Set de valeurs.
 * @param {Spreadsheet} ss
 * @param {string} sheetName
 * @param {string} colName
 * @param {string[]} values — tableau de valeurs à matcher
 * @returns {number} nombre de lignes supprimées
 */
function deleteRowsByColumnValueMulti_(ss, sheetName, colName, values) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var col = headers.indexOf(colName);
  if (col === -1) return 0;

  var valueSet = {};
  for (var v = 0; v < values.length; v++) {
    valueSet[String(values[v]).trim()] = true;
  }

  var rowsToDelete = [];
  for (var i = 1; i < allData.length; i++) {
    if (valueSet[String(allData[i][col]).trim()]) {
      rowsToDelete.push(i + 1);
    }
  }

  deleteRowNumbers_(sheet, rowsToDelete);
  return rowsToDelete.length;
}

/**
 * Collecte les valeurs de `returnCol` pour les lignes où `filterCol` === `filterValue`.
 * @returns {string[]}
 */
function collectColumnValues_(ss, sheetName, filterCol, filterValue, returnCol) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return [];

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var fCol = headers.indexOf(filterCol);
  var rCol = headers.indexOf(returnCol);
  if (fCol === -1 || rCol === -1) return [];

  var results = [];
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][fCol]).trim() === filterValue) {
      results.push(String(allData[i][rCol]).trim());
    }
  }
  return results;
}

/**
 * Comme collectColumnValues_ mais filtre par un ensemble de valeurs.
 * @returns {string[]}
 */
function collectColumnValuesMulti_(ss, sheetName, filterCol, filterValues, returnCol) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return [];

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var fCol = headers.indexOf(filterCol);
  var rCol = headers.indexOf(returnCol);
  if (fCol === -1 || rCol === -1) return [];

  var filterSet = {};
  for (var v = 0; v < filterValues.length; v++) {
    filterSet[String(filterValues[v]).trim()] = true;
  }

  var results = [];
  for (var i = 1; i < allData.length; i++) {
    if (filterSet[String(allData[i][fCol]).trim()]) {
      results.push(String(allData[i][rCol]).trim());
    }
  }
  return results;
}

/**
 * Collecte tous les IDs (colonne 'id') d'une feuille.
 * @returns {Set}
 */
function collectAllIds_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var ids = new Set();
  if (!sheet) return ids;

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return ids;

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');
  if (idCol === -1) return ids;

  for (var i = 1; i < allData.length; i++) {
    var id = String(allData[i][idCol]).trim();
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Supprime les lignes par numéro (1-indexed). Les supprime en ordre inverse
 * pour éviter les décalages d'index.
 */
function deleteRowNumbers_(sheet, rowNumbers) {
  if (!rowNumbers.length) return;
  // Trier en ordre décroissant
  rowNumbers.sort(function(a, b) { return b - a; });
  for (var i = 0; i < rowNumbers.length; i++) {
    sheet.deleteRow(rowNumbers[i]);
  }
}
