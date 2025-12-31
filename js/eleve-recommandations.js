/**
 * Élève Recommandations - Affichage des recommandations
 */

const EleveRecommandations = {
    // Données
    recos: [],
    featuredRecoId: null,

    // Clé de stockage local pour les recommandations vues
    VIEWED_KEY: 'brikks_viewed_recos',

    // Icônes par type
    typeIcons: {
        podcast: '🎧',
        video: '🎬',
        livre: '📖',
        article: '📰',
        autre: '📌'
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderFeaturedReco();
            this.renderArchivesList();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des recommandations');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const recos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.RECOMMANDATIONS);

        // Trier par date (plus récente en premier)
        this.recos = (recos || []).sort((a, b) => {
            const dateA = new Date(a.date_publication || 0);
            const dateB = new Date(b.date_publication || 0);
            return dateB - dateA;
        });

        // Déterminer la recommandation mise en avant
        const featured = this.recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true);
        this.featuredRecoId = featured ? featured.id : (this.recos[0]?.id || null);

        console.log('Recommandations chargées:', this.recos.length);
    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('reco-content');
        if (loader) loader.style.display = 'none';
        if (content) content.style.display = 'block';
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.innerHTML = `<div style="color: #ef4444; text-align: center;"><p style="font-size: 48px;">⚠️</p><p>${message}</p></div>`;
        }
    },

    /**
     * Affiche la recommandation mise en avant
     */
    renderFeaturedReco() {
        const container = document.getElementById('featuredReco');
        const content = document.getElementById('featuredRecoContent');

        if (this.recos.length === 0) {
            if (container) container.style.display = 'none';
            return;
        }

        const featuredReco = this.recos.find(r => r.id === this.featuredRecoId) || this.recos[0];
        if (!featuredReco) {
            if (container) container.style.display = 'none';
            return;
        }

        const typeIcon = this.typeIcons[featuredReco.type] || '📌';
        const imageHtml = featuredReco.image_url
            ? `<img src="${featuredReco.image_url}" alt="${this.escapeHtml(featuredReco.titre)}">`
            : `<span class="type-icon">${typeIcon}</span>`;

        content.innerHTML = `
            <div class="featured-reco-card" onclick="EleveRecommandations.openReco('${featuredReco.id}')">
                <div class="featured-reco-image">
                    ${imageHtml}
                </div>
                <div class="featured-reco-info">
                    <div class="featured-reco-type">
                        ${typeIcon} ${this.capitalizeFirst(featuredReco.type || 'autre')}
                    </div>
                    <div class="featured-reco-title">${this.escapeHtml(featuredReco.titre)}</div>
                    <div class="featured-reco-description">${this.escapeHtml(featuredReco.description || '')}</div>
                    <a href="${featuredReco.url}" target="_blank" class="featured-reco-action" onclick="event.stopPropagation(); EleveRecommandations.markAsViewed('${featuredReco.id}')">
                        Découvrir →
                    </a>
                </div>
            </div>
        `;
    },

    /**
     * Affiche la liste des archives
     */
    renderArchivesList() {
        const list = document.getElementById('archivesList');
        const emptyState = document.getElementById('emptyState');
        const count = document.getElementById('archivesCount');

        // Exclure la recommandation mise en avant de la liste
        const archiveRecos = this.recos.filter(r => r.id !== this.featuredRecoId);

        if (count) {
            count.textContent = `${archiveRecos.length} recommandation${archiveRecos.length > 1 ? 's' : ''}`;
        }

        if (archiveRecos.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'grid';
        if (emptyState) emptyState.style.display = 'none';

        const filteredRecos = this.getFilteredRecos(archiveRecos);

        if (list) {
            list.innerHTML = filteredRecos.map(reco => {
                const typeIcon = this.typeIcons[reco.type] || '📌';
                const isViewed = this.isViewed(reco.id);
                const imageHtml = reco.image_url
                    ? `<img src="${reco.image_url}" alt="">`
                    : `<span class="type-icon">${typeIcon}</span>`;

                return `
                    <div class="reco-card ${isViewed ? 'viewed' : ''}" onclick="EleveRecommandations.openReco('${reco.id}')">
                        <div class="reco-card-image">
                            ${imageHtml}
                        </div>
                        <div class="reco-card-type">
                            ${typeIcon} ${this.capitalizeFirst(reco.type || 'autre')}
                        </div>
                        <div class="reco-card-title">${this.escapeHtml(reco.titre)}</div>
                        <div class="reco-card-description">${this.escapeHtml(reco.description || '')}</div>
                        <div class="reco-card-date">${this.formatDate(reco.date_publication)}</div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Filtre les recommandations
     */
    getFilteredRecos(recos) {
        const searchInput = document.getElementById('searchInput');
        const filterType = document.getElementById('filterType');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const type = filterType ? filterType.value : 'all';

        return recos.filter(reco => {
            // Filtre recherche
            if (search && !reco.titre.toLowerCase().includes(search) &&
                !(reco.description || '').toLowerCase().includes(search)) {
                return false;
            }

            // Filtre type
            if (type !== 'all' && reco.type !== type) {
                return false;
            }

            return true;
        });
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => {
            const archiveRecos = this.recos.filter(r => r.id !== this.featuredRecoId);
            this.renderArchivesList();
        });
        document.getElementById('filterType')?.addEventListener('change', () => {
            this.renderArchivesList();
        });

        // Modal
        document.getElementById('closeRecoModal')?.addEventListener('click', () => this.closeModal());

        // Fermer modal au clic sur overlay
        document.getElementById('recoModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'recoModal') {
                this.closeModal();
            }
        });

        // Fermer modal avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },

    /**
     * Ouvre le détail d'une recommandation
     */
    openReco(recoId) {
        const reco = this.recos.find(r => r.id === recoId);
        if (!reco) return;

        const detail = document.getElementById('recoDetail');
        const typeIcon = this.typeIcons[reco.type] || '📌';
        const imageHtml = reco.image_url
            ? `<img src="${reco.image_url}" alt="${this.escapeHtml(reco.titre)}">`
            : `<span class="type-icon">${typeIcon}</span>`;

        // Tags
        let tagsHtml = '';
        if (reco.tags) {
            const tags = reco.tags.split(',').map(t => t.trim()).filter(t => t);
            tagsHtml = `
                <div class="reco-detail-tags">
                    ${tags.map(tag => `<span class="reco-detail-tag">${this.escapeHtml(tag)}</span>`).join('')}
                </div>
            `;
        }

        detail.innerHTML = `
            <div class="reco-detail-image">
                ${imageHtml}
            </div>
            <div class="reco-detail-type">
                ${typeIcon} ${this.capitalizeFirst(reco.type || 'autre')}
            </div>
            <div class="reco-detail-title">${this.escapeHtml(reco.titre)}</div>
            <div class="reco-detail-description">${this.escapeHtml(reco.description || '')}</div>
            ${tagsHtml}
            <div class="reco-detail-date">Ajoutée le ${this.formatDate(reco.date_publication)}</div>
            <a href="${reco.url}" target="_blank" class="reco-detail-action" onclick="EleveRecommandations.markAsViewed('${reco.id}')">
                🔗 Découvrir cette ressource
            </a>
        `;

        document.getElementById('recoModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal
     */
    closeModal() {
        document.getElementById('recoModal').classList.add('hidden');
    },

    /**
     * Marque une recommandation comme vue
     */
    markAsViewed(recoId) {
        const viewed = this.getViewedRecos();
        if (!viewed.includes(recoId)) {
            viewed.push(recoId);
            localStorage.setItem(this.VIEWED_KEY, JSON.stringify(viewed));
            // Mettre à jour l'affichage
            this.renderArchivesList();
        }
    },

    /**
     * Vérifie si une recommandation a été vue
     */
    isViewed(recoId) {
        return this.getViewedRecos().includes(recoId);
    },

    /**
     * Récupère la liste des recommandations vues
     */
    getViewedRecos() {
        try {
            return JSON.parse(localStorage.getItem(this.VIEWED_KEY)) || [];
        } catch {
            return [];
        }
    },

    /**
     * Formate une date
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Capitalise la première lettre
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    /**
     * Échappe le HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    EleveRecommandations.init();
});
