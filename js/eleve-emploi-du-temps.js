/**
 * Module Emploi du temps - Élève
 * Affiche le Google Calendar basé sur le groupe de l'élève
 */

const EleveEmploiDuTemps = {
    /**
     * Initialise le module
     */
    async init() {
        try {
            const result = await this.getAgendaForStudent();
            this.render(result);
        } catch (error) {
            console.error('Erreur chargement emploi du temps:', error);
            this.showError();
        }
    },

    /**
     * Récupère le groupe de l'élève connecté et l'URL de son agenda
     */
    async getAgendaForStudent() {
        // Récupérer le groupe de l'élève depuis la session
        const sessionData = sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        const currentUser = sessionData ? JSON.parse(sessionData) : null;

        if (!currentUser || !currentUser.groupe) {
            return { url: '', groupe: '', reason: 'no_group' };
        }

        const studentGroup = currentUser.groupe;

        // Chercher l'agenda correspondant dans AGENDAS
        try {
            const agendas = await SheetsAPI.fetchAndParse('AGENDAS');

            const agenda = agendas.find(a => {
                return a.groupe === studentGroup || a.group === studentGroup;
            });

            if (agenda) {
                return {
                    url: agenda.url || agenda.valeur || '',
                    groupe: studentGroup,
                    reason: 'found'
                };
            }

            return { url: '', groupe: studentGroup, reason: 'no_calendar' };
        } catch (error) {
            console.error('[EmploiDuTemps] Erreur récupération AGENDAS:', error);
            return { url: '', groupe: studentGroup, reason: 'error' };
        }
    },

    /**
     * Convertit l'URL Google Calendar en URL embed
     */
    convertToEmbedUrl(url) {
        if (!url) return '';

        // Si c'est déjà une URL embed
        if (url.includes('/embed')) {
            // S'assurer que les bons paramètres sont présents
            if (!url.includes('showTitle=')) {
                url += '&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&mode=MONTH';
            }
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
        } else if (url.includes('@group.calendar.google.com') || url.includes('@gmail.com')) {
            // L'URL est peut-être juste l'ID du calendrier
            calendarId = url;
        }

        if (calendarId) {
            // Paramètres pour un affichage public sans authentification
            return `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=Europe%2FParis&mode=MONTH&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&wkst=2`;
        }

        // Si on ne peut pas convertir, retourner l'URL telle quelle
        return url;
    },

    /**
     * Affiche le contenu
     */
    render(result) {
        const loader = document.getElementById('loader');
        const content = document.getElementById('module-content');

        loader.style.display = 'none';
        content.style.display = 'block';

        if (result.url) {
            const embedUrl = this.convertToEmbedUrl(result.url);
            content.innerHTML = `
                <div class="calendar-header">
                    <h3>📅 Calendrier de ta classe</h3>
                    <span class="sync-badge">Synchronisation en direct</span>
                </div>
                <div class="iframe-container iframe-calendar">
                    <iframe
                        src="${embedUrl}"
                        class="module-iframe"
                        frameborder="0"
                        scrolling="yes"
                        id="calendar-iframe"
                    ></iframe>
                </div>
                <div class="calendar-note" style="text-align: center; margin-top: 0.75rem; font-size: 0.85rem; color: #6b7280;">
                    Si le calendrier ne s'affiche pas correctement,
                    <a href="${embedUrl}" target="_blank" style="color: #3b82f6;">clique ici pour l'ouvrir dans un nouvel onglet</a>
                </div>
            `;
        } else {
            // État vide - pas de groupe ou calendrier non trouvé
            let message = '';
            let icon = '📆';

            if (result.reason === 'no_group') {
                icon = '👤';
                message = `
                    <h3>Groupe non défini</h3>
                    <p>Ton groupe n'est pas encore configuré. Contacte ton enseignant pour qu'il te l'attribue.</p>
                `;
            } else if (result.reason === 'no_calendar') {
                message = `
                    <h3>Calendrier non disponible</h3>
                    <p>Le calendrier pour le groupe "${result.groupe}" n'est pas encore configuré.</p>
                `;
            } else {
                message = `
                    <h3>Emploi du temps non configuré</h3>
                    <p>L'emploi du temps n'a pas encore été configuré par l'administrateur.</p>
                `;
            }

            content.innerHTML = `
                <div class="empty-state">
                    <div class="icon">${icon}</div>
                    ${message}
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
