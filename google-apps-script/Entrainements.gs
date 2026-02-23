// ========================================
// FONCTIONS ENTRAINEMENTS
// ========================================

/**
 * Récupère la liste des entraînements
 * @param {Object} data - { niveau?, chapitre_id?, statut? }
 */
function getEntrainements(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENTS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const entrainements = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtrer si paramètres fournis
    if (data.niveau && item.niveau !== data.niveau) continue;
    if (data.chapitre_id && item.chapitre_id !== data.chapitre_id) continue;
    if (data.statut && item.statut !== data.statut) continue;

    if (item.id) {
      entrainements.push(item);
    }
  }

  return { success: true, data: entrainements };
}

/**
 * Récupère un entraînement avec ses questions
 * @param {Object} data - { id }
 */
function getEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Récupérer l'entraînement
  const entrSheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS);
  const entrData = entrSheet.getDataRange().getValues();
  const entrHeaders = entrData[0].map(h => String(h).toLowerCase().trim());

  let entrainement = null;
  for (let i = 1; i < entrData.length; i++) {
    const row = entrData[i];
    const idCol = entrHeaders.indexOf('id');
    if (idCol >= 0 && String(row[idCol]).trim() === String(data.id).trim()) {
      entrainement = {};
      entrHeaders.forEach((header, index) => {
        entrainement[header] = row[index];
      });
      break;
    }
  }

  if (!entrainement) {
    return { success: false, error: 'Entraînement non trouvé: ' + data.id };
  }

  // 1b. Enrichir avec les infos du chapitre
  if (entrainement.chapitre_id) {
    const chapSheet = ss.getSheetByName(SHEETS.CHAPITRES);
    if (chapSheet) {
      const chapData = chapSheet.getDataRange().getValues();
      const chapHeaders = chapData[0].map(h => String(h).toLowerCase().trim());
      const chapIdCol = chapHeaders.indexOf('id');
      const chapNomCol = chapHeaders.indexOf('nom');
      const chapThemeCol = chapHeaders.indexOf('theme_id');

      for (let i = 1; i < chapData.length; i++) {
        if (String(chapData[i][chapIdCol]).trim() === String(entrainement.chapitre_id).trim()) {
          if (chapNomCol >= 0) entrainement.chapitre_nom = chapData[i][chapNomCol];

          // Récupérer le thème pour avoir la discipline
          if (chapThemeCol >= 0) {
            const themeId = chapData[i][chapThemeCol];
            const themeSheet = ss.getSheetByName(SHEETS.THEMES);
            if (themeSheet) {
              const themeData = themeSheet.getDataRange().getValues();
              const themeHeaders = themeData[0].map(h => String(h).toLowerCase().trim());
              const themeIdCol = themeHeaders.indexOf('id');
              const themeNomCol = themeHeaders.indexOf('nom');
              const disciplineCol = themeHeaders.indexOf('discipline_id');

              for (let j = 1; j < themeData.length; j++) {
                if (String(themeData[j][themeIdCol]).trim() === String(themeId).trim()) {
                  if (themeNomCol >= 0) entrainement.theme_nom = themeData[j][themeNomCol];
                  if (disciplineCol >= 0) entrainement.discipline = themeData[j][disciplineCol];
                  break;
                }
              }
            }
          }
          break;
        }
      }
    }
  }

  // 2. Récupérer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());

  const questionLinks = [];
  for (let i = 1; i < eqData.length; i++) {
    const row = eqData[i];
    const entrIdCol = eqHeaders.indexOf('entrainement_id');
    if (entrIdCol >= 0 && String(row[entrIdCol]).trim() === String(data.id).trim()) {
      const link = {};
      eqHeaders.forEach((header, index) => {
        link[header] = row[index];
      });
      questionLinks.push(link);
    }
  }

  // Trier par ordre
  questionLinks.sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

  // 3. Récupérer les questions (selon le type d'entraînement)
  const isConnaissances = entrainement.niveau === 'connaissances';

  // Pour connaissances, on utilise QUESTIONS_CONNAISSANCES sinon QUESTIONS
  const qSheetName = isConnaissances ? SHEETS.QUESTIONS_CONNAISSANCES : SHEETS.QUESTIONS;
  const qSheet = ss.getSheetByName(qSheetName);

  let questionsMap = {};
  if (qSheet) {
    const qData = qSheet.getDataRange().getValues();
    const qHeaders = qData[0].map(h => String(h).toLowerCase().trim());

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
  }

  // 4. Récupérer les formats (seulement pour entraînements non-connaissances)
  let formatsMap = {};
  if (!isConnaissances) {
    const fSheet = ss.getSheetByName(SHEETS.FORMATS);
    if (fSheet) {
      const fData = fSheet.getDataRange().getValues();
      const fHeaders = fData[0].map(h => String(h).toLowerCase().trim());

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
    }
  }

  // 5. Assembler les questions
  const questions = questionLinks.map(link => {
    const questionId = String(link.question_id || '').trim();
    let question = {};
    let donnees = {};
    let format = {};

    if (isConnaissances) {
      // Pour les entraînements de connaissances
      if (questionId && questionsMap[questionId]) {
        question = questionsMap[questionId];

        // Parser le JSON des données
        if (question.donnees) {
          try {
            donnees = JSON.parse(question.donnees);
          } catch (e) {
            donnees = {};
          }
        }
      } else {
        // Sélection aléatoire si question_id est vide
        const banqueId = link.banque_id;
        const questionType = link.question_type;

        // Trouver les questions de cette banque et type
        const candidates = Object.values(questionsMap).filter(q =>
          String(q.banque_id || '').trim() === String(banqueId).trim() &&
          String(q.type || '').trim() === String(questionType).trim()
        );

        if (candidates.length > 0) {
          question = candidates[Math.floor(Math.random() * candidates.length)];
          if (question.donnees) {
            try {
              donnees = JSON.parse(question.donnees);
            } catch (e) {
              donnees = {};
            }
          }
        }
      }

      // Pour connaissances, le type est dans le champ 'type' de la question
      format = { type_base: question.type || link.question_type || 'qcm' };

    } else {
      // Pour les autres types d'entraînements
      question = questionsMap[questionId] || {};
      format = formatsMap[String(question.format_id).trim()] || {};

      // Parser le JSON des données
      if (question.donnees) {
        try {
          donnees = JSON.parse(question.donnees);
        } catch (e) {
          donnees = {};
        }
      }
    }

    return {
      ...question,
      donnees: donnees,
      format: format,
      ordre: link.ordre,
      points: link.points || 1
    };
  });

  entrainement.questions = questions;

  return { success: true, data: entrainement };
}

