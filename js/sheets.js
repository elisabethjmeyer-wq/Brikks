/**
 * Module de connexion Google Sheets
 * Gère les appels à l'API Google Sheets avec cache mémoire
 */

const SheetsAPI = {
    // Cache en mémoire avec TTL de 5 minutes
    _cache: {},
    _cacheTTL: 5 * 60 * 1000, // 5 minutes

    /**
     * Récupère les données du cache ou null si expiré/absent
     */
    _getFromCache(key) {
        const cached = this._cache[key];
        if (cached && (Date.now() - cached.timestamp) < this._cacheTTL) {
            return cached.data;
        }
        return null;
    },

    /**
     * Sauvegarde les données dans le cache
     */
    _saveToCache(key, data) {
        this._cache[key] = {
            data: data,
            timestamp: Date.now()
        };
    },

    /**
     * Récupère les données d'un onglet Google Sheets
     * @param {string} sheetName - Nom de l'onglet
     * @param {string} range - Plage de cellules (optionnel, ex: "A1:Z100")
     * @returns {Promise<Array>} - Tableau de données
     */
    async getSheetData(sheetName, range = '') {
        const cacheKey = `sheet_${sheetName}_${range}`;

        // Vérifier le cache d'abord
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        const fullRange = range ? `${sheetName}!${range}` : sheetName;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(fullRange)}?key=${CONFIG.API_KEY}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }

            const data = await response.json();
            const values = data.values || [];

            // Sauvegarder dans le cache
            this._saveToCache(cacheKey, values);

            return values;
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
     * Récupère et parse les données d'un onglet (avec cache)
     * @param {string} sheetName - Nom de l'onglet
     * @returns {Promise<Array<Object>>} - Données parsées
     */
    async fetchAndParse(sheetName) {
        const rawData = await this.getSheetData(sheetName);
        return this.parseSheetData(rawData);
    },

    /**
     * Vide le cache (utile pour forcer un rechargement)
     */
    clearCache() {
        this._cache = {};
    }
};
