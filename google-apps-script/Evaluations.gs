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

  // Vérifier que l'évaluation est accessible (pas brouillon, pas planifiée)
  var effectiveStatut = _computeEffectiveStatut_(evaluation);
  if (effectiveStatut === 'brouillon') {
    return { success: false, error: 'Cette évaluation n\'est pas encore disponible' };
  }
  if (effectiveStatut === 'planifiee') {
    return { success: false, error: 'Cette évaluation n\'est pas encore ouverte' };
  }
  if (effectiveStatut === 'terminee') {
    return { success: false, error: 'Cette évaluation est terminée' };
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
  //     et la sauvegarder dans ATTRIBUTION_SUJETS pour verrouiller le sujet
  if (!banqueId) {
    banqueId = computeNextBanque_(ss, type, matiere, String(data.eleve_id).trim());
    if (banqueId) {
      source = 'auto';
      // Sauvegarder l'attribution pour que le prochain appel retombe sur la même banque
      saveAutoAttribution_(ss, String(data.id).trim(), String(data.eleve_id).trim(), banqueId, '', source);
    }
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

  evaluation.duree = result.duree || evaluation.duree || 15;

  // Retourner l'ID de l'exercice effectivement choisi (peut différer si aléatoire)
  var actualEntrainementId = entrainementId;
  if (type === 'connaissances' && result.entrainement && result.entrainement.id) {
    actualEntrainementId = String(result.entrainement.id).trim();
  } else if (type === 'savoir-faire' && result.questions && result.questions.length > 0) {
    actualEntrainementId = String(result.questions[0].id || '').trim();
  }

  // Mettre à jour l'entrainement_id dans l'attribution si auto (tirage aléatoire)
  if (source === 'auto' && actualEntrainementId && actualEntrainementId !== entrainementId) {
    updateAttributionEntrainement_(ss, String(data.id).trim(), String(data.eleve_id).trim(), actualEntrainementId);
  }

  // 5. Recuperer le titre de la banque pour le message conseil
  var banqueTitre = '';
  var banqueSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banqueSheet = ss.getSheetByName(banqueSheetName);
  if (banqueSheet) {
    var bData = banqueSheet.getDataRange().getValues();
    if (bData.length >= 2) {
      var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var bIdCol = bHeaders.indexOf('id');
      var bTitreCol = bHeaders.indexOf('titre');
      if (bIdCol >= 0 && bTitreCol >= 0) {
        for (var k = 1; k < bData.length; k++) {
          if (String(bData[k][bIdCol]).trim() === String(banqueId).trim()) {
            banqueTitre = String(bData[k][bTitreCol]).trim();
            break;
          }
        }
      }
    }
  }

  evaluation.attribution = {
    banque_id: banqueId,
    entrainement_id: actualEntrainementId,
    source: source,
    banque_titre: banqueTitre
  };

  // Pour connaissances : retourner les donnees structurees par etape
  // (meme format que le module d'entrainement)
  if (type === 'connaissances') {
    evaluation.etapes = result.etapes || [];
    evaluation.etapeQuestions = result.etapeQuestions || [];
    evaluation.questionsConnaissances = result.questions || [];
    evaluation.entrainementData = result.entrainement || {};
  } else {
    // SF : garder le format plat
    evaluation.questions = result.questions || [];
  }

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
    // "Les deux" accepte toutes les banques (FR et HG-EMC)
    if (matiere && matiere !== 'Les deux' && b.matiere && String(b.matiere).trim() !== matiere) continue;
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
            (!p.matiere || matiere === 'Les deux' || String(p.matiere).trim() === matiere)) {
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
 * Sauvegarde une attribution automatique dans ATTRIBUTION_SUJETS
 * pour verrouiller le sujet lors des prochains appels.
 * @param {Spreadsheet} ss
 * @param {string} evaluationId
 * @param {string} eleveId
 * @param {string} banqueId
 * @param {string} entrainementId
 * @param {string} source
 */
function saveAutoAttribution_(ss, evaluationId, eleveId, banqueId, entrainementId, source) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
      sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
    }
    var id = 'attr_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 4);
    sheet.appendRow([id, evaluationId, eleveId, banqueId, entrainementId || '', source || 'auto']);
  } catch (e) {
    // Silencieux : ne pas bloquer l'évaluation si la sauvegarde échoue
    Logger.log('saveAutoAttribution_ erreur: ' + e.message);
  }
}

