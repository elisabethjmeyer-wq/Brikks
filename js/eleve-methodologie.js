/**
 * Élève Méthodologie - Liste des compétences
 */

const EleveMethodologie = {
    categories: [],
    competences: [],
    etapes: [],
    progression: [],
    user: null,
    currentFilter: 'all',
    searchQuery: '',

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));

            await this.loadData();
            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('[EleveMethodologie] Erreur:', error);
            this.renderError();
        }
    },

    async loadData() {
        const [categories, competences, etapes, progression] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_CATEGORIES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_COMPETENCES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_ETAPES),
            this.loadProgression()
        ]);

        this.categories = categories || [];
        this.competences = competences || [];
        this.etapes = etapes || [];
        this.progression = progression || [];

        // Trier les catégories par ordre
        this.categories.sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
    },

    async loadProgression() {
        try {
            const allProgression = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.PROGRESSION_METHODOLOGIE);
            if (!allProgression || !this.user) return [];
            return allProgression.filter(p => p.eleve_id === this.user.id);
        } catch (e) {
            return [];
        }
    },

    // Calculer la progression d'une compétence
    getCompetenceProgress(competenceId) {
        const etapes = this.etapes.filter(e => e.competence_id === competenceId);
        if (!etapes.length) return { completed: 0, total: 0, percent: 0 };

        const completed = etapes.filter(e =>
            this.progression.some(p => p.etape_id === e.id && p.completed === 'TRUE')
        ).length;

        return {
            completed,
            total: etapes.length,
            percent: Math.round((completed / etapes.length) * 100)
        };
    },

    // Calculer les niveaux d'une compétence
    getCompetenceLevels(competenceId) {
        const etapes = this.etapes.filter(e => e.competence_id === competenceId);
        const niveaux = [...new Set(etapes.map(e => parseInt(e.niveau) || 1))].sort();

        return niveaux.map(niveau => {
            const etapesNiveau = etapes.filter(e => parseInt(e.niveau) === niveau);
            const completedEtapes = etapesNiveau.filter(e =>
                this.progression.some(p => p.etape_id === e.id && p.completed === 'TRUE')
            ).length;

            let status = 'locked';
            if (niveau === 1) {
                status = completedEtapes === etapesNiveau.length ? 'completed' : 'available';
            } else {
                // Vérifier si le niveau précédent est terminé
                const prevNiveau = niveau - 1;
                const prevEtapes = etapes.filter(e => parseInt(e.niveau) === prevNiveau);
                const prevCompleted = prevEtapes.filter(e =>
                    this.progression.some(p => p.etape_id === e.id && p.completed === 'TRUE')
                ).length;

                if (prevCompleted === prevEtapes.length) {
                    status = completedEtapes === etapesNiveau.length ? 'completed' : 'available';
                }
            }

            return { niveau, status };
        });
    },

    // Déterminer le statut d'une compétence
    getCompetenceStatus(competenceId) {
        const progress = this.getCompetenceProgress(competenceId);

        if (progress.completed === 0) return 'new';
        if (progress.completed === progress.total) return 'completed';
        return 'in-progress';
    },

    // Obtenir le nombre d'étapes
    getStepsCount(competenceId) {
        return this.etapes.filter(e => e.competence_id === competenceId).length;
    },

    // Filtrer les compétences
    getFilteredCompetences(categoryId) {
        let competences = this.competences.filter(c => c.categorie_id === categoryId);

        // Filtre par recherche
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            competences = competences.filter(c =>
                c.titre?.toLowerCase().includes(query) ||
                c.description?.toLowerCase().includes(query)
            );
        }

        // Filtre par statut
        if (this.currentFilter !== 'all') {
            competences = competences.filter(c => {
                const status = this.getCompetenceStatus(c.id);
                return status === this.currentFilter;
            });
        }

        return competences;
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        // Vérifier s'il y a des données
        if (!this.categories.length && !this.competences.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📚</span>
                    <p>Aucune compétence méthodologique disponible pour le moment</p>
                </div>
            `;
            return;
        }

        let html = `
            <!-- Search -->
            <div class="search-bar">
                <input type="text" id="search-input" placeholder="Rechercher une compétence..." value="${this.escapeHtml(this.searchQuery)}">
            </div>

            <!-- Filters -->
            <div class="filter-section">
                <span class="filter-label">Filtrer :</span>
                <div class="filter-tabs">
                    <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">Toutes</button>
                    <button class="filter-tab ${this.currentFilter === 'new' ? 'active' : ''}" data-filter="new">🆕 Nouvelles</button>
                    <button class="filter-tab ${this.currentFilter === 'in-progress' ? 'active' : ''}" data-filter="in-progress">🔄 En cours</button>
                    <button class="filter-tab ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">✅ Terminées</button>
                </div>
            </div>
        `;

        // Catégories
        for (const category of this.categories) {
            const competences = this.getFilteredCompetences(category.id);

            // Ne pas afficher la catégorie si aucune compétence après filtrage
            if (!competences.length && (this.searchQuery || this.currentFilter !== 'all')) {
                continue;
            }

            const competenceCount = this.competences.filter(c => c.categorie_id === category.id).length;

            html += `
                <section class="category-section" data-category="${category.id}">
                    <div class="category-header">
                        <div class="category-icon ${category.couleur || 'blue'}">${category.icon || '📁'}</div>
                        <div class="category-info">
                            <h2 class="category-title">${this.escapeHtml(category.nom)}</h2>
                            <p class="category-meta">${competenceCount} compétence${competenceCount > 1 ? 's' : ''} • ${this.escapeHtml(category.description || '')}</p>
                        </div>
                    </div>

                    <div class="competences-grid">
                        ${competences.length ? competences.map(c => this.renderCompetenceCard(c)).join('') : `
                            <div class="empty-state" style="grid-column: 1 / -1;">
                                <p>Aucune compétence dans cette catégorie</p>
                            </div>
                        `}
                    </div>
                </section>
            `;
        }

        // Message si aucun résultat après filtrage
        if (this.searchQuery || this.currentFilter !== 'all') {
            const hasResults = this.categories.some(cat =>
                this.getFilteredCompetences(cat.id).length > 0
            );

            if (!hasResults) {
                html += `
                    <div class="empty-state">
                        <span class="empty-icon">🔍</span>
                        <p>Aucune compétence ne correspond à votre recherche</p>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    },

    renderCompetenceCard(competence) {
        const progress = this.getCompetenceProgress(competence.id);
        const levels = this.getCompetenceLevels(competence.id);
        const status = this.getCompetenceStatus(competence.id);
        const stepsCount = this.getStepsCount(competence.id);

        const statusLabels = {
            'new': 'Nouveau',
            'in-progress': 'En cours',
            'completed': 'Terminé'
        };

        // Trouver la première étape non complétée pour le lien
        const firstStep = this.etapes
            .filter(e => e.competence_id === competence.id)
            .sort((a, b) => {
                const nA = parseInt(a.niveau) || 1;
                const nB = parseInt(b.niveau) || 1;
                if (nA !== nB) return nA - nB;
                return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
            })[0];

        const href = firstStep ? `methodologie-parcours.html?competence=${competence.id}&etape=${firstStep.id}` : '#';

        return `
            <a href="${href}" class="competence-card" data-competence="${competence.id}">
                <div class="competence-card-header">
                    <div class="competence-icon">${competence.icon || '📋'}</div>
                    <div class="competence-info">
                        <h3 class="competence-title">${this.escapeHtml(competence.titre)}</h3>
                        <div class="competence-meta">
                            ${levels.length > 1 ? `
                                <div class="levels-row">
                                    ${levels.map(l => `
                                        <span class="level-dot ${l.status}">${l.niveau}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                            <span class="steps-badge">${stepsCount} étape${stepsCount > 1 ? 's' : ''}</span>
                            ${status !== 'new' || progress.completed === 0 ? `
                                <span class="status-tag ${status}">${statusLabels[status]}</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="competence-progress">
                    <div class="progress-header">
                        <span class="progress-label">Progression</span>
                        <span class="progress-value">${progress.completed}/${progress.total}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.percent}%;"></div>
                    </div>
                </div>
            </a>
        `;
    },

    bindEvents() {
        // Recherche
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.render();
                    this.bindEvents();
                }, 300);
            });
        }

        // Filtres
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentFilter = tab.dataset.filter;
                this.render();
                this.bindEvents();
            });
        });
    },

    renderError() {
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>Erreur lors du chargement des données</p>
                </div>
            `;
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveMethodologie = EleveMethodologie;
