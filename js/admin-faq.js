/**
 * Admin FAQ - Gestion des questions fréquentes
 * Supports multiple categories per question
 */

const AdminFAQ = {
    // Données
    categories: [],
    questions: [],

    // État d'édition
    editingQuestionId: null,
    deletingItemId: null,
    deletingItemType: null, // 'question' ou 'category'
    selectedCategories: [], // Array of selected category IDs for question form

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderQuestionsList();
            this.bindEvents();
            this.showContent();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
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

        // Trier les questions par ordre
        this.questions = (questions || []).sort((a, b) => {
            return (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0);
        });

        console.log('FAQ chargée:', this.categories.length, 'catégories,', this.questions.length, 'questions');
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
            loader.innerHTML = `
                <div style="color: #ef4444; text-align: center;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 16px;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p>${message}</p>
                    <button onclick="AdminFAQ.init()" class="btn btn-primary" style="margin-top: 16px;">Réessayer</button>
                </div>
            `;
        }
    },

    /**
     * Affiche les statistiques
     */
    renderStats() {
        const total = this.questions.length;
        const texte = this.questions.filter(q => (q.type_reponse || 'texte') === 'texte').length;
        const video = this.questions.filter(q => q.type_reponse === 'video').length;
        const mixte = this.questions.filter(q => q.type_reponse === 'mixte').length;

        document.getElementById('totalQuestions').textContent = total;
        document.getElementById('totalTexte').textContent = texte + mixte;
        document.getElementById('totalVideo').textContent = video + mixte;
    },

    /**
     * Parse les catégories d'une question (supporte ancien format categorie_id et nouveau format categories)
     */
    getQuestionCategories(question) {
        // Nouveau format: categories (comma-separated IDs)
        if (question.categories) {
            return question.categories.split(',').map(id => id.trim()).filter(id => id);
        }
        // Ancien format: categorie_id (single ID)
        if (question.categorie_id) {
            return [question.categorie_id];
        }
        return [];
    },

    /**
     * Remplit le filtre de catégories (custom dropdown)
     */
    renderCategoryFilter() {
        const menu = document.getElementById('filterDropdownMenu');
        const countAll = document.getElementById('filterCountAll');

        if (countAll) {
            countAll.textContent = this.questions.length;
        }

        if (menu) {
            // Keep the "all" option, add category options
            const categoryOptions = this.categories.map(cat => {
                const count = this.questions.filter(q =>
                    this.getQuestionCategories(q).includes(cat.id)
                ).length;
                return `
                    <div class="filter-option" data-value="${cat.id}">
                        <span class="filter-icon">${cat.icone || '📁'}</span>
                        <span class="filter-name">${this.escapeHtml(cat.nom)}</span>
                        <span class="filter-count">${count}</span>
                    </div>
                `;
            }).join('');

            menu.innerHTML = `
                <div class="filter-option active" data-value="all">
                    <span class="filter-icon">📁</span>
                    <span class="filter-name">Toutes les catégories</span>
                    <span class="filter-count">${this.questions.length}</span>
                </div>
                ${categoryOptions}
            `;

            // Bind click events to options
            menu.querySelectorAll('.filter-option').forEach(option => {
                option.addEventListener('click', () => this.selectFilterOption(option));
            });
        }
    },

    /**
     * Sélectionne une option de filtre
     */
    selectFilterOption(option) {
        const value = option.dataset.value;
        const menu = document.getElementById('filterDropdownMenu');
        const btn = document.getElementById('filterDropdownBtn');
        const filterInput = document.getElementById('filterCategory');

        // Update active state
        menu.querySelectorAll('.filter-option').forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');

        // Update button text
        const icon = option.querySelector('.filter-icon').textContent;
        const name = option.querySelector('.filter-name').textContent;
        btn.querySelector('.filter-icon').textContent = icon;
        btn.querySelector('.filter-text').textContent = name;

        // Update hidden input and close menu
        filterInput.value = value;
        menu.classList.add('hidden');
        btn.classList.remove('open');

        // Re-render questions
        this.renderQuestionsList();
    },

    /**
     * Affiche la liste des questions
     */
    renderQuestionsList() {
        const list = document.getElementById('faqList');
        const emptyState = document.getElementById('emptyState');
        const count = document.getElementById('questionsCount');

        const filteredQuestions = this.getFilteredQuestions();

        if (count) {
            count.textContent = `${filteredQuestions.length} question${filteredQuestions.length > 1 ? 's' : ''}`;
        }

        if (filteredQuestions.length === 0) {
            if (list) list.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (list) list.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        if (list) {
            list.innerHTML = filteredQuestions.map(q => this.renderQuestionItem(q)).join('');
        }
    },

    /**
     * Render un item de question
     */
    renderQuestionItem(q) {
        const categoryIds = this.getQuestionCategories(q);
        const typeReponse = q.type_reponse || 'texte';

        // Generate category tags HTML
        const categoryTagsHtml = categoryIds.map(catId => {
            const category = this.categories.find(c => c.id === catId);
            if (!category) return '';
            const catColor = category.couleur || '#6366f1';
            return `
                <span class="tag" style="background: ${this.hexToRgba(catColor, 0.15)}; color: ${catColor};">
                    ${category.icone || '📁'} ${this.escapeHtml(category.nom)}
                </span>
            `;
        }).join('');

        // Type tag HTML
        const typeTagHtml = this.getTypeTagHtml(typeReponse);

        return `
            <div class="question-item" data-id="${q.id}">
                <div class="question-header" onclick="AdminFAQ.toggleQuestion('${q.id}')">
                    <div class="drag-handle">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <div class="question-content">
                        <div class="question-text">${this.escapeHtml(q.question)}</div>
                        <div class="question-tags">
                            ${categoryTagsHtml}
                            ${typeTagHtml}
                        </div>
                    </div>
                    <div class="question-actions">
                        <button class="action-btn edit" onclick="event.stopPropagation(); AdminFAQ.editQuestion('${q.id}')" title="Modifier">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" onclick="event.stopPropagation(); AdminFAQ.confirmDeleteQuestion('${q.id}')" title="Supprimer">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        <button class="action-btn chevron-btn" title="Voir la réponse">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="question-answer">
                    <div class="answer-content">
                        ${this.formatAnswer(q.reponse, q.video_url, typeReponse)}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Get type tag HTML
     */
    getTypeTagHtml(type) {
        const icons = {
            texte: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>`,
            video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>`,
            mixte: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>`
        };

        const labels = {
            texte: 'Texte',
            video: 'Vidéo',
            mixte: 'Mixte'
        };

        return `
            <span class="tag tag-type ${type}">
                ${icons[type] || icons.texte}
                ${labels[type] || 'Texte'}
            </span>
        `;
    },

    /**
     * Convert hex to rgba
     */
    hexToRgba(hex, alpha) {
        if (!hex) return `rgba(99, 102, 241, ${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

            // Filtre catégorie (supports multiple categories)
            if (category !== 'all') {
                const questionCats = this.getQuestionCategories(q);
                if (!questionCats.includes(category)) {
                    return false;
                }
            }

            return true;
        });
    },

    /**
     * Toggle l'affichage d'une réponse
     */
    toggleQuestion(questionId) {
        const item = document.querySelector(`.question-item[data-id="${questionId}"]`);
        if (item) {
            item.classList.toggle('open');
        }
    },

    /**
     * Formate la réponse (gère les sauts de ligne et vidéos)
     */
    formatAnswer(text, videoUrl, type) {
        let html = '';

        // Texte
        if (text && (type === 'texte' || type === 'mixte')) {
            html += `<p>${this.escapeHtml(text).replace(/\n/g, '</p><p>')}</p>`;
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

        return html || '<p><em>Aucune réponse</em></p>';
    },

    /**
     * Get YouTube embed URL from various YouTube URL formats
     */
    getYouTubeEmbedUrl(url) {
        if (!url) return null;

        // Already an embed URL
        if (url.includes('youtube.com/embed/')) {
            return url;
        }

        // Standard YouTube URL
        let videoId = null;

        // youtube.com/watch?v=VIDEO_ID
        const watchMatch = url.match(/youtube\.com\/watch\?v=([^&]+)/);
        if (watchMatch) {
            videoId = watchMatch[1];
        }

        // youtu.be/VIDEO_ID
        const shortMatch = url.match(/youtu\.be\/([^?]+)/);
        if (shortMatch) {
            videoId = shortMatch[1];
        }

        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }

        // Return original URL if not YouTube (could be direct video link)
        return url;
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Boutons principaux
        document.getElementById('addQuestionBtn')?.addEventListener('click', () => this.openAddQuestionModal());
        document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => this.openCategoriesModal());

        // Recherche
        document.getElementById('searchInput')?.addEventListener('input', () => this.renderQuestionsList());

        // Custom filter dropdown
        const filterBtn = document.getElementById('filterDropdownBtn');
        const filterMenu = document.getElementById('filterDropdownMenu');

        if (filterBtn && filterMenu) {
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                filterBtn.classList.toggle('open');
                filterMenu.classList.toggle('hidden');
            });

            // Close on outside click
            document.addEventListener('click', () => {
                filterBtn.classList.remove('open');
                filterMenu.classList.add('hidden');
            });
        }

        // Modal question
        document.getElementById('closeQuestionModal')?.addEventListener('click', () => this.closeQuestionModal());
        document.getElementById('cancelQuestionBtn')?.addEventListener('click', () => this.closeQuestionModal());
        document.getElementById('saveQuestionBtn')?.addEventListener('click', () => this.saveQuestion());

        // Type selector change
        document.querySelectorAll('input[name="typeReponse"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateFormForType());
        });

        // Modal catégories
        document.getElementById('closeCategoriesModal')?.addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('closeCategoriesBtn')?.addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.addCategory());

        // Enter key to add category
        document.getElementById('newCategoryName')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addCategory();
            }
        });

        // Modal suppression
        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDelete());

        // Fermer modals au clic sur overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    },

    /**
     * Update form visibility based on type
     */
    updateFormForType() {
        const type = document.querySelector('input[name="typeReponse"]:checked')?.value || 'texte';
        const texteGroup = document.getElementById('reponseTexteGroup');
        const videoGroup = document.getElementById('reponseVideoGroup');

        if (texteGroup) {
            texteGroup.style.display = (type === 'texte' || type === 'mixte') ? 'block' : 'none';
        }
        if (videoGroup) {
            videoGroup.style.display = (type === 'video' || type === 'mixte') ? 'block' : 'none';
        }
    },

    /**
     * Render category tags selector in modal
     */
    renderCategoryTagsSelector() {
        const container = document.getElementById('categoryTagsSelector');
        if (!container) return;

        if (this.categories.length === 0) {
            container.innerHTML = `
                <p style="color: #6b7280; font-size: 13px; margin: 0;">
                    Aucune catégorie disponible. Créez d'abord des catégories.
                </p>
            `;
            return;
        }

        container.innerHTML = this.categories.map(cat => {
            const isSelected = this.selectedCategories.includes(cat.id);
            return `
                <div class="category-tag-option ${isSelected ? 'selected' : ''}"
                     data-id="${cat.id}"
                     onclick="AdminFAQ.toggleCategorySelection('${cat.id}')">
                    <span class="cat-icon">${cat.icone || '📁'}</span>
                    <span class="cat-name">${this.escapeHtml(cat.nom)}</span>
                    <svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            `;
        }).join('');
    },

    /**
     * Toggle category selection
     */
    toggleCategorySelection(categoryId) {
        const index = this.selectedCategories.indexOf(categoryId);
        if (index === -1) {
            this.selectedCategories.push(categoryId);
        } else {
            this.selectedCategories.splice(index, 1);
        }
        this.renderCategoryTagsSelector();
    },

    // ========== GESTION DES QUESTIONS ==========

    /**
     * Ouvre le modal d'ajout de question
     */
    openAddQuestionModal() {
        this.editingQuestionId = null;
        this.selectedCategories = [];

        document.getElementById('modalTitle').innerHTML = '<span class="header-icon">?</span> Ajouter une question';
        document.getElementById('questionId').value = '';
        document.getElementById('questionText').value = '';
        document.getElementById('questionAnswer').value = '';
        document.getElementById('questionVideoUrl').value = '';

        // Reset type selector
        const texteRadio = document.querySelector('input[name="typeReponse"][value="texte"]');
        if (texteRadio) texteRadio.checked = true;
        this.updateFormForType();

        // Render category tags
        this.renderCategoryTagsSelector();

        document.getElementById('questionModal').classList.remove('hidden');
    },

    /**
     * Ouvre le modal d'édition de question
     */
    editQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        this.editingQuestionId = questionId;
        this.selectedCategories = this.getQuestionCategories(question);

        document.getElementById('modalTitle').innerHTML = '<span class="header-icon">?</span> Modifier la question';
        document.getElementById('questionId').value = question.id;
        document.getElementById('questionText').value = question.question || '';
        document.getElementById('questionAnswer').value = question.reponse || '';
        document.getElementById('questionVideoUrl').value = question.video_url || '';

        // Set type selector
        const type = question.type_reponse || 'texte';
        const radio = document.querySelector(`input[name="typeReponse"][value="${type}"]`);
        if (radio) radio.checked = true;
        this.updateFormForType();

        // Render category tags
        this.renderCategoryTagsSelector();

        document.getElementById('questionModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal question
     */
    closeQuestionModal() {
        document.getElementById('questionModal').classList.add('hidden');
        this.editingQuestionId = null;
        this.selectedCategories = [];
    },

    /**
     * Sauvegarde une question
     */
    async saveQuestion() {
        const questionText = document.getElementById('questionText').value.trim();
        const answer = document.getElementById('questionAnswer').value.trim();
        const videoUrl = document.getElementById('questionVideoUrl').value.trim();
        const typeReponse = document.querySelector('input[name="typeReponse"]:checked')?.value || 'texte';

        // Validation
        if (this.selectedCategories.length === 0) {
            alert('Veuillez sélectionner au moins une catégorie.');
            return;
        }
        if (!questionText) {
            alert('Veuillez entrer une question.');
            return;
        }
        if ((typeReponse === 'texte' || typeReponse === 'mixte') && !answer) {
            alert('Veuillez entrer une réponse texte.');
            return;
        }
        if ((typeReponse === 'video' || typeReponse === 'mixte') && !videoUrl) {
            alert('Veuillez entrer une URL vidéo.');
            return;
        }

        const saveBtn = document.getElementById('saveQuestionBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            Enregistrement...
        `;

        try {
            // Calculate order for new questions
            let ordre = '1';
            if (!this.editingQuestionId) {
                const maxOrder = Math.max(0, ...this.questions.map(q => parseInt(q.ordre) || 0));
                ordre = String(maxOrder + 1);
            }

            const questionData = {
                categories: this.selectedCategories.join(','), // Multiple categories as comma-separated
                categorie_id: this.selectedCategories[0] || '', // Keep for backward compatibility
                question: questionText,
                reponse: answer,
                video_url: videoUrl,
                type_reponse: typeReponse,
                ordre: ordre
            };

            if (this.editingQuestionId) {
                questionData.id = this.editingQuestionId;
                await this.callWebApp('updateQuestionFAQ', questionData);
            } else {
                await this.callWebApp('createQuestionFAQ', questionData);
            }

            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderQuestionsList();
            this.closeQuestionModal();

        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            alert('Erreur lors de la sauvegarde: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Enregistrer
            `;
        }
    },

    /**
     * Confirme la suppression d'une question
     */
    confirmDeleteQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        this.deletingItemId = questionId;
        this.deletingItemType = 'question';
        document.getElementById('deleteTitle').textContent = 'Supprimer cette question ?';
        document.getElementById('deleteConfirmText').textContent = `"${question.question}"`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== GESTION DES CATÉGORIES ==========

    /**
     * Ouvre le modal des catégories
     */
    openCategoriesModal() {
        this.renderCategoriesList();
        document.getElementById('newCategoryName').value = '';
        document.getElementById('categoriesModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal des catégories
     */
    closeCategoriesModal() {
        document.getElementById('categoriesModal').classList.add('hidden');
    },

    /**
     * Affiche la liste des catégories dans le modal (simplified)
     */
    renderCategoriesList() {
        const list = document.getElementById('categoriesList');
        if (!list) return;

        if (this.categories.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6b7280;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; opacity: 0.5;">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>Aucune catégorie créée</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.categories.map(cat => {
            // Count questions that include this category
            const questionsCount = this.questions.filter(q =>
                this.getQuestionCategories(q).includes(cat.id)
            ).length;

            return `
                <div class="category-item" data-id="${cat.id}">
                    <div class="category-info">
                        <div class="category-name">${this.escapeHtml(cat.nom)}</div>
                        <div class="category-count">${questionsCount} question${questionsCount > 1 ? 's' : ''}</div>
                    </div>
                    <div class="category-actions">
                        <button class="action-btn delete" onclick="AdminFAQ.confirmDeleteCategory('${cat.id}')" title="Supprimer" ${questionsCount > 0 ? 'disabled' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Ajoute une nouvelle catégorie
     */
    async addCategory() {
        const name = document.getElementById('newCategoryName').value.trim();

        if (!name) {
            alert('Veuillez entrer un nom de catégorie.');
            return;
        }

        const addBtn = document.getElementById('addCategoryBtn');
        addBtn.disabled = true;
        addBtn.innerHTML = `
            <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
            </svg>
        `;

        try {
            const maxOrder = Math.max(0, ...this.categories.map(c => parseInt(c.ordre) || 0));
            await this.callWebApp('createCategorieFAQ', {
                nom: name,
                icone: '📁',
                couleur: '#6366f1',
                ordre: String(maxOrder + 1)
            });

            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderCategoriesList();
            document.getElementById('newCategoryName').value = '';

        } catch (error) {
            console.error('Erreur lors de l\'ajout:', error);
            alert('Erreur lors de l\'ajout: ' + error.message);
        } finally {
            addBtn.disabled = false;
            addBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
            `;
        }
    },

    /**
     * Confirme la suppression d'une catégorie
     */
    confirmDeleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        const questionsCount = this.questions.filter(q =>
            this.getQuestionCategories(q).includes(categoryId)
        ).length;

        if (questionsCount > 0) {
            alert(`Impossible de supprimer cette catégorie car elle est utilisée par ${questionsCount} question(s).`);
            return;
        }

        this.deletingItemId = categoryId;
        this.deletingItemType = 'category';
        document.getElementById('deleteTitle').textContent = 'Supprimer cette catégorie ?';
        document.getElementById('deleteConfirmText').textContent = `"${category.nom}"`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== SUPPRESSION ==========

    /**
     * Ferme le modal de suppression
     */
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
        this.deletingItemId = null;
        this.deletingItemType = null;
    },

    /**
     * Confirme la suppression
     */
    async confirmDelete() {
        if (!this.deletingItemId || !this.deletingItemType) return;

        const deleteBtn = document.getElementById('confirmDeleteBtn');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = `
            <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
            </svg>
            Suppression...
        `;

        try {
            if (this.deletingItemType === 'question') {
                await this.callWebApp('deleteQuestionFAQ', { id: this.deletingItemId });
            } else if (this.deletingItemType === 'category') {
                await this.callWebApp('deleteCategorieFAQ', { id: this.deletingItemId });
            }

            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderQuestionsList();
            if (this.deletingItemType === 'category') {
                this.renderCategoriesList();
            }
            this.closeDeleteModal();

        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            alert('Erreur lors de la suppression: ' + error.message);
        } finally {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Supprimer
            `;
        }
    },

    // ========== UTILITAIRES ==========

    /**
     * Appelle le Web App Google Apps Script
     */
    async callWebApp(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            // Timeout après 30 secondes
            const timeout = setTimeout(() => {
                delete window[callbackName];
                if (script.parentNode) {
                    document.body.removeChild(script);
                }
                reject(new Error('Timeout: le serveur ne répond pas'));
            }, 30000);

            window[callbackName] = (response) => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) {
                    document.body.removeChild(script);
                }

                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur inconnue'));
                }
            };

            const params = new URLSearchParams({
                action: action,
                callback: callbackName,
                data: JSON.stringify(data)
            });

            const script = document.createElement('script');
            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) {
                    document.body.removeChild(script);
                }
                reject(new Error('Erreur réseau'));
            };

            document.body.appendChild(script);
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
window.AdminFAQ = AdminFAQ;
