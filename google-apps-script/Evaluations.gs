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
 * Recupere une evaluation avec les questions personnalisees pour un eleve
 * Utilise l'attribution de sujet si elle existe, sinon calcule automatiquement
 * la prochaine banque non validee selon la progression
 * @param {Object} data - { id, eleve_id }
 */
function getEvaluationForEleve(data) {
  if (!data.id || !data.eleve_id) {
    return { success: false, error: 'id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Recuperer l'evaluation
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }

  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var evaluation = null;
  for (var i = 1; i < evalData.length; i++) {
    var row = evalData[i];
    var idCol = evalHeaders.indexOf('id');
    if (idCol >= 0 && String(row[idCol]).trim() === String(data.id).trim()) {
      evaluation = {};
      evalHeaders.forEach(function(header, index) {
        evaluation[header] = row[index];
      });
      break;
    }
  }

  if (!evaluation) {
    return { success: false, error: 'Evaluation non trouvee: ' + data.id };
  }

  var type = String(evaluation.type).trim();
  var matiere = String(evaluation.matiere || '').trim();

  // 2. Si pas connaissances/SF, fallback sur getEvaluation classique
  if (type !== 'connaissances' && type !== 'savoir-faire') {
    return getEvaluation(data);
  }

  // 3. Determiner la banque : attribution manuelle ou auto-calcul
  var banqueId = '';
  var entrainementId = '';
  var source = 'auto';

  // 3a. Chercher une attribution existante
  var attrSheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (attrSheet) {
    var attrData = attrSheet.getDataRange().getValues();
    if (attrData.length >= 2) {
      var attrHeaders = attrData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var j = 1; j < attrData.length; j++) {
        var attr = {};
        attrHeaders.forEach(function(header, index) {
          attr[header] = attrData[j][index];
        });
        if (String(attr.evaluation_id).trim() === String(data.id).trim() &&
            String(attr.eleve_id).trim() === String(data.eleve_id).trim()) {
          banqueId = String(attr.banque_id || '').trim();
          entrainementId = String(attr.entrainement_id || '').trim();
          source = String(attr.source || 'auto').trim();
          break;
        }
      }
    }
  }

  // 3b. Si pas d'attribution, calculer automatiquement la prochaine banque
  if (!banqueId) {
    banqueId = computeNextBanque_(ss, type, matiere, String(data.eleve_id).trim());
  }

  if (!banqueId) {
    return { success: false, error: 'Aucune banque disponible pour cette matière' };
  }

  // 4. Charger les questions selon le type
  var result;
  if (type === 'connaissances') {
    result = loadConnQuestionsForEval_(ss, banqueId, entrainementId);
  } else {
    result = loadSFQuestionsForEval_(ss, banqueId);
  }

  evaluation.questions = result.questions || [];
  evaluation.duree = result.duree || evaluation.duree || 15;
  evaluation.attribution = {
    banque_id: banqueId,
    entrainement_id: entrainementId,
    source: source
  };

  return { success: true, data: evaluation };
}

/**
 * Calcule la prochaine banque non validee pour un eleve
 * Lit la progression, trouve la derniere banque validee, retourne la suivante
 * @param {Spreadsheet} ss
 * @param {string} type - 'connaissances' ou 'savoir-faire'
 * @param {string} matiere - 'FR' ou 'HG-EMC'
 * @param {string} eleveId
 * @returns {string} banqueId ou '' si aucune trouvee
 */