/**
 * Crée un nouvel entraînement
 * @param {Object} data - { titre, niveau, chapitre_id, description, duree_estimee, statut, ordre }
 */
function createEntrainement(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);

  if (!data.titre) {
    return { success: false, error: 'titre requis' };
  }

  const id = 'entr_' + new Date().getTime();
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

  return { success: true, id: id, message: 'Entraînement créé' };
}

/**
 * Met à jour un entraînement
 * @param {Object} data - { id, ...fields }
 */
function updateEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENTS);
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
    return { success: false, error: 'Entraînement non trouvé' };
  }

  const updates = ['titre', 'niveau', 'chapitre_id', 'description', 'duree_estimee', 'statut', 'ordre'];
  updates.forEach(col => {
    if (data[col] !== undefined) {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[col]);
      }
    }
  });

  return { success: true, message: 'Entraînement mis à jour' };
}

/**
 * Supprime un entraînement
 * @param {Object} data - { id }
 */
function deleteEntrainement(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
  const eqIdCol = eqHeaders.indexOf('entrainement_id');

  for (let i = eqData.length - 1; i >= 1; i--) {
    if (String(eqData[i][eqIdCol]).trim() === String(data.id).trim()) {
      eqSheet.deleteRow(i + 1);
    }
  }

  // Supprimer l'entraînement
  const sheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Entraînement supprimé' };
    }
  }

  return { success: false, error: 'Entraînement non trouvé' };
}

/**
 * Crée un lien entre un entraînement et une question
 * @param {Object} data - { entrainement_id, question_id, format_id, ordre, etape }
 */
function createEntrainementQuestion(data) {
  if (!data.entrainement_id) {
    return { success: false, error: 'entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const id = 'eq_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
  const ordre = data.ordre || 1;
  const etape = data.etape || 1;

  // Colonnes : id | entrainement_id | question_id | format_id | ordre | banque_id | question_type | etape
  sheet.appendRow([
    id,
    data.entrainement_id,
    data.question_id || '',
    data.format_id || '',
    ordre,
    data.banque_id || '',
    data.question_type || '',
    etape
  ]);

  return {
    success: true,
    id: id,
    message: 'Lien entraînement-question créé'
  };
}

/**
 * Supprime tous les liens pour un entraînement
 * @param {Object} data - { entrainement_id }
 */
function deleteEntrainementQuestions(data) {
  if (!data.entrainement_id) {
    return { success: false, error: 'entrainement_id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const entrIdCol = headers.indexOf('entrainement_id');

  let deletedCount = 0;
  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][entrIdCol]).trim() === String(data.entrainement_id).trim()) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }

  return {
    success: true,
    message: deletedCount + ' liens supprimés'
  };
}

