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
    _previewVisible: false,
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
                // Plus anciennes d'abord (urgentes en premier)
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

        // Filtre recherche par nom d'élève
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

        // Couleur de la bande latérale
        var stripeClass = isDone ? ('stripe-' + sub.statut) : 'stripe-pending';

        // Badges
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
                var envoyeLabel = sub.mode_rendu === 'papier' ? '✅ Déposé' : '✅ Envoyé';
                badgesHtml += '<span class="card-badge badge-sent">' + envoyeLabel + '</span>';
            } else if (sub.mode_rendu === 'papier') {
                badgesHtml += '<span class="card-badge badge-waiting">📄 À déposer</span>';
            } else if (sub.mode_rendu === 'numerique') {
                badgesHtml += '<span class="card-badge badge-waiting">💻 À envoyer</span>';
            } else {
                badgesHtml += '<span class="card-badge badge-waiting">⏳ Terminé</span>';
            }
        }

        badgesHtml += '</div>';

        // Date relative
        var dateRef = isDone ? sub.date_correction : sub.date_soumission;
        var relativeDate = this.formatRelativeDate(dateRef);
        var isUrgent = !isDone && this._isOlderThan(sub.date_soumission, 2);

        // Décision (onglet terminées)
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
        this._previewVisible = false;

        var existingCriteres = [];
        if (sub.criteres_valides) {
            try {
                existingCriteres = JSON.parse(sub.criteres_valides);
            } catch (_e) { /* ignore */ }
        }

        this.wizardData = {
            criteresValides: Array.isArray(existingCriteres) ? existingCriteres.map(String) : [],
            decision: (sub.statut === 'valide' || sub.statut === 'non_valide') ? sub.statut : null,
            remarque: sub.remarque_prof || '',
            correctionType: sub.correction_prof ? (String(sub.correction_prof).startsWith('http') ? 'url' : 'html') : null,
            correctionValue: sub.correction_prof || ''
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
        // Sauvegarder le contenu de l'éditeur avant de quitter l'étape 2
        if (this.currentStep === 2) {
            this._saveEditorContent();
        }
        this.currentStep = step;
        this._previewVisible = false;
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
            this._initEditor();
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

        return html;
    },

    _infoItem(icon, label, value) {
        return '<div class="info-item">' +
            '<span class="info-icon">' + icon + '</span>' +
            '<div><div class="info-label">' + label + '</div>' +
            '<div class="info-value">' + escapeHtml(value) + '</div></div>' +
        '</div>';
    },

    renderFooter1() {
        return '<div class="footer-left"></div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.goToStep(2)">Suivant →</button>' +
            '</div>';
    },

    // ========== ÉTAPE 2 — CORRECTION (éditeur riche + critères + vue élève) ==========

    renderStep2() {
        var sub = this.currentSubmission;
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];
        var wd = this.wizardData;

        var html = '';

        // Toggle Lien / Texte
        html += '<div class="source-toggle" id="correctionToggle">';
        html += '<button type="button" class="source-toggle-btn' + (wd.correctionType !== 'html' ? ' active' : '') + '" data-mode="url" onclick="AdminCorrections.switchCorrectionMode(\'url\')">Lien</button>';
        html += '<button type="button" class="source-toggle-btn' + (wd.correctionType === 'html' ? ' active' : '') + '" data-mode="html" onclick="AdminCorrections.switchCorrectionMode(\'html\')">Texte</button>';
        html += '</div>';

        // Panel URL
        html += '<div class="source-panel" id="correctionUrlPanel"' + (wd.correctionType === 'html' ? ' style="display:none"' : '') + '>';
        html += '<div class="form-group">';
        html += '<label>Lien Google Doc du corrigé</label>';
        html += '<input type="text" class="corrige-url-input" id="correctionUrlInput" placeholder="https://docs.google.com/document/d/..." value="' + escapeHtml(wd.correctionType === 'url' ? wd.correctionValue : '') + '">';
        html += '<div class="form-help">Collez le lien de partage du Google Doc (doit être accessible en lecture)</div>';
        html += '</div>';
        html += '</div>';

        // Panel Texte (éditeur riche)
        html += '<div class="source-panel" id="correctionHtmlPanel"' + (wd.correctionType !== 'html' ? ' style="display:none"' : '') + '>';
        html += '<div id="correctionEditorContainer"></div>';
        html += '</div>';

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

    // ========== ÉDITEUR RICHE ==========

    _initEditor() {
        var container = document.getElementById('correctionEditorContainer');
        if (!container) return;

        var toolbarHtml = '<div class="rt-toolbar">';

        // Gras / Italique / Souligné
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="bold" title="Gras"><b>G</b></button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="italic" title="Italique"><i>I</i></button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="underline" title="Souligné"><u>S</u></button>';
        toolbarHtml += '</div>';

        // Listes
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertUnorderedList" title="Liste à puces">•</button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertOrderedList" title="Liste numérotée">1.</button>';
        toolbarHtml += '</div>';

        // Couleur
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<input type="color" class="rt-color" id="correctionColor" value="#000000" title="Couleur du texte">';
        toolbarHtml += '</div>';

        // Média
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="image" title="Insérer une image">Image</button>';
        toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="video" title="Insérer une vidéo">Vidéo</button>';
        toolbarHtml += '</div>';

        toolbarHtml += '</div>';

        var editorHtml = '<div class="rt-editor" id="correctionEditor" contenteditable="true" data-placeholder="Saisissez le corrigé commenté..."></div>';

        container.innerHTML = toolbarHtml + editorHtml;

        var editor = document.getElementById('correctionEditor');
        var toolbar = container.querySelector('.rt-toolbar');

        // Charger le contenu existant
        if (this.wizardData.correctionType === 'html' && this.wizardData.correctionValue) {
            editor.innerHTML = this.wizardData.correctionValue;
        }

        // Commandes de formatage
        toolbar.querySelectorAll('.rt-btn[data-cmd]').forEach(function(btn) {
            btn.onmousedown = function(e) { e.preventDefault(); };
            btn.onclick = function() {
                editor.focus();
                document.execCommand(btn.dataset.cmd, false, null);
            };
        });

        // Insertion média
        var self = this;
        toolbar.querySelectorAll('.rt-btn[data-media]').forEach(function(btn) {
            btn.onmousedown = function(e) { e.preventDefault(); };
            btn.onclick = function() {
                self._insertMedia(editor, btn.dataset.media);
            };
        });

        // Couleur
        var colorInput = document.getElementById('correctionColor');
        if (colorInput) {
            colorInput.oninput = function() {
                editor.focus();
                document.execCommand('foreColor', false, colorInput.value);
            };
        }
    },

    _insertMedia(editor, type) {
        var hint = type === 'image'
            ? 'Collez le lien de l\'image :\n(Google Drive, lien direct...)'
            : 'Collez le lien de la vidéo :\n(YouTube, Google Drive...)';
        var url = prompt(hint, '');
        if (!url || !url.trim()) return;

        var src = url.trim();
        var html = '';

        if (type === 'image') {
            // Convertir les liens Google Drive en lien direct
            var driveMatch = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
            var imgSrc = driveMatch
                ? 'https://drive.google.com/uc?export=view&id=' + driveMatch[1]
                : src;
            html = '<div class="rt-media-wrapper"><img src="' + imgSrc + '" alt="Image" style="max-width:100%"></div>';
        } else {
            // Convertir YouTube en embed
            var ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            if (ytMatch) {
                html = '<div class="rt-media-wrapper"><iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '" width="100%" height="315" frameborder="0" allowfullscreen></iframe></div>';
            } else {
                html = '<div class="rt-media-wrapper"><a href="' + src + '" target="_blank">' + src + '</a></div>';
            }
        }

        editor.focus();
        document.execCommand('insertHTML', false, html + '<p><br></p>');
    },

    _getEditorContent() {
        var editor = document.getElementById('correctionEditor');
        if (!editor) return '';
        var html = editor.innerHTML.trim();
        if (!html || html === '<br>' || html === '<div><br></div>') return '';
        return html;
    },

    _saveEditorContent() {
        // Sauvegarder le contenu de l'éditeur dans wizardData
        var toggle = document.getElementById('correctionToggle');
        if (!toggle) return;
        var activeBtn = toggle.querySelector('.source-toggle-btn.active');
        var mode = activeBtn ? activeBtn.dataset.mode : 'url';

        if (mode === 'html') {
            this.wizardData.correctionType = 'html';
            this.wizardData.correctionValue = this._getEditorContent();
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

    switchCorrectionMode(mode) {
        var toggle = document.getElementById('correctionToggle');
        toggle.querySelectorAll('.source-toggle-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        var urlPanel = document.getElementById('correctionUrlPanel');
        var htmlPanel = document.getElementById('correctionHtmlPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (htmlPanel) htmlPanel.style.display = mode === 'html' ? '' : 'none';
    },

    // ========== VUE ÉLÈVE ==========

    togglePreview() {
        this._previewVisible = !this._previewVisible;
        var previewZone = document.getElementById('elevePreviewZone');
        var previewBtn = document.getElementById('previewToggleBtn');

        if (this._previewVisible) {
            this._saveEditorContent();
            previewZone.innerHTML = this._buildElevePreview();
            previewZone.style.display = 'block';
            previewBtn.textContent = '✏️ Retour édition';
        } else {
            previewZone.style.display = 'none';
            previewBtn.textContent = '👁 Vue élève';
        }
    },

    _buildElevePreview() {
        var wd = this.wizardData;
        var sub = this.currentSubmission;
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];

        var html = '<div class="eleve-preview">';
        html += '<div class="eleve-preview-header">';
        html += '<span class="preview-label">Aperçu — ce que verra l\'élève</span>';
        html += '</div>';
        html += '<div class="eleve-preview-body">';

        // Décision
        if (wd.decision) {
            var isValide = wd.decision === 'valide';
            html += '<div class="preview-decision ' + wd.decision + '">';
            html += isValide ? '✅ Compétence validée' : '❌ Compétence non validée';
            html += '</div>';
        }

        // Critères
        if (criteres.length > 0) {
            html += '<div class="preview-section">';
            html += '<div class="preview-section-title">Critères de réussite</div>';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="preview-critere ' + (checked ? 'ok' : 'ko') + '">';
                html += (checked ? '✅' : '❌') + ' ' + escapeHtml(c.libelle);
                html += '</div>';
            });
            html += '</div>';
        }

        // Corrigé
        if (wd.correctionValue) {
            html += '<div class="preview-section">';
            html += '<div class="preview-section-title">Corrigé commenté</div>';
            if (wd.correctionType === 'url') {
                html += '<iframe src="' + escapeHtml(wd.correctionValue) + '" style="width:100%;height:300px;border:1px solid #e5e7eb;border-radius:8px" sandbox="allow-same-origin allow-scripts"></iframe>';
            } else {
                html += '<div class="preview-content">' + wd.correctionValue + '</div>';
            }
            html += '</div>';
        }

        // Remarque
        if (wd.remarque) {
            html += '<div class="preview-section">';
            html += '<div class="preview-section-title">Remarque de la prof</div>';
            html += '<div class="preview-remarque">' + escapeHtml(wd.remarque) + '</div>';
            html += '</div>';
        }

        if (!wd.decision && !wd.correctionValue && !wd.remarque && wd.criteresValides.length === 0) {
            html += '<div style="text-align:center;color:#9ca3af;padding:2rem">Rien à afficher pour le moment. Remplissez la correction ci-dessus.</div>';
        }

        html += '</div></div>';
        return html;
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
        // Mettre à jour le compteur dans le header
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
                '<button class="btn btn-secondary" id="previewToggleBtn" onclick="AdminCorrections.togglePreview()">👁 Vue élève</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.validateStep2()">Suivant →</button>' +
            '</div>';
    },

    validateStep2() {
        this._saveEditorContent();
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
                (wd.correctionType === 'url' ? '🔗 Lien Google Doc' : '📝 Texte riche saisi') +
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