function computeNextBanque_(ss, type, matiere, eleveId) {
  // 1. Charger les banques de ce type et matiere, triees par ordre
  var isConn = type === 'connaissances';
  var sheetName = isConn ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banqueSheet = ss.getSheetByName(sheetName);
  if (!banqueSheet) return '';

  var bData = banqueSheet.getDataRange().getValues();
  if (bData.length < 2) return '';
  var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var banques = [];
  for (var i = 1; i < bData.length; i++) {
    var b = {};
    bHeaders.forEach(function(h, idx) { b[h] = bData[i][idx]; });
    if (!b.id) continue;
    // Filtrer par matiere si renseignee
    if (matiere && b.matiere && String(b.matiere).trim() !== matiere) continue;
    // Pour SF, filtrer par type
    if (!isConn && String(b.type || '').trim() !== 'savoir-faire') continue;
    banques.push(b);
  }

  banques.sort(function(a, b) { return (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999); });
  if (banques.length === 0) return '';

  // 2. Chercher la progression de cet eleve
  var progSheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  var lastValidatedId = '';

  if (progSheet) {
    var pData = progSheet.getDataRange().getValues();
    if (pData.length >= 2) {
      var pHeaders = pData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var pi = 1; pi < pData.length; pi++) {
        var p = {};
        pHeaders.forEach(function(h, idx) { p[h] = pData[pi][idx]; });
        if (String(p.eleve_id).trim() === eleveId &&
            String(p.type).trim() === type &&
            (!p.matiere || String(p.matiere).trim() === matiere)) {
          lastValidatedId = String(p.derniere_banque_validee_id || '').trim();
          break;
        }
      }
    }
  }

  // 3. Trouver la prochaine banque
  if (!lastValidatedId) {
    return String(banques[0].id).trim();
  }

  var lastIdx = -1;
  for (var bi = 0; bi < banques.length; bi++) {
    if (String(banques[bi].id).trim() === lastValidatedId) {
      lastIdx = bi;
      break;
    }
  }

  if (lastIdx >= 0 && lastIdx < banques.length - 1) {
    return String(banques[lastIdx + 1].id).trim();
  }

  // Toutes les banques validees → rester sur la derniere
  return String(banques[banques.length - 1].id).trim();
}

/**
 * Charge les questions d'un entrainement connaissances pour une evaluation
 * @param {Spreadsheet} ss
 * @param {string} banqueId
 * @param {string} entrainementId - si vide, prend un entrainement aleatoire de la banque
 * @returns {{ questions: Array, duree: number }}
 */
function loadConnQuestionsForEval_(ss, banqueId, entrainementId) {
  var empty = { questions: [], duree: 15 };

  // 1. Trouver l'entrainement
  var entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!entrSheet) return empty;

  var entrData = entrSheet.getDataRange().getValues();
  if (entrData.length < 2) return empty;
  var entrHeaders = entrData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var banqueEntrs = [];
  for (var i = 1; i < entrData.length; i++) {
    var e = {};
    entrHeaders.forEach(function(h, idx) { e[h] = entrData[i][idx]; });
    if (String(e.banque_exercice_id).trim() === banqueId && e.id) {
      banqueEntrs.push(e);
    }
  }

  if (banqueEntrs.length === 0) return empty;

  var entrainement;
  if (entrainementId) {
    entrainement = banqueEntrs.find(function(e) { return String(e.id).trim() === entrainementId; });
  }
  if (!entrainement) {
    // Aleatoire parmi les entrainements de la banque
    entrainement = banqueEntrs[Math.floor(Math.random() * banqueEntrs.length)];
  }

  // 2. Trouver les etapes de cet entrainement
  var etapesSheet = ss.getSheetByName(SHEETS.ETAPES_CONN);
  if (!etapesSheet) return empty;

  var etapesData = etapesSheet.getDataRange().getValues();
  if (etapesData.length < 2) return empty;
  var etapesHeaders = etapesData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var etapes = [];
  for (var ei = 1; ei < etapesData.length; ei++) {
    var etape = {};
    etapesHeaders.forEach(function(h, idx) { etape[h] = etapesData[ei][idx]; });
    if (String(etape.entrainement_id).trim() === String(entrainement.id).trim()) {
      etapes.push(etape);
    }
  }
  etapes.sort(function(a, b) { return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0); });

  // 3. Trouver les liens etape-questions
  var eqSheet = ss.getSheetByName(SHEETS.ETAPE_QUESTIONS_CONN);
  if (!eqSheet) return empty;

  var eqData = eqSheet.getDataRange().getValues();
  if (eqData.length < 2) return empty;
  var eqHeaders = eqData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var etapeIds = etapes.map(function(et) { return String(et.id).trim(); });
  var questionLinks = [];
  for (var qi = 1; qi < eqData.length; qi++) {
    var ql = {};
    eqHeaders.forEach(function(h, idx) { ql[h] = eqData[qi][idx]; });
    if (etapeIds.indexOf(String(ql.etape_id).trim()) >= 0) {
      questionLinks.push(ql);
    }
  }

  // 4. Charger les questions connaissances
  var qSheet = ss.getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!qSheet) return empty;

  var qData = qSheet.getDataRange().getValues();
  if (qData.length < 2) return empty;
  var qHeaders = qData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var questionsMap = {};
  for (var qj = 1; qj < qData.length; qj++) {
    var q = {};
    qHeaders.forEach(function(h, idx) { q[h] = qData[qj][idx]; });
    if (q.id) questionsMap[String(q.id).trim()] = q;
  }

  // 5. Charger les formats
  var fSheet = ss.getSheetByName(SHEETS.FORMATS_QUESTIONS);
  var formatsMap = {};
  if (fSheet) {
    var fData = fSheet.getDataRange().getValues();
    if (fData.length >= 2) {
      var fHeaders = fData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var fi = 1; fi < fData.length; fi++) {
        var f = {};
        fHeaders.forEach(function(h, idx) { f[h] = fData[fi][idx]; });
        if (f.id) formatsMap[String(f.id).trim()] = f;
        if (f.code) formatsMap[String(f.code).trim()] = f;
      }
    }
  }

  // 6. Assembler les questions dans le format evaluation
  var questions = [];
  var ordre = 1;

  etapes.forEach(function(etape) {
    var etapeQuestions = questionLinks
      .filter(function(ql) { return String(ql.etape_id).trim() === String(etape.id).trim(); })
      .sort(function(a, b) { return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0); });

    etapeQuestions.forEach(function(eq) {
      var question = questionsMap[String(eq.question_id).trim()];
      if (!question) return;

      var donnees = {};
      if (question.donnees) {
        try { donnees = JSON.parse(question.donnees); } catch (_e) { donnees = {}; }
      }

      var formatCode = String(etape.format_code || question.type || '').trim();
      var format = formatsMap[formatCode] || { code: formatCode, type_base: formatCode };

      questions.push({
        id: question.id,
        enonce: question.enonce || question.question || '',
        explication: question.explication || question.correction || '',
        donnees: donnees,
        format: format,
        format_id: format.id || '',
        ordre: ordre++,
        points: 1
      });
    });
  });

  var duree = parseInt(entrainement.duree) || 15;
  return { questions: questions, duree: duree };
}