/**
 * Supprime un lien entraînement-question par son ID
 * @param {Object} data - { id }
 */
function deleteEntrainementQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet ENTRAINEMENT_QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Lien supprimé' };
    }
  }

  return { success: false, error: 'Lien non trouvé' };
}

// ========================================
// FONCTIONS QUESTIONS
// ========================================

/**
 * Récupère les questions (avec filtres optionnels)
 * @param {Object} data - { format_id?, discipline_id?, theme_id?, chapitre_id?, difficulte? }
 */
function getQuestions(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  if (!sheet) {
    return { success: false, error: 'Sheet QUESTIONS non trouvé' };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Récupérer les formats pour enrichir
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

  const questions = [];
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // Filtrer
    if (data.format_id && item.format_id !== data.format_id) continue;
    if (data.discipline_id && item.discipline_id !== data.discipline_id) continue;
    if (data.theme_id && item.theme_id !== data.theme_id) continue;
    if (data.chapitre_id && item.chapitre_id !== data.chapitre_id) continue;
    if (data.difficulte && item.difficulte !== data.difficulte) continue;

    if (item.id) {
      // Parser le JSON des données
      if (item.donnees) {
        try {
          item.donnees = JSON.parse(item.donnees);
        } catch (e) {
          item.donnees = {};
        }
      }
      item.format = formatsMap[String(item.format_id).trim()] || {};
      questions.push(item);
    }
  }

  return { success: true, data: questions };
}

/**
 * Crée un nouvel élément (structure atomique)
 * @param {Object} data - { type, chapitre_id, contenu, donnees, tags, explication, difficulte }
 * Types: qcm, evenement, paire, point_carte, item_categorie, reponse_libre
 */
function createQuestion(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS);

  if (!data.type || !data.contenu) {
    return { success: false, error: 'type et contenu requis' };
  }

  const id = 'elem_' + new Date().getTime();
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  const newRow = headers.map(header => {
    const col = String(header).toLowerCase().trim();
    if (col === 'id') return id;
    if (col === 'date_creation') return new Date().toISOString().split('T')[0];
    if (col === 'donnees') {
      if (typeof data.donnees === 'object') return JSON.stringify(data.donnees);
      return data.donnees || '';
    }
    return data[col] !== undefined ? data[col] : '';
  });

  sheet.appendRow(newRow);

  return { success: true, id: id, message: 'Element cree' };
}

/**
 * Met à jour un élément (structure atomique)
 * @param {Object} data - { id, type?, chapitre_id?, contenu?, donnees?, tags?, explication?, difficulte? }
 */
function updateQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.QUESTIONS);
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
    return { success: false, error: 'Element non trouve' };
  }

  // Champs de la nouvelle structure atomique
  const updates = ['type', 'chapitre_id', 'contenu', 'donnees', 'tags', 'explication', 'difficulte'];
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

  return { success: true, message: 'Element mis a jour' };
}

/**
 * Supprime une question
 * @param {Object} data - { id }
 */
