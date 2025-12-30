/**
 * Élève Chapitre - Affichage du détail d'un chapitre
 */

const EleveChapitre = {
    // Données
    chapitre: null,
    theme: null,
    discipline: null,
    allChapitres: [],

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
        // Récupérer l'ID du chapitre depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const chapitreId = urlParams.get('id');

        if (!chapitreId) {
            this.showError();
            return;
        }

        try {
            await this.loadData(chapitreId);

            if (!this.chapitre) {
                this.showError();
                return;
            }

            // Initialiser le layout avec le titre du chapitre
            EleveLayout.init('lecons', this.chapitre.titre || 'Chapitre');

            // Mettre à jour le fil d'Ariane
            this.updateBreadcrumb();

            // Afficher le contenu
            this.render();

        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError();
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData(chapitreId) {
        const [disciplines, themes, chapitres] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.DISCIPLINES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.THEMES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CHAPITRES)
        ]);

        // Filtrer les chapitres publiés
        this.allChapitres = (chapitres || []).filter(c =>
            (c.statut || '').toLowerCase() === 'publie'
        );

        // Trouver le chapitre demandé
        this.chapitre = this.allChapitres.find(c => c.id === chapitreId);

        if (this.chapitre) {
            // Trouver le thème
            this.theme = (themes || []).find(t => t.id === this.chapitre.theme_id);

            // Trouver la discipline
            if (this.theme) {
                this.discipline = (disciplines || []).find(d => d.id === this.theme.discipline_id);
            }
        }
    },

    /**
     * Met à jour le fil d'Ariane
     */
    updateBreadcrumb() {
        const breadcrumbContainer = document.querySelector('.breadcrumb');
        if (!breadcrumbContainer) return;

        const icon = this.getIcon();
        const disciplineName = this.discipline ? this.discipline.nom : '';
        // Utiliser 'nom' ou 'titre' pour le thème
        const themeName = this.theme ? (this.theme.nom || this.theme.titre || '') : '';
        const chapterName = this.chapitre ? this.chapitre.titre : '';

        breadcrumbContainer.innerHTML = `
            <a href="/Brikks/eleve/">🏠 Accueil</a>
            <span class="separator">›</span>
            <a href="lecons.html">Leçons</a>
            ${disciplineName ? `
                <span class="separator">›</span>
                <span>${icon} ${disciplineName}</span>
            ` : ''}
            ${themeName ? `
                <span class="separator">›</span>
                <span>${this.truncate(themeName, 30)}</span>
            ` : ''}
            <span class="separator">›</span>
            <span class="current">${this.truncate(chapterName, 40)}</span>
        `;
    },

    /**
     * Affiche le contenu du chapitre
     */
    render() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('chapitre-content');

        loader.style.display = 'none';
        content.style.display = 'block';

        const icon = this.getIcon();
        const disciplineName = this.discipline ? this.discipline.nom : '';
        // Utiliser 'nom' ou 'titre' pour le thème
        const themeName = this.theme ? (this.theme.nom || this.theme.titre || '') : '';
        const themeNumero = this.theme ? (this.theme.ordre || this.theme.numero || '') : '';
        const chapitreNumero = this.chapitre.numero || '';

        // Header
        document.getElementById('chapter-icon').textContent = icon;
        document.getElementById('chapter-matiere').innerHTML = `${icon} ${disciplineName}`;
        document.getElementById('chapter-theme-info').textContent =
            `${themeNumero ? 'Thème ' + themeNumero : ''} ${chapitreNumero ? '• Chapitre ' + chapitreNumero : ''}`;
        document.getElementById('chapter-title').textContent = this.chapitre.titre || 'Chapitre sans titre';

        // Tag de leçon
        if (this.chapitre.numero_lecon) {
            const lessonTag = document.getElementById('chapter-lesson-tag');
            lessonTag.textContent = `Leçon ${this.chapitre.numero_lecon}`;
            lessonTag.style.display = 'inline-block';
        }

        // Contenu du viewer
        this.renderViewer();

        // Navigation
        this.renderNavigation();

        // Bouton nouveau onglet
        if (this.chapitre.lien) {
            document.getElementById('btn-new-tab').href = this.chapitre.lien;
        }
    },

    /**
     * Affiche le contenu dans le viewer
     */
    renderViewer() {
        const viewerContent = document.getElementById('viewer-content');

        if (!this.chapitre.lien) {
            viewerContent.innerHTML = `
                <div class="viewer-placeholder">
                    <div class="icon">📄</div>
                    <h3>Aucun document</h3>
                    <p>Ce chapitre n'a pas encore de document associé.</p>
                </div>
            `;
            return;
        }

        const lien = this.chapitre.lien;

        // Détecter le type de lien et l'adapter pour l'embed
        if (lien.includes('docs.google.com/document')) {
            // Google Docs
            const embedUrl = this.convertGoogleDocsUrl(lien);
            viewerContent.innerHTML = `
                <iframe class="viewer-iframe" src="${embedUrl}" allowfullscreen></iframe>
            `;
        } else if (lien.includes('docs.google.com/presentation')) {
            // Google Slides
            const embedUrl = this.convertGoogleSlidesUrl(lien);
            viewerContent.innerHTML = `
                <iframe class="viewer-iframe" src="${embedUrl}" allowfullscreen></iframe>
            `;
        } else if (lien.includes('youtube.com') || lien.includes('youtu.be')) {
            // YouTube
            const embedUrl = this.convertYouTubeUrl(lien);
            viewerContent.innerHTML = `
                <div class="video-container">
                    <iframe src="${embedUrl}" allowfullscreen></iframe>
                </div>
            `;
        } else if (lien.includes('loom.com')) {
            // Loom
            const embedUrl = lien.replace('/share/', '/embed/');
            viewerContent.innerHTML = `
                <div class="video-container">
                    <iframe src="${embedUrl}" allowfullscreen></iframe>
                </div>
            `;
        } else {
            // Lien externe générique
            viewerContent.innerHTML = `
                <div class="viewer-placeholder">
                    <div class="icon">🔗</div>
                    <h3>Lien externe</h3>
                    <p>Ce document s'ouvre dans un nouvel onglet.</p>
                    <a href="${lien}" target="_blank" class="btn btn-primary">
                        <span>↗</span>
                        Ouvrir le document
                    </a>
                </div>
            `;
        }
    },

    /**
     * Convertit une URL Google Docs pour l'embed
     */
    convertGoogleDocsUrl(url) {
        // Extraire l'ID du document
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            return `https://docs.google.com/document/d/${match[1]}/preview`;
        }
        return url;
    },

    /**
     * Convertit une URL Google Slides pour l'embed
     */
    convertGoogleSlidesUrl(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false`;
        }
        return url;
    },

    /**
     * Convertit une URL YouTube pour l'embed
     */
    convertYouTubeUrl(url) {
        let videoId = '';

        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('watch?v=')) {
            videoId = url.split('watch?v=')[1].split('&')[0];
        }

        return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    },

    /**
     * Affiche la navigation (chapitre précédent/suivant)
     */
    renderNavigation() {
        if (!this.theme) return;

        // Récupérer les chapitres du même thème
        const themeChapiters = this.allChapitres
            .filter(c => c.theme_id === this.theme.id)
            .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

        const currentIndex = themeChapiters.findIndex(c => c.id === this.chapitre.id);

        const prevBtn = document.getElementById('nav-prev');
        const nextBtn = document.getElementById('nav-next');

        // Chapitre précédent
        if (currentIndex > 0) {
            const prev = themeChapiters[currentIndex - 1];
            prevBtn.href = `chapitre.html?id=${prev.id}`;
            prevBtn.classList.remove('disabled');
            prevBtn.querySelector('.title').textContent = this.truncate(prev.titre, 30);
        }

        // Chapitre suivant
        if (currentIndex < themeChapiters.length - 1) {
            const next = themeChapiters[currentIndex + 1];
            nextBtn.href = `chapitre.html?id=${next.id}`;
            nextBtn.classList.remove('disabled');
            nextBtn.querySelector('.title').textContent = this.truncate(next.titre, 30);
        }
    },

    /**
     * Récupère l'icône de la discipline
     */
    getIcon() {
        if (!this.discipline) return this.disciplineIcons.default;

        // Utiliser l'emoji de la discipline si disponible
        if (this.discipline.emoji) return this.discipline.emoji;

        const name = (this.discipline.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (name.includes('litt') || name.includes('franc')) return this.disciplineIcons.litterature;
        if (name.includes('hist')) return this.disciplineIcons.histoire;
        if (name.includes('geo')) return this.disciplineIcons.geographie;
        if (name.includes('emc') || name.includes('civique')) return this.disciplineIcons.emc;

        return this.disciplineIcons.default;
    },

    /**
     * Tronque une chaîne
     */
    truncate(str, maxLength) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
    },

    /**
     * Affiche l'état d'erreur
     */
    showError() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('error-state').style.display = 'block';

        // Initialiser le layout quand même
        EleveLayout.init('lecons', 'Chapitre non trouvé');
    }
};

// Export
window.EleveChapitre = EleveChapitre;
