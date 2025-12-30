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
            const icon = this.getIcon(disciplineName);

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

        return `
            <div class="theme-card" data-theme-id="${theme.id}">
                <div class="theme-header">
                    <span class="drag-handle">⋮⋮</span>
                    <div class="theme-icon">${icon}</div>
                    <div class="theme-info">
                        <h2 class="theme-title">${theme.titre || 'Thème sans titre'}</h2>
                        <p class="theme-meta">${icon} ${disciplineName} • ${chapitres.length} chapitre${chapitres.length > 1 ? 's' : ''}</p>
                    </div>
                    <div class="theme-actions">
                        <button class="btn btn-ghost btn-xs" onclick="AdminLecons.editTheme('${theme.id}')">✏️ Modifier</button>
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

        const lienHtml = chapitre.lien
            ? `<div class="chapter-link"><a href="${chapitre.lien}" target="_blank">📄 ${this.truncateUrl(chapitre.lien)}</a></div>`
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
                const icon = this.getIcon(d.nom);
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
                const icon = this.getIcon(disciplineName);

                themes.forEach(theme => {
                    themeSelect.innerHTML += `<option value="${theme.id}">${theme.titre} (${icon} ${disciplineName})</option>`;
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

    /**
     * Édite un thème (placeholder)
     */
    editTheme(themeId) {
        alert('Fonctionnalité à venir : Modifier le thème ' + themeId);
    },

    /**
     * Édite un chapitre (placeholder)
     */
    editChapter(chapitreId) {
        alert('Fonctionnalité à venir : Modifier le chapitre ' + chapitreId);
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
     * Supprime un chapitre (placeholder)
     */
    deleteChapter(chapitreId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce chapitre ?')) {
            alert('Fonctionnalité à venir : Supprimer le chapitre ' + chapitreId);
        }
    },

    /**
     * Sauvegarde un thème (placeholder)
     */
    saveTheme() {
        const disciplineId = document.getElementById('theme-discipline-select').value;
        const numero = document.getElementById('theme-numero').value;
        const titre = document.getElementById('theme-titre').value;

        if (!disciplineId || !titre) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        alert('Fonctionnalité à venir : Créer le thème "' + titre + '"');
        closeModal('modal-theme');
    },

    /**
     * Sauvegarde un chapitre (placeholder)
     */
    saveChapter() {
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

        alert('Fonctionnalité à venir : Créer le chapitre "' + titre + '"');
        closeModal('modal-chapter');
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