/**
 * Met à jour l'entrainement_id dans ATTRIBUTION_SUJETS (après tirage aléatoire)
 */
function updateAttributionEntrainement_(ss, evaluationId, eleveId, entrainementId) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) return;
    var allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return;
    var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evalCol = headers.indexOf('evaluation_id');
    var eleveCol = headers.indexOf('eleve_id');
    var entCol = headers.indexOf('entrainement_id');
    if (evalCol < 0 || eleveCol < 0 || entCol < 0) return;
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][evalCol]).trim() === evaluationId &&
          String(allData[i][eleveCol]).trim() === eleveId) {
        sheet.getRange(i + 1, entCol + 1).setValue(entrainementId);
        break;
      }
    }
  } catch (e) {
    Logger.log('updateAttributionEntrainement_ erreur: ' + e.message);
  }
}

/**
 * Synchronise ATTRIBUTION_SUJETS avec la banque/exercice réellement passés par l'élève.
 * Met à jour la ligne existante ou en crée une nouvelle.
 */
function syncAttributionFromResult_(ss, evaluationId, eleveId, banqueId, entrainementId) {
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
    if (!sheet) {
      sheet = ss.insertSheet(SHEETS.ATTRIBUTION_SUJETS);
      sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'banque_id', 'entrainement_id', 'source']);
    }
    var allData = sheet.getDataRange().getValues();
    var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var evalCol = headers.indexOf('evaluation_id');
    var eleveCol = headers.indexOf('eleve_id');
    var banqueCol = headers.indexOf('banque_id');
    var entCol = headers.indexOf('entrainement_id');
    if (evalCol < 0 || eleveCol < 0) return;

    // Chercher une ligne existante
    for (var i = 1; i < allData.length; i++) {
      if (String(allData[i][evalCol]).trim() === String(evaluationId).trim() &&
          String(allData[i][eleveCol]).trim() === String(eleveId).trim()) {
        // Mettre à jour banque + exercice
        if (banqueCol >= 0) sheet.getRange(i + 1, banqueCol + 1).setValue(banqueId);
        if (entCol >= 0) sheet.getRange(i + 1, entCol + 1).setValue(entrainementId);
        return;
      }
    }

    // Pas de ligne existante → en créer une
    var id = 'attr_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 4);
    sheet.appendRow([id, evaluationId, eleveId, banqueId, entrainementId || '', 'auto']);
  } catch (e) {
    Logger.log('syncAttributionFromResult_ erreur: ' + e.message);
  }
}

/**
 * Charge les donnees d'un entrainement connaissances pour une evaluation.
 * Retourne les etapes, liens etape-questions et questions dans le meme format
 * que le module d'entrainement (EleveConnaissances) pour reutiliser le moteur de rendu.
 * @param {Spreadsheet} ss
 * @param {string} banqueId
 * @param {string} entrainementId - si vide, prend un entrainement aleatoire de la banque
 * @returns {{ etapes: Array, etapeQuestions: Array, questions: Array, duree: number, entrainement: Object }}
 */
