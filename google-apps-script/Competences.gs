// ========================================
// REFERENTIEL COMPETENCES
// Colonnes : id, nom, description, consigne, ordre, visible
// ========================================

/**
 * Récupère toutes les compétences du référentiel
 */
function getCompetencesReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var competences = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var competence = {};
    headers.forEach(function(header, index) {
      competence[header] = row[index];
    });
    competences.push(competence);
  }

  return { success: true, data: competences };
}

/**
 * Crée une nouvelle compétence dans le référentiel
 */
function createCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CompetencesReferentiel');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CompetencesReferentiel');
    sheet.appendRow(['id', 'nom', 'description', 'consigne', 'ordre', 'visible']);
  }

  var id = 'comp_' + new Date().getTime();
  var rowData = [
    id,
    data.nom || '',
    data.description || '',
    data.consigne || '',
    data.ordre || 1,
    data.visible !== undefined ? data.visible : true
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une compétence du référentiel
 */
function updateCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

/**
 * Supprime une compétence du référentiel
 */
function deleteCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

// ========================================
// CRITERES DE REUSSITE
// Colonnes : id, competence_id, libelle, ordre
// (inchangé)
// ========================================

/**
 * Récupère tous les critères de réussite
 */
function getCriteresReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    var item = {};
    headers.forEach(function(header, index) {
      item[header] = row[index];
    });
    result.push(item);
  }

  return { success: true, data: result };
}

/**
 * Récupère les critères pour une compétence spécifique
 */
function getCriteresForCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet || !data.competence_id) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var compIdCol = headers.indexOf('competence_id');
  var result = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (String(row[compIdCol]) === String(data.competence_id)) {
      var item = {};
      headers.forEach(function(header, index) {
        item[header] = row[index];
      });
      result.push(item);
    }
  }

  // Trier par ordre
  result.sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });

  return { success: true, data: result };
}

/**
 * Crée un nouveau critère de réussite
 */
function createCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CriteresReussite');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CriteresReussite');
    sheet.appendRow(['id', 'competence_id', 'libelle', 'ordre']);
  }

  var id = 'crit_' + new Date().getTime();
  var rowData = [
    id,
    data.competence_id || '',
    data.libelle || '',
    data.ordre || 1
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour un critère de réussite
 */
function updateCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

/**
 * Supprime un critère de réussite
 */
function deleteCritereReussite(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

// ========================================
// ENTRAINEMENTS COMPETENCES
// (anciennement « Tâches Complexes »)
// Colonnes : id, titre, competence_id, description, document_url,
//            document_legende, correction_commentee, duree, ordre,
//            statut, date_creation
// ========================================

/**
 * Récupère tous les entraînements de compétences
 * @param {Object} data - {competence_id?} filtre optionnel
 */
function getEntrainementsCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EntrainementsCompetences');

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var entrainements = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var entry = {};
    headers.forEach(function(header, index) {
      // Parser correction_commentee en JSON si présent
      if (header === 'correction_commentee' && row[index]) {
        try {
          entry[header] = JSON.parse(row[index]);
        } catch (e) {
          entry[header] = row[index];
        }
      } else {
        entry[header] = row[index];
      }
    });
    entrainements.push(entry);
  }

  // Filtrer par competence_id si fourni
  if (data && data.competence_id) {
    entrainements = entrainements.filter(function(e) {
      return String(e.competence_id) === String(data.competence_id);
    });
  }

  return { success: true, data: entrainements };
}

/**
 * Récupère un entraînement de compétence par son ID
 * @param {Object} data - {id}
 */
function getEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EntrainementsCompetences');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var entry = {};
      headers.forEach(function(header, index) {
        if (header === 'correction_commentee' && allData[i][index]) {
          try {
            entry[header] = JSON.parse(allData[i][index]);
          } catch (e) {
            entry[header] = allData[i][index];
          }
        } else {
          entry[header] = allData[i][index];
        }
      });
      return { success: true, data: entry };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Crée un nouvel entraînement de compétence
 */
function createEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EntrainementsCompetences');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EntrainementsCompetences');
    sheet.appendRow([
      'id', 'titre', 'competence_id', 'description', 'document_url',
      'document_legende', 'correction_commentee', 'duree', 'ordre',
      'statut', 'date_creation'
    ]);
  }

  var id = 'ec_' + new Date().getTime();

  // Sérialiser correction_commentee si c'est un objet
  var correction = data.correction_commentee || '';
  if (typeof correction === 'object') {
    correction = JSON.stringify(correction);
  }

  var rowData = [
    id,
    data.titre || '',
    data.competence_id || '',
    data.description || '',
    data.document_url || '',
    data.document_legende || '',
    correction,
    data.duree || 1800,
    data.ordre || 1,
    data.statut || 'brouillon',
    new Date().toISOString()
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour un entraînement de compétence
 */
function updateEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EntrainementsCompetences');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var updatedRow = headers.map(function(header, index) {
        if (header === 'id') return data.id;
        if (header === 'date_creation') return allData[i][index]; // Immutable
        if (data[header] !== undefined) {
          // Sérialiser correction_commentee si c'est un objet
          if (header === 'correction_commentee' && typeof data[header] === 'object') {
            return JSON.stringify(data[header]);
          }
          return data[header];
        }
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Supprime un entraînement de compétence
 */
function deleteEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EntrainementsCompetences');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

// ========================================
// ELEVE — ENTRAINEMENTS COMPETENCES
// (anciennement « Élève Tâches Complexes »)
// Colonnes : id, eleve_id, entrainement_id, mode, statut,
//            date_debut, date_fin, date_soumission, temps_passe,
//            date_correction
// Modes : entrainement | evalue
// Statuts : en_cours | entraine | soumis | valide
// ========================================

/**
 * Récupère le statut d'un entraînement pour un élève
 * @param {Object} data - {eleve_id, entrainement_id}
 */
function getEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveEntrainementsCompetences');

  if (!sheet) {
    return { success: true, data: null };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: null };
  }

  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {
      var record = {};
      headers.forEach(function(header, index) {
        record[header] = allData[i][index];
      });
      return { success: true, data: record };
    }
  }

  return { success: true, data: null };
}

/**
 * Récupère tous les entraînements de compétences d'un élève (ou tous si admin)
 * @param {Object} data - {eleve_id} ou {} pour admin
 */
function getEleveEntrainementsCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveEntrainementsCompetences');

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var records = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (data && data.eleve_id) {
      if (String(record.eleve_id) === String(data.eleve_id)) {
        records.push(record);
      }
    } else {
      records.push(record);
    }
  }

  return { success: true, data: records };
}

/**
 * Démarre un entraînement de compétence pour un élève
 * - Si pas d'enregistrement : crée un nouveau
 * - Si déjà entraîné et nouveau mode = évalué : met à jour
 * - Si soumis ou validé : refuse
 * @param {Object} data - {eleve_id, entrainement_id, mode: 'entrainement'|'evalue'}
 */
function startEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveEntrainementsCompetences');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveEntrainementsCompetences');
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'mode', 'statut',
      'date_debut', 'date_fin', 'date_soumission', 'temps_passe',
      'date_correction'
    ]);
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');

  // Chercher un enregistrement existant
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var existingRecord = {};
      headers.forEach(function(header, index) {
        existingRecord[header] = allData[i][index];
      });

      var existingStatut = String(existingRecord.statut);

      // En cours : reprendre
      if (existingStatut === 'en_cours') {
        return { success: true, id: existingRecord.id, resumed: true };
      }

      // Déjà entraîné et on veut passer en mode évalué : autoriser
      if (existingStatut === 'entraine' && data.mode === 'evalue') {
        var modeCol = headers.indexOf('mode');
        var statutCol = headers.indexOf('statut');
        var dateDebutCol = headers.indexOf('date_debut');
        sheet.getRange(i + 1, modeCol + 1).setValue('evalue');
        sheet.getRange(i + 1, statutCol + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, upgraded: true };
      }

      // Déjà soumis ou validé : refuser
      if (existingStatut === 'soumis' || existingStatut === 'valide') {
        return {
          success: false,
          error: existingStatut === 'soumis'
            ? 'Production déjà soumise, en attente de correction'
            : 'Compétence déjà validée sur cet exercice',
          existing: existingRecord
        };
      }

      // Entraîné et on veut s'entraîner à nouveau : autoriser
      if (existingStatut === 'entraine' && data.mode === 'entrainement') {
        var statutCol2 = headers.indexOf('statut');
        var dateDebutCol2 = headers.indexOf('date_debut');
        sheet.getRange(i + 1, statutCol2 + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol2 + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, resumed: true };
      }
    }
  }

  // Pas d'enregistrement existant : créer
  var id = 'eec_' + new Date().getTime();
  var rowData = [
    id,
    data.eleve_id,
    data.entrainement_id,
    data.mode || 'entrainement',
    'en_cours',
    new Date().toISOString(),
    '', // date_fin
    '', // date_soumission
    '', // temps_passe
    ''  // date_correction
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Termine un entraînement de compétence pour un élève
 * - Mode entrainement → statut = entraine
 * - Mode évalué → statut = soumis
 * @param {Object} data - {eleve_id, entrainement_id, temps_passe?}
 */
function finishEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveEntrainementsCompetences');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var modeCol = headers.indexOf('mode');
  var statutCol = headers.indexOf('statut');
  var dateFinCol = headers.indexOf('date_fin');
  var dateSoumissionCol = headers.indexOf('date_soumission');
  var tempsPasseCol = headers.indexOf('temps_passe');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var mode = String(allData[i][modeCol]);
      var now = new Date().toISOString();

      if (mode === 'evalue') {
        // Mode évalué : marquer comme soumis
        sheet.getRange(i + 1, statutCol + 1).setValue('soumis');
        sheet.getRange(i + 1, dateSoumissionCol + 1).setValue(now);
      } else {
        // Mode entraînement : marquer comme entraîné
        sheet.getRange(i + 1, statutCol + 1).setValue('entraine');
        sheet.getRange(i + 1, dateFinCol + 1).setValue(now);
      }

      // Temps passé (optionnel)
      if (data.temps_passe && tempsPasseCol !== -1) {
        sheet.getRange(i + 1, tempsPasseCol + 1).setValue(data.temps_passe);
      }

      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Valide un entraînement de compétence (action enseignante)
 * @param {Object} data - {id} ou {eleve_id, entrainement_id}
 */
function validateEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveEntrainementsCompetences');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var statutCol = headers.indexOf('statut');
  var dateCorrectionCol = headers.indexOf('date_correction');

  for (var i = 1; i < allData.length; i++) {
    var match = false;

    // Recherche par id
    if (data.id) {
      match = String(allData[i][idCol]) === String(data.id);
    }
    // Recherche par eleve_id + entrainement_id
    else if (data.eleve_id && data.entrainement_id) {
      match = String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
              String(allData[i][entrainementIdCol]) === String(data.entrainement_id);
    }

    if (match) {
      var newStatut = data.statut || 'valide';
      sheet.getRange(i + 1, statutCol + 1).setValue(newStatut);
      if (dateCorrectionCol !== -1) {
        sheet.getRange(i + 1, dateCorrectionCol + 1).setValue(new Date().toISOString());
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

// ========================================
// ALIASES — Rétro-compatibilité
// Les anciens noms d'actions continuent de fonctionner
// pendant la transition vers la nouvelle terminologie.
// ========================================

function getTachesComplexes(data)          { return getEntrainementsCompetences(data); }
function getTacheComplexe(data)            { return getEntrainementCompetence(data); }
function createTacheComplexe(data)         { return createEntrainementCompetence(data); }
function updateTacheComplexe(data)         { return updateEntrainementCompetence(data); }
function deleteTacheComplexe(data)         { return deleteEntrainementCompetence(data); }
function getEleveTacheComplexe(data)       { return getEleveEntrainementCompetence(data); }
function getEleveTachesComplexes(data)     { return getEleveEntrainementsCompetences(data); }
function startEleveTacheComplexe(data)     { return startEleveEntrainementCompetence(data); }
function finishEleveTacheComplexe(data)    { return finishEleveEntrainementCompetence(data); }
function submitEleveTacheComplexe(data)    { return finishEleveEntrainementCompetence(data); }
function updateEleveTacheComplexe(data)    { return validateEleveEntrainementCompetence(data); }

// ========================================
// TRACKING (inchangé)
// ========================================

/**
 * Enregistre une connexion/visite d'élève
 * @param {Object} data - {eleve_id, page, action}
 */
function trackEleveConnexion(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveConnexions');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveConnexions');
    sheet.appendRow(['id', 'eleve_id', 'page', 'action', 'timestamp', 'user_agent']);
  }

  var id = 'conn_' + new Date().getTime();
  sheet.appendRow([
    id,
    data.eleve_id,
    data.page || '',
    data.action || 'visit',
    new Date().toISOString(),
    data.user_agent || ''
  ]);

  // Mettre à jour la dernière connexion de l'utilisateur
  updateUserLastConnexion(data.eleve_id);

  return { success: true, id: id };
}

/**
 * Met à jour la dernière connexion d'un utilisateur
 */
function updateUserLastConnexion(userId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Utilisateurs');
  if (!sheet) return;

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  var lastConnexionCol = headers.indexOf('derniere_connexion');
  if (lastConnexionCol === -1) {
    lastConnexionCol = headers.length;
    sheet.getRange(1, lastConnexionCol + 1).setValue('derniere_connexion');
  }

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(userId)) {
      sheet.getRange(i + 1, lastConnexionCol + 1).setValue(new Date().toISOString());
      break;
    }
  }
}

