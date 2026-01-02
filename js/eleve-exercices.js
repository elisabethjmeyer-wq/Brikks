/**
 * Exercices Élève - Logique JavaScript
 * Gestion des exercices d'entraînement pour les élèves
 */

const EleveExercices = {
    // Type courant (savoir-faire, connaissances, competences)
    currentType: 'savoir-faire',

    // Données
    banques: [],
    exercices: [],
    formats: [],
    resultats: [], // Résultats de l'élève

    // État
    currentBanque: null,
    currentExercise: null,
    timer: null,
    timeRemaining: 0,
    exerciseStartTime: null, // Pour calculer le temps passé
    currentUser: null, // Utilisateur connecté

    // Cache config (5 minutes TTL)
    CACHE_KEY: 'brikks_exercices_cache',
    CACHE_RESULTATS_KEY: 'brikks_resultats_cache',
    CACHE_TTL: 5 * 60 * 1000,

    /**
     * Initialise la page d'exercices
     * @param {string} type - Type d'exercices (savoir-faire, connaissances, competences)
     */
    async init(type) {
        this.currentType = type;

        // Get current user from auth
        this.currentUser = await this.getCurrentUser();

        // Try to load from cache first for instant display
        const cached = this.loadFromCache();
        if (cached) {
            console.log('[Cache] Using cached data');
            this.applyData(cached.banques, cached.exercices, cached.formats);

            // Load cached results
            const cachedResultats = this.loadResultatsFromCache();
            if (cachedResultats) {
                this.resultats = cachedResultats;
            }

            this.renderBanquesList();

            // Refresh in background (silently)
            this.refreshDataInBackground();
            this.refreshResultatsInBackground();
        } else {
            // No cache, show loader and fetch
            this.showLoader('Chargement des exercices...');
            try {
                await this.loadData();
                await this.loadResultats();
                this.renderBanquesList();
            } catch (error) {
                console.error('Erreur lors du chargement:', error);
                this.showError('Erreur lors du chargement des exercices');
            }
        }
    },

    /**
     * Get current user from auth system
     */
    async getCurrentUser() {
        try {
            if (typeof Auth !== 'undefined' && Auth.user) {
                return Auth.user;
            }
            // Fallback: try to get from session
            const session = localStorage.getItem('brikks_session');
            if (session) {
                return JSON.parse(session);
            }
            return null;
        } catch (e) {
            console.log('Could not get current user:', e);
            return null;
        }
    },

    /**
     * Load results from cache
     */
    loadResultatsFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_RESULTATS_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();

            if (data.timestamp && (now - data.timestamp) < this.CACHE_TTL) {
                return data.resultats || [];
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    /**
     * Save results to cache
     */
    saveResultatsToCache(resultats) {
        try {
            const data = {
                resultats,
                timestamp: Date.now()
            };
            localStorage.setItem(this.CACHE_RESULTATS_KEY, JSON.stringify(data));
        } catch (e) {
            console.log('[Cache] Error saving resultats:', e);
        }
    },

    /**
     * Load student results from API
     */
    async loadResultats() {
        if (!this.currentUser || !this.currentUser.id) {
            console.log('No user logged in, skipping results load');
            return;
        }

        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
            }
        } catch (e) {
            console.log('Could not load results:', e);
        }
    },

    /**
     * Refresh results in background
     */
    async refreshResultatsInBackground() {
        if (!this.currentUser || !this.currentUser.id) return;

        try {
            const result = await this.callAPI('getResultatsEleve', { eleve_id: this.currentUser.id });
            if (result.success && result.data) {
                this.resultats = result.data;
                this.saveResultatsToCache(this.resultats);
                console.log('[Cache] Results refreshed in background');
            }
        } catch (e) {
            console.log('[Cache] Background results refresh failed:', e);
        }
    },

    /**
     * Load data from localStorage cache
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = Date.now();

            // Check if cache is still valid
            if (data.timestamp && (now - data.timestamp) < this.CACHE_TTL) {
                return data;
            }

            console.log('[Cache] Cache expired');
            return null;
        } catch (e) {
            console.log('[Cache] Error reading cache:', e);
            return null;
        }
    },

    /**
     * Save data to localStorage cache
     */
    saveToCache(banques, exercices, formats) {
        try {
            const data = {
                banques,
                exercices,
                formats,
                timestamp: Date.now()
            };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
            console.log('[Cache] Data saved to cache');
        } catch (e) {
            console.log('[Cache] Error saving cache:', e);
        }
    },

    /**
     * Apply loaded data and filter for current type
     */
    applyData(banques, exercices, formats) {
        this.banques = (banques || []).filter(b =>
            b.type === this.currentType && b.statut === 'publie'
        );
        this.exercices = (exercices || []).filter(e => e.statut === 'publie');
        this.formats = formats || [];

        // Trier les banques par ordre
        this.banques.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    },

    /**
     * Refresh data in background without blocking UI
     */
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

            // Save fresh data to cache
            this.saveToCache(banques, exercices, formats);

            // Update current data
            this.applyData(banques, exercices, formats);
            console.log('[Cache] Background refresh complete');
        } catch (error) {
            console.log('[Cache] Background refresh failed:', error);
        }
    },

    /**
     * Charge les données depuis l'API
     */
    async loadData() {
        const [banquesResult, exercicesResult, formatsResult] = await Promise.all([
            this.callAPI('getBanquesExercices'),
            this.callAPI('getExercices'),
            this.callAPI('getFormatsExercices')
        ]);

        const banques = banquesResult.success ? banquesResult.data : [];
        const exercices = exercicesResult.success ? exercicesResult.data : [];
        const formats = formatsResult.success ? formatsResult.data : [];

        // Save to cache
        this.saveToCache(banques, exercices, formats);

        // Apply data
        this.applyData(banques, exercices, formats);
    },

    /**
     * Appel API avec JSONP
     */
    callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
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
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed'));
            };

            document.body.appendChild(script);
        });
    },

    /**
     * Affiche la liste des banques
     */
    renderBanquesList() {
        const container = document.getElementById('exercices-content');

        if (this.banques.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📚</div>
                    <h3>Aucun exercice disponible</h3>
                    <p>Les exercices de ${this.getTypeLabel()} seront bientôt disponibles.</p>
                </div>
            `;
            return;
        }

        // Compte des exercices par banque
        const exercicesByBanque = {};
        this.exercices.forEach(exo => {
            if (!exercicesByBanque[exo.banque_id]) {
                exercicesByBanque[exo.banque_id] = [];
            }
            exercicesByBanque[exo.banque_id].push(exo);
        });

        let html = `
            <div class="type-header">
                <h2>${this.getTypeIcon()} ${this.getTypeLabel()}</h2>
                <p>Entraîne-toi sur les ${this.getTypeLabel().toLowerCase()}</p>
            </div>
            <div class="banques-grid">
        `;

        this.banques.forEach(banque => {
            const exoCount = exercicesByBanque[banque.id] ? exercicesByBanque[banque.id].length : 0;

            html += `
                <div class="banque-card" onclick="EleveExercices.openBanque('${banque.id}')">
                    <div class="banque-card-header">
                        <div class="banque-card-title">${this.escapeHtml(banque.titre)}</div>
                        ${banque.description ? `<div class="banque-card-desc">${this.escapeHtml(banque.description)}</div>` : ''}
                    </div>
                    <div class="banque-card-footer">
                        <div class="banque-exo-count">
                            <strong>${exoCount}</strong> exercice${exoCount !== 1 ? 's' : ''}
                        </div>
                        <button class="banque-btn">S'entraîner →</button>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Ouvre une banque et affiche ses exercices
     */
    openBanque(banqueId) {
        this.currentBanque = this.banques.find(b => b.id === banqueId);
        if (!this.currentBanque) return;

        const banqueExercices = this.exercices
            .filter(e => e.banque_id === banqueId)
            .sort((a, b) => (a.numero || 0) - (b.numero || 0));

        // Calculate progress for this banque
        const completed = banqueExercices.filter(exo =>
            this.resultats.some(r => r.exercice_id === exo.id)
        ).length;
        const progressPercent = banqueExercices.length > 0
            ? Math.round((completed / banqueExercices.length) * 100)
            : 0;

        const container = document.getElementById('exercices-content');

        let html = `
            <button class="exercise-back-btn" onclick="EleveExercices.renderBanquesList()">
                ← Retour aux banques
            </button>

            <div class="type-header">
                <h2>${this.escapeHtml(this.currentBanque.titre)}</h2>
                ${this.currentBanque.description ? `<p>${this.escapeHtml(this.currentBanque.description)}</p>` : ''}
            </div>

            ${banqueExercices.length > 0 ? `
                <div class="progress-section">
                    <div class="progress-header">
                        <h3>Ta progression</h3>
                        <span class="progress-stats">${completed}/${banqueExercices.length} exercices complétés</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            ` : ''}
        `;

        if (banqueExercices.length === 0) {
            html += `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>Aucun exercice dans cette banque</h3>
                    <p>Des exercices seront bientôt ajoutés.</p>
                </div>
            `;
        } else {
            html += '<div class="exercices-list">';

            banqueExercices.forEach(exo => {
                const format = this.formats.find(f => f.id === exo.format_id);
                const result = this.getExerciseResult(exo.id);
                const statusInfo = this.getStatusInfo(result);

                html += `
                    <div class="exercice-item" onclick="EleveExercices.startExercise('${exo.id}')">
                        <div class="exercice-numero">${exo.numero || '?'}</div>
                        <div class="exercice-info">
                            <div class="exercice-titre">${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</div>
                            <div class="exercice-meta">
                                ${format ? format.nom : 'Format inconnu'}
                                ${exo.duree ? ` • ${Math.floor(exo.duree / 60)} min` : ''}
                                ${result ? ` • Meilleur score: ${result.score}%` : ''}
                            </div>
                        </div>
                        <span class="exercice-status ${statusInfo.class}">${statusInfo.label}</span>
                    </div>
                `;
            });

            html += '</div>';
        }

        container.innerHTML = html;
    },

    /**
     * Get the best result for an exercise
     */
    getExerciseResult(exerciceId) {
        return this.resultats.find(r => r.exercice_id === exerciceId);
    },

    /**
     * Get status info (class and label) based on result
     */
    getStatusInfo(result) {
        if (!result) {
            return { class: 'new', label: 'Nouveau' };
        }

        if (result.score === 100) {
            return { class: 'completed', label: '✓ Parfait' };
        } else if (result.score >= 50) {
            return { class: 'in-progress', label: `${result.score}%` };
        } else {
            return { class: 'in-progress', label: `${result.score}%` };
        }
    },

    /**
     * Démarre un exercice
     */
    async startExercise(exerciceId) {
        this.showLoader('Chargement de l\'exercice...');

        try {
            const result = await this.callAPI('getExercice', { id: exerciceId });

            if (result.success && result.data) {
                this.currentExercise = result.data;
                this.exerciseStartTime = Date.now(); // Track start time
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
     * Affiche l'exercice
     */
    renderExercise() {
        const exo = this.currentExercise;
        const banque = this.currentBanque || this.banques.find(b => b.id === exo.banque_id);
        const format = this.formats.find(f => f.id === exo.format_id);

        // Parse des données
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
                <button class="exercise-back-btn" onclick="EleveExercices.backToExercices()">
                    ← Retour aux exercices
                </button>

                <div class="exercise-card">
                    <div class="exercise-header ${this.currentType}">
                        <h1>${this.escapeHtml(exo.titre || 'Exercice ' + exo.numero)}</h1>
                        <div class="exercise-header-meta">
                            ${banque ? this.escapeHtml(banque.titre) : ''} • ${format ? format.nom : 'Format inconnu'}
                        </div>
                        ${exo.duree ? `
                            <div class="exercise-timer" id="exerciseTimer">
                                ⏱️ <span id="timerDisplay">${this.formatTime(exo.duree)}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${exo.consigne ? `
                        <div class="exercise-consigne">
                            ${this.escapeHtml(exo.consigne)}
                        </div>
                    ` : ''}

                    <div class="result-banner" id="resultBanner"></div>

                    <div class="exercise-content">
                        ${contentHTML}
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-secondary" onclick="EleveExercices.resetExercise()">
                            Recommencer
                        </button>
                        <button class="btn btn-primary" onclick="EleveExercices.validateExercise()">
                            Valider mes réponses
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Démarrer le timer si durée définie
        if (exo.duree) {
            this.startTimer(exo.duree);
        }
    },

    /**
     * Rend un tableau de saisie
     */
    renderTableauSaisie(donnees, structure) {
        // Support du nouveau format (colonnes dans donnees) et de l'ancien format
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
                            <input type="text"
                                   id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}"
                                   data-col="${colIndex}"
                                   placeholder="..."
                                   autocomplete="off">
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

    /**
     * Valide les réponses de l'exercice
     */
    async validateExercise() {
        if (!this.currentExercise) return;

        // Arrêter le timer
        this.stopTimer();

        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];
        let correct = 0;
        let total = 0;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);

            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    total++;
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    const correction = document.getElementById(`correction_${rowIndex}_${colIndex}`);
                    if (!input) return;

                    const userAnswer = this.normalizeAnswer(input.value);
                    const correctAnswer = this.normalizeAnswer(cells[colIndex] || '');

                    if (userAnswer === correctAnswer) {
                        input.className = 'correct';
                        if (correction) correction.textContent = '';
                        correct++;
                    } else {
                        input.className = 'incorrect';
                        if (correction) correction.textContent = '→ ' + (cells[colIndex] || '');
                    }

                    input.disabled = true;
                }
            });
        });

        // Afficher le résultat
        const banner = document.getElementById('resultBanner');
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        if (percent === 100) {
            banner.className = 'result-banner show success';
            banner.textContent = `🎉 Parfait ! ${correct}/${total} réponses correctes`;
        } else if (percent >= 50) {
            banner.className = 'result-banner show partial';
            banner.textContent = `📊 ${correct}/${total} réponses correctes (${percent}%)`;
        } else {
            banner.className = 'result-banner show error';
            banner.textContent = `📊 ${correct}/${total} réponses correctes (${percent}%)`;
        }

        // Save result to server
        await this.saveResult(correct, total, percent);
    },

    /**
     * Save exercise result to the server
     */
    async saveResult(correct, total, percent) {
        if (!this.currentUser || !this.currentUser.id || !this.currentExercise) {
            console.log('Cannot save result: no user or exercise');
            return;
        }

        // Calculate time spent
        const timeSpent = this.exerciseStartTime
            ? Math.round((Date.now() - this.exerciseStartTime) / 1000)
            : 0;

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
                console.log('Result saved successfully');
                // Update local results cache
                this.updateLocalResult(resultData);
            } else {
                console.log('Failed to save result:', result.error);
            }
        } catch (e) {
            console.log('Error saving result:', e);
        }
    },

    /**
     * Update local results after saving
     */
    updateLocalResult(newResult) {
        // Find existing result for this exercise
        const existingIndex = this.resultats.findIndex(
            r => r.exercice_id === newResult.exercice_id
        );

        if (existingIndex >= 0) {
            // Update existing (keep best score)
            const existing = this.resultats[existingIndex];
            if (newResult.score > existing.score) {
                this.resultats[existingIndex] = newResult;
            }
        } else {
            // Add new result
            this.resultats.push(newResult);
        }

        // Update cache
        this.saveResultatsToCache(this.resultats);
    },

    /**
     * Normalise une réponse pour comparaison
     */
    normalizeAnswer(str) {
        return String(str).toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    /**
     * Réinitialise l'exercice
     */
    resetExercise() {
        if (!this.currentExercise) return;

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
                    if (correction) {
                        correction.textContent = '';
                    }
                }
            });
        });

        document.getElementById('resultBanner').className = 'result-banner';

        // Redémarrer le timer si durée définie
        if (this.currentExercise.duree) {
            this.startTimer(this.currentExercise.duree);
        }
    },

    /**
     * Retour aux exercices de la banque
     */
    backToExercices() {
        this.stopTimer();
        if (this.currentBanque) {
            this.openBanque(this.currentBanque.id);
        } else {
            this.renderBanquesList();
        }
    },

    /**
     * Timer
     */
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
        if (display) {
            display.textContent = this.formatTime(this.timeRemaining);
        }
        if (timerEl && this.timeRemaining <= 60) {
            timerEl.classList.add('warning');
        }
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Helpers
     */
    getTypeLabel() {
        const labels = {
            'savoir-faire': 'Savoir-faire',
            'connaissances': 'Connaissances',
            'competences': 'Compétences'
        };
        return labels[this.currentType] || this.currentType;
    },

    getTypeIcon() {
        const icons = {
            'savoir-faire': '🟠',
            'connaissances': '🟢',
            'competences': '🟣'
        };
        return icons[this.currentType] || '📚';
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
                <div class="empty-state-icon">❌</div>
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
    }
};

// Export global
window.EleveExercices = EleveExercices;
