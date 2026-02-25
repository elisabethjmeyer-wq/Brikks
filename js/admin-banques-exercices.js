/**
 * Admin Banques d'exercices - Gestion des banques, formats et exercices
 * Optimisé avec cache et appels parallèles
 */

const AdminBanquesExercices = {
    // Data
    banques: [],
    formats: [],
    exercices: [],
    tachesComplexes: [],
    competencesReferentiel: [],
    criteresReussite: [],

    // Data pour connaissances (ancien système - conservé pour compatibilité)
    banquesQuestions: [],
    questionsConnaissances: [],

    // Data pour nouveau système Connaissances
    // Formats unifiés - codes compatibles avec les banques de questions
    formatsQuestions: [
        { id: '1', code: 'qcm', nom: 'QCM', icone: '📝', description: 'Questions à choix multiples' },
        { id: '2', code: 'vrai_faux', nom: 'Vrai / Faux', icone: '✅', description: 'Questions vrai ou faux' },
        { id: '3', code: 'timeline', nom: 'Frise chronologique', icone: '📅', description: 'Texte ou cartes à ordonner chronologiquement' },
        { id: '5', code: 'association', nom: 'Association', icone: '🔗', description: 'Relier des éléments' },
        { id: '6', code: 'texte_trou', nom: 'Texte à trous', icone: '✍️', description: 'Compléter un texte' },
        { id: '7', code: 'carte', nom: 'Image cliquable', icone: '🗺️', description: 'Localisation géographique' },
        { id: '8', code: 'question_ouverte', nom: 'Question ouverte', icone: '✏️', description: 'Réponse libre de l\'élève' },
        { id: '9', code: 'flashcard', nom: 'Flashcards', icone: '🃏', description: 'Cartes recto-verso (auto-évaluation)' }
    ],
    banquesExercicesConn: [],
    entrainementsConn: [],
    etapesConn: [],
    etapeQuestionsConn: [],

    // Vue active dans Connaissances ('questions' ou 'exercices')
    connaissancesView: 'questions',

    // Cache configuration
    CACHE_KEY: 'brikks_admin_banques_cache',
    CACHE_TTL: 3 * 60 * 1000, // 3 minutes pour admin (refresh plus fréquent)

    // Current tab type
    currentType: 'connaissances',

    // Filters
    filters: {
        search: '',
        statut: ''
    },

    // Table builder state
    tableBuilder: {
        columns: [],
        rows: []
    },

    // Image cliquable builder state
    carteBuilder: {
        imageUrl: '',
        marqueurs: []
    },

    // Question ouverte builder state
    questionBuilder: {
        document: { type: 'texte', contenu: '' },
        questions: []
    },

    // Current format type_ui
    currentFormatUI: 'tableau_saisie',

    // Type config
    typeConfig: {
        'savoir-faire': { icon: '&#128310;', color: 'orange', label: 'Savoir-faire' },
        'connaissances': { icon: '&#128994;', color: 'green', label: 'Connaissances' },
        'competences': { icon: '&#128995;', color: 'purple', label: 'Competences' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            // Try loading from cache first for instant display
            const cached = this.loadFromCache();
            if (cached) {
                this.banques = cached.banques || [];
                this.formats = cached.formats || [];
                this.exercices = cached.exercices || [];
                this.tachesComplexes = cached.tachesComplexes || [];
                this.competencesReferentiel = cached.competencesReferentiel || [];
                this.criteresReussite = cached.criteresReussite || [];
                this.banquesQuestions = cached.banquesQuestions || [];
                this.questionsConnaissances = cached.questionsConnaissances || [];
                // Données connaissances (nouveau système)
                this.banquesExercicesConn = cached.banquesExercicesConn || [];
                this.entrainementsConn = cached.entrainementsConn || [];
                this.etapesConn = cached.etapesConn || [];
                this.etapeQuestionsConn = cached.etapeQuestionsConn || [];
                this.normalizeQuestionsTypes();
                this.setupEventListeners();
                this.updateCounts();
                this.applyTabState();
                this.renderBanques();
                this.showContent();
                // Refresh in background
                this.refreshDataInBackground();
            } else {
                // No cache, load fresh data
                await this.loadData();
                this.setupEventListeners();
                this.updateCounts();
                this.applyTabState();
                this.renderBanques();
                this.showContent();
            }
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    // ========== CACHE MANAGEMENT ==========
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    saveToCache() {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                banques: this.banques,
                formats: this.formats,
                exercices: this.exercices,
                tachesComplexes: this.tachesComplexes,
                competencesReferentiel: this.competencesReferentiel,
                criteresReussite: this.criteresReussite,
                banquesQuestions: this.banquesQuestions,
                questionsConnaissances: this.questionsConnaissances,
                // Données connaissances (nouveau système)
                banquesExercicesConn: this.banquesExercicesConn,
                entrainementsConn: this.entrainementsConn,
                etapesConn: this.etapesConn,
                etapeQuestionsConn: this.etapeQuestionsConn,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[Cache] Failed to save:', e);
        }
    },

    clearCache() {
        try {
            localStorage.removeItem(this.CACHE_KEY);
        } catch (e) {}
    },

    // Normalise les types de questions (trim, lowercase, underscores, inférence si vide)
    normalizeQuestionsTypes() {
        if (!this.questionsConnaissances) return;
        let fixed = 0;
        this.questionsConnaissances.forEach(q => {
            const originalType = q.type;
            // Parse donnees si nécessaire
            if (q.donnees && typeof q.donnees === 'string') {
                try { q.donnees = JSON.parse(q.donnees); } catch(e) { q.donnees = {}; }
            }
            // Normaliser: trim + lowercase + remplacer espaces/tirets par underscores
            if (q.type) {
                q.type = String(q.type).trim().toLowerCase().replace(/[\s-]+/g, '_');
            }
            // Si type vide/absent, inférer depuis la structure de donnees
            if (!q.type && q.donnees && typeof q.donnees === 'object') {
                q.type = this.inferQuestionType(q.donnees);
                if (q.type) {
                    fixed++;
                }
            }
            if (originalType && q.type !== String(originalType).trim().toLowerCase().replace(/[\s-]+/g, '_')) {
                fixed++;
            }
        });
    },

    async refreshDataInBackground() {
        try {
            await this.loadDataFromAPI();
            this.updateCounts();
            this.renderBanques();
        } catch (e) {
            console.warn('[Background] Refresh failed:', e);
        }
    },

    async loadData() {
        await this.loadDataFromAPI();
    },

    async loadDataFromAPI() {
        try {
            // PARALLEL API calls - much faster!
            const [
                banquesResult, formatsResult, exercicesResult, tachesResult, compRefResult,
                criteresResult,
                banquesQResult, questionsConnResult,
                // Nouveau système Connaissances
                formatsQResult, banquesExConnResult, entrConnResult, etapesConnResult, etapeQuestionsResult
            ] = await Promise.all([
                this.callAPI('getBanquesExercices', {}),
                this.callAPI('getFormatsExercices', {}),
                this.callAPI('getExercices', {}),
                this.callAPI('getTachesComplexes', {}),
                this.callAPI('getCompetencesReferentiel', {}),
                this.callAPI('getCriteresReussite', {}),
                this.callAPI('getBanquesQuestions', {}),
                this.callAPI('getQuestionsConnaissances', {}),
                // Nouveau système Connaissances
                this.callAPI('getFormatsQuestions', {}),
                this.callAPI('getBanquesExercicesConn', {}),
                this.callAPI('getEntrainementsConn', {}),
                this.callAPI('getEtapesConn', {}),
                this.callAPI('getEtapeQuestionsConn', {})
            ]);

            if (banquesResult.success) {
                this.banques = banquesResult.data || [];
            }
            if (formatsResult.success) {
                this.formats = formatsResult.data || [];
            }
            if (exercicesResult.success) {
                this.exercices = exercicesResult.data || [];
            }
            if (tachesResult.success) {
                this.tachesComplexes = tachesResult.data || [];
            }
            if (compRefResult.success) {
                this.competencesReferentiel = compRefResult.data || [];
            }
            if (criteresResult.success) {
                this.criteresReussite = criteresResult.data || [];
            }
            if (banquesQResult.success) {
                this.banquesQuestions = banquesQResult.data || [];
            }
            if (questionsConnResult.success) {
                this.questionsConnaissances = questionsConnResult.data || [];
                this.normalizeQuestionsTypes();
            }

            // Nouveau système Connaissances
            // Les formats sont pré-définis dans le code, on ne les écrase que si l'API retourne des données
            if (formatsQResult.success && formatsQResult.data && formatsQResult.data.length > 0) {
                this.formatsQuestions = formatsQResult.data;
                // Normaliser les formats après chargement
                this.normalizeFormatsQuestions();
            }
            if (banquesExConnResult.success) {
                this.banquesExercicesConn = banquesExConnResult.data || [];
            }
            if (entrConnResult.success) {
                this.entrainementsConn = entrConnResult.data || [];
            }
            if (etapesConnResult.success) {
                this.etapesConn = etapesConnResult.data || [];
            }
            if (etapeQuestionsResult && etapeQuestionsResult.success) {
                this.etapeQuestionsConn = etapeQuestionsResult.data || [];
            }

            // Save to cache
            this.saveToCache();
        } catch (error) {
            console.error('Erreur chargement donnees:', error);
            // En cas d'erreur API (timeout, etc.), ne pas écraser les données valides existantes
            // formatsQuestions garde son initialisation par défaut ou sa dernière valeur valide
            // Seulement réinitialiser les données du serveur si elle n'existent pas
            if (!this.banques) this.banques = [];
            if (!this.formats) this.formats = [];
            if (!this.exercices) this.exercices = [];
            if (!this.tachesComplexes) this.tachesComplexes = [];
            if (!this.competencesReferentiel) this.competencesReferentiel = [];
            if (!this.criteresReussite) this.criteresReussite = [];
            if (!this.banquesQuestions) this.banquesQuestions = [];
            if (!this.questionsConnaissances) this.questionsConnaissances = [];
            // formatsQuestions n'est pas réinitialisée - elle garde son initialisation par défaut
            if (!this.banquesExercicesConn) this.banquesExercicesConn = [];
            if (!this.entrainementsConn) this.entrainementsConn = [];
            if (!this.etapesConn) this.etapesConn = [];
        }
    },

    callAPI(action, params) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const removeScript = (script) => {
                try {
                    if (script && script.parentNode) {
                        script.parentNode.removeChild(script);
                    }
                } catch (e) {
                    // Ignore removal errors
                }
            };

            const script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                removeScript(script);
                resolve(response);
            };

            const queryParams = new URLSearchParams({
                action: action,
                callback: callbackName,
                ...params
            });

            script.src = `${CONFIG.WEBAPP_URL}?${queryParams.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                removeScript(script);
                reject(new Error('API call failed'));
            };

            document.body.appendChild(script);

            // Timeout
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    removeScript(script);
                    reject(new Error('API timeout'));
                }
            }, 15000);
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
        // Use event delegation on document for reliable event handling
        document.addEventListener('click', (e) => {
            const target = e.target;
            const id = target.id;
            const closestBtn = target.closest('button, .btn, .type-tab, .type-option, .modal-close');
            const closestId = closestBtn?.id;

            // Check by ID or closest button ID
            const effectiveId = id || closestId;

            switch (effectiveId) {
                // Add banque/tache buttons
                case 'addBanqueBtn':
                case 'addBanqueBtnEmpty':
                    if (this.currentType === 'competences') {
                        this.openTacheComplexeModal();
                    } else if (this.currentType === 'connaissances') {
                        // Selon la sous-vue active
                        if (this.connaissancesSubView === 'questions') {
                            this.addBanqueQuestions();
                        } else {
                            this.addBanqueExercicesConn();
                        }
                    } else {
                        this.openBanqueModal();
                    }
                    break;

                // Manage formats
                case 'manageFormatsBtn':
                    this.openFormatsModal();
                    break;

                // Banque modal
                case 'closeBanqueModal':
                case 'cancelBanqueBtn':
                    this.closeBanqueModal();
                    break;
                case 'saveBanqueBtn':
                    this.saveBanque();
                    break;

                // Exercice modal
                case 'closeExerciceModal':
                case 'cancelExerciceBtn':
                    this.closeExerciceModal();
                    break;
                case 'saveExerciceBtn':
                    this.saveExercice();
                    break;

                // Formats modal
                case 'closeFormatsModal':
                case 'closeFormatsBtn':
                    this.closeFormatsModal();
                    break;
                case 'addFormatBtn':
                    this.openFormatEditModal();
                    break;

                // Format edit modal
                case 'closeFormatEditModal':
                case 'cancelFormatBtn':
                    this.closeFormatEditModal();
                    break;
                case 'saveFormatBtn':
                    this.saveFormat();
                    break;

                // Delete modal
                case 'closeDeleteModal':
                case 'cancelDeleteBtn':
                    this.closeDeleteModal();
                    break;
                case 'confirmDeleteBtn':
                    this.confirmDelete();
                    break;

                // Table builder
                case 'addColumnBtn':
                    this.addColumn();
                    break;
                case 'addRowBtn':
                    this.addRow();
                    break;
                case 'previewExerciceBtn':
                    this.previewExercice();
                    break;

                // Image cliquable
                case 'addMarqueurBtn':
                    this.addMarqueurManual();
                    break;

                // Question ouverte
                case 'addQuestionBtn':
                    this.addQuestion();
                    break;

                // Document mixte
                case 'addTableauSectionBtn':
                    this.addTableauElement('section');
                    break;
                case 'addTableauRowBtn':
                    this.addTableauElement('row');
                    break;
                case 'addQuestionMixteBtn':
                    this.addQuestionMixte();
                    break;

                // Tache complexe modal
                case 'closeTacheComplexeModal':
                case 'cancelTacheComplexeBtn':
                    this.closeTacheComplexeModal();
                    break;
                case 'saveTacheComplexeBtn':
                    this.saveTacheComplexe();
                    break;
            }

            // Tab clicks
            if (target.closest('.type-tab')) {
                const tab = target.closest('.type-tab');
                const type = tab.dataset.type;
                if (type) this.switchTab(type);
            }

            // Type option selection
            if (target.closest('.type-option')) {
                const option = target.closest('.type-option');
                document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                const input = option.querySelector('input');
                if (input) input.checked = true;
            }

            // Modal overlay clicks (close on background click)
            if (target.classList.contains('modal-overlay')) {
                target.classList.add('hidden');
            }

            // WYSIWYG toolbar buttons
            if (target.closest('.wysiwyg-btn')) {
                const btn = target.closest('.wysiwyg-btn');
                const cmd = btn.dataset.cmd;
                if (cmd) {
                    e.preventDefault();
                    document.execCommand(cmd, false, null);
                }
            }
        });

        // Change events (need separate listener)
        document.addEventListener('change', (e) => {
            const target = e.target;
            const id = target.id;

            // WYSIWYG color select
            if (target.classList.contains('wysiwyg-color')) {
                const cmd = target.dataset.cmd;
                const value = target.value;
                if (cmd && value) {
                    document.execCommand(cmd, false, value);
                    target.value = ''; // Reset select
                }
                return;
            }

            switch (id) {
                case 'exerciceFormat':
                    this.onFormatChange(target.value);
                    break;
                case 'filterStatut':
                    this.filters.statut = target.value;
                    this.renderBanques();
                    break;
                case 'toggleDocument':
                    this.onMixteToggle('document', target.checked);
                    break;
                case 'toggleTableau':
                    this.onMixteToggle('tableau', target.checked);
                    break;
                case 'toggleQuestions':
                    this.onMixteToggle('questions', target.checked);
                    break;
            }
        });

        // Input events
        document.addEventListener('input', (e) => {
            const target = e.target;
            const id = target.id;

            switch (id) {
                case 'searchInput':
                    this.filters.search = target.value.toLowerCase();
                    this.renderBanques();
                    break;
                case 'carteImageUrl':
                    this.updateCartePreview(target.value);
                    break;
                case 'docUrlMixte':
                case 'docTitreMixte':
                case 'docLegendeMixte':
                case 'tableauTitreMixte':
                    this.updateMixtePreview();
                    break;
            }
        });
    },

    // ========== TABS ==========

    // Synchronise boutons/filtres avec l'onglet actif (appelé à l'init ET au clic)
    applyTabState() {
        const type = this.currentType;
        const addBtn = document.getElementById('addBanqueBtn');
        const formatsBtn = document.getElementById('manageFormatsBtn');

        if (type === 'competences') {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvel entrainement';
            if (formatsBtn) formatsBtn.style.display = 'none';
        } else if (type === 'connaissances') {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvelle banque';
            if (formatsBtn) formatsBtn.style.display = 'none';
        } else {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvelle banque';
            if (formatsBtn) formatsBtn.style.display = '';
        }
    },

    switchTab(type) {
        this.currentType = type;

        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === type) {
                tab.classList.add('active');
            }
        });

        this.applyTabState();
        this.renderBanques();
    },

    updateCounts() {
        // Count savoir-faire from banques
        const sfCount = this.banques.filter(b => b.type === 'savoir-faire').length;
        const sfEl = document.getElementById('countSavoirFaire');
        if (sfEl) sfEl.textContent = sfCount;

        // Count connaissances from banquesQuestions (nouveau système)
        const connEl = document.getElementById('countConnaissances');
        if (connEl) connEl.textContent = this.banquesQuestions.length;

        // Count competences (banques) avec des entraînements
        const compEl = document.getElementById('countCompetences');
        if (compEl) {
            const compsAvecEntr = this.competencesReferentiel.filter(c => {
                const visible = String(c.visible) === 'true' || c.visible === true || c.statut === 'actif';
                return visible && this.tachesComplexes.some(t => t.competence_id === c.id);
            });
            compEl.textContent = compsAvecEntr.length;
        }
    },

    // ========== RENDER ==========
    renderBanques() {
        const container = document.getElementById('banquesList');
        const emptyState = document.getElementById('emptyState');

        // For competences tab, render tâches complexes instead
        if (this.currentType === 'competences') {
            this.renderTachesComplexes(container, emptyState);
            return;
        }

        // For connaissances tab, render new dual-section view
        if (this.currentType === 'connaissances') {
            this.renderConnaissancesView(container, emptyState);
            return;
        }

        // Filter banques
        let filtered = this.banques.filter(b => b.type === this.currentType);

        if (this.filters.search) {
            filtered = filtered.filter(b =>
                (b.titre || '').toLowerCase().includes(this.filters.search) ||
                (b.description || '').toLowerCase().includes(this.filters.search)
            );
        }

        if (this.filters.statut) {
            filtered = filtered.filter(b => b.statut === this.filters.statut);
        }

        // Sort by ordre
        filtered.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        if (filtered.length === 0) {
            emptyState.style.display = 'none';
            const hasSearch = this.filters.search || this.filters.statut;
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${hasSearch ? '&#128269;' : '&#128310;'}</div>
                    <h3>${hasSearch ? 'Aucun resultat' : 'Aucune banque de savoir-faire'}</h3>
                    <p>${hasSearch ? 'Essayez avec d\'autres criteres de recherche.' : 'Creez votre premiere banque pour commencer.'}</p>
                    ${hasSearch ? '' : '<button class="btn btn-primary" id="addBanqueBtnEmpty">+ Nouvelle banque</button>'}
                </div>
            `;
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = filtered.map(banque => {
            const exercices = this.exercices.filter(e => e.banque_id === banque.id);
            const config = this.typeConfig[banque.type] || this.typeConfig['savoir-faire'];

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon ${banque.type}">${config.icon}</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                                <span class="status-badge ${banque.statut}">${banque.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${exercices.length}</div>
                                <div class="banque-stat-label">exercices</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon add" onclick="event.stopPropagation(); AdminBanquesExercices.addExercice('${banque.id}')" title="Ajouter un exercice">+</button>
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanque('${banque.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanque('${banque.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Exercices</h4>
                        </div>
                        ${this.renderExercices(exercices, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderExercices(exercices, banqueId) {
        if (exercices.length === 0) {
            return '<div class="exercices-empty">Aucun exercice dans cette banque</div>';
        }

        // Sort by numero
        exercices.sort((a, b) => (a.numero || 0) - (b.numero || 0));

        return `
            <div class="exercices-list">
                ${exercices.map(exo => {
                    const format = this.formats.find(f => f.id === exo.format_id);
                    const formatName = format ? format.nom : 'Format inconnu';
                    const dureeMin = Math.round((exo.duree || 600) / 60);

                    return `
                        <div class="exercice-item" data-id="${exo.id}">
                            <div class="exercice-numero">${exo.numero || '?'}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                                <div class="exercice-meta">${formatName} - ${dureeMin} min</div>
                            </div>
                            <span class="status-badge ${exo.statut}">${exo.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editExercice('${exo.id}')" title="Modifier">&#9998;</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteExercice('${exo.id}')" title="Supprimer">&#128465;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    toggleBanque(id) {
        const card = document.querySelector(`.banque-card[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('expanded');
        }
    },

    // ========== BANQUE MODAL ==========
    openBanqueModal(banque = null) {
        const modal = document.getElementById('banqueModal');
        const title = document.getElementById('banqueModalTitle');

        if (banque) {
            title.textContent = 'Modifier la banque';
            document.getElementById('editBanqueId').value = banque.id;
            document.getElementById('banqueTitre').value = banque.titre || '';
            document.getElementById('banqueDescription').value = banque.description || '';
            document.getElementById('banqueOrdre').value = banque.ordre || 1;
            document.getElementById('banqueStatut').value = banque.statut || 'brouillon';

            // Select type
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.type === banque.type) {
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                }
            });
        } else {
            title.textContent = 'Nouvelle banque';
            document.getElementById('editBanqueId').value = '';
            document.getElementById('banqueTitre').value = '';
            document.getElementById('banqueDescription').value = '';
            document.getElementById('banqueOrdre').value = 1;
            document.getElementById('banqueStatut').value = 'brouillon';

            // Select current type
            document.querySelectorAll('.type-option').forEach(opt => {
                opt.classList.remove('selected');
                if (opt.dataset.type === this.currentType) {
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                }
            });
        }

        modal.classList.remove('hidden');
    },

    closeBanqueModal() {
        document.getElementById('banqueModal').classList.add('hidden');
    },

    editBanque(id) {
        const banque = this.banques.find(b => b.id === id);
        if (banque) {
            this.openBanqueModal(banque);
        }
    },

    async saveBanque() {
        const id = document.getElementById('editBanqueId').value;
        const type = document.querySelector('input[name="banqueType"]:checked').value;
        const titre = document.getElementById('banqueTitre').value.trim();
        const description = document.getElementById('banqueDescription').value.trim();
        const ordre = parseInt(document.getElementById('banqueOrdre').value) || 1;
        const statut = document.getElementById('banqueStatut').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        const data = { type, titre, description, ordre, statut };

        // OPTIMISTIC UI: Update immediately, sync in background
        const tempId = id || 'temp_' + Date.now();
        const optimisticBanque = { ...data, id: tempId };

        if (id) {
            // Update existing
            const index = this.banques.findIndex(b => b.id === id);
            if (index >= 0) {
                this.banques[index] = { ...this.banques[index], ...data };
            }
        } else {
            // Add new (temporarily)
            this.banques.push(optimisticBanque);
        }

        // Update UI immediately
        this.updateCounts();
        this.renderBanques();
        this.closeBanqueModal();

        // Now sync with server in background
        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateBanqueExercices', data);
            } else {
                result = await this.callAPI('createBanqueExercices', data);
            }

            if (result.success) {
                // If new item, replace temp ID with real ID
                if (!id && result.id) {
                    const tempIndex = this.banques.findIndex(b => b.id === tempId);
                    if (tempIndex >= 0) {
                        this.banques[tempIndex].id = result.id;
                    }
                }
                // Save updated data to cache
                this.saveToCache();
            } else {
                // Rollback on error
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
                await this.loadDataFromAPI();
                this.updateCounts();
                this.renderBanques();
            }
        } catch (error) {
            console.error('Erreur sauvegarde banque:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteBanque(id) {
        const banque = this.banques.find(b => b.id === id);
        if (!banque) return;

        document.getElementById('deleteType').value = 'banque';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer la banque "${banque.titre}" et tous ses exercices ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== EXERCICE MODAL ==========
    addExercice(banqueId) {
        this.openExerciceModal(null, banqueId);
    },

    openExerciceModal(exercice = null, banqueId = null) {
        const modal = document.getElementById('exerciceModal');
        const title = document.getElementById('exerciceModalTitle');

        // Populate formats dropdown
        this.populateFormatsDropdown();

        // Hide all builders first
        document.querySelectorAll('.format-builder').forEach(el => el.style.display = 'none');
        document.getElementById('documentSectionTableau').style.display = 'none';

        if (exercice) {
            title.textContent = 'Modifier l\'exercice';
            document.getElementById('editExerciceId').value = exercice.id;
            document.getElementById('exerciceBanqueId').value = exercice.banque_id;
            document.getElementById('exerciceNumero').value = exercice.numero || 1;
            document.getElementById('exerciceTitre').value = exercice.titre || '';
            document.getElementById('exerciceFormat').value = exercice.format_id || '';
            document.getElementById('exerciceConsigne').value = exercice.consigne || '';
            document.getElementById('exerciceDuree').value = exercice.duree || 600;
            document.getElementById('exerciceStatut').value = exercice.statut || 'brouillon';
            document.getElementById('exercicePeutTomber').checked = exercice.peut_tomber_en_eval !== false;

            // Parse donnees
            let donnees = exercice.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }

            // Get format type_ui
            const format = this.formats.find(f => f.id === exercice.format_id);
            let structure = format ? format.structure : null;
            if (typeof structure === 'string') {
                try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
            }
            const typeUI = structure ? structure.type_ui : 'tableau_saisie';
            this.currentFormatUI = typeUI;

            // Load data into appropriate builder
            if (typeUI === 'carte_cliquable') {
                document.getElementById('builderCarte').style.display = 'block';
                this.loadCarteBuilderFromData(donnees);
            } else if (typeUI === 'question_ouverte') {
                document.getElementById('builderQuestionOuverte').style.display = 'block';
                this.loadQuestionBuilderFromData(donnees);
            } else if (typeUI === 'document_tableau') {
                document.getElementById('builderTableau').style.display = 'block';
                document.getElementById('documentSectionTableau').style.display = 'block';
                if (donnees.document) {
                    document.getElementById('docTypeTableau').value = donnees.document.type || 'texte';
                    document.getElementById('docContenuTableau').value = donnees.document.contenu || '';
                }
                this.loadTableBuilderFromData(donnees);
            } else if (typeUI === 'document_mixte') {
                document.getElementById('builderDocumentMixte').style.display = 'block';
                this.loadDocumentMixteFromData(donnees);
            } else {
                document.getElementById('builderTableau').style.display = 'block';
                this.loadTableBuilderFromData(donnees);
            }
        } else {
            title.textContent = 'Nouvel exercice';
            document.getElementById('editExerciceId').value = '';
            document.getElementById('exerciceBanqueId').value = banqueId;

            // Get next numero
            const banqueExercices = this.exercices.filter(e => e.banque_id === banqueId);
            const nextNumero = banqueExercices.length + 1;

            document.getElementById('exerciceNumero').value = nextNumero;
            document.getElementById('exerciceTitre').value = 'Exercice ' + nextNumero;
            document.getElementById('exerciceFormat').value = '';
            document.getElementById('exerciceConsigne').value = '';
            document.getElementById('exerciceDuree').value = 600;
            document.getElementById('exerciceStatut').value = 'brouillon';
            document.getElementById('exercicePeutTomber').checked = true;

            // Reset to default format
            this.currentFormatUI = 'tableau_saisie';
            document.getElementById('builderTableau').style.display = 'block';
            this.initTableBuilder();
        }

        modal.classList.remove('hidden');
    },

    populateFormatsDropdown() {
        const select = document.getElementById('exerciceFormat');
        select.innerHTML = '<option value="">Selectionner un format...</option>' +
            this.formats.map(f => `<option value="${f.id}">${this.escapeHtml(f.nom)}</option>`).join('');
    },

    closeExerciceModal() {
        document.getElementById('exerciceModal').classList.add('hidden');
    },

    editExercice(id) {
        const exercice = this.exercices.find(e => e.id === id);
        if (exercice) {
            this.openExerciceModal(exercice);
        }
    },

    async saveExercice() {
        const id = document.getElementById('editExerciceId').value;
        const banque_id = document.getElementById('exerciceBanqueId').value;
        const numero = parseInt(document.getElementById('exerciceNumero').value) || 1;
        const titre = document.getElementById('exerciceTitre').value.trim();
        const format_id = document.getElementById('exerciceFormat').value;
        const consigne = document.getElementById('exerciceConsigne').value.trim();
        const duree = parseInt(document.getElementById('exerciceDuree').value) || 600;
        const statut = document.getElementById('exerciceStatut').value;
        const peut_tomber_en_eval = document.getElementById('exercicePeutTomber').checked;

        if (!format_id) {
            alert('Le format est requis');
            return;
        }

        // Build donnees from the appropriate builder
        let donnees;
        if (this.currentFormatUI === 'carte_cliquable') {
            donnees = this.buildDataFromCarteBuilder();
            if (!donnees.image_url) {
                alert('L\'URL de l\'image est requise');
                return;
            }
            if (donnees.marqueurs.length === 0) {
                alert('Ajoutez au moins un marqueur');
                return;
            }
        } else if (this.currentFormatUI === 'question_ouverte') {
            donnees = this.buildDataFromQuestionBuilder();
            if (donnees.questions.length === 0) {
                alert('Ajoutez au moins une question');
                return;
            }
        } else if (this.currentFormatUI === 'document_tableau') {
            donnees = this.buildDataFromTableBuilder();
            donnees.document = {
                type: document.getElementById('docTypeTableau').value,
                contenu: document.getElementById('docContenuTableau').value
            };
            if (!donnees || donnees.colonnes.length === 0) {
                alert('Ajoutez au moins une colonne au tableau');
                return;
            }
            if (donnees.lignes.length === 0) {
                alert('Ajoutez au moins une ligne au tableau');
                return;
            }
        } else if (this.currentFormatUI === 'document_mixte') {
            donnees = this.buildDataFromDocumentMixte();
            // Validate: at least one section must be active
            const hasContent = (donnees.document && donnees.document.actif) ||
                               (donnees.tableau && donnees.tableau.actif) ||
                               (donnees.questions && donnees.questions.actif);
            if (!hasContent) {
                alert('Activez au moins une section (Document, Tableau ou Questions)');
                return;
            }
            // Validate tableau if active (new format uses elements)
            if (donnees.tableau && donnees.tableau.actif) {
                const elements = donnees.tableau.elements || [];
                if (elements.length === 0) {
                    alert('Le tableau nécessite au moins une section ou ligne');
                    return;
                }
            }
        } else {
            // Default: tableau_saisie
            donnees = this.buildDataFromTableBuilder();
            if (!donnees || donnees.colonnes.length === 0) {
                alert('Ajoutez au moins une colonne au tableau');
                return;
            }
            if (donnees.lignes.length === 0) {
                alert('Ajoutez au moins une ligne au tableau');
                return;
            }
        }

        const data = {
            banque_id, format_id, numero, titre, consigne, duree,
            donnees: JSON.stringify(donnees),
            peut_tomber_en_eval, statut
        };

        // OPTIMISTIC UI: Update immediately, sync in background
        const tempId = id || 'temp_' + Date.now();
        const optimisticExercice = { ...data, id: tempId, donnees };

        if (id) {
            // Update existing
            const index = this.exercices.findIndex(e => e.id === id);
            if (index >= 0) {
                this.exercices[index] = { ...this.exercices[index], ...optimisticExercice };
            }
        } else {
            // Add new (temporarily)
            this.exercices.push(optimisticExercice);
        }

        // Update UI immediately
        this.renderBanques();
        this.closeExerciceModal();

        // Now sync with server in background
        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateExercice', data);
            } else {
                result = await this.callAPI('createExercice', data);
            }

            if (result.success) {
                // If new item, replace temp ID with real ID
                if (!id && result.id) {
                    const tempIndex = this.exercices.findIndex(e => e.id === tempId);
                    if (tempIndex >= 0) {
                        this.exercices[tempIndex].id = result.id;
                    }
                }
                // Save updated data to cache
                this.saveToCache();
            } else {
                // Rollback on error
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
                await this.loadDataFromAPI();
                this.renderBanques();
            }
        } catch (error) {
            console.error('Erreur sauvegarde exercice:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteExercice(id) {
        const exercice = this.exercices.find(e => e.id === id);
        if (!exercice) return;

        document.getElementById('deleteType').value = 'exercice';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer l'exercice "${exercice.titre || 'Exercice ' + exercice.numero}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== FORMATS MODAL ==========
    openFormatsModal() {
        this.renderFormatsList();
        document.getElementById('formatsModal').classList.remove('hidden');
    },

    closeFormatsModal() {
        document.getElementById('formatsModal').classList.add('hidden');
    },

    renderFormatsList() {
        const container = document.getElementById('formatsList');

        if (this.formats.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucun format defini</div>';
            return;
        }

        container.innerHTML = this.formats.map(format => {
            const types = (format.type_compatible || '').split(',').filter(t => t.trim());

            return `
                <div class="format-item" data-id="${format.id}">
                    <div class="format-item-icon">&#128221;</div>
                    <div class="format-item-content">
                        <div class="format-item-name">${this.escapeHtml(format.nom)}</div>
                        <div class="format-item-desc">${this.escapeHtml(format.description || 'Aucune description')}</div>
                    </div>
                    <div class="format-item-types">
                        ${types.map(t => `<span class="format-type-badge ${t.trim()}">${t.trim()}</span>`).join('')}
                    </div>
                    <div class="format-item-actions">
                        <button class="btn-icon" onclick="AdminBanquesExercices.editFormat('${format.id}')" title="Modifier">&#9998;</button>
                        <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteFormat('${format.id}')" title="Supprimer">&#128465;</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    // ========== FORMAT EDIT MODAL ==========
    openFormatEditModal(format = null) {
        const modal = document.getElementById('formatEditModal');
        const title = document.getElementById('formatEditModalTitle');

        if (format) {
            title.textContent = 'Modifier le format';
            document.getElementById('editFormatId').value = format.id;
            document.getElementById('formatNom').value = format.nom || '';
            document.getElementById('formatDescription').value = format.description || '';

            // Set type checkboxes
            const types = (format.type_compatible || '').split(',').map(t => t.trim());
            document.querySelectorAll('input[name="formatTypes"]').forEach(cb => {
                cb.checked = types.includes(cb.value);
            });

            // Format structure
            const structure = typeof format.structure === 'object' ?
                JSON.stringify(format.structure, null, 2) : (format.structure || '');
            document.getElementById('formatStructure').value = structure;
        } else {
            title.textContent = 'Nouveau format';
            document.getElementById('editFormatId').value = '';
            document.getElementById('formatNom').value = '';
            document.getElementById('formatDescription').value = '';

            // Reset checkboxes
            document.querySelectorAll('input[name="formatTypes"]').forEach(cb => {
                cb.checked = cb.value === 'savoir-faire';
            });

            document.getElementById('formatStructure').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeFormatEditModal() {
        document.getElementById('formatEditModal').classList.add('hidden');
    },

    editFormat(id) {
        const format = this.formats.find(f => f.id === id);
        if (format) {
            this.openFormatEditModal(format);
        }
    },

    async saveFormat() {
        const id = document.getElementById('editFormatId').value;
        const nom = document.getElementById('formatNom').value.trim();
        const description = document.getElementById('formatDescription').value.trim();

        // Get selected types
        const types = [];
        document.querySelectorAll('input[name="formatTypes"]:checked').forEach(cb => {
            types.push(cb.value);
        });
        const type_compatible = types.join(',');

        // Parse structure JSON
        let structure;
        const structureStr = document.getElementById('formatStructure').value.trim();
        if (structureStr) {
            try {
                structure = JSON.parse(structureStr);
            } catch (e) {
                alert('Erreur: Le JSON de la structure n\'est pas valide');
                return;
            }
        } else {
            structure = {};
        }

        if (!nom) {
            alert('Le nom est requis');
            return;
        }

        const data = { nom, description, type_compatible, structure: JSON.stringify(structure) };

        // OPTIMISTIC UI: Update immediately, sync in background
        const tempId = id || 'temp_' + Date.now();
        const optimisticFormat = { ...data, id: tempId, structure };

        if (id) {
            // Update existing
            const index = this.formats.findIndex(f => f.id === id);
            if (index >= 0) {
                this.formats[index] = { ...this.formats[index], ...optimisticFormat };
            }
        } else {
            // Add new (temporarily)
            this.formats.push(optimisticFormat);
        }

        // Update UI immediately
        this.renderFormatsList();
        this.closeFormatEditModal();

        // Now sync with server in background
        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateFormatExercices', data);
            } else {
                result = await this.callAPI('createFormatExercices', data);
            }

            if (result.success) {
                // If new item, replace temp ID with real ID
                if (!id && result.id) {
                    const tempIndex = this.formats.findIndex(f => f.id === tempId);
                    if (tempIndex >= 0) {
                        this.formats[tempIndex].id = result.id;
                    }
                }
                // Save updated data to cache
                this.saveToCache();
            } else {
                // Rollback on error
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
                await this.loadDataFromAPI();
                this.renderFormatsList();
            }
        } catch (error) {
            console.error('Erreur sauvegarde format:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteFormat(id) {
        const format = this.formats.find(f => f.id === id);
        if (!format) return;

        document.getElementById('deleteType').value = 'format';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer le format "${format.nom}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== DELETE MODAL ==========
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        const type = document.getElementById('deleteType').value;
        const id = document.getElementById('deleteId').value;

        // OPTIMISTIC UI: Remove immediately, sync in background
        // Save backup for rollback
        const backupBanques = [...this.banques];
        const backupExercices = [...this.exercices];
        const backupFormats = [...this.formats];
        const backupTaches = [...this.tachesComplexes];

        // Remove from local data immediately
        if (type === 'banque') {
            this.banques = this.banques.filter(b => b.id !== id);
            // Also remove associated exercices
            this.exercices = this.exercices.filter(e => e.banque_id !== id);
        } else if (type === 'exercice') {
            this.exercices = this.exercices.filter(e => e.id !== id);
        } else if (type === 'format') {
            this.formats = this.formats.filter(f => f.id !== id);
        } else if (type === 'tacheComplexe') {
            this.tachesComplexes = this.tachesComplexes.filter(t => t.id !== id);
        }

        // Update UI immediately
        this.updateCounts();
        this.renderBanques();
        if (type === 'format') {
            this.renderFormatsList();
        }
        this.closeDeleteModal();

        // Now sync with server in background
        try {
            let result;
            if (type === 'banque') {
                result = await this.callAPI('deleteBanqueExercices', { id });
            } else if (type === 'exercice') {
                result = await this.callAPI('deleteExercice', { id });
            } else if (type === 'format') {
                result = await this.callAPI('deleteFormatExercices', { id });
            } else if (type === 'tacheComplexe') {
                result = await this.callAPI('deleteTacheComplexe', { id });
            }

            if (result && result.success) {
                // Save updated data to cache
                this.saveToCache();
            } else {
                // Rollback on error
                this.banques = backupBanques;
                this.exercices = backupExercices;
                this.formats = backupFormats;
                this.tachesComplexes = backupTaches;
                this.updateCounts();
                this.renderBanques();
                if (type === 'format') {
                    this.renderFormatsList();
                }
                alert('Erreur: ' + (result?.error || 'Erreur inconnue'));
            }
        } catch (error) {
            // Rollback on error
            this.banques = backupBanques;
            this.exercices = backupExercices;
            this.formats = backupFormats;
            this.tachesComplexes = backupTaches;
            this.updateCounts();
            this.renderBanques();
            if (type === 'format') {
                this.renderFormatsList();
            }
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    // ========== UTILS ==========
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    normalizeImageUrl(url) {
        if (!url) return '';
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
        if (driveFileMatch) {
            return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
        }
        const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
        if (driveOpenMatch) {
            return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
        }
        const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
        if (driveUcMatch) {
            return `https://lh3.googleusercontent.com/d/${driveUcMatch[1]}`;
        }
        return url;
    }
};

// Make globally accessible for inline handlers
window.AdminBanquesExercices = AdminBanquesExercices;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    AdminBanquesExercices.init();
});