function loadConnQuestionsForEval_(ss, banqueId, entrainementId) {
  var empty = { etapes: [], etapeQuestions: [], questions: [], duree: 15, entrainement: {} };

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
  var etapeQuestions = [];
  for (var qi = 1; qi < eqData.length; qi++) {
    var ql = {};
    eqHeaders.forEach(function(h, idx) { ql[h] = eqData[qi][idx]; });
    if (etapeIds.indexOf(String(ql.etape_id).trim()) >= 0) {
      etapeQuestions.push(ql);
    }
  }

  // 4. Charger les questions connaissances
  var qSheet = ss.getSheetByName(SHEETS.QUESTIONS_CONNAISSANCES);
  if (!qSheet) return empty;

  var qData = qSheet.getDataRange().getValues();
  if (qData.length < 2) return empty;
  var qHeaders = qData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Collecter les IDs de questions necessaires
  var neededQuestionIds = {};
  etapeQuestions.forEach(function(eq) {
    neededQuestionIds[String(eq.question_id).trim()] = true;
  });

  var questions = [];
  for (var qj = 1; qj < qData.length; qj++) {
    var q = {};
    qHeaders.forEach(function(h, idx) { q[h] = qData[qj][idx]; });
    if (q.id && neededQuestionIds[String(q.id).trim()]) {
      questions.push(q);
    }
  }

  var duree = parseInt(entrainement.duree) || 15;
  return {
    etapes: etapes,
    etapeQuestions: etapeQuestions,
    questions: questions,
    duree: duree,
    entrainement: {
      id: entrainement.id,
      titre: entrainement.titre || '',
      duree: duree,
      seuil: parseInt(entrainement.seuil) || 80
    }
  };
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

  // Migration progressive : ajouter les colonnes manquantes
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var requiredCols = ['date_ouverture', 'date_fermeture', 'mode_passation',
    'sous_type_comp', 'sous_type_bonus', 'nb_validations', 'competence_id', 'banque_comp_id',
    'exercice_comp_id', 'banque_tc_id', 'exercice_tc_id', 'banque_bonus_id', 'exercice_bonus_id',
    'points_par_competence', 'competence_ids'];
  requiredCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(col);
      headerNames.push(col);
    }
  });

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

  const updates = ['type', 'titre', 'description', 'chapitre_id', 'statut', 'briques', 'seuil', 'duree', 'date_debut', 'date_fin', 'date_ouverture', 'date_fermeture', 'methodologie_id', 'criteres', 'matiere', 'categorie', 'points_mises', 'entrainement_conn_id', 'source_questions', 'exercice_sf_id', 'mode_passation', 'sous_type_comp', 'sous_type_bonus', 'nb_validations', 'competence_id', 'banque_comp_id', 'exercice_comp_id', 'banque_tc_id', 'exercice_tc_id', 'banque_bonus_id', 'exercice_bonus_id', 'points_par_competence', 'competence_ids'];
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
  var evalId = String(data.id).trim();

  // 1. Lire l'évaluation pour connaître type/matière (nécessaire pour recalcul progression)
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) {
    return { success: false, error: 'Sheet EVALUATIONS non trouve' };
  }
  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = evalHeaders.indexOf('id');
  var evaluation = null;
  var evalRow = -1;

  for (var i = 1; i < evalData.length; i++) {
    if (String(evalData[i][evalIdCol]).trim() === evalId) {
      evaluation = {};
      evalHeaders.forEach(function(h, idx) { evaluation[h] = evalData[i][idx]; });
      evalRow = i + 1;
      break;
    }
  }

  if (!evaluation) {
    return { success: false, error: 'Evaluation non trouvee' };
  }

  var type = String(evaluation.type || '').trim();
  var matiere = String(evaluation.matiere || '').trim();

  // 2. Collecter les élèves ayant un résultat validé (pour recalcul progression)
  var affectedEleves = [];
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (resSheet && resSheet.getLastRow() > 1) {
    var resData = resSheet.getDataRange().getValues();
    var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var resEvalCol = resHeaders.indexOf('evaluation_id');
    var resEleveCol = resHeaders.indexOf('eleve_id');
    var resValidCol = resHeaders.indexOf('is_validated');

    for (var j = 1; j < resData.length; j++) {
      if (String(resData[j][resEvalCol]).trim() === evalId) {
        var isValid = resData[j][resValidCol] === true || String(resData[j][resValidCol]).toUpperCase() === 'TRUE';
        if (isValid) {
          affectedEleves.push(String(resData[j][resEleveCol]).trim());
        }
      }
    }
  }

  // 3. Supprimer en cascade (ordre inverse des dépendances)
  deleteRowsByValue_(ss, SHEETS.EVALUATION_QUESTIONS, 'evaluation_id', evalId);
  deleteRowsByValue_(ss, SHEETS.EVALUATION_RESULTATS, 'evaluation_id', evalId);
  deleteRowsByValue_(ss, SHEETS.ATTRIBUTION_SUJETS, 'evaluation_id', evalId);

  // 4. Supprimer l'évaluation elle-même
  evalSheet.deleteRow(evalRow);

  // 5. Recalculer la progression pour les élèves affectés
  if (affectedEleves.length > 0 && (type === 'connaissances' || type === 'savoir-faire')) {
    try {
      recalcProgressionForEleves_(ss, affectedEleves, type, matiere);
    } catch (e) {
      Logger.log('Erreur recalcul progression après suppression: ' + e.message);
    }
  }

  return { success: true, message: 'Evaluation et donnees associees supprimees' };
}

