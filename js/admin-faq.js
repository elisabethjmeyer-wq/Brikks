/**
 * Admin FAQ - Gestion des questions fréquentes
 */

const AdminFAQ = {
    // Données
    categories: [],
    questions: [],

    // État d'édition
    editingQuestionId: null,
    deletingItemId: null,
    deletingItemType: null, // 'question' ou 'category'

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

        // Trier les questions par catégorie puis par ordre
        this.questions = (questions || []).sort((a, b) => {
            if (a.categorie_id !== b.categorie_id) {
                const catA = this.categories.findIndex(c => c.id === a.categorie_id);
                const catB = this.categories.findIndex(c => c.id === b.categorie_id);
                return catA - catB;
            }
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
            loader.innerHTML = `<div style="color: #ef4444; text-align: center;"><p style="font-size: 48px;">⚠️</p><p>${message}</p></div>`;
        }
    },

    /**
     * Affiche les statistiques
     */
    renderStats() {
        document.getElementById('totalQuestions').textContent = this.questions.length;
        document.getElementById('totalCategories').textContent = this.categories.length;

        // Stats par catégorie
        const statsByCategory = document.getElementById('statsByCategory');
        if (statsByCategory) {
            statsByCategory.innerHTML = this.categories.map(cat => {
                const count = this.questions.filter(q => q.categorie_id === cat.id).length;
                return `
                    <div class="stat-card small">
                        <div class="stat-icon">${cat.icone || '📁'}</div>
                        <div class="stat-info">
                            <div class="stat-value">${count}</div>
                            <div class="stat-label">${this.escapeHtml(cat.nom)}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Remplit le filtre de catégories
     */
    renderCategoryFilter() {
        const filter = document.getElementById('filterCategory');
        const modalSelect = document.getElementById('questionCategory');

        const options = this.categories.map(cat =>
            `<option value="${cat.id}">${cat.icone || '📁'} ${this.escapeHtml(cat.nom)}</option>`
        ).join('');

        if (filter) {
            filter.innerHTML = `<option value="all">Toutes les catégories</option>${options}`;
        }
        if (modalSelect) {
            modalSelect.innerHTML = `<option value="">Sélectionner...</option>${options}`;
        }
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
            list.innerHTML = filteredQuestions.map(q => {
                const category = this.categories.find(c => c.id === q.categorie_id);
                const catIcon = category?.icone || '📁';
                const catName = category?.nom || 'Sans catégorie';

                return `
                    <div class="faq-item" data-id="${q.id}">
                        <div class="faq-item-header" onclick="AdminFAQ.toggleQuestion('${q.id}')">
                            <div class="faq-item-icon">${catIcon}</div>
                            <div class="faq-item-content">
                                <div class="faq-item-question">${this.escapeHtml(q.question)}</div>
                                <div class="faq-item-meta">
                                    <span class="faq-item-category">${this.escapeHtml(catName)}</span>
                                    <span class="faq-item-order">Ordre: ${q.ordre || '-'}</span>
                                </div>
                            </div>
                            <div class="faq-item-actions">
                                <button class="action-btn" onclick="event.stopPropagation(); AdminFAQ.editQuestion('${q.id}')" title="Modifier">✏️</button>
                                <button class="action-btn danger" onclick="event.stopPropagation(); AdminFAQ.confirmDeleteQuestion('${q.id}')" title="Supprimer">🗑️</button>
                                <span class="faq-item-chevron">▼</span>
                            </div>
                        </div>
                        <div class="faq-item-answer">
                            <div class="faq-item-answer-content">${this.formatAnswer(q.reponse)}</div>
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
            item.classList.toggle('open');
        }
    },

    /**
     * Formate la réponse (gère les sauts de ligne)
     */
    formatAnswer(text) {
        if (!text) return '';
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    /**
     * Lie les événements
     */
    bindEvents() {
        // Boutons principaux
        document.getElementById('addQuestionBtn')?.addEventListener('click', () => this.openAddQuestionModal());
        document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => this.openCategoriesModal());

        // Recherche et filtres
        document.getElementById('searchInput')?.addEventListener('input', () => this.renderQuestionsList());
        document.getElementById('filterCategory')?.addEventListener('change', () => this.renderQuestionsList());

        // Modal question
        document.getElementById('closeQuestionModal')?.addEventListener('click', () => this.closeQuestionModal());
        document.getElementById('cancelQuestionBtn')?.addEventListener('click', () => this.closeQuestionModal());
        document.getElementById('saveQuestionBtn')?.addEventListener('click', () => this.saveQuestion());

        // Modal catégories
        document.getElementById('closeCategoriesModal')?.addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('closeCategoriesBtn')?.addEventListener('click', () => this.closeCategoriesModal());
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => this.addCategory());

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

    // ========== GESTION DES QUESTIONS ==========

    /**
     * Ouvre le modal d'ajout de question
     */
    openAddQuestionModal() {
        this.editingQuestionId = null;
        document.getElementById('modalTitle').textContent = '❓ Nouvelle question';
        document.getElementById('questionId').value = '';
        document.getElementById('questionCategory').value = '';
        document.getElementById('questionText').value = '';
        document.getElementById('questionAnswer').value = '';
        document.getElementById('questionOrder').value = '';
        document.getElementById('questionModal').classList.remove('hidden');
    },

    /**
     * Ouvre le modal d'édition de question
     */
    editQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;

        this.editingQuestionId = questionId;
        document.getElementById('modalTitle').textContent = '✏️ Modifier la question';
        document.getElementById('questionId').value = question.id;
        document.getElementById('questionCategory').value = question.categorie_id || '';
        document.getElementById('questionText').value = question.question || '';
        document.getElementById('questionAnswer').value = question.reponse || '';
        document.getElementById('questionOrder').value = question.ordre || '';
        document.getElementById('questionModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal question
     */
    closeQuestionModal() {
        document.getElementById('questionModal').classList.add('hidden');
        this.editingQuestionId = null;
    },

    /**
     * Sauvegarde une question
     */
    async saveQuestion() {
        const categoryId = document.getElementById('questionCategory').value;
        const questionText = document.getElementById('questionText').value.trim();
        const answer = document.getElementById('questionAnswer').value.trim();
        const order = document.getElementById('questionOrder').value;

        if (!categoryId || !questionText || !answer) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        const saveBtn = document.getElementById('saveQuestionBtn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement...';

        try {
            const questionData = {
                categorie_id: categoryId,
                question: questionText,
                reponse: answer,
                ordre: order || '1'
            };

            if (this.editingQuestionId) {
                questionData.id = this.editingQuestionId;
                await this.callWebApp('updateQuestionFAQ', questionData);
            } else {
                await this.callWebApp('createQuestionFAQ', questionData);
            }

            await this.loadData();
            this.renderStats();
            this.renderQuestionsList();
            this.closeQuestionModal();

        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            alert('Erreur lors de la sauvegarde: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '✓ Enregistrer';
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
        document.getElementById('newCategoryIcon').value = '';
        document.getElementById('categoriesModal').classList.remove('hidden');
    },

    /**
     * Ferme le modal des catégories
     */
    closeCategoriesModal() {
        document.getElementById('categoriesModal').classList.add('hidden');
    },

    /**
     * Affiche la liste des catégories dans le modal
     */
    renderCategoriesList() {
        const list = document.getElementById('categoriesList');
        if (!list) return;

        if (this.categories.length === 0) {
            list.innerHTML = '<p class="empty-text">Aucune catégorie créée</p>';
            return;
        }

        list.innerHTML = this.categories.map(cat => {
            const questionsCount = this.questions.filter(q => q.categorie_id === cat.id).length;
            return `
                <div class="category-item" data-id="${cat.id}">
                    <div class="category-item-icon">${cat.icone || '📁'}</div>
                    <div class="category-item-info">
                        <div class="category-item-name">${this.escapeHtml(cat.nom)}</div>
                        <div class="category-item-count">${questionsCount} question${questionsCount > 1 ? 's' : ''}</div>
                    </div>
                    <div class="category-item-actions">
                        <button class="action-btn" onclick="AdminFAQ.editCategory('${cat.id}')" title="Modifier">✏️</button>
                        <button class="action-btn danger" onclick="AdminFAQ.confirmDeleteCategory('${cat.id}')" title="Supprimer" ${questionsCount > 0 ? 'disabled' : ''}>🗑️</button>
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
        const icon = document.getElementById('newCategoryIcon').value.trim() || '📁';

        if (!name) {
            alert('Veuillez entrer un nom de catégorie.');
            return;
        }

        const addBtn = document.getElementById('addCategoryBtn');
        addBtn.disabled = true;
        addBtn.textContent = 'Ajout...';

        try {
            const maxOrder = Math.max(0, ...this.categories.map(c => parseInt(c.ordre) || 0));
            await this.callWebApp('createCategorieFAQ', {
                nom: name,
                icone: icon,
                ordre: String(maxOrder + 1)
            });

            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderCategoriesList();
            document.getElementById('newCategoryName').value = '';
            document.getElementById('newCategoryIcon').value = '';

        } catch (error) {
            console.error('Erreur lors de l\'ajout:', error);
            alert('Erreur lors de l\'ajout: ' + error.message);
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = '➕ Ajouter';
        }
    },

    /**
     * Édite une catégorie
     */
    async editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        const newName = prompt('Nouveau nom:', category.nom);
        if (newName === null) return;

        const newIcon = prompt('Nouvelle icône (emoji):', category.icone || '📁');
        if (newIcon === null) return;

        try {
            await this.callWebApp('updateCategorieFAQ', {
                id: categoryId,
                nom: newName.trim() || category.nom,
                icone: newIcon.trim() || '📁'
            });

            await this.loadData();
            this.renderStats();
            this.renderCategoryFilter();
            this.renderCategoriesList();
            this.renderQuestionsList();

        } catch (error) {
            console.error('Erreur lors de la modification:', error);
            alert('Erreur lors de la modification: ' + error.message);
        }
    },

    /**
     * Confirme la suppression d'une catégorie
     */
    confirmDeleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        const questionsCount = this.questions.filter(q => q.categorie_id === categoryId).length;
        if (questionsCount > 0) {
            alert(`Impossible de supprimer cette catégorie car elle contient ${questionsCount} question(s).`);
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
        deleteBtn.textContent = 'Suppression...';

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
            deleteBtn.textContent = '🗑️ Supprimer';
        }
    },

    // ========== UTILITAIRES ==========

    /**
     * Appelle le Web App Google Apps Script
     */
    async callWebApp(action, data) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);

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
                delete window[callbackName];
                document.body.removeChild(script);
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
