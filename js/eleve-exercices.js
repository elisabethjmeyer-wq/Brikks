/**
 * Exercices Élève - Logique JavaScript
 * Gestion des exercices d'entraînement pour les élèves
 * Design accordéon avec vue unifiée
 */

const EleveExercices = {
    // Type courant (savoir-faire, connaissances, competences)
    currentType: 'savoir-faire',

    // Données
    banques: [],
    exercices: [],
    formats: [],
    resultats: [],

    // État
    currentBanque: null,
    currentExercise: null,
    timer: null,
    timeRemaining: 0,
    exerciseStartTime: null,
    currentUser: null,
    expandedBanques: new Set(), // Track which banques are expanded

    // Cache config (5 minutes TTL)
    CACHE_KEY: 'brikks_exercices_cache',
    CACHE_RESULTATS_KEY: 'brikks_resultats_cache',
    CACHE_TTL: 5 * 60 * 1000,

    /**
     * Initialise la page d'exercices
     */
    async init(type) {
        this.currentType = type;
        this.currentUser = await this.getCurrentUser();

        // Try cache first
        const cached = this.loadFromCache();
        if (cached) {
            this.applyData(cached.banques, cached.exercices, cached.formats);
            const cachedResultats = this.loadResultatsFromCache();
            if (cachedResultats) this.resultats = cachedResultats;
            this.renderAccordionView();
            this.refreshDataInBackground();
            this.refreshResultatsInBackground();
        } else {
            this.showLoader('Chargement des exercices...');
            try {
                await this.loadData();
                await this.loadResultats();
                this.renderAccordionView();
            } catch (error) {
                console.error('Erreur lors du chargement:', error);
                this.showError('Erreur lors du chargement des exercices');
            }
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser() {
        try {
            if (typeof Auth !== 'undefined' && Auth.user) return Auth.user;
            const session = localStorage.getItem('brikks_session');
            if (session) return JSON.parse(session);
            return null;
        } catch (e) {
            return null;
        }
    },

    // Cache methods
    loadResultatsFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_RESULTATS_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.resultats || [];
            }
            return null;
        } catch (e) { return null; }
    },

    saveResultatsToCache(resultats) {
        try {
            localStorage.setItem(this.CACHE_RESULTATS_KEY, JSON.stringify({
                resultats,
                timestamp: Date.now()
            }));
        } catch (e) {}
    },

    async loadResultats() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) {}
    },

    async refreshResultatsInBackground() {
        if (!this.currentUser || !this.currentUser.id) return;
        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) {}
    },

    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data;
            }
            return null;
        } catch (e) { return null; }
    },

    saveToCache(banques, exercices, formats) {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify({
                banques, exercices, formats,
                timestamp: Date.now()
            }));
        } catch (e) {}
    },

    applyData(banques, exercices, formats) {
        this.banques = (banques || []).filter(b =>
            b.type === this.currentType && b.statut === 'publie'
        );
        this.exercices = (exercices || []).filter(e => e.statut === 'publie');
        this.formats = formats || [];
        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    },

    async refreshDataInBackground() {
        try {
            const [banquesResult, exercicesResult, formatsResult] = await Promise.all([
                this.callAPI('getBanquesExercices'),
                this.callAPI('getExercices'),
                this.callAPI('getFormatsExercices')
            ]);
            const banques = banquesResult.success ? banquesResult.data : [];
            const exercices = exercicesResult.success ? exercicesResult.data : [];
            const formats = formatsResult.success ? formatsResult.data : [];
            this.saveToCache(banques, exercices, formats);
            this.applyData(banques, exercices, formats);
        } catch (error) {}
    },

    async loadData() {
        const [banquesResult, exercicesResult, formatsResult] = await Promise.all([
            this.callAPI('getBanquesExercices'),
            this.callAPI('getExercices'),
            this.callAPI('getFormatsExercices')
        ]);
        const banques = banquesResult.success ? banquesResult.data : [];
        const exercices = exercicesResult.success ? exercicesResult.data : [];
        const formats = formatsResult.success ? formatsResult.data : [];
        this.saveToCache(banques, exercices, formats);
        this.applyData(banques, exercices, formats);
    },

    callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');
            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };
            const queryParams = new URLSearchParams({ action, callback: callbackName, ...params });
            script.src = `${CONFIG.WEBAPP_URL}?${queryParams.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed'));
            };
            document.body.appendChild(script);
        });
    },

    /**
     * Render the accordion view with type header and expandable banques
     */
    renderAccordionView() {
        const container = document.getElementById('exercices-content');

        if (this.banques.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Calculate global stats
        const totalExercises = this.exercices.filter(e =>
            this.banques.some(b => b.id === e.banque_id)
        ).length;
        const completedExercises = this.exercices.filter(e =>
            this.banques.some(b => b.id === e.banque_id) &&
            this.resultats.some(r => r.exercice_id === e.id)
        ).length;

        // Group exercises by banque
        const exercicesByBanque = {};
        this.exercices.forEach(exo => {
            if (!exercicesByBanque[exo.banque_id]) {
                exercicesByBanque[exo.banque_id] = [];
            }
            exercicesByBanque[exo.banque_id].push(exo);
        });

        // Sort exercises within each banque
        Object.keys(exercicesByBanque).forEach(banqueId => {
            exercicesByBanque[banqueId].sort((a, b) => (a.numero || 0) - (b.numero || 0));
        });

        let html = `
            <div class="type-header ${this.currentType}">
                <div class="type-header-left">
                    <div class="type-icon ${this.currentType}">
                        ${this.getTypeIconSVG()}
                    </div>
                    <div>
                        <h2 class="type-title">${this.getTypeLabel()}</h2>
                        <p class="type-subtitle">Entraîne-toi sur les ${this.getTypeLabel().toLowerCase()}</p>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat">
                        <div class="type-stat-value">${this.banques.length}</div>
                        <div class="type-stat-label">Banques</div>
                    </div>
                    <div class="type-stat">
                        <div class="type-stat-value">${completedExercises}/${totalExercises}</div>
                        <div class="type-stat-label">Exercices</div>
                    </div>
                </div>
            </div>

            <div class="banques-accordion">
        `;

        this.banques.forEach(banque => {
            const banqueExercices = exercicesByBanque[banque.id] || [];
            const completed = banqueExercices.filter(exo =>
                this.resultats.some(r => r.exercice_id === exo.id)
            ).length;
            const total = banqueExercices.length;
            const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const isExpanded = this.expandedBanques.has(banque.id);

            // Progress ring calculation (circumference = 2 * PI * radius)
            const radius = 18;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (percent / 100) * circumference;

            html += `
                <div class="banque-accordion-item ${this.currentType}${isExpanded ? ' expanded' : ''}" data-banque-id="${banque.id}">
                    <button class="banque-accordion-header" onclick="EleveExercices.toggleBanque('${banque.id}')">
                        <div class="banque-chevron">▶</div>
                        <div class="banque-info">
                            <div class="banque-title">${this.escapeHtml(banque.titre)}</div>
                            <div class="banque-meta">${total} exercice${total !== 1 ? 's' : ''}</div>
                        </div>
                        <div class="banque-progress">
                            <div class="progress-ring">
                                <svg viewBox="0 0 44 44">
                                    <circle class="progress-ring-bg" cx="22" cy="22" r="${radius}"/>
                                    <circle class="progress-ring-fill" cx="22" cy="22" r="${radius}"
                                        stroke-dasharray="${circumference}"
                                        stroke-dashoffset="${offset}"/>
                                </svg>
                                <span class="progress-ring-text">${percent}%</span>
                            </div>
                            <span class="progress-count">${completed}/${total}</span>
                        </div>
                    </button>
                    <div class="banque-accordion-content">
                        <div class="exercices-accordion-list">
                            ${this.renderExercisesList(banqueExercices)}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Render exercises list for a banque
     */
    renderExercisesList(exercices) {
        if (exercices.length === 0) {
            return '<div class="empty-state" style="padding: 2rem;"><p>Aucun exercice dans cette banque</p></div>';
        }

        return exercices.map(exo => {
            const format = this.formats.find(f => f.id === exo.format_id);
            const result = this.getExerciseResult(exo.id);
            const statusInfo = this.getStatusInfo(result);
            const isCompleted = result && result.score === 100;

            return `
                <div class="exercice-item ${this.currentType}${isCompleted ? ' completed' : ''}"
                     onclick="EleveExercices.startExercise('${exo.id}')">
                    <div class="exercice-numero">${exo.numero || '?'}</div>
                    <div class="exercice-info">
                        <div class="exercice-titre">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                        <div class="exercice-meta">
                            ${format ? format.nom : 'Format inconnu'}
                            ${exo.duree ? ` • ${Math.floor(exo.duree / 60)} min` : ''}
                            ${result && result.score < 100 ? ` • Meilleur: ${result.score}%` : ''}
                        </div>
                    </div>
                    <span class="exercice-status ${statusInfo.class}">${statusInfo.label}</span>
                    <span class="exercice-arrow">→</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Toggle banque accordion
     */
    toggleBanque(banqueId) {
        const item = document.querySelector(`.banque-accordion-item[data-banque-id="${banqueId}"]`);
        if (!item) return;

        if (this.expandedBanques.has(banqueId)) {
            this.expandedBanques.delete(banqueId);
            item.classList.remove('expanded');
        } else {
            this.expandedBanques.add(banqueId);
            item.classList.add('expanded');
        }
    },

    /**
     * Render empty state with SVG icon
     */
    renderEmptyState() {
        return `
            <div class="type-header ${this.currentType}">
                <div class="type-header-left">
                    <div class="type-icon ${this.currentType}">
                        ${this.getTypeIconSVG()}
                    </div>
                    <div>
                        <h2 class="type-title">${this.getTypeLabel()}</h2>
                        <p class="type-subtitle">Entraîne-toi sur les ${this.getTypeLabel().toLowerCase()}</p>
                    </div>
                </div>
            </div>
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                </div>
                <h3>Aucun exercice disponible</h3>
                <p>Les exercices de ${this.getTypeLabel().toLowerCase()} seront bientôt disponibles.</p>
            </div>
        `;
    },

    getExerciseResult(exerciceId) {
        return this.resultats.find(r => r.exercice_id === exerciceId);
    },

    getStatusInfo(result) {
        if (!result) {
            return { class: 'new', label: 'Nouveau' };
        }
        if (result.score === 100) {
            return { class: 'completed', label: 'Parfait' };
        }
        return { class: 'in-progress', label: `${result.score}%` };
    },

    /**
     * Start exercise
     */
    async startExercise(exerciceId) {
        this.showLoader('Chargement de l\'exercice...');

        try {
            const result = await this.callAPI('getExercice', { id: exerciceId });
            if (result.success && result.data) {
                this.currentExercise = result.data;
                this.currentBanque = this.banques.find(b => b.id === this.currentExercise.banque_id);
                this.exerciseStartTime = Date.now();
                this.renderExercise();
            } else {
                this.showError('Exercice non trouvé');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showError('Erreur lors du chargement de l\'exercice');
        }
    },

    /**
     * Render exercise view
     */
    renderExercise() {
        const exo = this.currentExercise;
        const banque = this.currentBanque;
        const format = this.formats.find(f => f.id === exo.format_id);

        let donnees = exo.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';
        let contentHTML = '';

        if (typeUI === 'tableau_saisie') {
            contentHTML = this.renderTableauSaisie(donnees, structure);
        } else if (typeUI === 'carte_cliquable') {
            contentHTML = this.renderCarteCliquable(donnees, structure);
        } else if (typeUI === 'document_tableau') {
            contentHTML = this.renderDocumentTableau(donnees, structure);
        } else if (typeUI === 'question_ouverte') {
            contentHTML = this.renderQuestionOuverte(donnees, structure);
        } else if (typeUI === 'document_mixte') {
            contentHTML = this.renderDocumentMixte(donnees, structure);
        } else {
            contentHTML = `
                <div style="text-align: center; color: #6b7280; padding: 2rem;">
                    <p>Type d'exercice non supporté: ${typeUI}</p>
                </div>
            `;
        }

        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="exercise-view">
                <button class="exercise-back-btn" onclick="EleveExercices.backToList()">
                    ← Retour aux exercices
                </button>

                <div class="exercise-card">
                    <div class="exercise-header ${this.currentType}">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${banque ? this.escapeHtml(banque.titre) : ''} - ${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</h1>
                                <div class="exercise-header-meta">${format ? format.nom : ''}</div>
                            </div>
                        </div>
                        ${exo.duree ? `
                            <div class="exercise-timer" id="exerciseTimer">
                                <span id="timerDisplay">${this.formatTime(exo.duree)}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${exo.consigne ? `
                        <div class="exercise-consigne">
                            ${this.escapeHtml(exo.consigne)}
                        </div>
                    ` : ''}

                    <div class="exercise-content">
                        ${contentHTML}
                    </div>

                    <div class="result-banner" id="resultBanner"></div>

                    <div class="exercise-actions">
                        <button class="btn btn-verifier" onclick="EleveExercices.validateExercise()">
                            Vérifier mes réponses
                        </button>
                        <button class="btn btn-corrige" onclick="EleveExercices.showCorrige()">
                            Voir le corrigé
                        </button>
                        <button class="btn btn-restart" onclick="EleveExercices.resetExercise()">
                            Recommencer
                        </button>
                    </div>
                </div>
            </div>
        `;

        if (exo.duree) {
            this.startTimer(exo.duree);
        }
    },

    /**
     * Back to accordion list
     */
    backToList() {
        this.stopTimer();
        this.currentExercise = null;
        this.renderAccordionView();
    },

    // ===============================
    // RENDER EXERCISE TYPES
    // ===============================

    renderTableauSaisie(donnees, structure) {
        let colonnes = donnees.colonnes || structure.colonnes || [
            { titre: 'Date', editable: false },
            { titre: 'Réponse', editable: true }
        ];
        const lignes = donnees.lignes || [];

        let html = `
            <table class="tableau-exercice">
                <thead>
                    <tr>
                        ${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            html += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    html += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    const value = cells[colIndex] || '';
                    html += `<td class="cell-display">${this.escapeHtml(value)}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    renderCarteCliquable(donnees, structure) {
        const imageUrl = this.convertToDirectImageUrl(donnees.image_url || '');
        const marqueurs = donnees.marqueurs || [];

        let marqueursHTML = marqueurs.map((m, index) => `
            <div class="carte-marqueur" data-id="${m.id || index}"
                 data-reponse="${this.escapeHtml(m.reponse || '')}"
                 style="left: ${m.x}%; top: ${m.y}%;"
                 onclick="EleveExercices.openMarqueurModal(${index})">
                <span class="marqueur-numero">${index + 1}</span>
                <span class="marqueur-reponse-badge hidden" id="badge_${index}"></span>
            </div>
        `).join('');

        this.carteMarqueurs = marqueurs;
        this.carteReponses = new Array(marqueurs.length).fill('');
        this.currentMarqueurIndex = null;

        return `
            <div class="carte-cliquable-container">
                <div class="carte-image-wrapper">
                    <img src="${this.escapeHtml(imageUrl)}" alt="Carte" class="carte-image">
                    <div class="carte-marqueurs">${marqueursHTML}</div>
                </div>
            </div>
            <div class="carte-modal-overlay hidden" id="marqueurModal">
                <div class="carte-modal">
                    <div class="carte-modal-header">
                        <h3>Élément n°<span id="modalMarqueurNum"></span></h3>
                        <button class="carte-modal-close" onclick="EleveExercices.closeMarqueurModal()">×</button>
                    </div>
                    <div class="carte-modal-body">
                        <label>Identifiez cet élément :</label>
                        <input type="text" id="marqueurInput" placeholder="Votre réponse..." autocomplete="off">
                    </div>
                    <div class="carte-modal-footer">
                        <button class="btn-cancel" onclick="EleveExercices.closeMarqueurModal()">Annuler</button>
                        <button class="btn-validate" onclick="EleveExercices.saveMarqueurReponse()">Valider</button>
                    </div>
                </div>
            </div>
        `;
    },

    openMarqueurModal(index) {
        this.currentMarqueurIndex = index;
        document.getElementById('modalMarqueurNum').textContent = index + 1;
        document.getElementById('marqueurInput').value = this.carteReponses[index] || '';
        document.getElementById('marqueurModal').classList.remove('hidden');
        document.getElementById('marqueurInput').focus();
    },

    closeMarqueurModal() {
        document.getElementById('marqueurModal').classList.add('hidden');
        this.currentMarqueurIndex = null;
    },

    saveMarqueurReponse() {
        const index = this.currentMarqueurIndex;
        if (index === null) return;

        const reponse = document.getElementById('marqueurInput').value.trim();
        this.carteReponses[index] = reponse;

        const badge = document.getElementById(`badge_${index}`);
        if (badge) {
            if (reponse) {
                badge.textContent = reponse;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (marqueur) {
            marqueur.classList.toggle('answered', reponse !== '');
        }

        this.closeMarqueurModal();
    },

    renderDocumentTableau(donnees, structure) {
        const doc = donnees.document || {};
        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let tableHTML = `
            <table class="tableau-exercice">
                <thead><tr>${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}</tr></thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            tableHTML += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    tableHTML += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    tableHTML += `<td class="cell-display">${this.escapeHtml(cells[colIndex] || '')}</td>`;
                }
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';

        return `
            <div class="document-tableau-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="tableau-section"><h4>À compléter</h4>${tableHTML}</div>
            </div>
        `;
    },

    renderQuestionOuverte(donnees, structure) {
        const doc = donnees.document || {};
        const questions = donnees.questions || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let questionsHTML = questions.map((q, qIndex) => {
            const etapesHTML = (q.etapes || []).map((etape, eIndex) => `
                <div class="question-etape">
                    <label>${this.escapeHtml(etape)}</label>
                    <textarea id="reponse_${qIndex}_${eIndex}" rows="2" placeholder="Votre réponse..."></textarea>
                </div>
            `).join('');

            return `
                <div class="question-ouverte-item" id="question_${qIndex}">
                    <h4>${this.escapeHtml(q.titre || `Question ${qIndex + 1}`)}</h4>
                    ${etapesHTML}
                    <div class="correction-box hidden" id="correctionBox_${qIndex}">
                        <h5>Correction</h5>
                        <div class="correction-content">${this.escapeHtml(q.reponse_attendue || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.questionsOuvertes = questions;

        return `
            <div class="question-ouverte-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="questions-section"><h4>Questions</h4>${questionsHTML}</div>
            </div>
        `;
    },

    renderDocumentMixte(donnees, structure) {
        const doc = donnees.document || { actif: false };
        const tableau = donnees.tableau || { actif: false };
        const questions = donnees.questions || { actif: false };
        const sectionOrder = donnees.sectionOrder || ['document', 'tableau', 'questions'];
        const layout = donnees.layout || 'vertical';

        this.mixteData = donnees;

        if (layout === 'horizontal' && doc.actif) {
            const docHTML = this.renderMixteDocumentSection(doc);
            let rightHTML = '';
            sectionOrder.forEach(section => {
                if (section === 'tableau' && tableau.actif) {
                    rightHTML += this.renderMixteTableauSection(tableau);
                } else if (section === 'questions' && questions.actif) {
                    rightHTML += this.renderMixteQuestionsSection(questions);
                }
            });

            return `
                <div class="document-mixte-container horizontal-layout">
                    <div class="mixte-left-column">${docHTML}</div>
                    <div class="mixte-right-column">${rightHTML}</div>
                </div>
            `;
        }

        let sectionsHTML = '';
        sectionOrder.forEach(section => {
            if (section === 'document' && doc.actif) {
                sectionsHTML += this.renderMixteDocumentSection(doc);
            } else if (section === 'tableau' && tableau.actif) {
                sectionsHTML += this.renderMixteTableauSection(tableau);
            } else if (section === 'questions' && questions.actif) {
                sectionsHTML += this.renderMixteQuestionsSection(questions);
            }
        });

        return `<div class="document-mixte-container">${sectionsHTML}</div>`;
    },

    renderMixteDocumentSection(doc) {
        const docType = doc.type || 'url';
        const url = doc.url || '';
        const texte = doc.texte || '';
        const titre = doc.titre || '';
        const legende = doc.legende || '';

        const legendeHTML = this.escapeHtml(legende).replace(/\*([^*]+)\*/g, '<em>$1</em>');

        let contentHTML = '';

        if (docType === 'texte' && texte) {
            contentHTML = this.textToHtml(texte);
        } else if (url) {
            const converted = this.convertGoogleUrl(url);
            if (converted.type === 'empty') {
                contentHTML = '<div class="doc-placeholder">Document non disponible</div>';
            } else if (converted.type === 'drive_file') {
                contentHTML = `
                    <img src="${converted.imageUrl}" alt="Document" class="mixte-doc-image"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <iframe src="${converted.iframeUrl}" class="mixte-doc-iframe" style="display:none;"></iframe>
                `;
            } else if (converted.iframeUrl) {
                contentHTML = `<iframe src="${converted.iframeUrl}" class="mixte-doc-iframe"></iframe>`;
            } else {
                contentHTML = `<img src="${this.convertToDirectImageUrl(url)}" alt="Document" class="mixte-doc-image">`;
            }
        } else {
            contentHTML = '<div class="doc-placeholder">Aucun document</div>';
        }

        return `
            <div class="mixte-section mixte-document">
                ${titre ? `<div class="mixte-section-header doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="mixte-doc-content ${docType === 'texte' ? 'doc-text-content' : ''}">${contentHTML}</div>
                ${legende ? `<div class="mixte-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    textToHtml(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        const paragraphs = html.split(/\n\s*\n/);
        return paragraphs.map(p => {
            const withBreaks = p.trim().replace(/\n/g, '<br>');
            return `<p>${withBreaks}</p>`;
        }).join('');
    },

    renderMixteTableauSection(tableau) {
        const titre = tableau.titre || 'À compléter';

        if (tableau.elements && tableau.elements.length > 0) {
            this.mixteTableauElements = tableau.elements;

            const elementsHTML = tableau.elements.map((el, idx) => {
                if (el.type === 'section') {
                    return `<div class="mixte-tableau-section-row">${this.escapeHtml(el.text)}</div>`;
                } else {
                    return `
                        <div class="mixte-tableau-row">
                            <div class="row-label">${this.escapeHtml(el.label)}</div>
                            <div class="row-input">
                                <input type="text" class="cell-input" id="mixte_element_${idx}"
                                       placeholder="${this.escapeHtml(el.placeholder || '')}" data-index="${idx}"
                                       data-reponse="${this.escapeHtml(el.reponse || '')}">
                            </div>
                        </div>
                    `;
                }
            }).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">${elementsHTML}</div>
                </div>
            `;
        } else {
            const colonnes = tableau.colonnes || [];
            const lignes = tableau.lignes || [];

            this.mixteTableauColonnes = colonnes;
            this.mixteTableauLignes = lignes;

            const headerHTML = colonnes.map(col =>
                `<th class="${col.editable ? 'editable-header' : ''}">${this.escapeHtml(col.titre)}</th>`
            ).join('');

            const bodyHTML = lignes.map((ligne, rowIdx) =>
                `<tr>${colonnes.map((col, colIdx) => {
                    if (col.editable) {
                        return `<td class="cell-editable">
                            <input type="text" class="cell-input" id="mixte_cell_${rowIdx}_${colIdx}" placeholder="..." data-row="${rowIdx}" data-col="${colIdx}">
                        </td>`;
                    } else {
                        return `<td>${this.escapeHtml(ligne.cells[colIdx] || '')}</td>`;
                    }
                }).join('')}</tr>`
            ).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">
                        <table class="mixte-table">
                            <thead><tr>${headerHTML}</tr></thead>
                            <tbody>${bodyHTML}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    },

    renderMixteQuestionsSection(questions) {
        const liste = questions.liste || [];
        this.mixteQuestions = liste;

        const questionsHTML = liste.map((q, idx) => `
            <div class="mixte-question-item" id="mixte_question_${idx}">
                <div class="mixte-question-text">${idx + 1}. ${this.escapeHtml(q.question)}</div>
                <textarea id="mixte_answer_${idx}" class="mixte-question-textarea" placeholder="Votre réponse..." rows="3"></textarea>
                <div class="mixte-correction hidden" id="mixte_correction_${idx}">
                    <strong>Correction:</strong> ${this.escapeHtml(q.reponse_attendue || '')}
                </div>
            </div>
        `).join('');

        return `
            <div class="mixte-section mixte-questions">
                <div class="mixte-section-header questions-header">Questions</div>
                <div class="mixte-questions-content">${questionsHTML}</div>
            </div>
        `;
    },

    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

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

        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            return { type: 'google_doc', id: docsMatch[1], iframeUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview` };
        }

        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            return { type: 'google_sheet', id: sheetsMatch[1], iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview` };
        }

        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            return { type: 'google_slide', id: slidesMatch[1], iframeUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed` };
        }

        return { type: 'direct_url', url: url, imageUrl: url };
    },

    // ===============================
    // VALIDATION
    // ===============================

    async validateExercise() {
        if (!this.currentExercise) return;

        this.stopTimer();

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';
        let result;

        if (typeUI === 'carte_cliquable') {
            result = this.validateCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            result = this.validateQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            result = this.validateDocumentMixte();
        } else {
            result = this.validateTableauSaisie();
        }

        const { correct, total } = result;
        const banner = document.getElementById('resultBanner');
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        if (percent === 100) {
            banner.className = 'result-banner show success';
            banner.textContent = `Parfait ! ${correct}/${total} réponses correctes`;
        } else if (percent >= 50) {
            banner.className = 'result-banner show partial';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        } else {
            banner.className = 'result-banner show error';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        }

        await this.saveResult(correct, total, percent);
    },

    validateTableauSaisie() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];
        let correct = 0, total = 0;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    total++;
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    if (!input) return;

                    const userAnswer = this.normalizeAnswer(input.value);
                    const correctAnswer = this.normalizeAnswer(cells[colIndex] || '');

                    if (userAnswer === correctAnswer) {
                        input.className = 'correct';
                        correct++;
                    } else {
                        input.className = 'incorrect';
                        // DON'T show correction here - only mark as incorrect
                    }
                    // Don't disable input so student can retry
                }
            });
        });

        return { correct, total };
    },

    validateCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];
        let correct = 0, total = marqueurs.length;

        marqueurs.forEach((m, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            const userAnswer = this.normalizeAnswer(reponses[index] || '');
            const correctAnswer = this.normalizeAnswer(m.reponse || '');

            if (userAnswer === correctAnswer && userAnswer !== '') {
                if (marqueur) marqueur.classList.add('correct');
                if (badge) badge.classList.add('correct');
                correct++;
            } else {
                if (marqueur) marqueur.classList.add('incorrect');
                if (badge) badge.classList.add('incorrect');
            }
        });

        // Don't disable markers - student can still modify and retry

        return { correct, total };
    },

    validateQuestionOuverte() {
        // Question ouverte: no auto-correction possible, just mark as answered
        const questions = this.questionsOuvertes || [];
        let hasAnswers = false;

        questions.forEach((q, qIndex) => {
            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea && textarea.value.trim()) {
                    hasAnswers = true;
                    textarea.classList.add('answered');
                }
            });
        });

        // Don't show correction boxes yet - wait for "Voir le corrigé"
        return { correct: 0, total: 0 };
    },

    validateDocumentMixte() {
        let correct = 0, total = 0;
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row' && el.reponse) {
                        total++;
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            const userAnswer = this.normalizeAnswer(input.value);
                            const correctAnswer = this.normalizeAnswer(el.reponse);

                            if (userAnswer === correctAnswer && userAnswer !== '') {
                                input.classList.add('correct');
                                input.classList.remove('incorrect');
                                correct++;
                            } else {
                                input.classList.add('incorrect');
                                input.classList.remove('correct');
                            }
                            // Don't disable - allow retry
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((ligne, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            total++;
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                const userAnswer = this.normalizeAnswer(input.value);
                                const correctAnswer = this.normalizeAnswer(ligne.cells[colIdx] || '');

                                if (userAnswer === correctAnswer && userAnswer !== '') {
                                    input.classList.add('correct');
                                    input.classList.remove('incorrect');
                                    correct++;
                                } else {
                                    input.classList.add('incorrect');
                                    input.classList.remove('correct');
                                    // DON'T show correction - only mark as incorrect
                                }
                                // Don't disable - allow retry
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif) {
            const questions = this.mixteQuestions || [];
            questions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                if (textarea && textarea.value.trim()) {
                    textarea.classList.add('answered');
                }
                // DON'T show correction yet - wait for "Voir le corrigé"
            });
        }

        return { correct, total };
    },

    async saveResult(correct, total, percent) {
        if (!this.currentUser || !this.currentUser.id || !this.currentExercise) return;

        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;

        const resultData = {
            eleve_id: this.currentUser.id,
            exercice_id: this.currentExercise.id,
            banque_id: this.currentExercise.banque_id,
            score: percent,
            bonnes_reponses: correct,
            total_questions: total,
            temps_passe: timeSpent,
            date: new Date().toISOString()
        };

        try {
            const result = await this.callAPI('saveResultatExercice', resultData);
            if (result.success) {
                this.updateLocalResult(resultData);
            }
        } catch (e) {}
    },

    updateLocalResult(newResult) {
        const existingIndex = this.resultats.findIndex(r => r.exercice_id === newResult.exercice_id);
        if (existingIndex >= 0) {
            if (newResult.score > this.resultats[existingIndex].score) {
                this.resultats[existingIndex] = newResult;
            }
        } else {
            this.resultats.push(newResult);
        }
        this.saveResultatsToCache(this.resultats);
    },

    normalizeAnswer(str) {
        return String(str).toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    // ===============================
    // SHOW CORRIGE
    // ===============================

    showCorrige() {
        this.stopTimer(); // Stop timer when showing correction

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }
        const typeUI = structure ? structure.type_ui : 'tableau_saisie';

        if (typeUI === 'carte_cliquable') {
            this.showCarteCorrige();
        } else if (typeUI === 'document_mixte') {
            this.showDocumentMixteCorrige();
        } else if (typeUI === 'question_ouverte') {
            this.showQuestionOuverteCorrige();
        } else if (typeUI === 'tableau_saisie' || typeUI === 'document_tableau') {
            this.showTableauCorrige();
        }

        const banner = document.getElementById('resultBanner');
        banner.className = 'result-banner show info';
        banner.textContent = 'Voici le corrigé complet.';
    },

    showCarteCorrige() {
        const marqueurs = this.carteMarqueurs || [];
        marqueurs.forEach((m, index) => {
            const badge = document.getElementById(`badge_${index}`);
            if (badge) {
                badge.textContent = m.reponse || '';
                badge.classList.remove('hidden', 'incorrect');
                badge.classList.add('correction');
            }
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            if (marqueur) {
                marqueur.classList.remove('incorrect');
                marqueur.classList.add('show-correction');
            }
        });
    },

    showQuestionOuverteCorrige() {
        const questions = this.questionsOuvertes || [];
        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.remove('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) textarea.disabled = true;
            });
        });
    },

    showDocumentMixteCorrige() {
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
            this.mixteTableauElements.forEach((el, idx) => {
                if (el.type === 'row' && el.reponse) {
                    const input = document.getElementById(`mixte_element_${idx}`);
                    if (input) {
                        input.value = el.reponse;
                        input.classList.remove('incorrect', 'correct');
                        input.classList.add('corrected');
                        input.disabled = true;
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) textarea.disabled = true;
                if (correctionDiv && q.reponse_attendue) {
                    correctionDiv.innerHTML = `<strong>Réponse attendue :</strong> ${this.escapeHtml(q.reponse_attendue)}`;
                    correctionDiv.style.display = 'block';
                }
            });
        }
    },

    showTableauCorrige() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((ligne, rowIdx) => {
            colonnes.forEach((col, colIdx) => {
                if (col.editable) {
                    const input = document.getElementById(`input_${rowIdx}_${colIdx}`);
                    if (input) {
                        input.value = ligne.cells[colIdx] || '';
                        input.classList.remove('incorrect', 'correct');
                        input.classList.add('corrected');
                        input.disabled = true;
                    }
                }
            });
        });
    },

    // ===============================
    // RESET
    // ===============================

    resetExercise() {
        if (!this.currentExercise) return;

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';

        if (typeUI === 'carte_cliquable') {
            this.resetCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            this.resetQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            this.resetDocumentMixte();
        } else {
            this.resetTableauSaisie();
        }

        // Hide result banner
        document.getElementById('resultBanner').className = 'result-banner';

        // Reset start time for tracking
        this.exerciseStartTime = Date.now();

        // Restart timer
        if (this.currentExercise.duree) {
            this.startTimer(this.currentExercise.duree);
        }
    },

    resetDocumentMixte() {
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
            this.mixteTableauElements.forEach((el, idx) => {
                if (el.type === 'row') {
                    const input = document.getElementById(`mixte_element_${idx}`);
                    if (input) {
                        input.value = '';
                        input.className = 'cell-input';
                        input.disabled = false;
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
                if (correctionDiv) {
                    correctionDiv.style.display = 'none';
                    correctionDiv.innerHTML = '';
                }
            });
        }
    },

    resetTableauSaisie() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((_, rowIndex) => {
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    const correction = document.getElementById(`correction_${rowIndex}_${colIndex}`);
                    if (input) {
                        input.value = '';
                        input.className = '';
                        input.disabled = false;
                    }
                    if (correction) correction.textContent = '';
                }
            });
        });
    },

    resetCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        this.carteReponses = new Array(marqueurs.length).fill('');

        marqueurs.forEach((_, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            if (badge) {
                badge.textContent = '';
                badge.classList.add('hidden');
                badge.classList.remove('correct', 'incorrect', 'correction');
            }
            if (marqueur) {
                marqueur.classList.remove('correct', 'incorrect', 'answered', 'show-correction');
                marqueur.style.pointerEvents = '';
            }
        });
    },

    resetQuestionOuverte() {
        const questions = this.questionsOuvertes || [];

        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.add('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
            });
        });
    },

    // ===============================
    // TIMER
    // ===============================

    startTimer(seconds) {
        this.stopTimer();
        this.timeRemaining = seconds;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.stopTimer();
                this.validateExercise();
            }
        }, 1000);
    },

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    updateTimerDisplay() {
        const display = document.getElementById('timerDisplay');
        const timerEl = document.getElementById('exerciseTimer');
        if (display) display.textContent = this.formatTime(this.timeRemaining);
        if (timerEl && this.timeRemaining <= 60) timerEl.classList.add('warning');
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ===============================
    // HELPERS
    // ===============================

    getTypeLabel() {
        const labels = {
            'savoir-faire': 'Savoir-faire',
            'connaissances': 'Connaissances',
            'competences': 'Compétences'
        };
        return labels[this.currentType] || this.currentType;
    },

    getTypeIconSVG() {
        // Simple SVG icons for each type
        const icons = {
            'savoir-faire': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#d97706" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>',
            'connaissances': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#059669" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>',
            'competences': '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#7c3aed" width="28" height="28"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>'
        };
        return icons[this.currentType] || icons['connaissances'];
    },

    showLoader(message) {
        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="page-loader">
                <div class="spinner"></div>
                <p>${message || 'Chargement...'}</p>
            </div>
        `;
    },

    showError(message) {
        const container = document.getElementById('exercices-content');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    convertToDirectImageUrl(url) {
        if (!url) return url;
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }
        return url;
    }
};

// Export global
window.EleveExercices = EleveExercices;
