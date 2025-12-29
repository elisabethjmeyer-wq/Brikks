/**
 * Application principale Brikks
 * Logique générale et utilitaires
 */

const App = {
    /**
     * Initialise l'application
     */
    init() {
        console.log('Brikks initialisé');
        this.checkAPIKey();
    },

    /**
     * Vérifie si la clé API est configurée
     */
    checkAPIKey() {
        if (!CONFIG.API_KEY) {
            console.warn('⚠️ Clé API Google non configurée dans config.js');
        }
    },

    /**
     * Affiche un message d'erreur à l'utilisateur
     * @param {string} message - Message à afficher
     * @param {HTMLElement} container - Élément conteneur (optionnel)
     */
    showError(message, container = null) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;

        if (container) {
            // Supprimer les anciennes erreurs
            const oldError = container.querySelector('.error-message');
            if (oldError) oldError.remove();

            container.appendChild(errorDiv);
        } else {
            alert(message);
        }
    },

    /**
     * Affiche un message de succès
     * @param {string} message - Message à afficher
     * @param {HTMLElement} container - Élément conteneur (optionnel)
     */
    showSuccess(message, container = null) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;

        if (container) {
            const oldMsg = container.querySelector('.success-message');
            if (oldMsg) oldMsg.remove();

            container.appendChild(successDiv);

            // Auto-suppression après 3 secondes
            setTimeout(() => successDiv.remove(), 3000);
        }
    },

    /**
     * Affiche/masque un loader
     * @param {boolean} show - Afficher ou masquer
     * @param {HTMLElement} button - Bouton à désactiver (optionnel)
     */
    toggleLoader(show, button = null) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }

        if (button) {
            button.disabled = show;
        }
    },

    /**
     * Formate une date au format français
     * @param {string} dateStr - Date à formater
     * @returns {string} - Date formatée
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    /**
     * Échappe les caractères HTML pour éviter les XSS
     * @param {string} str - Chaîne à échapper
     * @returns {string} - Chaîne sécurisée
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => App.init());