/**
 * Charge les questions d'un exercice SF pour une evaluation
 * Pour le SF, un exercice aleatoire est choisi dans la banque
 * @param {Spreadsheet} ss
 * @param {string} banqueId
 * @returns {{ questions: Array, duree: number }}
 */
function loadSFQuestionsForEval_(ss, banqueId) {
  var empty = { questions: [], duree: 15 };

  // 1. Trouver les exercices de la banque
  var exSheet = ss.getSheetByName(SHEETS.EXERCICES);
  if (!exSheet) return empty;

  var exData = exSheet.getDataRange().getValues();
  if (exData.length < 2) return empty;
  var exHeaders = exData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  var exercices = [];
  for (var i = 1; i < exData.length; i++) {
    var ex = {};
    exHeaders.forEach(function(h, idx) { ex[h] = exData[i][idx]; });
    if (String(ex.banque_id).trim() === banqueId && ex.id) {
      exercices.push(ex);
    }
  }

  if (exercices.length === 0) return empty;

  // Choisir un exercice aleatoire
  var exercice = exercices[Math.floor(Math.random() * exercices.length)];

  // 2. Charger le format
  var fSheet = ss.getSheetByName(SHEETS.FORMATS_EXERCICES);
  var format = {};
  if (fSheet && exercice.format_id) {
    var fData = fSheet.getDataRange().getValues();
    if (fData.length >= 2) {
      var fHeaders = fData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      for (var fi = 1; fi < fData.length; fi++) {
        var f = {};
        fHeaders.forEach(function(h, idx) { f[h] = fData[fi][idx]; });
        if (String(f.id).trim() === String(exercice.format_id).trim()) {
          format = f;
          break;
        }
      }
    }
  }

  // 3. Assembler dans le format evaluation
  var donnees = {};
  if (exercice.donnees) {
    try { donnees = JSON.parse(exercice.donnees); } catch (_e) { donnees = {}; }
  }

  var duree = parseInt(exercice.duree) || 15;

  return {
    questions: [{
      id: exercice.id,
      enonce: exercice.titre || exercice.enonce || '',
      explication: exercice.correction || '',
      donnees: donnees,
      format: format,
      format_id: format.id || exercice.format_id || '',
      ordre: 1,
      points: 1
    }],
    duree: duree
  };
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

  const updates = ['type', 'titre', 'description', 'chapitre_id', 'statut', 'briques', 'seuil', 'duree', 'date_debut', 'date_fin', 'methodologie_id', 'criteres', 'matiere', 'categorie', 'points_mises', 'entrainement_conn_id', 'source_questions', 'exercice_sf_id'];
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
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'score', 'validations', 'is_validated', 'temps_passe', 'date_passage', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut']);
  }

  // Vérifier si un résultat existe déjà pour cet élève/évaluation (mise à jour)
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour du résultat existant
    var updatableFields = ['score', 'validations', 'is_validated', 'temps_passe', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut'];
    updatableFields.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          var value = data[field];
          if (field === 'is_validated') value = (value === true || value === 'true');
          sheet.getRange(existingRow, colIdx + 1).setValue(value);
        }
      }
    });
    // Mettre à jour la date de passage
    var dateCol = headers.indexOf('date_passage');
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(new Date().toISOString());

    // Mettre a jour la progression evaluation si valide
    var isValidUpdate = data.is_validated === true || data.is_validated === 'true';
    if (isValidUpdate) {
      updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id);
    }

    return { success: true, id: String(allData[existingRow - 1][0]), message: 'Resultat mis a jour' };
  }

  // Nouveau résultat
  const id = 'res_' + new Date().getTime();
  const datePassage = new Date().toISOString();

  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'score') return data.score || 0;
    if (col === 'validations') return data.validations || 0;
    if (col === 'is_validated') return data.is_validated === true || data.is_validated === 'true';
    if (col === 'temps_passe') return data.temps_passe || 0;
    if (col === 'date_passage') return datePassage;
    if (col === 'details') return data.details || '';
    if (col === 'mode') return data.mode || 'numerique';
    if (col === 'source') return data.source || 'auto';
    if (col === 'remarque_texte') return data.remarque_texte || '';
    if (col === 'remarque_media') return data.remarque_media || '';
    if (col === 'statut') return data.statut || '';
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  // Mettre a jour la progression evaluation si valide
  var isValid = data.is_validated === true || data.is_validated === 'true';
  if (isValid) {
    updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id);
  }

  return { success: true, id: id, message: 'Resultat sauvegarde' };
}

