// ========================================
// FONCTIONS UTILISATEURS
// ========================================

/**
 * Crée un nouvel utilisateur
 * @param {Object} data - { id, nom, prenom, identifiant, password, role, classes, groupes }
 */
function createUser(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.identifiant || (!userData.mot_de_passe && !userData.password)) {
    return { success: false, error: 'identifiant et mot_de_passe sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Vérifier si l'identifiant existe déjà
  const identifiantCol = headers.indexOf('identifiant');
  if (identifiantCol >= 0) {
    const exists = allData.slice(1).some(row => row[identifiantCol] === userData.identifiant);
    if (exists) {
      return { success: false, error: 'Cet identifiant existe déjà' };
    }
  }

  // Générer un ID si non fourni
  const id = userData.id || 'user_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  // Colonnes attendues: id | identifiant | mot_de_passe | prenom | nom | role | classe_id | groupe | date_creation | derniere_connexion
  const newRow = [];

  // Mapping des noms alternatifs
  const fieldMapping = {
    'mot_de_passe': userData.mot_de_passe || userData.password || '',
    'classe_id': userData.classe_id || userData.classes || '',
    'groupe': userData.groupe || userData.groupes || ''
  };

  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (colName === 'date_creation') {
      newRow[index] = new Date().toISOString().split('T')[0];
    } else if (fieldMapping[colName] !== undefined) {
      newRow[index] = fieldMapping[colName];
    } else if (userData[colName] !== undefined) {
      newRow[index] = userData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Utilisateur créé avec succès'
  };
}

/**
 * Met à jour un utilisateur
 * @param {Object} data - { id, nom?, prenom?, identifiant?, password?, role?, classes?, groupes? }
 */
function updateUser(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  let rowIndex = -1;

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Mettre à jour les colonnes spécifiées
  // Mapping des noms de colonnes (JS -> Sheet)
  const columnMapping = {
    'mot_de_passe': 'mot_de_passe',
    'password': 'mot_de_passe',
    'classe_id': 'classe_id',
    'classes': 'classe_id',
    'groupe': 'groupe',
    'groupes': 'groupe'
  };

  const updates = ['nom', 'prenom', 'identifiant', 'mot_de_passe', 'password', 'role', 'classe_id', 'classes', 'groupe', 'groupes'];
  updates.forEach(col => {
    if (userData[col] !== undefined) {
      // Trouver le nom de colonne réel dans le sheet
      const sheetCol = columnMapping[col] || col;
      const colIndex = headers.indexOf(sheetCol);
      if (colIndex >= 0) {
        sheet.getRange(rowIndex, colIndex + 1).setValue(userData[col]);
      }
    }
  });

  return {
    success: true,
    message: 'Utilisateur modifié avec succès'
  };
}

/**
 * Supprime toutes les lignes d'un onglet où une colonne a une valeur donnée
 * @param {Spreadsheet} ss - Le spreadsheet ouvert
 * @param {string} sheetName - Nom de l'onglet
 * @param {string} columnName - Nom de la colonne à chercher
 * @param {string} value - Valeur à supprimer
 * @returns {number} Nombre de lignes supprimées
 */
function deleteRowsByValue_(ss, sheetName, columnName, value) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;

  const allData = sheet.getDataRange().getValues();
  if (allData.length <= 1) return 0;

  const headers = allData[0];
  const col = headers.indexOf(columnName);
  if (col === -1) return 0;

  // Collecter les indices de lignes à supprimer (du bas vers le haut pour ne pas décaler)
  const rowsToDelete = [];
  for (let i = 1; i < allData.length; i++) {
    if (String(allData[i][col]) === String(value)) {
      rowsToDelete.push(i + 1); // +1 car getValues() est 0-indexé mais deleteRow() est 1-indexé
    }
  }

  // Supprimer du bas vers le haut
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  return rowsToDelete.length;
}