/**
 * Recalcule la progression pour une liste d'élèves après suppression d'une évaluation.
 * Parcourt tous les résultats validés restants pour trouver la dernière banque validée.
 */
function recalcProgressionForEleves_(ss, eleveIds, type, matiere) {
  // Charger toutes les évaluations du même type/matière
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  if (!evalSheet) return;
  var evalData = evalSheet.getDataRange().getValues();
  var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var sameTypeEvalIds = new Set();
  for (var i = 1; i < evalData.length; i++) {
    var ev = {};
    evalHeaders.forEach(function(h, idx) { ev[h] = evalData[i][idx]; });
    if (String(ev.type).trim() === type &&
        (String(ev.matiere || '').trim() === matiere || String(ev.matiere || '').trim() === 'Les deux')) {
      sameTypeEvalIds.add(String(ev.id).trim());
    }
  }

  // Charger les banques triées par ordre
  var banquesSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
  var banquesSheet = ss.getSheetByName(banquesSheetName);
  var banques = [];
  if (banquesSheet && banquesSheet.getLastRow() > 1) {
    var bData = banquesSheet.getDataRange().getValues();
    var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    for (var b = 1; b < bData.length; b++) {
      var bq = {};
      bHeaders.forEach(function(h, idx) { bq[h] = bData[b][idx]; });
      var bqMatiere = String(bq.matiere || '').trim();
      if (!bqMatiere || bqMatiere === matiere || bqMatiere === 'Les deux') {
        banques.push(bq);
      }
    }
  }
  banques.sort(function(a, b) { return (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999); });
  var banqueOrder = {};
  banques.forEach(function(bq, idx) { banqueOrder[String(bq.id).trim()] = idx; });

  // Charger tous les résultats
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!resSheet || resSheet.getLastRow() <= 1) {
    // Plus aucun résultat → supprimer les progressions
    eleveIds.forEach(function(eid) {
      deleteProgressionEvaluation_(ss, eid, type, matiere);
    });
    return;
  }
  var resData = resSheet.getDataRange().getValues();
  var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });

  // Pour chaque élève affecté, trouver la banque validée la plus avancée
  eleveIds.forEach(function(eleveId) {
    var lastValidatedIdx = -1;
    var lastBanqueId = '';

    for (var r = 1; r < resData.length; r++) {
      var res = {};
      resHeaders.forEach(function(h, idx) { res[h] = resData[r][idx]; });

      if (String(res.eleve_id).trim() !== eleveId) continue;
      if (!sameTypeEvalIds.has(String(res.evaluation_id).trim())) continue;
      var isValid = res.is_validated === true || String(res.is_validated).toUpperCase() === 'TRUE';
      if (!isValid) continue;

      var bid = String(res.banque_id || '').trim();
      if (bid && banqueOrder[bid] !== undefined && banqueOrder[bid] > lastValidatedIdx) {
        lastValidatedIdx = banqueOrder[bid];
        lastBanqueId = bid;
      }
    }

    if (lastBanqueId) {
      updateProgressionEvaluation_(eleveId, type, matiere, lastBanqueId);
    } else {
      // Plus aucune banque validée → supprimer la progression
      deleteProgressionEvaluation_(ss, eleveId, type, matiere);
    }
  });
}

/**
 * Supprime la ligne de progression d'un élève pour un type/matière donné.
 */
