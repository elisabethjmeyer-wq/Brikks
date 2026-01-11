/**
 * Module de connexion Google Sheets
 * Gère les appels à l'API Google Sheets avec cache localStorage (persistant)
 */

const SheetsAPI = {
    // Cache localStorage avec TTL de 5 minutes
    _cachePrefix: 'brikks_sheets_',
    _cacheTTL: 5 * 60 * 1000, // 5 minutes

    /**
     * Récupère les données du cache localStorage ou null si expiré/absent
     */
    _getFromCache(key) {
        try {
            const cached = localStorage.getItem(this._cachePrefix + key);
            if (!cached) return null;

            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this._cacheTTL) {
                return data.values;
            }
            // Cache expiré, le supprimer
            localStorage.removeItem(this._cachePrefix + key);
            return null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Sauvegarde les données dans le cache localStorage
     */
    _saveToCache(key, values) {
        try {
            localStorage.setItem(this._cachePrefix + key, JSON.stringify({
                values: values,
                timestamp: Date.now()
            }));
        } catch (e) {
            // localStorage plein ou non disponible, ignorer silencieusement
        }
    },

    /**
     * Récupère les données d'un onglet Google Sheets
     * @param {string} sheetName - Nom de l'onglet
     * @param {string} range - Plage de cellules (optionnel, ex: "A1:Z100")
     * @returns {Promise<Array>} - Tableau de données
     */
    async getSheetData(sheetName, range = '') {
        const cacheKey = `${sheetName}_${range}`;

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
     * Pré-charge plusieurs onglets en parallèle (pour optimiser le chargement initial)
     * @param {Array<string>} sheetNames - Liste des noms d'onglets à pré-charger
     */
    async preload(sheetNames) {
        await Promise.all(sheetNames.map(name => this.getSheetData(name).catch(() => {})));
    },

    /**
     * Vide le cache (utile pour forcer un rechargement)
     */
    clearCache() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this._cachePrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    }
};
