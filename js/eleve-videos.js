/**
 * Eleve Vidéos - Affichage des vidéos de la semaine
 */

const EleveVideos = {
    // Données
    videos: [],
    featuredVideo: null,

    // Clé localStorage pour les vidéos vues
    WATCHED_KEY: 'brikks_watched_videos',

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderFeaturedVideo();
            this.renderArchivesList();
            this.renderMonthFilter();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des vidéos');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const videos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.VIDEOS);

        // Trier par date de publication (plus récente en premier)
        this.videos = (videos || []).sort((a, b) => {
            const dateA = new Date(a.date_publication || 0);
            const dateB = new Date(b.date_publication || 0);
            return dateB - dateA;
        });

        // Déterminer la vidéo mise en avant
        const featured = this.videos.find(v => v.est_featured === 'TRUE' || v.est_featured === true);
        this.featuredVideo = featured || this.videos[0] || null;

        console.log('Vidéos chargées:', this.videos.length);
    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('videos-content');
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
     * Affiche la vidéo mise en avant
     */
    renderFeaturedVideo() {
        const featuredSection = document.getElementById('featuredVideo');

        if (!this.featuredVideo) {
            if (featuredSection) featuredSection.style.display = 'none';
            return;
        }

        if (featuredSection) featuredSection.style.display = 'block';

        const video = this.featuredVideo;
        const isWatched = this.isVideoWatched(video.id);
        const embedUrl = this.getEmbedUrl(video.url);

        // Video placeholder
        const placeholder = document.getElementById('videoPlaceholder');
        const container = document.getElementById('videoContainer');

        if (placeholder && container) {
            document.getElementById('placeholderTitle').textContent = video.titre;
            document.getElementById('placeholderSubtitle').textContent = this.formatDate(video.date_publication);

            placeholder.onclick = () => {
                if (embedUrl) {
                    container.innerHTML = `<iframe src="${embedUrl}" allowfullscreen></iframe>`;
                    this.markAsWatched(video.id);
                    this.renderArchivesList(); // Mettre à jour le statut dans la liste
                } else {
                    this.openPopup(video.url, video.titre);
                }
            };
        }

        // Info section
        const info = document.getElementById('featuredInfo');
        if (info) {
            info.innerHTML = `
                <div class="featured-meta">
                    <span class="featured-title">${this.escapeHtml(video.titre)}</span>
                    <span class="featured-date">${this.formatDate(video.date_publication)}</span>
                </div>
                <div class="watch-status ${isWatched ? 'watched' : 'not-watched'}">
                    <span>${isWatched ? '✓' : '○'}</span>
                    ${isWatched ? 'Vue' : 'Pas encore vue'}
                </div>
            `;
        }

        // Message joint
        const messageSection = document.getElementById('featuredMessage');
        const messageText = document.getElementById('messageText');

        if (messageSection && messageText) {
            if (video.description && video.description.trim()) {
                messageSection.style.display = 'flex';
                messageText.innerHTML = this.formatDescription(video.description);
            } else {
                messageSection.style.display = 'none';
            }
        }
    },

    /**
     * Affiche la liste des archives
     */
    renderArchivesList() {
        const list = document.getElementById('archivesList');
        const emptyState = document.getElementById('emptyState');
        const count = document.getElementById('archivesCount');

        // Exclure la vidéo featured des archives
        const archiveVideos = this.getFilteredVideos().filter(v =>
            !this.featuredVideo || v.id !== this.featuredVideo.id
        );

        if (count) {
            count.textContent = `${archiveVideos.length} vidéo${archiveVideos.length > 1 ? 's' : ''}`;
        }

        if (archiveVideos.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        if (list) {
            list.innerHTML = archiveVideos.map(video => {
                const isWatched = this.isVideoWatched(video.id);

                return `
                    <div class="video-item" onclick="EleveVideos.openVideo('${video.id}')">
                        <div class="video-thumb">
                            <div class="play">▶</div>
                        </div>
                        <div class="video-info">
                            <div class="video-title">${this.escapeHtml(video.titre)}</div>
                            <div class="video-meta">
                                <span>${this.formatDate(video.date_publication)}</span>
                                ${video.tags ? `<span>•</span><span>${this.escapeHtml(video.tags)}</span>` : ''}
                            </div>
                        </div>
                        <div class="video-status ${isWatched ? 'watched' : 'not-watched'}">
                            <span>${isWatched ? '✓' : '○'}</span>
                            ${isWatched ? 'Vue' : ''}
                        </div>
                        <span class="video-arrow">→</span>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Affiche le filtre de mois
     */
    renderMonthFilter() {
        const select = document.getElementById('filterMonth');
        if (!select) return;

        // Extraire les mois uniques des vidéos
        const months = new Set();
        this.videos.forEach(v => {
            if (v.date_publication) {
                const date = new Date(v.date_publication);
                if (!isNaN(date)) {
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    months.add(monthKey);
                }
            }
        });

        const sortedMonths = Array.from(months).sort().reverse();

        select.innerHTML = '<option value="all">Tous les mois</option>';
        sortedMonths.forEach(m => {
            const [year, month] = m.split('-');
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            select.innerHTML += `<option value="${m}">${monthName}</option>`;
        });
    },

    /**
     * Récupère les vidéos filtrées
     */
    getFilteredVideos() {
        const searchInput = document.getElementById('searchInput');
        const filterMonth = document.getElementById('filterMonth');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const month = filterMonth ? filterMonth.value : 'all';

        return this.videos.filter(video => {
            // Filtre recherche
            if (search && !video.titre.toLowerCase().includes(search)) {
                return false;
            }

            // Filtre mois
            if (month !== 'all' && video.date_publication) {
                const date = new Date(video.date_publication);
                const videoMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                if (videoMonth !== month) {
                    return false;
                }
            }

            return true;
        });
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => this.renderArchivesList());
        document.getElementById('filterMonth')?.addEventListener('change', () => this.renderArchivesList());

        // Fermer popup
        document.getElementById('closePopup')?.addEventListener('click', () => this.closePopup());

        // Fermer popup au clic sur overlay
        document.getElementById('videoPopup')?.addEventListener('click', (e) => {
            if (e.target.id === 'videoPopup') {
                this.closePopup();
            }
        });

        // Fermer popup avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePopup();
            }
        });
    },

    /**
     * Ouvre une vidéo (depuis la liste)
     */
    openVideo(videoId) {
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        this.markAsWatched(videoId);
        this.openPopup(video.url, video.titre);
        this.renderArchivesList();
    },

    /**
     * Ouvre le popup vidéo
     */
    openPopup(url, title) {
        const embedUrl = this.getEmbedUrl(url);

        document.getElementById('videoPopupTitle').textContent = title;
        document.getElementById('videoPopupIframe').src = embedUrl || '';
        document.getElementById('videoPopup').classList.add('active');
    },

    /**
     * Ferme le popup vidéo
     */
    closePopup() {
        document.getElementById('videoPopup').classList.remove('active');
        document.getElementById('videoPopupIframe').src = '';
    },

    /**
     * Convertit une URL en URL embed
     */
    getEmbedUrl(url) {
        if (!url) return null;

        // Loom
        if (url.includes('loom.com/share/')) {
            return url.replace('/share/', '/embed/');
        }

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

        // URL embed directe
        if (url.includes('/embed/') || url.includes('player.')) {
            return url;
        }

        return null;
    },

    /**
     * Vérifie si une vidéo a été vue
     */
    isVideoWatched(videoId) {
        const watched = this.getWatchedVideos();
        return watched.includes(videoId);
    },

    /**
     * Marque une vidéo comme vue
     */
    markAsWatched(videoId) {
        const watched = this.getWatchedVideos();
        if (!watched.includes(videoId)) {
            watched.push(videoId);
            localStorage.setItem(this.WATCHED_KEY, JSON.stringify(watched));
        }
    },

    /**
     * Récupère la liste des vidéos vues
     */
    getWatchedVideos() {
        try {
            return JSON.parse(localStorage.getItem(this.WATCHED_KEY) || '[]');
        } catch {
            return [];
        }
    },

    /**
     * Formate une date
     */
    formatDate(dateStr) {
        if (!dateStr) return 'Date inconnue';
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;
        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    },

    /**
     * Formate la description
     */
    formatDescription(text) {
        if (!text) return '';
        return this.escapeHtml(text).replace(/\n/g, '<br>');
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

// Export global
window.EleveVideos = EleveVideos;