function deleteProgressionEvaluation_(ss, eleveId, type, matiere) {
  var sheet = ss.getSheetByName(SHEETS.PROGRESSION_EVALUATION);
  if (!sheet || sheet.getLastRow() <= 1) return;

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var eleveIdCol = headers.indexOf('eleve_id');
  var typeCol = headers.indexOf('type');
  var matiereCol = headers.indexOf('matiere');

  for (var i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][eleveIdCol]).trim() === String(eleveId).trim() &&
        String(allData[i][typeCol]).trim() === String(type).trim() &&
        (matiereCol < 0 || String(allData[i][matiereCol]).trim() === String(matiere).trim())) {
      sheet.deleteRow(i + 1);
    }
  }
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
    sheet.appendRow(['id', 'evaluation_id', 'eleve_id', 'score', 'validations', 'is_validated', 'temps_passe', 'date_passage', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut', 'banque_id', 'entrainement_id']);
  }

  // Migration progressive : ajouter les colonnes manquantes
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var migrationCols = ['banque_id', 'entrainement_id', 'correction_html', 'detailed_results', 'statut_resultat',
    'validation_numero', 'competence_ids_validees', 'demande_statut', 'date_demande', 'date_acceptation', 'date_rendu'];
  migrationCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

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
    // banque_id et entrainement_id ne sont PAS dans cette liste :
    // ils sont posés à la création et ne doivent pas être écrasés lors d'un repassage
    var updatableFields = ['score', 'validations', 'is_validated', 'temps_passe', 'details', 'mode', 'source', 'remarque_texte', 'remarque_media', 'statut', 'statut_resultat', 'correction_html', 'detailed_results'];
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
    // Mettre à jour la date de passage (manuelle si fournie, sinon auto)
    var dateCol = headers.indexOf('date_passage');
    if (dateCol >= 0) {
      var dateValue = data.date_passage ? data.date_passage : new Date().toISOString();
      sheet.getRange(existingRow, dateCol + 1).setValue(dateValue);
    }

    // Mettre a jour la progression evaluation si valide
    var isValidUpdate = data.is_validated === true || data.is_validated === 'true';
    if (isValidUpdate) {
      updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id || '');
    }

    // Auto-terminée : si évaluation papier et saisie manuelle, passer en terminée
    autoTerminePapier_(ss, data.evaluation_id);

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
    if (col === 'date_passage') return data.date_passage || datePassage;
    if (col === 'details') return data.details || '';
    if (col === 'mode') return data.mode || 'numerique';
    if (col === 'source') return data.source || 'auto';
    if (col === 'remarque_texte') return data.remarque_texte || '';
    if (col === 'remarque_media') return data.remarque_media || '';
    if (col === 'statut') return data.statut || '';
    if (col === 'banque_id') return data.banque_id || '';
    if (col === 'entrainement_id') return data.entrainement_id || '';
    if (col === 'correction_html') return data.correction_html || '';
    if (col === 'detailed_results') return data.detailed_results || '';
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  // Synchroniser ATTRIBUTION_SUJETS avec la banque/exercice réellement passés
  if (data.banque_id) {
    syncAttributionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id, data.entrainement_id || '');
  }

  // Mettre a jour la progression evaluation si valide
  var isValid = data.is_validated === true || data.is_validated === 'true';
  if (isValid) {
    updateProgressionFromResult_(ss, data.evaluation_id, data.eleve_id, data.banque_id || '');
  }

  // Auto-terminée : si évaluation papier et saisie manuelle, passer en terminée
  autoTerminePapier_(ss, data.evaluation_id);

  return { success: true, id: id, message: 'Resultat sauvegarde' };
}

/**
 * Si l'evaluation est en mode papier et pas encore terminee, passe son statut a 'terminee'
 * Appelee automatiquement apres chaque saisie de resultat
 */
function autoTerminePapier_(ss, evaluationId) {
  try {
    var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
    if (!evalSheet) return;

    var evalData = evalSheet.getDataRange().getValues();
    var headers = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    var idCol = headers.indexOf('id');
    var modeCol = headers.indexOf('mode_passation');
    var statutCol = headers.indexOf('statut');
    if (idCol < 0 || modeCol < 0 || statutCol < 0) return;

    for (var i = 1; i < evalData.length; i++) {
      if (String(evalData[i][idCol]).trim() === String(evaluationId).trim()) {
        var mode = String(evalData[i][modeCol]).trim().toLowerCase();
        var statut = String(evalData[i][statutCol]).trim().toLowerCase();
        if (mode === 'papier' && statut !== 'terminee') {
          evalSheet.getRange(i + 1, statutCol + 1).setValue('terminee');
        }
        break;
      }
    }
  } catch (e) {
    // Non bloquant
  }
}

