/**
 * Module Élève — Entraînement de compétences
 * Extension : vue exercice, timer, corrigé commenté, auto-évaluation
 *
 * Ce fichier étend EleveCompetences via Object.assign
 */

Object.assign(EleveCompetences, {

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
        this.timeRemaining = duree;

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

        // HTML critères dans la sidebar
        const criteresHTML = criteresComp.length > 0 ? `
            <div class="comp-sidebar-criteres">
                <h4>Critères de réussite</h4>
                <ul class="comp-sidebar-criteres-list">
                    ${criteresComp.map((cr, i) => `
                        <li>
                            <span class="comp-critere-num">${i + 1}</span>
                            <span class="comp-critere-text">${this.escapeHtml(cr.libelle)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        ` : '';

        // Consigne : priorité compétence > exercice
        const consigneText = (comp && comp.consigne) ? comp.consigne : (entrainement.description || '');

        container.innerHTML = `
            <div class="comp-exercise-view">
                <button class="comp-back-btn" onclick="EleveCompetences.confirmLeaveExercise()">
                    ← Retour
                </button>

                <div class="comp-exercise-topbar">
                    <div class="comp-exercise-topbar-info">
                        <h1>${this.escapeHtml(entrainement.titre)}</h1>
                        <div class="comp-exercise-topbar-meta">
                            <span class="comp-mode-badge ${mode}">${mode === 'entrainement' ? 'Entraînement' : 'Évaluation'}</span>
                            ${comp ? `<span class="comp-competence-tag">${this.escapeHtml(comp.nom)}</span>` : ''}
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
                    <div class="comp-document-section">
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

                        <div class="comp-sidebar-actions">
                            <button class="comp-btn comp-btn-finish" onclick="EleveCompetences.finishEntrainement()">
                                ${mode === 'entrainement' ? 'Terminer l\'entraînement' : 'Soumettre ma production'}
                            </button>
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
        if (confirm('Voulez-vous vraiment quitter ? Votre progression sera conservée.')) {
            this.backToDetail();
        }
    },

    // ==========================================
    // TIMER
    // ==========================================

    startTimer() {
        this.stopTimer();
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
        }, 1000);
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
    // RÉSULTAT MODE ENTRAÎNEMENT
    // ==========================================

    showTrainingResult(entrainement) {
        const container = document.getElementById('competences-content');
        const correctionUrl = this._getCorrectionUrl(entrainement.correction_commentee);

        // Critères
        const criteresComp = this.criteres
            .filter(cr => String(cr.competence_id) === String(entrainement.competence_id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        // Corrigé commenté
        let correctionHTML = '';
        if (correctionUrl) {
            const embedUrl = this.getEmbedUrl(correctionUrl);
            correctionHTML = `
                <div class="comp-corrige-section">
                    <h3>Corrigé commenté</h3>
                    <div class="comp-corrige-doc">
                        <iframe src="${embedUrl}" class="comp-corrige-iframe" allowfullscreen></iframe>
                        <a href="${this.escapeHtml(correctionUrl)}" target="_blank" rel="noopener" class="comp-corrige-link">
                            Ouvrir dans un nouvel onglet ↗
                        </a>
                    </div>
                </div>
            `;
        } else {
            correctionHTML = `
                <div class="comp-corrige-section comp-corrige-empty">
                    <p>Le corrigé commenté n'est pas encore disponible pour cet exercice.</p>
                </div>
            `;
        }

        // Auto-évaluation
        const autoEvalHTML = criteresComp.length > 0 ? `
            <div class="comp-autoeval-section">
                <h3>Auto-évaluation</h3>
                <p class="comp-autoeval-hint">Comparez votre travail avec le corrigé et cochez les critères que vous pensez avoir respectés.</p>
                <div class="comp-autoeval-list">
                    ${criteresComp.map(cr => `
                        <label class="comp-autoeval-item">
                            <input type="checkbox" class="comp-autoeval-checkbox">
                            <span class="comp-autoeval-check"></span>
                            <span class="comp-autoeval-text">${this.escapeHtml(cr.libelle)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        ` : '';

        container.innerHTML = `
            <div class="comp-result-view">
                <div class="comp-result-header training">
                    <div class="comp-result-icon">📝</div>
                    <h2>Entraînement terminé</h2>
                    <p class="comp-result-subtitle">${this.escapeHtml(entrainement.titre)}</p>
                </div>

                ${correctionHTML}
                ${autoEvalHTML}

                <div class="comp-result-actions">
                    <button class="comp-btn comp-btn-secondary" onclick="EleveCompetences.backToDetail()">
                        Retour à la compétence
                    </button>
                    <button class="comp-btn comp-btn-primary" onclick="EleveCompetences.backToList()">
                        Retour aux compétences
                    </button>
                </div>
            </div>
        `;
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
