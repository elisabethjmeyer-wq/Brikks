/**
 * Élève FAQ - Affichage des questions fréquentes
 */

const EleveFAQ = {
    // Données
    categories: [],
    questions: [],

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderCategoryFilter();
            this.renderQuestionsList();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement de la FAQ');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const [categories, questions] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CATEGORIES_FAQ),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.QUESTIONS_FAQ)
        ]);

        // Trier les catégories par ordre
        this.categories = (categories || []).sort((a, b) => {
            return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
        });

        // Trier les questions par catégorie puis par ordre
        this.questions = (questions || []).sort((a, b) => {
            if (a.categorie_id !== b.categorie_id) {
                const catA = this.categories.findIndex(c => c.id === a.categorie_id);
                const catB = this.categories.findIndex(c => c.id === b.categorie_id);
                return catA - catB;
            }
            return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
        });

        console.log('FAQ chargée:', this.questions.length, 'questions');
    },

    /**
     * Affiche le contenu principal
     */
    showContent() {
        const loader = document.getElementById('loader');
        const content = document.getElementById('faq-content');
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
     * Remplit le filtre de catégories
     */
    renderCategoryFilter() {
        const filter = document.getElementById('filterCategory');
        if (!filter) return;

        const options = this.categories.map(cat =>
            `<option value="${cat.id}">${cat.icone || '📁'} ${this.escapeHtml(cat.nom)}</option>`
        ).join('');

        filter.innerHTML = `<option value="all">Toutes les catégories</option>${options}`;
    },

    /**
     * Affiche la liste des questions
     */
    renderQuestionsList() {
        const list = document.getElementById('faqList');
        const emptyState = document.getElementById('emptyState');
        const resultsCount = document.getElementById('resultsCount');
        const ctaContact = document.getElementById('ctaContact');

        const filteredQuestions = this.getFilteredQuestions();

        if (resultsCount) {
            resultsCount.textContent = `${filteredQuestions.length} question${filteredQuestions.length > 1 ? 's' : ''}`;
        }

        if (filteredQuestions.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (ctaContact) ctaContact.style.display = 'flex';
            return;
        }

        if (list) list.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
        if (ctaContact) ctaContact.style.display = 'flex';

        // Grouper par catégorie
        const grouped = {};
        filteredQuestions.forEach(q => {
            const catId = q.categorie_id || 'other';
            if (!grouped[catId]) {
                grouped[catId] = [];
            }
            grouped[catId].push(q);
        });

        if (list) {
            list.innerHTML = Object.entries(grouped).map(([catId, questions]) => {
                const category = this.categories.find(c => c.id === catId);
                const catIcon = category?.icone || '📁';
                const catName = category?.nom || 'Autres';

                const questionsHtml = questions.map(q => `
                    <div class="faq-item" data-id="${q.id}">
                        <div class="faq-item-header" onclick="EleveFAQ.toggleQuestion('${q.id}')">
                            <div class="faq-item-question">${this.escapeHtml(q.question)}</div>
                            <span class="faq-item-chevron">▼</span>
                        </div>
                        <div class="faq-item-answer">
                            <div class="faq-item-answer-content">${this.formatAnswer(q.reponse, q.video_url, q.type_reponse)}</div>
                        </div>
                    </div>
                `).join('');

                return `
                    <div class="faq-category-section">
                        <div class="faq-category-header">
                            <span class="faq-category-icon">${catIcon}</span>
                            <span class="faq-category-name">${this.escapeHtml(catName)}</span>
                            <span class="faq-category-count">${questions.length}</span>
                        </div>
                        <div class="faq-category-questions">
                            ${questionsHtml}
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Récupère les questions filtrées
     */
    getFilteredQuestions() {
        const searchInput = document.getElementById('searchInput');
        const filterCategory = document.getElementById('filterCategory');

        const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const category = filterCategory ? filterCategory.value : 'all';

        return this.questions.filter(q => {
            // Filtre recherche
            if (search && !q.question.toLowerCase().includes(search) &&
                !(q.reponse || '').toLowerCase().includes(search)) {
                return false;
            }

            // Filtre catégorie
            if (category !== 'all' && q.categorie_id !== category) {
                return false;
            }

            return true;
        });
    },

    /**
     * Toggle l'affichage d'une réponse
     */
    toggleQuestion(questionId) {
        const item = document.querySelector(`.faq-item[data-id="${questionId}"]`);
        if (item) {
            // Fermer les autres questions
            document.querySelectorAll('.faq-item.open').forEach(other => {
                if (other !== item) {
                    other.classList.remove('open');
                }
            });
            // Toggle celle-ci
            item.classList.toggle('open');
        }
    },

    /**
     * Formate la réponse (gère les sauts de ligne et vidéos)
     */
    formatAnswer(text, videoUrl, type) {
        let html = '';

        // Texte
        if (text && (type === 'texte' || type === 'mixte' || !type)) {
            html += `<p>${this.escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
        }

        // Vidéo
        if (videoUrl && (type === 'video' || type === 'mixte')) {
            const embedUrl = this.getYouTubeEmbedUrl(videoUrl);
            if (embedUrl) {
                html += `
                    <div class="video-wrapper">
                        <iframe src="${embedUrl}" allowfullscreen></iframe>
                    </div>
                `;
            }
        }

        return html || '<p><em>Pas de réponse</em></p>';
    },

    /**
     * Get embed URL from various video URL formats (YouTube, Loom, etc.)
     */
    getYouTubeEmbedUrl(url) {
        if (!url) return null;

        // Already an embed URL
        if (url.includes('/embed/')) {
            return url;
        }

        // Loom: https://www.loom.com/share/VIDEO_ID -> https://www.loom.com/embed/VIDEO_ID
        const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
        if (loomMatch) {
            return `https://www.loom.com/embed/${loomMatch[1]}`;
        }

        // YouTube: youtube.com/watch?v=VIDEO_ID
        const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
        if (watchMatch) {
            return `https://www.youtube.com/embed/${watchMatch[1]}`;
        }

        // YouTube short: youtu.be/VIDEO_ID
        const shortMatch = url.match(/youtu\.be\/([^?]+)/);
        if (shortMatch) {
            return `https://www.youtube.com/embed/${shortMatch[1]}`;
        }

        // Return original URL if not recognized (could be direct video link)
        return url;
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Recherche
        document.getElementById('searchInput')?.addEventListener('input', () => {
            this.renderQuestionsList();
        });

        // Filtre catégorie
        document.getElementById('filterCategory')?.addEventListener('change', () => {
            this.renderQuestionsList();
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
window.EleveFAQ = EleveFAQ;