/**
 * Met a jour la progression evaluation apres validation d'un resultat
 * Utilise la banque_id passee en parametre (depuis le resultat), ou cherche dans ATTRIBUTION_SUJETS en fallback
 * @param {Spreadsheet} ss
 * @param {string} evaluationId
 * @param {string} eleveId
 * @param {string} banqueIdFromResult - banque_id provenant du resultat (prioritaire)
 */
function updateProgressionFromResult_(ss, evaluationId, eleveId, banqueIdFromResult) {
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

    // 2. Determiner la banque : priorite au parametre, sinon fallback sur ATTRIBUTION_SUJETS
    var banqueId = banqueIdFromResult ? String(banqueIdFromResult).trim() : '';

    if (!banqueId) {
      var attrSheet = ss.getSheetByName(SHEETS.ATTRIBUTION_SUJETS);
      if (attrSheet) {
        var attrData = attrSheet.getDataRange().getValues();
        if (attrData.length >= 2) {
          var attrHeaders = attrData[0].map(function(h) { return String(h).toLowerCase().trim(); });
          for (var j = 1; j < attrData.length; j++) {
            var attr = {};
            attrHeaders.forEach(function(header, index) { attr[header] = attrData[j][index]; });
            if (String(attr.evaluation_id).trim() === String(evaluationId).trim() &&
                String(attr.eleve_id).trim() === String(eleveId).trim()) {
              banqueId = String(attr.banque_id || '').trim();
              break;
            }
          }
        }
      }
    }

    if (!banqueId) return;

    // 3. Mettre a jour la progression
    updateProgressionEvaluation_(eleveId, type, matiere, banqueId);
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
 * Recupere un resultat d'evaluation avec les infos enrichies pour le mode review
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function getEvaluationResultForReview(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Trouver le resultat
  var resSheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!resSheet) {
    return { success: false, error: 'Aucun resultat trouve' };
  }

  var resData = resSheet.getDataRange().getValues();
  var resHeaders = resData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var resultat = null;

  for (var i = 1; i < resData.length; i++) {
    var row = {};
    resHeaders.forEach(function(h, idx) { row[h] = resData[i][idx]; });
    if (String(row.evaluation_id).trim() === String(data.evaluation_id).trim() &&
        String(row.eleve_id).trim() === String(data.eleve_id).trim()) {
      resultat = row;
      break;
    }
  }

  if (!resultat) {
    return { success: false, error: 'Resultat non trouve' };
  }

  // Parser JSON fields
  if (resultat.details) {
    try { resultat.details = JSON.parse(resultat.details); } catch (e) { /* keep string */ }
  }
  if (resultat.detailed_results) {
    try { resultat.detailed_results = JSON.parse(resultat.detailed_results); } catch (e) { /* keep string */ }
  }

  // 2. Recuperer les infos de l'evaluation
  var evalSheet = ss.getSheetByName(SHEETS.EVALUATIONS);
  var evaluation = null;
  if (evalSheet) {
    var evalData = evalSheet.getDataRange().getValues();
    var evalHeaders = evalData[0].map(function(h) { return String(h).toLowerCase().trim(); });
    for (var j = 1; j < evalData.length; j++) {
      var evalRow = {};
      evalHeaders.forEach(function(h, idx) { evalRow[h] = evalData[j][idx]; });
      if (String(evalRow.id).trim() === String(data.evaluation_id).trim()) {
        evaluation = evalRow;
        break;
      }
    }
  }

  // 3. Recuperer le titre de la banque si banque_id present
  var banqueTitre = '';
  if (resultat.banque_id && evaluation) {
    var type = String(evaluation.type || '').trim();
    var bSheetName = type === 'connaissances' ? SHEETS.BANQUES_EXERCICES_CONN : SHEETS.BANQUES_EXERCICES;
    var bSheet = ss.getSheetByName(bSheetName);
    if (bSheet) {
      var bData = bSheet.getDataRange().getValues();
      var bHeaders = bData[0].map(function(h) { return String(h).toLowerCase().trim(); });
      var bIdCol = bHeaders.indexOf('id');
      var bTitreCol = bHeaders.indexOf('titre');
      if (bIdCol >= 0 && bTitreCol >= 0) {
        for (var k = 1; k < bData.length; k++) {
          if (String(bData[k][bIdCol]).trim() === String(resultat.banque_id).trim()) {
            banqueTitre = String(bData[k][bTitreCol]).trim();
            break;
          }
        }
      }
    }
  }

  return {
    success: true,
    data: {
      resultat: resultat,
      evaluation: evaluation,
      banque_titre: banqueTitre
    }
  };
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

    // Calculer le statut effectif depuis les dates
    var effectiveStatut = _computeEffectiveStatut_(item);
    // Ne garder que les évaluations visibles pour les élèves (planifiée, publiée, terminée)
    if (effectiveStatut !== 'planifiee' && effectiveStatut !== 'publiee' && effectiveStatut !== 'terminee') continue;
    item.statut = effectiveStatut;

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

// ========================================
// HELPERS — STATUT EFFECTIF
// ========================================

/**
 * Calcule le statut effectif d'une évaluation à partir de ses dates.
 * Brouillon = décision manuelle de la prof, jamais écrasé.
 * Papier = pas d'auto-calcul depuis les dates.
 * @param {Object} evaluation - objet avec statut, date_ouverture, date_fermeture, mode_passation
 * @returns {string} statut effectif ('brouillon', 'planifiee', 'publiee', 'terminee')
 */
function _computeEffectiveStatut_(evaluation) {
  var statut = String(evaluation.statut || 'brouillon').trim();
  if (statut === 'brouillon') return 'brouillon';
  if (String(evaluation.mode_passation || '').trim() === 'papier') return statut;

  var now = new Date();
  var dateOuverture = evaluation.date_ouverture ? new Date(evaluation.date_ouverture) : null;
  var dateFermeture = evaluation.date_fermeture ? new Date(evaluation.date_fermeture) : null;

  if (!dateOuverture && !dateFermeture) return statut;

  if (dateOuverture && !isNaN(dateOuverture.getTime()) && dateOuverture > now) return 'planifiee';
  if (dateFermeture && !isNaN(dateFermeture.getTime()) && dateFermeture < now) return 'terminee';
  return 'publiee';
}

// ========================================
// WORKFLOW DEMANDE D'ÉVALUATION (bonus / tâches complexes)
// États : demande → accepte → soumis → corrige
// ========================================

/**
 * Élève demande à passer une évaluation (bonus compétence, bonus ponctuel, tâche complexe sur demande)
 * Crée un résultat avec demande_statut='demande'
 * @param {Object} data - { evaluation_id, eleve_id }
 */
function demanderEvaluation(data) {
  if (!data.evaluation_id || !data.eleve_id) {
    return { success: false, error: 'evaluation_id et eleve_id requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet EVALUATION_RESULTATS non trouvée' };
  }

  // Migration progressive
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var migrationCols = ['demande_statut', 'date_demande', 'date_acceptation', 'date_rendu'];
  migrationCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  // Vérifier qu'il n'y a pas déjà une demande en cours
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var demandeCol = headers.indexOf('demande_statut');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      var existingStatut = demandeCol >= 0 ? String(allData[i][demandeCol]).trim() : '';
      if (existingStatut === 'demande' || existingStatut === 'accepte') {
        return { success: false, error: 'Une demande est déjà en cours' };
      }
    }
  }

  // Créer le résultat avec statut demande
  var id = 'res_' + new Date().getTime();
  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'demande_statut') return 'demande';
    if (col === 'date_demande') return new Date().toISOString();
    if (col === 'source') return 'demande_eleve';
    return '';
  });

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Demande enregistrée' };
}

