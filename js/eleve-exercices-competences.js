Object.assign(EleveExercices, {
    // ===============================
    // TACHES COMPLEXES (Compétences)
    // ===============================

    // Data for tâches complexes
    tachesComplexes: [],
    competencesReferentiel: [],
    criteresReussite: [],
    eleveTachesProgress: [],
    currentTacheComplexe: null,
    tacheTimer: null,
    tacheTimeRemaining: 0,

    async initCompetences() {
        this.showLoader('Chargement des taches complexes...');
        try {
            // Load tâches complexes, referentiel, critères and student progress in parallel
            const [tachesResult, compRefResult, criteresResult, progressResult] = await Promise.all([
                this.callAPI('getTachesComplexes', {}),
                this.callAPI('getCompetencesReferentiel', {}),
                this.callAPI('getCriteresReussite', {}),
                this.currentUser ? this.callAPI('getEleveTachesComplexes', { eleve_id: this.currentUser.id }) : { success: true, data: [] }
            ]);

            if (tachesResult.success) {
                this.tachesComplexes = (tachesResult.data || []).filter(t => t.statut === 'publie');
            }
            if (compRefResult.success) {
                this.competencesReferentiel = compRefResult.data || [];
            }
            if (criteresResult.success) {
                this.criteresReussite = criteresResult.data || [];
            }
            if (progressResult.success) {
                this.eleveTachesProgress = progressResult.data || [];
            }

            this.renderTachesComplexesList();
        } catch (error) {
            console.error('Erreur chargement taches complexes:', error);
            this.showError('Erreur lors du chargement des taches complexes');
        }
    },

    renderTachesComplexesList() {
        const container = document.getElementById('exercices-content');

        // Calculate stats
        const totalTaches = this.tachesComplexes.length;
        const completedTaches = this.eleveTachesProgress.filter(p => p.statut === 'termine').length;
        const progressPercent = totalTaches > 0 ? Math.round((completedTaches / totalTaches) * 100) : 0;

        if (totalTaches === 0) {
            container.innerHTML = `
                <div class="type-header-banner competences">
                    <div class="type-header-left">
                        <div class="type-icon-emoji">🎯</div>
                        <div>
                            <h2 class="type-title">Entraînement de compétences</h2>
                        </div>
                    </div>
                </div>
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h3>Aucun entrainement disponible</h3>
                    <p>Les entrainements de competences seront bientot disponibles.</p>
                </div>
            `;
            return;
        }

        // Sort by ordre
        this.tachesComplexes.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        container.innerHTML = `
            <div class="type-header-banner competences">
                <div class="type-header-left">
                    <div class="type-icon-emoji">🎯</div>
                    <div>
                        <h2 class="type-title">Entraînement de compétences</h2>
                    </div>
                </div>
                <div class="type-header-stats">
                    <div class="type-stat">
                        <div class="type-stat-value">${totalTaches}</div>
                        <div class="type-stat-label">Tâches</div>
                    </div>
                </div>
            </div>

            <div class="training-toolbar">
                <div class="global-progress">
                    <div class="global-progress-label">
                        <span>Progression globale</span>
                        <span class="global-progress-value">${completedTaches}/${totalTaches} tâches terminées</span>
                    </div>
                    <div class="global-progress-bar competences">
                        <div class="global-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
            </div>

            <div class="taches-complexes-grid">
                ${this.tachesComplexes.map(tache => this.renderTacheComplexeCard(tache)).join('')}
            </div>
        `;
    },

    renderTacheComplexeCard(tache) {
        // Get student progress for this tache
        const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);

        // Parse competences
        const compIds = (tache.competences_ids || '').split(',').filter(id => id.trim());
        const competences = compIds.map(id => {
            const comp = this.competencesReferentiel.find(c => c.id === id.trim());
            return comp ? comp.nom : null;
        }).filter(Boolean);

        const dureeMin = Math.round((tache.duree || 2700) / 60);

        let statusBadge = '';
        let actionButton = '';

        if (progress) {
            if (progress.statut === 'termine') {
                if (progress.mode === 'entrainement') {
                    statusBadge = '<span class="tache-status entrainement">Termine (entrainement)</span>';
                    actionButton = tache.correction_url
                        ? `<a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-secondary">Voir la correction</a>`
                        : '<span class="no-correction">Correction non disponible</span>';
                } else {
                    statusBadge = '<span class="tache-status points-bonus">Rendu pour points bonus</span>';
                    actionButton = '<span class="attente-correction">En attente de correction</span>';
                }
            } else {
                // En cours
                statusBadge = '<span class="tache-status en-cours">En cours</span>';
                actionButton = `<button class="btn btn-primary" onclick="EleveExercices.resumeTacheComplexe('${tache.id}')">Reprendre</button>`;
            }
        } else {
            // Not started
            actionButton = `<button class="btn btn-primary" onclick="EleveExercices.openTacheChoiceModal('${tache.id}')">Commencer</button>`;
        }

        return `
            <div class="tache-complexe-card" data-id="${tache.id}">
                <div class="tache-card-header">
                    <div class="tache-card-icon">&#128995;</div>
                    <div class="tache-card-info">
                        <h3 class="tache-card-title">${this.escapeHtml(tache.titre)}</h3>
                        ${statusBadge}
                    </div>
                    <div class="tache-card-duration">
                        <span class="duration-icon">&#9202;</span>
                        <span>${dureeMin} min</span>
                    </div>
                </div>
                ${tache.description ? `<p class="tache-card-description">${this.escapeHtml(tache.description)}</p>` : ''}
                <div class="tache-card-competences">
                    <strong>Competences evaluees :</strong>
                    <ul>
                        ${competences.map(c => `<li>${this.escapeHtml(c)}</li>`).join('')}
                    </ul>
                </div>
                <div class="tache-card-actions">
                    ${actionButton}
                </div>
            </div>
        `;
    },

    openTacheChoiceModal(tacheId) {
        // Prevent multiple modals
        const existingModal = document.getElementById('tacheChoiceModal');
        if (existingModal) existingModal.remove();

        const tache = this.tachesComplexes.find(t => t.id === tacheId);
        if (!tache) return;

        this.currentTacheComplexe = tache;
        const dureeMin = Math.round((tache.duree || 2700) / 60);

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'tacheChoiceModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-choice">
                <div class="modal-header">
                    <h2>Choisissez votre mode</h2>
                    <button class="modal-close" onclick="EleveExercices.closeTacheChoiceModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="tache-choice-info">
                        <h3>${this.escapeHtml(tache.titre)}</h3>
                        <p class="tache-choice-duration">Duree : <strong>${dureeMin} minutes</strong></p>
                    </div>

                    <div class="tache-choice-options">
                        <div class="choice-option" onclick="EleveExercices.startTacheComplexe('points_bonus')">
                            <div class="choice-icon">&#127919;</div>
                            <div class="choice-content">
                                <h4>Rendre pour points bonus</h4>
                                <p>Faites le travail seul(e). Vous pourrez rendre votre copie au professeur pour obtenir des points bonus.</p>
                                <p class="choice-warning">Vous ne pourrez pas voir la correction.</p>
                            </div>
                        </div>

                        <div class="choice-option" onclick="EleveExercices.startTacheComplexe('entrainement')">
                            <div class="choice-icon">&#128218;</div>
                            <div class="choice-content">
                                <h4>M'entrainer</h4>
                                <p>Faites le travail pour vous entrainer. Vous pourrez voir la correction a la fin.</p>
                                <p class="choice-warning">Vous ne pourrez pas demander de points bonus.</p>
                            </div>
                        </div>
                    </div>

                    <p class="choice-note"><strong>Attention :</strong> Ce choix est definitif et ne peut pas etre modifie.</p>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    },

    closeTacheChoiceModal() {
        const modal = document.getElementById('tacheChoiceModal');
        if (modal) modal.remove();
        this.currentTacheComplexe = null;
        document.body.style.overflow = '';
    },

    async startTacheComplexe(mode) {
        if (!this.currentTacheComplexe) return;

        const tache = this.currentTacheComplexe;

        // Check if user is connected (allow preview mode for admin)
        if (!this.currentUser) {
            // Preview mode - skip API call, just show exercise
            this.closeTacheChoiceModal();
            this.showTacheComplexeExercise(tache, mode);
            return;
        }

        // Register choice in database
        try {
            const result = await this.callAPI('startEleveTacheComplexe', {
                eleve_id: this.currentUser.id,
                tache_id: tache.id,
                mode: mode
            });

            if (!result.success) {
                if (result.existing) {
                    alert('Vous avez deja fait un choix pour cette tache.');
                    this.closeTacheChoiceModal();
                    this.initCompetences(); // Refresh
                    return;
                }
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
                return;
            }

            // Add to local progress
            this.eleveTachesProgress.push({
                eleve_id: this.currentUser.id,
                tache_id: tache.id,
                mode: mode,
                statut: 'en_cours',
                date_debut: new Date().toISOString()
            });

            this.closeTacheChoiceModal();
            this.showTacheComplexeExercise(tache, mode);
        } catch (error) {
            console.error('Erreur demarrage tache:', error);
            alert('Erreur lors du demarrage');
        }
    },

    resumeTacheComplexe(tacheId) {
        const tache = this.tachesComplexes.find(t => t.id === tacheId);
        const progress = this.eleveTachesProgress.find(p => p.tache_id === tacheId);
        if (!tache || !progress) return;

        this.showTacheComplexeExercise(tache, progress.mode);
    },

    showTacheComplexeExercise(tache, mode) {
        const container = document.getElementById('exercices-content');
        const duree = tache.duree || 2700;
        this.tacheTimeRemaining = duree;
        this.currentTacheComplexe = tache;
        this.currentTacheMode = mode;

        // Parse competences with full data and their individual criteria
        const compIds = (tache.competences_ids || '').split(',').filter(id => id.trim());
        const competences = compIds.map(id => {
            const comp = this.competencesReferentiel.find(c => c.id === id.trim());
            if (!comp) return null;
            // Get criteria for this competence, sorted by ordre
            const criteres = this.criteresReussite
                .filter(cr => cr.competence_id === comp.id)
                .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
            return { id: comp.id, nom: comp.nom, description: comp.description || '', criteres };
        }).filter(Boolean);

        // Generate competences list with expandable criteria
        const competencesHTML = competences.map((c, index) => {
            const hasCriteria = c.criteres && c.criteres.length > 0;
            const criteriaHTML = hasCriteria
                ? `<ul class="criteria-list">${c.criteres.map(cr => `<li>${this.escapeHtml(cr.libelle)}</li>`).join('')}</ul>`
                : (c.description ? this.formatCriteria(c.description) : '');
            const showExpand = hasCriteria || c.description;

            return `
                <div class="competence-item-v2">
                    <div class="competence-header-v2" onclick="EleveExercices.toggleCompetenceCriteria(${index})">
                        <span class="competence-bullet">●</span>
                        <span class="competence-name-v2">${this.escapeHtml(c.nom)}</span>
                        ${showExpand ? `<span class="competence-chevron" id="compExpand${index}">▼</span>` : ''}
                    </div>
                    ${showExpand ? `
                        <div class="competence-criteria-v2 hidden" id="compCriteria${index}">
                            ${criteriaHTML}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Convert document URL for iframe embedding
        const iframeUrl = this.getEmbedUrl(tache.document_url);

        // Correction button for training mode
        const correctionBtn = mode === 'entrainement' ? `
            <div class="correction-section">
                ${tache.correction_url
                    ? `<a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-correction">
                        📝 Voir la correction
                       </a>`
                    : `<button class="btn btn-correction-disabled" disabled>
                        📝 Correction non disponible
                       </button>`
                }
            </div>
        ` : '';

        container.innerHTML = `
            <div class="tache-exercise-view-v3">
                <button class="exercise-back-btn" onclick="EleveExercices.backToCompetencesList()">
                    ← Retour aux entrainements
                </button>

                <div class="exercise-card-v3">
                    <div class="exercise-header competences">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${this.escapeHtml(tache.titre)}</h1>
                                <div class="exercise-header-meta">
                                    <span class="mode-badge-inline ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Evaluation - Points bonus'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="tacheTimer">
                            <span class="timer-icon">⏱</span>
                            <span id="timerDisplay">${this.formatTime(this.tacheTimeRemaining)}</span>
                        </div>
                    </div>

                    ${tache.description ? `
                        <div class="consigne-box">
                            <div class="consigne-label">CONSIGNE</div>
                            <div class="consigne-text">${this.escapeHtml(tache.description)}</div>
                        </div>
                    ` : ''}

                    <div class="tache-layout-v3">
                        <div class="document-section">
                            <div class="document-toolbar">
                                <span class="document-title">Document</span>
                                <div class="document-actions-v3">
                                    <a href="${this.escapeHtml(tache.document_url)}" download class="doc-btn" title="Télécharger">
                                        ⬇️
                                    </a>
                                    <button class="doc-btn" onclick="EleveExercices.toggleFullscreen()" title="Plein écran">
                                        ⛶
                                    </button>
                                    <a href="${this.escapeHtml(tache.document_url)}" target="_blank" class="doc-btn" title="Nouvel onglet">
                                        ↗️
                                    </a>
                                </div>
                            </div>
                            <div class="document-frame-wrapper" id="documentWrapper">
                                <iframe src="${iframeUrl}" class="document-frame" id="documentIframe" allowfullscreen></iframe>
                            </div>
                        </div>

                        <div class="sidebar-section">
                            <div class="sidebar-panel competences-panel-v2">
                                <h3>Compétences évaluées</h3>
                                <p class="panel-hint">Cliquez pour voir les critères</p>
                                <div class="competences-list-v2">
                                    ${competencesHTML}
                                </div>
                            </div>

                            ${correctionBtn}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Start timer
        this.startTacheTimer();
    },

    formatCriteria(description) {
        // Split by line breaks or dashes to create list items
        const lines = description.split(/[\n\r]+|(?=\s*-\s)/).filter(line => line.trim());
        if (lines.length <= 1) {
            return `<div class="criteria-text">${this.escapeHtml(description)}</div>`;
        }
        return `<ul class="criteria-list">
            ${lines.map(line => {
                const cleanLine = line.replace(/^[\s-]+/, '').trim();
                return cleanLine ? `<li>${this.escapeHtml(cleanLine)}</li>` : '';
            }).join('')}
        </ul>`;
    },

    toggleFullscreen() {
        const wrapper = document.getElementById('documentWrapper');
        if (wrapper) {
            wrapper.classList.toggle('fullscreen');
            document.body.classList.toggle('document-fullscreen-active');
        }
    },

    toggleCompetenceCriteria(index) {
        const criteria = document.getElementById(`compCriteria${index}`);
        const expand = document.getElementById(`compExpand${index}`);
        if (criteria) {
            criteria.classList.toggle('hidden');
            if (expand) {
                expand.innerHTML = criteria.classList.contains('hidden') ? '&#9660;' : '&#9650;';
            }
        }
    },

    getEmbedUrl(url) {
        if (!url) return '';

        // Publuu flip-book - convert to embed URL
        if (url.includes('publuu.com/flip-book')) {
            // Format: https://publuu.com/flip-book/USER_ID/BOOK_ID
            // Embed: https://publuu.com/flip-book/USER_ID/BOOK_ID/page/1?embed
            const match = url.match(/publuu\.com\/flip-book\/(\d+)\/(\d+)/);
            if (match) {
                return `https://publuu.com/flip-book/${match[1]}/${match[2]}/page/1?embed`;
            }
            // Already has page number, just add ?embed if missing
            if (!url.includes('?embed')) {
                return url + (url.includes('/page/') ? '?embed' : '/page/1?embed');
            }
            return url;
        }

        // Google Drive file - convert to embed URL
        if (url.includes('drive.google.com')) {
            // Handle /file/d/ format
            const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) {
                return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
            }
            // Handle ?id= format
            const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch) {
                return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
            }
        }
        // Google Docs/Slides/Sheets - convert to embed
        if (url.includes('docs.google.com')) {
            if (url.includes('/edit') || url.includes('/view')) {
                return url.replace(/\/(edit|view).*$/, '/preview');
            }
            return url + '/preview';
        }
        // PDF direct URL - use Google Docs viewer
        if (url.toLowerCase().endsWith('.pdf')) {
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }
        // Default - try direct embed
        return url;
    },

    backToCompetencesList() {
        if (this.tacheTimer) {
            clearInterval(this.tacheTimer);
            this.tacheTimer = null;
        }
        this.currentTacheComplexe = null;
        this.initCompetences();
    },

    startTacheTimer() {
        if (this.tacheTimer) clearInterval(this.tacheTimer);
        this.timerExpiredShown = false;

        this.tacheTimer = setInterval(() => {
            this.tacheTimeRemaining--;
            const timerEl = document.getElementById('tacheTimer');
            const timerDisplay = document.getElementById('timerDisplay');

            if (timerDisplay) {
                // Show negative time for training mode
                if (this.tacheTimeRemaining < 0 && this.currentTacheMode === 'entrainement') {
                    timerDisplay.textContent = '+' + this.formatTime(Math.abs(this.tacheTimeRemaining));
                } else {
                    timerDisplay.textContent = this.formatTime(Math.max(0, this.tacheTimeRemaining));
                }
            }
            if (timerEl) {
                if (this.tacheTimeRemaining <= 300 && this.tacheTimeRemaining > 60) {
                    timerEl.classList.add('warning');
                    timerEl.classList.remove('danger');
                }
                if (this.tacheTimeRemaining <= 60) {
                    timerEl.classList.add('danger');
                    timerEl.classList.remove('warning');
                }
                if (this.tacheTimeRemaining < 0) {
                    timerEl.classList.add('overtime');
                }
            }

            if (this.tacheTimeRemaining <= 0 && !this.timerExpiredShown) {
                this.timerExpiredShown = true;

                if (this.currentTacheMode === 'points_bonus') {
                    // Points bonus mode: BLOCK and redirect
                    clearInterval(this.tacheTimer);
                    this.tacheTimer = null;
                    this.showTimeExpiredPointsBonus();
                } else {
                    // Training mode: Just show a non-blocking notification
                    this.showTimerExpiredNotification();
                    // Timer continues counting in overtime
                }
            }
        }, 1000);
    },

    showTimerExpiredNotification() {
        // Create a non-blocking notification for training mode
        const notification = document.createElement('div');
        notification.className = 'timer-notification';
        notification.innerHTML = `
            <div class="timer-notification-content">
                <span class="notification-icon">⏱</span>
                <span>Temps écoulé ! Vous pouvez continuer à travailler.</span>
                <button onclick="this.parentElement.parentElement.remove()">✕</button>
            </div>
        `;
        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    },

    async showTimeExpiredPointsBonus() {
        const tache = this.currentTacheComplexe;

        // Submit for correction in database if user is connected
        if (tache && this.currentUser) {
            try {
                // Calculate time spent (total duration since timer counts down from duree)
                const duree = tache.duree || 2700;
                const tempsPasse = duree; // Full duration for points bonus mode

                await this.callAPI('submitEleveTacheComplexe', {
                    eleve_id: this.currentUser.id,
                    tache_id: tache.id,
                    temps_passe: tempsPasse
                });

                const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);
                if (progress) {
                    progress.statut = 'soumis';
                    progress.date_soumission = new Date().toISOString();
                }
            } catch (error) {
                console.error('Erreur soumission tache:', error);
            }
        }

        // Show blocking screen for points bonus mode
        const container = document.getElementById('exercices-content');

        container.innerHTML = `
            <div class="tache-timeup-view points-bonus-expired">
                <div class="timeup-icon">⏰</div>
                <h2>Temps écoulé !</h2>
                <h3>${tache ? this.escapeHtml(tache.titre) : ''}</h3>
                <div class="timeup-mode">
                    <span class="mode-badge points_bonus">Évaluation - Points bonus</span>
                </div>

                <div class="timeup-content">
                    <p class="important-message">L'épreuve est terminée. Vous devez maintenant rendre votre travail.</p>

                    <div class="submit-instructions">
                        <h3>📤 Comment rendre votre travail ?</h3>
                        <div class="submit-options">
                            <div class="submit-option">
                                <span class="submit-icon">📧</span>
                                <div>
                                    <strong>Par mail (format numérique)</strong>
                                    <p>Envoyez votre travail <strong>dans les 30 minutes</strong></p>
                                </div>
                            </div>
                            <div class="submit-option">
                                <span class="submit-icon">📄</span>
                                <div>
                                    <strong>En format papier</strong>
                                    <p>Déposez votre copie <strong>dans le casier du professeur le lendemain</strong></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p class="info-note">✅ Votre participation a été enregistrée.</p>
                    <p class="info-note secondary">Une fois votre copie corrigée, vous pourrez accéder au mode "Entraînement" pour cette tâche.</p>
                </div>

                <div class="timeup-actions">
                    <button class="btn btn-primary" onclick="EleveExercices.initCompetences()">
                        Retour aux entraînements
                    </button>
                </div>
            </div>
        `;
    },

    async showTimeExpired() {
        const tache = this.currentTacheComplexe;
        const mode = this.currentTacheMode || 'entrainement';

        // Update in database if user is connected
        if (tache && this.currentUser) {
            try {
                await this.callAPI('finishEleveTacheComplexe', {
                    eleve_id: this.currentUser.id,
                    tache_id: tache.id
                });

                const progress = this.eleveTachesProgress.find(p => p.tache_id === tache.id);
                if (progress) {
                    progress.statut = 'termine';
                    progress.date_fin = new Date().toISOString();
                }
            } catch (error) {
                console.error('Erreur fin tache:', error);
            }
        }

        // Show time expired screen
        const container = document.getElementById('exercices-content');

        let submitInstructions = '';
        if (mode === 'points_bonus') {
            submitInstructions = `
                <div class="submit-instructions">
                    <h3>Comment rendre votre travail ?</h3>
                    <div class="submit-options">
                        <div class="submit-option">
                            <span class="submit-icon">&#128233;</span>
                            <div>
                                <strong>Par messagerie (format numerique)</strong>
                                <p>Envoyez votre travail dans les 30 minutes</p>
                            </div>
                        </div>
                        <div class="submit-option">
                            <span class="submit-icon">&#128196;</span>
                            <div>
                                <strong>En format papier</strong>
                                <p>Remettez votre copie a la prochaine seance</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="tache-timeup-view">
                <div class="timeup-icon">&#9200;</div>
                <h2>Temps ecoule !</h2>
                <h3>${tache ? this.escapeHtml(tache.titre) : ''}</h3>
                <div class="timeup-mode">
                    Mode : <span class="mode-badge ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Evaluation - Points bonus'}</span>
                </div>

                ${mode === 'entrainement' ? `
                    <div class="timeup-content">
                        <p>L'entrainement est termine. Vous pouvez consulter la correction.</p>
                        ${tache && tache.correction_url ? `
                            <a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-primary btn-large">
                                Voir la correction
                            </a>
                        ` : '<p class="no-correction">La correction n\'est pas encore disponible.</p>'}
                    </div>
                ` : `
                    <div class="timeup-content">
                        <p>L'epreuve est terminee. Vous devez maintenant rendre votre travail au professeur.</p>
                        ${submitInstructions}
                        <p class="info-note">Votre participation a ete enregistree.</p>
                    </div>
                `}

                <div class="timeup-actions">
                    <button class="btn btn-secondary" onclick="EleveExercices.initCompetences()">
                        Retour aux entrainements
                    </button>
                </div>
            </div>
        `;
    },

    showTacheComplexeComplete(tache, mode) {
        // This is now only called for preview mode or legacy
        const container = document.getElementById('exercices-content');

        let resultContent = '';
        if (mode === 'entrainement') {
            resultContent = `
                <p>Vous pouvez maintenant consulter la correction.</p>
                ${tache.correction_url ? `
                    <a href="${this.escapeHtml(tache.correction_url)}" target="_blank" class="btn btn-primary btn-large">
                        Voir la correction
                    </a>
                ` : '<p class="no-correction">La correction n\'est pas encore disponible.</p>'}
            `;
        } else {
            resultContent = `
                <p>Rendez votre copie au professeur pour obtenir vos points bonus.</p>
                <p class="info-note">Votre participation a ete enregistree.</p>
            `;
        }

        container.innerHTML = `
            <div class="tache-complete-view">
                <div class="complete-icon">&#10004;</div>
                <h2>Travail termine !</h2>
                <h3>${this.escapeHtml(tache.titre)}</h3>
                <div class="complete-mode">
                    Mode : <span class="mode-badge ${mode}">${mode === 'entrainement' ? 'Entrainement' : 'Points bonus'}</span>
                </div>
                <div class="complete-content">
                    ${resultContent}
                </div>
                <div class="complete-actions">
                    <button class="btn btn-secondary" onclick="EleveExercices.initCompetences()">
                        Retour aux taches
                    </button>
                </div>
            </div>
        `;
    },
});
