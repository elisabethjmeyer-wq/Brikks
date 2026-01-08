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

    // Data pour connaissances (ancien système - conservé pour compatibilité)
    banquesQuestions: [],
    questionsConnaissances: [],

    // Data pour nouveau système Connaissances
    // Formats unifiés - codes compatibles avec les banques de questions
    formatsQuestions: [
        { id: '1', code: 'qcm', nom: 'QCM', icone: '📝', description: 'Questions à choix multiples' },
        { id: '2', code: 'vrai_faux', nom: 'Vrai / Faux', icone: '✅', description: 'Questions vrai ou faux' },
        { id: '3', code: 'chronologie', nom: 'Frise chronologique', icone: '📅', description: 'Événements à ordonner' },
        { id: '4', code: 'association', nom: 'Association', icone: '🔗', description: 'Relier des éléments' },
        { id: '5', code: 'texte_trou', nom: 'Texte à trous', icone: '✍️', description: 'Compléter un texte' },
        { id: '6', code: 'categorisation', nom: 'Catégorisation', icone: '📂', description: 'Classer par catégories' },
        { id: '7', code: 'carte', nom: 'Carte', icone: '🗺️', description: 'Localisation géographique' }
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
    currentType: 'savoir-faire',

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

    // Carte cliquable builder state
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
                this.banquesQuestions = cached.banquesQuestions || [];
                this.questionsConnaissances = cached.questionsConnaissances || [];
                this.setupEventListeners();
                this.updateCounts();
                this.renderBanques();
                this.showContent();
                // Refresh in background
                this.refreshDataInBackground();
            } else {
                // No cache, load fresh data
                await this.loadData();
                this.setupEventListeners();
                this.updateCounts();
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
                console.log('[Cache] Loaded from cache');
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
                banquesQuestions: this.banquesQuestions,
                questionsConnaissances: this.questionsConnaissances,
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

    async refreshDataInBackground() {
        try {
            console.log('[Background] Refreshing data...');
            await this.loadDataFromAPI();
            this.updateCounts();
            this.renderBanques();
            console.log('[Background] Data refreshed');
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
                banquesQResult, questionsConnResult,
                // Nouveau système Connaissances
                formatsQResult, banquesExConnResult, entrConnResult, etapesConnResult
            ] = await Promise.all([
                this.callAPI('getBanquesExercices', {}),
                this.callAPI('getFormatsExercices', {}),
                this.callAPI('getExercices', {}),
                this.callAPI('getTachesComplexes', {}),
                this.callAPI('getCompetencesReferentiel', {}),
                this.callAPI('getBanquesQuestions', {}),
                this.callAPI('getQuestionsConnaissances', {}),
                // Nouveau système Connaissances
                this.callAPI('getFormatsQuestions', {}),
                this.callAPI('getBanquesExercicesConn', {}),
                this.callAPI('getEntrainementsConn', {}),
                this.callAPI('getEtapesConn', {})
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
            if (banquesQResult.success) {
                this.banquesQuestions = banquesQResult.data || [];
            }
            if (questionsConnResult.success) {
                this.questionsConnaissances = questionsConnResult.data || [];
                // Parse JSON donnees
                this.questionsConnaissances = this.questionsConnaissances.map(q => {
                    if (q.donnees && typeof q.donnees === 'string') {
                        try { q.donnees = JSON.parse(q.donnees); } catch(e) { q.donnees = {}; }
                    }
                    return q;
                });
            }

            // Nouveau système Connaissances
            // Les formats sont pré-définis dans le code, on ne les écrase que si l'API retourne des données
            if (formatsQResult.success && formatsQResult.data && formatsQResult.data.length > 0) {
                this.formatsQuestions = formatsQResult.data;
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

            // Save to cache
            this.saveToCache();
        } catch (error) {
            console.error('Erreur chargement donnees:', error);
            // Initialize with empty arrays if API fails
            this.banques = [];
            this.formats = [];
            this.exercices = [];
            this.tachesComplexes = [];
            this.competencesReferentiel = [];
            this.banquesQuestions = [];
            this.questionsConnaissances = [];
            this.formatsQuestions = [];
            this.banquesExercicesConn = [];
            this.entrainementsConn = [];
            this.etapesConn = [];
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

                // Carte cliquable
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
    switchTab(type) {
        this.currentType = type;

        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === type) {
                tab.classList.add('active');
            }
        });

        // Update button text and visibility based on tab
        const addBtn = document.getElementById('addBanqueBtn');
        const formatsBtn = document.getElementById('manageFormatsBtn');

        if (type === 'competences') {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvelle tache complexe';
            if (formatsBtn) formatsBtn.style.display = 'none';
        } else if (type === 'connaissances') {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvelle banque';
            if (formatsBtn) formatsBtn.style.display = 'none'; // Pas de formats pour connaissances
        } else {
            if (addBtn) addBtn.innerHTML = '<span>+</span> Nouvelle banque';
            if (formatsBtn) formatsBtn.style.display = '';
        }

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

        // Count competences from tâches complexes
        const compEl = document.getElementById('countCompetences');
        if (compEl) compEl.textContent = this.tachesComplexes.length;
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
            container.innerHTML = '';
            emptyState.style.display = 'block';
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
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanque('${banque.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanque('${banque.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Exercices</h4>
                            <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addExercice('${banque.id}')">+ Ajouter</button>
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

    // ========== TABLE BUILDER ==========
    initTableBuilder() {
        // Default: 2 columns (Date = display, Siècle = editable)
        this.tableBuilder = {
            columns: [
                { titre: 'Date', editable: false },
                { titre: 'Siècle', editable: true }
            ],
            rows: [
                ['', '']
            ]
        };
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    loadTableBuilderFromData(donnees) {
        if (donnees && donnees.colonnes && donnees.lignes) {
            this.tableBuilder = {
                columns: donnees.colonnes.map(c => ({
                    titre: c.titre || '',
                    editable: c.editable !== false
                })),
                rows: donnees.lignes.map(ligne => ligne.cells || [])
            };
        } else if (donnees && donnees.lignes && Array.isArray(donnees.lignes)) {
            // Legacy format: lignes with named properties
            // Try to infer columns from first row
            const firstRow = donnees.lignes[0];
            const keys = Object.keys(firstRow);
            this.tableBuilder = {
                columns: keys.map(key => ({
                    titre: key.charAt(0).toUpperCase() + key.slice(1),
                    editable: key !== 'date'
                })),
                rows: donnees.lignes.map(ligne => keys.map(k => ligne[k] || ''))
            };
        } else {
            this.initTableBuilder();
            return;
        }
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    buildDataFromTableBuilder() {
        // Read current values from DOM
        this.readTableBuilderValues();

        return {
            colonnes: this.tableBuilder.columns.map(c => ({
                titre: c.titre,
                editable: c.editable
            })),
            lignes: this.tableBuilder.rows.map(row => ({
                cells: row
            }))
        };
    },

    readTableBuilderValues() {
        // Read columns
        const colDefs = document.querySelectorAll('.column-def');
        this.tableBuilder.columns = Array.from(colDefs).map(def => ({
            titre: def.querySelector('.col-title-input').value || '',
            editable: def.querySelector('.col-editable-check').checked
        }));

        // Read rows
        const tbody = document.getElementById('tableBuilderBody');
        const rows = tbody.querySelectorAll('tr');
        this.tableBuilder.rows = Array.from(rows).map(tr => {
            const inputs = tr.querySelectorAll('input[type="text"]');
            return Array.from(inputs).map(input => input.value || '');
        });
    },

    renderColumnsBuilder() {
        const container = document.getElementById('columnsBuilder');
        container.innerHTML = this.tableBuilder.columns.map((col, index) => `
            <div class="column-def" data-index="${index}">
                <span class="column-num">${index + 1}</span>
                <input type="text" class="col-title-input" value="${this.escapeHtml(col.titre)}" placeholder="Nom de la colonne">
                <label class="column-editable">
                    <input type="checkbox" class="col-editable-check" ${col.editable ? 'checked' : ''}>
                    <span>Réponse élève</span>
                </label>
                <button type="button" class="btn-remove-col" onclick="AdminBanquesExercices.removeColumn(${index})" title="Supprimer">&times;</button>
            </div>
        `).join('');

        // Add change listeners
        container.querySelectorAll('.col-title-input, .col-editable-check').forEach(input => {
            input.addEventListener('change', () => this.onColumnChange());
        });
    },

    renderTableBuilder() {
        const thead = document.getElementById('tableBuilderHead');
        const tbody = document.getElementById('tableBuilderBody');

        // Render headers
        thead.innerHTML = `
            <tr>
                ${this.tableBuilder.columns.map((col, i) => `
                    <th class="${col.editable ? 'editable-col' : ''}">
                        ${this.escapeHtml(col.titre) || 'Colonne ' + (i + 1)}
                        <span class="col-hint">${col.editable ? '(réponse)' : '(donnée)'}</span>
                    </th>
                `).join('')}
                <th class="row-actions"></th>
            </tr>
        `;

        // Ensure rows have correct number of cells
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            const newRow = [...row];
            while (newRow.length < this.tableBuilder.columns.length) {
                newRow.push('');
            }
            return newRow.slice(0, this.tableBuilder.columns.length);
        });

        // Render rows
        if (this.tableBuilder.rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100" class="table-builder-empty">Aucune ligne. Cliquez sur "Ajouter une ligne".</td></tr>';
        } else {
            tbody.innerHTML = this.tableBuilder.rows.map((row, rowIndex) => `
                <tr data-row="${rowIndex}">
                    ${this.tableBuilder.columns.map((col, colIndex) => `
                        <td>
                            <input type="text"
                                   class="${col.editable ? 'editable-input' : ''}"
                                   value="${this.escapeHtml(row[colIndex] || '')}"
                                   placeholder="${col.editable ? 'Réponse attendue' : 'Donnée affichée'}">
                        </td>
                    `).join('')}
                    <td class="row-actions">
                        <button type="button" class="btn-remove-row" onclick="AdminBanquesExercices.removeRow(${rowIndex})" title="Supprimer">&times;</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    onColumnChange() {
        this.readTableBuilderValues();
        this.renderTableBuilder();
    },

    addColumn() {
        this.readTableBuilderValues();
        this.tableBuilder.columns.push({ titre: '', editable: true });
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => [...row, '']);
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    removeColumn(index) {
        if (this.tableBuilder.columns.length <= 1) {
            alert('Il faut au moins une colonne');
            return;
        }
        this.readTableBuilderValues();
        this.tableBuilder.columns.splice(index, 1);
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            row.splice(index, 1);
            return row;
        });
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    addRow() {
        this.readTableBuilderValues();
        const newRow = this.tableBuilder.columns.map(() => '');
        this.tableBuilder.rows.push(newRow);
        this.renderTableBuilder();
    },

    removeRow(index) {
        if (this.tableBuilder.rows.length <= 1) {
            alert('Il faut au moins une ligne');
            return;
        }
        this.readTableBuilderValues();
        this.tableBuilder.rows.splice(index, 1);
        this.renderTableBuilder();
    },

    previewExercice() {
        const consigne = document.getElementById('exerciceConsigne').value;
        const titre = document.getElementById('exerciceTitre').value || 'Exercice';
        const formatUI = this.currentFormatUI || 'tableau_saisie';

        let contentHTML = '';
        let extraStyles = '';

        if (formatUI === 'carte_cliquable') {
            const donnees = this.buildDataFromCarteBuilder();
            extraStyles = `
                .carte-container { position: relative; display: inline-block; max-width: 100%; }
                .carte-image { max-width: 100%; height: auto; display: block; border-radius: 8px; }
                .carte-marker { position: absolute; width: 32px; height: 32px; background: #6366f1; color: white;
                    border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 14px; transform: translate(-50%, -50%); cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
                .carte-marker:hover { background: #4f46e5; transform: translate(-50%, -50%) scale(1.1); }
                .carte-marker .badge { position: absolute; top: -8px; left: 100%; margin-left: 4px; background: white;
                    color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
                .preview-note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 1rem;
                    font-size: 0.875rem; color: #92400e; }
            `;
            const imageUrl = this.convertToDirectImageUrl(donnees.imageUrl);
            contentHTML = `
                <div class="carte-container">
                    <img src="${this.escapeHtml(imageUrl)}" class="carte-image" alt="Carte" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display:none; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;">
                        ⚠️ Impossible de charger l'image. Vérifiez le lien.
                    </div>
                    ${donnees.marqueurs.map((m, i) => `
                        <div class="carte-marker" style="left: ${m.x}%; top: ${m.y}%;">
                            ${i + 1}
                            <span class="badge">${this.escapeHtml(m.reponse)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="preview-note">
                    <strong>Aperçu admin:</strong> Les élèves cliqueront sur les numéros pour saisir leur réponse dans un popup.
                    Les réponses attendues (${donnees.marqueurs.length}) sont affichées ici à titre indicatif.
                </div>
            `;
        } else if (formatUI === 'question_ouverte') {
            const donnees = this.buildDataFromQuestionBuilder();
            extraStyles = `
                .qo-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .qo-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .qo-document img { max-width: 100%; height: auto; }
                .qo-questions { display: flex; flex-direction: column; gap: 1rem; }
                .qo-question { background: #fafafa; padding: 1rem; border-radius: 8px; }
                .qo-question-text { font-weight: 500; margin-bottom: 0.5rem; }
                .qo-textarea { width: 100%; min-height: 80px; padding: 10px; border: 2px solid #dbeafe; border-radius: 6px; resize: vertical; }
            `;
            const docImgUrl = this.convertToDirectImageUrl(donnees.document.contenu);
            const docContent = donnees.document.type === 'image'
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(donnees.document.contenu)}</p>`;
            contentHTML = `
                <div class="qo-layout">
                    <div class="qo-document">${docContent}</div>
                    <div class="qo-questions">
                        ${donnees.questions.map((q, i) => `
                            <div class="qo-question">
                                <div class="qo-question-text">${i + 1}. ${this.escapeHtml(q.question)}</div>
                                <textarea class="qo-textarea" placeholder="Votre réponse..."></textarea>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_tableau') {
            // Document + Table format
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            const docType = document.getElementById('docTypeTableau').value;
            const docContenu = document.getElementById('docContenuTableau').value;
            const docImgUrl = this.convertToDirectImageUrl(docContenu);
            extraStyles = `
                .dt-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .dt-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .dt-document img { max-width: 100%; height: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            const docContent = docType === 'image'
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(docContenu)}</p>`;
            contentHTML = `
                <div class="dt-layout">
                    <div class="dt-document">${docContent}</div>
                    <div class="dt-table">
                        <table>
                            <thead>
                                <tr>
                                    ${donnees.colonnes.map(col => `<th class="${col.editable ? 'editable' : ''}">${this.escapeHtml(col.titre)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${donnees.lignes.map(ligne => `
                                    <tr>
                                        ${donnees.colonnes.map((col, i) => col.editable
                                            ? `<td class="input-cell"><input type="text" placeholder="..."></td>`
                                            : `<td class="data-cell">${this.escapeHtml(ligne.cells[i] || '')}</td>`
                                        ).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_mixte') {
            // Document Mixte format
            const donnees = this.buildDataFromDocumentMixte();
            const layout = donnees.layout || 'vertical';

            extraStyles = `
                .mixte-container { display: flex; flex-direction: column; gap: 1.5rem; }
                .mixte-container.horizontal { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .mixte-container.horizontal .mixte-left, .mixte-container.horizontal .mixte-right { display: flex; flex-direction: column; gap: 1rem; }
                .mixte-section { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .mixte-section-header { padding: 0.75rem 1rem; font-weight: 600; }
                .doc-header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
                .tableau-header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; }
                .questions-header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
                .mixte-doc-content { padding: 1rem; }
                .mixte-doc-content img { max-width: 100%; height: auto; border-radius: 4px; }
                .mixte-doc-content iframe { width: 100%; height: 300px; border: none; }
                .mixte-doc-legend { padding: 0.75rem 1rem; font-size: 0.9rem; color: #666; border-top: 1px solid #eee; }
                .tableau-section-row { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 0.6rem 1rem; font-weight: 600; }
                .tableau-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e5e7eb; }
                .tableau-row:last-child { border-bottom: none; }
                .tableau-row .label { padding: 0.75rem 1rem; background: #f9fafb; font-weight: 500; border-right: 1px solid #e5e7eb; }
                .tableau-row .input { padding: 0.75rem 1rem; background: #fef3c7; }
                .tableau-row .input input { width: 100%; padding: 0.5rem; border: 1px solid #fbbf24; border-radius: 4px; }
                .question-item { padding: 1rem; border-bottom: 1px solid #eee; }
                .question-item:last-child { border-bottom: none; }
                .question-text { font-weight: 500; margin-bottom: 0.5rem; }
                .question-textarea { width: 100%; min-height: 80px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical; }
            `;

            // Build document HTML
            let docHTML = '';
            if (donnees.document?.actif) {
                const doc = donnees.document;
                const converted = this.convertGoogleUrl(doc.url);
                let docContent = '';
                if (converted.type === 'drive_file') {
                    docContent = `<img src="${converted.imageUrl}" alt="Document" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                        <iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
                } else if (converted.iframeUrl) {
                    docContent = `<iframe src="${converted.iframeUrl}"></iframe>`;
                } else if (doc.url) {
                    docContent = `<img src="${this.convertToDirectImageUrl(doc.url)}" alt="Document">`;
                }
                docHTML = `
                    <div class="mixte-section">
                        ${doc.titre ? `<div class="mixte-section-header doc-header">${this.escapeHtml(doc.titre)}</div>` : ''}
                        <div class="mixte-doc-content">${docContent || '<div style="color:#999;">Aucun document</div>'}</div>
                        ${doc.legende ? `<div class="mixte-doc-legend">${this.escapeHtml(doc.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>` : ''}
                    </div>
                `;
            }

            // Build tableau HTML
            let tableauHTML = '';
            if (donnees.tableau?.actif) {
                const elements = donnees.tableau.elements || [];
                let tableContent = elements.map(el => {
                    if (el.type === 'section') {
                        return `<div class="tableau-section-row">${this.escapeHtml(el.text)}</div>`;
                    } else {
                        // Show empty input like student will see
                        return `<div class="tableau-row">
                            <div class="label">${this.escapeHtml(el.label)}</div>
                            <div class="input"><input type="text" placeholder=""></div>
                        </div>`;
                    }
                }).join('');

                tableauHTML = `
                    <div class="mixte-section">
                        <div class="mixte-section-header tableau-header">${this.escapeHtml(donnees.tableau.titre) || 'À COMPLÉTER'}</div>
                        ${tableContent || '<div style="padding:1rem;color:#999;">Aucun élément</div>'}
                    </div>
                `;
            }

            // Build questions HTML
            let questionsHTML = '';
            if (donnees.questions?.actif) {
                const questions = donnees.questions.liste || [];
                let questionsContent = questions.map((q, i) => `
                    <div class="question-item">
                        <div class="question-text">${i + 1}. ${this.escapeHtml(q.question)}</div>
                        <textarea class="question-textarea" placeholder="Votre réponse..."></textarea>
                    </div>
                `).join('');

                questionsHTML = `
                    <div class="mixte-section">
                        <div class="mixte-section-header questions-header">Questions ouvertes</div>
                        ${questionsContent || '<div style="padding:1rem;color:#999;">Aucune question</div>'}
                    </div>
                `;
            }

            // Combine based on layout
            if (layout === 'horizontal' && docHTML && (tableauHTML || questionsHTML)) {
                contentHTML = `<div class="mixte-container horizontal">
                    <div class="mixte-left">${docHTML}</div>
                    <div class="mixte-right">${tableauHTML}${questionsHTML}</div>
                </div>`;
            } else {
                contentHTML = `<div class="mixte-container">${docHTML}${tableauHTML}${questionsHTML}</div>`;
            }
        } else {
            // Default: tableau_saisie
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            extraStyles = `
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            contentHTML = `
                <table>
                    <thead>
                        <tr>
                            ${donnees.colonnes.map(col => `<th class="${col.editable ? 'editable' : ''}">${this.escapeHtml(col.titre)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${donnees.lignes.map(ligne => `
                            <tr>
                                ${donnees.colonnes.map((col, i) => col.editable
                                    ? `<td class="input-cell"><input type="text" placeholder="..."></td>`
                                    : `<td class="data-cell">${this.escapeHtml(ligne.cells[i] || '')}</td>`
                                ).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation - ${this.escapeHtml(titre)}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; padding: 2rem; background: #f5f5f5; }
                    .preview-card { background: white; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    .preview-header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; }
                    .preview-header h1 { margin: 0; font-size: 1.3rem; }
                    .preview-consigne { background: #f8f9ff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
                    .preview-content { padding: 1.5rem; }
                    ${extraStyles}
                </style>
            </head>
            <body>
                <div class="preview-card">
                    <div class="preview-header">
                        <h1>${this.escapeHtml(titre)}</h1>
                    </div>
                    ${consigne ? `<div class="preview-consigne">${this.escapeHtml(consigne)}</div>` : ''}
                    <div class="preview-content">
                        ${contentHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
    },

    // ========== FORMAT SWITCHING ==========
    onFormatChange(formatId) {
        // Compare as strings to handle type mismatch
        const format = this.formats.find(f => String(f.id) === String(formatId));
        let structure = format ? format.structure : null;

        // Handle double-stringified JSON from Google Sheets
        if (typeof structure === 'string') {
            try {
                structure = JSON.parse(structure);
                // Check if it's still a string (double-encoded)
                if (typeof structure === 'string') {
                    structure = JSON.parse(structure);
                }
            } catch (e) {
                structure = {};
            }
        }

        const typeUI = structure ? structure.type_ui : 'tableau_saisie';
        this.currentFormatUI = typeUI;

        console.log('Format change:', { formatId, format, structure, typeUI });

        // Hide all builders
        document.querySelectorAll('.format-builder').forEach(el => el.style.display = 'none');

        // Show appropriate builder
        if (typeUI === 'carte_cliquable') {
            document.getElementById('builderCarte').style.display = 'block';
            this.initCarteBuilder();
        } else if (typeUI === 'question_ouverte') {
            document.getElementById('builderQuestionOuverte').style.display = 'block';
            this.initQuestionBuilder();
        } else if (typeUI === 'document_tableau') {
            document.getElementById('builderTableau').style.display = 'block';
            document.getElementById('documentSectionTableau').style.display = 'block';
            this.initTableBuilder();
        } else if (typeUI === 'document_mixte') {
            document.getElementById('builderDocumentMixte').style.display = 'block';
            this.initDocumentMixteBuilder();
        } else {
            // Default: tableau_saisie
            document.getElementById('builderTableau').style.display = 'block';
            document.getElementById('documentSectionTableau').style.display = 'none';
            this.initTableBuilder();
        }
    },

    // ========== CARTE CLIQUABLE BUILDER ==========
    initCarteBuilder() {
        this.carteBuilder = { imageUrl: '', marqueurs: [] };
        document.getElementById('carteImageUrl').value = '';
        document.getElementById('cartePreviewWrapper').style.display = 'none';
        document.getElementById('cartePreviewPlaceholder').style.display = 'block';
        this.renderMarqueursList();
    },

    loadCarteBuilderFromData(donnees) {
        this.carteBuilder = {
            imageUrl: donnees.image_url || '',
            marqueurs: (donnees.marqueurs || []).map(m => ({
                x: m.x,
                y: m.y,
                reponse: m.reponse || ''
            }))
        };
        document.getElementById('carteImageUrl').value = this.carteBuilder.imageUrl;
        if (this.carteBuilder.imageUrl) {
            this.updateCartePreview(this.carteBuilder.imageUrl);
        }
        this.renderMarqueursList();
    },

    updateCartePreview(url) {
        // Convert Google Drive share links to direct image URLs
        url = this.convertToDirectImageUrl(url);
        this.carteBuilder.imageUrl = url;

        const wrapper = document.getElementById('cartePreviewWrapper');
        const placeholder = document.getElementById('cartePreviewPlaceholder');
        const img = document.getElementById('cartePreviewImage');

        if (url) {
            img.src = url;
            img.onload = () => {
                wrapper.style.display = 'block';
                placeholder.style.display = 'none';
                this.renderCarteMarkers();
            };
            img.onerror = () => {
                wrapper.style.display = 'none';
                placeholder.style.display = 'block';
                placeholder.textContent = 'Erreur de chargement de l\'image';
            };
        } else {
            wrapper.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = 'Entrez une URL d\'image ci-dessus pour voir l\'apercu';
        }
    },

    // Convert Google Drive share links to direct image URLs
    convertToDirectImageUrl(url) {
        if (!url) return url;

        // Pattern: https://drive.google.com/file/d/FILE_ID/view...
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            const fileId = driveMatch[1];
            // Use lh3.googleusercontent.com format which works better for embedding
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }

        // Already a direct link or other URL format
        return url;
    },

    renderCarteMarkers() {
        const container = document.getElementById('cartePreviewMarkers');
        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => `
            <div class="carte-marker-preview"
                 style="left: ${m.x}%; top: ${m.y}%;"
                 title="Marqueur ${i + 1}: ${this.escapeHtml(m.reponse)}">
                ${i + 1}
            </div>
        `).join('');

        // Add click handler to image for adding markers
        const wrapper = document.getElementById('cartePreviewWrapper');
        wrapper.onclick = (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
            const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
            this.addMarqueur(parseFloat(x), parseFloat(y));
        };
    },

    addMarqueur(x, y) {
        this.carteBuilder.marqueurs.push({ x, y, reponse: '' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    addMarqueurManual() {
        this.carteBuilder.marqueurs.push({ x: 50, y: 50, reponse: '' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    removeMarqueur(index) {
        this.carteBuilder.marqueurs.splice(index, 1);
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    renderMarqueursList() {
        const container = document.getElementById('marqueursList');
        if (this.carteBuilder.marqueurs.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucun marqueur. Cliquez sur l\'image ou ajoutez manuellement.</div>';
            return;
        }

        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => `
            <div class="marqueur-item">
                <span class="marqueur-num">${i + 1}</span>
                <div class="marqueur-coords">X: ${m.x}% Y: ${m.y}%</div>
                <input type="text" class="form-input marqueur-reponse" data-index="${i}"
                       value="${this.escapeHtml(m.reponse)}" placeholder="Reponse attendue...">
                <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeMarqueur(${i})">&times;</button>
            </div>
        `).join('');

        // Add listeners for reponse inputs
        container.querySelectorAll('.marqueur-reponse').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.carteBuilder.marqueurs[idx].reponse = e.target.value;
            });
        });
    },

    buildDataFromCarteBuilder() {
        return {
            image_url: this.carteBuilder.imageUrl,
            marqueurs: this.carteBuilder.marqueurs.map((m, i) => ({
                id: i,
                x: m.x,
                y: m.y,
                reponse: m.reponse
            }))
        };
    },

    // ========== QUESTION OUVERTE BUILDER ==========
    initQuestionBuilder() {
        this.questionBuilder = {
            document: { type: 'texte', contenu: '' },
            questions: []
        };
        document.getElementById('docTypeQO').value = 'texte';
        document.getElementById('docContenuQO').value = '';
        this.renderQuestionsList();
    },

    loadQuestionBuilderFromData(donnees) {
        this.questionBuilder = {
            document: donnees.document || { type: 'texte', contenu: '' },
            questions: (donnees.questions || []).map(q => ({
                titre: q.titre || '',
                etapes: q.etapes || [],
                reponse_attendue: q.reponse_attendue || ''
            }))
        };
        document.getElementById('docTypeQO').value = this.questionBuilder.document.type || 'texte';
        document.getElementById('docContenuQO').value = this.questionBuilder.document.contenu || '';
        this.renderQuestionsList();
    },

    addQuestion() {
        this.questionBuilder.questions.push({
            titre: 'Question ' + (this.questionBuilder.questions.length + 1),
            etapes: [''],
            reponse_attendue: ''
        });
        this.renderQuestionsList();
    },

    removeQuestion(index) {
        this.questionBuilder.questions.splice(index, 1);
        this.renderQuestionsList();
    },

    addEtape(qIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.push('');
        this.renderQuestionsList();
    },

    removeEtape(qIndex, eIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.splice(eIndex, 1);
        this.renderQuestionsList();
    },

    readQuestionsFromDOM() {
        const container = document.getElementById('questionsList');
        const items = container.querySelectorAll('.question-item');

        this.questionBuilder.questions = Array.from(items).map((item, qIndex) => {
            const titre = item.querySelector('.question-titre').value;
            const etapes = Array.from(item.querySelectorAll('.etape-input')).map(inp => inp.value);
            const reponse = item.querySelector('.question-correction').value;
            return { titre, etapes, reponse_attendue: reponse };
        });
    },

    renderQuestionsList() {
        const container = document.getElementById('questionsList');
        if (this.questionBuilder.questions.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucune question. Cliquez sur "Ajouter une question".</div>';
            return;
        }

        container.innerHTML = this.questionBuilder.questions.map((q, qIndex) => `
            <div class="question-item" data-index="${qIndex}">
                <div class="question-header">
                    <span class="question-num">${qIndex + 1}</span>
                    <input type="text" class="form-input question-titre" value="${this.escapeHtml(q.titre)}" placeholder="Titre de la question">
                    <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeQuestion(${qIndex})">&times;</button>
                </div>
                <div class="question-etapes">
                    <label>Etapes/Guidage</label>
                    ${q.etapes.map((e, eIndex) => `
                        <div class="etape-row">
                            <input type="text" class="form-input etape-input" value="${this.escapeHtml(e)}" placeholder="Ex: Identifiez les elements cles...">
                            <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeEtape(${qIndex}, ${eIndex})">&times;</button>
                        </div>
                    `).join('')}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addEtape(${qIndex})">+ Etape</button>
                </div>
                <div class="question-correction-wrap">
                    <label>Correction attendue</label>
                    <textarea class="form-textarea question-correction" rows="3" placeholder="Reponse modele...">${this.escapeHtml(q.reponse_attendue)}</textarea>
                </div>
            </div>
        `).join('');
    },

    buildDataFromQuestionBuilder() {
        this.readQuestionsFromDOM();
        return {
            document: {
                type: document.getElementById('docTypeQO').value,
                contenu: document.getElementById('docContenuQO').value
            },
            questions: this.questionBuilder.questions
        };
    },

    // ========== DOCUMENT MIXTE BUILDER ==========
    initDocumentMixteBuilder() {
        this.mixteBuilder = {
            document: { actif: true, type: 'url', url: '', texte: '', titre: '', legende: '' },
            tableau: { actif: false, titre: '', elements: [] },
            questions: { actif: false, liste: [] },
            sectionOrder: ['document', 'tableau', 'questions'],
            layout: 'vertical'
        };

        // Reset UI
        document.getElementById('toggleDocument').checked = true;
        document.getElementById('toggleTableau').checked = false;
        document.getElementById('toggleQuestions').checked = false;
        document.getElementById('mixteLayoutSelect').value = 'vertical';
        document.getElementById('docUrlMixte').value = '';
        document.getElementById('docTitreMixte').value = '';
        document.getElementById('docLegendeMixte').value = '';
        document.getElementById('tableauTitreMixte').value = '';
        document.getElementById('tableauElementsList').innerHTML = '';
        document.getElementById('questionsListMixte').innerHTML = '';

        // Reset document type toggle
        const docTypeUrl = document.querySelector('input[name="docType"][value="url"]');
        if (docTypeUrl) docTypeUrl.checked = true;
        const docTexteEl = document.getElementById('docTexteMixte');
        if (docTexteEl) docTexteEl.innerHTML = '';
        this.toggleDocType('url');

        // Show/hide sections
        document.getElementById('sectionDocument').style.display = 'block';
        document.getElementById('sectionTableau').style.display = 'none';
        document.getElementById('sectionQuestions').style.display = 'none';

        // Initialize drag and drop
        this.initMixteDragDrop();

        // Update preview
        this.updateMixtePreview();
    },

    toggleDocType(type) {
        const urlSection = document.getElementById('docUrlSection');
        const texteSection = document.getElementById('docTexteSection');

        if (type === 'url') {
            if (urlSection) urlSection.style.display = 'block';
            if (texteSection) texteSection.style.display = 'none';
        } else {
            if (urlSection) urlSection.style.display = 'none';
            if (texteSection) texteSection.style.display = 'block';
        }

        if (this.mixteBuilder && this.mixteBuilder.document) {
            this.mixteBuilder.document.type = type;
        }

        this.updateMixtePreview();
    },

    onLayoutChange(layout) {
        if (this.mixteBuilder) {
            this.mixteBuilder.layout = layout;
        }
        this.updateMixtePreview();
    },

    loadDocumentMixteFromData(donnees) {
        if (!donnees) return;

        // Handle both old format (colonnes/lignes) and new format (elements)
        let tableauData = donnees.tableau || { actif: false, titre: '', elements: [] };

        // Convert old format to new format if needed
        if (tableauData.colonnes && !tableauData.elements) {
            tableauData.elements = this.convertOldTableauFormat(tableauData);
        }

        const docData = donnees.document || { actif: true, type: 'url', url: '', texte: '', titre: '', legende: '' };

        this.mixteBuilder = {
            document: {
                actif: docData.actif !== undefined ? docData.actif : true,
                type: docData.type || 'url',
                url: docData.url || '',
                texte: docData.texte || '',
                titre: docData.titre || '',
                legende: docData.legende || ''
            },
            tableau: {
                actif: tableauData.actif || false,
                titre: tableauData.titre || '',
                elements: tableauData.elements || []
            },
            questions: donnees.questions || { actif: false, liste: [] },
            sectionOrder: donnees.sectionOrder || ['document', 'tableau', 'questions'],
            layout: donnees.layout || 'vertical'
        };

        // Set toggles
        document.getElementById('toggleDocument').checked = this.mixteBuilder.document.actif;
        document.getElementById('toggleTableau').checked = this.mixteBuilder.tableau.actif;
        document.getElementById('toggleQuestions').checked = this.mixteBuilder.questions.actif;
        document.getElementById('mixteLayoutSelect').value = this.mixteBuilder.layout;

        // Set document type toggle
        const docType = this.mixteBuilder.document.type || 'url';
        const docTypeRadio = document.querySelector(`input[name="docType"][value="${docType}"]`);
        if (docTypeRadio) docTypeRadio.checked = true;
        this.toggleDocType(docType);

        // Set document fields
        document.getElementById('docUrlMixte').value = this.mixteBuilder.document.url || '';
        const docTexteEl = document.getElementById('docTexteMixte');
        if (docTexteEl) docTexteEl.innerHTML = this.mixteBuilder.document.texte || '';
        document.getElementById('docTitreMixte').value = this.mixteBuilder.document.titre || '';
        document.getElementById('docLegendeMixte').value = this.mixteBuilder.document.legende || '';

        // Set tableau fields
        document.getElementById('tableauTitreMixte').value = this.mixteBuilder.tableau.titre || '';
        this.renderTableauElements();

        // Set questions
        this.renderMixteQuestions();

        // Show/hide sections based on toggles
        document.getElementById('sectionDocument').style.display = this.mixteBuilder.document.actif ? 'block' : 'none';
        document.getElementById('sectionTableau').style.display = this.mixteBuilder.tableau.actif ? 'block' : 'none';
        document.getElementById('sectionQuestions').style.display = this.mixteBuilder.questions.actif ? 'block' : 'none';

        // Reorder sections
        this.reorderMixteSections();

        this.initMixteDragDrop();
        this.updateMixtePreview();
    },

    // Convert old colonnes/lignes format to new elements format
    convertOldTableauFormat(oldTableau) {
        const elements = [];
        const colonnes = oldTableau.colonnes || [];
        const lignes = oldTableau.lignes || [];

        // If we have 2 columns (label/response pattern), convert to rows
        if (colonnes.length === 2 && colonnes[1].editable) {
            lignes.forEach(ligne => {
                elements.push({
                    type: 'row',
                    label: ligne.cells[0] || '',
                    placeholder: ligne.cells[1] || ''
                });
            });
        }
        return elements;
    },

    onMixteToggle(section, checked) {
        this.mixteBuilder[section].actif = checked;

        const sectionEl = document.getElementById(`section${section.charAt(0).toUpperCase() + section.slice(1)}`);
        if (sectionEl) {
            sectionEl.style.display = checked ? 'block' : 'none';
        }

        // Add to order if not present
        if (checked && !this.mixteBuilder.sectionOrder.includes(section)) {
            this.mixteBuilder.sectionOrder.push(section);
        }

        this.updateMixtePreview();
    },

    initMixteDragDrop() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');

        sections.forEach(section => {
            const handle = section.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', (e) => {
                section.setAttribute('draggable', 'true');
            });

            section.addEventListener('dragstart', (e) => {
                section.classList.add('dragging');
                e.dataTransfer.setData('text/plain', section.dataset.section);
            });

            section.addEventListener('dragend', () => {
                section.classList.remove('dragging');
                section.removeAttribute('draggable');
                this.updateSectionOrder();
                this.updateMixtePreview();
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== section) {
                    section.classList.add('drag-over');
                    const rect = section.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, section);
                    } else {
                        container.insertBefore(dragging, section.nextSibling);
                    }
                }
            });

            section.addEventListener('dragleave', () => {
                section.classList.remove('drag-over');
            });

            section.addEventListener('drop', () => {
                section.classList.remove('drag-over');
            });
        });
    },

    updateSectionOrder() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');
        this.mixteBuilder.sectionOrder = Array.from(sections).map(s => s.dataset.section);
    },

    reorderMixteSections() {
        const container = document.getElementById('mixteBuilderSections');
        const order = this.mixteBuilder.sectionOrder;

        order.forEach(sectionName => {
            const section = container.querySelector(`[data-section="${sectionName}"]`);
            if (section) {
                container.appendChild(section);
            }
        });
    },

    // Flexible Tableau Elements
    addTableauElement(type) {
        // Ensure mixteBuilder is initialized
        if (!this.mixteBuilder) {
            this.initDocumentMixteBuilder();
        }
        if (!this.mixteBuilder.tableau.elements) {
            this.mixteBuilder.tableau.elements = [];
        }

        if (type === 'section') {
            this.mixteBuilder.tableau.elements.push({
                type: 'section',
                text: ''
            });
        } else if (type === 'row') {
            this.mixteBuilder.tableau.elements.push({
                type: 'row',
                label: '',
                reponse: ''
            });
        }
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
        this.updateMixtePreview();
    },

    removeTableauElement(index) {
        this.mixteBuilder.tableau.elements.splice(index, 1);
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
        this.updateMixtePreview();
    },

    renderTableauElements() {
        const container = document.getElementById('tableauElementsList');
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            container.innerHTML = '<div style="color:#999;font-style:italic;padding:1rem;text-align:center;">Ajoutez des sections et des lignes</div>';
            return;
        }

        container.innerHTML = elements.map((el, i) => {
            if (el.type === 'section') {
                return `
                    <div class="tableau-element section-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">⋮⋮</span>
                        <div class="element-content">
                            <input type="text" class="section-input" value="${this.escapeHtml(el.text)}"
                                   placeholder="Titre de la section (ex: OEUVRE D'ORIGINE)"
                                   onchange="AdminBanquesExercices.updateTableauElement(${i}, 'text', this.value)">
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>
                `;
            } else {
                return `
                    <div class="tableau-element row-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">⋮⋮</span>
                        <div class="element-content">
                            <div class="row-inputs">
                                <input type="text" class="label-input" value="${this.escapeHtml(el.label)}"
                                       placeholder="Label (ex: Auteur)"
                                       onchange="AdminBanquesExercices.updateTableauElement(${i}, 'label', this.value)">
                                <input type="text" class="answer-input" value="${this.escapeHtml(el.reponse || '')}"
                                       placeholder="Réponse attendue"
                                       onchange="AdminBanquesExercices.updateTableauElement(${i}, 'reponse', this.value)">
                            </div>
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>
                `;
            }
        }).join('');
    },

    updateTableauElement(index, field, value) {
        this.mixteBuilder.tableau.elements[index][field] = value;
        this.updateMixtePreview();
    },

    initTableauElementsDragDrop() {
        const container = document.getElementById('tableauElementsList');
        const items = container.querySelectorAll('.tableau-element');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.updateTableauElementsOrder();
                this.updateMixtePreview();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    item.classList.add('drag-over');
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, item);
                    } else {
                        container.insertBefore(dragging, item.nextSibling);
                    }
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', () => {
                item.classList.remove('drag-over');
            });
        });
    },

    updateTableauElementsOrder() {
        const container = document.getElementById('tableauElementsList');
        const items = container.querySelectorAll('.tableau-element');
        const oldElements = [...this.mixteBuilder.tableau.elements];
        const newElements = [];

        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            newElements.push(oldElements[oldIndex]);
        });

        this.mixteBuilder.tableau.elements = newElements;
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    // Questions for mixte
    addQuestionMixte() {
        this.mixteBuilder.questions.liste.push({
            question: '',
            reponse_attendue: ''
        });
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    removeQuestionMixte(index) {
        this.mixteBuilder.questions.liste.splice(index, 1);
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    renderMixteQuestions() {
        const container = document.getElementById('questionsListMixte');
        container.innerHTML = this.mixteBuilder.questions.liste.map((q, i) => `
            <div class="question-item-mixte">
                <div class="question-header">
                    <span class="question-label">Question ${i + 1}</span>
                    <button type="button" class="btn-icon" onclick="AdminBanquesExercices.removeQuestionMixte(${i})">×</button>
                </div>
                <div class="wysiwyg-container wysiwyg-mini">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Souligné"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">🎨</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" contenteditable="true"
                         data-index="${i}" data-field="question"
                         data-placeholder="Texte de la question..."
                         oninput="AdminBanquesExercices.updateMixteQuestion(${i}, 'question', this.innerHTML)">${q.question || ''}</div>
                </div>
                <div class="question-label" style="margin-top:0.5rem;">Réponse attendue (pour correction)</div>
                <div class="wysiwyg-container wysiwyg-mini">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Souligné"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">🎨</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" contenteditable="true"
                         data-index="${i}" data-field="reponse_attendue"
                         data-placeholder="Réponse modèle..."
                         oninput="AdminBanquesExercices.updateMixteQuestion(${i}, 'reponse_attendue', this.innerHTML)">${q.reponse_attendue || ''}</div>
                </div>
            </div>
        `).join('');
    },

    updateMixteQuestion(index, field, value) {
        this.mixteBuilder.questions.liste[index][field] = value;
        this.updateMixtePreview();
    },

    // Convert various Google URLs to embeddable format
    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

        // Google Drive file: /file/d/ID/view
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveFileMatch) {
            const fileId = driveFileMatch[1];
            return {
                type: 'drive_file',
                id: fileId,
                imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
                iframeUrl: `https://drive.google.com/file/d/${fileId}/preview`
            };
        }

        // Google Docs: /document/d/ID/
        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            const docId = docsMatch[1];
            return {
                type: 'google_doc',
                id: docId,
                iframeUrl: `https://docs.google.com/document/d/${docId}/preview`
            };
        }

        // Google Sheets: /spreadsheets/d/ID/
        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            const sheetId = sheetsMatch[1];
            return {
                type: 'google_sheet',
                id: sheetId,
                iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/preview`
            };
        }

        // Google Slides: /presentation/d/ID/
        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            const slideId = slidesMatch[1];
            return {
                type: 'google_slide',
                id: slideId,
                iframeUrl: `https://docs.google.com/presentation/d/${slideId}/embed`
            };
        }

        // Regular URL - assume image
        return {
            type: 'direct_url',
            url: url,
            imageUrl: url
        };
    },

    updateMixtePreview() {
        const preview = document.getElementById('mixtePreviewContent');
        if (!this.mixteBuilder) return;

        const layout = this.mixteBuilder.layout || 'vertical';

        // Get active sections in order
        const activeSections = this.mixteBuilder.sectionOrder.filter(s => this.mixteBuilder[s]?.actif);

        if (activeSections.length === 0) {
            preview.innerHTML = '<div class="preview-placeholder">Activez des sections pour voir l\'aperçu</div>';
            return;
        }

        let html = '';

        if (layout === 'horizontal' && activeSections.includes('document')) {
            // Horizontal layout: document on left, rest on right
            const docHTML = this.renderMixteDocumentPreview();
            const otherSections = activeSections.filter(s => s !== 'document');
            let rightHTML = '';
            otherSections.forEach(section => {
                if (section === 'tableau') {
                    rightHTML += this.renderMixteTableauPreview();
                } else if (section === 'questions') {
                    rightHTML += this.renderMixteQuestionsPreview();
                }
            });

            if (rightHTML) {
                html = `<div class="preview-horizontal-layout">
                    <div class="preview-left">${docHTML}</div>
                    <div class="preview-right">${rightHTML}</div>
                </div>`;
            } else {
                html = docHTML;
            }
        } else {
            // Vertical layout
            activeSections.forEach(section => {
                if (section === 'document') {
                    html += this.renderMixteDocumentPreview();
                } else if (section === 'tableau') {
                    html += this.renderMixteTableauPreview();
                } else if (section === 'questions') {
                    html += this.renderMixteQuestionsPreview();
                }
            });
        }

        preview.innerHTML = html;
    },

    renderMixteDocumentPreview() {
        const doc = this.mixteBuilder.document;
        const url = document.getElementById('docUrlMixte').value;
        const titre = document.getElementById('docTitreMixte').value;
        const legende = document.getElementById('docLegendeMixte').value;

        // Parse legende for italics (*text*)
        const legendeHTML = legende.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        const converted = this.convertGoogleUrl(url);
        let contentHTML = '';

        if (!url) {
            contentHTML = '<div style="color:#999;font-style:italic;">Entrez une URL de document</div>';
        } else if (converted.type === 'drive_file') {
            // Try as image first, with iframe fallback
            contentHTML = `<img src="${converted.imageUrl}" alt="Document"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
        } else if (converted.iframeUrl) {
            contentHTML = `<iframe src="${converted.iframeUrl}"></iframe>`;
        } else {
            contentHTML = `<img src="${converted.imageUrl || url}" alt="Document"
                onerror="this.outerHTML='<div style=\\'color:#ef4444;\\'>Impossible de charger l\\'image</div>'">`;
        }

        return `
            <div class="preview-document">
                ${titre ? `<div class="preview-doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="preview-doc-content">${contentHTML}</div>
                ${legende ? `<div class="preview-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    renderMixteTableauPreview() {
        const titre = document.getElementById('tableauTitreMixte').value;
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            return '<div class="preview-tableau"><div class="preview-tableau-header">Tableau</div><div style="padding:1rem;color:#999;">Ajoutez des sections et des lignes</div></div>';
        }

        let contentHTML = elements.map(el => {
            if (el.type === 'section') {
                return `<div class="preview-tableau-section">${this.escapeHtml(el.text) || 'Section...'}</div>`;
            } else {
                // Show empty input like student will see, with answer in tooltip
                const reponse = el.reponse || '';
                const label = el.label || 'Label...';
                return `
                    <div class="preview-tableau-row">
                        <div class="row-label">${this.escapeHtml(label)}</div>
                        <div class="row-input-preview" title="Réponse attendue: ${this.escapeHtml(reponse)}">
                            <input type="text" disabled placeholder="Champ élève" class="preview-input">
                            ${reponse ? `<span class="answer-hint">✓ ${this.escapeHtml(reponse)}</span>` : '<span class="answer-missing">⚠ Réponse manquante</span>'}
                        </div>
                    </div>
                `;
            }
        }).join('');

        return `
            <div class="preview-tableau">
                <div class="preview-tableau-header">${this.escapeHtml(titre) || 'À COMPLÉTER'}</div>
                ${contentHTML}
            </div>
        `;
    },

    renderMixteQuestionsPreview() {
        const questions = this.mixteBuilder.questions.liste;

        if (questions.length === 0) {
            return '<div class="preview-questions"><div class="preview-questions-header">Questions</div><div style="padding:1rem;color:#999;">Ajoutez des questions</div></div>';
        }

        return `
            <div class="preview-questions">
                <div class="preview-questions-header">Questions ouvertes</div>
                ${questions.map((q, i) => `
                    <div class="preview-question-item">
                        <div class="preview-question-text">${i + 1}. ${this.escapeHtml(q.question) || 'Question...'}</div>
                        <div class="preview-question-answer">Zone de réponse élève</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    buildDataFromDocumentMixte() {
        // Ensure mixteBuilder is initialized
        if (!this.mixteBuilder) {
            this.initDocumentMixteBuilder();
        }

        // Ensure all nested objects exist
        if (!this.mixteBuilder.document) {
            this.mixteBuilder.document = { actif: false, type: 'url', url: '', texte: '', titre: '', legende: '' };
        }
        if (!this.mixteBuilder.tableau) {
            this.mixteBuilder.tableau = { actif: false, titre: '', elements: [] };
        }
        if (!this.mixteBuilder.tableau.elements) {
            this.mixteBuilder.tableau.elements = [];
        }
        if (!this.mixteBuilder.questions) {
            this.mixteBuilder.questions = { actif: false, liste: [] };
        }
        if (!this.mixteBuilder.questions.liste) {
            this.mixteBuilder.questions.liste = [];
        }

        // Read current values from DOM
        const docUrlEl = document.getElementById('docUrlMixte');
        const docTexteEl = document.getElementById('docTexteMixte');
        const docTitreEl = document.getElementById('docTitreMixte');
        const docLegendeEl = document.getElementById('docLegendeMixte');
        const tableauTitreEl = document.getElementById('tableauTitreMixte');
        const layoutEl = document.getElementById('mixteLayoutSelect');

        // Get document type from radio buttons
        const docTypeRadio = document.querySelector('input[name="docType"]:checked');
        if (docTypeRadio) this.mixteBuilder.document.type = docTypeRadio.value;

        if (docUrlEl) this.mixteBuilder.document.url = docUrlEl.value;
        if (docTexteEl) this.mixteBuilder.document.texte = docTexteEl.innerHTML;
        if (docTitreEl) this.mixteBuilder.document.titre = docTitreEl.value;
        if (docLegendeEl) this.mixteBuilder.document.legende = docLegendeEl.value;
        if (tableauTitreEl) this.mixteBuilder.tableau.titre = tableauTitreEl.value;
        if (layoutEl) this.mixteBuilder.layout = layoutEl.value;

        return {
            document: {
                ...this.mixteBuilder.document,
                type: this.mixteBuilder.document.type || 'url'
            },
            tableau: { ...this.mixteBuilder.tableau, elements: this.mixteBuilder.tableau.elements || [] },
            questions: { ...this.mixteBuilder.questions, liste: this.mixteBuilder.questions.liste || [] },
            sectionOrder: this.mixteBuilder.sectionOrder || ['document', 'tableau', 'questions'],
            layout: this.mixteBuilder.layout || 'vertical'
        };
    },

    // ========== NOUVEAU SYSTÈME CONNAISSANCES ==========

    // Noms des formats de questions
    questionTypeNames: {
        'qcm': 'QCM',
        'vrai_faux': 'Vrai/Faux',
        'chronologie': 'Chronologie',
        'timeline': 'Timeline',
        'association': 'Association',
        'texte_trou': 'Texte à trous',
        'ordre': 'Mise en ordre'
    },

    /**
     * Vue principale de l'onglet Connaissances
     * Affiche un toggle pour switcher entre Entraînements et Banques de questions
     */
    renderConnaissancesView(container, emptyState) {
        emptyState.style.display = 'none';

        // Sous-vue par défaut : entrainements
        if (!this.connaissancesSubView) {
            this.connaissancesSubView = 'entrainements';
        }

        const entrainementsCount = this.banquesExercicesConn.length;
        const questionsCount = this.banquesQuestions.length;

        container.innerHTML = `
            <div class="conn-toggle-container">
                <div class="conn-toggle">
                    <button class="conn-toggle-btn ${this.connaissancesSubView === 'entrainements' ? 'active' : ''}"
                            onclick="AdminBanquesExercices.switchConnaissancesView('entrainements')">
                        Banques d'exercices
                        <span class="conn-toggle-count">${entrainementsCount}</span>
                    </button>
                    <button class="conn-toggle-btn ${this.connaissancesSubView === 'questions' ? 'active' : ''}"
                            onclick="AdminBanquesExercices.switchConnaissancesView('questions')">
                        Banques de questions
                        <span class="conn-toggle-count">${questionsCount}</span>
                    </button>
                </div>
            </div>

            <div class="banques-list" id="connaissancesContent">
                ${this.connaissancesSubView === 'entrainements' ?
                    this.renderEntrainementsAccordions() :
                    this.renderBanquesQuestionsAccordions()}
            </div>
        `;
    },

    /**
     * Switch entre les sous-vues de Connaissances
     */
    switchConnaissancesView(subView) {
        this.connaissancesSubView = subView;
        this.renderBanques();
    },

    /**
     * Accordéons des banques d'exercices (Entraînements)
     */
    renderEntrainementsAccordions() {
        if (this.banquesExercicesConn.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <h3>Aucune banque d'exercices</h3>
                    <p>Créez votre première banque pour organiser vos entraînements</p>
                    <button class="btn btn-primary" onclick="AdminBanquesExercices.addBanqueExercicesConn()">
                        + Nouvelle banque d'exercices
                    </button>
                </div>
            `;
        }

        return this.banquesExercicesConn.map(banque => {
            const entrainements = this.entrainementsConn.filter(e => e.banque_exercice_id === banque.id);
            const publies = entrainements.filter(e => e.statut === 'publie').length;

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon connaissances">📚</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                                ${banque.type === 'revision' ? '<span class="status-badge" style="background:#fef3c7;color:#d97706;margin-left:8px;">Révision</span>' : ''}
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${entrainements.length}</div>
                                <div class="banque-stat-label">entraînement${entrainements.length > 1 ? 's' : ''}</div>
                            </div>
                            <div class="banque-stat">
                                <div class="banque-stat-value">${publies}</div>
                                <div class="banque-stat-label">publié${publies > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon success" onclick="event.stopPropagation(); AdminBanquesExercices.addEntrainementConn('${banque.id}')" title="Ajouter un entraînement">➕</button>
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueExercicesConn('${banque.id}')" title="Modifier la banque">✏️</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueExercicesConn('${banque.id}')" title="Supprimer">🗑️</button>
                        </div>
                        <div class="banque-card-toggle">▼</div>
                    </div>
                    <div class="banque-exercices">
                        ${this.renderEntrainementsList(entrainements, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Liste des entraînements dans une banque (style Savoir-faire)
     */
    renderEntrainementsList(entrainements, banqueId) {
        if (entrainements.length === 0) {
            return '<div class="exercices-empty">Aucun entraînement. Cliquez sur ➕ pour en ajouter.</div>';
        }

        return `
            <div class="exercices-list">
                ${entrainements.map((entr, index) => {
                    return `
                        <div class="exercice-item" data-id="${entr.id}" onclick="AdminBanquesExercices.openEntrainementWizard(AdminBanquesExercices.entrainementsConn.find(e => e.id === '${entr.id}'), '${banqueId}')" style="cursor:pointer;">
                            <div class="exercice-numero">${index + 1}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(entr.titre || 'Sans titre')}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editEntrainementConnModal('${entr.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteEntrainementConn('${entr.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Accordéons des banques de questions
     */
    renderBanquesQuestionsAccordions() {
        if (this.banquesQuestions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Aucune banque de questions</h3>
                    <p>Créez votre première banque pour stocker vos questions</p>
                    <button class="btn btn-primary" onclick="AdminBanquesExercices.addBanqueQuestions()">
                        + Nouvelle banque de questions
                    </button>
                </div>
            `;
        }

        return this.banquesQuestions.map(banque => {
            const questions = this.questionsConnaissances.filter(q => q.banque_id === banque.id);
            const typesCounts = {};
            questions.forEach(q => {
                typesCounts[q.type] = (typesCounts[q.type] || 0) + 1;
            });

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon connaissances">📋</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${questions.length}</div>
                                <div class="banque-stat-label">question${questions.length > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueQuestions('${banque.id}')" title="Modifier la banque">✏️</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueQuestions('${banque.id}')" title="Supprimer">🗑️</button>
                        </div>
                        <div class="banque-card-toggle">▼</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Questions</h4>
                            <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addQuestionConnaissances('${banque.id}')">
                                + Ajouter une question
                            </button>
                        </div>
                        ${this.renderQuestionsListAccordion(questions, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Liste des questions dans un accordéon
     */
    renderQuestionsListAccordion(questions, banqueId) {
        if (questions.length === 0) {
            return '<div class="exercices-empty">Aucune question. Cliquez sur "+ Ajouter une question" pour commencer.</div>';
        }

        return `
            <div class="exercices-list">
                ${questions.map((q, index) => {
                    const typeName = this.questionTypeNames[q.type] || q.type;
                    const preview = this.getQuestionPreview(q);

                    return `
                        <div class="exercice-item" data-id="${q.id}">
                            <div class="exercice-numero" style="background:var(--accent-blue-light);color:var(--accent-blue);font-size:11px;">${typeName.substring(0, 3).toUpperCase()}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(preview)}</div>
                                <div class="exercice-meta">${typeName}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editQuestionConnaissances('${q.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteQuestionConnaissances('${q.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Ajouter un nouvel entraînement à une banque
     */
    addEntrainementConn(banqueId) {
        this.openEntrainementWizard(null, banqueId);
    },

    /**
     * Modifier un entraînement existant (ouvre le wizard)
     */
    editEntrainementConnModal(entrainementId) {
        const entr = this.entrainementsConn.find(e => e.id === entrainementId);
        if (!entr) return;
        this.openEntrainementWizard(entr, entr.banque_exercice_id);
    },

    // ========== WIZARD ENTRAÎNEMENT 4 ÉTAPES ==========

    wizardData: {
        entrainement: null,
        banqueId: null,
        currentStep: 1,
        etapes: [], // Les étapes ajoutées dans le wizard
        isEditing: false
    },

    /**
     * Ouvre le wizard pour créer/modifier un entraînement
     */
    openEntrainementWizard(entrainement = null, banqueId = null) {
        this.wizardData = {
            entrainement: entrainement,
            banqueId: banqueId,
            currentStep: 1,
            etapes: entrainement ? this.etapesConn.filter(e => e.entrainement_id === entrainement.id) : [],
            isEditing: !!entrainement
        };

        // Créer le modal wizard
        let modal = document.getElementById('entrainementWizardModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'entrainementWizardModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-wizard">
                <div class="wizard-header">
                    <div class="wizard-title">
                        <h2>${entrainement ? '✏️ Modifier l\'entraînement' : '➕ Nouvel entraînement'}</h2>
                        <span class="wizard-subtitle">Connaissances • ${entrainement ? entrainement.titre : 'Créez une série d\'exercices'}</span>
                    </div>
                    <div class="wizard-steps">
                        <button class="wizard-step active" data-step="1" onclick="AdminBanquesExercices.goToWizardStep(1)">
                            <span class="step-number">1</span>
                            <span class="step-label">Paramètres</span>
                        </button>
                        <button class="wizard-step" data-step="2" onclick="AdminBanquesExercices.goToWizardStep(2)">
                            <span class="step-number">2</span>
                            <span class="step-label">Étapes</span>
                        </button>
                        <button class="wizard-step" data-step="3" onclick="AdminBanquesExercices.goToWizardStep(3)">
                            <span class="step-number">3</span>
                            <span class="step-label">Questions</span>
                        </button>
                        <button class="wizard-step" data-step="4" onclick="AdminBanquesExercices.goToWizardStep(4)">
                            <span class="step-number">4</span>
                            <span class="step-label">Validation</span>
                        </button>
                    </div>
                    <button class="modal-close" onclick="AdminBanquesExercices.closeEntrainementWizard()">&times;</button>
                </div>
                <div class="wizard-body" id="wizardContent">
                    <!-- Contenu dynamique -->
                </div>
                <div class="wizard-footer">
                    <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeEntrainementWizard()">Annuler</button>
                    <div class="wizard-nav">
                        <button class="btn btn-secondary" id="wizardPrevBtn" onclick="AdminBanquesExercices.wizardPrevStep()" style="display:none;">
                            ← Précédent
                        </button>
                        <button class="btn btn-primary" id="wizardNextBtn" onclick="AdminBanquesExercices.wizardNextStep()">
                            Suivant →
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        this.renderWizardStep(1);
    },

    closeEntrainementWizard() {
        const modal = document.getElementById('entrainementWizardModal');
        if (modal) modal.remove();
        this.wizardData = { entrainement: null, banqueId: null, currentStep: 1, etapes: [], isEditing: false };
    },

    goToWizardStep(step) {
        // Validation avant de changer d'étape
        if (step > this.wizardData.currentStep) {
            if (!this.validateWizardStep(this.wizardData.currentStep)) return;
        }
        this.wizardData.currentStep = step;
        this.renderWizardStep(step);
    },

    wizardPrevStep() {
        if (this.wizardData.currentStep > 1) {
            this.wizardData.currentStep--;
            this.renderWizardStep(this.wizardData.currentStep);
        }
    },

    async wizardNextStep() {
        if (!this.validateWizardStep(this.wizardData.currentStep)) return;

        // Sauvegarder les données de l'étape actuelle
        await this.saveWizardStepData(this.wizardData.currentStep);

        if (this.wizardData.currentStep < 4) {
            this.wizardData.currentStep++;
            this.renderWizardStep(this.wizardData.currentStep);
        } else {
            // Étape finale - Publier
            await this.finalizeEntrainement();
        }
    },

    validateWizardStep(step) {
        switch(step) {
            case 1:
                const titre = document.getElementById('wizardTitre')?.value.trim();
                if (!titre) {
                    alert('Le titre est requis');
                    return false;
                }
                return true;
            case 2:
                if (this.wizardData.etapes.length === 0) {
                    alert('Ajoutez au moins une étape');
                    return false;
                }
                return true;
            case 3:
                // Vérifier que chaque étape a des questions configurées
                return true;
            case 4:
                return true;
            default:
                return true;
        }
    },

    async saveWizardStepData(step) {
        switch(step) {
            case 1:
                // Récupérer les données du formulaire
                const formData = {
                    titre: document.getElementById('wizardTitre').value.trim(),
                    description: document.getElementById('wizardDescription').value.trim(),
                    duree: parseInt(document.getElementById('wizardDuree').value) || 15,
                    seuil: parseInt(document.getElementById('wizardSeuil').value) || 80,
                    statut: document.getElementById('wizardStatut').value,
                    banque_exercice_id: this.wizardData.banqueId
                };

                if (this.wizardData.entrainement) {
                    // Mise à jour
                    formData.id = this.wizardData.entrainement.id;
                    const result = await this.callAPI('updateEntrainementConn', formData);
                    if (result.success) {
                        Object.assign(this.wizardData.entrainement, formData);
                    }
                } else {
                    // Création
                    const result = await this.callAPI('createEntrainementConn', formData);
                    if (result.success) {
                        await this.loadDataFromAPI();
                        this.wizardData.entrainement = this.entrainementsConn.find(e => e.id === result.id);
                        this.wizardData.isEditing = true;
                    }
                }
                break;
            case 2:
                // Les étapes sont sauvegardées au fur et à mesure
                break;
            case 3:
                // Les questions sont sauvegardées au fur et à mesure
                break;
        }
    },

    renderWizardStep(step) {
        const content = document.getElementById('wizardContent');
        const prevBtn = document.getElementById('wizardPrevBtn');
        const nextBtn = document.getElementById('wizardNextBtn');

        // Mettre à jour les indicateurs d'étapes
        document.querySelectorAll('.wizard-step').forEach((el, i) => {
            el.classList.toggle('active', i + 1 === step);
            el.classList.toggle('completed', i + 1 < step);
        });

        // Mettre à jour les boutons de navigation
        prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        nextBtn.textContent = step === 4 ? '✓ Valider et fermer' : 'Suivant →';

        switch(step) {
            case 1:
                content.innerHTML = this.renderWizardStep1();
                break;
            case 2:
                content.innerHTML = this.renderWizardStep2();
                this.initWizardStep2();
                break;
            case 3:
                content.innerHTML = this.renderWizardStep3();
                break;
            case 4:
                content.innerHTML = this.renderWizardStep4();
                break;
        }
    },

    // ===== ÉTAPE 1: PARAMÈTRES =====
    renderWizardStep1() {
        const e = this.wizardData.entrainement || {};
        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">⚙️</span>
                    <div>
                        <h3>Paramètres généraux</h3>
                        <p>Définissez les informations de base de l'entraînement</p>
                    </div>
                </div>
                <div class="wizard-form">
                    <div class="form-group">
                        <label>Titre de l'entraînement <span class="req">*</span></label>
                        <input type="text" class="form-input" id="wizardTitre" value="${this.escapeHtml(e.titre || '')}" placeholder="Ex: Les grandes découvertes">
                    </div>
                    <div class="form-group">
                        <label>Description <span class="optional">(optionnel)</span></label>
                        <textarea class="form-textarea" id="wizardDescription" rows="2" placeholder="Description de l'entraînement...">${this.escapeHtml(e.description || '')}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Durée (minutes)</label>
                            <input type="number" class="form-input" id="wizardDuree" value="${e.duree || 15}" min="5" max="120">
                        </div>
                        <div class="form-group">
                            <label>Seuil de réussite (%)</label>
                            <input type="number" class="form-input" id="wizardSeuil" value="${e.seuil || 80}" min="50" max="100">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Statut</label>
                        <select class="form-select" id="wizardStatut">
                            <option value="brouillon" ${e.statut !== 'publie' ? 'selected' : ''}>Brouillon</option>
                            <option value="publie" ${e.statut === 'publie' ? 'selected' : ''}>Publié</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    // ===== ÉTAPE 2: ÉTAPES (FORMATS) =====
    renderWizardStep2() {
        const formats = this.formatsQuestions || [];
        const etapes = this.wizardData.etapes || [];

        return `
            <div class="wizard-step-content wizard-step2">
                <div class="step-header">
                    <span class="step-icon">📝</span>
                    <div>
                        <h3>Étapes de l'entraînement</h3>
                        <p>Ajoutez et ordonnez les types d'exercices</p>
                    </div>
                </div>
                <div class="wizard-two-columns">
                    <div class="wizard-col-left">
                        <div class="etapes-list-header">
                            <h4>Exercices de la série <span class="badge">${etapes.length}</span></h4>
                            <span class="hint">Glissez pour réordonner</span>
                        </div>
                        <div class="etapes-list" id="wizardEtapesList">
                            ${etapes.length === 0 ?
                                '<div class="etapes-empty">Aucune étape. Sélectionnez un format à droite pour ajouter une étape.</div>' :
                                etapes.map((etape, index) => this.renderWizardEtapeItem(etape, index)).join('')
                            }
                        </div>
                    </div>
                    <div class="wizard-col-right">
                        <h4>➕ Ajouter un exercice</h4>
                        <div class="format-section">
                            <label class="section-label">1. CHOISIR LE FORMAT</label>
                            <div class="format-grid">
                                ${formats.map(f => `
                                    <button class="format-card" onclick="AdminBanquesExercices.addWizardEtape('${f.code}')">
                                        <span class="format-icon">${f.icone || '📋'}</span>
                                        <span class="format-name">${f.nom}</span>
                                        <span class="format-count">${this.countQuestionsForFormat(f.code)} disponibles</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderWizardEtapeItem(etape, index) {
        const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
        const questionsCount = etape.questions ? etape.questions.length :
            (this.etapeQuestionsConn ? this.etapeQuestionsConn.filter(eq => eq.etape_id === etape.id).length : 0);

        return `
            <div class="wizard-etape-item" data-id="${etape.id || 'temp-' + index}" draggable="true">
                <div class="etape-drag-handle">☰</div>
                <div class="etape-number">${index + 1}</div>
                <div class="etape-format-icon">${format.icone || '📋'}</div>
                <div class="etape-info">
                    <div class="etape-format-name">${format.nom || etape.format_code}</div>
                    <div class="etape-meta">
                        ${questionsCount} question${questionsCount > 1 ? 's' : ''}
                        <span class="etape-mode ${etape.mode_selection}">${etape.mode_selection === 'aleatoire' ? '🎲 Aléatoire' : '✋ Manuel'}</span>
                    </div>
                </div>
                <div class="etape-actions">
                    <button class="btn-icon" onclick="AdminBanquesExercices.moveWizardEtape(${index}, -1)" title="Monter">↑</button>
                    <button class="btn-icon" onclick="AdminBanquesExercices.moveWizardEtape(${index}, 1)" title="Descendre">↓</button>
                    <button class="btn-icon danger" onclick="AdminBanquesExercices.removeWizardEtape(${index})" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    initWizardStep2() {
        // Initialiser le drag & drop pour réordonner les étapes
        const list = document.getElementById('wizardEtapesList');
        if (!list) return;

        let draggedItem = null;

        list.querySelectorAll('.wizard-etape-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedItem, item);
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    },

    countQuestionsForFormat(formatCode) {
        // Mapping des codes pour compatibilité (chronologie inclut timeline)
        const codesToMatch = [formatCode];
        if (formatCode === 'chronologie') {
            codesToMatch.push('timeline', 'frise');
        }
        return this.questionsConnaissances.filter(q => codesToMatch.includes(q.type)).length;
    },

    // Filtre les questions disponibles pour un format donné
    getQuestionsForFormat(formatCode) {
        const codesToMatch = [formatCode];
        if (formatCode === 'chronologie') {
            codesToMatch.push('timeline', 'frise');
        }
        return this.questionsConnaissances.filter(q => codesToMatch.includes(q.type));
    },

    async addWizardEtape(formatCode) {
        if (!this.wizardData.entrainement) {
            // D'abord sauvegarder l'entraînement
            if (!this.validateWizardStep(1)) return;
            await this.saveWizardStepData(1);
        }

        const format = this.formatsQuestions.find(f => f.code === formatCode);
        const ordre = this.wizardData.etapes.length + 1;

        try {
            const result = await this.callAPI('createEtapeConn', {
                entrainement_id: this.wizardData.entrainement.id,
                format_code: formatCode,
                ordre: ordre,
                mode_selection: 'manuel',
                nb_questions: 5
            });

            if (result.success) {
                await this.loadDataFromAPI();
                this.wizardData.etapes = this.etapesConn.filter(e => e.entrainement_id === this.wizardData.entrainement.id);
                this.renderWizardStep(2);
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur ajout étape:', error);
        }
    },

    async removeWizardEtape(index) {
        const etape = this.wizardData.etapes[index];
        if (!etape || !etape.id) return;

        if (!confirm('Supprimer cette étape ?')) return;

        try {
            const result = await this.callAPI('deleteEtapeConn', { id: etape.id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.wizardData.etapes = this.etapesConn.filter(e => e.entrainement_id === this.wizardData.entrainement.id);
                this.renderWizardStep(2);
            }
        } catch (error) {
            console.error('Erreur suppression étape:', error);
        }
    },

    async moveWizardEtape(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.wizardData.etapes.length) return;

        // Échanger les positions
        const etapes = [...this.wizardData.etapes];
        [etapes[index], etapes[newIndex]] = [etapes[newIndex], etapes[index]];

        // Mettre à jour l'ordre dans la base
        try {
            for (let i = 0; i < etapes.length; i++) {
                await this.callAPI('updateEtapeConn', { id: etapes[i].id, ordre: i + 1 });
            }
            await this.loadDataFromAPI();
            this.wizardData.etapes = this.etapesConn.filter(e => e.entrainement_id === this.wizardData.entrainement.id);
            this.renderWizardStep(2);
        } catch (error) {
            console.error('Erreur réordonnancement:', error);
        }
    },

    // ===== ÉTAPE 3: QUESTIONS =====
    renderWizardStep3() {
        const etapes = this.wizardData.etapes || [];

        if (etapes.length === 0) {
            return `
                <div class="wizard-step-content">
                    <div class="step-header">
                        <span class="step-icon">❓</span>
                        <div>
                            <h3>Configuration des questions</h3>
                            <p>Aucune étape à configurer. Retournez à l'étape précédente pour ajouter des étapes.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">❓</span>
                    <div>
                        <h3>Configuration des questions</h3>
                        <p>Pour chaque étape, configurez le mode de sélection et les questions</p>
                    </div>
                </div>
                <div class="wizard-questions-list">
                    ${etapes.map((etape, index) => this.renderWizardEtapeQuestions(etape, index)).join('')}
                </div>
            </div>
        `;
    },

    renderWizardEtapeQuestions(etape, index) {
        const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
        const etapeQuestions = this.etapeQuestionsConn ?
            this.etapeQuestionsConn.filter(eq => eq.etape_id === etape.id) : [];
        const selectedIds = etapeQuestions.map(eq => eq.question_id);
        const availableQuestions = this.getQuestionsForFormat(etape.format_code);

        // Récupérer les banques qui contiennent des questions de ce format
        const banquesAvecQuestions = [...new Set(availableQuestions.map(q => q.banque_id))];
        const banquesOptions = banquesAvecQuestions.map(bId => {
            const banque = this.banquesQuestions.find(b => b.id === bId);
            return banque ? `<option value="${bId}">${this.escapeHtml(banque.titre)}</option>` : '';
        }).join('');

        // Panel ouvert par défaut
        const isOpen = true;

        return `
            <div class="wizard-etape-questions" data-etape-id="${etape.id}">
                <div class="etape-questions-header" onclick="AdminBanquesExercices.toggleEtapeQuestionsPanel(${index})">
                    <div class="etape-header-left">
                        <span class="etape-number">${index + 1}</span>
                        <span class="etape-format-icon">${format.icone || '📋'}</span>
                        <span class="etape-format-name">${format.nom || etape.format_code}</span>
                    </div>
                    <div class="etape-header-right">
                        <span class="questions-count ${selectedIds.length === 0 ? 'warning' : ''}">${selectedIds.length} / ${availableQuestions.length} question${selectedIds.length > 1 ? 's' : ''}</span>
                        <span class="toggle-icon">${isOpen ? '▲' : '▼'}</span>
                    </div>
                </div>
                <div class="etape-questions-panel" id="etapePanel${index}" style="display: ${isOpen ? 'block' : 'none'};">
                    <div class="mode-selection">
                        <label class="section-label">Mode de sélection</label>
                        <div class="mode-options">
                            <label class="mode-option ${etape.mode_selection === 'aleatoire' ? 'selected' : ''}" onclick="AdminBanquesExercices.setEtapeMode('${etape.id}', 'aleatoire')">
                                <span class="mode-icon">🎲</span>
                                <span class="mode-label">Aléatoire</span>
                                <span class="mode-desc">Tirage au sort</span>
                            </label>
                            <label class="mode-option ${etape.mode_selection !== 'aleatoire' ? 'selected' : ''}" onclick="AdminBanquesExercices.setEtapeMode('${etape.id}', 'manuel')">
                                <span class="mode-icon">✋</span>
                                <span class="mode-label">Manuel</span>
                                <span class="mode-desc">Je choisis</span>
                            </label>
                        </div>
                    </div>
                    <div class="random-config" id="randomConfig${index}" style="display: ${etape.mode_selection === 'aleatoire' ? 'block' : 'none'};">
                        <div class="form-row">
                            <label>Nombre de questions :</label>
                            <input type="number" class="form-input" value="${parseInt(etape.nb_questions) || 5}" min="1" max="${Math.max(availableQuestions.length, 1)}"
                                onchange="AdminBanquesExercices.setEtapeNbQuestions('${etape.id}', this.value)">
                            <span class="hint">/ ${availableQuestions.length} disponibles</span>
                        </div>
                    </div>
                    <div class="manual-selection" id="manualSelection${index}" style="display: ${etape.mode_selection !== 'aleatoire' ? 'block' : 'none'};">
                        <div class="questions-filter">
                            <label class="section-label">Sélectionner les questions (${availableQuestions.length} disponibles)</label>
                            ${banquesAvecQuestions.length > 1 ? `
                                <select class="form-select form-select-sm" onchange="AdminBanquesExercices.filterWizardQuestions(${index}, this.value)">
                                    <option value="">Toutes les banques</option>
                                    ${banquesOptions}
                                </select>
                            ` : ''}
                        </div>
                        <div class="questions-checklist" id="questionsChecklist${index}">
                            ${this.renderQuestionsChecklist(availableQuestions, selectedIds, etape.id)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderQuestionsChecklist(questions, selectedIds, etapeId) {
        if (questions.length === 0) {
            return '<p class="no-questions">Aucune question disponible pour ce format. Créez des questions dans "Banques de questions".</p>';
        }

        return questions.map(q => {
            const banque = this.banquesQuestions.find(b => b.id === q.banque_id);
            const banqueNom = banque ? banque.titre : 'Sans banque';
            const questionText = q.question || q.titre || q.contenu || 'Question sans titre';

            return `
                <label class="question-checkbox ${selectedIds.includes(q.id) ? 'selected' : ''}" data-banque="${q.banque_id}">
                    <input type="checkbox" ${selectedIds.includes(q.id) ? 'checked' : ''}
                        onchange="AdminBanquesExercices.toggleEtapeQuestion('${etapeId}', '${q.id}', this.checked)">
                    <div class="question-content">
                        <span class="question-text">${this.escapeHtml(questionText.substring(0, 80))}${questionText.length > 80 ? '...' : ''}</span>
                        <span class="question-meta">📚 ${this.escapeHtml(banqueNom)}</span>
                    </div>
                </label>
            `;
        }).join('');
    },

    filterWizardQuestions(index, banqueId) {
        const checklist = document.getElementById(`questionsChecklist${index}`);
        const items = checklist.querySelectorAll('.question-checkbox');

        items.forEach(item => {
            if (!banqueId || item.dataset.banque === banqueId) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    toggleEtapeQuestionsPanel(index) {
        const panel = document.getElementById(`etapePanel${index}`);
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';

        // Toggle icon
        const header = panel.previousElementSibling;
        const icon = header.querySelector('.toggle-icon');
        if (icon) icon.textContent = isOpen ? '▼' : '▲';
    },

    async setEtapeMode(etapeId, mode) {
        try {
            await this.callAPI('updateEtapeConn', { id: etapeId, mode_selection: mode });
            await this.loadDataFromAPI();
            this.wizardData.etapes = this.etapesConn.filter(e => e.entrainement_id === this.wizardData.entrainement.id);
            this.renderWizardStep(3);
        } catch (error) {
            console.error('Erreur changement mode:', error);
        }
    },

    async setEtapeNbQuestions(etapeId, nb) {
        try {
            await this.callAPI('updateEtapeConn', { id: etapeId, nb_questions: parseInt(nb) });
        } catch (error) {
            console.error('Erreur mise à jour nb questions:', error);
        }
    },

    async toggleEtapeQuestion(etapeId, questionId, isChecked) {
        try {
            if (isChecked) {
                await this.callAPI('addQuestionToEtape', { etape_id: etapeId, question_id: questionId });
            } else {
                await this.callAPI('removeQuestionFromEtape', { etape_id: etapeId, question_id: questionId });
            }
            await this.loadDataFromAPI();
            // Mettre à jour les données du wizard et le compteur
            this.wizardData.etapes = this.etapesConn.filter(e => e.entrainement_id === this.wizardData.entrainement.id);
            // Mettre à jour le compteur sans re-render complet
            const etapeEl = document.querySelector(`.wizard-etape-questions[data-etape-id="${etapeId}"]`);
            if (etapeEl) {
                const etape = this.wizardData.etapes.find(e => e.id === etapeId);
                const etapeQuestions = this.etapeQuestionsConn.filter(eq => eq.etape_id === etapeId);
                const availableQuestions = this.getQuestionsForFormat(etape?.format_code);
                const countEl = etapeEl.querySelector('.questions-count');
                if (countEl) {
                    countEl.textContent = `${etapeQuestions.length} / ${availableQuestions.length} question${etapeQuestions.length > 1 ? 's' : ''}`;
                    countEl.classList.toggle('warning', etapeQuestions.length === 0);
                }
                // Mettre à jour la classe selected sur la checkbox
                const checkbox = etapeEl.querySelector(`input[onchange*="${questionId}"]`);
                if (checkbox) {
                    checkbox.closest('.question-checkbox').classList.toggle('selected', isChecked);
                }
            }
        } catch (error) {
            console.error('Erreur toggle question:', error);
        }
    },

    // ===== ÉTAPE 4: VALIDATION =====
    renderWizardStep4() {
        const e = this.wizardData.entrainement || {};
        const etapes = this.wizardData.etapes || [];

        let totalQuestions = 0;
        etapes.forEach(etape => {
            if (etape.mode_selection === 'aleatoire') {
                totalQuestions += etape.nb_questions || 5;
            } else {
                const etapeQuestions = this.etapeQuestionsConn ?
                    this.etapeQuestionsConn.filter(eq => eq.etape_id === etape.id) : [];
                totalQuestions += etapeQuestions.length;
            }
        });

        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">✅</span>
                    <div>
                        <h3>Validation</h3>
                        <p>Vérifiez le résumé de votre entraînement avant de valider</p>
                    </div>
                </div>
                <div class="validation-summary">
                    <div class="summary-card">
                        <h4>📚 Informations générales</h4>
                        <div class="summary-row">
                            <span class="label">Titre :</span>
                            <span class="value">${this.escapeHtml(e.titre || 'Sans titre')}</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Description :</span>
                            <span class="value">${e.description ? this.escapeHtml(e.description) : '<em>Aucune</em>'}</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Durée :</span>
                            <span class="value">${e.duree || 15} minutes</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Seuil de réussite :</span>
                            <span class="value">${e.seuil || 80}%</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Statut :</span>
                            <span class="value status-badge ${e.statut === 'publie' ? 'published' : 'draft'}">${e.statut === 'publie' ? '✅ Publié' : '📝 Brouillon'}</span>
                        </div>
                    </div>

                    <div class="summary-card">
                        <h4>📝 Étapes (${etapes.length})</h4>
                        ${etapes.length === 0 ? '<p class="empty">Aucune étape</p>' : `
                            <div class="summary-etapes">
                                ${etapes.map((etape, index) => {
                                    const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
                                    const etapeQuestions = this.etapeQuestionsConn ?
                                        this.etapeQuestionsConn.filter(eq => eq.etape_id === etape.id) : [];
                                    const qCount = etape.mode_selection === 'aleatoire' ? etape.nb_questions : etapeQuestions.length;

                                    return `
                                        <div class="summary-etape">
                                            <span class="etape-num">${index + 1}</span>
                                            <span class="etape-icon">${format.icone || '📋'}</span>
                                            <span class="etape-name">${format.nom || etape.format_code}</span>
                                            <span class="etape-questions">${qCount} question${qCount > 1 ? 's' : ''}</span>
                                            <span class="etape-mode-badge ${etape.mode_selection}">${etape.mode_selection === 'aleatoire' ? '🎲' : '✋'}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>

                    <div class="summary-stats">
                        <div class="stat-box">
                            <span class="stat-value">${etapes.length}</span>
                            <span class="stat-label">Étapes</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-value">${totalQuestions}</span>
                            <span class="stat-label">Questions</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-value">${e.duree || 15}</span>
                            <span class="stat-label">Minutes</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async finalizeEntrainement() {
        // Fermer le wizard et rafraîchir l'affichage
        this.closeEntrainementWizard();
        await this.loadDataFromAPI();
        this.renderBanques();

        // Afficher un message de succès
        this.showNotification('Entraînement sauvegardé avec succès !', 'success');
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    },

    // Anciennes fonctions conservées pour compatibilité
    renderBanquesQuestionsCards() {
        // Redirige vers la nouvelle fonction
        return this.renderBanquesQuestionsAccordions();
    },

    renderBanquesExercicesConnCards() {
        if (this.banquesExercicesConn.length === 0) {
            return '<div class="conn-empty">Aucune banque d\'exercices. Créez-en une pour organiser vos entraînements.</div>';
        }

        return `<div class="conn-cards-grid">
            ${this.banquesExercicesConn.map(banque => {
                const entrainements = this.entrainementsConn.filter(e => e.banque_exercice_id === banque.id);
                const publies = entrainements.filter(e => e.statut === 'publie').length;
                const typeLabel = banque.type === 'revision' ? '📖 Révision' : '📝 Leçon';

                return `
                    <div class="conn-card" data-id="${banque.id}">
                        <div class="conn-card-header">
                            <h4 class="conn-card-title">${this.escapeHtml(banque.titre || 'Sans titre')}</h4>
                            <span class="conn-card-badge ${banque.type}">${typeLabel}</span>
                            <div class="conn-card-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.viewBanqueExercicesConn('${banque.id}')" title="Voir les entraînements">👁️</button>
                                <button class="btn-icon" onclick="AdminBanquesExercices.editBanqueExercicesConn('${banque.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteBanqueExercicesConn('${banque.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                        <div class="conn-card-body">
                            <div class="conn-card-stat">
                                <span class="conn-card-stat-value">${entrainements.length}</span>
                                <span class="conn-card-stat-label">entraînement${entrainements.length > 1 ? 's' : ''}</span>
                            </div>
                            <div class="conn-card-meta">${publies} publié${publies > 1 ? 's' : ''}</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>`;
    },

    /**
     * Affiche la liste des questions d'une banque
     */
    viewBanqueQuestions(banqueId) {
        const banque = this.banquesQuestions.find(b => b.id === banqueId);
        if (!banque) return;

        const questions = this.questionsConnaissances.filter(q => q.banque_id === banqueId);
        const container = document.getElementById('banquesList');

        container.innerHTML = `
            <div class="conn-detail-view">
                <div class="conn-detail-header">
                    <button class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.renderBanques()">
                        ← Retour
                    </button>
                    <h2>📋 ${this.escapeHtml(banque.titre)}</h2>
                    <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addQuestionConnaissances('${banqueId}')">
                        + Ajouter une question
                    </button>
                </div>
                <div class="conn-detail-content">
                    ${questions.length === 0 ?
                        '<div class="conn-empty">Aucune question dans cette banque</div>' :
                        this.renderQuestionsList(questions, banqueId)
                    }
                </div>
            </div>
        `;
    },

    /**
     * Liste des questions avec détails
     */
    renderQuestionsList(questions, banqueId) {
        return `
            <div class="questions-list">
                ${questions.map(q => {
                    const typeName = this.questionTypeNames[q.type] || q.type;
                    const preview = this.getQuestionPreview(q);

                    return `
                        <div class="question-item" data-id="${q.id}">
                            <div class="question-type-badge ${q.type}">${typeName}</div>
                            <div class="question-content">
                                <div class="question-preview">${this.escapeHtml(preview)}</div>
                            </div>
                            <div class="question-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editQuestionConnaissances('${q.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteQuestionConnaissances('${q.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Affiche la liste des entraînements d'une banque d'exercices
     */
    viewBanqueExercicesConn(banqueId) {
        const banque = this.banquesExercicesConn.find(b => b.id === banqueId);
        if (!banque) return;

        const entrainements = this.entrainementsConn.filter(e => e.banque_exercice_id === banqueId);
        const container = document.getElementById('banquesList');

        container.innerHTML = `
            <div class="conn-detail-view">
                <div class="conn-detail-header">
                    <button class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.renderBanques()">
                        ← Retour
                    </button>
                    <h2>📚 ${this.escapeHtml(banque.titre)}</h2>
                    <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addEntrainementConn('${banqueId}')">
                        + Nouvel entraînement
                    </button>
                </div>
                <div class="conn-detail-content">
                    ${entrainements.length === 0 ?
                        '<div class="conn-empty">Aucun entraînement dans cette banque</div>' :
                        this.renderEntrainementsList(entrainements, banqueId)
                    }
                </div>
            </div>
        `;
    },

    // ========== CRUD BANQUES D'EXERCICES CONN ==========

    addBanqueExercicesConn() {
        this.openBanqueExercicesConnModal();
    },

    editBanqueExercicesConn(id) {
        const banque = this.banquesExercicesConn.find(b => b.id === id);
        if (!banque) return;
        this.openBanqueExercicesConnModal(banque);
    },

    openBanqueExercicesConnModal(banque = null) {
        // Créer le modal dynamiquement s'il n'existe pas
        let modal = document.getElementById('banqueExercicesConnModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'banqueExercicesConnModal';
            modal.className = 'modal-overlay hidden';
            modal.innerHTML = `
                <div class="modal modal-medium">
                    <div class="modal-header">
                        <h2 id="banqueExConnModalTitle">Nouvelle banque d'exercices</h2>
                        <button class="modal-close" onclick="AdminBanquesExercices.closeBanqueExercicesConnModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="editBanqueExConnId">
                        <div class="form-group">
                            <label>Titre <span class="req">*</span></label>
                            <input type="text" class="form-input" id="banqueExConnTitre" placeholder="Ex: Leçon 1 - La Révolution">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea class="form-textarea" id="banqueExConnDescription" rows="2" placeholder="Description optionnelle..."></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Type</label>
                                <select class="form-select" id="banqueExConnType">
                                    <option value="lecon">📝 Leçon</option>
                                    <option value="revision">📖 Révision</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Statut</label>
                                <select class="form-select" id="banqueExConnStatut">
                                    <option value="brouillon">Brouillon</option>
                                    <option value="publie">Publié</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeBanqueExercicesConnModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="AdminBanquesExercices.saveBanqueExercicesConn()">Enregistrer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const title = document.getElementById('banqueExConnModalTitle');
        if (banque) {
            title.textContent = 'Modifier la banque d\'exercices';
            document.getElementById('editBanqueExConnId').value = banque.id;
            document.getElementById('banqueExConnTitre').value = banque.titre || '';
            document.getElementById('banqueExConnDescription').value = banque.description || '';
            document.getElementById('banqueExConnType').value = banque.type || 'lecon';
            document.getElementById('banqueExConnStatut').value = banque.statut || 'brouillon';
        } else {
            title.textContent = 'Nouvelle banque d\'exercices';
            document.getElementById('editBanqueExConnId').value = '';
            document.getElementById('banqueExConnTitre').value = '';
            document.getElementById('banqueExConnDescription').value = '';
            document.getElementById('banqueExConnType').value = 'lecon';
            document.getElementById('banqueExConnStatut').value = 'brouillon';
        }

        modal.classList.remove('hidden');
    },

    closeBanqueExercicesConnModal() {
        const modal = document.getElementById('banqueExercicesConnModal');
        if (modal) modal.classList.add('hidden');
    },

    async saveBanqueExercicesConn() {
        const id = document.getElementById('editBanqueExConnId').value;
        const titre = document.getElementById('banqueExConnTitre').value.trim();
        const description = document.getElementById('banqueExConnDescription').value.trim();
        const type = document.getElementById('banqueExConnType').value;
        const statut = document.getElementById('banqueExConnStatut').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        const data = { titre, description, type, statut };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateBanqueExercicesConn', data);
            } else {
                result = await this.callAPI('createBanqueExercicesConn', data);
            }

            if (result.success) {
                this.closeBanqueExercicesConnModal();
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde banque:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    async deleteBanqueExercicesConn(id) {
        if (!confirm('Supprimer cette banque et tous ses entraînements ?')) return;

        try {
            const result = await this.callAPI('deleteBanqueExercicesConn', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    // ========== CRUD ENTRAINEMENTS CONN ==========

    addEntrainementConn(banqueExerciceId) {
        this.openEntrainementConnModal(null, banqueExerciceId);
    },

    editEntrainementConn(id) {
        const entrainement = this.entrainementsConn.find(e => e.id === id);
        if (!entrainement) return;
        this.openEntrainementConnEditPage(entrainement);
    },

    openEntrainementConnModal(entrainement = null, banqueExerciceId = null) {
        // Créer le modal dynamiquement
        let modal = document.getElementById('entrainementConnModal2');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'entrainementConnModal2';
            modal.className = 'modal-overlay hidden';
            modal.innerHTML = `
                <div class="modal modal-medium">
                    <div class="modal-header">
                        <h2 id="entrConnModalTitle">Nouvel entraînement</h2>
                        <button class="modal-close" onclick="AdminBanquesExercices.closeEntrainementConnModal2()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="editEntrConnId">
                        <input type="hidden" id="entrConnBanqueId">
                        <div class="form-group">
                            <label>Titre <span class="req">*</span></label>
                            <input type="text" class="form-input" id="entrConnTitre" placeholder="Ex: Entraînement 1">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea class="form-textarea" id="entrConnDescription" rows="2" placeholder="Description optionnelle..."></textarea>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Durée (minutes)</label>
                                <input type="number" class="form-input" id="entrConnDuree" value="15" min="5" max="120">
                            </div>
                            <div class="form-group">
                                <label>Seuil de réussite (%)</label>
                                <input type="number" class="form-input" id="entrConnSeuil" value="80" min="50" max="100">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Statut</label>
                            <select class="form-select" id="entrConnStatut">
                                <option value="brouillon">Brouillon</option>
                                <option value="publie">Publié</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeEntrainementConnModal2()">Annuler</button>
                        <button class="btn btn-primary" onclick="AdminBanquesExercices.saveEntrainementConnAndEdit()">Créer et configurer les étapes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('editEntrConnId').value = entrainement ? entrainement.id : '';
        document.getElementById('entrConnBanqueId').value = banqueExerciceId || '';
        document.getElementById('entrConnTitre').value = entrainement ? entrainement.titre : '';
        document.getElementById('entrConnDescription').value = entrainement ? entrainement.description : '';
        document.getElementById('entrConnDuree').value = entrainement ? entrainement.duree : 15;
        document.getElementById('entrConnSeuil').value = entrainement ? entrainement.seuil : 80;
        document.getElementById('entrConnStatut').value = entrainement ? entrainement.statut : 'brouillon';

        modal.classList.remove('hidden');
    },

    closeEntrainementConnModal2() {
        const modal = document.getElementById('entrainementConnModal2');
        if (modal) modal.classList.add('hidden');
    },

    async saveEntrainementConnAndEdit() {
        const id = document.getElementById('editEntrConnId').value;
        const banqueExerciceId = document.getElementById('entrConnBanqueId').value;
        const titre = document.getElementById('entrConnTitre').value.trim();
        const description = document.getElementById('entrConnDescription').value.trim();
        const duree = parseInt(document.getElementById('entrConnDuree').value) || 15;
        const seuil = parseInt(document.getElementById('entrConnSeuil').value) || 80;
        const statut = document.getElementById('entrConnStatut').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        const data = { titre, description, duree, seuil, statut, banque_exercice_id: banqueExerciceId };

        try {
            const result = await this.callAPI('createEntrainementConn', data);
            if (result.success) {
                this.closeEntrainementConnModal2();
                await this.loadDataFromAPI();
                // Ouvrir la page d'édition des étapes
                const newEntrainement = this.entrainementsConn.find(e => e.id === result.id);
                if (newEntrainement) {
                    this.openEntrainementConnEditPage(newEntrainement);
                }
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur création:', error);
            alert('Erreur lors de la création');
        }
    },

    async deleteEntrainementConn(id) {
        if (!confirm('Supprimer cet entraînement et toutes ses étapes ?')) return;

        try {
            const result = await this.callAPI('deleteEntrainementConn', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    /**
     * Page d'édition d'un entraînement (étapes avec drag & drop)
     */
    openEntrainementConnEditPage(entrainement) {
        const etapes = this.etapesConn
            .filter(e => e.entrainement_id === entrainement.id)
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const container = document.getElementById('banquesList');

        container.innerHTML = `
            <div class="conn-detail-view entrainement-editor">
                <div class="conn-detail-header">
                    <button class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.viewBanqueExercicesConn('${entrainement.banque_exercice_id}')">
                        ← Retour aux entraînements
                    </button>
                    <h2>🎯 ${this.escapeHtml(entrainement.titre)}</h2>
                    <div class="header-actions">
                        <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addEtapeConn('${entrainement.id}')">
                            + Ajouter une étape
                        </button>
                    </div>
                </div>

                <div class="entrainement-settings">
                    <span>⏱️ ${entrainement.duree || 15} min</span>
                    <span>🎯 Seuil: ${entrainement.seuil || 80}%</span>
                    <span class="status-badge ${entrainement.statut === 'publie' ? 'published' : 'draft'}">
                        ${entrainement.statut === 'publie' ? 'Publié' : 'Brouillon'}
                    </span>
                </div>

                <div class="etapes-container" id="etapesContainer" data-entrainement-id="${entrainement.id}">
                    ${etapes.length === 0 ?
                        '<div class="conn-empty">Aucune étape. Ajoutez des étapes pour configurer l\'entraînement.</div>' :
                        this.renderEtapesList(etapes)
                    }
                </div>
            </div>
        `;

        // Initialiser drag & drop si des étapes existent
        if (etapes.length > 0) {
            this.initEtapesDragDrop();
        }
    },

    renderEtapesList(etapes) {
        return etapes.map((etape, index) => {
            const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
            const etapeQuestions = this.etapeQuestionsConn ?
                this.etapeQuestionsConn.filter(eq => eq.etape_id === etape.id) : [];

            return `
                <div class="etape-card" data-id="${etape.id}" draggable="true">
                    <div class="etape-drag-handle">⋮⋮</div>
                    <div class="etape-number">${index + 1}</div>
                    <div class="etape-content">
                        <div class="etape-format">
                            <span class="format-icon">${format.icone || '❓'}</span>
                            <span class="format-name">${format.nom || etape.format_code}</span>
                        </div>
                        <div class="etape-info">
                            <span>${etapeQuestions.length} question(s)</span>
                            <span class="etape-mode">${etape.mode_selection === 'aleatoire' ? '🎲 Aléatoire' : '✋ Manuel'}</span>
                        </div>
                    </div>
                    <div class="etape-actions">
                        <button class="btn btn-sm" onclick="AdminBanquesExercices.configureEtapeConn('${etape.id}')">
                            Configurer
                        </button>
                        <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteEtapeConn('${etape.id}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Ajouter une étape à un entraînement
     */
    addEtapeConn(entrainementId) {
        // Créer le modal de sélection de format
        const formats = this.formatsQuestions || [];

        const modalHtml = `
            <div class="modal-overlay" id="addEtapeModal">
                <div class="modal modal-medium">
                    <div class="modal-header">
                        <h2>Ajouter une étape</h2>
                        <button class="modal-close" onclick="AdminBanquesExercices.closeAddEtapeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Format de question</label>
                            <select id="etapeFormatSelect" class="form-select">
                                ${formats.map(f => `<option value="${f.code}">${f.icone || ''} ${f.nom}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Mode de sélection des questions</label>
                            <div class="type-selector-row">
                                <label class="type-option selected" onclick="AdminBanquesExercices.selectModeSelection(this, 'manuel')">
                                    <input type="radio" name="modeSelection" value="manuel" checked>
                                    <span class="type-option-icon">✋</span>
                                    <span class="type-option-label">Manuel</span>
                                </label>
                                <label class="type-option" onclick="AdminBanquesExercices.selectModeSelection(this, 'aleatoire')">
                                    <input type="radio" name="modeSelection" value="aleatoire">
                                    <span class="type-option-icon">🎲</span>
                                    <span class="type-option-label">Aléatoire</span>
                                </label>
                            </div>
                        </div>
                        <div id="randomConfig" style="display: none;">
                            <div class="form-group">
                                <label>Nombre de questions à tirer</label>
                                <input type="number" id="etapeNbQuestions" class="form-input" value="5" min="1">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeAddEtapeModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="AdminBanquesExercices.saveNewEtape('${entrainementId}')">Créer l'étape</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    selectModeSelection(element, mode) {
        document.querySelectorAll('#addEtapeModal .type-option').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        element.querySelector('input').checked = true;

        const randomConfig = document.getElementById('randomConfig');
        if (randomConfig) {
            randomConfig.style.display = mode === 'aleatoire' ? 'block' : 'none';
        }
    },

    closeAddEtapeModal() {
        const modal = document.getElementById('addEtapeModal');
        if (modal) modal.remove();
    },

    async saveNewEtape(entrainementId) {
        const formatCode = document.getElementById('etapeFormatSelect').value;
        const modeSelection = document.querySelector('input[name="modeSelection"]:checked').value;
        const nbQuestions = modeSelection === 'aleatoire' ?
            parseInt(document.getElementById('etapeNbQuestions').value) || 5 : 0;

        // Calculer l'ordre (dernier + 1)
        const existingEtapes = this.etapesConn.filter(e => e.entrainement_id === entrainementId);
        const ordre = existingEtapes.length + 1;

        try {
            const result = await this.callAPI('createEtapeConn', {
                entrainement_id: entrainementId,
                format_code: formatCode,
                ordre: ordre,
                mode_selection: modeSelection,
                nb_questions: nbQuestions
            });

            if (result.success) {
                this.closeAddEtapeModal();
                await this.loadDataFromAPI();

                // Ré-ouvrir la page d'édition
                const entrainement = this.entrainementsConn.find(e => e.id === entrainementId);
                if (entrainement) {
                    this.openEntrainementConnEditPage(entrainement);
                }
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur création étape:', error);
            alert('Erreur lors de la création de l\'étape');
        }
    },

    async deleteEtapeConn(etapeId) {
        if (!confirm('Supprimer cette étape ?')) return;

        const etape = this.etapesConn.find(e => e.id === etapeId);
        if (!etape) return;

        try {
            const result = await this.callAPI('deleteEtapeConn', { id: etapeId });
            if (result.success) {
                await this.loadDataFromAPI();

                // Ré-ouvrir la page d'édition
                const entrainement = this.entrainementsConn.find(e => e.id === etape.entrainement_id);
                if (entrainement) {
                    this.openEntrainementConnEditPage(entrainement);
                }
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression étape:', error);
            alert('Erreur lors de la suppression');
        }
    },

    /**
     * Configurer une étape (sélectionner les questions)
     */
    configureEtapeConn(etapeId) {
        const etape = this.etapesConn.find(e => e.id === etapeId);
        if (!etape) return;

        const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
        const etapeQuestions = this.etapeQuestionsConn.filter(eq => eq.etape_id === etapeId);
        const selectedQuestionIds = etapeQuestions.map(eq => eq.question_id);

        // Filtrer les questions par format
        const availableQuestions = this.questionsConnaissances.filter(q => {
            // Mapper le type de question au format
            const typeToFormat = {
                'qcm': 'qcm',
                'vrai_faux': 'qcm',
                'chronologie': 'timeline',
                'timeline': 'timeline',
                'association': 'association',
                'texte_trou': 'texte_trous'
            };
            return typeToFormat[q.type] === etape.format_code || etape.format_code === 'mixte';
        });

        const modalHtml = `
            <div class="modal-overlay" id="configEtapeModal">
                <div class="modal modal-large">
                    <div class="modal-header">
                        <h2>${format.icone || ''} Configurer l'étape - ${format.nom || etape.format_code}</h2>
                        <button class="modal-close" onclick="AdminBanquesExercices.closeConfigEtapeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${etape.mode_selection === 'aleatoire' ? `
                            <div class="conn-random-config">
                                <p><strong>Mode aléatoire activé</strong></p>
                                <div class="conn-random-row">
                                    <label>Nombre de questions à tirer :</label>
                                    <input type="number" id="configNbQuestions" value="${etape.nb_questions || 5}" min="1">
                                </div>
                                <div class="conn-random-row">
                                    <label>Banque de questions source :</label>
                                    <select id="configBanqueSource" class="form-select">
                                        <option value="">Toutes les banques</option>
                                        ${this.banquesQuestions.map(b => `
                                            <option value="${b.id}">${this.escapeHtml(b.titre)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                        ` : `
                            <div class="conn-question-picker">
                                <div class="conn-question-picker-header">
                                    <strong>Sélectionner les questions</strong>
                                    <select id="filterBanqueSelect" class="form-select" style="margin-left: auto; width: auto;" onchange="AdminBanquesExercices.filterQuestionsByBanque()">
                                        <option value="">Toutes les banques</option>
                                        ${this.banquesQuestions.map(b => `
                                            <option value="${b.id}">${this.escapeHtml(b.titre)}</option>
                                        `).join('')}
                                    </select>
                                </div>
                                <div class="conn-question-picker-list" id="questionPickerList">
                                    ${availableQuestions.length === 0 ?
                                        '<div class="conn-empty-state"><p>Aucune question disponible pour ce format</p></div>' :
                                        availableQuestions.map(q => {
                                            const banque = this.banquesQuestions.find(b => b.id === q.banque_id);
                                            const isSelected = selectedQuestionIds.includes(q.id);
                                            return `
                                                <div class="conn-question-picker-item ${isSelected ? 'selected' : ''}" data-question-id="${q.id}" data-banque-id="${q.banque_id}">
                                                    <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="AdminBanquesExercices.toggleQuestionSelection(this, '${q.id}')">
                                                    <div class="conn-question-content">
                                                        <div class="conn-question-text">${this.escapeHtml(this.getQuestionPreview(q))}</div>
                                                        <div class="conn-question-meta">
                                                            <span>${this.questionTypeNames[q.type] || q.type}</span>
                                                            ${banque ? `<span>• ${this.escapeHtml(banque.titre)}</span>` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')
                                    }
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeConfigEtapeModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="AdminBanquesExercices.saveEtapeConfig('${etapeId}', '${etape.mode_selection}')">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    toggleQuestionSelection(checkbox, questionId) {
        const item = checkbox.closest('.conn-question-picker-item');
        if (checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    },

    filterQuestionsByBanque() {
        const banqueId = document.getElementById('filterBanqueSelect').value;
        const items = document.querySelectorAll('.conn-question-picker-item');

        items.forEach(item => {
            if (!banqueId || item.dataset.banqueId === banqueId) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    },

    closeConfigEtapeModal() {
        const modal = document.getElementById('configEtapeModal');
        if (modal) modal.remove();
    },

    async saveEtapeConfig(etapeId, modeSelection) {
        const etape = this.etapesConn.find(e => e.id === etapeId);
        if (!etape) return;

        try {
            if (modeSelection === 'aleatoire') {
                // Sauvegarder la config aléatoire
                const nbQuestions = parseInt(document.getElementById('configNbQuestions').value) || 5;
                const banqueSource = document.getElementById('configBanqueSource').value;

                await this.callAPI('updateEtapeConn', {
                    id: etapeId,
                    nb_questions: nbQuestions,
                    banque_source_id: banqueSource || null
                });
            } else {
                // Sauvegarder les questions sélectionnées
                const selectedQuestions = [];
                document.querySelectorAll('.conn-question-picker-item input:checked').forEach(cb => {
                    const item = cb.closest('.conn-question-picker-item');
                    selectedQuestions.push(item.dataset.questionId);
                });

                await this.callAPI('setEtapeQuestionsConn', {
                    etape_id: etapeId,
                    question_ids: selectedQuestions
                });
            }

            this.closeConfigEtapeModal();
            await this.loadDataFromAPI();

            // Ré-ouvrir la page d'édition
            const entrainement = this.entrainementsConn.find(e => e.id === etape.entrainement_id);
            if (entrainement) {
                this.openEntrainementConnEditPage(entrainement);
            }
        } catch (error) {
            console.error('Erreur sauvegarde config étape:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    /**
     * Initialiser le drag & drop pour réordonner les étapes
     */
    initEtapesDragDrop() {
        const container = document.getElementById('etapesContainer');
        if (!container) return;

        const cards = container.querySelectorAll('.etape-card');
        let draggedElement = null;

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedElement = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedElement = null;
                // Sauvegarder le nouvel ordre
                this.saveEtapesOrder(container);
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedElement && draggedElement !== card) {
                    const rect = card.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;

                    if (e.clientY < midY) {
                        card.parentNode.insertBefore(draggedElement, card);
                    } else {
                        card.parentNode.insertBefore(draggedElement, card.nextSibling);
                    }
                }
            });

            card.addEventListener('dragenter', () => {
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', () => {
                card.classList.remove('drag-over');
            });
        });
    },

    async saveEtapesOrder(container) {
        const cards = container.querySelectorAll('.etape-card');
        const orderedIds = Array.from(cards).map((card, index) => ({
            id: card.dataset.id,
            ordre: index + 1
        }));

        try {
            await this.callAPI('updateEtapesOrdre', { etapes: orderedIds });
            await this.loadDataFromAPI();

            // Mettre à jour les numéros visuellement
            cards.forEach((card, index) => {
                const numEl = card.querySelector('.etape-number');
                if (numEl) numEl.textContent = index + 1;
            });
        } catch (error) {
            console.error('Erreur mise à jour ordre:', error);
        }
    },

    // ========== BANQUES DE QUESTIONS (ancien système conservé) ==========

    renderBanquesQuestions(container, emptyState) {
        // Filter banques de questions
        let filtered = this.banquesQuestions;

        if (this.filters.search) {
            filtered = filtered.filter(b =>
                (b.titre || '').toLowerCase().includes(this.filters.search) ||
                (b.description || '').toLowerCase().includes(this.filters.search)
            );
        }

        // Sort by date_creation desc
        filtered.sort((a, b) => (b.date_creation || '').localeCompare(a.date_creation || ''));

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = filtered.map(banque => {
            const questions = this.questionsConnaissances.filter(q => q.banque_id === banque.id);
            const questionsByType = {};
            questions.forEach(q => {
                questionsByType[q.type] = (questionsByType[q.type] || 0) + 1;
            });

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon connaissances">&#128994;</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${questions.length}</div>
                                <div class="banque-stat-label">questions</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueQuestions('${banque.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueQuestions('${banque.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Questions</h4>
                            <div class="exercices-header-actions">
                                <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addQuestionConnaissances('${banque.id}')">+ Ajouter</button>
                                <button class="btn btn-success btn-sm" onclick="AdminBanquesExercices.openEntrainementModal('${banque.id}')" ${questions.length === 0 ? 'disabled title="Ajoutez des questions d\'abord"' : ''}>🎯 Créer entraînement</button>
                            </div>
                        </div>
                        ${this.renderQuestionsConnaissances(questions, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderQuestionsConnaissances(questions, banqueId) {
        if (questions.length === 0) {
            return '<div class="exercices-empty">Aucune question dans cette banque</div>';
        }

        return `
            <div class="exercices-list">
                ${questions.map(q => {
                    const typeName = this.questionTypeNames[q.type] || q.type;
                    const preview = this.getQuestionPreview(q);

                    return `
                        <div class="exercice-item" data-id="${q.id}">
                            <div class="exercice-numero">${typeName.charAt(0)}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(preview)}</div>
                                <div class="exercice-meta">${typeName}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editQuestionConnaissances('${q.id}')" title="Modifier">&#9998;</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteQuestionConnaissances('${q.id}')" title="Supprimer">&#128465;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    getQuestionPreview(question) {
        if (!question.donnees) return 'Question sans contenu';

        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
                return (question.donnees.question || '').substring(0, 60) || 'Question sans texte';
            case 'chronologie':
            case 'association':
                return (question.donnees.consigne || '').substring(0, 60) || 'Exercice d\'association';
            case 'timeline':
                return (question.donnees.consigne || '').substring(0, 60) || 'Exercice de timeline';
            case 'texte_trou':
                return (question.donnees.texte || '').substring(0, 60) || 'Texte à trous';
            default:
                return 'Question';
        }
    },

    // CRUD pour Banques de Questions
    addBanqueQuestions() {
        this.openBanqueQuestionsModal();
    },

    editBanqueQuestions(id) {
        const banque = this.banquesQuestions.find(b => b.id === id);
        if (!banque) return;
        this.openBanqueQuestionsModal(banque);
    },

    openBanqueQuestionsModal(banque = null) {
        const modal = document.getElementById('banqueQuestionsModal');
        const title = document.getElementById('banqueQuestionsModalTitle');

        if (banque) {
            title.textContent = 'Modifier la banque de questions';
            document.getElementById('editBanqueQuestionsId').value = banque.id;
            document.getElementById('banqueQuestionsTitre').value = banque.titre || '';
            document.getElementById('banqueQuestionsDescription').value = banque.description || '';
        } else {
            title.textContent = 'Nouvelle banque de questions';
            document.getElementById('editBanqueQuestionsId').value = '';
            document.getElementById('banqueQuestionsTitre').value = '';
            document.getElementById('banqueQuestionsDescription').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeBanqueQuestionsModal() {
        document.getElementById('banqueQuestionsModal').classList.add('hidden');
    },

    async saveBanqueQuestions() {
        const id = document.getElementById('editBanqueQuestionsId').value;
        const titre = document.getElementById('banqueQuestionsTitre').value.trim();
        const description = document.getElementById('banqueQuestionsDescription').value.trim();

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        try {
            let result;
            if (id) {
                result = await this.callAPI('updateBanqueQuestions', { id, titre, description });
            } else {
                result = await this.callAPI('createBanqueQuestions', { titre, description });
            }

            if (result.success) {
                this.closeBanqueQuestionsModal();
                await this.loadDataFromAPI();
                this.renderBanques();
                this.updateCounts();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la sauvegarde');
        }
    },

    async deleteBanqueQuestions(id) {
        if (!confirm('Supprimer cette banque et toutes ses questions ?')) return;

        try {
            const result = await this.callAPI('deleteBanqueQuestions', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
                this.updateCounts();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    },

    // CRUD pour Questions de Connaissances
    addQuestionConnaissances(banqueId) {
        this.currentQuestionBanqueId = banqueId;
        this.currentQuestionId = null;
        this.openQuestionModal();
    },

    editQuestionConnaissances(questionId) {
        const question = this.questionsConnaissances.find(q => q.id === questionId);
        if (!question) return;

        this.currentQuestionBanqueId = question.banque_id;
        this.currentQuestionId = questionId;
        this.openQuestionModal(question);
    },

    async deleteQuestionConnaissances(id) {
        if (!confirm('Supprimer cette question ?')) return;

        try {
            const result = await this.callAPI('deleteQuestionConnaissances', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    },

    openQuestionModal(question = null) {
        // Ouvrir le modal pour créer/éditer une question
        const modal = document.getElementById('questionConnaissancesModal');
        if (!modal) {
            alert('Modal non trouvé. Veuillez rafraîchir la page.');
            return;
        }

        const titleEl = document.getElementById('questionModalTitle');
        const typeSelect = document.getElementById('questionType');
        const builderContainer = document.getElementById('questionBuilder');

        titleEl.textContent = question ? 'Modifier la question' : 'Nouvelle question';

        if (question) {
            typeSelect.value = question.type || 'qcm';
            this.renderQuestionBuilder(question.type, question.donnees);
        } else {
            typeSelect.value = 'qcm';
            this.renderQuestionBuilder('qcm', {});
        }

        modal.classList.remove('hidden');
    },

    closeQuestionModal() {
        const modal = document.getElementById('questionConnaissancesModal');
        if (modal) modal.classList.add('hidden');
    },

    renderQuestionBuilder(type, data = {}) {
        const container = document.getElementById('questionBuilder');
        if (!container) return;

        let html = '';

        switch (type) {
            case 'qcm':
                html = `
                    <div class="form-group">
                        <label>Question</label>
                        <textarea id="qcmQuestion" class="form-textarea" rows="3">${this.escapeHtml(data.question || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Options (une par ligne)</label>
                        <textarea id="qcmOptions" class="form-textarea" rows="4">${(data.options || []).join('\n')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Index de la bonne réponse (0, 1, 2...)</label>
                        <input type="number" id="qcmCorrect" class="form-input" value="${data.reponse_correcte || 0}" min="0">
                    </div>
                `;
                break;

            case 'vrai_faux':
                html = `
                    <div class="form-group">
                        <label>Question</label>
                        <textarea id="vfQuestion" class="form-textarea" rows="3">${this.escapeHtml(data.question || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Réponse correcte</label>
                        <select id="vfReponse" class="form-select">
                            <option value="vrai" ${data.reponse === 'vrai' ? 'selected' : ''}>Vrai</option>
                            <option value="faux" ${data.reponse === 'faux' ? 'selected' : ''}>Faux</option>
                        </select>
                    </div>
                `;
                break;

            case 'chronologie':
                const pairesChronologie = data.paires || [{ date: '', evenement: '' }];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="chronoConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Associez les dates aux événements')}">
                    </div>
                    <div class="form-group">
                        <label>Paires (date - événement)</label>
                        <div id="chronoPaires">
                            ${pairesChronologie.map((p, i) => `
                                <div class="pair-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                    <input type="text" class="form-input chrono-date" placeholder="Date" value="${this.escapeHtml(p.date || '')}" style="width: 100px;">
                                    <input type="text" class="form-input chrono-event" placeholder="Événement" value="${this.escapeHtml(p.evenement || '')}">
                                    <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addChronoPair()">+ Ajouter une paire</button>
                    </div>
                `;
                break;

            case 'timeline':
                const evenements = data.evenements || [''];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="timelineConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Remettez dans l\'ordre chronologique')}">
                    </div>
                    <div class="form-group">
                        <label>Événements (dans l'ordre correct)</label>
                        <div id="timelineEvents">
                            ${evenements.map((e, i) => `
                                <div class="event-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                    <span style="padding: 8px;">${i + 1}.</span>
                                    <input type="text" class="form-input timeline-event" placeholder="Événement" value="${this.escapeHtml(e || '')}">
                                    <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addTimelineEvent()">+ Ajouter un événement</button>
                    </div>
                `;
                break;

            case 'association':
                const pairesAssoc = data.paires || [{ element1: '', element2: '' }];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="assocConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Associez les éléments')}">
                    </div>
                    <div class="form-group">
                        <label>Paires à associer</label>
                        <div id="assocPaires">
                            ${pairesAssoc.map((p, i) => `
                                <div class="pair-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
                                    <input type="text" class="form-input assoc-left" placeholder="Élément 1" value="${this.escapeHtml(p.element1 || '')}">
                                    <span style="padding: 8px;">↔</span>
                                    <input type="text" class="form-input assoc-right" placeholder="Élément 2" value="${this.escapeHtml(p.element2 || '')}">
                                    <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addAssocPair()">+ Ajouter une paire</button>
                    </div>
                `;
                break;

            case 'texte_trou':
                html = `
                    <div class="form-group">
                        <label>Texte (utilisez {mot} pour les trous)</label>
                        <textarea id="texteATrous" class="form-textarea" rows="6" placeholder="Ex: La {capitale} de la France est {Paris}.">${this.escapeHtml(data.texte || '')}</textarea>
                        <small style="color: var(--gray-500);">Les mots entre {accolades} seront les trous à compléter.</small>
                    </div>
                `;
                break;

            default:
                html = '<p>Type de question non supporté</p>';
        }

        container.innerHTML = html;
    },

    addChronoPair() {
        const container = document.getElementById('chronoPaires');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'pair-row';
        div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <input type="text" class="form-input chrono-date" placeholder="Date" style="width: 100px;">
            <input type="text" class="form-input chrono-event" placeholder="Événement">
            <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
        `;
        container.appendChild(div);
    },

    addTimelineEvent() {
        const container = document.getElementById('timelineEvents');
        if (!container) return;
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'event-row';
        div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <span style="padding: 8px;">${count}.</span>
            <input type="text" class="form-input timeline-event" placeholder="Événement">
            <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
        `;
        container.appendChild(div);
    },

    addAssocPair() {
        const container = document.getElementById('assocPaires');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'pair-row';
        div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <input type="text" class="form-input assoc-left" placeholder="Élément 1">
            <span style="padding: 8px;">↔</span>
            <input type="text" class="form-input assoc-right" placeholder="Élément 2">
            <button type="button" class="btn btn-sm" onclick="this.parentElement.remove()">X</button>
        `;
        container.appendChild(div);
    },

    async saveQuestionConnaissances() {
        const type = document.getElementById('questionType').value;
        let donnees = {};

        switch (type) {
            case 'qcm':
                donnees = {
                    question: document.getElementById('qcmQuestion').value,
                    options: document.getElementById('qcmOptions').value.split('\n').filter(o => o.trim()),
                    reponse_correcte: parseInt(document.getElementById('qcmCorrect').value) || 0
                };
                break;

            case 'vrai_faux':
                donnees = {
                    question: document.getElementById('vfQuestion').value,
                    reponse: document.getElementById('vfReponse').value
                };
                break;

            case 'chronologie':
                donnees = {
                    consigne: document.getElementById('chronoConsigne').value,
                    paires: Array.from(document.querySelectorAll('#chronoPaires .pair-row')).map(row => ({
                        date: row.querySelector('.chrono-date').value,
                        evenement: row.querySelector('.chrono-event').value
                    })).filter(p => p.date && p.evenement)
                };
                break;

            case 'timeline':
                donnees = {
                    consigne: document.getElementById('timelineConsigne').value,
                    evenements: Array.from(document.querySelectorAll('#timelineEvents .timeline-event')).map(input => input.value).filter(e => e)
                };
                break;

            case 'association':
                donnees = {
                    consigne: document.getElementById('assocConsigne').value,
                    paires: Array.from(document.querySelectorAll('#assocPaires .pair-row')).map(row => ({
                        element1: row.querySelector('.assoc-left').value,
                        element2: row.querySelector('.assoc-right').value
                    })).filter(p => p.element1 && p.element2)
                };
                break;

            case 'texte_trou':
                donnees = {
                    texte: document.getElementById('texteATrous').value
                };
                break;
        }

        try {
            let result;
            if (this.currentQuestionId) {
                result = await this.callAPI('updateQuestionConnaissances', {
                    id: this.currentQuestionId,
                    type: type,
                    donnees: JSON.stringify(donnees)
                });
            } else {
                result = await this.callAPI('createQuestionConnaissances', {
                    banque_id: this.currentQuestionBanqueId,
                    type: type,
                    donnees: JSON.stringify(donnees)
                });
            }

            if (result.success) {
                this.closeQuestionModal();
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la sauvegarde');
        }
    },

    // ========== TACHES COMPLEXES (Competences) ==========
    renderTachesComplexes(container, emptyState) {
        // Filter tâches complexes
        let filtered = this.tachesComplexes;

        if (this.filters.search) {
            filtered = filtered.filter(t =>
                (t.titre || '').toLowerCase().includes(this.filters.search) ||
                (t.description || '').toLowerCase().includes(this.filters.search)
            );
        }

        if (this.filters.statut) {
            filtered = filtered.filter(t => t.statut === this.filters.statut);
        }

        // Sort by ordre
        filtered.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = filtered.map(tache => {
            // Parse competences_ids (stored as comma-separated string)
            const compIds = (tache.competences_ids || '').split(',').filter(id => id.trim());
            const competences = compIds.map(id => {
                const comp = this.competencesReferentiel.find(c => c.id === id.trim());
                return comp ? comp.nom : null;
            }).filter(Boolean);

            return `
                <div class="banque-card tache-complexe-card" data-id="${tache.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleTache('${tache.id}')">
                        <div class="banque-card-icon competences">&#128995;</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(tache.titre || 'Sans titre')}
                                <span class="status-badge ${tache.statut}">${tache.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            </div>
                            <div class="banque-card-meta">
                                ${tache.description ? this.escapeHtml(tache.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${competences.length}</div>
                                <div class="banque-stat-label">competences</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editTacheComplexe('${tache.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteTacheComplexe('${tache.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices tache-details">
                        <div class="tache-details-content">
                            ${tache.document_url ? `
                                <div class="tache-document">
                                    <strong>Document :</strong>
                                    <a href="${this.escapeHtml(tache.document_url)}" target="_blank" rel="noopener">
                                        ${this.escapeHtml(tache.document_url)}
                                    </a>
                                </div>
                            ` : ''}
                            <div class="tache-competences">
                                <strong>Competences evaluees :</strong>
                                ${competences.length > 0 ? `
                                    <ul class="competences-list-preview">
                                        ${competences.map(c => `<li>&#10003; ${this.escapeHtml(c)}</li>`).join('')}
                                    </ul>
                                ` : '<em>Aucune competence selectionnee</em>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleTache(id) {
        const card = document.querySelector(`.tache-complexe-card[data-id="${id}"]`);
        if (card) {
            card.classList.toggle('expanded');
        }
    },

    // ========== TACHE COMPLEXE MODAL ==========
    openTacheComplexeModal(tache = null) {
        const modal = document.getElementById('tacheComplexeModal');
        if (!modal) {
            console.error('Modal tacheComplexeModal not found');
            return;
        }

        const title = document.getElementById('tacheModalTitle');

        // Populate competences checkboxes
        this.renderCompetencesCheckboxes();

        if (tache) {
            title.textContent = 'Modifier la tache complexe';
            document.getElementById('editTacheId').value = tache.id;
            document.getElementById('tacheTitre').value = tache.titre || '';
            document.getElementById('tacheDescription').value = tache.description || '';
            document.getElementById('tacheDocumentUrl').value = tache.document_url || '';
            document.getElementById('tacheCorrectionUrl').value = tache.correction_url || '';
            document.getElementById('tacheDuree').value = Math.round((tache.duree || 2700) / 60);
            document.getElementById('tacheOrdre').value = tache.ordre || 1;
            document.getElementById('tacheStatut').value = tache.statut || 'brouillon';

            // Check selected competences
            const compIds = (tache.competences_ids || '').split(',').map(id => id.trim());
            document.querySelectorAll('#competencesCheckboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = compIds.includes(cb.value);
            });
        } else {
            title.textContent = 'Nouvelle tache complexe';
            document.getElementById('editTacheId').value = '';
            document.getElementById('tacheTitre').value = '';
            document.getElementById('tacheDescription').value = '';
            document.getElementById('tacheDocumentUrl').value = '';
            document.getElementById('tacheCorrectionUrl').value = '';
            document.getElementById('tacheDuree').value = 45;
            document.getElementById('tacheOrdre').value = this.tachesComplexes.length + 1;
            document.getElementById('tacheStatut').value = 'brouillon';

            // Uncheck all competences
            document.querySelectorAll('#competencesCheckboxes input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
        }

        modal.classList.remove('hidden');
    },

    closeTacheComplexeModal() {
        const modal = document.getElementById('tacheComplexeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    renderCompetencesCheckboxes() {
        const container = document.getElementById('competencesCheckboxes');
        if (!container) return;

        const activeCompetences = this.competencesReferentiel.filter(c => c.statut === 'actif');
        activeCompetences.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        if (activeCompetences.length === 0) {
            container.innerHTML = `
                <div class="empty-competences">
                    <p>Aucune competence active dans le referentiel.</p>
                    <a href="competences.html" class="btn btn-secondary btn-sm">Gerer les competences</a>
                </div>
            `;
            return;
        }

        container.innerHTML = activeCompetences.map(comp => `
            <label class="competence-checkbox">
                <input type="checkbox" name="tacheCompetences" value="${comp.id}">
                <span class="competence-checkbox-label">
                    <span class="competence-checkbox-icon">&#10003;</span>
                    ${this.escapeHtml(comp.nom)}
                </span>
            </label>
        `).join('');
    },

    addTacheComplexe() {
        this.openTacheComplexeModal(null);
    },

    editTacheComplexe(id) {
        const tache = this.tachesComplexes.find(t => t.id === id);
        if (tache) {
            this.openTacheComplexeModal(tache);
        }
    },

    async saveTacheComplexe() {
        const id = document.getElementById('editTacheId').value;
        const titre = document.getElementById('tacheTitre').value.trim();
        const description = document.getElementById('tacheDescription').value.trim();
        const documentUrl = document.getElementById('tacheDocumentUrl').value.trim();
        const correctionUrl = document.getElementById('tacheCorrectionUrl').value.trim();
        const dureeMinutes = parseInt(document.getElementById('tacheDuree').value) || 45;
        const duree = dureeMinutes * 60; // Convert to seconds
        const ordre = parseInt(document.getElementById('tacheOrdre').value) || 1;
        const statut = document.getElementById('tacheStatut').value;

        // Get selected competences
        const selectedComps = Array.from(document.querySelectorAll('#competencesCheckboxes input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        const competencesIds = selectedComps.join(',');

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        const data = {
            titre,
            description,
            document_url: documentUrl,
            correction_url: correctionUrl,
            duree,
            competences_ids: competencesIds,
            ordre,
            statut
        };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateTacheComplexe', data);
            } else {
                result = await this.callAPI('createTacheComplexe', data);
            }

            if (result.success) {
                // Reload data and re-render
                await this.loadDataFromAPI();
                this.updateCounts();
                this.renderBanques();
                this.closeTacheComplexeModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde tache:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    deleteTacheComplexe(id) {
        const tache = this.tachesComplexes.find(t => t.id === id);
        if (!tache) return;

        // Reuse the existing delete modal
        document.getElementById('deleteType').value = 'tacheComplexe';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer la tache "${tache.titre}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    // ========== ENTRAINEMENTS CONNAISSANCES ==========
    openEntrainementModal(banqueId) {
        const banque = this.banquesQuestions.find(b => b.id === banqueId);
        if (!banque) return;

        const questions = this.questionsConnaissances.filter(q => q.banque_id === banqueId);
        if (questions.length === 0) {
            alert('Ajoutez des questions à cette banque avant de créer un entraînement.');
            return;
        }

        // Vérifier que le modal existe (problème de cache possible)
        const modal = document.getElementById('entrainementConnModal');
        const etapesContainer = document.getElementById('entrainementEtapesConfig');

        if (!modal || !etapesContainer) {
            alert('Erreur : Veuillez rafraîchir la page (Ctrl+Shift+R) pour charger la nouvelle version.');
            return;
        }

        // Populate modal
        document.getElementById('entrainementBanqueId').value = banqueId;
        document.getElementById('entrainementTitre').value = 'Entraînement - ' + (banque.titre || '');
        document.getElementById('entrainementDescription').value = '';
        document.getElementById('entrainementSeuil').value = 80;
        document.getElementById('entrainementStatut').value = 'brouillon';

        // Count questions by type
        const questionsByType = {};
        questions.forEach(q => {
            questionsByType[q.type] = (questionsByType[q.type] || 0) + 1;
        });
        let etapeNum = 1;
        etapesContainer.innerHTML = Object.entries(questionsByType).map(([type, count]) => {
            const typeName = this.questionTypeNames[type] || type;
            const defaultNb = Math.min(3, count); // Default to 3 questions or max available
            const html = `
                <div class="etape-row active" data-type="${type}">
                    <input type="checkbox" class="etape-checkbox" name="etapeEnabled" value="${type}" checked
                           onchange="AdminBanquesExercices.toggleEtape(this)">
                    <div class="etape-info">
                        <span class="etape-name">Étape ${etapeNum} : ${typeName}</span>
                        <span class="etape-count">${count} question(s) disponible(s)</span>
                    </div>
                    <input type="number" class="etape-number-input" name="etapeNb_${type}"
                           value="${defaultNb}" min="1" max="${count}"
                           onchange="AdminBanquesExercices.updateTotalQuestions()">
                    <span class="etape-number-label">question(s)</span>
                </div>
            `;
            etapeNum++;
            return html;
        }).join('');

        // Update total
        this.updateTotalQuestions();

        document.getElementById('entrainementConnModal').classList.remove('hidden');
    },

    toggleEtape(checkbox) {
        const row = checkbox.closest('.etape-row');
        const numberInput = row.querySelector('.etape-number-input');

        if (checkbox.checked) {
            row.classList.add('active');
            numberInput.disabled = false;
        } else {
            row.classList.remove('active');
            numberInput.disabled = true;
        }

        this.updateTotalQuestions();
        this.renumberEtapes();
    },

    renumberEtapes() {
        const rows = document.querySelectorAll('.etape-row');
        let etapeNum = 1;
        rows.forEach(row => {
            const checkbox = row.querySelector('.etape-checkbox');
            const nameSpan = row.querySelector('.etape-name');
            const type = row.dataset.type;
            const typeName = this.questionTypeNames[type] || type;

            if (checkbox.checked) {
                nameSpan.textContent = `Étape ${etapeNum} : ${typeName}`;
                etapeNum++;
            } else {
                nameSpan.textContent = `(Désactivé) ${typeName}`;
            }
        });
    },

    updateTotalQuestions() {
        let total = 0;
        document.querySelectorAll('.etape-row').forEach(row => {
            const checkbox = row.querySelector('.etape-checkbox');
            const numberInput = row.querySelector('.etape-number-input');
            if (checkbox.checked && numberInput.value) {
                total += parseInt(numberInput.value) || 0;
            }
        });

        const info = document.getElementById('totalQuestionsInfo');
        if (info) {
            info.textContent = `Total : ${total} question(s)`;
        }
    },

    closeEntrainementModal() {
        document.getElementById('entrainementConnModal').classList.add('hidden');
    },

    async saveEntrainement() {
        const banqueId = document.getElementById('entrainementBanqueId').value;
        const titre = document.getElementById('entrainementTitre').value.trim();
        const description = document.getElementById('entrainementDescription').value.trim();
        const seuil = parseInt(document.getElementById('entrainementSeuil').value) || 80;
        const statut = document.getElementById('entrainementStatut').value;

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        // Get etapes configuration from the modal
        const etapesConfig = [];
        let etapeNum = 1;
        document.querySelectorAll('.etape-row').forEach(row => {
            const checkbox = row.querySelector('.etape-checkbox');
            const numberInput = row.querySelector('.etape-number-input');
            const type = row.dataset.type;

            if (checkbox.checked && numberInput.value) {
                etapesConfig.push({
                    etape: etapeNum,
                    type: type,
                    nbQuestions: parseInt(numberInput.value) || 1
                });
                etapeNum++;
            }
        });

        if (etapesConfig.length === 0) {
            alert('Activez au moins une étape');
            return;
        }

        // Calculate total questions
        const totalQuestions = etapesConfig.reduce((sum, e) => sum + e.nbQuestions, 0);

        try {
            // Create the entrainement with etapes info
            const entrainementData = {
                titre: titre,
                description: description,
                niveau: 'connaissances',
                duree_estimee: Math.ceil(totalQuestions * 1.5), // ~1.5 min per question
                statut: statut,
                seuil_validation: seuil,
                nb_etapes: etapesConfig.length
            };

            const result = await this.callAPI('createEntrainement', entrainementData);

            if (!result.success) {
                alert('Erreur: ' + (result.error || 'Erreur création entraînement'));
                return;
            }

            const entrainementId = result.id;

            // Add questions to the entrainement, organized by étapes
            let globalOrdre = 1;
            for (const etape of etapesConfig) {
                // Get all questions of this type for this banque
                const questionsOfType = this.questionsConnaissances.filter(q =>
                    q.banque_id === banqueId && q.type === etape.type
                );

                // Random selection
                const shuffled = [...questionsOfType].sort(() => Math.random() - 0.5);
                const selected = shuffled.slice(0, etape.nbQuestions);

                // Save each question with its etape number
                for (const q of selected) {
                    await this.callAPI('createEntrainementQuestion', {
                        entrainement_id: entrainementId,
                        question_id: q.id,
                        banque_id: banqueId,
                        question_type: q.type,
                        ordre: globalOrdre,
                        etape: etape.etape
                    });
                    globalOrdre++;
                }
            }

            this.closeEntrainementModal();
            alert(`Entraînement créé avec ${totalQuestions} questions réparties en ${etapesConfig.length} étape(s) !`);

        } catch (error) {
            console.error('Erreur création entraînement:', error);
            alert('Erreur lors de la création de l\'entraînement');
        }
    },

    // ========== UTILS ==========
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Make globally accessible for inline handlers
window.AdminBanquesExercices = AdminBanquesExercices;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    AdminBanquesExercices.init();
});
