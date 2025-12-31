/**
 * Élève Recommandations - Affichage avec carousels par catégorie
 */

const EleveRecommandations = {
    // Données
    recos: [],
    disciplines: [],
    featuredReco: null,

    // Mapping des types de la base vers les catégories d'affichage
    typeMapping: {
        'podcast': 'ecouter',
        'audio': 'ecouter',
        'musique': 'ecouter',
        'video': 'regarder',
        'documentaire': 'regarder',
        'film': 'regarder',
        'livre': 'lire',
        'article': 'lire',
        'bd': 'lire',
        'autre': 'lire'
    },

    // Configuration des catégories
    categories: {
        ecouter: { icon: '🎵', label: 'À écouter', playIcon: '▶' },
        regarder: { icon: '🎬', label: 'À regarder', playIcon: '▶' },
        lire: { icon: '📖', label: 'À lire', playIcon: '↗' }
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.populateDisciplineFilter();
            this.renderFeaturedReco();
            this.renderCarousels();
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

        // Extraire les disciplines uniques
        const disciplineSet = new Set();
        this.recos.forEach(r => {
            if (r.discipline_id) {
                disciplineSet.add(r.discipline_id);
            }
        });
        this.disciplines = Array.from(disciplineSet).sort();

        // Déterminer la recommandation mise en avant
        const featured = this.recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true);
        this.featuredReco = featured || this.recos[0] || null;

        console.log('Recommandations chargées:', this.recos.length);
    },

    /**
     * Remplit le filtre de disciplines
     */
    populateDisciplineFilter() {
        const select = document.getElementById('filterDiscipline');
        if (!select) return;

        this.disciplines.forEach(d => {
            const option = document.createElement('option');
            option.value = d;
            option.textContent = d;
            select.appendChild(option);
        });
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
     * Obtient la catégorie d'affichage pour un type
     */
    getCategory(type) {
        return this.typeMapping[(type || 'autre').toLowerCase()] || 'lire';
    },

    /**
     * Affiche la recommandation mise en avant
     */
    renderFeaturedReco() {
        const container = document.getElementById('featuredReco');
        if (!container) return;

        if (!this.featuredReco) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        const reco = this.featuredReco;
        const category = this.getCategory(reco.type);
        const catConfig = this.categories[category];

        // Image
        const imageEl = document.getElementById('featuredImage');
        const iconEl = imageEl.querySelector('.featured-icon');
        imageEl.className = `featured-image type-${category}`;
        iconEl.textContent = catConfig.icon;

        // Si image fournie
        if (reco.image_url) {
            const img = document.createElement('img');
            img.src = this.getDirectImageUrl(reco.image_url);
            img.alt = reco.titre;
            imageEl.appendChild(img);
        }

        // Type badge
        const typeEl = document.getElementById('featuredType');
        typeEl.className = `featured-type type-${category}`;
        typeEl.textContent = `${catConfig.icon} ${catConfig.label}`;

        // Titre et description
        document.getElementById('featuredTitle').textContent = reco.titre;
        document.getElementById('featuredDescription').textContent = reco.description || '';

        // Tags
        const tagsEl = document.getElementById('featuredTags');
        tagsEl.innerHTML = '';
        if (reco.tags) {
            const tags = reco.tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'featured-tag';
                span.textContent = tag;
                tagsEl.appendChild(span);
            });
        }
        // Ajouter la discipline comme tag si présente
        if (reco.discipline_id) {
            const span = document.createElement('span');
            span.className = 'featured-tag';
            span.textContent = reco.discipline_id;
            tagsEl.appendChild(span);
        }

        // Date
        document.getElementById('featuredDate').textContent = this.formatDate(reco.date_publication);

        // Click handler
        container.onclick = () => this.openModal(reco);
    },

    /**
     * Affiche les carousels par catégorie
     */
    renderCarousels() {
        const filteredRecos = this.getFilteredRecos();

        // Grouper par catégorie (exclure la featured)
        const grouped = { ecouter: [], regarder: [], lire: [] };

        filteredRecos.forEach(reco => {
            if (this.featuredReco && reco.id === this.featuredReco.id) return;
            const category = this.getCategory(reco.type);
            if (grouped[category]) {
                grouped[category].push(reco);
            }
        });

        // Afficher chaque carousel
        let hasAnyItems = false;

        Object.keys(grouped).forEach(category => {
            const section = document.getElementById(`carousel-${category}`);
            const track = document.getElementById(`track-${category}`);

            if (!section || !track) return;

            if (grouped[category].length === 0) {
                section.style.display = 'none';
                return;
            }

            hasAnyItems = true;
            section.style.display = 'block';
            track.innerHTML = grouped[category].map(reco => this.renderCard(reco, category)).join('');
        });

        // Empty state
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = (!hasAnyItems && !this.featuredReco) ? 'block' : 'none';
        }
    },

    /**
     * Génère le HTML d'une carte
     */
    renderCard(reco, category) {
        const catConfig = this.categories[category];
        const directImageUrl = this.getDirectImageUrl(reco.image_url);
        const imageHtml = directImageUrl
            ? `<img src="${this.escapeHtml(directImageUrl)}" alt="">`
            : '';

        // Tags
        let tagsHtml = '';
        if (reco.discipline_id) {
            tagsHtml = `<div class="reco-card-tags"><span class="reco-card-tag">${this.escapeHtml(reco.discipline_id)}</span></div>`;
        }

        return `
            <div class="reco-card" onclick="EleveRecommandations.openModal(EleveRecommandations.recos.find(r => r.id === '${reco.id}'))">
                <div class="reco-card-image type-${category}">
                    ${imageHtml}
                    <span class="reco-card-icon">${catConfig.icon}</span>
                    <span class="reco-card-type type-${category}">${catConfig.icon}</span>
                    <div class="reco-card-play">
                        <div class="reco-card-play-btn">${catConfig.playIcon}</div>
                    </div>
                </div>
                <div class="reco-card-info">
                    <div class="reco-card-date">${this.formatDate(reco.date_publication)}</div>
                    <h3 class="reco-card-title">${this.escapeHtml(reco.titre)}</h3>
                    ${tagsHtml}
                </div>
            </div>
        `;
    },

    /**
     * Filtre les recommandations
     */
    getFilteredRecos() {
        const searchInput = document.getElementById('searchInput');
        const filterType = document.getElementById('filterType');
        const filterDiscipline = document.getElementById('filterDiscipline');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const type = filterType ? filterType.value : 'all';
        const discipline = filterDiscipline ? filterDiscipline.value : 'all';

        return this.recos.filter(reco => {
            // Filtre recherche
            if (search) {
                const inTitle = (reco.titre || '').toLowerCase().includes(search);
                const inDesc = (reco.description || '').toLowerCase().includes(search);
                const inTags = (reco.tags || '').toLowerCase().includes(search);
                if (!inTitle && !inDesc && !inTags) return false;
            }

            // Filtre type/catégorie
            if (type !== 'all') {
                const category = this.getCategory(reco.type);
                if (category !== type) return false;
            }

            // Filtre discipline
            if (discipline !== 'all' && reco.discipline_id !== discipline) {
                return false;
            }

            return true;
        });
    },

    /**
     * Scroll un carousel
     */
    scrollCarousel(category, direction) {
        const track = document.getElementById(`track-${category}`);
        if (!track) return;

        const scrollAmount = 300;
        track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => {
            this.renderCarousels();
        });

        document.getElementById('filterType')?.addEventListener('change', () => {
            this.renderCarousels();
        });

        document.getElementById('filterDiscipline')?.addEventListener('change', () => {
            this.renderCarousels();
        });

        // Modal
        document.getElementById('closeRecoModal')?.addEventListener('click', () => this.closeModal());

        document.getElementById('recoModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'recoModal') {
                this.closeModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Player placeholder click
        document.getElementById('playerPlaceholder')?.addEventListener('click', () => {
            this.startPlayer();
        });
    },

    /**
     * Ouvre le modal avec une recommandation
     */
    openModal(reco) {
        if (!reco) return;

        this.currentReco = reco;
        const category = this.getCategory(reco.type);
        const catConfig = this.categories[category];

        // Type
        const modalType = document.getElementById('modalType');
        modalType.className = `modal-type type-${category}`;
        modalType.textContent = `${catConfig.icon} ${catConfig.label}`;

        // Titre
        document.getElementById('modalTitle').textContent = reco.titre;

        // Player placeholder
        const placeholder = document.getElementById('playerPlaceholder');
        const iframe = document.getElementById('playerIframe');
        const playerIcon = placeholder.querySelector('.player-icon');

        placeholder.style.display = 'flex';
        iframe.style.display = 'none';
        iframe.src = '';
        playerIcon.textContent = catConfig.icon;

        // Description
        document.getElementById('modalDescription').textContent = reco.description || '';

        // Tags
        const tagsEl = document.getElementById('modalTags');
        tagsEl.innerHTML = '';
        if (reco.tags) {
            const tags = reco.tags.split(',').map(t => t.trim()).filter(t => t);
            tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'modal-tag';
                span.textContent = tag;
                tagsEl.appendChild(span);
            });
        }

        // Date et discipline
        document.getElementById('modalDate').textContent = this.formatDate(reco.date_publication);
        document.getElementById('modalDiscipline').textContent = reco.discipline_id || '';

        // Lien externe
        const extLink = document.getElementById('modalExternalLink');
        extLink.href = reco.url || '#';

        // Afficher
        document.getElementById('recoModal').classList.remove('hidden');
    },

    /**
     * Lance le player intégré
     */
    startPlayer() {
        if (!this.currentReco || !this.currentReco.url) return;

        const placeholder = document.getElementById('playerPlaceholder');
        const iframe = document.getElementById('playerIframe');

        const embedUrl = this.getEmbedUrl(this.currentReco.url);

        if (embedUrl) {
            placeholder.style.display = 'none';
            iframe.style.display = 'block';
            iframe.src = embedUrl;
        } else {
            // Ouvrir dans un nouvel onglet si pas d'embed possible
            window.open(this.currentReco.url, '_blank');
        }
    },

    /**
     * Convertit une URL en URL embed
     */
    getEmbedUrl(url) {
        if (!url) return null;

        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) {
            return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
        }

        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        // Spotify
        if (url.includes('spotify.com')) {
            // Track: https://open.spotify.com/track/xxx
            const trackMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
            if (trackMatch) {
                return `https://open.spotify.com/embed/track/${trackMatch[1]}`;
            }
            // Episode: https://open.spotify.com/episode/xxx
            const episodeMatch = url.match(/spotify\.com\/episode\/([a-zA-Z0-9]+)/);
            if (episodeMatch) {
                return `https://open.spotify.com/embed/episode/${episodeMatch[1]}`;
            }
            // Playlist
            const playlistMatch = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
            if (playlistMatch) {
                return `https://open.spotify.com/embed/playlist/${playlistMatch[1]}`;
            }
        }

        // Deezer
        if (url.includes('deezer.com')) {
            const deezerMatch = url.match(/deezer\.com\/(track|album|playlist)\/(\d+)/);
            if (deezerMatch) {
                return `https://widget.deezer.com/widget/dark/${deezerMatch[1]}/${deezerMatch[2]}`;
            }
        }

        // SoundCloud (nécessite oEmbed, on ouvre dans nouvel onglet)
        if (url.includes('soundcloud.com')) {
            return null; // Pas d'embed simple, on ouvre dans nouvel onglet
        }

        // Loom
        if (url.includes('loom.com/share/')) {
            return url.replace('/share/', '/embed/');
        }

        // Dailymotion
        const dmMatch = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
        if (dmMatch) {
            return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
        }

        // URL embed directe
        if (url.includes('/embed/') || url.includes('player.')) {
            return url;
        }

        return null;
    },

    /**
     * Ferme le modal
     */
    closeModal() {
        const modal = document.getElementById('recoModal');
        const iframe = document.getElementById('playerIframe');

        modal.classList.add('hidden');
        iframe.src = ''; // Stop la lecture
        this.currentReco = null;
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
     * Échappe le HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Convertit une URL d'image en URL directe (notamment pour Google Drive)
     */
    getDirectImageUrl(url) {
        if (!url) return null;

        // Google Drive: https://drive.google.com/file/d/FILE_ID/view
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
        }

        // Google Drive: https://drive.google.com/open?id=FILE_ID
        const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (driveMatch2) {
            return `https://drive.google.com/uc?export=view&id=${driveMatch2[1]}`;
        }

        // Dropbox: remplacer dl=0 par dl=1
        if (url.includes('dropbox.com')) {
            return url.replace('dl=0', 'dl=1');
        }

        // URL déjà directe
        return url;
    }
};

// Export global
window.EleveRecommandations = EleveRecommandations;
