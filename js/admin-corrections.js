/**
 * Admin Corrections — Correction des entraînements de compétences
 * Wizard 3 étapes : Informations → Correction → Bilan
 */

const AdminCorrections = {

    // Données chargées
    submissions: [],
    entrainements: [],
    banques: [],
    competences: [],
    criteres: [],
    utilisateurs: [],

    // État du wizard
    currentTab: 'pending',
    currentStep: 1,
    currentSubmission: null,
    wizardData: {
        criteresValides: [],
        decision: null,
        remarque: '',
        correctionType: null,
        correctionValue: ''
    },

    _saving: false,
    _searchQuery: '',

    // ========== INITIALIZATION ==========

    async init() {
        try {
            await this.loadData();
            this.updateCounts();
            this.renderGrid();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation corrections:', error);
            this.showError('Erreur lors du chargement des corrections');
        }
    },

    // ========== DATA LOADING (SheetsAPI — cache localStorage) ==========

    async loadData() {
        var results = await Promise.all([
            SheetsAPI.fetchAndParse('EleveEntrainementsCompetences'),
            SheetsAPI.fetchAndParse('EntrainementsCompetences'),
            SheetsAPI.fetchAndParse('BanquesCompetences'),
            SheetsAPI.fetchAndParse('CompetencesReferentiel'),
            SheetsAPI.fetchAndParse('CriteresReussite'),
            SheetsAPI.fetchAndParse('UTILISATEURS')
        ]);

        this.submissions = results[0] || [];
        this.entrainements = results[1] || [];
        this.banques = results[2] || [];
        this.competences = results[3] || [];
        this.criteres = results[4] || [];
        this.utilisateurs = results[5] || [];
    },

    callAPI(action, params) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            var queryParams = new URLSearchParams(Object.assign({ action: action, callback: callbackName }, params));
            script.src = CONFIG.WEBAPP_URL + '?' + queryParams.toString();
            script.onerror = function() {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed: ' + action));
            };

            document.body.appendChild(script);
        });
    },

    // ========== HELPERS ==========

    getEleve(eleveId) {
        return this.utilisateurs.find(function(u) { return String(u.id) === String(eleveId); });
    },

    getEntrainement(entrainementId) {
        return this.entrainements.find(function(e) { return String(e.id) === String(entrainementId); });
    },

    getCompetence(competenceId) {
        return this.competences.find(function(c) { return String(c.id) === String(competenceId); });
    },

    getCriteresByCompetence(competenceId) {
        return this.criteres
            .filter(function(c) { return String(c.competence_id) === String(competenceId); })
            .sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    },

    getCompetenceForEntrainement(entrainement) {
        if (!entrainement) return null;
        if (entrainement.banque_id) {
            var banque = this.banques.find(function(b) { return String(b.id) === String(entrainement.banque_id); });
            if (banque && banque.competence_id) return this.getCompetence(banque.competence_id);
        }
        if (entrainement.competence_id) return this.getCompetence(entrainement.competence_id);
        return null;
    },

    getPendingSubmissions() {
        return this.submissions
            .filter(function(s) { return s.statut === 'soumis'; })
            .sort(function(a, b) {
                return new Date(a.date_soumission || 0) - new Date(b.date_soumission || 0);
            });
    },

    getDoneSubmissions() {
        return this.submissions
            .filter(function(s) { return s.statut === 'valide' || s.statut === 'non_valide'; })
            .sort(function(a, b) {
                return new Date(b.date_correction || 0) - new Date(a.date_correction || 0);
            });
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    },

    formatDateLong(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    },

    formatTime(seconds) {
        if (!seconds) return '—';
        var s = parseInt(seconds, 10);
        if (s < 60) return s + 's';
        var min = Math.floor(s / 60);
        var sec = s % 60;
        return min + ' min' + (sec > 0 ? ' ' + sec + 's' : '');
    },

    getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return parts[0].substring(0, 2).toUpperCase();
    },

    getModeLabel(mode) {
        if (mode === 'papier') return '📄 Papier';
        if (mode === 'numerique') return '💻 Numérique';
        return '';
    },

    getEleveName(eleve) {
        if (!eleve) return 'Élève inconnu';
        var prenom = eleve.prenom || '';
        var nom = eleve.nom || '';
        if (prenom && nom) return prenom + ' ' + nom;
        return eleve.identifiant || 'Élève inconnu';
    },

    formatRelativeDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffH = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return "À l'instant";
        if (diffMin < 60) return 'Il y a ' + diffMin + ' min';
        if (diffH < 24) return 'Il y a ' + diffH + 'h';
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
        return this.formatDate(dateStr);
    },

    _isOlderThan(dateStr, days) {
        if (!dateStr) return false;
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return (new Date() - d) > days * 86400000;
    },

    // ========== TABS ==========

    showTab(tab) {
        this.currentTab = tab;
        document.getElementById('togglePending').classList.toggle('active', tab === 'pending');
        document.getElementById('toggleDone').classList.toggle('active', tab === 'done');
        var bg = document.getElementById('segmentedBg');
        if (bg) bg.classList.toggle('right', tab === 'done');
        this.renderGrid();
    },

    updateCounts() {
        document.getElementById('pendingCount').textContent = this.getPendingSubmissions().length;
        document.getElementById('doneCount').textContent = this.getDoneSubmissions().length;
    },

    onSearch(query) {
        this._searchQuery = (query || '').trim().toLowerCase();
        this.renderGrid();
    },

    // ========== RENDER GRID ==========

    renderGrid() {
        var items = this.currentTab === 'pending' ? this.getPendingSubmissions() : this.getDoneSubmissions();
        var grid = document.getElementById('correctionsGrid');
        var empty = document.getElementById('emptyState');

        var self = this;
        if (this._searchQuery) {
            items = items.filter(function(s) {
                var eleve = self.getEleve(s.eleve_id);
                var name = self.getEleveName(eleve).toLowerCase();
                return name.indexOf(self._searchQuery) !== -1;
            });
        }

        if (items.length === 0) {
            grid.innerHTML = '';
            var isSearch = this._searchQuery.length > 0;
            document.getElementById('emptyIcon').textContent = isSearch ? '🔍' : (this.currentTab === 'pending' ? '✅' : '📂');
            document.getElementById('emptyMessage').textContent = isSearch
                ? 'Aucun résultat pour « ' + this._searchQuery + ' »'
                : (this.currentTab === 'pending'
                    ? 'Aucune copie à corriger pour le moment !'
                    : 'Aucune correction terminée.');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = items.map(function(sub) {
            return self.renderCard(sub);
        }).join('');
    },

    renderCard(sub) {
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);

        var eleveName = this.getEleveName(eleve);
        var entrainementTitle = entrainement ? entrainement.titre : 'Entraînement inconnu';
        var competenceNom = competence ? competence.nom : '';
        var isDone = sub.statut === 'valide' || sub.statut === 'non_valide';

        var subKey = sub.id || (sub.eleve_id + '_' + sub.entrainement_id);

        var stripeClass = isDone ? ('stripe-' + sub.statut) : 'stripe-pending';

        var badgesHtml = '<div class="card-badges">';

        if (competenceNom) {
            badgesHtml += '<span class="card-badge badge-competence">' + escapeHtml(competenceNom) + '</span>';
        }

        var modeLabel = this.getModeLabel(sub.mode_rendu);
        if (modeLabel) {
            var modeClass = sub.mode_rendu === 'papier' ? 'badge-papier' : 'badge-numerique';
            badgesHtml += '<span class="card-badge ' + modeClass + '">' + modeLabel + '</span>';
        }

        if (!isDone) {
            if (sub.date_envoi) {
                var envoyeLabel = sub.mode_rendu === 'papier' ? '✅ Copie déposée' : '✅ Copie envoyée';
                badgesHtml += '<span class="card-badge badge-sent">' + envoyeLabel + '</span>';
            } else if (sub.mode_rendu === 'papier' || sub.mode_rendu === 'numerique') {
                badgesHtml += '<span class="card-badge badge-waiting">📄 Copie en attente</span>';
            } else {
                badgesHtml += '<span class="card-badge badge-waiting">⏳ Terminé</span>';
            }
        }

        badgesHtml += '</div>';

        var dateRef = isDone ? sub.date_correction : sub.date_soumission;
        var relativeDate = this.formatRelativeDate(dateRef);
        var isUrgent = !isDone && this._isOlderThan(sub.date_soumission, 2);

        var decisionHtml = '';
        if (isDone) {
            var isValide = sub.statut === 'valide';
            decisionHtml = '<span class="card-decision ' + sub.statut + '">' +
                (isValide ? '✅ Validé' : '❌ Non validé') + '</span>';
        }

        return '<div class="correction-card' + (isDone ? ' done' : '') + '" onclick="AdminCorrections.openModal(\'' + escapeHtml(subKey) + '\')">' +
            '<div class="card-stripe ' + stripeClass + '"></div>' +
            '<div class="card-body">' +
                '<div class="card-avatar">' + this.getInitials(eleveName) + '</div>' +
                '<div class="card-main">' +
                    '<div class="card-eleve">' + escapeHtml(eleveName) + '</div>' +
                    '<div class="card-entrainement">' + escapeHtml(entrainementTitle) + '</div>' +
                '</div>' +
                badgesHtml +
                '<div class="card-right">' +
                    '<span class="card-date' + (isUrgent ? ' urgent' : '') + '">' + relativeDate + '</span>' +
                    decisionHtml +
                '</div>' +
                '<span class="card-arrow">›</span>' +
            '</div>' +
        '</div>';
    },

    // ========== MODAL / WIZARD ==========

    openModal(subId) {
        var sub = this.submissions.find(function(s) {
            return String(s.id) === String(subId) ||
                   (s.eleve_id + '_' + s.entrainement_id) === subId;
        });
        if (!sub) return;

        this.currentSubmission = sub;
        this.currentStep = 1;

        var existingCriteres = [];
        if (sub.criteres_valides) {
            try {
                existingCriteres = JSON.parse(sub.criteres_valides);
            } catch (_e) { /* ignore */ }
        }

        // Détecter le type de correction existante
        var corrType = null;
        var corrValue = '';
        if (sub.correction_prof) {
            var val = String(sub.correction_prof);
            if (val.startsWith('http')) {
                corrType = 'url';
                corrValue = val;
            } else {
                corrType = 'blocks';
                corrValue = val;
            }
        }

        this.wizardData = {
            criteresValides: Array.isArray(existingCriteres) ? existingCriteres.map(String) : [],
            decision: (sub.statut === 'valide' || sub.statut === 'non_valide') ? sub.statut : null,
            remarque: sub.remarque_prof || '',
            correctionType: corrType,
            correctionValue: corrValue
        };

        this.updateModalTitle();
        this.renderStep();
        this.updateWizardIndicators();
        document.getElementById('correctionModal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('correctionModal').classList.add('hidden');
        this.currentSubmission = null;
    },

    updateModalTitle() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var title = this.getEleveName(eleve) + ' — ' + (entrainement ? entrainement.titre : 'Entraînement');
        document.getElementById('correctionModalTitle').textContent = title;
    },

    goToStep(step) {
        if (this.currentStep === 2) {
            this._saveStep2State();
        }
        this.currentStep = step;
        this.renderStep();
        this.updateWizardIndicators();
    },

    updateWizardIndicators() {
        var self = this;
        document.querySelectorAll('.wizard-step').forEach(function(el) {
            var stepNum = parseInt(el.dataset.step);
            el.classList.remove('active', 'completed');
            if (stepNum === self.currentStep) {
                el.classList.add('active');
            } else if (stepNum < self.currentStep) {
                el.classList.add('completed');
            }
        });
    },

    renderStep() {
        var body = document.getElementById('correctionModalBody');
        var footer = document.getElementById('correctionModalFooter');

        if (this.currentStep === 1) {
            body.innerHTML = this.renderStep1();
            footer.innerHTML = this.renderFooter1();
        } else if (this.currentStep === 2) {
            body.innerHTML = this.renderStep2();
            footer.innerHTML = this.renderFooter2();
            this._initStep2();
        } else if (this.currentStep === 3) {
            body.innerHTML = this.renderStep3();
            footer.innerHTML = this.renderFooter3();
        }
    },

    // ========== ÉTAPE 1 — INFORMATIONS ==========

    renderStep1() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);

        var html = '<div class="info-grid">';
        html += this._infoItem('👤', 'Élève', this.getEleveName(eleve));
        html += this._infoItem('📅', 'Soumis le', this.formatDateLong(sub.date_soumission));
        html += this._infoItem('⏱', 'Temps passé', this.formatTime(sub.temps_passe));
        html += this._infoItem('📄', 'Mode de rendu', this.getModeLabel(sub.mode_rendu) || '—');
        html += this._infoItem('🎯', 'Compétence', competence ? competence.nom : '—');
        html += this._infoItem('📝', 'Exercice', entrainement ? entrainement.titre : '—');
        html += '</div>';

        // Statut brouillon / publié
        var isPublie = sub.statut_correction !== 'brouillon';
        html += '<div class="statut-toggle-section">';
        html += '<label class="statut-toggle-label">Visibilité pour l\'élève</label>';
        html += '<div class="statut-toggle">';
        html += '<button type="button" class="statut-btn' + (!isPublie ? ' active brouillon' : '') + '" data-statut="brouillon" onclick="AdminCorrections._setStatutCorrection(\'brouillon\')">🔒 Brouillon</button>';
        html += '<button type="button" class="statut-btn' + (isPublie ? ' active publie' : '') + '" data-statut="publie" onclick="AdminCorrections._setStatutCorrection(\'publie\')">👁 Publié</button>';
        html += '</div>';
        html += '<div class="statut-help">' + (isPublie ? 'L\'élève verra la correction' : 'L\'élève ne verra pas la correction') + '</div>';
        html += '</div>';

        return html;
    },

    _infoItem(icon, label, value) {
        return '<div class="info-item">' +
            '<span class="info-icon">' + icon + '</span>' +
            '<div><div class="info-label">' + label + '</div>' +
            '<div class="info-value">' + escapeHtml(value) + '</div></div>' +
        '</div>';
    },

    _setStatutCorrection(statut) {
        this.wizardData.statutCorrection = statut;
        var btns = document.querySelectorAll('.statut-btn');
        btns.forEach(function(btn) {
            var isActive = btn.dataset.statut === statut;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('brouillon', isActive && statut === 'brouillon');
            btn.classList.toggle('publie', isActive && statut === 'publie');
        });
        var help = document.querySelector('.statut-help');
        if (help) help.textContent = statut === 'publie' ? 'L\'élève verra la correction' : 'L\'élève ne verra pas la correction';
    },

    renderFooter1() {
        return '<div class="footer-left"></div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.goToStep(2)">Suivant →</button>' +
            '</div>';
    },

    // ========== ÉTAPE 2 — CORRECTION (block editor + critères + décision) ==========

    renderStep2() {
        var sub = this.currentSubmission;
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];
        var wd = this.wizardData;

        // Détecter le mode corrigé
        var hasCorrectionBlocks = false;
        if (wd.correctionType === 'blocks' && wd.correctionValue) {
            hasCorrectionBlocks = true;
        }
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        var html = '';

        // Corrigé commenté — header
        html += '<div class="step-header">';
        html += '<span class="step-icon">📝</span>';
        html += '<div><h3>Corrigé commenté</h3>';
        html += '<p>Construisez le corrigé que l\'élève verra (optionnel)</p></div>';
        html += '</div>';

        // Source toggle (Lien Google Doc / Éditeur) — pill style
        html += '<div class="source-toggle" id="correctionToggle">';
        html += '<button type="button" class="source-toggle-btn' + (corrMode === 'url' ? ' active' : '') + '" data-mode="url" onclick="AdminCorrections._switchCorrectionMode(\'url\')">Lien Google Doc</button>';
        html += '<button type="button" class="source-toggle-btn' + (corrMode === 'editor' ? ' active' : '') + '" data-mode="editor" onclick="AdminCorrections._switchCorrectionMode(\'editor\')">Éditeur</button>';
        html += '</div>';

        // Panel URL
        html += '<div class="source-panel" id="correctionUrlPanel"' + (corrMode !== 'url' ? ' style="display:none"' : '') + '>';
        html += '<div class="form-group">';
        html += '<label>Lien Google Doc du corrigé</label>';
        html += '<input type="text" class="form-input" id="correctionUrlInput" placeholder="https://docs.google.com/document/d/..." value="' + escapeHtml(wd.correctionType === 'url' ? wd.correctionValue : '') + '">';
        html += '<div class="form-help">Collez le lien de partage du Google Doc (doit être accessible en lecture)</div>';
        html += '</div>';
        html += '</div>';

        // Panel Éditeur (block editor avec tabs Construction / Vue élève)
        html += '<div class="source-panel" id="correctionEditorPanel"' + (corrMode !== 'editor' ? ' style="display:none"' : '') + '>';

        // Tabs Construction / Vue élève
        html += '<div class="tb-tabs">';
        html += '<button type="button" class="tb-tab active" id="corrTabConstruction" onclick="AdminCorrections._switchEditorTab(\'construction\')">';
        html += '<span class="tb-tab-icon">⚙️</span> Construction</button>';
        html += '<button type="button" class="tb-tab" id="corrTabPreview" onclick="AdminCorrections._switchEditorTab(\'preview\')">';
        html += '<span class="tb-tab-icon">👁</span> Vue élève</button>';
        html += '</div>';

        // Construction panel
        html += '<div id="corrConstructionPanel">';
        html += '<div id="corrBlockEditorContainer" class="block-editor"></div>';
        html += this.renderBlockAddBar();
        html += '</div>';

        // Preview panel
        html += '<div id="corrPreviewPanel" class="tb-preview-panel" style="display:none;">';
        html += '<div id="corrPreviewContainer" class="cw-preview-frame">';
        html += '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\'aperçu</div>';
        html += '</div>';
        html += '</div>';

        html += '</div>'; // fin source-panel éditeur

        // Critères de réussite (dropdown)
        if (criteres.length > 0) {
            var checkedCount = wd.criteresValides.length;
            var hasCriteres = checkedCount > 0;
            html += '<div class="correction-section" style="margin-top: 1rem">';
            html += '<div class="correction-section-header' + (hasCriteres ? ' expanded' : '') + '" onclick="AdminCorrections.toggleSection(this)">';
            html += '<h4>✅ Critères de réussite (' + checkedCount + '/' + criteres.length + ')</h4>';
            html += '<span class="toggle-icon">▼</span>';
            html += '</div>';
            html += '<div class="correction-section-body' + (hasCriteres ? '' : ' hidden') + '">';
            html += '<div class="criteres-correction-list">';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="critere-check' + (checked ? ' checked' : '') + '" onclick="AdminCorrections.toggleCritere(\'' + c.id + '\', this)">';
                html += '<input type="checkbox" id="critere_' + c.id + '"' + (checked ? ' checked' : '') + '>';
                html += '<label for="critere_' + c.id + '">' + escapeHtml(c.libelle) + '</label>';
                html += '</div>';
            });
            html += '</div></div></div>';
        }

        // Remarque (dropdown)
        var hasRemarque = wd.remarque.length > 0;
        html += '<div class="correction-section">';
        html += '<div class="correction-section-header' + (hasRemarque ? ' expanded' : '') + '" onclick="AdminCorrections.toggleSection(this)">';
        html += '<h4>💬 Remarque pour l\'élève (optionnel)</h4>';
        html += '<span class="toggle-icon">▼</span>';
        html += '</div>';
        html += '<div class="correction-section-body' + (hasRemarque ? '' : ' hidden') + '">';
        html += '<textarea class="remarque-textarea" id="remarqueTextarea" placeholder="Bon travail sur la chronologie, mais pense à croiser les documents sources...">' + escapeHtml(wd.remarque) + '</textarea>';
        html += '</div></div>';

        // Décision
        html += '<div class="decision-section">';
        html += '<h4>Décision</h4>';
        html += '<div class="decision-buttons">';
        html += '<button class="btn-decision btn-non-valide' + (wd.decision === 'non_valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'non_valide\')">❌ Non validé</button>';
        html += '<button class="btn-decision btn-valide' + (wd.decision === 'valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'valide\')">✅ Validé</button>';
        html += '</div></div>';

        return html;
    },

    // ========== INITIALISATION ÉTAPE 2 ==========

    _initStep2() {
        // Détecter le mode corrigé
        var wd = this.wizardData;
        var hasCorrectionBlocks = wd.correctionType === 'blocks' && wd.correctionValue;
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        if (corrMode === 'editor') {
            this._initCorrectionBlockEditor();
        }
    },

    _initCorrectionBlockEditor() {
        this._blockEditorContainerId = 'corrBlockEditorContainer';

        var blocks = null;
        var wd = this.wizardData;
        if (wd.correctionType === 'blocks' && wd.correctionValue) {
            try {
                var parsed = JSON.parse(wd.correctionValue);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (_err) {
                // HTML brut → convertir en un bloc texte
                blocks = [{ type: 'text', content: wd.correctionValue }];
            }
        }

        this.initBlockEditor(blocks);
    },

    _switchCorrectionMode(mode) {
        var toggle = document.getElementById('correctionToggle');
        if (!toggle) return;

        toggle.querySelectorAll('.source-toggle-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        var urlPanel = document.getElementById('correctionUrlPanel');
        var editorPanel = document.getElementById('correctionEditorPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (editorPanel) editorPanel.style.display = mode === 'editor' ? '' : 'none';

        // Si on bascule vers l'éditeur et qu'il n'est pas encore initialisé
        if (mode === 'editor') {
            var container = document.getElementById('corrBlockEditorContainer');
            if (container && !container.hasChildNodes()) {
                this._initCorrectionBlockEditor();
            }
        }
    },

    _switchEditorTab(tab) {
        var constructionPanel = document.getElementById('corrConstructionPanel');
        var previewPanel = document.getElementById('corrPreviewPanel');
        var constructionTab = document.getElementById('corrTabConstruction');
        var previewTab = document.getElementById('corrTabPreview');

        if (tab === 'construction') {
            if (constructionPanel) constructionPanel.style.display = '';
            if (previewPanel) previewPanel.style.display = 'none';
            if (constructionTab) constructionTab.classList.add('active');
            if (previewTab) previewTab.classList.remove('active');
        } else {
            // Sauver l'état et générer l'aperçu
            this._saveEditorsState();
            var blocksJson = this.getBlocksJSON();
            var previewContainer = document.getElementById('corrPreviewContainer');
            if (previewContainer) {
                if (blocksJson) {
                    previewContainer.innerHTML = this._renderBlocksPreview(JSON.parse(blocksJson));
                } else {
                    previewContainer.innerHTML = '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\'aperçu</div>';
                }
            }
            if (constructionPanel) constructionPanel.style.display = 'none';
            if (previewPanel) previewPanel.style.display = '';
            if (constructionTab) constructionTab.classList.remove('active');
            if (previewTab) previewTab.classList.add('active');
        }
    },

    /** Rendu de l'aperçu des blocs (vue élève) */
    _renderBlocksPreview(blocks) {
        if (!blocks || blocks.length === 0) {
            return '<div class="cw-preview-empty">Aucun contenu</div>';
        }
        var self = this;
        var html = '';
        blocks.forEach(function(block) {
            html += self._renderBlockPreview(block);
        });
        return html;
    },

    _renderBlockPreview(block) {
        if (block.type === 'text') {
            var h = '<div class="preview-block preview-text">' + (block.content || '') + '</div>';
            if (block.legende) h += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            return h;
        }
        if (block.type === 'document') {
            var embedUrl = block.url || '';
            var h2 = '';
            if (block.titre) h2 += '<div class="preview-doc-titre">' + escapeHtml(block.titre) + '</div>';
            if (embedUrl) h2 += '<iframe src="' + escapeHtml(embedUrl) + '" class="preview-doc-iframe"></iframe>';
            if (block.legende) h2 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            return '<div class="preview-block preview-document">' + h2 + '</div>';
        }
        if (block.type === 'image') {
            var imgSrc = this._convertToDirectImageUrl(block.url || '');
            var h3 = '<div class="preview-block preview-image">';
            h3 += '<img src="' + escapeHtml(imgSrc) + '" alt="Image">';
            if (block.legende) h3 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            h3 += '</div>';
            return h3;
        }
        if (block.type === 'video') {
            var videoUrl = block.url || '';
            var ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            var h4 = '<div class="preview-block preview-video">';
            if (ytMatch) {
                h4 += '<iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '" width="100%" height="315" frameborder="0" allowfullscreen></iframe>';
            } else {
                h4 += '<a href="' + escapeHtml(videoUrl) + '" target="_blank">' + escapeHtml(videoUrl) + '</a>';
            }
            if (block.legende) h4 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            h4 += '</div>';
            return h4;
        }
        if (block.type === 'group' && block.children) {
            var ratio = block.ratio || '50-50';
            var parts = ratio.split('-');
            var self = this;
            var h5 = '<div class="preview-block preview-group" style="display:flex;gap:16px">';
            block.children.forEach(function(child, idx) {
                var flex = parseInt(parts[idx] || 50);
                h5 += '<div style="flex:' + flex + '">' + self._renderBlockPreview(child) + '</div>';
            });
            h5 += '</div>';
            return h5;
        }
        return '';
    },

    _formatLegende(text) {
        if (!text) return '';
        return text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    },

    // ========== SAUVEGARDE ÉTAT ÉTAPE 2 ==========

    _saveStep2State() {
        var toggle = document.getElementById('correctionToggle');
        if (!toggle) return;
        var activeBtn = toggle.querySelector('.source-toggle-btn.active');
        var mode = activeBtn ? activeBtn.dataset.mode : 'url';

        if (mode === 'editor') {
            this._saveEditorsState();
            var blocksJson = this.getBlocksJSON();
            this.wizardData.correctionType = blocksJson ? 'blocks' : null;
            this.wizardData.correctionValue = blocksJson || '';
        } else {
            var urlInput = document.getElementById('correctionUrlInput');
            var val = urlInput ? urlInput.value.trim() : '';
            this.wizardData.correctionType = val ? 'url' : null;
            this.wizardData.correctionValue = val;
        }

        // Remarque
        var remarqueEl = document.getElementById('remarqueTextarea');
        if (remarqueEl) this.wizardData.remarque = remarqueEl.value.trim();
    },

    // ========== ACTIONS ÉTAPE 2 ==========

    toggleCritere(critereId, el) {
        var idx = this.wizardData.criteresValides.indexOf(String(critereId));
        if (idx === -1) {
            this.wizardData.criteresValides.push(String(critereId));
            el.classList.add('checked');
            el.querySelector('input').checked = true;
        } else {
            this.wizardData.criteresValides.splice(idx, 1);
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
        }
        var headerH4 = el.closest('.correction-section').querySelector('.correction-section-header h4');
        if (headerH4) {
            var total = el.closest('.criteres-correction-list').children.length;
            headerH4.textContent = '✅ Critères de réussite (' + this.wizardData.criteresValides.length + '/' + total + ')';
        }
    },

    toggleSection(header) {
        header.classList.toggle('expanded');
        var body = header.nextElementSibling;
        body.classList.toggle('hidden');
    },

    setDecision(decision) {
        this.wizardData.decision = decision;
        document.querySelectorAll('.btn-decision').forEach(function(btn) {
            btn.classList.remove('selected');
        });
        var selector = decision === 'valide' ? '.btn-valide' : '.btn-non-valide';
        var btn = document.querySelector(selector);
        if (btn) btn.classList.add('selected');
    },

    renderFooter2() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(1)">← Précédent</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.validateStep2()">Suivant →</button>' +
            '</div>';
    },

    validateStep2() {
        this._saveStep2State();
        if (!this.wizardData.decision) {
            this.showNotification('Veuillez choisir une décision (validé ou non validé).', 'error');
            return;
        }
        this.goToStep(3);
    },

    // ========== ÉTAPE 3 — BILAN ==========

    renderStep3() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];
        var wd = this.wizardData;

        var html = '';

        html += '<div class="bilan-section">';
        html += '<h4>Élève</h4>';
        html += '<div class="bilan-value">' + escapeHtml(this.getEleveName(eleve)) + '</div>';
        html += '</div>';

        html += '<div class="bilan-section">';
        html += '<h4>Entraînement</h4>';
        html += '<div class="bilan-value">' + escapeHtml(entrainement ? entrainement.titre : 'Inconnu') + '</div>';
        html += '</div>';

        // Décision
        html += '<div class="bilan-section">';
        html += '<h4>Décision</h4>';
        var isValide = wd.decision === 'valide';
        html += '<div class="bilan-decision ' + wd.decision + '">' +
            (isValide ? '✅ Validé' : '❌ Non validé') + '</div>';
        html += '</div>';

        // Critères
        if (criteres.length > 0) {
            html += '<div class="bilan-section">';
            html += '<h4>Critères de réussite (' + wd.criteresValides.length + '/' + criteres.length + ')</h4>';
            html += '<div class="bilan-criteres-list">';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="bilan-critere ' + (checked ? 'checked' : 'unchecked') + '">';
                html += (checked ? '✅' : '❌') + ' ' + escapeHtml(c.libelle);
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Remarque
        if (wd.remarque) {
            html += '<div class="bilan-section">';
            html += '<h4>Remarque</h4>';
            html += '<div class="bilan-remarque">' + escapeHtml(wd.remarque) + '</div>';
            html += '</div>';
        }

        // Corrigé
        if (wd.correctionValue) {
            html += '<div class="bilan-section">';
            html += '<h4>Corrigé personnalisé</h4>';
            html += '<div class="bilan-value">' +
                (wd.correctionType === 'url' ? '🔗 Lien Google Doc' : '📝 Contenu riche (blocs)') +
                '</div>';
            html += '</div>';
        }

        return html;
    },

    renderFooter3() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(2)">← Modifier</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn-confirm" id="confirmBtn" onclick="AdminCorrections.confirmCorrection()">✅ Confirmer la correction</button>' +
            '</div>';
    },

    // ========== SAVE ==========

    async confirmCorrection() {
        if (this._saving) return;
        this._saving = true;

        var btn = document.getElementById('confirmBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Enregistrement...';
        }

        var sub = this.currentSubmission;
        var wd = this.wizardData;

        var params = {
            eleve_id: sub.eleve_id,
            entrainement_id: sub.entrainement_id,
            statut: wd.decision,
            criteres_valides: JSON.stringify(wd.criteresValides),
            remarque_prof: wd.remarque || '',
            correction_prof: wd.correctionValue || ''
        };

        try {
            var result = await this.callAPI('validateEleveEntrainementCompetence', params);

            if (result.success) {
                sub.statut = wd.decision;
                sub.remarque_prof = wd.remarque;
                sub.correction_prof = wd.correctionValue;
                sub.criteres_valides = JSON.stringify(wd.criteresValides);
                sub.date_correction = new Date().toISOString();

                try { localStorage.removeItem('brikks_sheets_EleveEntrainementsCompetences'); } catch (_e) { /* ignore */ }

                this.closeModal();
                this.updateCounts();
                this.renderGrid();
                this.showNotification('Correction enregistrée !', 'success');
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Échec de la sauvegarde'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde correction:', error);
            this.showNotification('Erreur réseau. Réessayez.', 'error');
        } finally {
            this._saving = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✅ Confirmer la correction';
            }
        }
    },

    // ========== UI HELPERS ==========

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('corrections-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML =
            '<div style="text-align: center; color: #ef4444;">' +
                '<p>' + escapeHtml(message) + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Réessayer</button>' +
            '</div>';
    },

    showNotification(message, type) {
        var existing = document.querySelector('.correction-notification');
        if (existing) existing.remove();

        var notif = document.createElement('div');
        notif.className = 'correction-notification ' + (type || 'success');
        notif.textContent = message;
        document.body.appendChild(notif);

        setTimeout(function() {
            if (notif.parentNode) notif.remove();
        }, 3000);
    }
};

// Monter le block editor mixin pour le corrigé (text, document, image, video)
Object.assign(AdminCorrections, createBlockEditorMixin('AdminCorrections'));