/**
 * Met a jour la progression evaluation apres validation d'un resultat
 * Cherche l'attribution de l'eleve pour trouver la banque validée
 * @param {Spreadsheet} ss
 * @param {string} evaluationId
 * @param {string} eleveId
 */
function updateProgressionFromResult_(ss, evaluationId, eleveId) {
  try {
    // 1. Trouver le type de l'evaluation
    var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
    if (!evalSheet) return;

    var evalData = evalSheet.getDataRange().getValues();
    var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evaluation = null;

    for (var i = 1; i < evalData.length; i++) {
      var item = {};
      evalHeaders.forEach(function(header, index) { item[header] = evalData[i][index]; });
      if (String(item.id).trim() === String(evaluationId).trim()) {
        evaluation = item;
        break;
      }
    }

    if (!evaluation) return;
    var type = String(evaluation.type).trim();
    var matiere = String(evaluation.matiere || '').trim();
    if (type !== 'connaissances' && type !== 'savoir-faire') return;

    // 2. Trouver l'attribution de sujet pour cet eleve
    var attrSheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!attrSheet) return;

    var attrData = attrSheet.getDataRange().getValues();
    if (attrData.length < 2) return;
    var attrHeaders = attrData[0].map(function(h) { return String(h).toLowerCase().trim(); });

    var attribution = null;
    for (var j = 1; j < attrData.length; j++) {
      var attr = {};
      attrHeaders.forEach(function(header, index) { attr[header] = attrData[j][index]; });
      if (String(attr.evaluation_id).trim() === String(evaluationId).trim() &&
          String(attr.eleve_id).trim() === String(eleveId).trim()) {
        attribution = attr;
        break;
      }
    }

    if (!attribution || !attribution.banque_id) return;

    // 3. Mettre a jour la progression
    updateProgressionEvaluation_(eleveId, type, matiere, String(attribution.banque_id).trim());
  } catch (e) {
    // Ne pas bloquer la sauvegarde du resultat si la progression echoue
    Logger.log('Erreur updateProgressionFromResult_: ' + e.message);
  }
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

