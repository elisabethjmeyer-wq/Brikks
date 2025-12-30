/**
 * Admin Leçons - Gestion des leçons (disciplines, thèmes, chapitres)
 */

const AdminLecons = {
    // Données
    disciplines: [],
    themes: [],
    chapitres: [],

    // Icônes par discipline
    disciplineIcons: {
        'litterature': '📚',
        'histoire': '🏛️',
        'geographie': '🗺️',
        'emc': '⚖️',
        'default': '📖'
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.render();
            this.populateSelects();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const [disciplines, themes, chapitres] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.DISCIPLINES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.THEMES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CHAPITRES)
        ]);

        this.disciplines = disciplines || [];
        this.themes = themes || [];
        this.chapitres = chapitres || [];

        console.log('Données chargées:', {
            disciplines: this.disciplines.length,
            themes: this.themes.length,
            chapitres: this.chapitres.length
        });
    },

    /**
     * Affiche les données
     */
    render() {
        const loader = document.getElementById('loader');
        const container = document.getElementById('themes-container');
        const emptyState = document.getElementById('empty-state');

        loader.style.display = 'none';

        if (this.themes.length === 0) {
            emptyState.style.display = 'block';
            container.style.display = 'none';
            this.updateStats();
            return;
        }

        container.style.display = 'flex';
        emptyState.style.display = 'none';

        // Grouper les thèmes par discipline
        const themesByDiscipline = this.groupThemesByDiscipline();

        let html = '';

        for (const [disciplineId, themes] of Object.entries(themesByDiscipline)) {
            const discipline = this.disciplines.find(d => d.id === disciplineId);
            const disciplineName = discipline ? discipline.nom : 'Autre';
            // Utiliser l'emoji de la discipline si disponible
            const icon = discipline && discipline.emoji ? discipline.emoji : this.getIcon(disciplineName);

            themes.forEach(theme => {
                const chapitres = this.getChapitresForTheme(theme.id);
                html += this.renderThemeCard(theme, chapitres, icon, disciplineName);
            });
        }

        container.innerHTML = html;
        this.updateStats();
        this.bindEvents();
    },

    /**
     * Groupe les thèmes par discipline
     */
    groupThemesByDiscipline() {
        const grouped = {};

        this.themes.forEach(theme => {
            const disciplineId = theme.discipline_id || 'other';
            if (!grouped[disciplineId]) {
                grouped[disciplineId] = [];
            }
            grouped[disciplineId].push(theme);
        });

        return grouped;
    },

    /**
     * Récupère les chapitres d'un thème
     */
    getChapitresForTheme(themeId) {
        return this.chapitres
            .filter(c => c.theme_id === themeId)
            .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
    },

    /**
     * Récupère l'icône d'une discipline
     */
    getIcon(disciplineName) {
        const name = (disciplineName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (name.includes('litt')) return this.disciplineIcons.litterature;
        if (name.includes('hist')) return this.disciplineIcons.histoire;
        if (name.includes('geo')) return this.disciplineIcons.geographie;
        if (name.includes('emc') || name.includes('civique')) return this.disciplineIcons.emc;

        return this.disciplineIcons.default;
    },

    /**
     * Génère le HTML d'une carte thème
     */
    renderThemeCard(theme, chapitres, icon, disciplineName) {
        const chapitresHtml = chapitres.map((chapitre, index) =>
            this.renderChapterItem(chapitre, index + 1)
        ).join('');

        // Utiliser 'nom' ou 'titre' selon ce qui existe
        const themeName = theme.nom || theme.titre || 'Thème sans titre';

        return `
            <div class="theme-card" data-theme-id="${theme.id}">
                <div class="theme-header">
                    <span class="drag-handle">⋮⋮</span>
                    <div class="theme-icon">${icon}</div>
                    <div class="theme-info">
                        <h2 class="theme-title">${themeName}</h2>
                        <p class="theme-meta">${icon} ${disciplineName} • ${chapitres.length} chapitre${chapitres.length > 1 ? 's' : ''}</p>
                    </div>
                    <div class="theme-actions">
                        <button class="btn btn-ghost btn-xs" onclick="AdminLecons.editTheme('${theme.id}')">✏️ Modifier</button>
                        <button class="btn btn-ghost btn-xs danger" onclick="AdminLecons.deleteTheme('${theme.id}')">🗑️</button>
                        <button class="theme-toggle" title="Réduire">▼</button>
                    </div>
                </div>
                <div class="chapters-list">
                    ${chapitresHtml}
                    <button class="add-chapter-btn" onclick="AdminLecons.addChapterToTheme('${theme.id}')">
                        + Ajouter un chapitre
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Génère le HTML d'un chapitre
     */
    renderChapterItem(chapitre, numero) {
        const status = (chapitre.statut || 'brouillon').toLowerCase();
        const statusBadge = this.getStatusBadge(status);
        const lessonTag = chapitre.numero_lecon
            ? `<span class="lesson-tag">L${chapitre.numero_lecon}</span>`
            : `<span class="lesson-tag empty">—</span>`;

        // Supporter 'lien' ou 'contenu' comme source de contenu
        const lien = chapitre.lien || '';
        const lienHtml = lien
            ? `<div class="chapter-link"><a href="${lien}" target="_blank">📄 ${this.truncateUrl(lien)}</a></div>`
            : '';

        return `
            <div class="chapter-item" data-chapter-id="${chapitre.id}">
                <span class="chapter-drag">⋮⋮</span>
                <span class="chapter-number">${numero}</span>
                <div class="chapter-info">
                    <div class="chapter-title">
                        ${chapitre.titre || 'Chapitre sans titre'}
                        ${lessonTag}
                    </div>
                    ${lienHtml}
                </div>
                ${statusBadge}
                <div class="chapter-actions">
                    <button class="action-btn" onclick="AdminLecons.editChapter('${chapitre.id}')" title="Modifier">✏️</button>
                    <button class="action-btn" onclick="AdminLecons.viewChapter('${chapitre.id}')" title="Voir">👁️</button>
                    <button class="action-btn danger" onclick="AdminLecons.deleteChapter('${chapitre.id}')" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    /**
     * Retourne le badge de statut
     */
    getStatusBadge(status) {
        switch(status) {
            case 'publie':
                return '<span class="status-badge visible">🟢 Publié</span>';
            case 'pret':
                return '<span class="status-badge ready">🟡 Prêt</span>';
            default:
                return '<span class="status-badge draft">⚪ Brouillon</span>';
        }
    },

    /**
     * Tronque une URL
     */
    truncateUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            let display = urlObj.hostname + urlObj.pathname;
            if (display.length > 40) {
                display = display.substring(0, 37) + '...';
            }
            return display;
        } catch {
            return url.length > 40 ? url.substring(0, 37) + '...' : url;
        }
    },

    /**
     * Met à jour les statistiques
     */
    updateStats() {
        const publies = this.chapitres.filter(c => (c.statut || '').toLowerCase() === 'publie').length;
        const prets = this.chapitres.filter(c => (c.statut || '').toLowerCase() === 'pret').length;
        const brouillons = this.chapitres.filter(c => {
            const s = (c.statut || '').toLowerCase();
            return s === 'brouillon' || s === '';
        }).length;
        const total = this.chapitres.length;

        document.getElementById('stat-publies').textContent = publies;
        document.getElementById('stat-prets').textContent = prets;
        document.getElementById('stat-brouillons').textContent = brouillons;
        document.getElementById('stat-total').textContent = `${total} chapitre${total > 1 ? 's' : ''}`;
    },

    /**
     * Remplit les selects des modales
     */
    populateSelects() {
        // Select disciplines pour nouveau thème
        const disciplineSelect = document.getElementById('theme-discipline-select');
        if (disciplineSelect) {
            disciplineSelect.innerHTML = '<option value="">— Sélectionner une discipline —</option>';
            this.disciplines.forEach(d => {
                // Utiliser l'emoji de la discipline ou l'icône par défaut
                const icon = d.emoji || this.getIcon(d.nom);
                disciplineSelect.innerHTML += `<option value="${d.id}">${icon} ${d.nom}</option>`;
            });
        }

        // Select thèmes pour nouveau chapitre
        const themeSelect = document.getElementById('chapter-theme-select');
        if (themeSelect) {
            themeSelect.innerHTML = '<option value="">— Sélectionner un thème —</option>';

            // Grouper par discipline
            const themesByDiscipline = this.groupThemesByDiscipline();

            for (const [disciplineId, themes] of Object.entries(themesByDiscipline)) {
                const discipline = this.disciplines.find(d => d.id === disciplineId);
                const disciplineName = discipline ? discipline.nom : 'Autre';
                const icon = discipline && discipline.emoji ? discipline.emoji : this.getIcon(disciplineName);

                themes.forEach(theme => {
                    // Utiliser 'nom' ou 'titre'
                    const themeName = theme.nom || theme.titre || 'Sans titre';
                    themeSelect.innerHTML += `<option value="${theme.id}">${themeName} (${icon} ${disciplineName})</option>`;
                });
            }
        }
    },

    /**
     * Bind les événements
     */
    bindEvents() {
        // Toggle des thèmes
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.theme-card');
                const list = card.querySelector('.chapters-list');
                if (list.style.display === 'none') {
                    list.style.display = 'block';
                    btn.textContent = '▼';
                } else {
                    list.style.display = 'none';
                    btn.textContent = '▶';
                }
            });
        });
    },

    /**
     * Ouvre le modal pour ajouter un chapitre à un thème spécifique
     */
    addChapterToTheme(themeId) {
        document.getElementById('chapter-theme-select').value = themeId;
        openModal('modal-chapter');
    },

    // ID en cours d'édition
    editingThemeId: null,
    editingChapterId: null,

    /**
     * Appelle le Web App (compatible CORS)
     */
    async callWebApp(action, data) {
        if (CONFIG.WEBAPP_URL === 'REMPLACER_PAR_URL_WEB_APP') {
            alert('Erreur : Le Web App n\'est pas configuré.\nVoir google-apps-script/DEPLOIEMENT.md');
            return { success: false, error: 'Web App non configuré' };
        }

        try {
            // Construire l'URL avec les paramètres
            const params = new URLSearchParams();
            params.append('action', action);
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    params.append(key, data[key]);
                }
            });

            const url = CONFIG.WEBAPP_URL + '?' + params.toString();

            const response = await fetch(url, {
                method: 'GET',
                mode: 'cors'
            });

            return await response.json();
        } catch (error) {
            console.error('Erreur Web App:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Ouvre le modal pour éditer un thème
     */
    editTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        this.editingThemeId = themeId;

        document.getElementById('theme-discipline-select').value = theme.discipline_id || '';
        document.getElementById('theme-numero').value = theme.ordre || '';
        document.getElementById('theme-titre').value = theme.nom || theme.titre || '';

        document.getElementById('modal-theme-title').textContent = 'Modifier le thème';
        openModal('modal-theme');
    },

    /**
     * Ouvre le modal pour éditer un chapitre
     */
    editChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        if (!chapitre) return;

        this.editingChapterId = chapitreId;

        document.getElementById('chapter-theme-select').value = chapitre.theme_id || '';
        document.getElementById('chapter-titre').value = chapitre.titre || '';
        document.getElementById('chapter-numero').value = chapitre.numero || '';
        document.getElementById('chapter-lecon').value = chapitre.numero_lecon || '';
        document.getElementById('chapter-lien').value = chapitre.lien || '';

        // Statut
        const statut = (chapitre.statut || 'brouillon').toLowerCase();
        const radioBtn = document.querySelector(`input[name="chapter-status"][value="${statut}"]`);
        if (radioBtn) radioBtn.checked = true;

        document.getElementById('modal-chapter-title').textContent = 'Modifier le chapitre';
        openModal('modal-chapter');
    },

    /**
     * Voir un chapitre
     */
    viewChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        if (chapitre && chapitre.lien) {
            window.open(chapitre.lien, '_blank');
        } else {
            alert('Ce chapitre n\'a pas de lien associé.');
        }
    },

    /**
     * Supprime un chapitre
     */
    async deleteChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        if (!chapitre) return;

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le chapitre "${chapitre.titre}" ?`)) {
            return;
        }

        const result = await this.callWebApp('deleteChapter', { id: chapitreId });

        if (result.success) {
            this.showNotification('Chapitre supprimé avec succès', 'success');
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Supprime un thème
     */
    async deleteTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        const themeName = theme.nom || theme.titre || 'ce thème';
        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${themeName}" ?\n\nNote : Vous ne pourrez pas supprimer un thème qui contient des chapitres.`)) {
            return;
        }

        const result = await this.callWebApp('deleteTheme', { id: themeId });

        if (result.success) {
            this.showNotification('Thème supprimé avec succès', 'success');
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Sauvegarde un thème (création ou modification)
     */
    async saveTheme() {
        const disciplineId = document.getElementById('theme-discipline-select').value;
        const ordre = document.getElementById('theme-numero').value;
        const nom = document.getElementById('theme-titre').value;

        if (!disciplineId || !nom) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        const data = {
            discipline_id: disciplineId,
            nom: nom,
            ordre: ordre || undefined
        };

        let result;
        if (this.editingThemeId) {
            // Modification
            data.id = this.editingThemeId;
            result = await this.callWebApp('updateTheme', data);
        } else {
            // Création
            result = await this.callWebApp('addTheme', data);
        }

        if (result.success) {
            this.showNotification(this.editingThemeId ? 'Thème modifié' : 'Thème créé', 'success');
            closeModal('modal-theme');
            this.resetThemeForm();
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Sauvegarde un chapitre (création ou modification)
     */
    async saveChapter() {
        const themeId = document.getElementById('chapter-theme-select').value;
        const titre = document.getElementById('chapter-titre').value;
        const numero = document.getElementById('chapter-numero').value;
        const numeroLecon = document.getElementById('chapter-lecon').value;
        const lien = document.getElementById('chapter-lien').value;
        const statut = document.querySelector('input[name="chapter-status"]:checked').value;

        if (!themeId || !titre) {
            alert('Veuillez sélectionner un thème et entrer un titre.');
            return;
        }

        const data = {
            theme_id: themeId,
            titre: titre,
            numero: numero || undefined,
            numero_lecon: numeroLecon || undefined,
            lien: lien || undefined,
            statut: statut
        };

        let result;
        if (this.editingChapterId) {
            // Modification
            data.id = this.editingChapterId;
            result = await this.callWebApp('updateChapter', data);
        } else {
            // Création
            result = await this.callWebApp('addChapter', data);
        }

        if (result.success) {
            this.showNotification(this.editingChapterId ? 'Chapitre modifié' : 'Chapitre créé', 'success');
            closeModal('modal-chapter');
            this.resetChapterForm();
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Réinitialise le formulaire thème
     */
    resetThemeForm() {
        this.editingThemeId = null;
        document.getElementById('theme-discipline-select').value = '';
        document.getElementById('theme-numero').value = '';
        document.getElementById('theme-titre').value = '';
        document.getElementById('modal-theme-title').textContent = 'Nouveau thème';
    },

    /**
     * Réinitialise le formulaire chapitre
     */
    resetChapterForm() {
        this.editingChapterId = null;
        document.getElementById('chapter-theme-select').value = '';
        document.getElementById('chapter-titre').value = '';
        document.getElementById('chapter-numero').value = '';
        document.getElementById('chapter-lecon').value = '';
        document.getElementById('chapter-lien').value = '';
        document.querySelector('input[name="chapter-status"][value="brouillon"]').checked = true;
        document.getElementById('modal-chapter-title').textContent = 'Nouveau chapitre';
    },

    /**
     * Affiche une notification
     */
    showNotification(message, type = 'info') {
        // Créer l'élément de notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${type === 'success' ? '✓' : 'ℹ'}</span>
            <span>${message}</span>
        `;

        // Ajouter au DOM
        document.body.appendChild(notification);

        // Animation d'entrée
        setTimeout(() => notification.classList.add('show'), 10);

        // Supprimer après 3 secondes
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <div class="icon">❌</div>
                <h3>Erreur</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    }
};

// Fonctions globales pour les modales
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Fermer modal sur clic overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Export
window.AdminLecons = AdminLecons;
window.openModal = openModal;
window.closeModal = closeModal;
