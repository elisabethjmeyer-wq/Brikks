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
            const classeurData = await this.getClasseurData();
            this.render(classeurData);
        } catch (error) {
            console.error('Erreur chargement classeur:', error);
            this.showError();
        }
    },

    /**
     * Récupère l'URL et la date de mise à jour du classeur depuis PARAMETRES
     */
    async getClasseurData() {
        const params = await SheetsAPI.fetchAndParse('PARAMETRES');

        // Chercher l'URL du classeur
        const classeurParam = params.find(p =>
            p.cle === 'classeur_url' ||
            p.parametre === 'classeur_url' ||
            p.nom === 'classeur_url'
        );

        // Chercher la date de mise à jour (optionnel)
        const dateParam = params.find(p =>
            p.cle === 'classeur_date' ||
            p.parametre === 'classeur_date' ||
            p.nom === 'classeur_date'
        );

        return {
            url: classeurParam ? (classeurParam.valeur || classeurParam.url || classeurParam.value || '') : '',
            lastUpdate: dateParam ? (dateParam.valeur || dateParam.value || '') : ''
        };
    },

    /**
     * Convertit l'URL Publuu en URL embed
     */
    convertToEmbedUrl(url) {
        if (!url) return '';

        // Si déjà en format embed
        if (url.includes('?embed')) {
            return url;
        }

        // Ajouter /page/1?embed si pas présent
        if (url.includes('publuu.com')) {
            // Nettoyer l'URL
            let cleanUrl = url.replace(/\/$/, ''); // Enlever trailing slash

            if (!cleanUrl.includes('/page/')) {
                cleanUrl += '/page/1';
            }

            return cleanUrl + '?embed';
        }

        return url;
    },

    /**
     * Formate la date de mise à jour
     */
    formatDate(dateStr) {
        if (!dateStr) {
            // Date par défaut : aujourd'hui
            const today = new Date();
            return today.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        // Si c'est déjà une date formatée
        if (dateStr.includes('/') || dateStr.includes('-')) {
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            } catch (e) {
                return dateStr;
            }
        }

        return dateStr;
    },

    /**
     * Affiche le contenu
     */
    render(data) {
        const loader = document.getElementById('loader');
        const content = document.getElementById('module-content');

        loader.style.display = 'none';
        content.style.display = 'block';

        if (data.url) {
            const embedUrl = this.convertToEmbedUrl(data.url);
            const displayDate = this.formatDate(data.lastUpdate);

            content.innerHTML = `
                <div class="flipbook-header">
                    <div class="flipbook-title">
                        <span>📖</span> Classeur interactif
                    </div>
                    <span class="update-badge">🔄 Mis à jour régulièrement</span>
                </div>
                <div class="flipbook-container">
                    <iframe
                        src="${embedUrl}"
                        class="flipbook-iframe"
                        allowfullscreen
                        loading="lazy"
                    ></iframe>
                </div>
                <div class="flipbook-footer">
                    <div class="flipbook-date">
                        📄 Dernière mise à jour : ${displayDate}
                    </div>
                    <a href="${data.url}" target="_blank" class="btn btn-secondary">
                        <span>🔗</span> Ouvrir dans un nouvel onglet
                    </a>
                </div>
            `;
        } else {
            // Pas d'URL configurée
            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📂</div>
                    <h3>Classeur non disponible</h3>
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