// ========================================
// PARAMETRES NOTES
// Table : PARAMETRES_NOTES
// Colonnes : id, matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin
// ========================================

/**
 * Récupère les paramètres de notes (tous ou filtrés par matière/semestre)
 * @param {Object} data - { matiere?, semestre? }
 */
function getParametresNotes(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PARAMETRES_NOTES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (!item.id) continue;
    if (data.matiere && item.matiere !== data.matiere) continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde les paramètres de notes (crée ou met à jour)
 * @param {Object} data - { matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin }
 */
function saveParametresNotes(data) {
  if (!data.matiere || !data.semestre) {
    return { success: false, error: 'matiere et semestre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PARAMETRES_NOTES);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PARAMETRES_NOTES);
    sheet.appendRow(['id', 'matiere', 'semestre', 'note_depart', 'budget_estime', 'coefficient_progression', 'date_debut', 'date_fin']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Chercher si un paramètre existe déjà pour cette matière/semestre
  var matiereCol = headers.indexOf('matiere');
  var semestreCol = headers.indexOf('semestre');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][matiereCol]).trim() === String(data.matiere).trim() &&
        String(allData[i][semestreCol]).trim() === String(data.semestre).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour
    var updatable = ['note_depart', 'budget_estime', 'coefficient_progression', 'date_debut', 'date_fin'];
    updatable.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          sheet.getRange(existingRow, colIdx + 1).setValue(data[field]);
        }
      }
    });
    return { success: true, message: 'Parametres mis a jour' };
  }

  // Création
  var id = 'pn_' + new Date().getTime();
  var newRow = [
    id,
    data.matiere,
    data.semestre,
    data.note_depart !== undefined ? data.note_depart : 8,
    data.budget_estime !== undefined ? data.budget_estime : 100,
    data.coefficient_progression !== undefined ? data.coefficient_progression : 3,
    data.date_debut || '',
    data.date_fin || ''
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Parametres crees' };
}

// ========================================
// NOTES SOMMATIVES
// Table : NOTES_SOMMATIVES
// Colonnes : id, titre, matiere, bareme, coefficient, date, semestre
// ========================================

/**
 * Récupère les évaluations sommatives
 * @param {Object} data - { matiere?, semestre? }
 */
function getNotesSommatives(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (!item.id) continue;
    if (data.matiere && item.matiere !== data.matiere && item.matiere !== 'Les deux') continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Crée une évaluation sommative
 * @param {Object} data - { titre, matiere, bareme, coefficient, date, semestre }
 */
function createNoteSommative(data) {
  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.NOTES_SOMMATIVES);
    sheet.appendRow(['id', 'titre', 'matiere', 'bareme', 'coefficient', 'date', 'semestre']);
  }

  var id = 'som_' + new Date().getTime();
  var newRow = [
    id,
    data.titre,
    data.matiere || 'FR',
    data.bareme !== undefined ? data.bareme : 20,
    data.coefficient !== undefined ? data.coefficient : 1,
    data.date || '',
    data.semestre || 1
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Sommative creee' };
}

/**
 * Met à jour une évaluation sommative
 * @param {Object} data - { id, titre?, matiere?, bareme?, coefficient?, date?, semestre? }
 */
function updateNoteSommative(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvee' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      var updatable = ['titre', 'matiere', 'bareme', 'coefficient', 'date', 'semestre'];
      updatable.forEach(function(field) {
        if (data[field] !== undefined) {
          var colIdx = headers.indexOf(field);
          if (colIdx >= 0) {
            sheet.getRange(i + 1, colIdx + 1).setValue(data[field]);
          }
        }
      });
      return { success: true, message: 'Sommative mise a jour' };
    }
  }

  return { success: false, error: 'Sommative non trouvee' };
}

/**
 * Supprime une évaluation sommative et ses résultats
 * @param {Object} data - { id }
 */