function deleteQuestion(data) {
  if (!data.id) {
    return { success: false, error: 'id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Supprimer les liens entrainement_questions
  const eqSheet = ss.getSheetByName(SHEETS.ENTRAINEMENT_QUESTIONS);
  const eqData = eqSheet.getDataRange().getValues();
  const eqHeaders = eqData[0].map(h => String(h).toLowerCase().trim());
  const qIdCol = eqHeaders.indexOf('question_id');

  for (let i = eqData.length - 1; i >= 1; i--) {
    if (String(eqData[i][qIdCol]).trim() === String(data.id).trim()) {
      eqSheet.deleteRow(i + 1);
    }
  }

  // Supprimer la question
  const sheet = ss.getSheetByName(SHEETS.QUESTIONS);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');

  for (let i = allData.length - 1; i >= 1; i--) {
    if (String(allData[i][idCol]).trim() === String(data.id).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Question supprimée' };
    }
  }

  return { success: false, error: 'Question non trouvée' };
}

// ========================================
// SYSTÈME DE MÉMORISATION (Répétition espacée)
// ========================================

/**
 * Système de répétition espacée - 7 étapes
 *
 * PRÉ-ÉVALUATION (~2 semaines):
 * - Étape 1: Jour 0 (premier succès ≥80%)
 * - Étape 2: +1 jour (verrouillé jusque-là)
 * - Étape 3: +3 jours
 * - Étape 4: +7 jours
 * - Étape 5: +14 jours → "Prêt pour l'évaluation"
 *
 * POST-ÉVALUATION:
 * - Étape 6: +7 jours après étape 5
 * - Étape 7: +14 jours → "Mémorisé définitivement"
 */
const INTERVALLES_MEMORISATION = [0, 1, 3, 7, 14, 7, 14];
const SEUIL_REUSSITE = 80; // 80% pour toutes les étapes
const ETAPE_MAX = 7;
const ETAPE_PRET_EVALUATION = 5; // À partir de cette étape = prêt pour évaluation

/**
 * Récupère la progression de mémorisation d'un élève
 * @param {Object} data - { eleve_id, entrainement_id?, banque_id? }
 * Colonnes GSheet: id, eleve_id, entrainement_id, banque_id, etape, statut, prochaine_revision, historique, date_creation, date_modification
 */
function getProgressionMemorisation(data) {
  if (!data.eleve_id) {
    return { success: false, error: 'eleve_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.PROGRESSION_MEMORISATION);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_MEMORISATION);
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'banque_id', 'etape', 'statut',
      'prochaine_revision', 'historique', 'date_creation', 'date_modification'
    ]);
    return { success: true, data: [] };
  }

  const allData = sheet.getDataRange().getValues();
  if (allData.length < 2) {
    return { success: true, data: [] };
  }

  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const progressions = [];

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const item = {};
    headers.forEach((header, index) => {
      let value = row[index];
      // Parser l'historique JSON
      if (header === 'historique' && value) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = [];
        }
      }
      item[header] = value;
    });

    // Filtres
    if (String(item.eleve_id).trim() !== String(data.eleve_id).trim()) continue;
    if (data.entrainement_id && String(item.entrainement_id).trim() !== String(data.entrainement_id).trim()) continue;
    if (data.banque_id && String(item.banque_id).trim() !== String(data.banque_id).trim()) continue;

    // Calculer si révision est due
    if (item.prochaine_revision && item.statut === 'en_cours') {
      const now = new Date();
      const revisionDate = new Date(item.prochaine_revision);
      item.revision_due = now >= revisionDate;
      item.jours_restants = Math.ceil((revisionDate - now) / (1000 * 60 * 60 * 24));
    }

    progressions.push(item);
  }

  return { success: true, data: progressions };
}

/**
 * Récupère le seuil de réussite d'un entraînement
 */
function getSeuilEntrainement(entrainementId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.ENTRAINEMENTS_CONN);
  if (!sheet) return SEUIL_REUSSITE; // Fallback au seuil par défaut

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());
  const idCol = headers.indexOf('id');
  const seuilCol = headers.indexOf('seuil');

  if (seuilCol < 0) return SEUIL_REUSSITE;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]).trim() === String(entrainementId).trim()) {
      const seuil = parseInt(allData[i][seuilCol]);
      return isNaN(seuil) ? SEUIL_REUSSITE : seuil;
    }
  }

  return SEUIL_REUSSITE;
}

/**
 * Sauvegarde une tentative et met à jour la progression de mémorisation
 * @param {Object} data - { eleve_id, entrainement_id, banque_id, score, score_max }
 */