/**
 * Supprime un utilisateur et toutes ses données associées (cascade)
 * @param {Object} data - { id }
 */
function deleteUser(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  if (!userData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Suppression en cascade : nettoyer toutes les tables contenant des données de cet élève
  const tablesToClean = [
    { sheet: 'PROGRESSION_MEMORISATION', column: 'eleve_id' },
    { sheet: 'RESULTATS_EXERCICES', column: 'eleve_id' },
    { sheet: 'HISTORIQUE_PRATIQUES_SF', column: 'eleve_id' },
    { sheet: 'RESULTATS_ENTRAINEMENT', column: 'eleve_id' },
    { sheet: 'EVALUATION_RESULTATS', column: 'eleve_id' },
    { sheet: 'PROGRESSION_METHODOLOGIE', column: 'eleve_id' },
    { sheet: 'PROGRESSION_LECONS', column: 'eleve_id' },
    { sheet: 'EleveConnexions', column: 'eleve_id' },
    { sheet: 'EleveEntrainementsCompetences', column: 'eleve_id' }
  ];

  let totalCleaned = 0;
  tablesToClean.forEach(function(table) {
    totalCleaned += deleteRowsByValue_(ss, table.sheet, table.column, userData.id);
  });

  // Supprimer l'utilisateur lui-même
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Utilisateur supprimé avec succès (' + totalCleaned + ' lignes associées nettoyées)'
  };
}

/**
 * Réinitialise le mot de passe d'un utilisateur
 * @param {Object} data - { id, password }
 */
