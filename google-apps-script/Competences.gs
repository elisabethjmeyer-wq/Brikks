// ========================================
// REFERENTIEL COMPETENCES
// Colonnes : id, nom, description, consigne, ordre, visible, matiere
// ========================================

/**
 * Récupère toutes les compétences du référentiel
 */
function getCompetencesReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

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
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CompetencesReferentiel);
    sheet.appendRow(['id', 'nom', 'description', 'consigne', 'ordre', 'visible', 'matiere']);
  }

  // Migration progressive : ajouter la colonne matiere si elle manque
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('matiere') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('matiere');
    headers.push('matiere');
  }

  var id = 'comp_' + new Date().getTime();

  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'nom': return data.nom || '';
      case 'description': return data.description || '';
      case 'consigne': return data.consigne || '';
      case 'ordre': return data.ordre || 1;
      case 'visible': return data.visible !== undefined ? data.visible : true;
      case 'matiere': return data.matiere || 'Transversal';
      default: return '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une compétence du référentiel
 */
function updateCompetenceReferentiel(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter la colonne matiere si elle manque
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('matiere') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('matiere');
    currentHeaders.push('matiere');
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
  var sheet = ss.getSheetByName(SHEETS.CompetencesReferentiel);

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
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

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
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

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
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CriteresReussite);
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
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

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
  var sheet = ss.getSheetByName(SHEETS.CriteresReussite);

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
// BANQUES COMPETENCES
// Couche intermédiaire entre le référentiel et les entraînements.
// Chaque banque est liée à une compétence et contrôle la visibilité élève.
// Colonnes : id, competence_id, titre, description, ordre, statut, date_creation
// ========================================

/**
 * Récupère toutes les banques de compétences
 * @param {Object} data - {competence_id?} filtre optionnel
 */
function getBanquesCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  if (!sheet) {
    return { success: true, data: [] };
  }

  var allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  var headers = allData[0];
  var banques = [];

  for (var i = 1; i < allData.length; i++) {
    var row = allData[i];
    if (!row[0]) continue;

    var banque = {};
    headers.forEach(function(header, index) {
      banque[header] = row[index];
    });
    banques.push(banque);
  }

  // Filtrer par competence_id si fourni
  if (data && data.competence_id) {
    banques = banques.filter(function(b) {
      return String(b.competence_id) === String(data.competence_id);
    });
  }

  // Filtrer par type_usage si fourni (entrainement, eval_bonus, tache_complexe)
  if (data && data.type_usage) {
    banques = banques.filter(function(b) {
      return String(b.type_usage || 'entrainement') === String(data.type_usage);
    });
  }

  return { success: true, data: banques };
}

/**
 * Crée une nouvelle banque de compétence
 */
function createBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.BanquesCompetences);
    sheet.appendRow(['id', 'competence_id', 'titre', 'description', 'ordre', 'statut', 'date_creation']);
  }

  // Migration progressive : nouvelles colonnes
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['type_usage', 'competence_ids'];
  newCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headers.push(col);
    }
  });

  var id = 'bc_' + new Date().getTime();

  // Relire les headers après migration
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'competence_id': return data.competence_id || '';
      case 'titre': return data.titre || '';
      case 'description': return data.description || '';
      case 'ordre': return data.ordre || 1;
      case 'statut': return data.statut || 'brouillon';
      case 'date_creation': return new Date().toISOString();
      case 'type_usage': return data.type_usage || 'entrainement';
      case 'competence_ids': return data.competence_ids || '';
      default: return data[h] !== undefined ? data[h] : '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une banque de compétence
 */
function updateBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

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
        if (data[header] !== undefined) return data[header];
        return allData[i][index];
      });

      var range = sheet.getRange(i + 1, 1, 1, updatedRow.length);
      range.setValues([updatedRow]);
      return { success: true };
    }
  }

  return { success: false, error: 'Banque non trouvée' };
}

/**
 * Supprime une banque de compétence et ses entraînements associés
 */
function deleteBanqueCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.BanquesCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  var found = false;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, error: 'Banque non trouvée' };
  }

  // Cascade : supprimer les entraînements associés à cette banque
  var entrSheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);
  if (entrSheet) {
    var entrData = entrSheet.getDataRange().getValues();
    var entrHeaders = entrData[0];
    var banqueIdCol = entrHeaders.indexOf('banque_id');
    if (banqueIdCol !== -1) {
      var rowsToDelete = [];
      for (var j = 1; j < entrData.length; j++) {
        if (String(entrData[j][banqueIdCol]) === String(data.id)) {
          rowsToDelete.push(j + 1);
        }
      }
      // Supprimer du bas vers le haut
      for (var k = rowsToDelete.length - 1; k >= 0; k--) {
        entrSheet.deleteRow(rowsToDelete[k]);
      }
    }
  }

  return { success: true };
}

// ========================================
// ENTRAINEMENTS COMPETENCES
// (anciennement « Tâches Complexes »)
// Colonnes : id, titre, competence_id, banque_id, description, document_url,
//            document_contenu, document_legende, correction_commentee,
//            correction_contenu, duree, ordre, statut, date_creation
// ========================================

/**
 * Récupère tous les entraînements de compétences
 * @param {Object} data - {competence_id?} filtre optionnel
 */
function getEntrainementsCompetences(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

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

  // Filtrer par banque_id si fourni
  if (data && data.banque_id) {
    entrainements = entrainements.filter(function(e) {
      return String(e.banque_id) === String(data.banque_id);
    });
  }
  // Filtrer par competence_id si fourni (rétro-compatibilité)
  else if (data && data.competence_id) {
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
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

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
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EntrainementsCompetences);
    sheet.appendRow([
      'id', 'titre', 'competence_id', 'banque_id', 'description', 'document_url',
      'document_contenu', 'document_legende', 'correction_commentee',
      'correction_contenu', 'duree', 'ordre', 'statut', 'date_creation'
    ]);
  }

  // Migration progressive : ajouter les colonnes manquantes
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['banque_id', 'document_contenu', 'correction_contenu', 'delai_mail_minutes', 'delai_papier_jours', 'competence_ids'];
  newCols.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
      headers.push(col);
    }
  });

  var id = 'ec_' + new Date().getTime();

  // Sérialiser correction_commentee si c'est un objet
  var correction = data.correction_commentee || '';
  if (typeof correction === 'object') {
    correction = JSON.stringify(correction);
  }

  // Relire les headers après éventuel ajout de colonne
  headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowData = headers.map(function(h) {
    switch (h) {
      case 'id': return id;
      case 'titre': return data.titre || '';
      case 'competence_id': return data.competence_id || '';
      case 'banque_id': return data.banque_id || '';
      case 'description': return data.description || '';
      case 'document_url': return data.document_url || '';
      case 'document_contenu': return data.document_contenu || '';
      case 'document_legende': return data.document_legende || '';
      case 'correction_commentee': return correction;
      case 'correction_contenu': return data.correction_contenu || '';
      case 'duree': return data.duree || 30;
      case 'ordre': return data.ordre || 1;
      case 'statut': return data.statut || 'brouillon';
      case 'date_creation': return new Date().toISOString();
      case 'delai_mail_minutes': return data.delai_mail_minutes || 30;
      case 'delai_papier_jours': return data.delai_papier_jours || 1;
      case 'competence_ids': return data.competence_ids || '';
      default: return '';
    }
  });

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour un entraînement de compétence
 */
function updateEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes manquantes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newCols = ['banque_id', 'document_contenu', 'correction_contenu', 'delai_mail_minutes', 'delai_papier_jours', 'competence_ids'];
  newCols.forEach(function(col) {
    if (currentHeaders.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(col);
      currentHeaders.push(col);
    }
  });

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
 * Supprime un entraînement de compétence et ses progressions élèves associées
 */
function deleteEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille EntrainementsCompetences non trouvée' };
  }

  if (!data.id) {
    return { success: false, error: 'id manquant dans la requête' };
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');

  if (idCol === -1) {
    return { success: false, error: 'Colonne id non trouvée dans EntrainementsCompetences' };
  }

  var found = false;
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      found = true;
      break;
    }
  }

  if (!found) {
    return { success: false, error: 'Entraînement non trouvé: ' + String(data.id) };
  }

  // Cascade : supprimer les progressions élèves pour cet entraînement
  var eleveSheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);
  if (eleveSheet) {
    var eleveData = eleveSheet.getDataRange().getValues();
    var eleveHeaders = eleveData[0];
    var entrIdCol = eleveHeaders.indexOf('entrainement_id');
    if (entrIdCol !== -1) {
      var rowsToDelete = [];
      for (var j = 1; j < eleveData.length; j++) {
        if (String(eleveData[j][entrIdCol]) === String(data.id)) {
          rowsToDelete.push(j + 1);
        }
      }
      for (var k = rowsToDelete.length - 1; k >= 0; k--) {
        eleveSheet.deleteRow(rowsToDelete[k]);
      }
    }
  }

  return { success: true, deleted_id: String(data.id) };
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
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

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
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

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
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EleveEntrainementsCompetences);
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

      // Déjà soumis, corrigé ou validé : refuser
      if (existingStatut === 'soumis' || existingStatut === 'corrige' || existingStatut === 'valide') {
        var errorMsg = 'Compétence déjà validée sur cet exercice';
        if (existingStatut === 'soumis') errorMsg = 'Production déjà soumise, en attente de correction';
        if (existingStatut === 'corrige') errorMsg = 'Production corrigée, en attente de validation';
        return {
          success: false,
          error: errorMsg,
          existing: existingRecord
        };
      }

      // Non soumis (l'élève avait refusé) : autoriser à recommencer
      if (existingStatut === 'non_soumis') {
        var modeCol3 = headers.indexOf('mode');
        var statutCol3 = headers.indexOf('statut');
        var dateDebutCol3 = headers.indexOf('date_debut');
        sheet.getRange(i + 1, modeCol3 + 1).setValue(data.mode || 'entrainement');
        sheet.getRange(i + 1, statutCol3 + 1).setValue('en_cours');
        sheet.getRange(i + 1, dateDebutCol3 + 1).setValue(new Date().toISOString());
        return { success: true, id: existingRecord.id, resumed: true };
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
    '', // date_correction
    ''  // date_envoi
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Termine un entraînement de compétence pour un élève
 * - Mode entrainement → statut = entraine
 * - Mode évalué → statut = soumis (ou non_soumis si l'élève refuse)
 * @param {Object} data - {eleve_id, entrainement_id, temps_passe?, mode_rendu?}
 *   mode_rendu : 'papier' | 'numerique' | 'non_soumis' (optionnel, mode évaluation)
 */
function finishEleveEntrainementCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes mode_rendu et date_envoi si absentes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('mode_rendu') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('mode_rendu');
  }
  currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('date_envoi') === -1) {
    var nextCol2 = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol2).setValue('date_envoi');
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
  var modeRenduCol = headers.indexOf('mode_rendu');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var mode = String(allData[i][modeCol]);
      var now = new Date().toISOString();

      if (mode === 'evalue') {
        // Déterminer le statut selon le mode de rendu
        var statut = (data.mode_rendu === 'non_soumis') ? 'non_soumis' : 'soumis';
        sheet.getRange(i + 1, statutCol + 1).setValue(statut);
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

      // Mode de rendu (optionnel)
      if (data.mode_rendu && modeRenduCol !== -1) {
        sheet.getRange(i + 1, modeRenduCol + 1).setValue(data.mode_rendu);
      }

      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Enregistre la date d'envoi du travail par l'élève (déclaratif)
 * L'élève clique "J'ai envoyé mon travail" → horodatage automatique
 * @param {Object} data - {eleve_id, entrainement_id}
 */
function saveEnvoiCompetence(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter date_envoi si absente
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (currentHeaders.indexOf('date_envoi') === -1) {
    var nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('date_envoi');
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var dateEnvoiCol = headers.indexOf('date_envoi');

  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][entrainementIdCol]) === String(data.entrainement_id)) {

      var now = new Date().toISOString();
      sheet.getRange(i + 1, dateEnvoiCol + 1).setValue(now);
      return { success: true, date_envoi: now };
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
  var sheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  // Migration progressive : ajouter les colonnes manquantes
  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colsToAdd = ['remarque_prof', 'correction_prof', 'criteres_valides', 'statut_correction'];
  for (var c = 0; c < colsToAdd.length; c++) {
    if (currentHeaders.indexOf(colsToAdd[c]) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(colsToAdd[c]);
      currentHeaders.push(colsToAdd[c]);
    }
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  var eleveIdCol = headers.indexOf('eleve_id');
  var entrainementIdCol = headers.indexOf('entrainement_id');
  var statutCol = headers.indexOf('statut');
  var dateCorrectionCol = headers.indexOf('date_correction');
  var remarqueProfCol = headers.indexOf('remarque_prof');
  var correctionProfCol = headers.indexOf('correction_prof');
  var criteresValidesCol = headers.indexOf('criteres_valides');
  var statutCorrectionCol = headers.indexOf('statut_correction');

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
      // Remarque prof (texte court)
      if (remarqueProfCol !== -1 && data.remarque_prof !== undefined) {
        sheet.getRange(i + 1, remarqueProfCol + 1).setValue(data.remarque_prof);
      }
      // Correction personnalisée (URL ou HTML)
      if (correctionProfCol !== -1 && data.correction_prof !== undefined) {
        sheet.getRange(i + 1, correctionProfCol + 1).setValue(data.correction_prof);
      }
      // Critères de réussite validés (JSON array d'IDs)
      if (criteresValidesCol !== -1 && data.criteres_valides !== undefined) {
        sheet.getRange(i + 1, criteresValidesCol + 1).setValue(data.criteres_valides);
      }
      // Visibilité correction (brouillon / publie)
      if (statutCorrectionCol !== -1 && data.statut_correction !== undefined) {
        sheet.getRange(i + 1, statutCorrectionCol + 1).setValue(data.statut_correction);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

// ========================================
// DRAG & DROP : ORDRE DES BANQUES ET ENTRAÎNEMENTS COMPÉTENCES
// ========================================

/**
 * Met à jour l'ordre des banques de compétences (pour drag & drop).
 */
function updateBanquesCompetencesOrdre(data) {
  var banques = data.banques;
  if (typeof banques === 'string') {
    try { banques = JSON.parse(banques); } catch (e) {
      return { success: false, error: 'Format banques invalide' };
    }
  }
  if (!banques || !Array.isArray(banques)) {
    return { success: false, error: 'banques array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.BanquesCompetences);
  if (!sheet) return { success: false, error: 'Feuille BanquesCompetences non trouvée' };

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
  return { success: true, message: 'Ordre des banques de compétences mis à jour' };
}

/**
 * Met à jour l'ordre des entraînements de compétences (pour drag & drop).
 */
function updateEntrainementsCompetencesOrdre(data) {
  var entrainements = data.entrainements;
  if (typeof entrainements === 'string') {
    try { entrainements = JSON.parse(entrainements); } catch (e) {
      return { success: false, error: 'Format entrainements invalide' };
    }
  }
  if (!entrainements || !Array.isArray(entrainements)) {
    return { success: false, error: 'entrainements array requis' };
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.EntrainementsCompetences);
  if (!sheet) return { success: false, error: 'Feuille EntrainementsCompetences non trouvée' };

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
  entrainements.forEach(function(e) { ordreMap[String(e.id).trim()] = e.ordre; });

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
  return { success: true, message: 'Ordre des entraînements de compétences mis à jour' };
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
  var sheet = ss.getSheetByName(SHEETS.EleveConnexions);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EleveConnexions);
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
  var sheet = ss.getSheetByName(SHEETS.UTILISATEURS);
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
  var sheet = ss.getSheetByName(SHEETS.EleveConnexions);

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
  var connexionsSheet = ss.getSheetByName(SHEETS.EleveConnexions);
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
  var entrSheet = ss.getSheetByName(SHEETS.EleveEntrainementsCompetences);
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
