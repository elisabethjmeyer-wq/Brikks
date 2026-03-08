/**
 * Wizard de création/modification d'entraînement de compétences.
 * Extension de AdminBanquesExercices via Object.assign.
 *
 * 4 étapes :
 *   1. Paramètres (banque, titre, durée, statut)
 *   2. Document (block editor + preview live côté élève)
 *   3. Corrigé (block editor + preview / lien Google Doc)
 *   4. Résumé de validation
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

    /** @type {string} ID du container de preview actif (step 2 ou 3) */
    _cwPreviewContainerId: 'cwPreviewContainer',

    // ========== OUVERTURE / FERMETURE ==========

    openCompWizard(tache = null, lockedBanqueId = null) {
        // Détecter si c'est un exercice TC (banque dans banquesTachesComplexes)
        var effectiveBanqueId = lockedBanqueId || (tache ? tache.banque_id : null);
        var isTCMode = !!(effectiveBanqueId && (this.banquesTachesComplexes || []).some(function(b) { return b.id === effectiveBanqueId; }));

        // Initialiser les données du wizard
        this.compWizardData = {
            entrainement: tache ? Object.assign({}, tache) : null,
            banqueId: effectiveBanqueId,
            currentStep: 1,
            isEditing: !!tache,
            isTCMode: isTCMode,
            totalSteps: isTCMode ? 5 : 4
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
                        '<span class="wizard-subtitle">Comp\u00E9tences \u2022 ' + (tache ? escapeHtml(tache.titre) : 'Cr\u00E9ez un exercice') + '</span>' +
                    '</div>' +
                    '<div class="wizard-steps">' +
                        '<button class="wizard-step active" data-step="1" onclick="AdminBanquesExercices.goToCompWizardStep(1)">' +
                            '<span class="step-number">1</span>' +
                            '<span class="step-label">Param\u00E8tres</span>' +
                        '</button>' +
                        (isTCMode ?
                        '<button class="wizard-step" data-step="2" onclick="AdminBanquesExercices.goToCompWizardStep(2)">' +
                            '<span class="step-number">2</span>' +
                            '<span class="step-label">Comp\u00E9tences</span>' +
                        '</button>' : '') +
                        '<button class="wizard-step" data-step="' + (isTCMode ? '3' : '2') + '" onclick="AdminBanquesExercices.goToCompWizardStep(' + (isTCMode ? 3 : 2) + ')">' +
                            '<span class="step-number">' + (isTCMode ? '3' : '2') + '</span>' +
                            '<span class="step-label">Document</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="' + (isTCMode ? '4' : '3') + '" onclick="AdminBanquesExercices.goToCompWizardStep(' + (isTCMode ? 4 : 3) + ')">' +
                            '<span class="step-number">' + (isTCMode ? '4' : '3') + '</span>' +
                            '<span class="step-label">Corrig\u00E9</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="' + (isTCMode ? '5' : '4') + '" onclick="AdminBanquesExercices.goToCompWizardStep(' + (isTCMode ? 5 : 4) + ')">' +
                            '<span class="step-number">' + (isTCMode ? '5' : '4') + '</span>' +
                            '<span class="step-label">R\u00E9sum\u00E9</span>' +
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
        this._cwPreviewContainerId = 'cwPreviewContainer';
        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }
        this.compWizardData = {
            entrainement: null,
            banqueId: null,
            currentStep: 1,
            isTCMode: false,
            totalSteps: 4,
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
        var totalSteps = this.compWizardData.totalSteps || 4;

        try {
            if (!this.validateCompWizardStep(this.compWizardData.currentStep)) return;

            this._saveCompWizardStepState(this.compWizardData.currentStep);

            if (this.compWizardData.currentStep < totalSteps) {
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

    /**
     * Retourne le nom logique d'une étape selon le mode (TC ou normal).
     * TC mode : 1=params, 2=competences, 3=document, 4=corrige, 5=resume
     * Normal : 1=params, 2=document, 3=corrige, 4=resume
     */
    _cwLogicalStep(step) {
        if (this.compWizardData.isTCMode) {
            return ['params', 'competences', 'document', 'corrige', 'resume'][step - 1] || 'unknown';
        }
        return ['params', 'document', 'corrige', 'resume'][step - 1] || 'unknown';
    },

    // ========== VALIDATION ==========

    validateCompWizardStep(step) {
        var logical = this._cwLogicalStep(step);

        switch (logical) {
        case 'params': {
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
        case 'competences': {
            var checked = document.querySelectorAll('#cwCompetencesCheckboxes input[type="checkbox"]:checked');
            if (checked.length === 0) {
                this.showNotification('Veuillez s\u00E9lectionner au moins une comp\u00E9tence', 'warning');
                return false;
            }
            return true;
        }
        default:
            return true;
        }
    },

    // ========== SAUVEGARDE D'ÉTAT PAR ÉTAPE ==========

    _saveCompWizardStepState(step) {
        var e = this.compWizardData.entrainement || {};
        var logical = this._cwLogicalStep(step);

        switch (logical) {
        case 'params': {
            var titre = document.getElementById('cwTitre');
            var banqueId = document.getElementById('cwBanqueId');
            var duree = document.getElementById('cwDuree');
            var statut = document.getElementById('cwStatut');

            e.titre = titre ? titre.value.trim() : (e.titre || '');
            e.banque_id = banqueId ? banqueId.value : (e.banque_id || '');
            e.duree = duree ? (parseInt(duree.value) || 30) : (e.duree || 30);
            e.statut = statut ? statut.value : (e.statut || 'brouillon');

            // Ordre automatique : si nouvel entraînement, placer à la fin
            if (!e.ordre) {
                var bId = e.banque_id;
                var existing = (this.tachesComplexes || []).filter(function(t) { return t.banque_id === bId; });
                e.ordre = existing.length + 1;
            }

            var delaiMail = document.getElementById('cwDelaiMail');
            var delaiPapier = document.getElementById('cwDelaiPapier');
            e.delai_mail_minutes = delaiMail ? (parseInt(delaiMail.value) || 30) : (e.delai_mail_minutes || 30);
            e.delai_papier_jours = delaiPapier ? (parseInt(delaiPapier.value) || 1) : (e.delai_papier_jours || 1);

            // Résoudre la compétence depuis la banque (mode compétences classique)
            if (!this.compWizardData.isTCMode) {
                var banque = this.banquesCompetences.find(function(b) { return b.id === e.banque_id; });
                e.competence_id = banque ? banque.competence_id : '';
            }

            this.compWizardData.entrainement = e;
            break;
        }
        case 'competences': {
            // Sauvegarder les compétences cochées
            var checked = document.querySelectorAll('#cwCompetencesCheckboxes input[type="checkbox"]:checked');
            var ids = [];
            checked.forEach(function(cb) { ids.push(cb.value); });
            e.competence_ids = JSON.stringify(ids);
            e.competence_id = ids[0] || '';
            this.compWizardData.entrainement = e;
            break;
        }
        case 'document': {
            // Sauvegarder la consigne
            var descStep = document.getElementById('cwDescription');
            e.description = descStep ? descStep.value.trim() : (e.description || '');
            // Sauvegarder les blocs du block editor (document)
            this._saveEditorsState();
            var json = this.getBlocksJSON();
            e.document_contenu = json;
            e.document_url = '';
            e.document_legende = '';
            this.compWizardData.entrainement = e;
            break;
        }
        case 'corrige': {
            // Sauvegarder le corrigé
            var corrMode = this._cwGetCorrectionMode();
            if (corrMode === 'url') {
                var urlInput = document.getElementById('cwCorrectionUrl');
                e.correction_commentee = urlInput ? urlInput.value.trim() : '';
                e.correction_contenu = '';
            } else {
                e.correction_commentee = '';
                this._saveEditorsState();
                e.correction_contenu = this.getBlocksJSON();
            }
            this.compWizardData.entrainement = e;
            break;
        }
        case 'resume':
            // Résumé — rien à sauvegarder
            break;
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

        var totalSteps = this.compWizardData.totalSteps || 4;

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
            nextBtn.textContent = step === totalSteps ? '\u2713 Enregistrer' : 'Suivant \u2192';
        }

        var logical = this._cwLogicalStep(step);

        switch (logical) {
        case 'params':
            content.innerHTML = this._renderCompWizardStep1();
            break;
        case 'competences':
            content.innerHTML = this._renderCWStepCompetences();
            this._initCWStepCompetences();
            break;
        case 'document':
            content.innerHTML = this._renderCompWizardStep2();
            this._initCompWizardStep2();
            break;
        case 'corrige':
            content.innerHTML = this._renderCompWizardStep3();
            this._initCompWizardStep3();
            break;
        case 'resume':
            content.innerHTML = this._renderCompWizardStep4();
            break;
        }
    },

    // ========== ÉTAPE 1 : PARAMÈTRES ==========

    _renderCompWizardStep1() {
        var e = this.compWizardData.entrainement || {};
        var banqueId = e.banque_id || this.compWizardData.banqueId || '';
        var dureeMin = e.duree || 30;

        // Construire les options du select banque
        var sourceList = this.compWizardData.isTCMode ? (this.banquesTachesComplexes || []) : (this.banquesCompetences || []);
        var banques = sourceList.slice().sort(function(a, b) {
            return (a.ordre || 0) - (b.ordre || 0);
        });
        var self = this;
        var banqueOptions = '<option value="">-- Choisir une banque --</option>';
        banques.forEach(function(b) {
            var comp = self.competencesReferentiel.find(function(c) { return c.id === b.competence_id; });
            var label = b.titre || (comp ? comp.nom : '(sans titre)');
            var selected = b.id === banqueId ? ' selected' : '';
            banqueOptions += '<option value="' + b.id + '"' + selected + '>' + escapeHtml(label) + '</option>';
        });

        var isLocked = !!(this.compWizardData.banqueId || e.banque_id);

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
                    '<input type="text" class="form-input" id="cwTitre" value="' + escapeHtml(e.titre || '') + '" placeholder="Ex: Journal de Catherine Pozzi">' +
                    '<div class="form-help">Titre court identifiant le document utilis\u00E9</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Dur\u00E9e indicative (min)</label>' +
                        '<input type="number" class="form-input" id="cwDuree" value="' + dureeMin + '" min="1" max="999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Statut</label>' +
                        '<select class="form-select" id="cwStatut">' +
                            '<option value="brouillon"' + (e.statut !== 'publie' ? ' selected' : '') + '>Brouillon</option>' +
                            '<option value="publie"' + (e.statut === 'publie' ? ' selected' : '') + '>Publi\u00E9</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>D\u00E9lai rendu MBN (min)</label>' +
                        '<input type="number" class="form-input" id="cwDelaiMail" value="' + (e.delai_mail_minutes || 30) + '" min="5" max="1440">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>D\u00E9lai rendu papier (jours de cours)</label>' +
                        '<input type="number" class="form-input" id="cwDelaiPapier" value="' + (e.delai_papier_jours || 1) + '" min="1" max="30">' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ========== ÉTAPE 2 : DOCUMENT + PREVIEW ==========

    _renderCompWizardStep2() {
        var e = this.compWizardData.entrainement || {};
        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83D\uDCC4</span>' +
                '<div>' +
                    '<h3>Document de l\u2019exercice</h3>' +
                    '<p>Construisez le contenu que l\u2019\u00E9l\u00E8ve verra (texte, documents, images, vid\u00E9os)</p>' +
                '</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Consigne <span class="optional">(optionnel)</span></label>' +
                '<textarea class="form-textarea" id="cwDescription" rows="2" placeholder="Consigne pour l\u2019\u00E9l\u00E8ve...">' + escapeHtml(e.description || '') + '</textarea>' +
            '</div>' +
            '<div class="tb-tabs">' +
                '<button type="button" class="tb-tab active" id="cwTabConstruction" onclick="AdminBanquesExercices._cwSwitchDocTab(\'construction\')">' +
                    '<span class="tb-tab-icon">\u2699\uFE0F</span> Construction' +
                '</button>' +
                '<button type="button" class="tb-tab" id="cwTabPreview" onclick="AdminBanquesExercices._cwSwitchDocTab(\'preview\')">' +
                    '<span class="tb-tab-icon">\uD83D\uDC41</span> Vue \u00E9l\u00E8ve' +
                '</button>' +
            '</div>' +
            '<div id="cwConstructionPanel">' +
                '<div id="cwBlockEditorContainer" class="block-editor"></div>' +
                this._renderBlockAddBar() +
            '</div>' +
            '<div id="cwPreviewPanel" class="tb-preview-panel" style="display:none;">' +
                '<div id="cwPreviewContainer" class="cw-preview-frame">' +
                    '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\u2019aper\u00E7u</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    /** Barre d'ajout de blocs, partagée entre les étapes 2 et 3. */
    _renderBlockAddBar() {
        return '<div class="block-add-bar">' +
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
        '</div>';
    },

    _cwSwitchDocTab(tab, prefix) {
        prefix = prefix || 'cw';
        var constructionPanel = document.getElementById(prefix + 'ConstructionPanel');
        var previewPanel = document.getElementById(prefix + 'PreviewPanel');
        var tabConstruction = document.getElementById(prefix + 'TabConstruction');
        var tabPreview = document.getElementById(prefix + 'TabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this._saveEditorsState();
            this._updateCompPreview();
            constructionPanel.style.display = 'none';
            previewPanel.style.display = '';
            if (tabConstruction) tabConstruction.classList.remove('active');
            if (tabPreview) tabPreview.classList.add('active');
        } else {
            constructionPanel.style.display = '';
            previewPanel.style.display = 'none';
            if (tabConstruction) tabConstruction.classList.add('active');
            if (tabPreview) tabPreview.classList.remove('active');
        }
    },

    _initCompWizardStep2() {
        // Rediriger le block editor vers le container du wizard
        this._blockEditorContainerId = 'cwBlockEditorContainer';
        this._cwPreviewContainerId = 'cwPreviewContainer';

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

        // Restaurer _renderBlocks si intercepté précédemment
        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }

        // Initialiser le block editor
        this.initBlockEditor(blocks);
    },


    _updateCompPreview() {
        var previewContainer = document.getElementById(this._cwPreviewContainerId);
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

        // Consigne
        var consigneEl = document.getElementById('cwDescription');
        var consigne = consigneEl ? consigneEl.value.trim() : '';
        var html = '';
        if (consigne) {
            html += '<p class="tb-pv-consigne">' + escapeHtml(consigne) + '</p>';
        }

        // Utiliser le même rendu que le côté élève
        html += '<div class="comp-blocks-container">';
        var self = this;
        blocks.forEach(function(block) {
            if (block.type === 'group') {
                html += '<div class="comp-blocks-group">';
                var ratios = (block.ratio || '50-50').split('-').map(Number);
                (block.children || []).forEach(function(child, idx) {
                    var flex = ratios[idx] || 50;
                    html += '<div class="comp-blocks-group-child" style="flex:' + flex + '">';
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
        case 'text': {
            var txtLegende = block.legende ? '<div class="comp-block-legende">' + escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            return '<div class="comp-block-text">' +
                '<div class="comp-block-text-content">' + (block.content || '') + '</div>' +
                txtLegende +
                '</div>';
        }

        case 'document': {
            var url = block.url || '';
            var embedUrl = this._getPreviewEmbedUrl(url);
            var titre = block.titre ? '<div class="comp-block-titre">' + escapeHtml(block.titre) + '</div>' : '';
            var legende = block.legende ? '<div class="comp-block-legende">' + escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
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
            var imgLegende = block.legende ? '<div class="comp-block-legende">' + escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            if (!block.url) {
                return '<div class="comp-block-image"><div class="cw-preview-placeholder">Saisissez l\u2019URL de l\u2019image</div></div>' + imgLegende;
            }
            return '<div class="comp-block-image">' +
                '<img src="' + escapeHtml(imgUrl) + '" alt="' + escapeHtml(block.legende || 'Image') + '">' +
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
            var vidLegende = block.legende ? '<div class="comp-block-legende">' + escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>' : '';
            if (!block.url) {
                return '<div class="comp-block-video"><div class="cw-preview-placeholder">Saisissez l\u2019URL de la vid\u00E9o</div></div>' + vidLegende;
            }
            return '<div class="comp-block-video">' +
                (embedVid
                    ? '<iframe src="' + embedVid + '" allowfullscreen frameborder="0"></iframe>'
                    : '<a href="' + escapeHtml(vidUrl) + '" target="_blank">Voir la vid\u00E9o</a>') +
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

    // ========== ÉTAPE 3 : CORRIGÉ (block editor / lien) ==========

    _renderCompWizardStep3() {
        var e = this.compWizardData.entrainement || {};

        // Détecter le mode corrigé actuel
        var hasCorrectionBlocks = false;
        if (e.correction_contenu) {
            try {
                var parsed = JSON.parse(e.correction_contenu);
                if (Array.isArray(parsed)) hasCorrectionBlocks = true;
            } catch (err) {
                // HTML brut (ancien format) → sera converti en bloc texte
                hasCorrectionBlocks = true;
            }
        }
        var corrUrl = this._extractCorrectionUrl(e.correction_commentee);
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83D\uDCDD</span>' +
                '<div>' +
                    '<h3>Corrig\u00E9 comment\u00E9</h3>' +
                    '<p>Construisez le corrig\u00E9 que l\u2019\u00E9l\u00E8ve verra en mode entra\u00EEnement (optionnel)</p>' +
                '</div>' +
            '</div>' +
            '<div class="source-toggle" id="cwCorrectionToggle">' +
                '<button type="button" class="source-toggle-btn' + (corrMode === 'url' ? ' active' : '') + '" data-mode="url" onclick="AdminBanquesExercices._cwToggleCorrectionMode(\'url\')">Lien Google Doc</button>' +
                '<button type="button" class="source-toggle-btn' + (corrMode === 'editor' ? ' active' : '') + '" data-mode="editor" onclick="AdminBanquesExercices._cwToggleCorrectionMode(\'editor\')">\u00C9diteur</button>' +
            '</div>' +
            '<div class="source-panel" id="cwCorrectionUrlPanel"' + (corrMode !== 'url' ? ' style="display:none;"' : '') + '>' +
                '<div class="form-group">' +
                    '<label>Lien Google Doc du corrig\u00E9</label>' +
                    '<input type="text" class="form-input" id="cwCorrectionUrl" value="' + escapeHtml(corrUrl) + '" placeholder="https://docs.google.com/document/d/...">' +
                    '<div class="form-help">Collez le lien de partage du Google Doc (doit \u00EAtre accessible en lecture)</div>' +
                '</div>' +
            '</div>' +
            '<div class="source-panel" id="cwCorrectionEditorPanel"' + (corrMode !== 'editor' ? ' style="display:none;"' : '') + '>' +
                '<div class="tb-tabs">' +
                    '<button type="button" class="tb-tab active" id="cwCorrTabConstruction" onclick="AdminBanquesExercices._cwSwitchDocTab(\'construction\', \'cwCorr\')">' +
                        '<span class="tb-tab-icon">\u2699\uFE0F</span> Construction' +
                    '</button>' +
                    '<button type="button" class="tb-tab" id="cwCorrTabPreview" onclick="AdminBanquesExercices._cwSwitchDocTab(\'preview\', \'cwCorr\')">' +
                        '<span class="tb-tab-icon">\uD83D\uDC41</span> Vue \u00E9l\u00E8ve' +
                    '</button>' +
                '</div>' +
                '<div id="cwCorrConstructionPanel">' +
                    '<div id="cwCorrBlockEditorContainer" class="block-editor"></div>' +
                    this._renderBlockAddBar() +
                '</div>' +
                '<div id="cwCorrPreviewPanel" class="tb-preview-panel" style="display:none;">' +
                    '<div id="cwCorrPreviewContainer" class="cw-preview-frame">' +
                        '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\u2019aper\u00E7u</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _initCompWizardStep3() {
        var e = this.compWizardData.entrainement || {};

        // Détecter le mode
        var hasCorrectionBlocks = false;
        if (e.correction_contenu) {
            try {
                var parsed = JSON.parse(e.correction_contenu);
                if (Array.isArray(parsed)) hasCorrectionBlocks = true;
            } catch (err) {
                hasCorrectionBlocks = true; // HTML brut → sera converti
            }
        }
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        // Si mode éditeur, initialiser le block editor pour le corrigé
        if (corrMode === 'editor') {
            this._initCorrectionBlockEditor();
        }
    },

    /** Initialise le block editor pour le corrigé (étape 3). */
    _initCorrectionBlockEditor() {
        var e = this.compWizardData.entrainement || {};

        // Rediriger le block editor vers le container du corrigé
        this._blockEditorContainerId = 'cwCorrBlockEditorContainer';
        this._cwPreviewContainerId = 'cwCorrPreviewContainer';

        // Charger les blocs existants
        var blocks = null;
        if (e.correction_contenu) {
            try {
                var parsed = JSON.parse(e.correction_contenu);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (err) {
                // HTML brut (ancien format) → convertir en un bloc texte
                blocks = [{ type: 'text', content: e.correction_contenu }];
            }
        }

        // Restaurer _renderBlocks si intercepté précédemment
        if (this._origRenderBlocks) {
            this._renderBlocks = this._origRenderBlocks;
            this._origRenderBlocks = null;
        }

        // Initialiser le block editor
        this.initBlockEditor(blocks);
    },

    _cwToggleCorrectionMode(mode) {
        var toggle = document.getElementById('cwCorrectionToggle');
        if (!toggle) return;

        toggle.querySelectorAll('.source-toggle-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        var urlPanel = document.getElementById('cwCorrectionUrlPanel');
        var editorPanel = document.getElementById('cwCorrectionEditorPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (editorPanel) editorPanel.style.display = mode === 'editor' ? '' : 'none';

        // Si on bascule vers l'éditeur et qu'il n'est pas encore initialisé
        if (mode === 'editor') {
            var container = document.getElementById('cwCorrBlockEditorContainer');
            if (container && !container.hasChildNodes()) {
                this._initCorrectionBlockEditor();
            }
        }
    },

    // ========== ÉTAPE COMPÉTENCES (TC uniquement) ==========

    _renderCWStepCompetences() {
        var e = this.compWizardData.entrainement || {};
        var selectedIds = [];
        if (e.competence_ids) {
            try {
                var parsed = typeof e.competence_ids === 'string' ? JSON.parse(e.competence_ids) : e.competence_ids;
                if (Array.isArray(parsed)) selectedIds = parsed;
            } catch (_err) { /* ignore */ }
        }

        // Grouper les compétences par matière
        var comps = (this.competencesReferentiel || []).slice().sort(function(a, b) {
            return (a.ordre || 0) - (b.ordre || 0);
        });

        var groups = {};
        comps.forEach(function(c) {
            var mat = c.matiere || 'Transversal';
            if (!groups[mat]) groups[mat] = [];
            groups[mat].push(c);
        });

        // Ordre d'affichage des matières
        var matiereOrder = ['FR', 'HG-EMC', 'Transversal'];
        var sortedKeys = Object.keys(groups).sort(function(a, b) {
            var ia = matiereOrder.indexOf(a);
            var ib = matiereOrder.indexOf(b);
            if (ia === -1) ia = 99;
            if (ib === -1) ib = 99;
            return ia - ib;
        });

        var matiereLabels = { 'FR': 'Fran\u00E7ais', 'HG-EMC': 'Histoire-G\u00E9o \u00B7 EMC', 'Transversal': 'Transversal' };
        var matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };

        var groupsHtml = '';
        sortedKeys.forEach(function(mat) {
            var label = matiereLabels[mat] || mat;
            var color = matiereColors[mat] || '#6b7280';
            var items = groups[mat];

            groupsHtml +=
                '<div class="cw-comp-group">' +
                    '<div class="cw-comp-group-header" style="border-left: 3px solid ' + color + '; padding-left: 10px; margin-bottom: 8px;">' +
                        '<span style="font-weight: 600; font-size: 0.875rem; color: ' + color + ';">' + label + '</span>' +
                        '<span style="font-size: 0.75rem; color: var(--gray-400); margin-left: 8px;">(' + items.length + ')</span>' +
                    '</div>';

            items.forEach(function(c) {
                var checked = selectedIds.indexOf(c.id) !== -1 ? ' checked' : '';
                groupsHtml +=
                    '<label class="cw-comp-checkbox-item" data-comp-name="' + escapeHtml((c.nom || '').toLowerCase()) + '">' +
                        '<input type="checkbox" value="' + c.id + '"' + checked + '>' +
                        '<span class="cw-comp-checkbox-label">' + escapeHtml(c.nom) + '</span>' +
                    '</label>';
            });

            groupsHtml += '</div>';
        });

        if (comps.length === 0) {
            groupsHtml = '<div style="padding: 24px; text-align: center; color: var(--gray-400);">Aucune comp\u00E9tence dans le r\u00E9f\u00E9rentiel</div>';
        }

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83C\uDFAF</span>' +
                '<div>' +
                    '<h3>Comp\u00E9tences \u00E9valu\u00E9es</h3>' +
                    '<p>S\u00E9lectionnez les comp\u00E9tences mobilis\u00E9es par cet exercice</p>' +
                '</div>' +
            '</div>' +
            '<div class="cw-comp-search-bar">' +
                '<input type="text" class="form-input" id="cwCompSearch" placeholder="Rechercher une comp\u00E9tence...">' +
            '</div>' +
            '<div class="cw-comp-counter" id="cwCompCounter">' +
                selectedIds.length + ' comp\u00E9tence' + (selectedIds.length > 1 ? 's' : '') + ' s\u00E9lectionn\u00E9e' + (selectedIds.length > 1 ? 's' : '') +
            '</div>' +
            '<div class="cw-comp-list" id="cwCompetencesCheckboxes">' +
                groupsHtml +
            '</div>' +
        '</div>';
    },

    _initCWStepCompetences() {
        var self = this;
        var searchInput = document.getElementById('cwCompSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                var query = this.value.toLowerCase().trim();
                var items = document.querySelectorAll('#cwCompetencesCheckboxes .cw-comp-checkbox-item');
                items.forEach(function(item) {
                    var name = item.dataset.compName || '';
                    item.style.display = (!query || name.indexOf(query) !== -1) ? '' : 'none';
                });
                // Masquer les groupes vides
                document.querySelectorAll('#cwCompetencesCheckboxes .cw-comp-group').forEach(function(group) {
                    var visibleItems = group.querySelectorAll('.cw-comp-checkbox-item:not([style*="display: none"])');
                    group.style.display = visibleItems.length > 0 ? '' : 'none';
                });
            });
        }

        // Compteur temps réel
        var container = document.getElementById('cwCompetencesCheckboxes');
        if (container) {
            container.addEventListener('change', function() {
                var checked = container.querySelectorAll('input[type="checkbox"]:checked');
                var counter = document.getElementById('cwCompCounter');
                if (counter) {
                    var n = checked.length;
                    counter.textContent = n + ' comp\u00E9tence' + (n > 1 ? 's' : '') + ' s\u00E9lectionn\u00E9e' + (n > 1 ? 's' : '');
                    counter.style.color = n > 0 ? 'var(--accent-green, #10b981)' : 'var(--gray-400)';
                }
            });
        }
    },

    // ========== ÉTAPE RÉSUMÉ ==========

    _renderCompWizardStep4() {
        var e = this.compWizardData.entrainement || {};
        var self = this;

        // Résumé de l'entraînement
        var sourceList = this.compWizardData.isTCMode ? (this.banquesTachesComplexes || []) : (this.banquesCompetences || []);
        var banque = sourceList.find(function(b) { return b.id === e.banque_id; });
        var comp = banque ? this.competencesReferentiel.find(function(c) { return c.id === banque.competence_id; }) : null;
        var banqueLabel = banque ? (banque.titre || (comp ? comp.nom : '')) : '(non s\u00E9lectionn\u00E9e)';
        var dureeMin = e.duree || 30;

        // Compter les blocs de document
        var nbDocBlocks = 0;
        if (e.document_contenu) {
            try {
                var parsed = JSON.parse(e.document_contenu);
                if (Array.isArray(parsed)) nbDocBlocks = parsed.length;
            } catch (err) {
                nbDocBlocks = 1;
            }
        }

        // Détecter le type de corrigé
        var corrLabel = 'Aucun';
        if (e.correction_commentee) {
            corrLabel = 'Lien Google Doc';
        } else if (e.correction_contenu) {
            var nbCorrBlocks = 0;
            try {
                var parsedCorr = JSON.parse(e.correction_contenu);
                if (Array.isArray(parsedCorr)) nbCorrBlocks = parsedCorr.length;
            } catch (err) {
                nbCorrBlocks = 1;
            }
            corrLabel = nbCorrBlocks + ' bloc' + (nbCorrBlocks > 1 ? 's' : '');
        }

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\u2705</span>' +
                '<div>' +
                    '<h3>R\u00E9sum\u00E9 de l\u2019entra\u00EEnement</h3>' +
                    '<p>V\u00E9rifiez les informations avant d\u2019enregistrer</p>' +
                '</div>' +
            '</div>' +
            '<div class="cw-summary">' +
                '<div class="summary-card">' +
                    '<div class="summary-row"><span class="label">Banque</span><span class="value">' + escapeHtml(banqueLabel) + '</span></div>' +
                    '<div class="summary-row"><span class="label">Titre</span><span class="value">' + escapeHtml(e.titre || '(vide)') + '</span></div>' +
                    (e.description ? '<div class="summary-row"><span class="label">Consigne</span><span class="value">' + escapeHtml(e.description) + '</span></div>' : '') +
                    this._cwRenderCompetencesSummary(e) +
                    '<div class="summary-row"><span class="label">Dur\u00E9e</span><span class="value">' + dureeMin + ' min</span></div>' +
                    '<div class="summary-row"><span class="label">Blocs de contenu</span><span class="value">' + nbDocBlocks + '</span></div>' +
                    '<div class="summary-row"><span class="label">Corrig\u00E9</span><span class="value">' + corrLabel + '</span></div>' +
                    '<div class="summary-row"><span class="label">Statut</span><span class="value">' + (e.statut === 'publie' ? 'Publi\u00E9' : 'Brouillon') + '</span></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _cwRenderCompetencesSummary(e) {
        if (!this.compWizardData.isTCMode) return '';
        var ids = [];
        if (e.competence_ids) {
            try {
                var parsed = typeof e.competence_ids === 'string' ? JSON.parse(e.competence_ids) : e.competence_ids;
                if (Array.isArray(parsed)) ids = parsed;
            } catch (_err) { /* ignore */ }
        }
        var self = this;
        var matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
        var badges = ids.map(function(cid) {
            var c = (self.competencesReferentiel || []).find(function(r) { return r.id === cid; });
            if (!c) return '';
            var color = matiereColors[c.matiere] || '#6b7280';
            return '<span style="display: inline-block; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ' + color + '20; color: ' + color + '; font-weight: 600; margin: 1px 2px;">' + escapeHtml(c.nom) + '</span>';
        }).join('');
        return '<div class="summary-row"><span class="label">Comp\u00E9tences</span><span class="value" style="display: flex; flex-wrap: wrap; gap: 2px;">' + (badges || 'Aucune') + '</span></div>';
    },

    // ========== SAUVEGARDE FINALE ==========

    async _saveCompWizardData() {
        var e = this.compWizardData.entrainement || {};

        var data = {
            titre: e.titre || '',
            banque_id: e.banque_id || '',
            competence_id: e.competence_id || '',
            competence_ids: e.competence_ids || '',
            description: e.description || '',
            document_url: '',
            document_contenu: e.document_contenu || '',
            document_legende: '',
            correction_commentee: e.correction_commentee || '',
            correction_contenu: e.correction_contenu || '',
            duree: e.duree || 30,
            ordre: e.ordre || 1,
            statut: e.statut || 'brouillon',
            delai_mail_minutes: e.delai_mail_minutes || 30,
            delai_papier_jours: e.delai_papier_jours || 1
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