function resetPassword(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.UTILISATEURS);

  if (!sheet) {
    return { success: false, error: 'Onglet UTILISATEURS non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let userData = data;
  if (typeof data.data === 'string') {
    userData = JSON.parse(data.data);
  } else if (data.data) {
    userData = data.data;
  }

  // Supporter les deux noms: password ou mot_de_passe
  const newPassword = userData.password || userData.mot_de_passe;
  if (!userData.id || !newPassword) {
    return { success: false, error: 'id et password/mot_de_passe sont requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];

  // Trouver la ligne avec cet ID
  const idCol = headers.indexOf('id');
  // Chercher d'abord mot_de_passe, sinon password
  let passwordCol = headers.indexOf('mot_de_passe');
  if (passwordCol === -1) {
    passwordCol = headers.indexOf('password');
  }

  if (passwordCol === -1) {
    return { success: false, error: 'Colonne mot_de_passe non trouvée' };
  }

  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === userData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Utilisateur non trouvé: ' + userData.id };
  }

  // Mettre à jour le mot de passe
  sheet.getRange(rowIndex, passwordCol + 1).setValue(newPassword);

  return {
    success: true,
    message: 'Mot de passe réinitialisé avec succès'
  };
}

// ========================================
// FONCTIONS CLASSES
// ========================================

/**
 * Crée une nouvelle classe
 * @param {Object} data - { nom, annee_scolaire }
 */
function createClasse(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.CLASSES);

  if (!sheet) {
    return { success: false, error: 'Onglet CLASSES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let classeData = data;
  if (typeof data.data === 'string') {
    classeData = JSON.parse(data.data);
  } else if (data.data) {
    classeData = data.data;
  }

  if (!classeData.nom) {
    return { success: false, error: 'Le nom de la classe est requis' };
  }

  // Vérifier si une classe avec ce nom existe déjà
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const nomCol = headers.indexOf('nom');

  if (nomCol >= 0) {
    const exists = allData.slice(1).some(row => row[nomCol] === classeData.nom);
    if (exists) {
      return { success: false, error: 'Une classe avec ce nom existe déjà' };
    }
  }

  // Générer un ID unique
  const id = classeData.id || 'classe_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (classeData[colName] !== undefined) {
      newRow[index] = classeData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Classe créée avec succès'
  };
}

/**
 * Supprime une classe
 * @param {Object} data - { id }
 */
function deleteClasse(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.CLASSES);

  if (!sheet) {
    return { success: false, error: 'Onglet CLASSES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let classeData = data;
  if (typeof data.data === 'string') {
    classeData = JSON.parse(data.data);
  } else if (data.data) {
    classeData = data.data;
  }

  if (!classeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === classeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Classe non trouvée: ' + classeData.id };
  }

  // Vérifier s'il y a des utilisateurs dans cette classe
  const usersSheet = ss.getSheetByName(SHEETS.UTILISATEURS);
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    const classeIdCol = usersData[0].indexOf('classe_id');
    if (classeIdCol >= 0) {
      const hasUsers = usersData.slice(1).some(row => row[classeIdCol] === classeData.id);
      if (hasUsers) {
        return {
          success: false,
          error: 'Impossible de supprimer cette classe car elle contient des utilisateurs'
        };
      }
    }
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Classe supprimée avec succès'
  };
}

// ========================================
// FONCTIONS GROUPES
// ========================================

/**
 * Crée un nouveau groupe
 * @param {Object} data - { nom, classe_id, type }
 */
function createGroupe(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS.GROUPES);

  if (!sheet) {
    return { success: false, error: 'Onglet GROUPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let groupeData = data;
  if (typeof data.data === 'string') {
    groupeData = JSON.parse(data.data);
  } else if (data.data) {
    groupeData = data.data;
  }

  if (!groupeData.nom) {
    return { success: false, error: 'Le nom du groupe est requis' };
  }

  // Vérifier si un groupe avec ce nom existe déjà
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const nomCol = headers.indexOf('nom');

  if (nomCol >= 0) {
    const exists = allData.slice(1).some(row => row[nomCol] === groupeData.nom);
    if (exists) {
      return { success: false, error: 'Un groupe avec ce nom existe déjà' };
    }
  }

  // Générer un ID unique
  const id = groupeData.id || 'groupe_' + new Date().getTime();

  // Construire la ligne selon les colonnes existantes
  const newRow = [];
  headers.forEach((header, index) => {
    const colName = header.toLowerCase().trim();
    if (colName === 'id') {
      newRow[index] = id;
    } else if (groupeData[colName] !== undefined) {
      newRow[index] = groupeData[colName];
    } else {
      newRow[index] = '';
    }
  });

  sheet.appendRow(newRow);

  return {
    success: true,
    id: id,
    message: 'Groupe créé avec succès'
  };
}

/**
 * Supprime un groupe
 * @param {Object} data - { id }
 */
function deleteGroupe(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEETS.GROUPES);

  if (!sheet) {
    return { success: false, error: 'Onglet GROUPES non trouvé' };
  }

  // Parse les données si elles sont en string (JSONP)
  let groupeData = data;
  if (typeof data.data === 'string') {
    groupeData = JSON.parse(data.data);
  } else if (data.data) {
    groupeData = data.data;
  }

  if (!groupeData.id) {
    return { success: false, error: 'id est requis' };
  }

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const idCol = headers.indexOf('id');

  // Trouver la ligne
  let rowIndex = -1;
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][idCol] === groupeData.id) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {
    return { success: false, error: 'Groupe non trouvé: ' + groupeData.id };
  }

  // Vérifier s'il y a des utilisateurs dans ce groupe
  const usersSheet = ss.getSheetByName(SHEETS.UTILISATEURS);
  if (usersSheet) {
    const usersData = usersSheet.getDataRange().getValues();
    const groupeCol = usersData[0].indexOf('groupe');
    if (groupeCol >= 0) {
      const hasUsers = usersData.slice(1).some(row => row[groupeCol] === groupeData.id);
      if (hasUsers) {
        return {
          success: false,
          error: 'Impossible de supprimer ce groupe car il contient des utilisateurs'
        };
      }
    }
  }

  // Supprimer la ligne
  sheet.deleteRow(rowIndex);

  return {
    success: true,
    message: 'Groupe supprimé avec succès'
  };
}

