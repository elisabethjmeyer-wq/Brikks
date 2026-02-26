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

    // --- Persistance timer entraînement (le chrono se met en pause) ---

    _trainTimerStorageKey(entrainementId) {
        return 'brikks_comp_train_timer_' + entrainementId;
    },

    _saveTrainTimer(entrainementId, timeRemaining) {
        try {
            localStorage.setItem(this._trainTimerStorageKey(entrainementId), String(timeRemaining));
        } catch (e) { /* silencieux */ }
    },

    _loadTrainTimer(entrainementId) {
        try {
            const raw = localStorage.getItem(this._trainTimerStorageKey(entrainementId));
            if (!raw) return null;
            return parseInt(raw, 10);
        } catch (e) { return null; }
    },

    _clearTrainTimer(entrainementId) {
        try {
            localStorage.removeItem(this._trainTimerStorageKey(entrainementId));
        } catch (e) { /* silencieux */ }
    },

    // ==========================================
    // PROTECTION FERMETURE ACCIDENTELLE
    // ==========================================

    _addBeforeUnload() {
        this._removeBeforeUnload();
        this._beforeUnloadHandler = function(e) {
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

    // ==========================================
    // NOTIFICATION NON-BLOQUANTE
    // ==========================================

    _showNotification(message, type) {
        const existing = document.getElementById('compNotification');
        if (existing) existing.remove();

        const bgColor = type === 'error' ? '#fef2f2' : '#eff6ff';
        const borderColor = type === 'error' ? '#ef4444' : '#3b82f6';
        const textColor = type === 'error' ? '#991b1b' : '#1e40af';

        const notification = document.createElement('div');
        notification.id = 'compNotification';
        notification.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:10000;padding:12px 20px;border-radius:8px;background:' + bgColor + ';border:1px solid ' + borderColor + ';color:' + textColor + ';font-size:14px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:90vw;';
        notification.innerHTML = '<span>' + this.escapeHtml(message) + '</span>' +
            '<button style="background:none;border:none;cursor:pointer;font-size:18px;color:' + textColor + ';padding:0 4px;" onclick="this.parentElement.remove()">\u2715</button>';
        document.body.appendChild(notification);

        setTimeout(function() {
            if (notification.parentElement) notification.remove();
        }, 8000);
    },

    // ==========================================
    // BUILDERS HTML RÉUTILISABLES
    // ==========================================

    /**
     * Génère le HTML de la section document.
     * Supporte 3 formats :
     * - Nouveau format blocs (JSON array dans document_contenu)
     * - Ancien format texte riche (HTML brut dans document_contenu)
     * - Ancien format lien (URL dans document_url)
     */
    _buildDocumentHTML(entrainement) {
        // Tenter de parser document_contenu comme JSON (nouveau format blocs)
        if (entrainement.document_contenu) {
            try {
                var blocks = JSON.parse(entrainement.document_contenu);
                if (Array.isArray(blocks)) {
                    return this._renderDocumentBlocks(blocks);
                }
            } catch (e) {
                // C'est du HTML brut (ancien format) — afficher tel quel
                return `
                    <div class="comp-document-toolbar">
                        <span class="comp-document-title">\u{1F4C4} Document</span>
                        ${entrainement.document_legende ? `
                            <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                        ` : ''}
                    </div>
                    <div class="comp-document-richtext" id="compDocWrapper">
                        ${entrainement.document_contenu}
                    </div>
                `;
            }
        }

        // Mode lien : iframe comme avant
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);
        return `
            <div class="comp-document-toolbar">
                <span class="comp-document-title">\u{1F4C4} Document</span>
                ${entrainement.document_legende ? `
                    <span class="comp-document-legende">${this.escapeHtml(entrainement.document_legende)}</span>
                ` : ''}
                <div class="comp-document-actions">
                    <a href="${this.escapeHtml(entrainement.document_url || '')}" target="_blank" class="comp-doc-btn" title="Ouvrir dans un nouvel onglet">\u2197\uFE0F</a>
                </div>
            </div>
            <div class="comp-document-frame-wrapper" id="compDocWrapper">
                ${iframeUrl ? `
                    <iframe src="${iframeUrl}" class="comp-document-frame" allowfullscreen></iframe>
                ` : `
                    <div class="comp-no-document">
                        <p>Aucun document associ\u00E9 \u00E0 cet exercice.</p>
                    </div>
                `}
            </div>
        `;
    },

    /**
     * Rendu des blocs de contenu (nouveau format).
     * @param {Array} blocks — tableau de blocs [{type, content/url, ...}]
     */
    _renderDocumentBlocks(blocks) {
        var self = this;
        var html = '<div class="comp-blocks-container" id="compDocWrapper">';

        blocks.forEach(function(block) {
            if (block.type === 'group') {
                html += '<div class="comp-blocks-group">';
                (block.children || []).forEach(function(child) {
                    html += '<div class="comp-blocks-group-child">';
                    html += self._renderSingleBlock(child);
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += self._renderSingleBlock(block);
            }
        });

        html += '</div>';
        return html;
    },

    /** Rendu d'un bloc unique côté élève. */
    _renderSingleBlock(block) {
        switch (block.type) {
        case 'text':
            return '<div class="comp-block-text">' + (block.content || '') + '</div>';

        case 'document': {
            var embedUrl = this.getEmbedUrl(block.url);
            var titre = block.titre ? '<div class="comp-block-titre">' + this.escapeHtml(block.titre) + '</div>' : '';
            var legende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende) + '</div>' : '';
            return titre +
                '<div class="comp-block-document">' +
                (embedUrl
                    ? '<iframe src="' + embedUrl + '" class="comp-document-frame" allowfullscreen></iframe>'
                    : '<p class="comp-no-document">Document non disponible.</p>') +
                '</div>' +
                legende +
                (block.url ? '<div class="comp-block-doc-link"><a href="' + this.escapeHtml(block.url) + '" target="_blank" rel="noopener">Ouvrir dans un nouvel onglet \u2197</a></div>' : '');
        }

        case 'image': {
            var imgUrl = block.url || '';
            // Convertir les URLs Google Drive
            var driveMatch = imgUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch) imgUrl = 'https://lh3.googleusercontent.com/d/' + driveMatch[1];
            var imgLegende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende) + '</div>' : '';
            return '<div class="comp-block-image">' +
                '<img src="' + this.escapeHtml(imgUrl) + '" alt="' + this.escapeHtml(block.legende || 'Image') + '">' +
                '</div>' + imgLegende;
        }

        case 'video': {
            var vidUrl = block.url || '';
            var embedVid = '';
            var ytMatch = vidUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            if (ytMatch) {
                embedVid = 'https://www.youtube-nocookie.com/embed/' + ytMatch[1];
            } else {
                var driveVid = vidUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (driveVid) embedVid = 'https://drive.google.com/file/d/' + driveVid[1] + '/preview';
            }
            var vidLegende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende) + '</div>' : '';
            return '<div class="comp-block-video">' +
                (embedVid
                    ? '<iframe src="' + embedVid + '" allowfullscreen frameborder="0"></iframe>'
                    : '<a href="' + this.escapeHtml(vidUrl) + '" target="_blank">Voir la vid\u00E9o</a>') +
                '</div>' + vidLegende;
        }

        default:
            return '';
        }
    },

    /**
     * Génère le HTML du corrigé commenté (proposition texte + iframe document).
     * Utilisé dans showTrainingResult et showExerciseReview (mode entraînement).
     */
    _buildCorrectionHTML(correctionCommentee, correctionContenu) {
        // Mode texte riche : afficher le contenu HTML directement
        if (correctionContenu) {
            return `
                <div class="comp-inplace-corrige">
                    <h4>Corrig\u00E9 comment\u00E9</h4>
                    <div class="comp-inplace-corrige-text comp-richtext-content">${correctionContenu}</div>
                </div>
            `;
        }

        // Mode lien (comportement existant)
        const data = this._parseCorrectionData(correctionCommentee);
        let html = '';

        if (data.proposition) {
            html += `
                <div class="comp-inplace-corrige">
                    <h4>Proposition de corrig\u00E9</h4>
                    <div class="comp-inplace-corrige-text">${this.escapeHtml(data.proposition)}</div>
                </div>
            `;
        }
        if (data.url) {
            const embedUrl = this.getEmbedUrl(data.url);
            html += `
                <div class="comp-inplace-corrige">
                    <h4>Corrig\u00E9 comment\u00E9</h4>
                    <div class="comp-corrige-doc">
                        <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                        <a href="${this.escapeHtml(data.url)}" target="_blank" rel="noopener" class="comp-corrige-link">
                            Ouvrir dans un nouvel onglet \u2197
                        </a>
                    </div>
                </div>
            `;
        }
        if (!data.url && !data.proposition) {
            html = `
                <div class="comp-inplace-corrige comp-corrige-empty">
                    <p>Le corrig\u00E9 comment\u00E9 n'est pas encore disponible pour cet exercice.</p>
                </div>
            `;
        }
        return html;
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
                    this.timeRemaining = 0;
                    this._autoSubmitExpired(entrainement);
                    return;
                }
                this.timeRemaining = restored;
            } else {
                this.timeRemaining = duree;
            }
            this._addBeforeUnload();
        } else {
            // Mode entraînement : restaurer le timer si reprise, sinon repartir de zéro
            const savedTrainTime = this._loadTrainTimer(entrainement.id);
            if (savedTrainTime !== null) {
                this.timeRemaining = Math.max(0, savedTrainTime);
                this._clearTrainTimer(entrainement.id);
            } else {
                this.timeRemaining = duree;
            }
        }

        // Compétence associée
        const comp = this.competences.find(c =>
            String(c.id) === String(entrainement.competence_id)
        );

        // Critères
        const criteresComp = this.criteres
            .filter(cr => String(cr.competence_id) === String(entrainement.competence_id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // HTML critères dans la sidebar (cases à cocher)
        const nbCriteres = criteresComp.length;
        const criteresHTML = nbCriteres > 0 ? `
            <div class="comp-sidebar-criteres">
                <h4>Crit\u00E8res de r\u00E9ussite</h4>
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

        const modeBadgeLabel = mode === 'entrainement' ? 'Entra\u00EEnement libre' : '\u00C9valuation';

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
                    J'ai termin\u00E9 \u2014 voir le corrig\u00E9 comment\u00E9
                </button>
            `;
        }

        container.innerHTML = `
            <div class="comp-exercise-view">
                <div class="comp-exercise-topbar">
                    <button class="comp-exercise-back" onclick="EleveCompetences.confirmLeaveExercise()">\u2190</button>
                    <div class="comp-exercise-topbar-info">
                        <h1>${this.escapeHtml(entrainement.titre)}</h1>
                        <div class="comp-exercise-topbar-meta">
                            <span class="comp-mode-badge ${mode}">${modeBadgeLabel}</span>
                        </div>
                    </div>
                    <div class="comp-exercise-timer" id="compTimer">
                        <span class="comp-timer-icon">\u23F1</span>
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
                        ${this._buildDocumentHTML(entrainement)}
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

    confirmLeaveExercise() {
        if (this.currentMode === 'evalue') {
            if (confirm('Le chrono continue m\u00EAme si tu quittes. Tu pourras revenir pour soumettre. Quitter ?')) {
                this._saveEvalTimer(this.currentEntrainement.id, this.timeRemaining);
                this.stopTimer();
                this.backToDetail();
            }
        } else {
            this._saveTrainTimer(this.currentEntrainement.id, this.timeRemaining);
            this.stopTimer();
            this.backToDetail();
        }
    },

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
        this._removeBeforeUnload();

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

        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-result-view">
                <div class="comp-result-header evaluation">
                    <div class="comp-result-icon">\u23F1</div>
                    <h2>Temps \u00E9coul\u00E9</h2>
                    <p class="comp-result-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>
                <div class="comp-result-message">
                    <p class="comp-result-note">Le temps imparti est \u00E9coul\u00E9. Votre production a \u00E9t\u00E9 automatiquement soumise au professeur.</p>
                </div>
                <div class="comp-result-actions">
                    <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                        Retour aux comp\u00E9tences
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

    _showTimeUpBanner() {
        const existing = document.getElementById('compTimeUpBanner');
        if (existing) return;

        const topbar = document.querySelector('.comp-exercise-topbar');
        if (topbar) {
            topbar.insertAdjacentHTML('afterend', `
                <div class="comp-timeup-banner" id="compTimeUpBanner">
                    Tu devrais avoir termin\u00E9 ! Prends le temps qu'il te faut.
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
        const duree = entr.duree || 1800;
        // tempsPasse = durée totale - temps restant (gère reprises et overtime)
        const tempsPasse = Math.max(0, duree - this.timeRemaining);

        this.stopTimer();
        this._clearEvalTimer(entr.id);
        this._clearTrainTimer(entr.id);

        // Sauvegarder au backend
        let saveFailed = false;
        if (this.currentUser) {
            try {
                const result = await this.callAPI('finishEleveEntrainementCompetence', {
                    eleve_id: this.currentUser.id,
                    entrainement_id: entr.id,
                    temps_passe: tempsPasse
                });

                if (!result.success) {
                    saveFailed = true;
                    console.error('Erreur API fin entra\u00EEnement:', result.error);
                } else {
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
                }
            } catch (error) {
                saveFailed = true;
                console.error('Erreur fin entra\u00EEnement:', error);
            }
        }

        if (saveFailed) {
            this._showNotification('La sauvegarde a \u00E9chou\u00E9. Votre progression pourrait ne pas \u00EAtre enregistr\u00E9e.', 'error');
        }

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
        const correctionContent = this._buildCorrectionHTML(entrainement.correction_commentee, entrainement.correction_contenu);
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);
        const hasDocument = iframeUrl || entrainement.document_contenu;

        const layout = document.querySelector('.comp-exercise-layout');
        if (layout && hasDocument) {
            layout.outerHTML = `
                <div class="comp-review-layout">
                    <div class="comp-document-section" id="compDocSection">
                        <div class="comp-review-tabs">
                            <button class="comp-review-tab active" data-tab="corrige" onclick="EleveCompetences.switchReviewTab('corrige')">\u{1F4DD} Corrig\u00E9</button>
                            <button class="comp-review-tab" data-tab="sujet" onclick="EleveCompetences.switchReviewTab('sujet')">\u{1F4C4} Sujet</button>
                        </div>
                        <div class="comp-review-tab-content active" id="compTabCorrige">
                            ${correctionContent}
                        </div>
                        <div class="comp-review-tab-content" id="compTabSujet">
                            ${this._buildDocumentHTML(entrainement)}
                        </div>
                    </div>
                </div>
            `;
        } else {
            const docSection = document.getElementById('compDocSection');
            if (docSection) {
                const existing = docSection.querySelector('.comp-inplace-corrige');
                if (existing) existing.remove();
                docSection.insertAdjacentHTML('beforeend', correctionContent);
            }
            const finishBtn = document.getElementById('compFinishBtn');
            if (finishBtn) finishBtn.remove();
        }
    },

    // ==========================================
    // RÉSULTAT MODE ÉVALUATION
    // ==========================================

    showEvaluationResult(entrainement) {
        const container = document.getElementById('competences-content');
        container.innerHTML = `
            <div class="comp-result-view">
                <div class="comp-result-header evaluation">
                    <div class="comp-result-icon">\u{1F4E4}</div>
                    <h2>Production soumise</h2>
                    <p class="comp-result-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>

                <div class="comp-result-message">
                    <div class="comp-result-info-box">
                        <h3>\u{1F4E4} Comment rendre votre travail ?</h3>
                        <div class="comp-submit-options">
                            <div class="comp-submit-option">
                                <span class="comp-submit-icon">\u{1F4E7}</span>
                                <div>
                                    <strong>Par mail (format num\u00E9rique)</strong>
                                    <p>Envoyez votre travail dans les 30 minutes</p>
                                </div>
                            </div>
                            <div class="comp-submit-option">
                                <span class="comp-submit-icon">\u{1F4C4}</span>
                                <div>
                                    <strong>En format papier</strong>
                                    <p>D\u00E9posez votre copie dans le casier du professeur le lendemain</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <p class="comp-result-note">\u2705 Votre participation a \u00E9t\u00E9 enregistr\u00E9e. Le professeur validera la comp\u00E9tence apr\u00E8s correction.</p>
                </div>

                <div class="comp-result-actions">
                    <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                        Retour aux comp\u00E9tences
                    </button>
                </div>
            </div>
        `;
    },

    // ==========================================
    // VUE RELECTURE (après complétion)
    // ==========================================

    switchReviewTab(tab) {
        document.querySelectorAll('.comp-review-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        const tabCorrige = document.getElementById('compTabCorrige');
        const tabSujet = document.getElementById('compTabSujet');
        if (tabCorrige) tabCorrige.classList.toggle('active', tab === 'corrige');
        if (tabSujet) tabSujet.classList.toggle('active', tab === 'sujet');
    },

    showExerciseReview(entrainement, progression) {
        this.currentView = 'exercise';
        this.currentEntrainement = entrainement;

        const container = document.getElementById('competences-content');
        const iframeUrl = this.getEmbedUrl(entrainement.document_url);
        const mode = progression.mode;
        const statut = progression.statut;

        const modeBadgeLabel = mode === 'entrainement' ? 'Entra\u00EEnement' : '\u00C9valuation';

        if (mode === 'entrainement') {
            // === MODE ENTRAÎNEMENT : tabs Corrigé / Sujet ===
            const correctionContent = this._buildCorrectionHTML(entrainement.correction_commentee, entrainement.correction_contenu);
            const hasTabs = !!(iframeUrl || entrainement.document_contenu);

            const tabsHTML = hasTabs ? `
                <div class="comp-review-tabs">
                    <button class="comp-review-tab active" data-tab="corrige" onclick="EleveCompetences.switchReviewTab('corrige')">\u{1F4DD} Corrig\u00E9</button>
                    <button class="comp-review-tab" data-tab="sujet" onclick="EleveCompetences.switchReviewTab('sujet')">\u{1F4C4} Sujet</button>
                </div>
            ` : '';

            const sujetHTML = hasTabs ? `
                <div class="comp-review-tab-content" id="compTabSujet">
                    ${this._buildDocumentHTML(entrainement)}
                </div>
            ` : '';

            container.innerHTML = `
                <div class="comp-exercise-view">
                    <div class="comp-exercise-topbar">
                        <button class="comp-exercise-back" onclick="EleveCompetences.backToDetail()">\u2190</button>
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
                    </div>
                </div>
            `;
        } else {
            // === MODE ÉVALUATION : document + sidebar statut ===
            let sidebarContent = '';
            if (statut === 'soumis') {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">\u{1F4E4}</div>
                        <h4>Production soumise</h4>
                        <p>Votre travail a \u00E9t\u00E9 soumis et est en attente de correction par le professeur.</p>
                    </div>
                `;
            } else if (statut === 'valide') {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">\u2705</div>
                        <h4>Comp\u00E9tence valid\u00E9e</h4>
                        <p>Votre production a \u00E9t\u00E9 corrig\u00E9e et valid\u00E9e par le professeur.</p>
                    </div>
                `;
            } else {
                sidebarContent = `
                    <div class="comp-review-section comp-review-done">
                        <div class="comp-review-icon">\u2705</div>
                        <h4>Exercice termin\u00E9</h4>
                        <p>Vous avez termin\u00E9 cet exercice.</p>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="comp-exercise-view">
                    <div class="comp-exercise-topbar">
                        <button class="comp-exercise-back" onclick="EleveCompetences.backToDetail()">\u2190</button>
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
                            ${this._buildDocumentHTML(entrainement)}
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
        const correctionData = this._parseCorrectionData(entrainement.correction_commentee);

        if (!correctionData.url && !correctionData.proposition) {
            container.innerHTML = `
                <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entrainement.competence_id}')">
                    \u2190 Retour
                </button>
                <div class="comp-message-view">
                    <div class="comp-message-icon">\u{1F4DD}</div>
                    <h2>${this.escapeHtml(entrainement.titre)}</h2>
                    <p class="comp-message-text">Le corrig\u00E9 comment\u00E9 n'est pas encore disponible pour cet exercice.</p>
                </div>
            `;
            return;
        }

        const embedUrl = correctionData.url ? this.getEmbedUrl(correctionData.url) : '';

        container.innerHTML = `
            <button class="comp-back-btn" onclick="EleveCompetences.openCompetence('${entrainement.competence_id}')">
                \u2190 Retour
            </button>

            <div class="comp-corrige-view">
                <div class="comp-corrige-header">
                    <h2>Corrig\u00E9 comment\u00E9</h2>
                    <p class="comp-corrige-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>

                ${correctionData.proposition ? `
                    <div class="comp-inplace-corrige">
                        <h4>Proposition de corrig\u00E9</h4>
                        <div class="comp-inplace-corrige-text">${this.escapeHtml(correctionData.proposition)}</div>
                    </div>
                ` : ''}

                ${embedUrl ? `
                    <div class="comp-corrige-doc">
                        <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                        <a href="${this.escapeHtml(correctionData.url)}" target="_blank" rel="noopener" class="comp-corrige-link">
                            Ouvrir dans un nouvel onglet \u2197
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ==========================================
    // URL EMBED HELPER
    // ==========================================

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