function saveProgressionMemorisation(data) {
  if (!data.eleve_id || !data.entrainement_id) {
    return { success: false, error: 'eleve_id et entrainement_id requis' };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEETS.PROGRESSION_MEMORISATION);

  // Créer la feuille si elle n'existe pas
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.PROGRESSION_MEMORISATION);
    sheet.appendRow([
      'id', 'eleve_id', 'entrainement_id', 'banque_id', 'etape', 'statut',
      'prochaine_revision', 'historique', 'date_creation', 'date_modification'
    ]);
  }

  // Récupérer le seuil de réussite défini pour cet entraînement
  const seuilReussite = getSeuilEntrainement(data.entrainement_id);

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => String(h).toLowerCase().trim());

  // Chercher une progression existante
  const eleveIdCol = headers.indexOf('eleve_id');
  const entrIdCol = headers.indexOf('entrainement_id');
  let existingRow = -1;
  let existingData = null;

  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][eleveIdCol]).trim() === String(data.eleve_id).trim() &&
        String(allData[i][entrIdCol]).trim() === String(data.entrainement_id).trim()) {
      existingRow = i + 1;
      existingData = {};
      headers.forEach((header, index) => {
        existingData[header] = allData[i][index];
      });
      break;
    }
  }

  // Calculer le pourcentage
  const scoreMax = data.score_max || 1;
  const score = data.score || 0;
  const pourcentage = Math.round((score / scoreMax) * 100);
  const now = new Date();
  const nowISO = now.toISOString();
  const todayISO = nowISO.split('T')[0];

  // Nouvelle tentative à ajouter à l'historique
  const nouvelleTentative = {
    date: nowISO,
    score: score,
    score_max: scoreMax,
    pourcentage: pourcentage
  };

  if (existingRow > 0) {
    // Progression existante - mettre à jour
    let historique = [];
    try {
      historique = JSON.parse(existingData.historique || '[]');
    } catch (e) {
      historique = [];
    }
    historique.push(nouvelleTentative);

    let etape = parseInt(existingData.etape) || 1;
    let statut = existingData.statut || 'en_cours';
    let prochaineRevision = existingData.prochaine_revision;

    // Vérifier si c'est le bon moment pour réviser (pas trop tôt)
    const peutReviser = !prochaineRevision || new Date(prochaineRevision) <= now;

    if (peutReviser) {
      // Utiliser le seuil défini pour cet entraînement
      const reussi = pourcentage >= seuilReussite;

      if (reussi) {
        // Avancer d'une étape
        etape = Math.min(etape + 1, ETAPE_MAX);
        if (etape >= ETAPE_MAX) {
          statut = 'memorise';
          prochaineRevision = null;
        } else {
          statut = 'en_cours';
          // Calculer la prochaine date de révision
          const intervalleJours = INTERVALLES_MEMORISATION[etape - 1] || 14;
          const prochaineDate = new Date(now);
          prochaineDate.setDate(prochaineDate.getDate() + intervalleJours);
          prochaineRevision = prochaineDate.toISOString().split('T')[0];
        }
      } else {
        // Reculer d'une étape (minimum 1)
        etape = Math.max(etape - 1, 1);
        statut = 'en_cours';
        // Peut réessayer immédiatement si échec
        prochaineRevision = todayISO;
      }
    }

    // Mettre à jour la ligne
    const updates = {
      'etape': etape,
      'statut': statut,
      'prochaine_revision': prochaineRevision || '',
      'historique': JSON.stringify(historique),
      'date_modification': nowISO
    };

    Object.keys(updates).forEach(col => {
      const colIndex = headers.indexOf(col);
      if (colIndex >= 0) {
        sheet.getRange(existingRow, colIndex + 1).setValue(updates[col]);
      }
    });

    return {
      success: true,
      message: 'Progression mise à jour',
      etape: etape,
      etape_max: ETAPE_MAX,
      statut: statut,
      pret_evaluation: etape >= ETAPE_PRET_EVALUATION,
      prochaine_revision: prochaineRevision,
      pourcentage: pourcentage,
      reussi: peutReviser ? (pourcentage >= seuilReussite) : null,
      seuil: seuilReussite
    };

  } else {
    // Nouvelle progression
    const id = 'prog_mem_' + now.getTime();
    const etape = 1;
    const statut = 'en_cours';
    // Première tentative réussie = prochaine révision dans 1 jour
    // Première tentative échouée = peut réessayer immédiatement
    const reussi = pourcentage >= seuilReussite;

    let prochaineRevision;
    let nouvelleEtape = 1;
    if (reussi) {
      nouvelleEtape = 2;
      const prochaineDate = new Date(now);
      prochaineDate.setDate(prochaineDate.getDate() + INTERVALLES_MEMORISATION[1]); // 1 jour
      prochaineRevision = prochaineDate.toISOString().split('T')[0];
    } else {
      prochaineRevision = todayISO; // Peut réessayer immédiatement
    }

    const historique = [nouvelleTentative];

    const newRow = headers.map(header => {
      if (header === 'id') return id;
      if (header === 'eleve_id') return data.eleve_id;
      if (header === 'entrainement_id') return data.entrainement_id;
      if (header === 'banque_id') return data.banque_id || '';
      if (header === 'etape') return nouvelleEtape;
      if (header === 'statut') return 'en_cours';
      if (header === 'prochaine_revision') return prochaineRevision;
      if (header === 'historique') return JSON.stringify(historique);
      if (header === 'date_creation') return nowISO;
      if (header === 'date_modification') return nowISO;
      return '';
    });

    sheet.appendRow(newRow);

    return {
      success: true,
      id: id,
      message: 'Progression créée',
      etape: nouvelleEtape,
      etape_max: ETAPE_MAX,
      statut: 'en_cours',
      pret_evaluation: nouvelleEtape >= ETAPE_PRET_EVALUATION,
      prochaine_revision: prochaineRevision,
      pourcentage: pourcentage,
      reussi: reussi,
      seuil: seuilReussite
    };
  }
}


