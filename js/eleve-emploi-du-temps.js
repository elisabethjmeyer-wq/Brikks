/**
 * Module Emploi du temps - Élève
 * Affiche le Google Calendar depuis les paramètres
 */

const EleveEmploiDuTemps = {
    /**
     * Initialise le module
     */
    async init() {
        try {
            const agendaUrl = await this.getAgendaUrl();
            this.render(agendaUrl);
        } catch (error) {
            console.error('Erreur chargement emploi du temps:', error);
            this.showError();
        }
    },

    /**
     * Récupère l'URL de l'agenda depuis PARAMETRES
     */
    async getAgendaUrl() {
        const params = await SheetsAPI.fetchAndParse('PARAMETRES');
        const agendaParam = params.find(p =>
            p.cle === 'agenda_url' ||
            p.parametre === 'agenda_url' ||
            p.nom === 'agenda_url'
        );

        if (agendaParam) {
            return agendaParam.valeur || agendaParam.url || agendaParam.value || '';
        }

        return '';
    },

    /**
     * Convertit l'URL Google Calendar en URL embed
     */
    convertToEmbedUrl(url) {
        if (!url) return '';

        // Si c'est déjà une URL embed
        if (url.includes('/embed')) {
            return url;
        }

        // Extraire l'ID du calendrier
        // Format: https://calendar.google.com/calendar/u/0?cid=xxx
        // ou: https://calendar.google.com/calendar/embed?src=xxx
        let calendarId = '';

        if (url.includes('cid=')) {
            const match = url.match(/cid=([^&]+)/);
            if (match) calendarId = decodeURIComponent(match[1]);
        } else if (url.includes('src=')) {
            const match = url.match(/src=([^&]+)/);
            if (match) calendarId = decodeURIComponent(match[1]);
        }

        if (calendarId) {
            return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=Europe%2FParis&mode=WEEK&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0`;
        }

        // Si on ne peut pas convertir, retourner l'URL telle quelle
        return url;
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
            const embedUrl = this.convertToEmbedUrl(url);

            content.innerHTML = `
                <div class="iframe-container iframe-calendar">
                    <iframe
                        src="${embedUrl}"
                        class="module-iframe"
                        frameborder="0"
                        scrolling="no"
                    ></iframe>
                </div>
                <div class="module-actions">
                    <a href="${url}" target="_blank" class="btn btn-secondary">
                        <span>↗</span> Ouvrir dans Google Calendar
                    </a>
                </div>
            `;
        } else {
            // Pas d'URL configurée
            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📆</div>
                    <h3>Emploi du temps non configuré</h3>
                    <p>L'emploi du temps n'a pas encore été configuré par l'administrateur.</p>
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
window.EleveEmploiDuTemps = EleveEmploiDuTemps;
