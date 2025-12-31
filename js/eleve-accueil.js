/**
 * Élève Accueil - Page d'accueil avec carousel
 */

const EleveAccueil = {
    featuredVideo: null,
    featuredReco: null,
    user: null,
    currentSlide: 0,
    slideCount: 0,

    typeIcons: {
        podcast: '🎧',
        video: '🎬',
        livre: '📖',
        article: '📰',
        autre: '📌'
    },

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));
            this.renderGreeting();

            await Promise.all([
                this.loadFeaturedVideo(),
                this.loadFeaturedReco()
            ]);

            this.render();
            this.bindEvents();

        } catch (error) {
            console.error('[EleveAccueil] Erreur:', error);
        }
    },

    renderGreeting() {
        const container = document.getElementById('greeting-container');
        if (!container) return;

        const prenom = this.user?.prenom || 'Élève';
        const hour = new Date().getHours();
        let greeting = 'Bonjour';
        if (hour >= 18) greeting = 'Bonsoir';

        container.innerHTML = `
            <h1 class="greeting">${greeting} <span class="prenom">${this.escapeHtml(prenom)}</span> !</h1>
            <p class="subtitle">Voici les actualités de la semaine</p>
        `;
    },

    async loadFeaturedVideo() {
        try {
            const videos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.VIDEOS);
            if (!videos?.length) return;
            videos.sort((a, b) => new Date(b.date_publication || 0) - new Date(a.date_publication || 0));
            this.featuredVideo = videos.find(v => v.est_featured === 'TRUE' || v.est_featured === true) || videos[0];
        } catch (e) {
            this.featuredVideo = null;
        }
    },

    async loadFeaturedReco() {
        try {
            const recos = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.RECOMMANDATIONS);
            if (!recos?.length) return;
            recos.sort((a, b) => new Date(b.date_publication || 0) - new Date(a.date_publication || 0));
            this.featuredReco = recos.find(r => r.est_featured === 'TRUE' || r.est_featured === true) || recos[0];
        } catch (e) {
            this.featuredReco = null;
        }
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const slides = [];

        // Slide vidéo
        if (this.featuredVideo) {
            const v = this.featuredVideo;
            const thumb = this.getThumbnail(v.url);
            const embedUrl = this.getEmbedUrl(v.url);
            slides.push(`
                <div class="slide slide-video" data-type="video">
                    <div class="slide-visual-container">
                        <div class="slide-visual" style="background-image: url('${thumb}')" onclick="EleveAccueil.playVideo(this)" data-embed="${embedUrl || ''}">
                            <div class="slide-overlay">
                                <div class="play-btn">▶</div>
                            </div>
                            <span class="slide-badge video">🎬 Vidéo de la semaine</span>
                        </div>
                    </div>
                    <div class="slide-content">
                        <h3 class="slide-title">${this.escapeHtml(v.titre)}</h3>
                        <p class="slide-desc">${this.escapeHtml(this.truncate(v.description, 150))}</p>
                        <span class="slide-date">📅 ${this.formatDate(v.date_publication)}</span>
                    </div>
                </div>
            `);
        }

        // Slide recommandation
        if (this.featuredReco) {
            const r = this.featuredReco;
            const icon = this.typeIcons[r.type] || '📌';
            const img = this.getDirectImageUrl(r.image_url);
            slides.push(`
                <div class="slide slide-reco" data-type="reco">
                    <div class="slide-visual-container" onclick="EleveAccueil.openReco()">
                        <div class="slide-visual ${img ? '' : 'no-image'}" ${img ? `style="background-image: url('${img}')"` : ''}>
                            ${!img ? `<span class="slide-icon">${icon}</span>` : ''}
                            <div class="slide-overlay">
                                <div class="play-btn">${icon}</div>
                            </div>
                            <span class="slide-badge reco">💡 Recommandation</span>
                        </div>
                    </div>
                    <div class="slide-content">
                        <h3 class="slide-title">${this.escapeHtml(r.titre)}</h3>
                        <p class="slide-desc">${this.escapeHtml(this.truncate(r.description, 150))}</p>
                        <span class="slide-date">📅 ${this.formatDate(r.date_publication)}</span>
                    </div>
                </div>
            `);
        }

        this.slideCount = slides.length;

        // Si pas de contenu
        if (slides.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📭</span>
                    <p>Aucune actualité pour le moment</p>
                </div>
            `;
            return;
        }

        // Carousel
        container.innerHTML = `
            <div class="carousel">
                <div class="carousel-track">
                    ${slides.join('')}
                </div>
                ${slides.length > 1 ? `
                    <div class="carousel-nav">
                        <button class="carousel-arrow prev" onclick="EleveAccueil.prevSlide()">‹</button>
                        <div class="carousel-dots">
                            ${slides.map((_, i) => `<button class="dot ${i === 0 ? 'active' : ''}" onclick="EleveAccueil.goToSlide(${i})"></button>`).join('')}
                        </div>
                        <button class="carousel-arrow next" onclick="EleveAccueil.nextSlide()">›</button>
                    </div>
                ` : ''}
            </div>

            <div class="quick-links">
                <a href="videos.html" class="quick-link">
                    <span class="quick-icon">🎬</span>
                    <span class="quick-text">Toutes les vidéos</span>
                    <span class="quick-arrow">→</span>
                </a>
                <a href="recommandations.html" class="quick-link">
                    <span class="quick-icon">💡</span>
                    <span class="quick-text">Toutes les recommandations</span>
                    <span class="quick-arrow">→</span>
                </a>
            </div>
        `;
    },

    // Navigation carousel
    nextSlide() {
        this.currentSlide = (this.currentSlide + 1) % this.slideCount;
        this.updateCarousel();
    },

    prevSlide() {
        this.currentSlide = (this.currentSlide - 1 + this.slideCount) % this.slideCount;
        this.updateCarousel();
    },

    goToSlide(index) {
        this.currentSlide = index;
        this.updateCarousel();
    },

    updateCarousel() {
        const track = document.querySelector('.carousel-track');
        const dots = document.querySelectorAll('.dot');

        if (track) {
            track.style.transform = `translateX(-${this.currentSlide * 100}%)`;
        }

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === this.currentSlide);
        });
    },

    // Lancer la vidéo directement dans le carousel
    playVideo(element) {
        const embedUrl = element.dataset.embed;
        if (!embedUrl) return;

        const container = element.parentElement;
        container.innerHTML = `
            <div class="video-player">
                <iframe src="${embedUrl}?autoplay=1" allowfullscreen allow="autoplay; encrypted-media"></iframe>
            </div>
        `;
    },

    // Ouvrir recommandation
    openReco() {
        if (!this.featuredReco) return;
        const r = this.featuredReco;

        if (['podcast', 'video'].includes(r.type)) {
            const embedUrl = this.getEmbedUrl(r.url);
            if (embedUrl) {
                this.showModal(r.titre, `<div class="modal-video"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`);
                return;
            }
        }

        // Ouvrir lien externe
        if (r.url) {
            window.open(r.url, '_blank');
        }
    },

    showModal(title, content) {
        const modal = document.getElementById('media-modal');
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-content').innerHTML = content;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closeModal() {
        const modal = document.getElementById('media-modal');
        modal.classList.remove('open');
        document.body.style.overflow = '';
        setTimeout(() => {
            document.getElementById('modal-content').innerHTML = '';
        }, 300);
    },

    bindEvents() {
        // Fermer modal
        document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
        document.getElementById('modal-overlay')?.addEventListener('click', () => this.closeModal());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        // Swipe sur mobile
        let startX = 0;
        const track = document.querySelector('.carousel-track');
        if (track) {
            track.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
            track.addEventListener('touchend', (e) => {
                const diff = startX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                    diff > 0 ? this.nextSlide() : this.prevSlide();
                }
            });
        }

        // Auto-slide (optionnel)
        // setInterval(() => this.nextSlide(), 8000);
    },

    // Helpers
    getThumbnail(url) {
        if (!url) return '';
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
        return '';
    },

    getEmbedUrl(url) {
        if (!url) return null;
        if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/');
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
        const vimeo = url.match(/vimeo\.com\/(\d+)/);
        if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
        return null;
    },

    getDirectImageUrl(url) {
        if (!url) return null;
        const drive = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}`;
        return url;
    },

    truncate(text, max) {
        if (!text) return '';
        return text.length > max ? text.substring(0, max).trim() + '...' : text;
    },

    formatDate(str) {
        if (!str) return '';
        const d = new Date(str);
        return isNaN(d) ? str : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveAccueil = EleveAccueil;