function deleteNoteSommative(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les résultats associés
  var resSheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);
  if (resSheet) {
    var resData = resSheet.getDataRange().getValues();
    var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var somIdCol = resHeaders.indexOf('sommative_id');
    for (var j = resData.length - 1; j >= 1; j--) {
      if (String(resData[j][somIdCol]).trim() === String(data.id).trim()) {
        resSheet.deleteRow(j + 1);
      }
    }
  }

  // Supprimer la sommative
  var sheet = ss.getSheetByName(SHEETS.NOTES_SOMMATIVES);
  if (!sheet) {
    return { success: false, error: 'Feuille non trouvee' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var idCol = headers.indexOf('id');

  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Sommative supprimee' };
    }
  }

  return { success: false, error: 'Sommative non trouvee' };
}

// ========================================
// RESULTATS SOMMATIVES
// Table : RESULTATS_SOMMATIVES
// Colonnes : id, sommative_id, eleve_id, note, statut, remarque_texte, remarque_media, date_saisie
// ========================================

/**
 * Récupère les résultats des sommatives
 * @param {Object} data - { sommative_id?, eleve_id? }
 */
function getResultatsSommatives(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.sommative_id && String(item.sommative_id).trim() !== String(data.sommative_id).trim()) continue;
    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde un résultat de sommative (crée ou met à jour)
 * @param {Object} data - { sommative_id, eleve_id, note, statut, remarque_texte, remarque_media }
 */
function saveResultatSommative(data) {
  if (!data.sommative_id || !data.eleve_id) {
    return { success: false, error: 'sommative_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.RESULTATS_SOMMATIVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RESULTATS_SOMMATIVES);
    sheet.appendRow(['id', 'sommative_id', 'eleve_id', 'note', 'statut', 'remarque_texte', 'remarque_media', 'date_saisie']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var somIdCol = headers.indexOf('sommative_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][somIdCol]).trim() === String(data.sommative_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mise à jour
    var updatable = ['note', 'statut', 'remarque_texte', 'remarque_media'];
    updatable.forEach(function(field) {
      if (data[field] !== undefined) {
        var colIdx = headers.indexOf(field);
        if (colIdx >= 0) {
          sheet.getRange(existingRow, colIdx + 1).setValue(data[field]);
        }
      }
    });
    var dateCol = headers.indexOf('date_saisie');
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(new Date().toISOString());
    return { success: true, message: 'Resultat sommative mis a jour' };
  }

  // Création
  var id = 'rsom_' + new Date().getTime();
  var newRow = [
    id,
    data.sommative_id,
    data.eleve_id,
    data.note !== undefined ? data.note : '',
    data.statut || '',
    data.remarque_texte || '',
    data.remarque_media || '',
    new Date().toISOString()
  ];

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Resultat sommative sauvegarde' };
}

// ========================================
// OBJECTIFS ELEVES
// Table : OBJECTIFS_ELEVES
// Colonnes : id, eleve_id, matiere, semestre, objectif_note
// ========================================

/**
 * Récupère les objectifs des élèves
 * @param {Object} data - { eleve_id?, matiere?, semestre? }
 */
function getObjectifsEleves(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.OBJECTIFS_ELEVES);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.matiere && item.matiere !== data.matiere) continue;
    if (data.semestre && String(item.semestre) !== String(data.semestre)) continue;

    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde l'objectif d'un élève (crée ou met à jour)
 * @param {Object} data - { eleve_id, matiere, semestre, objectif_note }
 */
function saveObjectifEleve(data) {
  if (!data.eleve_id || !data.matiere || !data.semestre) {
    return { success: false, error: 'eleve_id, matiere et semestre requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.OBJECTIFS_ELEVES);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.OBJECTIFS_ELEVES);
    sheet.appendRow(['id', 'eleve_id', 'matiere', 'semestre', 'objectif_note']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var matiereCol = headers.indexOf('matiere');
  var semestreCol = headers.indexOf('semestre');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][matiereCol]).trim() === String(data.matiere).trim() &&
        String(allData[i][semestreCol]).trim() === String(data.semestre).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    var noteCol = headers.indexOf('objectif_note');
    if (noteCol >= 0) {
      sheet.getRange(existingRow, noteCol + 1).setValue(data.objectif_note);
    }
    return { success: true, message: 'Objectif mis a jour' };
  }

  var id = 'obj_' + new Date().getTime();
  var newRow = [id, data.eleve_id, data.matiere, data.semestre, data.objectif_note || 0];
  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Objectif sauvegarde' };
}

// ========================================
// PROGRESSION EVALUATION
// Table : PROGRESSION_EVALUATION
// Colonnes : id, eleve_id, type, derniere_banque_validee_id, date_validation
// ========================================

/**
 * Recupere la progression evaluation de tous les eleves (ou un seul)
 * @param {Object} data - { eleve_id?, type? }
 */
function getProgressionEvaluation(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (data.eleve_id && String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.type && String(item.type).trim() !== String(data.type).trim()) continue;

    if (item.id) result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Avance la progression evaluation d'un eleve apres validation
 * Appelé quand is_validated=true lors de saveEvaluationResult
 * @param {string} eleveId
 * @param {string} type - 'connaissances' ou 'savoir-faire'
 * @param {string} matiere - 'FR' ou 'HG-EMC'
 * @param {string} banqueId - ID de la banque validée
 */
function updateProgressionEvaluation_(eleveId, type, matiere, banqueId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_EVALUATION);
    sheet.appendRow(['id', 'eleve_id', 'type', 'matiere', 'derniere_banque_validee_id', 'date_validation']);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var typeCol = headers.indexOf('type');
  var matiereCol = headers.indexOf('matiere');
  var banqueCol = headers.indexOf('derniere_banque_validee_id');
  var dateCol = headers.indexOf('date_validation');
  var existingRow = -1;

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(eleveId).trim() &&
        String(allData[i][typeCol]).trim() === String(type).trim() &&
        (matiereCol < 0 || String(allData[i][matiereCol]).trim() === String(matiere).trim())) {
      existingRow = i + 1;
      break;
    }
  }

  var now = new Date().toISOString();

  if (existingRow > 0) {
    if (banqueCol >= 0) sheet.getRange(existingRow, banqueCol + 1).setValue(banqueId);
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(now);
  } else {
    var id = 'progeval_' + new Date().getTime();
    sheet.appendRow([id, eleveId, type, matiere || '', banqueId, now]);
  }
}

