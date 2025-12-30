/**
 * Module Classeur Modèle - Élève
 * Affiche le classeur Publuu depuis les paramètres
 */

const EleveClasseur = {
    /**
     * Initialise le module
     */
    async init() {
        try {
            const classeurUrl = await this.getClasseurUrl();
            this.render(classeurUrl);
        } catch (error) {
            console.error('Erreur chargement classeur:', error);
            this.showError();
        }
    },

    /**
     * Récupère l'URL du classeur depuis PARAMETRES
     */
    async getClasseurUrl() {
        const params = await SheetsAPI.fetchAndParse('PARAMETRES');
        const classeurParam = params.find(p =>
            p.cle === 'classeur_url' ||
            p.parametre === 'classeur_url' ||
            p.nom === 'classeur_url'
        );

        if (classeurParam) {
            return classeurParam.valeur || classeurParam.url || classeurParam.value || '';
        }

        return '';
    },

    /**
     * Affiche le contenu
     */
    render(url) {
        const loader = document.getElementById('loader');
        const content = document.getElementById('module-content');

        loader.style.display = 'none';
        content.style.display = 'block';

        if (url) {
            // Afficher en iframe
            content.innerHTML = `
                <div class="iframe-container">
                    <iframe
                        src="${url}"
                        class="module-iframe"
                        allowfullscreen
                        loading="lazy"
                    ></iframe>
                </div>
                <div class="module-actions">
                    <a href="${url}" target="_blank" class="btn btn-secondary">
                        <span>↗</span> Ouvrir dans un nouvel onglet
                    </a>
                </div>
            `;
        } else {
            // Pas d'URL configurée
            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📂</div>
                    <h3>Classeur non configuré</h3>
                    <p>Le classeur modèle n'a pas encore été configuré par l'administrateur.</p>
                </div>
            `;
        }
    },

    /**
     * Affiche une erreur
     */
    showError() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('error-state').style.display = 'block';
    }
};

// Export
window.EleveClasseur = EleveClasseur;
