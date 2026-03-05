/**
 * Moteur d'Evaluation Eleve
 * Pilote EleveConnaissances en "mode évaluation" pour réutiliser
 * les rendus et validations du module d'entraînement.
 */

const EleveEvaluation = {
    // État évaluation
    evaluation: null,
    duration: 0,
    remainingTime: 0,
    timerInterval: null,
    timeExpired: false,
    isSubmitting: false,

    // ========== INITIALISATION ==========
    async init() {
        try {
            const params = new URLSearchParams(window.location.search);
            const evalId = params.get('id');

            if (!evalId || evalId === 'test') {
                throw new Error('ID d\'évaluation manquant');
            }

            await this.loadEvaluation(evalId);
            this.setupConnaissancesModule();
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

        // Stocker les données brutes pour injection dans EleveConnaissances
        this._rawEtapes = data.etapes || [];
        this._rawEtapeQuestions = data.etapeQuestions || [];
        this._rawQuestionsConnaissances = data.questionsConnaissances || [];
        this._rawEntrainementData = data.entrainementData || {};

        // Vérifier qu'on a des données
        if (this._rawEtapes.length === 0) {
            throw new Error('Aucune étape disponible pour cette évaluation');
        }
    },

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

        // Remplacer backToList
        EC.backToList = function() {
            self.quit();
        };

        // Remplacer renderEntrainementView pour utiliser le layout évaluation
        EC.renderEntrainementView = function() {
            self.renderExerciseView();
        };
    },

    /**
     * Rendu de la vue exercice dans le conteneur de l'évaluation.
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
                <button class="exercise-back-btn" onclick="EleveEvaluation.quit()">
                    ← Quitter l'évaluation
                </button>

                <div class="exercise-card">
                    <!-- Bandeau avec titre, type, points et timer -->
                    <div class="exercise-header connaissances">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${escapeHtml(this.evaluation.titre)}</h1>
                                <div class="exercise-header-meta">
                                    ${escapeHtml(typeLabel)} · ${this.evaluation.briques} pt${this.evaluation.briques > 1 ? 's' : ''} en jeu · Étape ${EC.currentEtapeIndex + 1}/${etapes.length}
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

    // ========== RENDU PRINCIPAL ==========
    render() {
        this.renderExerciseView();
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

    // ========== FIN D'ÉVALUATION ==========
    async finishEvaluation() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        this.stopTimer();

        const EC = EleveConnaissances;

        // Valider l'étape en cours si pas encore fait
        if (!EC.currentEtapeValidated) {
            EC.validateCurrentEtape();
        }

        // Calculer le score global depuis les résultats d'EleveConnaissances
        const globalResult = this.calculateGlobalResult();

        // Sauvegarder les résultats (await pour garantir la sauvegarde)
        await this.saveResults(globalResult);

        // Afficher les résultats
        this.showResults(globalResult);
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

    async saveResults(globalResult) {
        try {
            const eleveId = this._getCurrentUserId();
            if (!eleveId) {
                console.error('Impossible de sauvegarder : aucun utilisateur connecté');
                return;
            }

            // Résumé compact des étapes (sans les données brutes des questions
            // qui rendraient l'URL JSONP trop longue)
            const detailsCompact = EleveConnaissances.etapesResults.map(r => r ? {
                i: r.etapeIndex,
                f: r.format,
                c: r.correct,
                t: r.total,
                p: r.pourcentage
            } : null);

            const result = await this.callAPI('saveEvaluationResult', {
                evaluation_id: this.evaluation.id,
                eleve_id: eleveId,
                score: globalResult.score,
                validations: globalResult.pointsEarned,
                is_validated: globalResult.isValidated,
                temps_passe: globalResult.elapsedTime,
                details: JSON.stringify(detailsCompact)
            });
            if (!result.success) {
                console.error('Erreur sauvegarde résultats:', result.error);
                this._showSaveError();
            }
        } catch (error) {
            console.error('Erreur sauvegarde résultats:', error);
            this._showSaveError();
        }
    },

    _showSaveError() {
        const container = document.getElementById('resultContainer');
        if (!container) return;
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#fee;color:#c00;padding:12px 16px;border-radius:8px;margin:12px 0;text-align:center;font-weight:500;';
        banner.textContent = 'Erreur lors de la sauvegarde du résultat. Signale-le à ton professeur.';
        container.prepend(banner);
    },

    showResults(globalResult) {
        document.getElementById('exerciseContainer').style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';

        const headerClass = globalResult.isValidated ? 'validated' : 'failed';
        const icon = globalResult.isValidated ? ':)' : ':(';
        const message = globalResult.isValidated ? 'Évaluation validée !' : 'Évaluation non validée';
        const subMessage = globalResult.isValidated
            ? `Tu as gagné ${globalResult.pointsEarned} point${globalResult.pointsEarned > 1 ? 's' : ''} !`
            : 'Tu pourras repasser cette évaluation avec de nouvelles questions.';

        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header ${headerClass}">
                    <div class="evaluation-result-icon">${icon}</div>
                    <h2>${message}</h2>
                    <p>${subMessage}</p>
                </div>

                <div class="validation-result">
                    <div class="validation-item">
                        <div class="validation-item-value ${globalResult.isValidated ? 'earned' : 'lost'}">${globalResult.pointsEarned}</div>
                        <div class="validation-item-label">Points obtenus</div>
                    </div>
                    <div class="validation-item">
                        <div class="validation-item-value">${this.evaluation.briques}</div>
                        <div class="validation-item-label">Points en jeu</div>
                    </div>
                </div>

                <div class="score-details">
                    <h3>Détails du score</h3>
                    <div class="score-breakdown">
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.score}%</div>
                            <div class="score-item-label">Score obtenu</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${globalResult.correct}/${globalResult.total}</div>
                            <div class="score-item-label">Bonnes réponses</div>
                        </div>
                        <div class="score-item">
                            <div class="score-item-value">${this.formatTime(globalResult.elapsedTime)}</div>
                            <div class="score-item-label">Temps</div>
                        </div>
                    </div>

                    <div class="threshold-info">
                        <div class="threshold-info-icon">${this.evaluation.seuil}%</div>
                        <div class="threshold-info-text">
                            <strong>Seuil de validation</strong>
                            <span>${this.evaluation.type === 'savoir-faire'
                                ? 'Pour un savoir-faire, tu dois obtenir 100% (zéro erreur)'
                                : `Tu devais obtenir au moins ${this.evaluation.seuil}% pour valider`}</span>
                        </div>
                    </div>

                    ${this.evaluation.type === 'savoir-faire' && !globalResult.isValidated ? `
                        <div class="savoir-faire-warning">
                            <div class="savoir-faire-warning-title">
                                <span>!</span> Savoir-faire non validé
                            </div>
                            <p>Pour valider un savoir-faire, tu dois répondre correctement à toutes les questions sans aucune erreur.
                            Tu pourras repasser cette évaluation avec un nouveau sujet tiré au sort.</p>
                        </div>
                    ` : ''}
                </div>

                <div class="result-actions">
                    <button class="btn btn-primary" onclick="window.location.href='evaluations.html'">
                        Retour aux évaluations
                    </button>
                </div>
            </div>
        `;
    },

    // ========== NAVIGATION ==========
    quit() {
        // Vérifier si l'élève a commencé à répondre
        const hasAnswers = EleveConnaissances.etapesResults.length > 0 ||
            Object.keys(EleveConnaissances.userAnswers || {}).length > 0;

        if (hasAnswers) {
            const modal = document.getElementById('confirmModal');
            document.getElementById('confirmModalTitle').textContent = 'Quitter l\'évaluation';
            document.getElementById('confirmModalMessage').textContent =
                'Attention ! Si vous quittez, votre progression sera perdue et l\'évaluation sera considérée comme non terminée.';
            document.getElementById('confirmModalBtn').textContent = 'Quitter quand même';
            document.getElementById('confirmModalBtn').onclick = () => {
                this.closeConfirmModal();
                window.location.href = 'evaluations.html';
            };
            modal.classList.remove('hidden');
        } else {
            window.location.href = 'evaluations.html';
        }
    },

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }
};

window.EleveEvaluation = EleveEvaluation;
