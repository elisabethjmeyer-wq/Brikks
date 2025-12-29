/**
 * Module de connexion Google Sheets
 * Gère les appels à l'API Google Sheets
 */

const SheetsAPI = {
    /**
     * Récupère les données d'un onglet Google Sheets
     * @param {string} sheetName - Nom de l'onglet
     * @param {string} range - Plage de cellules (optionnel, ex: "A1:Z100")
     * @returns {Promise<Array>} - Tableau de données
     */
    async getSheetData(sheetName, range = '') {
        const fullRange = range ? `${sheetName}!${range}` : sheetName;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(fullRange)}?key=${CONFIG.API_KEY}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }

            const data = await response.json();
            return data.values || [];
        } catch (error) {
            console.error('Erreur lors de la récupération des données:', error);
            throw error;
        }
    },

    /**
     * Convertit les données brutes en tableau d'objets
     * La première ligne est utilisée comme en-têtes
     * @param {Array} rawData - Données brutes du spreadsheet
     * @returns {Array<Object>} - Tableau d'objets avec clés = en-têtes
     */
    parseSheetData(rawData) {
        if (!rawData || rawData.length < 2) {
            return [];
        }

        const headers = rawData[0].map(h => h.toString().trim().toLowerCase());
        const rows = rawData.slice(1);

        return rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        });
    },

    /**
     * Récupère et parse les données d'un onglet
     * @param {string} sheetName - Nom de l'onglet
     * @returns {Promise<Array<Object>>} - Données parsées
     */
    async fetchAndParse(sheetName) {
        const rawData = await this.getSheetData(sheetName);
        return this.parseSheetData(rawData);
    }
};
