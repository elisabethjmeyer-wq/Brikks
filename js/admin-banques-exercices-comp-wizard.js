/**
 * Wizard de création/modification d'entraînement de compétences.
 * Extension de AdminBanquesExercices via Object.assign.
 *
 * 3 étapes :
 *   1. Paramètres (banque, titre, consigne, durée, ordre, statut)
 *   2. Document (block editor + preview live côté élève)
 *   3. Corrigé + résumé de validation
 */
Object.assign(AdminBanquesExercices, {

    // ========== ÉTAT DU WIZARD COMPÉTENCES ==========

    compWizardData: {
        entrainement: null,
        banqueId: null,
        currentStep: 1,
        isEditing: false
    },

    /** @type {number|null} Timer debounce pour la preview */
    _previewDebounce: null,

    // ========== OUVERTURE / FERMETURE ==========

    openCompWizard(tache = null, lockedBanqueId = null) {
        // Initialiser les données du wizard
        this.compWizardData = {
            entrainement: tache ? Object.assign({}, tache) : null,
            banqueId: lockedBanqueId || (tache ? tache.banque_id : null),
            currentStep: 1,
            isEditing: !!tache
        };

        // Supprimer une éventuelle instance précédente
        var existing = document.getElementById('compWizardModal');
        if (existing) existing.remove();

        // Construire le modal
        var modal = document.createElement('div');
        modal.id = 'compWizardModal';
        modal.className = 'modal-overlay';
        modal.innerHTML =
            '<div class="modal modal-wizard">' +
                '<div class="wizard-header">' +
                    '<div class="wizard-title">' +
                        '<h2>' + (tache ? '&#9998; Modifier l\'entra\u00EEnement' : '&#10133; Nouvel entra\u00EEnement') + '</h2>' +
                        '<span class="wizard-subtitle">Comp\u00E9tences \u2022 ' + (tache ? this.escapeHtml(tache.titre) : 'Cr\u00E9ez un exercice') + '</span>' +
                    '</div>' +
                    '<div class="wizard-steps">' +
                        '<button class="wizard-step active" data-step="1" onclick="AdminBanquesExercices.goToCompWizardStep(1)">' +
                            '<span class="step-number">1</span>' +
                            '<span class="step-label">Param\u00E8tres</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="2" onclick="AdminBanquesExercices.goToCompWizardStep(2)">' +
                            '<span class="step-number">2</span>' +
                            '<span class="step-label">Document</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="3" onclick="AdminBanquesExercices.goToCompWizardStep(3)">' +
                            '<span class="step-number">3</span>' +
                            '<span class="step-label">Corrig\u00E9</span>' +
                        '</button>' +
                    '</div>' +
                    '<button class="modal-close" onclick="AdminBanquesExercices.closeCompWizard()">&times;</button>' +
                '</div>' +
                '<div class="wizard-body" id="compWizardContent"></div>' +
                '<div class="wizard-footer">' +
                    '<button class="btn btn-secondary" onclick="AdminBanquesExercices.closeCompWizard()">Annuler</button>' +
                    '<div class="wizard-nav">' +
                        '<button class="btn btn-secondary" id="compWizardPrevBtn" onclick="AdminBanquesExercices.compWizardPrevStep()" style="display:none;">' +
                            '\u2190 Pr\u00E9c\u00E9dent' +
                        '</button>' +
                        '<button class="btn btn-primary" id="compWizardNextBtn" onclick="AdminBanquesExercices.compWizardNextStep()">' +
                            'Suivant \u2192' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        this.renderCompWizardStep(1);
    },

    closeCompWizard() {
        var modal = document.getElementById('compWizardModal');
        if (modal) modal.remove();
        this._blocks = [];
        // Restaurer le container ID et _renderBlocks par défaut
        this._blockEditorContainerId = 'blockEditorContainer';
        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }
        this.compWizardData = {
            entrainement: null,
            banqueId: null,
            currentStep: 1,
            isEditing: false
        };
        if (this._previewDebounce) {
            clearTimeout(this._previewDebounce);
            this._previewDebounce = null;
        }
    },

    // ========== NAVIGATION ==========

    goToCompWizardStep(step) {
        if (step > this.compWizardData.currentStep) {
            if (!this.validateCompWizardStep(this.compWizardData.currentStep)) return;
        }
        // Sauvegarder les données de l'étape actuelle avant de quitter
        this._saveCompWizardStepState(this.compWizardData.currentStep);
        this.compWizardData.currentStep = step;
        this.renderCompWizardStep(step);
    },

    compWizardPrevStep() {
        if (this.compWizardData.currentStep > 1) {
            this._saveCompWizardStepState(this.compWizardData.currentStep);
            this.compWizardData.currentStep--;
            this.renderCompWizardStep(this.compWizardData.currentStep);
        }
    },

    async compWizardNextStep() {
        if (this._cwNavigating) return;
        this._cwNavigating = true;

        var nextBtn = document.getElementById('compWizardNextBtn');

        try {
            if (!this.validateCompWizardStep(this.compWizardData.currentStep)) return;

            this._saveCompWizardStepState(this.compWizardData.currentStep);

            if (this.compWizardData.currentStep < 3) {
                this.compWizardData.currentStep++;
                this.renderCompWizardStep(this.compWizardData.currentStep);
            } else {
                // Étape finale — sauvegarder
                if (nextBtn) {
                    nextBtn.disabled = true;
                    nextBtn.textContent = 'Enregistrement...';
                }
                await this._saveCompWizardData();
            }
        } finally {
            this._cwNavigating = false;
        }
    },

    // ========== VALIDATION ==========

    validateCompWizardStep(step) {
        switch (step) {
        case 1: {
            var titre = document.getElementById('cwTitre');
            if (titre && !titre.value.trim()) {
                this.showNotification('Le titre est requis', 'warning');
                titre.focus();
                return false;
            }
            var banqueId = document.getElementById('cwBanqueId');
            if (banqueId && !banqueId.value) {
                this.showNotification('Veuillez s\u00E9lectionner une banque', 'warning');
                return false;
            }
            var duree = document.getElementById('cwDuree');
            if (duree) {
                var val = parseInt(duree.value) || 0;
                if (val < 1 || val > 999) {
                    this.showNotification('La dur\u00E9e doit \u00EAtre entre 1 et 999 minutes', 'warning');
                    duree.focus();
                    return false;
                }
            }
            return true;
        }
        case 2:
            // Pas de validation obligatoire — le document est optionnel
            return true;
        case 3:
            // Pas de validation obligatoire — le corrigé est optionnel
            return true;
        default:
            return true;
        }
    },

    // ========== SAUVEGARDE D'ÉTAT PAR ÉTAPE ==========

    _saveCompWizardStepState(step) {
        var e = this.compWizardData.entrainement || {};

        switch (step) {
        case 1: {
            var titre = document.getElementById('cwTitre');
            var banqueId = document.getElementById('cwBanqueId');
            var description = document.getElementById('cwDescription');
            var duree = document.getElementById('cwDuree');
            var ordre = document.getElementById('cwOrdre');
            var statut = document.getElementById('cwStatut');

            e.titre = titre ? titre.value.trim() : (e.titre || '');
            e.banque_id = banqueId ? banqueId.value : (e.banque_id || '');
            e.description = description ? description.value.trim() : (e.description || '');
            e.duree = duree ? (parseInt(duree.value) || 30) * 60 : (e.duree || 1800);
            e.ordre = ordre ? parseInt(ordre.value) || 1 : (e.ordre || 1);
            e.statut = statut ? statut.value : (e.statut || 'brouillon');

            // Résoudre la compétence depuis la banque
            var banque = this.banquesCompetences.find(function(b) { return b.id === e.banque_id; });
            e.competence_id = banque ? banque.competence_id : '';

            this.compWizardData.entrainement = e;
            break;
        }
        case 2: {
            // Sauvegarder les blocs du block editor
            this._saveEditorsState();
            var json = this.getBlocksJSON();
            e.document_contenu = json;
            e.document_url = '';
            e.document_legende = '';
            this.compWizardData.entrainement = e;
            break;
        }
        case 3: {
            // Sauvegarder le corrigé
            var corrMode = this._cwGetCorrectionMode();
            if (corrMode === 'url') {
                var urlInput = document.getElementById('cwCorrectionUrl');
                e.correction_commentee = urlInput ? urlInput.value.trim() : '';
                e.correction_contenu = '';
            } else {
                e.correction_commentee = '';
                e.correction_contenu = this._getEditorContent('cwCorrectionEditor');
            }
            this.compWizardData.entrainement = e;
            break;
        }
        }
    },

    _cwGetCorrectionMode() {
        var toggle = document.getElementById('cwCorrectionToggle');
        if (!toggle) return 'url';
        var activeBtn = toggle.querySelector('.source-toggle-btn.active');
        return activeBtn ? activeBtn.dataset.mode : 'url';
    },

    // ========== RENDU DES ÉTAPES ==========

    renderCompWizardStep(step) {
        var content = document.getElementById('compWizardContent');
        var prevBtn = document.getElementById('compWizardPrevBtn');
        var nextBtn = document.getElementById('compWizardNextBtn');
        if (!content) return;

        // Mettre à jour les indicateurs d'étapes
        var modalEl = document.getElementById('compWizardModal');
        if (modalEl) {
            modalEl.querySelectorAll('.wizard-step').forEach(function(el, i) {
                el.classList.toggle('active', i + 1 === step);
                el.classList.toggle('completed', i + 1 < step);
            });
        }

        // Mettre à jour les boutons de navigation
        if (prevBtn) {
            prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
            prevBtn.disabled = false;
        }
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.textContent = step === 3 ? '\u2713 Enregistrer' : 'Suivant \u2192';
        }

        switch (step) {
        case 1:
            content.innerHTML = this._renderCompWizardStep1();
            break;
        case 2:
            content.innerHTML = this._renderCompWizardStep2();
            this._initCompWizardStep2();
            break;
        case 3:
            content.innerHTML = this._renderCompWizardStep3();
            this._initCompWizardStep3();
            break;
        }
    },

    // ========== ÉTAPE 1 : PARAMÈTRES ==========

    _renderCompWizardStep1() {
        var e = this.compWizardData.entrainement || {};
        var banqueId = e.banque_id || this.compWizardData.banqueId || '';
        var dureeMin = e.duree ? Math.round(e.duree / 60) : 30;

        // Construire les options du select banque
        var banques = (this.banquesCompetences || []).slice().sort(function(a, b) {
            return (a.ordre || 0) - (b.ordre || 0);
        });
        var self = this;
        var banqueOptions = '<option value="">-- Choisir une banque --</option>';
        banques.forEach(function(b) {
            var comp = self.competencesReferentiel.find(function(c) { return c.id === b.competence_id; });
            var label = b.titre || (comp ? comp.nom : '(sans titre)');
            var selected = b.id === banqueId ? ' selected' : '';
            banqueOptions += '<option value="' + b.id + '"' + selected + '>' + self.escapeHtml(label) + '</option>';
        });

        var isLocked = !!(this.compWizardData.banqueId || e.banque_id);

        // Calculer l'ordre par défaut
        var ordre = e.ordre || 1;
        if (!e.ordre && banqueId) {
            var existing = (this.tachesComplexes || []).filter(function(t) { return t.banque_id === banqueId; });
            ordre = existing.length + 1;
        }

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\u2699\uFE0F</span>' +
                '<div>' +
                    '<h3>Param\u00E8tres g\u00E9n\u00E9raux</h3>' +
                    '<p>Informations de base de l\u2019entra\u00EEnement</p>' +
                '</div>' +
            '</div>' +
            '<div class="wizard-form">' +
                '<div class="form-group">' +
                    '<label>Banque <span class="req">*</span></label>' +
                    '<select class="form-select" id="cwBanqueId"' + (isLocked ? ' disabled' : '') + '>' +
                        banqueOptions +
                    '</select>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label>Titre de l\u2019exercice <span class="req">*</span></label>' +
                    '<input type="text" class="form-input" id="cwTitre" value="' + this.escapeHtml(e.titre || '') + '" placeholder="Ex: Journal de Catherine Pozzi">' +
                    '<div class="form-help">Titre court identifiant le document utilis\u00E9</div>' +
                '</div>' +
                '<div class="form-group">' +
                    '<label>Consigne <span class="optional">(optionnel)</span></label>' +
                    '<textarea class="form-textarea" id="cwDescription" rows="2" placeholder="Consigne pour l\u2019\u00E9l\u00E8ve...">' + this.escapeHtml(e.description || '') + '</textarea>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Dur\u00E9e indicative (min)</label>' +
                        '<input type="number" class="form-input" id="cwDuree" value="' + dureeMin + '" min="1" max="999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Ordre d\u2019affichage</label>' +
                        '<input type="number" class="form-input" id="cwOrdre" value="' + ordre + '" min="1">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Statut</label>' +
                        '<select class="form-select" id="cwStatut">' +
                            '<option value="brouillon"' + (e.statut !== 'publie' ? ' selected' : '') + '>Brouillon</option>' +
                            '<option value="publie"' + (e.statut === 'publie' ? ' selected' : '') + '>Publi\u00E9</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ========== ÉTAPE 2 : DOCUMENT + PREVIEW ==========

    _renderCompWizardStep2() {
        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83D\uDCC4</span>' +
                '<div>' +
                    '<h3>Document de l\u2019exercice</h3>' +
                    '<p>Construisez le contenu que l\u2019\u00E9l\u00E8ve verra (texte, documents, images, vid\u00E9os)</p>' +
                '</div>' +
            '</div>' +
            '<div class="cw-doc-layout">' +
                '<div class="cw-doc-editor">' +
                    '<h4 class="cw-section-title">\u00C9diteur</h4>' +
                    '<div id="cwBlockEditorContainer" class="block-editor"></div>' +
                    '<div class="block-add-bar" id="cwBlockAddBar">' +
                        '<span class="block-add-label">Ajouter</span>' +
                        '<button type="button" class="block-add-btn" onclick="AdminBanquesExercices.addBlock(\'text\')" title="Texte">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
                            ' Texte' +
                        '</button>' +
                        '<button type="button" class="block-add-btn" onclick="AdminBanquesExercices.addBlock(\'document\')" title="Document Google">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                            ' Document' +
                        '</button>' +
                        '<button type="button" class="block-add-btn" onclick="AdminBanquesExercices.addBlock(\'image\')" title="Image">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                            ' Image' +
                        '</button>' +
                        '<button type="button" class="block-add-btn" onclick="AdminBanquesExercices.addBlock(\'video\')" title="Video">' +
                            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
                            ' Vid\u00E9o' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cw-doc-preview">' +
                    '<h4 class="cw-section-title">\uD83D\uDC41 Aper\u00E7u \u00E9l\u00E8ve</h4>' +
                    '<div id="cwPreviewContainer" class="cw-preview-frame">' +
                        '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\u2019aper\u00E7u</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _initCompWizardStep2() {
        // Rediriger le block editor vers le container du wizard
        this._blockEditorContainerId = 'cwBlockEditorContainer';

        // Charger les blocs existants
        var e = this.compWizardData.entrainement || {};
        var blocks = null;

        if (e.document_contenu) {
            try {
                var parsed = JSON.parse(e.document_contenu);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (err) {
                // HTML brut → un bloc texte
                blocks = [{ type: 'text', content: e.document_contenu }];
            }
        } else if (this.compWizardData.isEditing && e.id) {
            // Mode édition : tenter convertLegacyToBlocks
            blocks = this.convertLegacyToBlocks(e);
            if (blocks.length === 0) blocks = null;
        }

        // Intercepter _renderBlocks pour mettre à jour la preview après chaque re-rendu
        // (ne le faire qu'une fois pour éviter l'empilement si l'utilisateur revient à l'étape 2)
        var self = this;
        if (!this._origRenderBlocks) {
            this._origRenderBlocks = this._renderBlocks.bind(this);
        }
        this._renderBlocks = function() {
            self._origRenderBlocks();
            self._schedulePreviewUpdate();
        };

        // Initialiser le block editor
        this.initBlockEditor(blocks);

        // Rafraîchir la preview
        this._updateCompPreview();

        // Observer les changements du block editor pour mettre à jour la preview
        this._setupCompPreviewObserver();
    },

    _schedulePreviewUpdate() {
        var self = this;
        if (this._previewDebounce) clearTimeout(this._previewDebounce);
        this._previewDebounce = setTimeout(function() {
            self._updateCompPreview();
        }, 300);
    },

    _setupCompPreviewObserver() {
        var container = document.getElementById('cwBlockEditorContainer');
        if (!container) return;

        var self = this;

        // Observer les changements de contenu (input dans les champs, frappe dans les éditeurs)
        container.addEventListener('input', function() {
            self._schedulePreviewUpdate();
        });
        container.addEventListener('change', function() {
            self._schedulePreviewUpdate();
        });
    },

    _updateCompPreview() {
        var previewContainer = document.getElementById('cwPreviewContainer');
        if (!previewContainer) return;

        // Sauvegarder l'état courant des éditeurs
        this._saveEditorsState();

        // Sérialiser les blocs (sans filtrer les vides — on veut tout montrer dans la preview)
        var blocks = this._blocks.map(function(b) {
            return AdminBanquesExercices._serializeBlock(b);
        });

        // Filtrer les blocs totalement vides
        blocks = blocks.filter(function(b) {
            if (b.type === 'text') return b.content && b.content.trim() !== '';
            if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
            if (b.type === 'group') return b.children && b.children.length > 0;
            return false;
        });

        if (blocks.length === 0) {
            previewContainer.innerHTML = '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\u2019aper\u00E7u</div>';
            return;
        }

        // Utiliser le même rendu que le côté élève
        var html = '<div class="comp-blocks-container">';
        var self = this;
        blocks.forEach(function(block) {
            if (block.type === 'group') {
                html += '<div class="comp-blocks-group">';
                (block.children || []).forEach(function(child) {
                    html += '<div class="comp-blocks-group-child">';
                    html += self._renderPreviewBlock(child);
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += self._renderPreviewBlock(block);
            }
        });
        html += '</div>';

        previewContainer.innerHTML = html;
    },

    /** Rendu d'un bloc pour la preview (reproduit le rendu élève). */
    _renderPreviewBlock(block) {
        switch (block.type) {
        case 'text':
            return '<div class="comp-block-text">' + (block.content || '') + '</div>';

        case 'document': {
            var url = block.url || '';
            var embedUrl = this._getPreviewEmbedUrl(url);
            var titre = block.titre ? '<div class="comp-block-titre">' + this.escapeHtml(block.titre) + '</div>' : '';
            var legende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            return titre +
                '<div class="comp-block-document">' +
                (embedUrl
                    ? '<iframe src="' + embedUrl + '" class="comp-document-frame" allowfullscreen></iframe>'
                    : '<p class="comp-no-document">Saisissez l\u2019URL du document</p>') +
                '</div>' +
                legende;
        }

        case 'image': {
            var imgUrl = block.url || '';
            var driveMatch = imgUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch) imgUrl = 'https://lh3.googleusercontent.com/d/' + driveMatch[1];
            var imgLegende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            if (!block.url) {
                return '<div class="comp-block-image"><div class="cw-preview-placeholder">Saisissez l\u2019URL de l\u2019image</div></div>' + imgLegende;
            }
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
            var vidLegende = block.legende ? '<div class="comp-block-legende">' + this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            if (!block.url) {
                return '<div class="comp-block-video"><div class="cw-preview-placeholder">Saisissez l\u2019URL de la vid\u00E9o</div></div>' + vidLegende;
            }
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

    /** Conversion URL → embed URL pour la preview (version simplifiée de getEmbedUrl côté élève). */
    _getPreviewEmbedUrl(url) {
        if (!url) return '';

        // Google Drive
        if (url.includes('drive.google.com')) {
            var fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (fileMatch) return 'https://drive.google.com/file/d/' + fileMatch[1] + '/preview';
            var idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (idMatch) return 'https://drive.google.com/file/d/' + idMatch[1] + '/preview';
        }

        // Google Docs/Slides/Sheets
        if (url.includes('docs.google.com')) {
            if (url.includes('/edit') || url.includes('/view')) {
                return url.replace(/\/(edit|view).*$/, '/preview');
            }
            if (url.includes('/pub')) return url;
            return url + (url.includes('?') ? '&' : '/') + 'preview';
        }

        // Publuu
        if (url.includes('publuu.com/flip-book')) {
            var match = url.match(/publuu\.com\/flip-book\/(\d+)\/(\d+)/);
            if (match) return 'https://publuu.com/flip-book/' + match[1] + '/' + match[2] + '/page/1?embed';
        }

        return url;
    },

    // ========== ÉTAPE 3 : CORRIGÉ + RÉSUMÉ ==========

    _renderCompWizardStep3() {
        var e = this.compWizardData.entrainement || {};

        // Détecter le mode corrigé actuel
        var hasCorrectionHtml = !!e.correction_contenu;
        var corrUrl = this._extractCorrectionUrl(e.correction_commentee);
        var corrMode = hasCorrectionHtml ? 'html' : 'url';

        // Résumé de l'entraînement
        var banque = this.banquesCompetences.find(function(b) { return b.id === e.banque_id; });
        var comp = banque ? this.competencesReferentiel.find(function(c) { return c.id === banque.competence_id; }) : null;
        var banqueLabel = banque ? (banque.titre || (comp ? comp.nom : '')) : '(non s\u00E9lectionn\u00E9e)';
        var dureeMin = e.duree ? Math.round(e.duree / 60) : 30;

        // Compter les blocs de document
        var nbBlocks = 0;
        if (e.document_contenu) {
            try {
                var parsed = JSON.parse(e.document_contenu);
                if (Array.isArray(parsed)) nbBlocks = parsed.length;
            } catch (err) {
                nbBlocks = 1; // HTML brut
            }
        }

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\u2705</span>' +
                '<div>' +
                    '<h3>Corrig\u00E9 et validation</h3>' +
                    '<p>Ajoutez le corrig\u00E9 (optionnel) et v\u00E9rifiez le r\u00E9sum\u00E9 avant d\u2019enregistrer</p>' +
                '</div>' +
            '</div>' +

            // Section corrigé
            '<div class="cw-correction-section">' +
                '<h4 class="cw-section-title">Corrig\u00E9 comment\u00E9 <span class="optional">(mode entra\u00EEnement)</span></h4>' +
                '<div class="source-toggle" id="cwCorrectionToggle">' +
                    '<button type="button" class="source-toggle-btn' + (corrMode === 'url' ? ' active' : '') + '" data-mode="url" onclick="AdminBanquesExercices._cwToggleCorrectionMode(\'url\')">Lien</button>' +
                    '<button type="button" class="source-toggle-btn' + (corrMode === 'html' ? ' active' : '') + '" data-mode="html" onclick="AdminBanquesExercices._cwToggleCorrectionMode(\'html\')">Texte</button>' +
                '</div>' +
                '<div class="source-panel" id="cwCorrectionUrlPanel"' + (corrMode !== 'url' ? ' style="display:none;"' : '') + '>' +
                    '<div class="form-group">' +
                        '<label>Lien Google Doc du corrig\u00E9</label>' +
                        '<input type="text" class="form-input" id="cwCorrectionUrl" value="' + this.escapeHtml(corrUrl) + '" placeholder="https://docs.google.com/document/d/...">' +
                        '<div class="form-help">Collez le lien de partage du Google Doc (doit \u00EAtre accessible en lecture)</div>' +
                    '</div>' +
                '</div>' +
                '<div class="source-panel" id="cwCorrectionHtmlPanel"' + (corrMode !== 'html' ? ' style="display:none;"' : '') + '>' +
                    '<div class="form-group">' +
                        '<label>Contenu du corrig\u00E9</label>' +
                        '<div id="cwCorrectionEditorContainer"></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Résumé
            '<div class="cw-summary">' +
                '<h4 class="cw-section-title">R\u00E9sum\u00E9 de l\u2019entra\u00EEnement</h4>' +
                '<div class="summary-card">' +
                    '<div class="summary-row"><span class="label">Banque</span><span class="value">' + this.escapeHtml(banqueLabel) + '</span></div>' +
                    '<div class="summary-row"><span class="label">Titre</span><span class="value">' + this.escapeHtml(e.titre || '(vide)') + '</span></div>' +
                    (e.description ? '<div class="summary-row"><span class="label">Consigne</span><span class="value">' + this.escapeHtml(e.description) + '</span></div>' : '') +
                    '<div class="summary-row"><span class="label">Dur\u00E9e</span><span class="value">' + dureeMin + ' min</span></div>' +
                    '<div class="summary-row"><span class="label">Blocs de contenu</span><span class="value">' + nbBlocks + '</span></div>' +
                    '<div class="summary-row"><span class="label">Statut</span><span class="value">' + (e.statut === 'publie' ? 'Publi\u00E9' : 'Brouillon') + '</span></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _initCompWizardStep3() {
        var e = this.compWizardData.entrainement || {};

        // Initialiser l'éditeur riche pour le corrigé
        this.createRichTextEditor('cwCorrectionEditorContainer', 'cwCorrectionEditor', {
            placeholder: 'Saisissez le contenu du corrig\u00E9...',
            media: true
        });

        // Restaurer le contenu HTML si on est en mode HTML
        if (e.correction_contenu) {
            var editor = document.getElementById('cwCorrectionEditor');
            if (editor) editor.innerHTML = e.correction_contenu;
        }
    },

    _cwToggleCorrectionMode(mode) {
        var toggle = document.getElementById('cwCorrectionToggle');
        if (!toggle) return;

        toggle.querySelectorAll('.source-toggle-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        var urlPanel = document.getElementById('cwCorrectionUrlPanel');
        var htmlPanel = document.getElementById('cwCorrectionHtmlPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (htmlPanel) htmlPanel.style.display = mode === 'html' ? '' : 'none';
    },

    // ========== SAUVEGARDE FINALE ==========

    async _saveCompWizardData() {
        var e = this.compWizardData.entrainement || {};

        var data = {
            titre: e.titre || '',
            banque_id: e.banque_id || '',
            competence_id: e.competence_id || '',
            description: e.description || '',
            document_url: '',
            document_contenu: e.document_contenu || '',
            document_legende: '',
            correction_commentee: e.correction_commentee || '',
            correction_contenu: e.correction_contenu || '',
            duree: e.duree || 1800,
            ordre: e.ordre || 1,
            statut: e.statut || 'brouillon'
        };

        try {
            var result;
            if (this.compWizardData.isEditing && e.id) {
                data.id = e.id;
                result = await this.callAPI('updateTacheComplexe', data);
            } else {
                result = await this.callAPI('createTacheComplexe', data);
            }

            if (result.success) {
                await this.loadDataFromAPI();
                this.updateCounts();
                this.renderBanques();
                this.closeCompWizard();
                this.showNotification(
                    this.compWizardData.isEditing ? 'Entra\u00EEnement modifi\u00E9' : 'Entra\u00EEnement cr\u00E9\u00E9',
                    'success'
                );
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
                var nextBtn = document.getElementById('compWizardNextBtn');
                if (nextBtn) {
                    nextBtn.disabled = false;
                    nextBtn.textContent = '\u2713 Enregistrer';
                }
            }
        } catch (err) {
            console.error('Erreur sauvegarde wizard comp:', err);
            this.showNotification('Erreur de connexion. V\u00E9rifiez votre r\u00E9seau.', 'error');
            var nextBtn2 = document.getElementById('compWizardNextBtn');
            if (nextBtn2) {
                nextBtn2.disabled = false;
                nextBtn2.textContent = '\u2713 Enregistrer';
            }
        }
    }
});
