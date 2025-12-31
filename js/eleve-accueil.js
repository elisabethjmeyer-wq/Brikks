/**
 * Élève Accueil - Page d'accueil personnalisée
 * Layout : Vidéo en haut (pleine largeur) + 2 colonnes en dessous (infos | reco)
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
     * Rendu principal : Vidéo pleine largeur + 2 colonnes (infos | reco)
     */
    renderMainContent() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const video = this.featuredVideo;
        const reco = this.featuredReco;

        // Section vidéo (pleine largeur avec lecture directe)
        let videoHTML = '';
        if (video) {
            const embedUrl = this.getEmbedUrl(video.url);
            const tags = this.parseTags(video.tags);

            videoHTML = `
                <section class="video-section">
                    <div class="video-card">
                        <div class="video-header">
                            <div class="video-header-left">
                                <span class="video-badge">🎬 Vidéo de la semaine</span>
                                <span class="video-date">📅 ${this.formatDate(video.date_publication)}</span>
                            </div>
                            <a href="videos.html" class="video-all-link">Toutes les vidéos →</a>
                        </div>
                        <div class="video-container">
                            ${embedUrl
                                ? `<iframe src="${embedUrl}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`
                                : `<div class="video-error">Impossible de charger la vidéo</div>`
                            }
                        </div>
                        <div class="video-info">
                            <h2 class="video-title">${this.escapeHtml(video.titre)}</h2>
                            ${tags.length > 0 ? `
                                <div class="video-tags">
                                    ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </section>
            `;
        } else {
            videoHTML = `
                <section class="video-section">
                    <div class="video-card empty">
                        <div class="video-header">
                            <span class="video-badge">🎬 Vidéo de la semaine</span>
                        </div>
                        <div class="empty-state">
                            <span class="empty-icon">🎬</span>
                            <p>Aucune vidéo disponible pour le moment</p>
                        </div>
                    </div>
                </section>
            `;
        }

        // Section infos (points clés de la vidéo)
        let infoHTML = '';
        if (video) {
            const highlights = this.parseHighlights(video.description);

            if (highlights.intro || highlights.items.length > 0) {
                infoHTML = `
                    <div class="info-card">
                        <div class="info-header">
                            <span class="info-badge">⚡ À retenir</span>
                        </div>
                        <div class="info-body">
                            ${highlights.intro ? `<p class="info-intro">${this.escapeHtml(highlights.intro)}</p>` : ''}
                            ${highlights.items.length > 0 ? `
                                <ul class="info-list">
                                    ${highlights.items.slice(0, 5).map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                infoHTML = `
                    <div class="info-card">
                        <div class="info-header">
                            <span class="info-badge">⚡ À retenir</span>
                        </div>
                        <div class="info-body">
                            <p class="info-intro">${this.escapeHtml(video.description || 'Regardez la vidéo pour découvrir le contenu de la semaine.')}</p>
                        </div>
                    </div>
                `;
            }
        } else {
            infoHTML = `
                <div class="info-card empty">
                    <div class="info-header">
                        <span class="info-badge">⚡ À retenir</span>
                    </div>
                    <div class="info-body">
                        <p class="info-empty">Aucune info disponible</p>
                    </div>
                </div>
            `;
        }

        // Section recommandation
        let recoHTML = '';
        if (reco) {
            const typeIcon = this.typeIcons[reco.type] || '📌';
            const typeLabel = this.typeLabels[reco.type] || 'À découvrir';
            const imageUrl = this.getDirectImageUrl(reco.image_url);
            const tags = this.parseTags(reco.tags);

            recoHTML = `
                <div class="reco-card" onclick="EleveAccueil.openRecoModal()">
                    <div class="reco-header">
                        <span class="reco-badge">💡 Recommandation</span>
                        <span class="reco-type">${typeIcon} ${typeLabel}</span>
                    </div>
                    <div class="reco-body">
                        <div class="reco-image">
                            ${imageUrl
                                ? `<img src="${imageUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                   <div class="reco-placeholder" style="display:none;">${typeIcon}</div>`
                                : `<div class="reco-placeholder">${typeIcon}</div>`
                            }
                            <div class="reco-play-overlay"><span>▶</span></div>
                        </div>
                        <div class="reco-content">
                            <h3 class="reco-title">${this.escapeHtml(reco.titre)}</h3>
                            <p class="reco-desc">${this.escapeHtml(reco.description || '')}</p>
                            ${tags.length > 0 ? `
                                <div class="reco-tags">
                                    ${tags.slice(0, 3).map(tag => `<span class="tag small">${this.escapeHtml(tag)}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="reco-footer">
                        <span class="reco-date">📅 ${this.formatDate(reco.date_publication)}</span>
                        <span class="reco-action">Découvrir →</span>
                    </div>
                </div>
                <a href="recommandations.html" class="section-link">Toutes les recommandations →</a>
            `;
        } else {
            recoHTML = `
                <div class="reco-card empty">
                    <div class="reco-header">
                        <span class="reco-badge">💡 Recommandation</span>
                    </div>
                    <div class="empty-state small">
                        <span class="empty-icon">💡</span>
                        <p>Aucune recommandation</p>
                    </div>
                </div>
            `;
        }

        // Assemblage final
        container.innerHTML = `
            ${videoHTML}
            <section class="bottom-section">
                <div class="bottom-grid">
                    <div class="bottom-col">
                        ${infoHTML}
                    </div>
                    <div class="bottom-col">
                        ${recoHTML}
                    </div>
                </div>
            </section>
        `;
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
