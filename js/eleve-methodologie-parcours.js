/**
 * Élève Méthodologie Parcours - Page de détail d'une étape
 */

const EleveMethodologieParcours = {
    competence: null,
    currentEtape: null,
    categories: [],
    etapes: [],
    progression: [],
    user: null,

    async init() {
        try {
            this.user = JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEYS.USER));

            // Récupérer les paramètres d'URL
            const params = new URLSearchParams(window.location.search);
            const competenceId = params.get('competence');
            const etapeId = params.get('etape');

            if (!competenceId) {
                this.renderError('Compétence non spécifiée');
                return;
            }

            await this.loadData(competenceId);

            // Trouver l'étape courante
            if (etapeId) {
                this.currentEtape = this.etapes.find(e => e.id === etapeId);
            }

            // Si pas d'étape spécifiée, prendre la première
            if (!this.currentEtape && this.etapes.length) {
                this.currentEtape = this.etapes[0];
            }

            if (!this.currentEtape) {
                this.renderError('Aucune étape disponible');
                return;
            }

            this.render();
            this.bindEvents();
        } catch (error) {
            console.error('[EleveMethodologieParcours] Erreur:', error);
            this.renderError('Erreur lors du chargement');
        }
    },

    async loadData(competenceId) {
        const [categories, competences, allEtapes, progression] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_CATEGORIES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_COMPETENCES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.METHODOLOGIE_ETAPES),
            this.loadProgression()
        ]);

        this.categories = categories || [];
        this.competence = (competences || []).find(c => c.id === competenceId);

        if (!this.competence) {
            throw new Error('Compétence non trouvée');
        }

        // Filtrer et trier les étapes de cette compétence
        this.etapes = (allEtapes || [])
            .filter(e => e.competence_id === competenceId)
            .sort((a, b) => {
                const nA = parseInt(a.niveau) || 1;
                const nB = parseInt(b.niveau) || 1;
                if (nA !== nB) return nA - nB;
                return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
            });

        this.progression = progression;
    },

    async loadProgression() {
        try {
            const allProgression = await SheetsAPI.fetchAndParse(CONFIG.SHEETS.PROGRESSION_METHODOLOGIE);
            if (!allProgression || !this.user) return [];
            return allProgression.filter(p => p.eleve_id === this.user.id);
        } catch (e) {
            return [];
        }
    },

    // Vérifier si une étape est complétée
    isEtapeCompleted(etapeId) {
        return this.progression.some(p => p.etape_id === etapeId && p.completed === 'TRUE');
    },

    // Obtenir la catégorie de la compétence
    getCategory() {
        return this.categories.find(c => c.id === this.competence?.categorie_id);
    },

    // Obtenir les niveaux uniques
    getLevels() {
        const niveaux = [...new Set(this.etapes.map(e => parseInt(e.niveau) || 1))].sort();
        return niveaux.map(n => ({
            niveau: n,
            titre: this.etapes.find(e => parseInt(e.niveau) === n)?.niveau_titre || `Niveau ${n}`,
            etapes: this.etapes.filter(e => parseInt(e.niveau) === n)
        }));
    },

    // Calculer la progression globale
    getGlobalProgress() {
        const total = this.etapes.length;
        const completed = this.etapes.filter(e => this.isEtapeCompleted(e.id)).length;
        return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
    },

    // Obtenir l'étape précédente
    getPrevEtape() {
        const idx = this.etapes.findIndex(e => e.id === this.currentEtape?.id);
        return idx > 0 ? this.etapes[idx - 1] : null;
    },

    // Obtenir l'étape suivante
    getNextEtape() {
        const idx = this.etapes.findIndex(e => e.id === this.currentEtape?.id);
        return idx < this.etapes.length - 1 ? this.etapes[idx + 1] : null;
    },

    // Parser les documents (format JSON ou séparé par |)
    parseDocuments(documentsStr) {
        if (!documentsStr) return [];
        try {
            return JSON.parse(documentsStr);
        } catch {
            // Format alternatif: titre|url|taille séparés par ;;
            return documentsStr.split(';;').map(doc => {
                const [titre, url, taille] = doc.split('|');
                return { titre, url, taille };
            }).filter(d => d.url);
        }
    },

    // Obtenir l'URL embed pour vidéo
    getEmbedUrl(url) {
        if (!url) return null;
        if (url.includes('loom.com/share/')) return url.replace('/share/', '/embed/');
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
        if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
        const vimeo = url.match(/vimeo\.com\/(\d+)/);
        if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
        return null;
    },

    render() {
        const container = document.getElementById('main-content');
        if (!container) return;

        const category = this.getCategory();
        const levels = this.getLevels();
        const progress = this.getGlobalProgress();
        const prevEtape = this.getPrevEtape();
        const nextEtape = this.getNextEtape();
        const documents = this.parseDocuments(this.currentEtape.documents);
        const embedUrl = this.getEmbedUrl(this.currentEtape.video_url);
        const isCompleted = this.isEtapeCompleted(this.currentEtape.id);

        container.innerHTML = `
            <!-- Breadcrumb -->
            <div class="breadcrumb-bar">
                <nav class="breadcrumb">
                    <a href="methodologie.html">Méthodologie</a>
                    <span class="separator">›</span>
                    ${category ? `
                        <a href="methodologie.html">${category.icon || ''} ${this.escapeHtml(category.nom)}</a>
                        <span class="separator">›</span>
                    ` : ''}
                    <a href="methodologie-parcours.html?competence=${this.competence.id}">${this.escapeHtml(this.competence.titre)}</a>
                    <span class="separator">›</span>
                    <span class="current">${this.escapeHtml(this.currentEtape.titre)}</span>
                </nav>
            </div>

            <!-- Layout -->
            <div class="parcours-layout">
                <!-- Content -->
                <div class="parcours-content">
                    ${this.renderVideoSection(embedUrl)}
                    ${documents.length ? this.renderDownloadsSection(documents) : ''}
                    ${this.currentEtape.contenu_html ? this.renderTextContent() : ''}
                    ${this.currentEtape.bex_id ? this.renderBexLink() : ''}
                    ${this.renderNavigation(prevEtape, nextEtape)}
                </div>

                <!-- Sidebar -->
                <aside class="parcours-sidebar">
                    <div class="sidebar-card">
                        <div class="sidebar-header">
                            <h3>${this.competence.icon || '📋'} ${this.escapeHtml(this.competence.titre)}</h3>
                        </div>
                        <div class="steps-menu">
                            ${levels.map((level, idx) => this.renderLevelGroup(level, idx === 0)).join('')}
                        </div>
                        <div class="progress-section">
                            <div class="progress-header">
                                <span class="progress-label">Ta progression</span>
                                <span class="progress-value">${progress.completed}/${progress.total} étapes</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress.percent}%;"></div>
                            </div>
                            <button class="mark-complete-btn ${isCompleted ? 'completed' : ''}" id="mark-complete-btn">
                                ${isCompleted ? '✓ Étape terminée' : 'Marquer comme terminée'}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        `;
    },

    renderVideoSection(embedUrl) {
        const niveau = parseInt(this.currentEtape.niveau) || 1;
        const ordre = parseInt(this.currentEtape.ordre) || 1;

        if (embedUrl) {
            return `
                <div class="video-section">
                    <div class="video-container">
                        <iframe src="${embedUrl}" allowfullscreen allow="autoplay; encrypted-media"></iframe>
                    </div>
                </div>
            `;
        }

        return `
            <div class="video-section">
                <div class="video-container">
                    <div class="video-placeholder">
                        <div class="play-btn">▶</div>
                        <h3>Niveau ${niveau} - Étape ${ordre}</h3>
                        <p>${this.escapeHtml(this.currentEtape.titre)}</p>
                    </div>
                </div>
            </div>
        `;
    },

    renderDownloadsSection(documents) {
        return `
            <div class="downloads-section">
                <div class="downloads-header">
                    <h3>📥 Documents</h3>
                    ${documents.length > 1 ? `
                        <button class="download-all-btn" onclick="EleveMethodologieParcours.downloadAll()">
                            <span>↓</span>
                            Tout télécharger
                        </button>
                    ` : ''}
                </div>
                <div class="downloads-list">
                    ${documents.map(doc => `
                        <a href="${doc.url}" class="download-item" target="_blank" rel="noopener">
                            <div class="download-icon">${this.getFileIcon(doc.titre)}</div>
                            <div class="download-info">
                                <div class="download-name">${this.escapeHtml(doc.titre)}</div>
                                ${doc.taille ? `<div class="download-size">${doc.taille}</div>` : ''}
                            </div>
                            <button class="download-btn">↓</button>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderTextContent() {
        return `
            <div class="text-content">
                ${this.currentEtape.contenu_html}
            </div>
        `;
    },

    renderBexLink() {
        return `
            <a href="bex.html?id=${this.currentEtape.bex_id}" class="bex-link">
                <div class="bex-icon">⭐</div>
                <div class="bex-info">
                    <div class="bex-label">Exercice recommandé</div>
                    <div class="bex-title">${this.escapeHtml(this.currentEtape.bex_titre || 'Accéder à l\'exercice')}</div>
                </div>
                <span class="bex-arrow">→</span>
            </a>
        `;
    },

    renderNavigation(prevEtape, nextEtape) {
        return `
            <nav class="step-navigation">
                ${prevEtape ? `
                    <a href="methodologie-parcours.html?competence=${this.competence.id}&etape=${prevEtape.id}" class="nav-btn prev">
                        <span class="arrow">←</span>
                        <div>
                            <div class="label">Étape précédente</div>
                            <div class="title">${this.escapeHtml(prevEtape.titre)}</div>
                        </div>
                    </a>
                ` : '<div class="nav-btn disabled"></div>'}
                ${nextEtape ? `
                    <a href="methodologie-parcours.html?competence=${this.competence.id}&etape=${nextEtape.id}" class="nav-btn next">
                        <div>
                            <div class="label">Étape suivante</div>
                            <div class="title">${this.escapeHtml(nextEtape.titre)}</div>
                        </div>
                        <span class="arrow">→</span>
                    </a>
                ` : '<div class="nav-btn disabled"></div>'}
            </nav>
        `;
    },

    renderLevelGroup(level, isOpen) {
        const currentNiveau = parseInt(this.currentEtape?.niveau) || 1;
        const isCurrentLevel = level.niveau === currentNiveau;

        // Vérifier si le niveau est verrouillé
        const isLocked = level.niveau > 1 && !this.isLevelUnlocked(level.niveau);

        return `
            <div class="level-group ${isOpen || isCurrentLevel ? 'open' : ''}">
                <div class="level-header">
                    <span class="level-icon ${isLocked ? 'locked' : ''}">${level.niveau}</span>
                    <span class="level-title ${isLocked ? 'locked' : ''}">${this.escapeHtml(level.titre)}</span>
                    <span class="level-toggle">${isLocked ? '🔒' : '▶'}</span>
                </div>
                <div class="level-steps">
                    ${level.etapes.map(etape => this.renderStepItem(etape)).join('')}
                </div>
            </div>
        `;
    },

    renderStepItem(etape) {
        const isActive = etape.id === this.currentEtape?.id;
        const isCompleted = this.isEtapeCompleted(etape.id);
        const ordre = parseInt(etape.ordre) || 1;

        return `
            <a href="methodologie-parcours.html?competence=${this.competence.id}&etape=${etape.id}"
               class="step-menu-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                <span class="step-status">${isCompleted ? '✓' : ordre}</span>
                <span class="step-menu-title">${this.escapeHtml(etape.titre)}</span>
            </a>
        `;
    },

    isLevelUnlocked(niveau) {
        if (niveau === 1) return true;

        // Vérifier si toutes les étapes du niveau précédent sont complétées
        const prevEtapes = this.etapes.filter(e => parseInt(e.niveau) === niveau - 1);
        return prevEtapes.every(e => this.isEtapeCompleted(e.id));
    },

    getFileIcon(filename) {
        if (!filename) return '📄';
        const ext = filename.split('.').pop()?.toLowerCase();
        const icons = {
            pdf: '📄',
            doc: '📝',
            docx: '📝',
            xls: '📊',
            xlsx: '📊',
            ppt: '📽️',
            pptx: '📽️',
            jpg: '🖼️',
            jpeg: '🖼️',
            png: '🖼️',
            gif: '🖼️',
            mp4: '🎬',
            mp3: '🎵',
            zip: '📦'
        };
        return icons[ext] || '📄';
    },

    bindEvents() {
        // Toggle level groups
        document.querySelectorAll('.level-header').forEach(header => {
            header.addEventListener('click', () => {
                const group = header.closest('.level-group');
                const toggle = header.querySelector('.level-toggle');
                if (toggle?.textContent === '🔒') return;
                group.classList.toggle('open');
            });
        });

        // Mark complete button
        const markCompleteBtn = document.getElementById('mark-complete-btn');
        if (markCompleteBtn && !this.isEtapeCompleted(this.currentEtape.id)) {
            markCompleteBtn.addEventListener('click', () => this.markAsComplete());
        }
    },

    async markAsComplete() {
        if (!this.user || !this.currentEtape) return;

        try {
            // Appeler le Web App pour enregistrer la progression
            const response = await fetch(CONFIG.WEBAPP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addProgressionMethodologie',
                    eleve_id: this.user.id,
                    etape_id: this.currentEtape.id
                })
            });

            if (response.ok) {
                // Mettre à jour localement
                this.progression.push({
                    eleve_id: this.user.id,
                    etape_id: this.currentEtape.id,
                    completed: 'TRUE',
                    date: new Date().toISOString()
                });

                // Re-render
                this.render();
                this.bindEvents();

                // Aller à l'étape suivante après un délai
                const nextEtape = this.getNextEtape();
                if (nextEtape) {
                    setTimeout(() => {
                        window.location.href = `methodologie-parcours.html?competence=${this.competence.id}&etape=${nextEtape.id}`;
                    }, 500);
                }
            }
        } catch (error) {
            console.error('[EleveMethodologieParcours] Erreur lors de l\'enregistrement:', error);
            alert('Erreur lors de l\'enregistrement de la progression');
        }
    },

    downloadAll() {
        const documents = this.parseDocuments(this.currentEtape.documents);
        documents.forEach(doc => {
            if (doc.url) {
                window.open(doc.url, '_blank');
            }
        });
    },

    renderError(message) {
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">⚠️</span>
                    <p>${this.escapeHtml(message)}</p>
                    <a href="methodologie.html" style="margin-top: 16px; color: var(--primary);">← Retour à la méthodologie</a>
                </div>
            `;
        }
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.EleveMethodologieParcours = EleveMethodologieParcours;
