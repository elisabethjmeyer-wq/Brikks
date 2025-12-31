/**
 * Élève Accueil - Page d'accueil personnalisée
 * Design léger avec miniatures cliquables et modals
 */

const EleveAccueil = {
    // Données
    featuredVideo: null,
    featuredReco: null,
    user: null,

    // Icônes par type de recommandation
    typeIcons: {
        podcast: '🎧',
        video: '🎬',
        livre: '📖',
        article: '📰',
        autre: '📌'
    },

    // Labels par type
    typeLabels: {
        podcast: 'À écouter',
        video: 'À regarder',
        livre: 'À lire',
        article: 'À lire',
        autre: 'À découvrir'
    },

    /**
     * Initialise la page d'accueil
     */
    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));
            this.renderGreeting();

            await Promise.all([
                this.loadFeaturedVideo(),
                this.loadFeaturedReco()
            ]);

            this.renderVideoSection();
            this.renderRecoSection();
            this.bindModalEvents();

        } catch (error) {
            console.error('[EleveAccueil] Erreur:', error);
        }
    },

    /**
     * Message de bienvenue
     */
    renderGreeting() {
        const container = document.getElementById('greeting-container');
        if (!container) return;

        const prenom = this.user?.prenom || 'Élève';

        container.innerHTML = `
            <h1 class="accueil-greeting">
                <span>👋</span>
                <span>Bonjour <span class="prenom">${this.escapeHtml(prenom)}</span> !</span>
            </h1>
            <p class="accueil-subtitle">Bienvenue sur ton espace de cours. Voici les actualités de la semaine.</p>
        `;
    },

    /**
     * Charge la vidéo mise en avant
     */
    async loadFeaturedVideo() {
        try {
            const videos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.VIDEOS);
            if (!videos || videos.length === 0) {
                this.featuredVideo = null;
                return;
            }

            videos.sort((a, b) => new Date(b.date_publication || 0) - new Date(a.date_publication || 0));
            const featured = videos.find(v => v.est_featured === 'TRUE' || v.est_featured === true);
            this.featuredVideo = featured || videos[0];
        } catch (error) {
            console.error('[EleveAccueil] Erreur vidéos:', error);
            this.featuredVideo = null;
        }
    },

    /**
     * Charge la recommandation mise en avant
     */
    async loadFeaturedReco() {
        try {
            const recos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.RECOMMANDATIONS);
            if (!recos || recos.length === 0) {
                this.featuredReco = null;
                return;
            }

            recos.sort((a, b) => new Date(b.date_publication || 0) - new Date(a.date_publication || 0));
            const featured = recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true);
            this.featuredReco = featured || recos[0];
        } catch (error) {
            console.error('[EleveAccueil] Erreur recommandations:', error);
            this.featuredReco = null;
        }
    },

    /**
     * Section vidéo : miniature + infos côte à côte
     */
    renderVideoSection() {
        const container = document.getElementById('video-section');
        if (!container) return;

        if (!this.featuredVideo) {
            container.innerHTML = `
                <div class="accueil-card">
                    <div class="empty-state">
                        <span class="icon">🎬</span>
                        <p>Aucune vidéo disponible</p>
                    </div>
                </div>
            `;
            return;
        }

        const video = this.featuredVideo;
        const thumbnailUrl = this.getThumbnailUrl(video.url);
        const tags = this.parseTags(video.tags);
        const highlights = this.parseHighlights(video.description);

        // Tronquer l'intro
        let introText = highlights.intro;
        if (introText.length > 120) {
            introText = introText.substring(0, 120).trim() + '...';
        }

        container.innerHTML = `
            <div class="accueil-card accueil-card--featured">
                <div class="featured-layout">
                    <!-- Miniature cliquable -->
                    <div class="featured-thumbnail" onclick="EleveAccueil.openVideoModal()">
                        <div class="thumbnail-img" style="background-image: url('${thumbnailUrl}')">
                            <div class="thumbnail-overlay">
                                <div class="play-button">▶</div>
                                <span class="play-label">Regarder</span>
                            </div>
                        </div>
                        <div class="thumbnail-badge">🎬 Vidéo de la semaine</div>
                    </div>

                    <!-- Infos de la semaine -->
                    <div class="featured-info">
                        <div class="info-header">
                            <span class="info-badge">⭐ Infos de la semaine</span>
                            <span class="info-date">📅 ${this.formatDate(video.date_publication)}</span>
                        </div>
                        <h3 class="info-title">${this.escapeHtml(video.titre)}</h3>
                        ${introText ? `<p class="info-description">${this.escapeHtml(introText)}</p>` : ''}

                        ${highlights.items.length > 0 ? `
                            <div class="info-highlights">
                                <strong>⚡ À retenir :</strong>
                                <ul>
                                    ${highlights.items.slice(0, 3).map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        ${tags.length > 0 ? `
                            <div class="info-tags">
                                ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}

                        <a href="videos.html" class="info-link">Toutes les vidéos →</a>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Section recommandation : format compact horizontal
     */
    renderRecoSection() {
        const container = document.getElementById('reco-section');
        if (!container) return;

        if (!this.featuredReco) {
            container.innerHTML = `
                <div class="accueil-card accueil-card--reco-compact">
                    <div class="empty-state small">
                        <span class="icon">💡</span>
                        <p>Aucune recommandation</p>
                    </div>
                </div>
            `;
            return;
        }

        const reco = this.featuredReco;
        const typeIcon = this.typeIcons[reco.type] || '📌';
        const typeLabel = this.typeLabels[reco.type] || 'À découvrir';
        const imageUrl = this.getDirectImageUrl(reco.image_url);
        const tags = this.parseTags(reco.tags);

        // Tronquer description
        let descText = reco.description || '';
        if (descText.length > 100) {
            descText = descText.substring(0, 100).trim() + '...';
        }

        container.innerHTML = `
            <div class="accueil-card accueil-card--reco-compact">
                <div class="reco-compact-layout">
                    <!-- Image cliquable -->
                    <div class="reco-compact-image" onclick="EleveAccueil.openRecoModal()">
                        ${imageUrl
                            ? `<img src="${imageUrl}" alt="${this.escapeHtml(reco.titre)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                               <div class="reco-placeholder" style="display:none;">${typeIcon}</div>`
                            : `<div class="reco-placeholder">${typeIcon}</div>`
                        }
                        <div class="reco-play-overlay">
                            <span>▶</span>
                        </div>
                    </div>

                    <!-- Infos -->
                    <div class="reco-compact-info">
                        <div class="reco-compact-header">
                            <span class="reco-badge-small featured">💡 Recommandation</span>
                            <span class="reco-badge-small type">${typeIcon} ${typeLabel}</span>
                        </div>
                        <h4 class="reco-compact-title">${this.escapeHtml(reco.titre)}</h4>
                        <p class="reco-compact-desc">${this.escapeHtml(descText)}</p>
                        <div class="reco-compact-footer">
                            ${tags.length > 0 ? `
                                <div class="reco-compact-tags">
                                    ${tags.slice(0, 3).map(tag => `<span class="tag small">${this.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                            <div class="reco-compact-actions">
                                <span class="reco-date">📅 ${this.formatDate(reco.date_publication)}</span>
                                <button class="btn-open" onclick="EleveAccueil.openRecoModal()">Découvrir →</button>
                            </div>
                        </div>
                    </div>
                </div>
                <a href="recommandations.html" class="reco-all-link">Toutes les recommandations →</a>
            </div>
        `;
    },

    /**
     * Ouvre le modal vidéo
     */
    openVideoModal() {
        if (!this.featuredVideo) return;

        const modal = document.getElementById('media-modal');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');
        const embedUrl = this.getEmbedUrl(this.featuredVideo.url);

        title.textContent = this.featuredVideo.titre;
        content.innerHTML = embedUrl
            ? `<div class="modal-video"><iframe src="${embedUrl}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>`
            : `<div class="modal-error">Impossible de charger la vidéo</div>`;

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Ouvre le modal recommandation
     */
    openRecoModal() {
        if (!this.featuredReco) return;

        const reco = this.featuredReco;

        // Si c'est une vidéo/podcast, ouvrir dans le modal
        if (['podcast', 'video'].includes(reco.type)) {
            const modal = document.getElementById('media-modal');
            const title = document.getElementById('modal-title');
            const content = document.getElementById('modal-content');
            const embedUrl = this.getEmbedUrl(reco.url);
            const imageUrl = this.getDirectImageUrl(reco.image_url);

            title.textContent = reco.titre;

            if (embedUrl) {
                content.innerHTML = `<div class="modal-video"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`;
            } else {
                // Afficher image + lien
                content.innerHTML = `
                    <div class="modal-reco-content">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${this.escapeHtml(reco.titre)}">` : ''}
                        <p>${this.escapeHtml(reco.description || '')}</p>
                        <a href="${reco.url}" target="_blank" class="modal-external-link">Ouvrir le contenu →</a>
                    </div>
                `;
            }

            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        } else {
            // Livre/article : ouvrir directement le lien
            if (reco.url) {
                window.open(reco.url, '_blank');
            }
        }
    },

    /**
     * Ferme le modal
     */
    closeModal() {
        const modal = document.getElementById('media-modal');
        const content = document.getElementById('modal-content');

        modal.classList.remove('open');
        document.body.style.overflow = '';

        // Arrêter la vidéo
        setTimeout(() => {
            content.innerHTML = '';
        }, 300);
    },

    /**
     * Bind les événements du modal
     */
    bindModalEvents() {
        const modal = document.getElementById('media-modal');
        const closeBtn = document.getElementById('modal-close');
        const overlay = document.getElementById('modal-overlay');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (overlay) {
            overlay.addEventListener('click', () => this.closeModal());
        }

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('open')) {
                this.closeModal();
            }
        });
    },

    /**
     * Génère l'URL de la miniature depuis l'URL vidéo
     */
    getThumbnailUrl(url) {
        if (!url) return '';

        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) {
            return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
        }

        // Vimeo - pas de thumbnail facile, utiliser placeholder
        if (url.includes('vimeo.com')) {
            return '';
        }

        // Loom - pas de thumbnail publique
        if (url.includes('loom.com')) {
            return '';
        }

        return '';
    },

    /**
     * Convertit URL en embed
     */
    getEmbedUrl(url) {
        if (!url) return null;

        if (url.includes('loom.com/share/')) {
            return url.replace('/share/', '/embed/');
        }

        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) {
            return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
        }

        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        if (url.includes('/embed/') || url.includes('player.')) {
            return url;
        }

        return null;
    },

    /**
     * URL directe pour images Google Drive, etc.
     */
    getDirectImageUrl(url) {
        if (!url) return null;

        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }

        const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (driveMatch2) {
            return `https://lh3.googleusercontent.com/d/${driveMatch2[1]}`;
        }

        if (url.includes('dropbox.com')) {
            return url.replace('dl=0', 'dl=1');
        }

        return url;
    },

    parseTags(tagsStr) {
        if (!tagsStr) return [];
        return tagsStr.split(',').map(t => t.trim()).filter(t => t);
    },

    parseHighlights(description) {
        if (!description) return { intro: '', items: [] };

        const lines = description.split('\n');
        const items = [];
        let intro = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                items.push(trimmed.replace(/^[•\-*]\s*/, ''));
            } else if (trimmed && items.length === 0) {
                intro.push(trimmed);
            }
        }

        return { intro: intro.join(' '), items };
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date)) return dateStr;
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveAccueil = EleveAccueil;
