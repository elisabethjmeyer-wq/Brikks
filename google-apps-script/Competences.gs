// ========================================
// REFERENTIEL COMPETENCES
// ========================================

/**
 * Récupère toutes les compétences du référentiel
 */
function getCompetencesReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const competences = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const competence = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('CompetencesReferentiel');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CompetencesReferentiel');
    sheet.appendRow(['id', 'nom', 'description', 'categorie', 'ordre', 'statut']);
  }

  const id = 'comp_' + new Date().getTime();
  const rowData = [
    id,
    data.nom || '',
    data.description || '',
    data.categorie || '',
    data.ordre || 1,
    data.statut || 'actif'
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une compétence du référentiel
 */
function updateCompetenceReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.nom || allData[i][headers.indexOf('nom')],
        data.description || allData[i][headers.indexOf('description')],
        data.categorie || allData[i][headers.indexOf('categorie')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')],
        data.statut || allData[i][headers.indexOf('statut')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

/**
 * Supprime une compétence du référentiel
 */
function deleteCompetenceReferentiel(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CompetencesReferentiel');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Compétence non trouvée' };
}

// ========================================
// CRITERES DE REUSSITE
// ========================================

/**
 * Récupère tous les critères de réussite
 */
function getCriteresReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const result = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet || !data.competence_id) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const compIdCol = headers.indexOf('competence_id');
  const result = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (String(row[compIdCol]) === String(data.competence_id)) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = row[index];
      });
      result.push(item);
    }
  }

  // Trier par ordre
  result.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  return { success: true, data: result };
}

/**
 * Crée un nouveau critère de réussite
 */
function createCritereReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('CriteresReussite');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('CriteresReussite');
    sheet.appendRow(['id', 'competence_id', 'libelle', 'ordre']);
  }

  const id = 'crit_' + new Date().getTime();
  const rowData = [
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.competence_id || allData[i][headers.indexOf('competence_id')],
        data.libelle || allData[i][headers.indexOf('libelle')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

/**
 * Supprime un critère de réussite
 */
function deleteCritereReussite(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('CriteresReussite');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Critère non trouvé' };
}

// ========================================
// TACHES COMPLEXES (Exercices Compétences)
// ========================================

/**
 * Récupère toutes les tâches complexes
 */
function getTachesComplexes(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const taches = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const tache = {};
    headers.forEach((header, index) => {
      tache[header] = row[index];
    });
    taches.push(tache);
  }

  // Filter by chapitre_id if provided
  if (data && data.chapitre_id) {
    return {
      success: true,
      data: taches.filter(t => t.chapitre_id === data.chapitre_id)
    };
  }

  return { success: true, data: taches };
}

/**
 * Récupère une tâche complexe par son ID
 */
function getTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const tache = {};
      headers.forEach((header, index) => {
        if (header === 'competences_ids' && allData[i][index]) {
          try {
            tache[header] = JSON.parse(allData[i][index]);
          } catch (e) {
            tache[header] = [];
          }
        } else {
          tache[header] = allData[i][index];
        }
      });
      return { success: true, data: tache };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

/**
 * Crée une nouvelle tâche complexe
 */
function createTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('TachesComplexes');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('TachesComplexes');
    sheet.appendRow(['id', 'titre', 'chapitre_id', 'description', 'document_url', 'correction_url', 'duree', 'competences_ids', 'ordre', 'statut', 'date_creation']);
  }

  const id = 'tc_' + new Date().getTime();
  const rowData = [
    id,
    data.titre || '',
    data.chapitre_id || '',
    data.description || '',
    data.document_url || '',
    data.correction_url || '',
    data.duree || 2700,
    data.competences_ids || '',
    data.ordre || 1,
    data.statut || 'brouillon',
    new Date().toISOString()
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Met à jour une tâche complexe
 */
function updateTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      const rowData = [
        data.id,
        data.titre !== undefined ? data.titre : allData[i][headers.indexOf('titre')],
        data.chapitre_id !== undefined ? data.chapitre_id : allData[i][headers.indexOf('chapitre_id')],
        data.description !== undefined ? data.description : allData[i][headers.indexOf('description')],
        data.document_url !== undefined ? data.document_url : allData[i][headers.indexOf('document_url')],
        data.correction_url !== undefined ? data.correction_url : allData[i][headers.indexOf('correction_url')],
        data.duree !== undefined ? data.duree : allData[i][headers.indexOf('duree')],
        data.competences_ids !== undefined ? data.competences_ids : allData[i][headers.indexOf('competences_ids')],
        data.ordre !== undefined ? data.ordre : allData[i][headers.indexOf('ordre')],
        data.statut !== undefined ? data.statut : allData[i][headers.indexOf('statut')],
        allData[i][headers.indexOf('date_creation')]
      ];

      const range = sheet.getRange(i + 1, 1, 1, rowData.length);
      range.setValues([rowData]);
      return { success: true };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

/**
 * Supprime une tâche complexe
 */
function deleteTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('TachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Tâche non trouvée' };
}