/**
 * Prof accepte ou refuse une demande d'évaluation
 * @param {Object} data - { evaluation_id, eleve_id, decision: 'accepte'|'refuse', date_rendu?, type_date?: 'passage_classe'|'date_butoir', remarque_prof? }
 */
function repondreDemandeEvaluation(data) {
  if (!data.evaluation_id || !data.eleve_id || !data.decision) {
    return { success: false, error: 'evaluation_id, eleve_id et decision requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet non trouvée' };
  }

  // Migration progressive — ajouter les colonnes manquantes
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  var migrationCols = ['type_date', 'remarque_prof'];
  migrationCols.forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var demandeCol = headers.indexOf('demande_statut');
  var dateAcceptCol = headers.indexOf('date_acceptation');
  var dateRenduCol = headers.indexOf('date_rendu');
  var typeDateCol = headers.indexOf('type_date');
  var remarqueProfCol = headers.indexOf('remarque_prof');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        demandeCol >= 0 && String(allData[i][demandeCol]).trim() === 'demande') {
      // Mettre à jour le statut
      sheet.getRange(i + 1, demandeCol + 1).setValue(data.decision);
      if (dateAcceptCol >= 0) {
        sheet.getRange(i + 1, dateAcceptCol + 1).setValue(new Date().toISOString());
      }
      if (data.date_rendu && dateRenduCol >= 0) {
        sheet.getRange(i + 1, dateRenduCol + 1).setValue(data.date_rendu);
      }
      if (data.type_date && typeDateCol >= 0) {
        sheet.getRange(i + 1, typeDateCol + 1).setValue(data.type_date);
      }
      if (data.remarque_prof && remarqueProfCol >= 0) {
        sheet.getRange(i + 1, remarqueProfCol + 1).setValue(data.remarque_prof);
      }
      return { success: true, message: 'Demande ' + data.decision };
    }
  }

  return { success: false, error: 'Demande non trouvée' };
}

