/**
 * Élève Chapitre - Affichage du détail d'un chapitre
 */

const EleveChapitre = {
    // Données
    chapitre: null,
    theme: null,
    discipline: null,
    allChapitres: [],
    supports: [],
    currentSupportIndex: 0,

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

            // Écouter la touche Échap
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    // Fermer la modale ressource si ouverte
                    if (document.querySelector('.resource-modal-overlay.active')) {
                        this.closeResourceModal();
                    }
                    // Quitter le plein écran si actif
                    else if (document.querySelector('.main-viewer.fullscreen')) {
                        this.toggleFullscreen();
                    }
                }
            });

        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError();
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData(chapitreId) {
        const [disciplines, themes, chapitres, supports] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.DISCIPLINES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.THEMES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CHAPITRES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.SUPPORTS_CHAPITRE).catch(() => [])
        ]);

        // Filtrer les chapitres publiés
        this.allChapitres = (chapitres || []).filter(c =>
            (c.statut || '').toLowerCase() === 'publie'
        );

        // Trouver le chapitre demandé
        this.chapitre = this.allChapitres.find(c => c.id === chapitreId);

        if (this.chapitre) {
            // Charger les supports du chapitre
            this.supports = (supports || [])
                .filter(s => s.chapitre_id === chapitreId)
                .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

            // Trouver le thème (si c'est un chapitre de thème)
            if (this.chapitre.theme_id) {
                this.theme = (themes || []).find(t => t.id === this.chapitre.theme_id);
                if (this.theme) {
                    this.discipline = (disciplines || []).find(d => d.id === this.theme.discipline_id);
                }
            }
            // Sinon c'est un cours introductif (discipline_id directement)
            else if (this.chapitre.discipline_id) {
                this.discipline = (disciplines || []).find(d => d.id === this.chapitre.discipline_id);
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
        const isIntro = !this.chapitre.theme_id && this.chapitre.discipline_id;

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
            ` : (isIntro ? `
                <span class="separator">›</span>
                <span>📌 Cours introductifs</span>
            ` : '')}
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
        const isIntro = !this.chapitre.theme_id && this.chapitre.discipline_id;

        // Topbar compacte
        document.getElementById('chapter-icon').textContent = icon;

        // Métadonnées condensées
        let metaText = disciplineName;
        if (isIntro) {
            metaText += ' • Intro';
        } else if (this.theme) {
            const themeNumero = this.theme.ordre || this.theme.numero || '';
            if (themeNumero) metaText += ` • T${themeNumero}`;
        }
        if (this.chapitre.numero) {
            metaText += ` • Ch.${this.chapitre.numero}`;
        }
        document.getElementById('chapter-matiere').textContent = metaText;

        document.getElementById('chapter-title').textContent = this.chapitre.titre || 'Chapitre sans titre';

        // Tag de leçon
        if (this.chapitre.numero_lecon) {
            const lessonTag = document.getElementById('chapter-lesson-tag');
            lessonTag.textContent = `L${this.chapitre.numero_lecon}`;
            lessonTag.style.display = 'inline-block';
        }

        // Contenu du viewer
        this.renderViewer();

        // Navigation
        this.renderNavigation();

        // Bouton nouveau onglet - utiliser le premier support ou le lien direct
        const firstSupport = this.supports[0];
        const mainUrl = firstSupport ? firstSupport.url : this.chapitre.lien;
        if (mainUrl) {
            document.getElementById('btn-new-tab').href = mainUrl;
        }
    },

    /**
     * Toggle le mode plein écran
     */
    toggleFullscreen() {
        const viewer = document.querySelector('.main-viewer');
        const btn = document.getElementById('btn-fullscreen');

        if (!viewer) return;

        viewer.classList.toggle('fullscreen');

        if (viewer.classList.contains('fullscreen')) {
            btn.textContent = '✕';
            btn.title = 'Quitter le plein écran';
            document.body.style.overflow = 'hidden';
        } else {
            btn.textContent = '⛶';
            btn.title = 'Plein écran';
            document.body.style.overflow = '';
        }
    },

    /**
     * Affiche le contenu dans le viewer (layout hybride)
     */
    renderViewer() {
        const mainViewer = document.getElementById('main-viewer');
        const resourcesBar = document.getElementById('resources-bar');

        // Déterminer le document principal et les ressources supplémentaires
        const supportsToShow = this.supports.length > 0
            ? this.supports
            : (this.chapitre.lien ? [{ type: 'document', nom: 'Document du cours', url: this.chapitre.lien }] : []);

        const texteExplicatif = this.chapitre.contenu_texte;

        // Pas de contenu du tout
        if (supportsToShow.length === 0 && !texteExplicatif) {
            mainViewer.innerHTML = `
                <div class="viewer-placeholder">
                    <div class="icon">📄</div>
                    <h3>Aucun document</h3>
                    <p>Ce chapitre n'a pas encore de document associé.</p>
                </div>
            `;
            return;
        }

        // Document principal = premier support
        const mainSupport = supportsToShow[0];
        if (mainSupport) {
            const mainIcon = this.getSupportIcon(mainSupport.type);
            const mainLabel = mainSupport.nom || 'Leçon principale';

            mainViewer.innerHTML = `
                <div class="main-viewer-header">
                    <div class="main-viewer-title">
                        <span class="icon">${mainIcon}</span>
                        <span>${mainLabel}</span>
                    </div>
                    <div class="main-viewer-actions">
                        <button class="viewer-action-btn" onclick="EleveChapitre.toggleFullscreen()">
                            <span>⛶</span> Agrandir
                        </button>
                    </div>
                </div>
                ${this.renderSupportContent(mainSupport)}
            `;
        }

        // Ressources supplémentaires = note prof + autres supports
        const additionalResources = [];

        // Note du professeur
        if (texteExplicatif) {
            additionalResources.push({
                type: 'note',
                nom: 'Note du professeur',
                content: texteExplicatif
            });
        }

        // Autres supports (à partir du 2ème)
        if (supportsToShow.length > 1) {
            for (let i = 1; i < supportsToShow.length; i++) {
                additionalResources.push(supportsToShow[i]);
            }
        }

        // Afficher la barre de ressources si nécessaire
        if (additionalResources.length > 0) {
            resourcesBar.style.display = 'block';

            let html = `
                <div class="resources-bar-header">
                    <span class="resources-bar-title">Ressources complémentaires</span>
                    <span class="resources-bar-count">${additionalResources.length}</span>
                </div>
                <div class="resources-grid">
            `;

            additionalResources.forEach((resource, index) => {
                const icon = resource.type === 'note' ? '📝' : this.getSupportIcon(resource.type);
                const typeLabel = this.getTypeLabel(resource.type);
                const isNote = resource.type === 'note';

                html += `
                    <div class="resource-card ${isNote ? 'note-card' : ''}" onclick="EleveChapitre.openResource(${index})">
                        <div class="card-icon">${icon}</div>
                        <div class="card-info">
                            <div class="card-type">${typeLabel}</div>
                            <div class="card-name">${resource.nom || 'Ressource'}</div>
                        </div>
                        <span class="card-arrow">→</span>
                    </div>
                `;
            });

            html += '</div>';
            resourcesBar.innerHTML = html;

            // Stocker les ressources pour ouverture
            this.additionalResources = additionalResources;
        }
    },

    /**
     * Ouvre une ressource dans la modale
     */
    openResource(index) {
        const resource = this.additionalResources[index];
        if (!resource) return;

        const modal = document.getElementById('resource-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');

        const icon = resource.type === 'note' ? '📝' : this.getSupportIcon(resource.type);
        modalTitle.innerHTML = `<span class="icon">${icon}</span><span>${resource.nom || 'Ressource'}</span>`;

        // Contenu selon le type
        if (resource.type === 'note') {
            modalContent.innerHTML = `
                <div class="text-content-box">
                    <p>${resource.content.replace(/\n/g, '<br>')}</p>
                </div>
            `;
        } else {
            modalContent.innerHTML = this.renderSupportContent(resource);
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Ferme la modale ressource
     */
    closeResourceModal() {
        const modal = document.getElementById('resource-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
    },

    /**
     * Retourne le label du type de ressource
     */
    getTypeLabel(type) {
        switch ((type || '').toLowerCase()) {
            case 'note': return 'Note';
            case 'video': return 'Vidéo';
            case 'audio': return 'Audio';
            case 'lien': return 'Lien externe';
            default: return 'Document';
        }
    },

    /**
     * Retourne l'icône selon le type de support
     */
    getSupportIcon(type) {
        switch ((type || '').toLowerCase()) {
            case 'video': return '🎬';
            case 'audio': return '🎧';
            case 'lien': return '🔗';
            default: return '📄';
        }
    },

    /**
     * Génère le contenu d'un support
     */
    renderSupportContent(support) {
        const url = support.url;
        if (!url) return '<div class="viewer-placeholder"><p>URL non définie</p></div>';

        // Détecter le type de lien et l'adapter pour l'embed
        if (url.includes('docs.google.com/document')) {
            const embedUrl = this.convertGoogleDocsUrl(url);
            return `<iframe class="viewer-iframe" src="${embedUrl}" allowfullscreen></iframe>`;
        } else if (url.includes('docs.google.com/presentation')) {
            const embedUrl = this.convertGoogleSlidesUrl(url);
            return `<iframe class="viewer-iframe" src="${embedUrl}" allowfullscreen></iframe>`;
        } else if (url.includes('drive.google.com')) {
            const embedUrl = this.convertGoogleDriveUrl(url);
            return `<iframe class="viewer-iframe" src="${embedUrl}" allowfullscreen></iframe>`;
        } else if (url.includes('publuu.com')) {
            // Publuu flipbook - embed direct
            return `<iframe class="viewer-iframe" src="${url}" allowfullscreen></iframe>`;
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            const embedUrl = this.convertYouTubeUrl(url);
            return `<div class="video-container"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`;
        } else if (url.includes('loom.com')) {
            const embedUrl = url.replace('/share/', '/embed/');
            return `<div class="video-container"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`;
        } else {
            return `
                <div class="viewer-placeholder">
                    <div class="icon">🔗</div>
                    <h3>${support.nom || 'Lien externe'}</h3>
                    <p>Ce document s'ouvre dans un nouvel onglet.</p>
                    <a href="${url}" target="_blank" class="btn btn-primary">
                        <span>↗</span>
                        Ouvrir
                    </a>
                </div>
            `;
        }
    },

    /**
     * Convertit une URL Google Drive pour l'embed
     */
    convertGoogleDriveUrl(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
            return `https://drive.google.com/file/d/${match[1]}/preview`;
        }
        return url;
    },

    /**
     * Bind des événements pour les onglets de supports
     */
    bindSupportTabs() {
        document.querySelectorAll('.support-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const index = tab.dataset.index;

                // Mettre à jour les onglets actifs
                document.querySelectorAll('.support-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Mettre à jour les panneaux actifs
                document.querySelectorAll('.support-panel').forEach(p => p.classList.remove('active'));
                document.querySelector(`.support-panel[data-index="${index}"]`).classList.add('active');

                // Mettre à jour le titre du viewer
                const support = this.supports[index] || { type: 'document', nom: 'Document' };
                const typeIcon = this.getSupportIcon(support.type);
                document.querySelector('.viewer-title').innerHTML = `
                    <span class="icon">${typeIcon}</span>
                    <span>${support.nom || 'Document du cours'}</span>
                `;

                // Mettre à jour le bouton nouvel onglet
                document.getElementById('btn-new-tab').href = support.url;
            });
        });
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
        let relatedChapters = [];

        // Si c'est un chapitre de thème
        if (this.theme) {
            relatedChapters = this.allChapitres
                .filter(c => c.theme_id === this.theme.id)
                .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
        }
        // Si c'est un cours introductif
        else if (this.chapitre.discipline_id && !this.chapitre.theme_id) {
            relatedChapters = this.allChapitres
                .filter(c => !c.theme_id && c.discipline_id === this.chapitre.discipline_id)
                .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
        }

        if (relatedChapters.length === 0) return;

        const currentIndex = relatedChapters.findIndex(c => c.id === this.chapitre.id);

        const prevBtn = document.getElementById('nav-prev');
        const nextBtn = document.getElementById('nav-next');

        // Chapitre précédent
        if (currentIndex > 0) {
            const prev = relatedChapters[currentIndex - 1];
            prevBtn.href = `chapitre.html?id=${prev.id}`;
            prevBtn.classList.remove('disabled');
            prevBtn.title = prev.titre;
        }

        // Chapitre suivant
        if (currentIndex < relatedChapters.length - 1) {
            const next = relatedChapters[currentIndex + 1];
            nextBtn.href = `chapitre.html?id=${next.id}`;
            nextBtn.classList.remove('disabled');
            nextBtn.title = next.titre;
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