// ========== ELEVE TACHES COMPLEXES ==========

/**
 * Récupère le statut d'une tâche complexe pour un élève
 * @param {Object} data - {eleve_id, tache_id}
 */
function getEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: true, data: null };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: null };
  }

  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = allData[i][index];
      });
      return { success: true, data: record };
    }
  }

  return { success: true, data: null };
}

/**
 * Récupère toutes les tâches complexes d'un élève (ou toutes si admin)
 * @param {Object} data - {eleve_id} ou {} pour admin
 */
function getEleveTachesComplexes(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const records = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });

    // Filter by eleve_id if provided
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
 * Démarre une tâche complexe pour un élève (enregistre son choix)
 * @param {Object} data - {eleve_id, tache_id, mode: 'entrainement'|'points_bonus'}
 */
function startEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('EleveTachesComplexes');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveTachesComplexes');
    sheet.appendRow(['id', 'eleve_id', 'tache_id', 'mode', 'statut', 'date_debut', 'date_fin']);
  }

  // Vérifier si l'élève a déjà fait un choix pour cette tâche
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Déjà enregistré
      const existingRecord = {};
      headers.forEach((header, index) => {
        existingRecord[header] = allData[i][index];
      });
      return {
        success: false,
        error: 'Choix deja effectue',
        existing: existingRecord
      };
    }
  }

  const id = 'etc_' + new Date().getTime();
  const rowData = [
    id,
    data.eleve_id,
    data.tache_id,
    data.mode || 'entrainement',
    'en_cours',
    new Date().toISOString(),
    ''
  ];

  sheet.appendRow(rowData);
  return { success: true, id: id };
}

/**
 * Termine une tâche complexe pour un élève
 * @param {Object} data - {eleve_id, tache_id}
 */
function finishEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');
  const statutCol = headers.indexOf('statut');
  const dateFinCol = headers.indexOf('date_fin');

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Mettre à jour le statut et la date de fin
      sheet.getRange(i + 1, statutCol + 1).setValue('termine');
      sheet.getRange(i + 1, dateFinCol + 1).setValue(new Date().toISOString());
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Soumet une tâche complexe pour correction (mode points_bonus)
 * @param {Object} data - {eleve_id, tache_id, temps_passe}
 */
function submitEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const eleveIdCol = headers.indexOf('eleve_id');
  const tacheIdCol = headers.indexOf('tache_id');
  const statutCol = headers.indexOf('statut');

  // Ajouter colonnes si nécessaire
  let dateSoumissionCol = headers.indexOf('date_soumission');
  let tempsPasseCol = headers.indexOf('temps_passe');

  if (dateSoumissionCol === -1) {
    dateSoumissionCol = headers.length;
    sheet.getRange(1, dateSoumissionCol + 1).setValue('date_soumission');
  }
  if (tempsPasseCol === -1) {
    tempsPasseCol = headers.length + (dateSoumissionCol === headers.length ? 1 : 0);
    sheet.getRange(1, tempsPasseCol + 1).setValue('temps_passe');
  }

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]) === String(data.eleve_id) &&
        String(allData[i][tacheIdCol]) === String(data.tache_id)) {
      // Mettre à jour le statut à 'soumis' (en attente de correction)
      sheet.getRange(i + 1, statutCol + 1).setValue('soumis');
      sheet.getRange(i + 1, dateSoumissionCol + 1).setValue(new Date().toISOString());
      if (data.temps_passe) {
        sheet.getRange(i + 1, tempsPasseCol + 1).setValue(data.temps_passe);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Met à jour une tâche complexe élève (admin)
 * @param {Object} data - {id, statut, date_correction, ...}
 */
function updateEleveTacheComplexe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveTachesComplexes');

  if (!sheet) {
    return { success: false, error: 'Feuille non trouvée' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Ajouter date_correction si nécessaire
  let dateCorrectionCol = headers.indexOf('date_correction');
  if (dateCorrectionCol === -1 && data.date_correction) {
    dateCorrectionCol = headers.length;
    sheet.getRange(1, dateCorrectionCol + 1).setValue('date_correction');
  }

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      // Mettre à jour les champs fournis
      if (data.statut !== undefined) {
        const statutCol = headers.indexOf('statut');
        if (statutCol !== -1) {
          sheet.getRange(i + 1, statutCol + 1).setValue(data.statut);
        }
      }
      if (data.date_correction !== undefined && dateCorrectionCol !== -1) {
        sheet.getRange(i + 1, dateCorrectionCol + 1).setValue(data.date_correction);
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Enregistrement non trouvé' };
}

/**
 * Enregistre une connexion/visite d'élève
 * @param {Object} data - {eleve_id, page, action}
 */
function trackEleveConnexion(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('EleveConnexions');

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet('EleveConnexions');
    sheet.appendRow(['id', 'eleve_id', 'page', 'action', 'timestamp', 'user_agent']);
  }

  const id = 'conn_' + new Date().getTime();
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Utilisateurs');
  if (!sheet) return;

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  let lastConnexionCol = headers.indexOf('derniere_connexion');
  if (lastConnexionCol === -1) {
    lastConnexionCol = headers.length;
    sheet.getRange(1, lastConnexionCol + 1).setValue('derniere_connexion');
  }

  for (let i = 1; i < allData.length; i++) {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('EleveConnexions');

  if (!sheet) {
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) {
    return { success: true, data: [] };
  }

  const headers = allData[0];
  const records = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    if (!row[0]) continue;

    const record = {};
    headers.forEach((header, index) => {
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
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Stats de connexions
  const connexionsSheet = ss.getSheetByName('EleveConnexions');
  let totalConnexions = 0;
  let pagesVisitees = {};
  let derniereConnexion = null;

  if (connexionsSheet) {
    const connData = connexionsSheet.getDataRange().getValues();
    const connHeaders = connData[0];
    const eleveIdCol = connHeaders.indexOf('eleve_id');
    const pageCol = connHeaders.indexOf('page');
    const timestampCol = connHeaders.indexOf('timestamp');

    for (let i = 1; i < connData.length; i++) {
      if (String(connData[i][eleveIdCol]) === String(data.eleve_id)) {
        totalConnexions++;
        const page = connData[i][pageCol];
        pagesVisitees[page] = (pagesVisitees[page] || 0) + 1;

        const timestamp = connData[i][timestampCol];
        if (!derniereConnexion || new Date(timestamp) > new Date(derniereConnexion)) {
          derniereConnexion = timestamp;
        }
      }
    }
  }

  // Stats de tâches complexes
  const tachesSheet = ss.getSheetByName('EleveTachesComplexes');
  let tachesStats = { total: 0, en_cours: 0, termine: 0, soumis: 0 };

  if (tachesSheet) {
    const tachesData = tachesSheet.getDataRange().getValues();
    const tachesHeaders = tachesData[0];
    const eleveIdCol = tachesHeaders.indexOf('eleve_id');
    const statutCol = tachesHeaders.indexOf('statut');

    for (let i = 1; i < tachesData.length; i++) {
      if (String(tachesData[i][eleveIdCol]) === String(data.eleve_id)) {
        tachesStats.total++;
        const statut = tachesData[i][statutCol];
        if (tachesStats[statut] !== undefined) {
          tachesStats[statut]++;
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
      taches: tachesStats
    }
  };
}