/**
 * Sauvegarde une validation de suivi (bonus suivi — ex: gestion du matériel)
 * Incrémente le compteur de validations pour un élève
 * @param {Object} data - { evaluation_id, eleve_id, validation_numero }
 */
function saveValidationSuivi(data) {
  if (!data.evaluation_id || !data.eleve_id || !data.validation_numero) {
    return { success: false, error: 'evaluation_id, eleve_id et validation_numero requis' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EVALUATION_RESULTATS);
  if (!sheet) {
    return { success: false, error: 'Sheet non trouvée' };
  }

  // Migration progressive
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headerNames = headerRow.map(function(h) { return String(h).toLowerCase().trim(); });
  ['validation_numero'].forEach(function(col) {
    if (headerNames.indexOf(col) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headerNames.push(col);
    }
  });

  // Chercher un résultat existant pour cet élève/évaluation
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var evalIdCol = headers.indexOf('evaluation_id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var validNumCol = headers.indexOf('validation_numero');
  var validationsCol = headers.indexOf('validations');
  var dateCol = headers.indexOf('date_passage');

  var existingRow = -1;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][evalIdCol]).trim() === String(data.evaluation_id).trim() &&
        String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim()) {
      existingRow = i + 1;
      break;
    }
  }

  if (existingRow > 0) {
    // Mettre à jour le nombre de validations et la date
    if (validNumCol >= 0) sheet.getRange(existingRow, validNumCol + 1).setValue(data.validation_numero);
    if (validationsCol >= 0) sheet.getRange(existingRow, validationsCol + 1).setValue(data.validation_numero);
    if (dateCol >= 0) sheet.getRange(existingRow, dateCol + 1).setValue(new Date().toISOString());
    return { success: true, message: 'Validation ' + data.validation_numero + ' enregistrée' };
  }

  // Créer un nouveau résultat
  var id = 'res_' + new Date().getTime();
  var newRow = headers.map(function(col) {
    if (col === 'id') return id;
    if (col === 'evaluation_id') return data.evaluation_id;
    if (col === 'eleve_id') return data.eleve_id;
    if (col === 'validation_numero') return data.validation_numero;
    if (col === 'validations') return data.validation_numero;
    if (col === 'source') return 'saisie_admin';
    if (col === 'date_passage') return new Date().toISOString();
    return '';
  });

  sheet.appendRow(newRow);
  return { success: true, id: id, message: 'Validation ' + data.validation_numero + ' enregistrée' };
}