// ========================================
// ATTRIBUTION SUJETS
// Table : ATTRIBUTION_SUJETS
// Colonnes : id, evaluation_id, eleve_id, banque_id, entrainement_id, source
// ========================================

/**
 * Recupere les attributions pour une evaluation
 * @param {Object} data - { evaluation_id }
 */
function getAttributionsSujets(data) {
  if (!data.evaluation_id) {
    return { success: false, error: 'evaluation_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (String(item.evaluation_id).trim() === String(data.evaluation_id).trim() && item.id) {
      result.push(item);
    }
  }

  return { success: true, data: result };
}

/**
 * Sauvegarde les attributions de sujets pour une evaluation
 * Remplace toutes les attributions existantes pour cette evaluation
 * @param {Object} data - { evaluation_id, attributions: JSON string of [{eleve_id, banque_id, entrainement_id, source}] }
 */
function saveAttributionsSujets(data) {
  if (!data.evaluation_id || !data.attributions) {
    return { success: false, error: 'evaluation_id et attributions requis' };
  }

  var attributions;
  try {
    attributions = typeof data.attributions === 'string' ? JSON.parse(data.attributions) : data.attributions;
  } catch (e) {
    return { success: false, error: 'Format attributions invalide' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
  }

  // Supprimer les attributions existantes pour cette evaluation
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');

  // Parcourir de bas en haut pour supprimer sans décalage
  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim()) {
      sheet.deleteRow(i + 1);
    }
  }

  // Inserer les nouvelles attributions
  var timestamp = new Date().getTime();
  for (var j = 0; j < attributions.length; j++) {
    var attr = attributions[j];
    var id = 'attr_' + timestamp + '_' + j;
    sheet.appendRow([
      id,
      data.evaluation_id,
      attr.eleve_id || '',
      attr.banque_id || '',
      attr.entrainement_id || '',
      attr.source || 'auto'
    ]);
  }

  return { success: true, message: attributions.length + ' attributions sauvegardees' };
}

/**
 * Recupere l'attribution de sujet pour un eleve specifique sur une evaluation
 * Utilise par le frontend eleve pour savoir quel sujet passer
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function getAttributionSujetEleve(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
  if (!sheet) {
    return { success: true, data: null };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: null };
  }

  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    if (String(item.evaluation_id).trim() === String(data.evaluation_id).trim() &&
        String(item.eleve_id).trim() === String(data.eleve_id).trim()) {
      return { success: true, data: item };
    }
  }

  return { success: true, data: null };
}

