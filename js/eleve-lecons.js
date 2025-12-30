/**
 * Élève Leçons - Affichage des leçons pour les élèves
 */

const EleveLecons = {
    // Données
    disciplines: [],
    themes: [],
    chapitres: [],

    // État
    currentFilter: 'all',
    orderByLesson: false,

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
            this.renderFilters();
            this.render();
            this.bindEvents();
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
        // Filtrer uniquement les chapitres publiés
        this.chapitres = (chapitres || []).filter(c =>
            (c.statut || '').toLowerCase() === 'publie'
        );

        console.log('Données chargées (élève):', {
            disciplines: this.disciplines.length,
            themes: this.themes.length,
            chapitres: this.chapitres.length
        });
    },

    /**
     * Affiche les filtres par discipline
     */
    renderFilters() {
        const filterContainer = document.getElementById('filter-tabs');
        let html = '<button class="filter-tab active" data-filter="all">Tous</button>';

        this.disciplines.forEach(d => {
            const icon = this.getIcon(d.nom);
            html += `<button class="filter-tab" data-filter="${d.id}">${icon} ${d.nom}</button>`;
        });

        filterContainer.innerHTML = html;
    },

    /**
     * Affiche les données
     */
    render() {
        const loader = document.getElementById('loader');
        const viewTheme = document.getElementById('view-theme');
        const viewOrder = document.getElementById('view-order');
        const emptyState = document.getElementById('empty-state');

        loader.style.display = 'none';

        if (this.chapitres.length === 0) {
            emptyState.style.display = 'block';
            viewTheme.style.display = 'none';
            viewOrder.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';

        // Rendu des deux vues
        viewTheme.innerHTML = this.renderThemeView();
        viewOrder.innerHTML = this.renderOrderView();

        // Afficher la vue active
        if (this.orderByLesson) {
            viewTheme.style.display = 'none';
            viewOrder.style.display = 'block';
        } else {
            viewTheme.style.display = 'block';
            viewOrder.style.display = 'none';
        }
    },

    /**
     * Génère la vue par thème
     */
    renderThemeView() {
        let html = '';

        // Filtrer les disciplines
        const disciplinesToShow = this.currentFilter === 'all'
            ? this.disciplines
            : this.disciplines.filter(d => d.id === this.currentFilter);

        disciplinesToShow.forEach(discipline => {
            // Utiliser l'emoji de la discipline si disponible
            const icon = discipline.emoji || this.getIcon(discipline.nom);
            const themesForDiscipline = this.themes.filter(t => t.discipline_id === discipline.id);

            // Vérifier s'il y a des chapitres publiés pour cette discipline
            const hasPublishedChapters = themesForDiscipline.some(theme =>
                this.chapitres.some(c => c.theme_id === theme.id)
            );

            if (!hasPublishedChapters && this.currentFilter === 'all') return;

            html += `
                <section class="matiere-section">
                    <div class="matiere-header">
                        <span class="matiere-icon">${icon}</span>
                        <h2 class="matiere-title">${discipline.nom}</h2>
                    </div>
            `;

            themesForDiscipline.forEach(theme => {
                const chapitres = this.chapitres.filter(c => c.theme_id === theme.id);
                if (chapitres.length === 0) return;

                html += this.renderThemeAccordion(theme, chapitres, icon);
            });

            html += '</section>';
        });

        return html || '<div class="empty-state"><div class="icon">📚</div><h3>Aucune leçon dans cette matière</h3></div>';
    },

    /**
     * Génère un accordion de thème
     */
    renderThemeAccordion(theme, chapitres, icon) {
        const sortedChapitres = chapitres.sort((a, b) =>
            (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0)
        );

        const chapitresHtml = sortedChapitres.map((chapitre, index) =>
            this.renderChapterCard(chapitre, index + 1)
        ).join('');

        // Utiliser 'nom' ou 'titre'
        const themeName = theme.nom || theme.titre || 'Thème sans titre';

        return `
            <div class="theme-accordion">
                <button class="theme-accordion-header">
                    <span class="accordion-arrow">▶</span>
                    <div class="theme-accordion-info">
                        <div class="theme-accordion-title">${themeName}</div>
                        <div class="theme-accordion-meta">${chapitres.length} chapitre${chapitres.length > 1 ? 's' : ''}</div>
                    </div>
                    <span class="theme-accordion-badge">${chapitres.length}</span>
                </button>
                <div class="theme-accordion-content">
                    ${chapitresHtml}
                </div>
            </div>
        `;
    },

    /**
     * Génère une carte chapitre
     */
    renderChapterCard(chapitre, numero) {
        const lessonTag = chapitre.numero_lecon
            ? `<span class="lesson-tag">L${chapitre.numero_lecon}</span>`
            : '';

        return `
            <a href="chapitre.html?id=${chapitre.id}" class="chapter-card">
                <span class="chapter-number">${numero}</span>
                <div class="chapter-content">
                    <div class="chapter-title">${chapitre.titre || 'Chapitre sans titre'}</div>
                </div>
                ${lessonTag}
                <span class="chapter-arrow">→</span>
            </a>
        `;
    },

    /**
     * Génère la vue par ordre de leçon
     */
    renderOrderView() {
        // Trier les chapitres par numéro de leçon
        const sortedChapitres = [...this.chapitres]
            .filter(c => c.numero_lecon)
            .sort((a, b) => (parseInt(a.numero_lecon) || 0) - (parseInt(b.numero_lecon) || 0));

        if (sortedChapitres.length === 0) {
            return `
                <div class="empty-state">
                    <div class="icon">📅</div>
                    <h3>Aucune leçon numérotée</h3>
                    <p>Les leçons n'ont pas encore de numéro d'ordre.</p>
                </div>
            `;
        }

        let itemsHtml = sortedChapitres.map(chapitre => {
            const theme = this.themes.find(t => t.id === chapitre.theme_id);
            const discipline = theme ? this.disciplines.find(d => d.id === theme.discipline_id) : null;
            // Utiliser l'emoji de la discipline si disponible
            const icon = discipline && discipline.emoji ? discipline.emoji : (discipline ? this.getIcon(discipline.nom) : '📖');
            const disciplineName = discipline ? discipline.nom : '';
            // Utiliser 'nom' ou 'titre' pour le thème
            const themeName = theme ? (theme.nom || theme.titre || '') : '';

            return `
                <a href="chapitre.html?id=${chapitre.id}" class="order-item">
                    <span class="order-number">L${chapitre.numero_lecon}</span>
                    <div class="order-content">
                        <div class="order-title">${chapitre.titre}</div>
                        <div class="order-subtitle">${themeName} • ${icon} ${disciplineName}</div>
                    </div>
                    <span class="order-arrow">→</span>
                </a>
            `;
        }).join('');

        return `
            <div class="order-section">
                <div class="order-header">
                    <div class="order-icon">📅</div>
                    <div class="order-info">
                        <h2>Ordre des leçons en classe</h2>
                        <p>${sortedChapitres.length} leçon${sortedChapitres.length > 1 ? 's' : ''}</p>
                    </div>
                </div>
                <div class="order-list">
                    ${itemsHtml}
                </div>
            </div>
        `;
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
     * Bind les événements
     */
    bindEvents() {
        // Toggle ordre
        const toggle = document.getElementById('order-toggle');
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            this.orderByLesson = toggle.classList.contains('active');
            this.render();
        });

        // Filtres
        document.getElementById('filter-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-tab')) {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.render();
            }
        });

        // Accordéons (délégation d'événements)
        document.getElementById('view-theme').addEventListener('click', (e) => {
            const header = e.target.closest('.theme-accordion-header');
            if (header) {
                const accordion = header.closest('.theme-accordion');
                accordion.classList.toggle('open');
            }
        });
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

// Export
window.EleveLecons = EleveLecons;
