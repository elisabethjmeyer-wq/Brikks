/**
 * Moteur d'Evaluation Eleve
 * Pilote EleveConnaissances ou EleveExercices en "mode évaluation"
 * pour réutiliser les rendus et validations des modules d'entraînement.
 *
 * Type connaissances → piloté via EleveConnaissances (étapes, formats QCM/VF/etc.)
 * Type savoir-faire  → piloté via EleveExercices (format unique : tableau, carte, etc.)
 */

const EleveEvaluation = {
    // État évaluation
    evaluation: null,
    duration: 0,
    remainingTime: 0,
    timerInterval: null,
    timeExpired: false,
    isSubmitting: false,

    // SF : résultat de validation stocké pour finishEvaluation
    _sfValidationResult: null,

    // ========== INITIALISATION ==========
    async init() {
        try {
            const params = new URLSearchParams(window.location.search);
            const evalId = params.get('id');

            if (!evalId || evalId === 'test') {
                throw new Error('ID d\'évaluation manquant');
            }

            await this.loadEvaluation(evalId);

            // Bifurquer selon le type d'évaluation
            if (this.evaluation.type === 'savoir-faire') {
                this.setupSFModule();
            } else {
                this.setupConnaissancesModule();
            }

            this._addBeforeUnload();
            this.startTimer();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError(error.message || 'Erreur lors du chargement de l\'évaluation');
        }
    },

    // ========== CHARGEMENT ==========
    async loadEvaluation(evalId) {
        const eleveId = this._getCurrentUserId();
        let response;
        if (eleveId) {
            response = await this.callAPI('getEvaluationForEleve', { id: evalId, eleve_id: eleveId });
        } else {
            response = await this.callAPI('getEvaluation', { id: evalId });
        }

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Évaluation non trouvée');
        }

        const data = response.data;

        this.evaluation = {
            id: data.id,
            titre: data.titre,
            type: data.type,
            chapitre_id: data.chapitre_id,
            chapitre_nom: data.chapitre_nom,
            description: data.description,
            briques: parseInt(data.briques) || 1,
            seuil: parseInt(data.seuil) || 80,
            methodologie_id: data.methodologie_id,
            criteres: data.criteres,
            attribution: data.attribution
        };

        // Durée en secondes (priorité : données entraînement > évaluation > défaut)
        const dureeMinutes = parseInt(data.duree) || 15;
        this.duration = dureeMinutes * 60;
        this.remainingTime = this.duration;

        if (data.type === 'savoir-faire') {
            // SF : le backend renvoie data.questions (array d'un exercice)
            this._rawSFQuestions = data.questions || [];
            if (this._rawSFQuestions.length === 0) {
                throw new Error('Aucun exercice disponible pour cette évaluation');
            }
        } else {
            // Connaissances : données structurées par étape
            this._rawEtapes = data.etapes || [];
            this._rawEtapeQuestions = data.etapeQuestions || [];
            this._rawQuestionsConnaissances = data.questionsConnaissances || [];
            this._rawEntrainementData = data.entrainementData || {};

            if (this._rawEtapes.length === 0) {
                throw new Error('Aucune étape disponible pour cette évaluation');
            }
        }
    },

    // ========== SETUP CONNAISSANCES ==========

    /**
     * Injecte les données dans EleveConnaissances et configure le mode évaluation.
     * Remplace certaines méthodes pour piloter le flow depuis l'évaluation.
     */
    setupConnaissancesModule() {
        const EC = EleveConnaissances;
        const self = this;

        // Injecter les données
        EC.etapes = this._rawEtapes;
        EC.etapeQuestions = this._rawEtapeQuestions;
        EC.questionsConnaissances = this._rawQuestionsConnaissances;

        // Initialiser l'état d'entraînement
        EC.currentEtapes = this._rawEtapes;
        EC.currentEtapeIndex = 0;
        EC.currentEtapeValidated = false;
        EC.etapesResults = [];
        EC.selectedQuestionsPerEtape = {};
        EC.userAnswers = {};
        EC._answerStore = {};
        EC._multiFormatState = null;

        // Faux entraînement/banque pour le rendu du header
        EC.currentEntrainement = {
            id: 'eval_' + this.evaluation.id,
            titre: this.evaluation.titre,
            duree: null, // Timer géré par EleveEvaluation
            seuil: this.evaluation.seuil
        };
        EC.currentBanque = {
            id: 'eval_banque',
            titre: this.evaluation.chapitre_nom || ''
        };

        // Remplacer finishEntrainement pour déclencher la logique évaluation
        EC.finishEntrainement = function() {
            self.finishEvaluation();
        };

        // Remplacer handleTimeUp
        EC.handleTimeUp = function() {
            self.onTimeExpired();
        };

        // Désactiver backToList — l'élève ne peut pas quitter pendant l'évaluation
        EC.backToList = function() {
            // Bloquer la navigation — l'évaluation doit être terminée
        };

        // Remplacer renderEntrainementView pour utiliser le layout évaluation
        EC.renderEntrainementView = function() {
            self.renderExerciseView();
        };
    },

    // ========== SETUP SAVOIR-FAIRE ==========

    /**
     * Configure EleveExercices en mode évaluation pour un exercice SF.
     * L'exercice est injecté directement (pas d'appel API getExercice).
     */
    setupSFModule() {
        const EE = EleveExercices;
        const question = this._rawSFQuestions[0];

        // Construire un objet exercice compatible avec EleveExercices
        EE.currentExercise = {
            id: question.id,
            titre: question.enonce || 'Exercice',
            donnees: typeof question.donnees === 'string'
                ? question.donnees
                : JSON.stringify(question.donnees || {}),
            format_id: question.format_id || (question.format && question.format.id) || '',
            duree: null, // Timer géré par EleveEvaluation, pas par EleveExercices
            consigne: question.consigne || ''
        };

        // Stocker le format pour que getFormatHandler fonctionne
        EE.formats = question.format ? [question.format] : [];
        EE.currentType = 'savoir-faire';
        EE.isEntrainementLibre = false;
        EE.exerciseStartTime = Date.now();
        EE.isValidating = false;

        // Empêcher le timer SF de démarrer (on utilise celui de l'évaluation)
        EE.startTimer = function() {};
        EE.stopTimer = function() {};
    },

    // ========== RENDU PRINCIPAL ==========
    render() {
        if (this.evaluation.type === 'savoir-faire') {
            this.renderSFExerciseView();
        } else {
            this.renderExerciseView();
        }
    },

    /**
     * Rendu de la vue exercice connaissances dans le conteneur de l'évaluation.
     * Réutilise le même layout que les entraînements (exercise-card)
     * et délègue le contenu à EleveConnaissances.renderEtapeContent().
     */
    renderExerciseView() {
        const EC = EleveConnaissances;
        const etapes = EC.currentEtapes;
        const currentEtape = etapes[EC.currentEtapeIndex];
        const isValidated = EC.currentEtapeValidated;
        const isLastEtape = EC.currentEtapeIndex >= etapes.length - 1;
        const isFlashcard = currentEtape.format_code === 'flashcard';

        // Récupérer les questions liées à cette étape
        const etapeQuestions = EC.etapeQuestions
            .filter(eq => String(eq.etape_id) === String(currentEtape.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const typeLabel = this.getTypeLabel(this.evaluation.type);
        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="exercise-view eval-exercise-view">
                <div class="exercise-card">
                    <!-- Bandeau avec titre, type, points et timer -->
                    <div class="exercise-header connaissances">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${escapeHtml(this.evaluation.titre)}</h1>
                                <div class="exercise-header-meta">
                                    ${escapeHtml(typeLabel)} · ${this.evaluation.briques} pt${this.evaluation.briques > 1 ? 's' : ''} en jeu · Seuil : ${this.evaluation.type === 'savoir-faire' ? '100%' : this.evaluation.seuil + '%'} · Étape ${EC.currentEtapeIndex + 1}/${etapes.length}
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="exerciseTimer">
                            <span id="timerDisplay">${this.formatTime(this.remainingTime)}</span>
                        </div>
                    </div>

                    <!-- Barre de progression des étapes -->
                    <div class="etapes-navigation">
                        <div class="etapes-progress">
                            ${etapes.map((etape, idx) => {
                                const validated = idx < EC.etapesResults.length;
                                const isCurrent = idx === EC.currentEtapeIndex;
                                return `<div class="etape-dot ${validated ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
                                     title="Étape ${idx + 1}">
                                    ${validated ? '✓' : idx + 1}
                                </div>`;
                            }).join('<div class="etape-connector"></div>')}
                        </div>
                    </div>

                    <!-- Titre de l'étape -->
                    <div class="etape-header">
                        <h2>${escapeHtml(currentEtape.titre || 'Étape ' + (EC.currentEtapeIndex + 1))}</h2>
                        <span class="qcm-header-counter" id="qcmHeaderCounter"></span>
                        <span class="etape-format-badge">${EC.getFormatLabel(currentEtape.format_code)}</span>
                    </div>
                    <!-- Barre de progression intra-étape (multi-questions) -->
                    <div class="multi-progress-bar hidden" id="multiProgressBar">
                        <div class="multi-progress-fill" id="multiProgressFill"></div>
                    </div>

                    <!-- Contenu de l'étape (questions) — rendu par EleveConnaissances -->
                    <div class="exercise-content ${isValidated ? 'validated' : ''}" id="exerciseContent">
                        ${EC.renderEtapeContent(currentEtape, etapeQuestions)}
                    </div>

                    <!-- Zone de feedback (visible après validation) -->
                    <div class="etape-feedback hidden" id="etapeFeedback"></div>

                    <!-- Bouton d'action -->
                    <div class="etape-action-bar" id="etapeActionBar">
                        ${isFlashcard ? '' : `
                            <button class="btn-etape-action ${isValidated ? (isLastEtape ? 'finish-btn' : 'next-btn') : 'validate-btn'}" onclick="EleveConnaissances.${isValidated ? (isLastEtape ? 'finishEntrainement' : 'nextEtape') : 'validateCurrentEtape'}()">
                                ${isValidated ? (isLastEtape ? 'Terminer ✓' : 'Suivant →') : 'Valider'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Synchroniser l'affichage du timer avec le nouvel élément
        this.updateTimerDisplay();

        // Gérer le multi-questions (carrousel QCM, V/F, etc.)
        const qcmMulti = document.querySelector('.qcm-multi');
        const vfMulti = document.querySelector('.vf-multi');
        const qoMulti = document.querySelector('.qo-multi');
        const mfMulti = document.querySelector('.multi-format-container');
        const flashcardContainer = document.querySelector('.flashcard-container');
        const multiTotal = qcmMulti ? parseInt(qcmMulti.getAttribute('data-total-q'))
                         : vfMulti ? parseInt(vfMulti.getAttribute('data-total-vf'))
                         : qoMulti ? parseInt(qoMulti.getAttribute('data-total-qo'))
                         : mfMulti ? parseInt(mfMulti.getAttribute('data-total-mf'))
                         : 0;
        if (multiTotal > 1) {
            const validateBtn = document.querySelector('#etapeActionBar .validate-btn');
            if (validateBtn) validateBtn.classList.add('hidden');
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Question 1 / ${multiTotal}`;
            EC.updateMultiProgressBar(1, multiTotal);
        }
        if (flashcardContainer && EC.flashcardState) {
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Carte 1 / ${EC.flashcardState.total}`;
            EC.updateMultiProgressBar(1, EC.flashcardState.total);
        }
    },

    /**
     * Rendu de la vue exercice SF dans le conteneur de l'évaluation.
     * Utilise les FORMAT_HANDLERS de EleveExercices pour le rendu.
     */
    renderSFExerciseView() {
        const EE = EleveExercices;
        const exo = EE.currentExercise;
        const format = EE.formats[0];

        const donnees = parseJSONField(exo.donnees);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        // Générer le HTML du contenu via le format handler
        const handler = EE.getFormatHandler(typeUI);
        let contentHTML = '';
        if (handler && handler.render) {
            contentHTML = handler.render.call(EE, donnees, structure);
        } else {
            contentHTML = `<div style="text-align:center; color:#6b7280; padding:2rem;">
                <p>Format d'exercice non supporté : ${escapeHtml(typeUI)}</p>
            </div>`;
        }

        const typeLabel = this.getTypeLabel(this.evaluation.type);
        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="exercise-view eval-exercise-view">
                <div class="exercise-card">
                    <div class="exercise-header savoir-faire">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${escapeHtml(this.evaluation.titre)}</h1>
                                <div class="exercise-header-meta">
                                    ${escapeHtml(typeLabel)} · ${this.evaluation.briques} pt${this.evaluation.briques > 1 ? 's' : ''} en jeu · Seuil : 100%
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="exerciseTimer">
                            <span id="timerDisplay">${this.formatTime(this.remainingTime)}</span>
                        </div>
                    </div>

                    ${exo.consigne ? `
                        <div class="exercise-consigne">${escapeHtml(exo.consigne)}</div>
                    ` : ''}

                    <div class="exercise-content" id="exerciseContent">
                        ${contentHTML}
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-verifier" id="btnTerminerEval" onclick="EleveEvaluation.finishEvaluation()">
                            Terminer
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.updateTimerDisplay();
    },

    getTypeLabel(type) {
        const labels = {
            connaissances: 'Connaissances',
            'savoir-faire': 'Savoir-faire',
            competences: 'Compétences',
            bonus: 'Bonus'
        };
        return labels[type] || type;
    },

    // ========== APPEL API (JSONP) ==========
    async callAPI(action, params = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });

        return new Promise((resolve, reject) => {
            const callbackName = 'evalCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const script = document.createElement('script');

            window[callbackName] = (data) => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(data);
            };

            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    },

    // ========== AFFICHAGE ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluationContent').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <span style="font-size: 48px;">:(</span>
                <p>${escapeHtml(message)}</p>
                <button class="btn btn-secondary" onclick="window.history.back()">Retour</button>
            </div>
        `;
    },

    // ========== TIMER ==========
    startTimer() {
        this.timeExpired = false;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    },

    updateTimer() {
        if (this.remainingTime > 0) {
            this.remainingTime--;
            this.updateTimerDisplay();

            const timerEl = document.getElementById('exerciseTimer');
            if (timerEl && this.remainingTime <= 60) {
                timerEl.classList.add('warning');
            }
        } else {
            this.onTimeExpired();
        }
    },

    updateTimerDisplay() {
        const timeStr = this.formatTime(this.remainingTime);
        // Mettre à jour le timer dans le header évaluation (si encore visible)
        const timerValueEl = document.getElementById('timerValue');
        if (timerValueEl) timerValueEl.textContent = timeStr;
        // Mettre à jour le timer dans le bandeau exercise-header
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) timerDisplay.textContent = timeStr;
    },

    onTimeExpired() {
        this.stopTimer();
        this.timeExpired = true;
        this.finishEvaluation();
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    getElapsedTime() {
        return this.duration - this.remainingTime;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ========== FIN D'ÉVALUATION ==========
    async finishEvaluation() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        this.stopTimer();

        let globalResult;

        if (this.evaluation.type === 'savoir-faire') {
            globalResult = this._finishSF();
        } else {
            globalResult = this._finishConnaissances();
        }

        // Afficher un écran d'attente pendant la sauvegarde
        this._showSaving();

        // Sauvegarder les résultats — bloquant
        const saveOk = await this.saveResults(globalResult);

        if (saveOk) {
            this.showResults(globalResult);
        } else {
            this._showSaveFailure(globalResult);
        }
    },

    /**
     * Finalisation pour une évaluation de connaissances.
     */
    _finishConnaissances() {
        const EC = EleveConnaissances;

        // Valider l'étape en cours si pas encore fait
        if (!EC.currentEtapeValidated) {
            EC.validateCurrentEtape();
        }

        const globalResult = this.calculateGlobalResult();

        // Compiler les résultats détaillés pour la correction
        const detailedResults = EC.compileResults();
        globalResult.detailedResults = detailedResults;

        return globalResult;
    },

    /**
     * Finalisation pour une évaluation savoir-faire.
     * Valide l'exercice via le format handler de EleveExercices.
     */
    _finishSF() {
        const EE = EleveExercices;
        const format = EE.formats[0];
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        // Valider l'exercice via le format handler
        const handler = EE.getFormatHandler(typeUI);
        let result = { correct: 0, total: 0 };
        if (handler && handler.validate) {
            result = handler.validate.call(EE);
        }

        // Appliquer les corrections visuelles sur le DOM
        if (handler && handler.showCorrection) {
            handler.showCorrection.call(EE);
        }

        // Capturer le HTML corrigé pour l'afficher dans les résultats
        const exerciseContent = document.querySelector('.exercise-content');
        this._sfCorrectedHTML = exerciseContent ? exerciseContent.innerHTML : '';

        this._sfValidationResult = result;

        const { correct, total } = result;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        const isValidated = score === 100;

        return {
            score,
            correct,
            total,
            isValidated,
            pointsEarned: isValidated ? this.evaluation.briques : 0,
            elapsedTime: this.getElapsedTime()
        };
    },

    /** Écran d'attente pendant la sauvegarde */
    _showSaving() {
        document.getElementById('exerciseContainer').style.display = 'none';
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header">
                    <div class="loader" style="margin: 0 auto 16px;"></div>
                    <h2>Enregistrement en cours...</h2>
                    <p>Ne ferme pas cette page.</p>
                </div>
            </div>
        `;
    },

    /** Écran d'échec de sauvegarde avec bouton retry */
    _showSaveFailure(globalResult) {
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header failed">
                    <div class="evaluation-result-icon">⚠️</div>
                    <h2>Erreur d'enregistrement</h2>
                    <p>Tes résultats n'ont pas pu être enregistrés.<br>
                    <small style="color:#666">${escapeHtml(this._saveDebug || 'Erreur inconnue')}</small></p>
                </div>
                <div class="result-actions" style="margin-top: 24px;">
                    <button class="btn btn-primary" id="retryBtn" onclick="EleveEvaluation._retrySave()">
                        Réessayer
                    </button>
                </div>
                <p style="text-align:center; margin-top:16px; color:#94a3b8; font-size:13px;">
                    Si le problème persiste, contacte ta professeure.<br>
                    Score : ${globalResult.score}% — ${globalResult.correct}/${globalResult.total} bonnes réponses
                </p>
            </div>
        `;
        // Stocker le résultat pour le retry
        this._pendingResult = globalResult;
    },

    /** Retry de sauvegarde */
    async _retrySave() {
        const btn = document.getElementById('retryBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        const saveOk = await this.saveResults(this._pendingResult);
        if (saveOk) {
            this.showResults(this._pendingResult);
        } else {
            this._showSaveFailure(this._pendingResult);
        }
    },

    calculateGlobalResult() {
        const EC = EleveConnaissances;
        let totalCorrect = 0;
        let totalQuestions = 0;

        EC.etapesResults.forEach(result => {
            if (result) {
                totalCorrect += result.correct;
                totalQuestions += result.total;
            }
        });

        const globalScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        let isValidated = false;
        if (this.evaluation.type === 'savoir-faire') {
            isValidated = globalScore === 100;
        } else {
            isValidated = globalScore >= this.evaluation.seuil;
        }

        return {
            score: globalScore,
            correct: totalCorrect,
            total: totalQuestions,
            isValidated,
            pointsEarned: isValidated ? this.evaluation.briques : 0,
            elapsedTime: this.getElapsedTime()
        };
    },

    _getCurrentUserId() {
        try {
            if (typeof Auth !== 'undefined' && Auth.getCurrentUser) {
                const user = Auth.getCurrentUser();
                if (user && user.id) return user.id;
            }
            const sessionUser = sessionStorage.getItem('brikks_user');
            if (sessionUser) return JSON.parse(sessionUser).id;
            return null;
        } catch (e) {
            console.error('Erreur récupération utilisateur:', e);
            return null;
        }
    },

    /**
     * Sauvegarde les résultats de l'évaluation via l'API backend.
     * @returns {boolean} true si la sauvegarde a réussi
     */
    async saveResults(globalResult) {
        try {
            const eleveId = this._getCurrentUserId();
            if (!eleveId) {
                console.error('[EVAL SAVE] Pas d\'utilisateur connecté');
                this._saveDebug = 'Pas d\'utilisateur connecté';
                return false;
            }

            // Résumé compact (format différent selon conn/SF)
            let detailsCompact;
            if (this.evaluation.type === 'savoir-faire') {
                detailsCompact = [{
                    f: 'savoir-faire',
                    c: globalResult.correct,
                    t: globalResult.total,
                    p: globalResult.score
                }];
            } else {
                detailsCompact = EleveConnaissances.etapesResults.map(r => r ? {
                    i: r.etapeIndex,
                    f: r.format,
                    c: r.correct,
                    t: r.total,
                    p: r.pourcentage
                } : null);
            }

            const attribution = this.evaluation.attribution || {};
            const params = {
                evaluation_id: this.evaluation.id,
                eleve_id: eleveId,
                score: globalResult.score,
                validations: globalResult.pointsEarned,
                is_validated: globalResult.isValidated,
                temps_passe: globalResult.elapsedTime,
                details: JSON.stringify(detailsCompact),
                banque_id: attribution.banque_id || '',
                entrainement_id: attribution.entrainement_id || ''
            };

            console.log('[EVAL SAVE] Envoi:', JSON.stringify(params));
            const result = await this.callAPI('saveEvaluationResult', params);
            console.log('[EVAL SAVE] Réponse:', JSON.stringify(result));

            if (!result.success) {
                this._saveDebug = 'API erreur: ' + (result.error || JSON.stringify(result));
                return false;
            }
            return true;
        } catch (error) {
            console.error('[EVAL SAVE] Exception:', error);
            this._saveDebug = 'Exception: ' + error.message;
            return false;
        }
    },

    showResults(globalResult) {
        this._removeBeforeUnload();
        document.getElementById('exerciseContainer').style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';

        const headerClass = globalResult.isValidated ? 'validated' : 'failed';
        const icon = globalResult.isValidated ? '✅' : '❌';
        const message = globalResult.isValidated ? 'Évaluation validée !' : 'Évaluation non validée';
        const subMessage = globalResult.isValidated
            ? `Tu as gagné ${globalResult.pointsEarned} point${globalResult.pointsEarned > 1 ? 's' : ''} !`
            : 'Tu pourras repasser cette évaluation avec de nouvelles questions.';

        // Correction détaillée (conn ou SF)
        let correctionHtml = '';
        if (this.evaluation.type === 'savoir-faire') {
            // Pour SF : afficher le HTML corrigé capturé avant la sauvegarde
            if (this._sfCorrectedHTML) {
                correctionHtml = this._sfCorrectedHTML;
            }
        } else {
            const EC = EleveConnaissances;
            if (globalResult.detailedResults && typeof EC.generateErrorDetails === 'function') {
                correctionHtml = EC.generateErrorDetails(globalResult.detailedResults);
            }
        }

        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header ${headerClass}">
                    <div class="evaluation-result-icon">${icon}</div>
                    <h2>${message}</h2>
                    <p>${subMessage}</p>
                </div>

                <div class="score-details">
                    <div class="score-breakdown">
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.score}%</div>
                            <div class="score-item-label">Score</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.correct}/${globalResult.total}</div>
                            <div class="score-item-label">Bonnes réponses</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${this.formatTime(globalResult.elapsedTime)}</div>
                            <div class="score-item-label">Temps</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value ${globalResult.isValidated ? 'earned' : 'lost'}">${globalResult.pointsEarned}/${this.evaluation.briques}</div>
                            <div class="score-item-label">Points</div>
                        </div>
                    </div>

                    <div class="threshold-info">
                        <div class="threshold-info-icon">${this.evaluation.type === 'savoir-faire' ? '100%' : this.evaluation.seuil + '%'}</div>
                        <div class="threshold-info-text">
                            <strong>Seuil de validation</strong>
                            <span>${this.evaluation.type === 'savoir-faire'
                                ? 'Pour un savoir-faire, tu dois obtenir 100% (zéro erreur)'
                                : `Tu devais obtenir au moins ${this.evaluation.seuil}% pour valider`}</span>
                        </div>
                    </div>
                </div>

                ${correctionHtml ? `
                <div class="eval-correction-section">
                    <h3>Correction détaillée</h3>
                    <div class="eval-correction-content">
                        ${correctionHtml}
                    </div>
                </div>
                ` : ''}

                <div class="result-actions">
                    <button class="btn btn-primary" onclick="window.location.href='evaluations.html'">
                        Retour aux évaluations
                    </button>
                </div>
            </div>
        `;

    },

    // ========== NAVIGATION ==========
    _beforeUnloadHandler: null,

    _addBeforeUnload() {
        this._beforeUnloadHandler = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    },

    _removeBeforeUnload() {
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
    },

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }
};

window.EleveEvaluation = EleveEvaluation;
