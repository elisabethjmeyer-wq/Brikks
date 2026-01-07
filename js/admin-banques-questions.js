/**
 * Admin Banques de questions - Gestion des banques et questions pour connaissances
 */

const AdminBanquesQuestions = {
    // Data
    banques: [],
    questions: [],
    themes: [],
    chapitres: [],

    // Current state
    currentBanqueId: null,
    currentQuestionType: 'qcm',

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    async loadData() {
        // Load banques, questions, themes, chapitres in parallel
        const [banquesRes, questionsRes, themesRes, chapitresRes] = await Promise.all([
            this.apiCall('getBanquesQuestions'),
            this.apiCall('getQuestionsConnaissances'),
            this.apiCall('getThemes'),
            this.apiCall('getChapitres')
        ]);

        this.banques = banquesRes.data || [];
        this.questions = questionsRes.data || [];
        this.themes = themesRes.data || [];
        this.chapitres = chapitresRes.data || [];
    },

    apiCall(action, data = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Erreur API'));
                }
            };

            const params = new URLSearchParams({
                action: action,
                callback: callbackName,
                ...data
            });

            script.src = `${CONFIG.WEBAPP_URL}?${params.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            document.body.appendChild(script);
        });
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('banques-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">!</div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Use event delegation
        document.addEventListener('click', (e) => {
            const target = e.target;
            const btn = target.closest('button, .btn');
            const id = btn?.id;

            switch (id) {
                case 'addBanqueBtn':
                case 'addBanqueBtnEmpty':
                    this.openBanqueModal();
                    break;
                case 'closeBanqueModal':
                case 'cancelBanqueBtn':
                    this.closeBanqueModal();
                    break;
                case 'saveBanqueBtn':
                    this.saveBanque();
                    break;
                case 'closeQuestionsModal':
                    this.closeQuestionsModal();
                    break;
                case 'addQuestionBtn':
                    this.openQuestionModal();
                    break;
                case 'closeQuestionModal':
                case 'cancelQuestionBtn':
                    this.closeQuestionModal();
                    break;
                case 'saveQuestionBtn':
                    this.saveQuestion();
                    break;
                case 'closeDeleteModal':
                case 'cancelDeleteBtn':
                    this.closeDeleteModal();
                    break;
                case 'confirmDeleteBtn':
                    this.confirmDelete();
                    break;
                case 'addQcmOption':
                    this.addQcmOption();
                    break;
                case 'addChronoPair':
                    this.addChronoPair();
                    break;
                case 'addTimelineEvent':
                    this.addTimelineEvent();
                    break;
                case 'addAssocPair':
                    this.addAssocPair();
                    break;
            }

            // Question type tabs
            if (target.closest('.question-types-tabs .type-tab')) {
                const tab = target.closest('.type-tab');
                document.querySelectorAll('.question-types-tabs .type-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentQuestionType = tab.dataset.type;
                this.renderQuestions();
            }

            // Modal overlay click
            if (target.classList.contains('modal-overlay')) {
                target.classList.add('hidden');
            }

            // Banque card actions
            if (target.closest('.btn-view-questions')) {
                const banqueId = target.closest('.banque-card').dataset.id;
                this.openQuestionsModal(banqueId);
            }
            if (target.closest('.btn-edit-banque')) {
                const banqueId = target.closest('.banque-card').dataset.id;
                this.openBanqueModal(banqueId);
            }
            if (target.closest('.btn-delete-banque')) {
                const banqueId = target.closest('.banque-card').dataset.id;
                this.openDeleteModal('banque', banqueId);
            }

            // Question actions
            if (target.closest('.btn-edit-question')) {
                const questionId = target.closest('.question-item').dataset.id;
                this.openQuestionModal(questionId);
            }
            if (target.closest('.btn-delete-question')) {
                const questionId = target.closest('.question-item').dataset.id;
                this.openDeleteModal('question', questionId);
            }

            // Remove buttons
            if (target.closest('.btn-remove')) {
                target.closest('.qcm-option, .chrono-pair, .timeline-event, .assoc-pair')?.remove();
            }
        });

        // Change events
        document.addEventListener('change', (e) => {
            const target = e.target;
            const id = target.id;

            switch (id) {
                case 'banqueTheme':
                    this.onThemeChange(target.value);
                    break;
                case 'questionType':
                    this.onQuestionTypeChange(target.value);
                    break;
            }
        });
    },

    // ========== RENDER ==========
    render() {
        this.renderBanques();
        this.updateStats();
    },

    renderBanques() {
        const container = document.getElementById('banquesList');
        const emptyState = document.getElementById('emptyState');

        if (this.banques.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        container.innerHTML = this.banques.map(b => {
            const questionsCount = this.questions.filter(q => q.banque_id === b.id).length;
            const theme = this.themes.find(t => t.id === b.theme_id);
            const chapitre = this.chapitres.find(c => c.id === b.chapitre_id);

            return `
                <div class="banque-card" data-id="${b.id}">
                    <div class="banque-info">
                        <div class="banque-title">${this.escapeHtml(b.titre)}</div>
                        <div class="banque-meta">
                            <span>📝 ${questionsCount} question${questionsCount > 1 ? 's' : ''}</span>
                            ${theme ? `<span>📚 ${theme.nom}</span>` : ''}
                            ${chapitre ? `<span>📖 ${chapitre.titre}</span>` : ''}
                        </div>
                    </div>
                    <div class="banque-actions">
                        <button class="btn btn-secondary btn-view-questions">Voir questions</button>
                        <button class="btn btn-secondary btn-edit-banque">Modifier</button>
                        <button class="btn btn-secondary btn-delete-banque">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderQuestions() {
        const container = document.getElementById('questionsList');
        const banqueQuestions = this.questions.filter(q =>
            q.banque_id === this.currentBanqueId &&
            (this.currentQuestionType === 'all' || q.type === this.currentQuestionType)
        );

        if (banqueQuestions.length === 0) {
            container.innerHTML = '<div class="questions-empty">Aucune question de ce type</div>';
            return;
        }

        container.innerHTML = banqueQuestions.map(q => {
            let displayText = q.question;
            if (q.type === 'chronologie' || q.type === 'timeline' || q.type === 'association') {
                displayText = q.question || this.getQuestionPreview(q);
            }

            return `
                <div class="question-item" data-id="${q.id}">
                    <div class="question-content">
                        <span class="question-type-badge ${q.type}">${this.getTypeLabel(q.type)}</span>
                        <div class="question-text">${this.escapeHtml(displayText)}</div>
                    </div>
                    <div class="question-actions">
                        <button class="btn-icon btn-edit-question" title="Modifier">✏️</button>
                        <button class="btn-icon btn-delete-question delete" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    updateStats() {
        document.getElementById('statBanques').textContent = this.banques.length;
        document.getElementById('statQuestions').textContent = this.questions.length;
    },

    // ========== MODALS: BANQUE ==========
    openBanqueModal(banqueId = null) {
        const modal = document.getElementById('banqueModal');
        const title = document.getElementById('banqueModalTitle');

        // Populate themes dropdown
        const themeSelect = document.getElementById('banqueTheme');
        themeSelect.innerHTML = '<option value="">Sélectionner...</option>' +
            this.themes.map(t => `<option value="${t.id}">${t.nom}</option>`).join('');

        if (banqueId) {
            const banque = this.banques.find(b => b.id === banqueId);
            if (banque) {
                title.textContent = 'Modifier la banque';
                document.getElementById('editBanqueId').value = banque.id;
                document.getElementById('banqueTitre').value = banque.titre || '';
                document.getElementById('banqueDescription').value = banque.description || '';
                document.getElementById('banqueTheme').value = banque.theme_id || '';
                if (banque.theme_id) {
                    this.onThemeChange(banque.theme_id);
                    document.getElementById('banqueChapitre').value = banque.chapitre_id || '';
                }
            }
        } else {
            title.textContent = 'Nouvelle banque';
            document.getElementById('editBanqueId').value = '';
            document.getElementById('banqueTitre').value = '';
            document.getElementById('banqueDescription').value = '';
            document.getElementById('banqueTheme').value = '';
            document.getElementById('banqueChapitre').innerHTML = '<option value="">Sélectionner d\'abord un thème...</option>';
            document.getElementById('banqueChapitre').disabled = true;
        }

        modal.classList.remove('hidden');
    },

    closeBanqueModal() {
        document.getElementById('banqueModal').classList.add('hidden');
    },

    async saveBanque() {
        const id = document.getElementById('editBanqueId').value;
        const titre = document.getElementById('banqueTitre').value.trim();
        const description = document.getElementById('banqueDescription').value.trim();
        const theme_id = document.getElementById('banqueTheme').value;
        const chapitre_id = document.getElementById('banqueChapitre').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        try {
            if (id) {
                await this.apiCall('updateBanqueQuestions', { id, titre, description, theme_id, chapitre_id });
            } else {
                await this.apiCall('createBanqueQuestions', { titre, description, theme_id, chapitre_id });
            }

            await this.loadData();
            this.render();
            this.closeBanqueModal();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    },

    onThemeChange(themeId) {
        const chapitreSelect = document.getElementById('banqueChapitre');
        if (!themeId) {
            chapitreSelect.innerHTML = '<option value="">Sélectionner d\'abord un thème...</option>';
            chapitreSelect.disabled = true;
            return;
        }

        const themChapitres = this.chapitres.filter(c => c.theme_id === themeId);
        chapitreSelect.innerHTML = '<option value="">Sélectionner...</option>' +
            themChapitres.map(c => `<option value="${c.id}">${c.titre}</option>`).join('');
        chapitreSelect.disabled = false;
    },

    // ========== MODALS: QUESTIONS ==========
    openQuestionsModal(banqueId) {
        const banque = this.banques.find(b => b.id === banqueId);
        if (!banque) return;

        this.currentBanqueId = banqueId;
        document.getElementById('currentBanqueId').value = banqueId;
        document.getElementById('questionsModalTitle').textContent = `Questions: ${banque.titre}`;

        // Reset tabs
        document.querySelectorAll('.question-types-tabs .type-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.question-types-tabs .type-tab[data-type="qcm"]').classList.add('active');
        this.currentQuestionType = 'qcm';

        this.renderQuestions();
        document.getElementById('questionsModal').classList.remove('hidden');
    },

    closeQuestionsModal() {
        document.getElementById('questionsModal').classList.add('hidden');
        this.currentBanqueId = null;
    },

    // ========== MODALS: QUESTION ==========
    openQuestionModal(questionId = null) {
        const modal = document.getElementById('questionModal');
        const title = document.getElementById('questionModalTitle');

        if (questionId) {
            const question = this.questions.find(q => q.id === questionId);
            if (question) {
                title.textContent = 'Modifier la question';
                document.getElementById('editQuestionId').value = question.id;
                document.getElementById('questionBanqueId').value = question.banque_id;
                document.getElementById('questionType').value = question.type;
                document.getElementById('questionDifficulte').value = question.difficulte || 'moyen';
                this.onQuestionTypeChange(question.type);
                this.populateQuestionBuilder(question);
            }
        } else {
            title.textContent = 'Nouvelle question';
            document.getElementById('editQuestionId').value = '';
            document.getElementById('questionBanqueId').value = this.currentBanqueId;
            document.getElementById('questionType').value = this.currentQuestionType;
            document.getElementById('questionDifficulte').value = 'moyen';
            this.onQuestionTypeChange(this.currentQuestionType);
            this.resetQuestionBuilder();
        }

        modal.classList.remove('hidden');
    },

    closeQuestionModal() {
        document.getElementById('questionModal').classList.add('hidden');
    },

    onQuestionTypeChange(type) {
        // Hide all builders
        document.querySelectorAll('.question-builder').forEach(b => b.classList.add('hidden'));

        // Show the right builder
        const builderMap = {
            'qcm': 'builderQcm',
            'vrai_faux': 'builderVraiFaux',
            'chronologie': 'builderChronologie',
            'timeline': 'builderTimeline',
            'association': 'builderAssociation',
            'texte_trou': 'builderTexteTrou'
        };

        const builderId = builderMap[type];
        if (builderId) {
            document.getElementById(builderId).classList.remove('hidden');
        }
    },

    resetQuestionBuilder() {
        // Reset QCM
        document.getElementById('qcmQuestion').value = '';
        document.getElementById('qcmOptions').innerHTML = '';
        this.addQcmOption();
        this.addQcmOption();
        this.addQcmOption();
        this.addQcmOption();
        document.getElementById('qcmExplication').value = '';

        // Reset Vrai/Faux
        document.getElementById('vfQuestion').value = '';
        document.querySelector('input[name="vfReponse"][value="vrai"]').checked = true;
        document.getElementById('vfExplication').value = '';

        // Reset Chronologie
        document.getElementById('chronoConsigne').value = 'Associez chaque date à l\'événement correspondant';
        document.getElementById('chronoMode').value = 'date_vers_evenement';
        document.getElementById('chronoPairs').innerHTML = '';
        this.addChronoPair();
        this.addChronoPair();

        // Reset Timeline
        document.getElementById('timelineConsigne').value = 'Remettez ces événements dans l\'ordre chronologique';
        document.getElementById('timelineEvents').innerHTML = '';
        this.addTimelineEvent();
        this.addTimelineEvent();

        // Reset Association
        document.getElementById('assocConsigne').value = 'Associez chaque élément à son correspondant';
        document.getElementById('assocPairs').innerHTML = '';
        this.addAssocPair();
        this.addAssocPair();

        // Reset Texte à trous
        document.getElementById('textetrouTexte').value = '';
    },

    populateQuestionBuilder(question) {
        const type = question.type;
        let options = question.options;
        let reponse = question.reponse_correcte;

        // Parse JSON if needed
        if (typeof options === 'string') {
            try { options = JSON.parse(options); } catch (e) { options = []; }
        }
        if (typeof reponse === 'string') {
            try { reponse = JSON.parse(reponse); } catch (e) { }
        }

        switch (type) {
            case 'qcm':
                document.getElementById('qcmQuestion').value = question.question || '';
                document.getElementById('qcmOptions').innerHTML = '';
                if (Array.isArray(options)) {
                    options.forEach((opt, i) => {
                        this.addQcmOption(opt, opt === reponse);
                    });
                }
                document.getElementById('qcmExplication').value = question.explication || '';
                break;

            case 'vrai_faux':
                document.getElementById('vfQuestion').value = question.question || '';
                const vfReponse = reponse === true || reponse === 'vrai' ? 'vrai' : 'faux';
                document.querySelector(`input[name="vfReponse"][value="${vfReponse}"]`).checked = true;
                document.getElementById('vfExplication').value = question.explication || '';
                break;

            case 'chronologie':
                document.getElementById('chronoConsigne').value = question.question || '';
                document.getElementById('chronoMode').value = options?.mode || 'date_vers_evenement';
                document.getElementById('chronoPairs').innerHTML = '';
                if (Array.isArray(options?.paires)) {
                    options.paires.forEach(p => this.addChronoPair(p.date, p.evenement));
                }
                break;

            case 'timeline':
                document.getElementById('timelineConsigne').value = question.question || '';
                document.getElementById('timelineEvents').innerHTML = '';
                if (Array.isArray(options)) {
                    options.forEach(evt => this.addTimelineEvent(evt));
                }
                break;

            case 'association':
                document.getElementById('assocConsigne').value = question.question || '';
                document.getElementById('assocPairs').innerHTML = '';
                if (Array.isArray(options)) {
                    options.forEach(p => this.addAssocPair(p.gauche, p.droite));
                }
                break;

            case 'texte_trou':
                document.getElementById('textetrouTexte').value = question.question || '';
                break;
        }
    },

    async saveQuestion() {
        const id = document.getElementById('editQuestionId').value;
        const banque_id = document.getElementById('questionBanqueId').value;
        const type = document.getElementById('questionType').value;
        const difficulte = document.getElementById('questionDifficulte').value;

        let question = '';
        let options = null;
        let reponse_correcte = null;
        let explication = '';

        switch (type) {
            case 'qcm':
                question = document.getElementById('qcmQuestion').value.trim();
                options = [];
                reponse_correcte = null;
                document.querySelectorAll('.qcm-option').forEach(opt => {
                    const text = opt.querySelector('input[type="text"]').value.trim();
                    const isCorrect = opt.querySelector('input[type="radio"]').checked;
                    if (text) {
                        options.push(text);
                        if (isCorrect) reponse_correcte = text;
                    }
                });
                explication = document.getElementById('qcmExplication').value.trim();
                if (!question || options.length < 2) {
                    alert('Question et au moins 2 options requises');
                    return;
                }
                break;

            case 'vrai_faux':
                question = document.getElementById('vfQuestion').value.trim();
                reponse_correcte = document.querySelector('input[name="vfReponse"]:checked').value;
                explication = document.getElementById('vfExplication').value.trim();
                if (!question) {
                    alert('L\'affirmation est requise');
                    return;
                }
                break;

            case 'chronologie':
                question = document.getElementById('chronoConsigne').value.trim();
                const chronoPaires = [];
                document.querySelectorAll('.chrono-pair').forEach(pair => {
                    const date = pair.querySelector('.chrono-date').value.trim();
                    const evt = pair.querySelector('.chrono-event').value.trim();
                    if (date && evt) chronoPaires.push({ date, evenement: evt });
                });
                options = {
                    mode: document.getElementById('chronoMode').value,
                    paires: chronoPaires
                };
                if (chronoPaires.length < 2) {
                    alert('Au moins 2 paires date/événement requises');
                    return;
                }
                break;

            case 'timeline':
                question = document.getElementById('timelineConsigne').value.trim();
                options = [];
                document.querySelectorAll('.timeline-event input').forEach(input => {
                    const val = input.value.trim();
                    if (val) options.push(val);
                });
                if (options.length < 2) {
                    alert('Au moins 2 événements requis');
                    return;
                }
                break;

            case 'association':
                question = document.getElementById('assocConsigne').value.trim();
                options = [];
                document.querySelectorAll('.assoc-pair').forEach(pair => {
                    const gauche = pair.querySelector('.assoc-gauche').value.trim();
                    const droite = pair.querySelector('.assoc-droite').value.trim();
                    if (gauche && droite) options.push({ gauche, droite });
                });
                if (options.length < 2) {
                    alert('Au moins 2 paires requises');
                    return;
                }
                break;

            case 'texte_trou':
                question = document.getElementById('textetrouTexte').value.trim();
                // Extract answers from {word} patterns
                const matches = question.match(/\{([^}]+)\}/g);
                if (!matches || matches.length === 0) {
                    alert('Le texte doit contenir au moins un trou {mot}');
                    return;
                }
                options = matches.map(m => m.slice(1, -1));
                break;
        }

        try {
            const data = { banque_id, type, question, options, reponse_correcte, explication, difficulte };
            if (id) {
                data.id = id;
                await this.apiCall('updateQuestionConnaissances', data);
            } else {
                await this.apiCall('createQuestionConnaissances', data);
            }

            await this.loadData();
            this.renderQuestions();
            this.updateStats();
            this.closeQuestionModal();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    },

    // ========== BUILDERS HELPERS ==========
    addQcmOption(text = '', isCorrect = false) {
        const container = document.getElementById('qcmOptions');
        const index = container.children.length;
        const name = 'qcmCorrect_' + Date.now();

        const div = document.createElement('div');
        div.className = 'qcm-option';
        div.innerHTML = `
            <input type="radio" name="${name}" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="form-input" value="${this.escapeHtml(text)}" placeholder="Option ${index + 1}">
            <button type="button" class="btn-remove">×</button>
        `;
        container.appendChild(div);

        // Update all radio names
        container.querySelectorAll('input[type="radio"]').forEach(r => r.name = name);
    },

    addChronoPair(date = '', evenement = '') {
        const container = document.getElementById('chronoPairs');
        const div = document.createElement('div');
        div.className = 'chrono-pair';
        div.innerHTML = `
            <input type="text" class="form-input chrono-date" value="${this.escapeHtml(date)}" placeholder="Date (ex: 1492)">
            <span>↔</span>
            <input type="text" class="form-input chrono-event" value="${this.escapeHtml(evenement)}" placeholder="Événement">
            <button type="button" class="btn-remove">×</button>
        `;
        container.appendChild(div);
    },

    addTimelineEvent(text = '') {
        const container = document.getElementById('timelineEvents');
        const div = document.createElement('div');
        div.className = 'timeline-event';
        div.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="form-input" value="${this.escapeHtml(text)}" placeholder="Événement">
            <button type="button" class="btn-remove">×</button>
        `;
        container.appendChild(div);
    },

    addAssocPair(gauche = '', droite = '') {
        const container = document.getElementById('assocPairs');
        const div = document.createElement('div');
        div.className = 'assoc-pair';
        div.innerHTML = `
            <input type="text" class="form-input assoc-gauche" value="${this.escapeHtml(gauche)}" placeholder="Élément gauche">
            <span>↔</span>
            <input type="text" class="form-input assoc-droite" value="${this.escapeHtml(droite)}" placeholder="Élément droit">
            <button type="button" class="btn-remove">×</button>
        `;
        container.appendChild(div);
    },

    // ========== DELETE ==========
    openDeleteModal(type, id) {
        document.getElementById('deleteType').value = type;
        document.getElementById('deleteId').value = id;

        const message = type === 'banque'
            ? 'Êtes-vous sûr de vouloir supprimer cette banque et toutes ses questions ?'
            : 'Êtes-vous sûr de vouloir supprimer cette question ?';
        document.getElementById('deleteMessage').textContent = message;

        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        const type = document.getElementById('deleteType').value;
        const id = document.getElementById('deleteId').value;

        try {
            if (type === 'banque') {
                await this.apiCall('deleteBanqueQuestions', { id });
            } else {
                await this.apiCall('deleteQuestionConnaissances', { id });
            }

            await this.loadData();
            this.render();
            if (type === 'question') {
                this.renderQuestions();
            }
            this.closeDeleteModal();
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    },

    // ========== HELPERS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getTypeLabel(type) {
        const labels = {
            'qcm': 'QCM',
            'vrai_faux': 'Vrai/Faux',
            'chronologie': 'Chronologie',
            'timeline': 'Timeline',
            'association': 'Association',
            'texte_trou': 'Texte à trous'
        };
        return labels[type] || type;
    },

    getQuestionPreview(question) {
        if (question.type === 'chronologie') {
            const opts = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (opts?.paires?.length > 0) {
                return `${opts.paires.length} paires date/événement`;
            }
        }
        if (question.type === 'timeline') {
            const opts = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (Array.isArray(opts)) {
                return `${opts.length} événements à ordonner`;
            }
        }
        if (question.type === 'association') {
            const opts = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (Array.isArray(opts)) {
                return `${opts.length} paires à associer`;
            }
        }
        return 'Question';
    }
};

// Make globally accessible
window.AdminBanquesQuestions = AdminBanquesQuestions;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    AdminBanquesQuestions.init();
});
