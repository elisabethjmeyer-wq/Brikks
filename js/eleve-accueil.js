/**
 * Élève Accueil - Page d'accueil personnalisée
 * Layout 2 colonnes : gauche (vidéo + reco) | droite (infos)
 */

const EleveAccueil = {
    featuredVideo: null,
    featuredReco: null,
    user: null,

    typeIcons: {
        podcast: '🎧',
        video: '🎬',
        livre: '📖',
        article: '📰',
        autre: '📌'
    },

    typeLabels: {
        podcast: 'À écouter',
        video: 'À regarder',
        livre: 'À lire',
        article: 'À lire',
        autre: 'À découvrir'
    },

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));
            this.renderGreeting();

            await Promise.all([
                this.loadFeaturedVideo(),
                this.loadFeaturedReco()
            ]);

            this.renderMainContent();
            this.bindModalEvents();

        } catch (error) {
            console.error('[EleveAccueil] Erreur:', error);
        }
    },

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
            this.featuredVideo = null;
        }
    },

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
            this.featuredReco = null;
        }
    },

    /**
     * Rendu principal : 2 colonnes
     */
    renderMainContent() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const video = this.featuredVideo;
        const reco = this.featuredReco;

        // Préparer les données vidéo
        let videoHTML = '';
        let infoHTML = '';

        if (video) {
            const thumbnailUrl = this.getThumbnailUrl(video.url);
            const tags = this.parseTags(video.tags);
            const highlights = this.parseHighlights(video.description);

            let introText = highlights.intro;
            if (introText.length > 200) {
                introText = introText.substring(0, 200).trim() + '...';
            }

            // Colonne gauche : Miniature vidéo
            videoHTML = `
                <div class="media-card" onclick="EleveAccueil.openVideoModal()">
                    <div class="media-card-header">🎬 Vidéo de la semaine</div>
                    <div class="media-thumbnail" style="background-image: url('${thumbnailUrl}')">
                        <div class="media-thumbnail-overlay">
                            <div class="play-btn">▶</div>
                            <span class="play-label">Regarder</span>
                        </div>
                    </div>
                </div>
            `;

            // Colonne droite : Infos
            infoHTML = `
                <div class="info-card">
                    <div class="info-card-header">
                        <span class="info-badge">⭐ Infos de la semaine</span>
                        <span class="info-date">📅 ${this.formatDate(video.date_publication)}</span>
                    </div>
                    <h2 class="info-title">${this.escapeHtml(video.titre)}</h2>
                    ${introText ? `<p class="info-desc">${this.escapeHtml(introText)}</p>` : ''}
                    ${highlights.items.length > 0 ? `
                        <div class="info-highlights">
                            <strong>⚡ À retenir :</strong>
                            <ul>
                                ${highlights.items.slice(0, 4).map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
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
            `;
        } else {
            videoHTML = `
                <div class="media-card empty">
                    <div class="media-card-header">🎬 Vidéo de la semaine</div>
                    <div class="empty-state-small">
                        <span>🎬</span>
                        <p>Aucune vidéo</p>
                    </div>
                </div>
            `;
            infoHTML = `
                <div class="info-card empty">
                    <div class="info-card-header">
                        <span class="info-badge">⭐ Infos de la semaine</span>
                    </div>
                    <p class="info-empty">Aucune info disponible pour le moment.</p>
                </div>
            `;
        }

        // Recommandation
        let recoHTML = '';
        if (reco) {
            const typeIcon = this.typeIcons[reco.type] || '📌';
            const typeLabel = this.typeLabels[reco.type] || 'À découvrir';
            const imageUrl = this.getDirectImageUrl(reco.image_url);
            const tags = this.parseTags(reco.tags);

            let descText = reco.description || '';
            if (descText.length > 80) {
                descText = descText.substring(0, 80).trim() + '...';
            }

            recoHTML = `
                <div class="reco-card" onclick="EleveAccueil.openRecoModal()">
                    <div class="reco-card-header">💡 Recommandation</div>
                    <div class="reco-content">
                        <div class="reco-image">
                            ${imageUrl
                                ? `<img src="${imageUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                   <div class="reco-placeholder" style="display:none;">${typeIcon}</div>`
                                : `<div class="reco-placeholder">${typeIcon}</div>`
                            }
                            <div class="reco-play-overlay"><span>▶</span></div>
                        </div>
                        <div class="reco-info">
                            <div class="reco-badges">
                                <span class="reco-badge type">${typeIcon} ${typeLabel}</span>
                            </div>
                            <h4 class="reco-title">${this.escapeHtml(reco.titre)}</h4>
                            <p class="reco-desc">${this.escapeHtml(descText)}</p>
                            ${tags.length > 0 ? `
                                <div class="reco-tags">
                                    ${tags.slice(0, 2).map(tag => `<span class="tag small">${this.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="reco-footer">
                        <span class="reco-date">📅 ${this.formatDate(reco.date_publication)}</span>
                        <span class="reco-action">Découvrir →</span>
                    </div>
                </div>
            `;
        } else {
            recoHTML = `
                <div class="reco-card empty">
                    <div class="reco-card-header">💡 Recommandation</div>
                    <div class="empty-state-small">
                        <span>💡</span>
                        <p>Aucune recommandation</p>
                    </div>
                </div>
            `;
        }

        // Assemblage final : 2 colonnes
        container.innerHTML = `
            <div class="two-columns">
                <div class="column-left">
                    ${videoHTML}
                    ${recoHTML}
                    <a href="recommandations.html" class="all-link">Toutes les recommandations →</a>
                </div>
                <div class="column-right">
                    ${infoHTML}
                </div>
            </div>
        `;
    },

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

    openRecoModal() {
        if (!this.featuredReco) return;

        const reco = this.featuredReco;

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
            if (reco.url) {
                window.open(reco.url, '_blank');
            }
        }
    },

    closeModal() {
        const modal = document.getElementById('media-modal');
        const content = document.getElementById('modal-content');

        modal.classList.remove('open');
        document.body.style.overflow = '';

        setTimeout(() => {
            content.innerHTML = '';
        }, 300);
    },

    bindModalEvents() {
        const modal = document.getElementById('media-modal');
        const closeBtn = document.getElementById('modal-close');
        const overlay = document.getElementById('modal-overlay');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (overlay) overlay.addEventListener('click', () => this.closeModal());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal?.classList.contains('open')) {
                this.closeModal();
            }
        });
    },

    getThumbnailUrl(url) {
        if (!url) return '';
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
        return '';
    },

    getEmbedUrl(url) {
        if (!url) return null;
        if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/');
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (ytMatch) return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        if (url.includes('/embed/') || url.includes('player.')) return url;
        return null;
    },

    getDirectImageUrl(url) {
        if (!url) return null;
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (driveMatch2) return `https://lh3.googleusercontent.com/d/${driveMatch2[1]}`;
        if (url.includes('dropbox.com')) return url.replace('dl=0', 'dl=1');
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