/**
 * Récupère les connexions d'un élève
 * @param {Object} data - {eleve_id} ou {} pour toutes
 */
function getEleveConnexions(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('EleveConnexions');

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var records = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var record = {};
    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (data && data.eleve_id) {
      if (String(record.eleve_id) === String(data.eleve_id)) {
        records.push(record);
      }
    } else {
      records.push(record);
    }
  }

  return { success: true, data: records };
}

/**
 * Récupère les statistiques d'un élève
 * @param {Object} data - {eleve_id}
 */
function getEleveStats(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Stats de connexions
  var connexionsSheet = ss.getSheetByName('EleveConnexions');
  var totalConnexions = 0;
  var pagesVisitees = {};
  var derniereConnexion = null;

  if (connexionsSheet) {
    var connData = connexionsSheet.getDataRange().getValues();
    var connHeaders = connData[0];
    var eleveIdCol = connHeaders.indexOf('eleve_id');
    var pageCol = connHeaders.indexOf('page');
    var timestampCol = connHeaders.indexOf('timestamp');

    for (var i = 1; i < connData.length; i++) {
      if (String(connData[i][eleveIdCol]) === String(data.eleve_id)) {
        totalConnexions++;
        var page = connData[i][pageCol];
        pagesVisitees[page] = (pagesVisitees[page] || 0) + 1;

        var timestamp = connData[i][timestampCol];
        if (!derniereConnexion || new Date(timestamp) > new Date(derniereConnexion)) {
          derniereConnexion = timestamp;
        }
      }
    }
  }

  // Stats des entraînements de compétences
  var entrSheet = ss.getSheetByName('EleveEntrainementsCompetences');
  var entrStats = { total: 0, en_cours: 0, entraine: 0, soumis: 0, valide: 0 };

  if (entrSheet) {
    var entrData = entrSheet.getDataRange().getValues();
    var entrHeaders = entrData[0];
    var entrEleveIdCol = entrHeaders.indexOf('eleve_id');
    var entrStatutCol = entrHeaders.indexOf('statut');

    for (var j = 1; j < entrData.length; j++) {
      if (String(entrData[j][entrEleveIdCol]) === String(data.eleve_id)) {
        entrStats.total++;
        var statut = entrData[j][entrStatutCol];
        if (entrStats[statut] !== undefined) {
          entrStats[statut]++;
        }
      }
    }
  }

  return {
    success: true,
    data: {
      connexions: {
        total: totalConnexions,
        derniere: derniereConnexion,
        pages: pagesVisitees
      },
      entrainements_competences: entrStats
    }
  };
}
