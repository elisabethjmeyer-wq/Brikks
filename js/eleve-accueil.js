/**
 * Élève Accueil - Page d'accueil personnalisée
 * Affiche la vidéo et la recommandation de la semaine
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
            // Récupérer l'utilisateur connecté
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));

            // Afficher le message de bienvenue
            this.renderGreeting();

            // Charger les données en parallèle
            await Promise.all([
                this.loadFeaturedVideo(),
                this.loadFeaturedReco()
            ]);

            // Afficher les sections
            this.renderVideoSection();
            this.renderRecoSection();

        } catch (error) {
            console.error('[EleveAccueil] Erreur:', error);
        }
    },

    /**
     * Affiche le message de bienvenue personnalisé
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

            // Trier par date (plus récente en premier)
            videos.sort((a, b) => {
                const dateA = new Date(a.date_publication || 0);
                const dateB = new Date(b.date_publication || 0);
                return dateB - dateA;
            });

            // Chercher celle marquée comme featured, sinon prendre la plus récente
            const featured = videos.find(v => v.est_featured === 'TRUE' || v.est_featured === true);
            this.featuredVideo = featured || videos[0];

            console.log('[EleveAccueil] Vidéo featured:', this.featuredVideo?.titre);
        } catch (error) {
            console.error('[EleveAccueil] Erreur chargement vidéos:', error);
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

            // Trier par date (plus récente en premier)
            recos.sort((a, b) => {
                const dateA = new Date(a.date_publication || 0);
                const dateB = new Date(b.date_publication || 0);
                return dateB - dateA;
            });

            // Chercher celle marquée comme featured, sinon prendre la plus récente
            const featured = recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true);
            this.featuredReco = featured || recos[0];

            console.log('[EleveAccueil] Recommandation featured:', this.featuredReco?.titre);
        } catch (error) {
            console.error('[EleveAccueil] Erreur chargement recommandations:', error);
            this.featuredReco = null;
        }
    },

    /**
     * Affiche la section vidéo de la semaine
     */
    renderVideoSection() {
        const container = document.getElementById('video-section');
        if (!container) return;

        if (!this.featuredVideo) {
            container.innerHTML = `
                <div class="accueil-card">
                    <div class="accueil-card-header">
                        <h2 class="accueil-card-title">🎬 Vidéo de la semaine</h2>
                        <a href="videos.html" class="accueil-card-link">Toutes les vidéos →</a>
                    </div>
                    <div class="accueil-card-body">
                        <div class="empty-state">
                            <span class="icon">🎬</span>
                            <p>Aucune vidéo disponible pour le moment.</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const video = this.featuredVideo;
        const embedUrl = this.getEmbedUrl(video.url);
        const tags = this.parseTags(video.tags);
        const highlights = this.parseHighlights(video.description);

        // Tronquer la description si trop longue
        const maxDescLength = 150;
        let introText = highlights.intro;
        if (introText.length > maxDescLength) {
            introText = introText.substring(0, maxDescLength).trim() + '...';
        }

        container.innerHTML = `
            <div class="accueil-card accueil-card--video">
                <div class="accueil-card-header">
                    <h2 class="accueil-card-title">🎬 Vidéo de la semaine</h2>
                    <a href="videos.html" class="accueil-card-link">Toutes les vidéos →</a>
                </div>
                <div class="accueil-card-body">
                    <!-- Titre et meta AU-DESSUS du player -->
                    <div class="video-header">
                        <div class="video-meta">
                            <span class="video-badge">⭐ Infos de la semaine</span>
                            <span class="video-date">📅 ${this.formatDate(video.date_publication)}</span>
                        </div>
                        <h3 class="video-title">${this.escapeHtml(video.titre)}</h3>
                        ${introText ? `<p class="video-description">${this.escapeHtml(introText)}</p>` : ''}
                    </div>

                    <!-- Player vidéo -->
                    <div class="video-player-wrapper">
                        ${embedUrl
                            ? `<iframe src="${embedUrl}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`
                            : `<div class="video-player-placeholder">
                                <span class="icon">🎬</span>
                                <span>Vidéo non disponible</span>
                               </div>`
                        }
                    </div>

                    <!-- Infos complémentaires EN DESSOUS -->
                    <div class="video-footer">
                        ${highlights.items.length > 0 ? `
                            <div class="video-highlights">
                                <div class="video-highlights-title">⚡ À retenir :</div>
                                <ul>
                                    ${highlights.items.slice(0, 3).map(item => `<li>${this.escapeHtml(item)}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${tags.length > 0 ? `
                            <div class="tags">
                                ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Affiche la section recommandation de la semaine
     */
    renderRecoSection() {
        const container = document.getElementById('reco-section');
        if (!container) return;

        if (!this.featuredReco) {
            container.innerHTML = `
                <div class="accueil-card">
                    <div class="accueil-card-header">
                        <h2 class="accueil-card-title">💡 Recommandation de la semaine</h2>
                        <a href="recommandations.html" class="accueil-card-link">Toutes les recommandations →</a>
                    </div>
                    <div class="accueil-card-body">
                        <div class="empty-state">
                            <span class="icon">💡</span>
                            <p>Aucune recommandation disponible pour le moment.</p>
                        </div>
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
        const isPlayable = ['podcast', 'video'].includes(reco.type);

        // Tronquer la description
        const maxDescLength = 180;
        let descText = reco.description || '';
        if (descText.length > maxDescLength) {
            descText = descText.substring(0, maxDescLength).trim() + '...';
        }

        container.innerHTML = `
            <div class="accueil-card accueil-card--reco">
                <div class="accueil-card-header">
                    <h2 class="accueil-card-title">💡 Recommandation de la semaine</h2>
                    <a href="recommandations.html" class="accueil-card-link">Toutes les recommandations →</a>
                </div>
                <div class="accueil-card-body">
                    <!-- Layout vertical : image en haut -->
                    <div class="reco-image-large">
                        ${imageUrl
                            ? `<img src="${imageUrl}" alt="${this.escapeHtml(reco.titre)}" onerror="this.style.display='none'; this.parentElement.querySelector('.reco-image-placeholder').style.display='flex';">
                               <span class="reco-image-placeholder" style="display:none;">${typeIcon}</span>`
                            : `<span class="reco-image-placeholder">${typeIcon}</span>`
                        }
                        ${isPlayable && reco.url ? `<a href="${reco.url}" target="_blank" class="reco-play-btn" title="Ouvrir">▶</a>` : ''}
                    </div>

                    <!-- Infos en bas -->
                    <div class="reco-info-vertical">
                        <div class="reco-badges">
                            <span class="reco-badge featured">⭐ Cette semaine</span>
                            <span class="reco-badge type">${typeIcon} ${typeLabel}</span>
                        </div>
                        <h3 class="reco-title">${this.escapeHtml(reco.titre)}</h3>
                        <p class="reco-description">${this.escapeHtml(descText)}</p>
                        ${tags.length > 0 ? `
                            <div class="tags">
                                ${tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="reco-meta">
                            <span>📅 ${this.formatDate(reco.date_publication)}</span>
                            ${reco.url ? `<a href="${reco.url}" target="_blank" class="reco-open-link">Ouvrir →</a>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Parse les tags (séparés par virgule)
     */
    parseTags(tagsStr) {
        if (!tagsStr) return [];
        return tagsStr.split(',').map(t => t.trim()).filter(t => t);
    },

    /**
     * Parse la description pour extraire intro et points "À retenir"
     * Format attendu : texte libre, puis lignes commençant par • ou -
     */
    parseHighlights(description) {
        if (!description) return { intro: '', items: [] };

        const lines = description.split('\n');
        const items = [];
        let intro = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                // C'est un point à retenir
                items.push(trimmed.replace(/^[•\-*]\s*/, ''));
            } else if (trimmed) {
                // C'est du texte d'intro (seulement si on n'a pas encore de bullets)
                if (items.length === 0) {
                    intro.push(trimmed);
                }
            }
        }

        return {
            intro: intro.join(' '),
            items: items
        };
    },

    /**
     * Convertit une URL en URL embed pour les vidéos
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
     * Convertit les URLs de partage en URLs directes pour les images
     */
    getDirectImageUrl(url) {
        if (!url) return null;

        // Google Drive: https://drive.google.com/file/d/FILE_ID/view
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }

        // Google Drive: https://drive.google.com/open?id=FILE_ID
        const driveMatch2 = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
        if (driveMatch2) {
            return `https://lh3.googleusercontent.com/d/${driveMatch2[1]}`;
        }

        // Google Drive: uc?id=FILE_ID
        const driveMatch3 = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
        if (driveMatch3) {
            return `https://lh3.googleusercontent.com/d/${driveMatch3[1]}`;
        }

        // Dropbox
        if (url.includes('dropbox.com')) {
            return url.replace('dl=0', 'dl=1');
        }

        return url;
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
    }
};

// Export global
window.EleveAccueil = EleveAccueil;
