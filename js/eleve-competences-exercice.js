/**
 * Module Élève — Entraînement de compétences
 * Extension : vue exercice, timer, corrigé commenté, auto-évaluation
 *
 * Ce fichier étend EleveCompetences via Object.assign
 */

Object.assign(EleveCompetences, {

    // ==========================================
    // PERSISTANCE TIMER (évaluation uniquement)
    // ==========================================

    _timerStorageKey(entrainementId) {
        return 'brikks_comp_timer_' + entrainementId;
    },

    _saveEvalTimer(entrainementId, timeRemaining) {
        try {
            localStorage.setItem(this._timerStorageKey(entrainementId), JSON.stringify({
                timeRemaining: timeRemaining,
                savedAt: Date.now()
            }));
        } catch (e) { /* silencieux */ }
    },

    /**
     * Restaure le timer persistant. Calcule le temps écoulé depuis la sauvegarde.
     * Retourne le temps restant ajusté, ou null si pas de sauvegarde.
     */
    _loadEvalTimer(entrainementId) {
        try {
            const raw = localStorage.getItem(this._timerStorageKey(entrainementId));
            if (!raw) return null;
            const data = JSON.parse(raw);
            const elapsed = Math.floor((Date.now() - data.savedAt) / 1000);
            return data.timeRemaining - elapsed;
        } catch (e) { return null; }
    },

    _clearEvalTimer(entrainementId) {
        try {
            localStorage.removeItem(this._timerStorageKey(entrainementId));
        } catch (e) { /* silencieux */ }
    },

    // ==========================================
    // NIVEAU 3 — VUE EXERCICE
    // ==========================================

    showExercise(entrainement, mode) {
        this.currentView = 'exercise';
        this.currentEntrainement = entrainement;
        this.currentMode = mode;
        this.exerciseStartTime = Date.now();

        const container = document.getElementById('competences-content');
        const duree = entrainement.duree || 1800;

        // Mode évaluation : restaurer le timer persistant
        if (mode === 'evalue') {
            const restored = this._loadEvalTimer(entrainement.id);
            if (restored !== null) {
                if (restored <= 0) {
                    // Timer expiré pendant l'absence → auto-soumission
                    this.timeRemaining = 0;
                    this._autoSubmitExpired(entrainement);
                    return;
                }
                this.timeRemaining = restored;
            } else {
                this.timeRemaining = duree;
            }
        } else {
            // Mode entraînement : toujours repartir de zéro
            this.timeRemaining = duree;
        }

        // Compétence associée
        const comp = this.competences.find(c =>
            String(c.id) === String(entrainement.competence_id)
        );

        // Critères
        const criteresComp = this.criteres
            .filter(cr => String(cr.competence_id) === String(entrainement.competence_id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // URL iframe
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);

        // HTML critères dans la sidebar (cases à cocher)
        const nbCriteres = criteresComp.length;
        const criteresHTML = nbCriteres > 0 ? `
            <div class="comp-sidebar-criteres">
                <h4>Critères de réussite</h4>
                <p class="comp-sidebar-criteres-hint">Au moins ${nbCriteres} sur ${nbCriteres} pour valider</p>
                <div class="comp-sidebar-criteres-list">
                    ${criteresComp.map((cr, i) => `
                        <label class="comp-sidebar-critere-item">
                            <input type="checkbox" class="comp-sidebar-critere-checkbox" id="critere-${i}">
                            <span class="comp-sidebar-critere-check"></span>
                            <span class="comp-sidebar-critere-text">${this.escapeHtml(cr.libelle)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Consigne : priorité compétence > exercice
        const consigneText = (comp && comp.consigne) ? comp.consigne : (entrainement.description || '');

        const modeBadgeLabel = mode === 'entrainement' ? 'Entraînement libre' : 'Évaluation';

        // Boutons selon le mode
        let actionButtonsHTML;
        if (mode === 'evalue') {
            actionButtonsHTML = `
                <button class="comp-btn comp-btn-finish" id="compFinishBtn" onclick="EleveCompetences.finishEntrainement()">
                    Soumettre ma production
                </button>
                <button class="comp-btn comp-btn-cancel" onclick="EleveCompetences.cancelEvaluation()">
                    Ne pas rendre
                </button>
            `;
        } else {
            actionButtonsHTML = `
                <button class="comp-btn comp-btn-finish" id="compFinishBtn" onclick="EleveCompetences.finishEntrainement()">
                    J'ai terminé — voir le corrigé commenté
                </button>
            `;
        }

        container.innerHTML = `
            <div class="comp-exercise-view">
                <div class="comp-exercise-topbar">
                    <button class="comp-exercise-back" onclick="EleveCompetences.confirmLeaveExercise()">←</button>
                    <div class="comp-exercise-topbar-info">
                        <h1>${this.escapeHtml(entrainement.titre)}</h1>
                        <div class="comp-exercise-topbar-meta">
                            <span class="comp-mode-badge ${mode}">${modeBadgeLabel}</span>
                        </div>
                    </div>
                    <div class="comp-exercise-timer" id="compTimer">
                        <span class="comp-timer-icon">⏱</span>
                        <span id="compTimerDisplay">${this.formatTime(this.timeRemaining)}</span>
                    </div>
                </div>

                ${consigneText ? `
                    <div class="comp-consigne-box">
                        <div class="comp-consigne-label">CONSIGNE</div>
                        <div class="comp-consigne-text">${this.escapeHtml(consigneText)}</div>
                    </div>
                ` : ''}

                <div class="comp-exercise-layout">
                    <div class="comp-document-section" id="compDocSection">
                        <div class="comp-document-toolbar">
                            <span class="comp-document-title">📄 Document</span>
                            ${entrainement.document_legende ? `
                                <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                            ` : ''}
                            <div class="comp-document-actions">
                                <a href="${this.escapeHtml(entrainement.document_url || '')}" target="_blank" class="comp-doc-btn" title="Ouvrir dans un nouvel onglet">
                                    ↗️
                                </a>
                                <button class="comp-doc-btn" onclick="EleveCompetences.toggleDocFullscreen()" title="Plein écran">
                                    ⛶
                                </button>
                            </div>
                        </div>
                        <div class="comp-document-frame-wrapper" id="compDocWrapper">
                            ${iframeUrl ? `
                                <iframe src="${iframeUrl}" class="comp-document-frame" allowfullscreen></iframe>
                            ` : `
                                <div class="comp-no-document">
                                    <p>Aucun document associé à cet exercice.</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="comp-sidebar-section">
                        ${criteresHTML}

                        <div class="comp-sidebar-actions" id="compSidebarActions">
                            ${actionButtonsHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.startTimer();
    },

    toggleDocFullscreen() {
        const wrapper = document.getElementById('compDocWrapper');
        if (wrapper) {
            wrapper.classList.toggle('fullscreen');
            document.body.classList.toggle('comp-fullscreen-active');
        }
    },

    confirmLeaveExercise() {
        if (this.currentMode === 'evalue') {
            // Mode évaluation : prévenir que le chrono continue
            if (confirm('Le chrono continue même si tu quittes. Tu pourras revenir pour soumettre. Quitter ?')) {
                this._saveEvalTimer(this.currentEntrainement.id, this.timeRemaining);
                this.stopTimer();
                this.backToDetail();
            }
        } else {
            // Mode entraînement : quitter librement
            this.stopTimer();
            this.backToDetail();
        }
    },

    /**
     * Bouton "Ne pas rendre" — l'élève quitte sans soumettre.
     * Le chrono est sauvegardé, il pourra revenir.
     */
    cancelEvaluation() {
        if (confirm('Tu pourras revenir plus tard, mais le chrono continue. Quitter sans rendre ?')) {
            this._saveEvalTimer(this.currentEntrainement.id, this.timeRemaining);
            this.stopTimer();
            this.backToDetail();
        }
    },

    /**
     * Auto-soumission quand le timer a expiré pendant l'absence de l'élève.
     */
    async _autoSubmitExpired(entrainement) {
        this._clearEvalTimer(entrainement.id);

        if (this.currentUser) {
            try {
                const duree = entrainement.duree || 1800;
                await this.callAPI('finishEleveEntrainementCompetence', {
                    eleve_id: this.currentUser.id,
                    entrainement_id: entrainement.id,
                    temps_passe: duree
                });

                const prog = this.progressions.find(p =>
                    String(p.entrainement_id) === String(entrainement.id)
                );
                if (prog) {
                    prog.statut = 'soumis';
                    prog.temps_passe = duree;
                    prog.date_soumission = new Date().toISOString();
                }
                this.saveToCache();
            } catch (error) {
                console.error('Erreur auto-soumission:', error);
            }
        }

        // Afficher un message
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-result-view">
                <div class="comp-result-header evaluation">
                    <div class="comp-result-icon">⏱</div>
                    <h2>Temps écoulé</h2>
                    <p class="comp-result-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>
                <div class="comp-result-message">
                    <p class="comp-result-note">Le temps imparti est écoulé. Votre production a été automatiquement soumise au professeur.</p>
                </div>
                <div class="comp-result-actions">
                    <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                        Retour aux compétences
                    </button>
                </div>
            </div>
        `;
    },

    // ==========================================
    // TIMER
    // ==========================================

    startTimer() {
        this.stopTimer();
        this._timerSaveCounter = 0;

        this.timer = setInterval(() => {
            this.timeRemaining--;

            const timerEl = document.getElementById('compTimer');
            const display = document.getElementById('compTimerDisplay');

            if (display) {
                display.textContent = this.formatTime(this.timeRemaining);
            }

            if (timerEl) {
                if (this.timeRemaining <= 300 && this.timeRemaining > 60) {
                    timerEl.classList.add('warning');
                    timerEl.classList.remove('danger', 'overtime');
                } else if (this.timeRemaining <= 60 && this.timeRemaining > 0) {
                    timerEl.classList.add('danger');
                    timerEl.classList.remove('warning', 'overtime');
                } else if (this.timeRemaining <= 0) {
                    timerEl.classList.add('overtime');
                    timerEl.classList.remove('warning', 'danger');
                }
            }

            // Mode évaluation : sauvegarder le timer toutes les 10s + auto-soumission à 0
            if (this.currentMode === 'evalue' && this.currentEntrainement) {
                this._timerSaveCounter++;
                if (this._timerSaveCounter % 10 === 0) {
                    this._saveEvalTimer(this.currentEntrainement.id, this.timeRemaining);
                }

                if (this.timeRemaining <= 0) {
                    this.stopTimer();
                    this._clearEvalTimer(this.currentEntrainement.id);
                    this.finishEntrainement();
                    return;
                }
            }

            // Mode entraînement : message indicatif quand le temps est écoulé
            if (this.currentMode === 'entrainement' && this.timeRemaining === 0) {
                this._showTimeUpBanner();
            }
        }, 1000);
    },

    /**
     * Bandeau "Tu devrais avoir terminé" (mode entraînement uniquement)
     */
    _showTimeUpBanner() {
        const existing = document.getElementById('compTimeUpBanner');
        if (existing) return;

        const topbar = document.querySelector('.comp-exercise-topbar');
        if (topbar) {
            topbar.insertAdjacentHTML('afterend', `
                <div class="comp-timeup-banner" id="compTimeUpBanner">
                    Tu devrais avoir terminé ! Prends le temps qu'il te faut.
                </div>
            `);
        }
    },

    // ==========================================
    // TERMINER L'EXERCICE
    // ==========================================

    async finishEntrainement() {
        if (!this.currentEntrainement) return;

        const entr = this.currentEntrainement;
        const mode = this.currentMode;
        const tempsPasse = Math.round((Date.now() - this.exerciseStartTime) / 1000);

        this.stopTimer();
        this._clearEvalTimer(entr.id);

        // Sauvegarder au backend
        if (this.currentUser) {
            try {
                await this.callAPI('finishEleveEntrainementCompetence', {
                    eleve_id: this.currentUser.id,
                    entrainement_id: entr.id,
                    temps_passe: tempsPasse
                });

                // Mettre à jour les progressions locales
                const prog = this.progressions.find(p =>
                    String(p.entrainement_id) === String(entr.id)
                );
                if (prog) {
                    prog.statut = mode === 'evalue' ? 'soumis' : 'entraine';
                    prog.temps_passe = tempsPasse;
                    if (mode === 'evalue') {
                        prog.date_soumission = new Date().toISOString();
                    } else {
                        prog.date_fin = new Date().toISOString();
                    }
                }
                this.saveToCache();
            } catch (error) {
                console.error('Erreur fin entraînement:', error);
            }
        }

        // Afficher le résultat selon le mode
        if (mode === 'entrainement') {
            this.showTrainingResult(entr);
        } else {
            this.showEvaluationResult(entr);
        }
    },

    // ==========================================
    // RÉSULTAT MODE ENTRAÎNEMENT (tabs Corrigé/Sujet)
    // ==========================================

    showTrainingResult(entrainement) {
        const correctionData = this._parseCorrectionData(entrainement.correction_commentee);
        const correctionUrl = correctionData.url;
        const propositionText = correctionData.proposition;
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);

        // Build correction content
        let correctionContent = '';
        if (propositionText) {
            correctionContent += `
                <div class="comp-inplace-corrige">
                    <h4>Proposition de corrigé</h4>
                    <div class="comp-inplace-corrige-text">${this.escapeHtml(propositionText)}</div>
                </div>
            `;
        }
        if (correctionUrl) {
            const embedUrl = this.getEmbedUrl(correctionUrl);
            correctionContent += `
                <div class="comp-inplace-corrige">
                    <h4>Corrigé commenté</h4>
                    <div class="comp-corrige-doc">
                        <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                        <a href="${this.escapeHtml(correctionUrl)}" target="_blank" rel="noopener" class="comp-corrige-link">
                            Ouvrir dans un nouvel onglet ↗
                        </a>
                    </div>
                </div>
            `;
        }
        if (!correctionUrl && !propositionText) {
            correctionContent = `
                <div class="comp-inplace-corrige comp-corrige-empty">
                    <p>Le corrigé commenté n'est pas encore disponible pour cet exercice.</p>
                </div>
            `;
        }

        // Replace the exercise layout with tabs (Corrigé / Sujet)
        const layout = document.querySelector('.comp-exercise-layout');
        if (layout && iframeUrl) {
            layout.outerHTML = `
                <div class="comp-review-layout">
                    <div class="comp-document-section" id="compDocSection">
                        <div class="comp-review-tabs">
                            <button class="comp-review-tab active" data-tab="corrige" onclick="EleveCompetences.switchReviewTab('corrige')">📝 Corrigé</button>
                            <button class="comp-review-tab" data-tab="sujet" onclick="EleveCompetences.switchReviewTab('sujet')">📄 Sujet</button>
                        </div>
                        <div class="comp-review-tab-content active" id="compTabCorrige">
                            ${correctionContent}
                        </div>
                        <div class="comp-review-tab-content" id="compTabSujet">
                            <div class="comp-document-toolbar">
                                <span class="comp-document-title">📄 Document</span>
                                ${entrainement.document_legende ? `
                                    <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                                ` : ''}
                                <div class="comp-document-actions">
                                    <a href="${this.escapeHtml(entrainement.document_url || '')}" target="_blank" class="comp-doc-btn" title="Ouvrir dans un nouvel onglet">↗️</a>
                                    <button class="comp-doc-btn" onclick="EleveCompetences.toggleDocFullscreen()" title="Plein écran">⛶</button>
                                </div>
                            </div>
                            <div class="comp-document-frame-wrapper" id="compDocWrapper">
                                <iframe src="${iframeUrl}" class="comp-document-frame" allowfullscreen></iframe>
                            </div>
                        </div>
                    </div>
                    <div class="comp-review-actions">
                        <button class="comp-btn comp-btn-retrain" onclick="EleveCompetences.restartTraining('${entrainement.id}')">
                            Se ré-entraîner
                        </button>
                        <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                            Retour aux compétences
                        </button>
                    </div>
                </div>
            `;
        } else {
            // No document: insert correction and update buttons
            const docSection = document.getElementById('compDocSection');
            if (docSection) {
                const existing = docSection.querySelector('.comp-inplace-corrige');
                if (existing) existing.remove();
                docSection.insertAdjacentHTML('beforeend', correctionContent);
            }
            const finishBtn = document.getElementById('compFinishBtn');
            if (finishBtn) {
                finishBtn.outerHTML = `
                    <div class="comp-sidebar-result-actions">
                        <button class="comp-btn comp-btn-retrain" onclick="EleveCompetences.restartTraining('${entrainement.id}')">
                            Se ré-entraîner
                        </button>
                        <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                            Retour aux compétences
                        </button>
                    </div>
                `;
            }
        }
    },

    /**
     * Parse la correction : peut être une URL string, ou un JSON {url, proposition}
     */
    _parseCorrectionData(correction) {
        if (!correction) return { url: '', proposition: '' };
        if (typeof correction === 'string') {
            if (correction.startsWith('{')) {
                try {
                    const parsed = JSON.parse(correction);
                    return {
                        url: parsed.url || '',
                        proposition: parsed.proposition || ''
                    };
                } catch (e) { return { url: correction, proposition: '' }; }
            }
            return { url: correction, proposition: '' };
        }
        if (typeof correction === 'object') {
            return {
                url: correction.url || '',
                proposition: correction.proposition || ''
            };
        }
        return { url: '', proposition: '' };
    },

    // ==========================================
    // RÉSULTAT MODE ÉVALUATION
    // ==========================================

    showEvaluationResult(entrainement) {
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-result-view">
                <div class="comp-result-header evaluation">
                    <div class="comp-result-icon">📤</div>
                    <h2>Production soumise</h2>
                    <p class="comp-result-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>

                <div class="comp-result-message">
                    <div class="comp-result-info-box">
                        <h3>📤 Comment rendre votre travail ?</h3>
                        <div class="comp-submit-options">
                            <div class="comp-submit-option">
                                <span class="comp-submit-icon">📧</span>
                                <div>
                                    <strong>Par mail (format numérique)</strong>
                                    <p>Envoyez votre travail dans les 30 minutes</p>
                                </div>
                            </div>
                            <div class="comp-submit-option">
                                <span class="comp-submit-icon">📄</span>
                                <div>
                                    <strong>En format papier</strong>
                                    <p>Déposez votre copie dans le casier du professeur le lendemain</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="comp-result-note">✅ Votre participation a été enregistrée. Le professeur validera la compétence après correction.</p>
                </div>

                <div class="comp-result-actions">
                    <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                        Retour aux compétences
                    </button>
                </div>
            </div>
        `;
    },

    // ==========================================
    // VUE RELECTURE (après complétion)
    // ==========================================

    /**
     * Switch entre les onglets Corrigé / Sujet dans les vues relecture
     */
    switchReviewTab(tab) {
        document.querySelectorAll('.comp-review-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        const tabCorrige = document.getElementById('compTabCorrige');
        const tabSujet = document.getElementById('compTabSujet');
        if (tabCorrige) tabCorrige.classList.toggle('active', tab === 'corrige');
        if (tabSujet) tabSujet.classList.toggle('active', tab === 'sujet');
    },

    /**
     * Affiche une vue relecture avec tabs Corrigé/Sujet (entraînement)
     * ou document + statut (évaluation).
     */
    showExerciseReview(entrainement, progression) {
        this.currentView = 'exercise';
        this.currentEntrainement = entrainement;

        const container = document.getElementById('competences-content');
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);
        const mode = progression.mode;
        const statut = progression.statut;

        const modeBadgeLabel = mode === 'entrainement' ? 'Entraînement' : 'Évaluation';

        if (mode === 'entrainement') {
            // === MODE ENTRAÎNEMENT : tabs Corrigé / Sujet ===
            const correctionData = this._parseCorrectionData(entrainement.correction_commentee);
            const correctionUrl = correctionData.url;
            const propositionText = correctionData.proposition;

            let correctionContent = '';
            if (propositionText) {
                correctionContent += `
                    <div class="comp-inplace-corrige">
                        <h4>Proposition de corrigé</h4>
                        <div class="comp-inplace-corrige-text">${this.escapeHtml(propositionText)}</div>
                    </div>
                `;
            }
            if (correctionUrl) {
                const embedUrl = this.getEmbedUrl(correctionUrl);
                correctionContent += `
                    <div class="comp-inplace-corrige">
                        <h4>Corrigé commenté</h4>
                        <div class="comp-corrige-doc">
                            <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                            <a href="${this.escapeHtml(correctionUrl)}" target="_blank" rel="noopener" class="comp-corrige-link">
                                Ouvrir dans un nouvel onglet ↗
                            </a>
                        </div>
                    </div>
                `;
            }
            if (!correctionUrl && !propositionText) {
                correctionContent = `
                    <div class="comp-inplace-corrige comp-corrige-empty">
                        <p>Le corrigé commenté n'est pas encore disponible.</p>
                    </div>
                `;
            }

            const hasTabs = !!iframeUrl;

            const tabsHTML = hasTabs ? `
                <div class="comp-review-tabs">
                    <button class="comp-review-tab active" data-tab="corrige" onclick="EleveCompetences.switchReviewTab('corrige')">📝 Corrigé</button>
                    <button class="comp-review-tab" data-tab="sujet" onclick="EleveCompetences.switchReviewTab('sujet')">📄 Sujet</button>
                </div>
            ` : '';

            const sujetHTML = hasTabs ? `
                <div class="comp-review-tab-content" id="compTabSujet">
                    <div class="comp-document-toolbar">
                        <span class="comp-document-title">📄 Document</span>
                        ${entrainement.document_legende ? `
                            <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                        ` : ''}
                        <div class="comp-document-actions">
                            <a href="${this.escapeHtml(entrainement.document_url || '')}" target="_blank" class="comp-doc-btn" title="Ouvrir dans un nouvel onglet">↗️</a>
                            <button class="comp-doc-btn" onclick="EleveCompetences.toggleDocFullscreen()" title="Plein écran">⛶</button>
                        </div>
                    </div>
                    <div class="comp-document-frame-wrapper" id="compDocWrapper">
                        <iframe src="${iframeUrl}" class="comp-document-frame" allowfullscreen></iframe>
                    </div>
                </div>
            ` : '';

            container.innerHTML = `
                <div class="comp-exercise-view">
                    <div class="comp-exercise-topbar">
                        <button class="comp-exercise-back" onclick="EleveCompetences.backToDetail()">←</button>
                        <div class="comp-exercise-topbar-info">
                            <h1>${this.escapeHtml(entrainement.titre)}</h1>
                            <div class="comp-exercise-topbar-meta">
                                <span class="comp-mode-badge ${mode}">${modeBadgeLabel}</span>
                                <span class="comp-review-badge">Relecture</span>
                            </div>
                        </div>
                    </div>

                    <div class="comp-review-layout">
                        <div class="comp-document-section" id="compDocSection">
                            ${tabsHTML}
                            <div class="comp-review-tab-content active" id="compTabCorrige">
                                ${correctionContent}
                            </div>
                            ${sujetHTML}
                        </div>
                        <div class="comp-review-actions">
                            <button class="comp-btn comp-btn-retrain" onclick="EleveCompetences.restartTraining('${entrainement.id}')">
                                Se ré-entraîner
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // === MODE ÉVALUATION : document + sidebar statut ===
            let sidebarContent = '';
            if (statut === 'soumis') {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">📤</div>
                        <h4>Production soumise</h4>
                        <p>Votre travail a été soumis et est en attente de correction par le professeur.</p>
                    </div>
                `;
            } else if (statut === 'valide') {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">✅</div>
                        <h4>Compétence validée</h4>
                        <p>Votre production a été corrigée et validée par le professeur.</p>
                    </div>
                `;
            } else {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">✅</div>
                        <h4>Exercice terminé</h4>
                        <p>Vous avez terminé cet exercice.</p>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="comp-exercise-view">
                    <div class="comp-exercise-topbar">
                        <button class="comp-exercise-back" onclick="EleveCompetences.backToDetail()">←</button>
                        <div class="comp-exercise-topbar-info">
                            <h1>${this.escapeHtml(entrainement.titre)}</h1>
                            <div class="comp-exercise-topbar-meta">
                                <span class="comp-mode-badge ${mode}">${modeBadgeLabel}</span>
                                <span class="comp-review-badge">Relecture</span>
                            </div>
                        </div>
                    </div>

                    <div class="comp-exercise-layout">
                        <div class="comp-document-section" id="compDocSection">
                            <div class="comp-document-toolbar">
                                <span class="comp-document-title">📄 Document</span>
                                ${entrainement.document_legende ? `
                                    <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                                ` : ''}
                                <div class="comp-document-actions">
                                    <a href="${this.escapeHtml(entrainement.document_url || '')}" target="_blank" class="comp-doc-btn" title="Ouvrir dans un nouvel onglet">↗️</a>
                                    <button class="comp-doc-btn" onclick="EleveCompetences.toggleDocFullscreen()" title="Plein écran">⛶</button>
                                </div>
                            </div>
                            <div class="comp-document-frame-wrapper" id="compDocWrapper">
                                ${iframeUrl ? `
                                    <iframe src="${iframeUrl}" class="comp-document-frame" allowfullscreen></iframe>
                                ` : `
                                    <div class="comp-no-document">
                                        <p>Aucun document associé à cet exercice.</p>
                                    </div>
                                `}
                            </div>
                        </div>

                        <div class="comp-sidebar-section">
                            ${sidebarContent}
                        </div>
                    </div>
                </div>
            `;
        }
    },

    // ==========================================
    // CORRIGÉ COMMENTÉ (accès depuis liste)
    // ==========================================

    showCorrigeCommente(entrainement) {
        const container = document.getElementById('competences-content');
        const correctionUrl = this._getCorrectionUrl(entrainement.correction_commentee);

        if (!correctionUrl) {
            container.innerHTML = `
                <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entrainement.competence_id}')">
                    ← Retour
                </button>
                <div class="comp-message-view">
                    <div class="comp-message-icon">📝</div>
                    <h2>${this.escapeHtml(entrainement.titre)}</h2>
                    <p class="comp-message-text">Le corrigé commenté n'est pas encore disponible pour cet exercice.</p>
                </div>
            `;
            return;
        }

        const embedUrl = this.getEmbedUrl(correctionUrl);

        container.innerHTML = `
            <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entrainement.competence_id}')">
                ← Retour
            </button>

            <div class="comp-corrige-view">
                <div class="comp-corrige-header">
                    <h2>Corrigé commenté</h2>
                    <p class="comp-corrige-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>

                <div class="comp-corrige-doc">
                    <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                    <a href="${this.escapeHtml(correctionUrl)}" target="_blank" rel="noopener" class="comp-corrige-link">
                        Ouvrir dans un nouvel onglet ↗
                    </a>
                </div>
            </div>
        `;
    },

    // ==========================================
    // URL EMBED HELPER
    // ==========================================

    // Extraire l'URL du corrigé — rétro-compatible avec l'ancien format JSON
    _getCorrectionUrl(correction) {
        if (!correction) return '';
        if (typeof correction === 'string') {
            if (correction.startsWith('{')) {
                try {
                    const parsed = JSON.parse(correction);
                    return parsed.url || parsed.proposition || '';
                } catch (e) { return correction; }
            }
            return correction;
        }
        if (typeof correction === 'object') {
            return correction.url || correction.proposition || '';
        }
        return '';
    },

    getEmbedUrl(url) {
        if (!url) return '';

        // Publuu flip-book
        if (url.includes('publuu.com/flip-book')) {
            const match = url.match(/publuu\.com\/flip-book\/(\d+)\/(\d+)/);
            if (match) {
                return `https://publuu.com/flip-book/${match[1]}/${match[2]}/page/1?embed`;
            }
            if (!url.includes('?embed')) {
                return url + (url.includes('/page/') ? '?embed' : '/page/1?embed');
            }
            return url;
        }

        // Google Drive
        if (url.includes('drive.google.com')) {
            const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) {
                return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
            }
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
            }
        }

        // Google Docs/Slides/Sheets
        if (url.includes('docs.google.com')) {
            if (url.includes('/edit') || url.includes('/view')) {
                return url.replace(/\/(edit|view).*$/, '/preview');
            }
            return url + '/preview';
        }

        // PDF
        if (url.toLowerCase().endsWith('.pdf')) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }

        return url;
    }
});
