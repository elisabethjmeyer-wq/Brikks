/**
 * Wizard de création/modification d'exercice savoir-faire.
 * Extension de AdminBanquesExercices via Object.assign.
 *
 * 4 étapes :
 *   1. Paramètres (titre, consigne, durée, statut, évaluation)
 *   2. Format (sélection visuelle du format)
 *   3. Contenu (builder spécifique au format)
 *   4. Validation (résumé avant sauvegarde)
 */
Object.assign(AdminBanquesExercices, {

    // ========== ÉTAT DU WIZARD SF ==========

    sfWizardData: {
        exercice: null,
        banqueId: null,
        currentStep: 1,
        isEditing: false,
        formatId: null,
        formatUI: null
    },

    _sfNavigating: false,

    // ========== OUVERTURE / FERMETURE ==========

    openSFWizard: function(exercice, banqueId) {
        // Initialiser les données du wizard
        this.sfWizardData = {
            exercice: exercice ? Object.assign({}, exercice) : null,
            banqueId: banqueId || (exercice ? exercice.banque_id : null),
            currentStep: 1,
            isEditing: !!exercice,
            formatId: exercice ? exercice.format_id : null,
            formatUI: null
        };

        // Résoudre le type UI du format si on édite
        if (exercice && exercice.format_id) {
            var format = this.formats.find(function(f) { return String(f.id) === String(exercice.format_id); });
            if (format) {
                var structure = format.structure;
                if (typeof structure === 'string') {
                    try {
                        structure = JSON.parse(structure);
                        if (typeof structure === 'string') structure = JSON.parse(structure);
                    } catch (e) { structure = {}; }
                }
                this.sfWizardData.formatUI = structure ? structure.type_ui : 'tableau_saisie';
            }
        }

        // Supprimer une éventuelle instance précédente
        var existing = document.getElementById('sfWizardModal');
        if (existing) existing.remove();

        var isEdit = !!exercice;

        // Construire le modal
        var modal = document.createElement('div');
        modal.id = 'sfWizardModal';
        modal.className = 'modal-overlay';
        modal.innerHTML =
            '<div class="modal modal-wizard sf-wizard">' +
                '<div class="wizard-header sf-wizard-header">' +
                    '<div class="wizard-title">' +
                        '<h2>' + (isEdit ? '&#9998; Modifier l\u2019exercice' : '&#10133; Nouvel exercice') + '</h2>' +
                        '<span class="wizard-subtitle">Savoir-faire \u2022 ' + (isEdit ? escapeHtml(exercice.titre) : 'Cr\u00e9ez un exercice') + '</span>' +
                    '</div>' +
                    '<div class="wizard-steps">' +
                        '<button class="wizard-step active" data-step="1" onclick="AdminBanquesExercices.goToSFWizardStep(1)">' +
                            '<span class="step-number">1</span>' +
                            '<span class="step-label">Param\u00e8tres</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="2" onclick="AdminBanquesExercices.goToSFWizardStep(2)">' +
                            '<span class="step-number">2</span>' +
                            '<span class="step-label">Format</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="3" onclick="AdminBanquesExercices.goToSFWizardStep(3)">' +
                            '<span class="step-number">3</span>' +
                            '<span class="step-label">Contenu</span>' +
                        '</button>' +
                        '<button class="wizard-step" data-step="4" onclick="AdminBanquesExercices.goToSFWizardStep(4)">' +
                            '<span class="step-number">4</span>' +
                            '<span class="step-label">Validation</span>' +
                        '</button>' +
                    '</div>' +
                    '<button class="modal-close" onclick="AdminBanquesExercices.closeSFWizard()">&times;</button>' +
                '</div>' +
                '<div class="wizard-body" id="sfWizardContent"></div>' +
                '<div class="wizard-footer">' +
                    '<button class="btn btn-secondary" onclick="AdminBanquesExercices.closeSFWizard()">Annuler</button>' +
                    '<div class="wizard-nav">' +
                        '<button class="btn btn-secondary" id="sfWizardPrevBtn" onclick="AdminBanquesExercices.sfWizardPrevStep()" style="display:none;">' +
                            '\u2190 Pr\u00e9c\u00e9dent' +
                        '</button>' +
                        '<button class="btn btn-primary" id="sfWizardNextBtn" onclick="AdminBanquesExercices.sfWizardNextStep()">' +
                            'Suivant \u2192' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);

        this.renderSFWizardStep(1);
    },

    closeSFWizard: function() {
        var modal = document.getElementById('sfWizardModal');
        if (modal) modal.remove();
        this.sfWizardData = {
            exercice: null,
            banqueId: null,
            currentStep: 1,
            isEditing: false,
            formatId: null,
            formatUI: null
        };
    },

    // ========== NAVIGATION ==========

    goToSFWizardStep: function(step) {
        if (step > this.sfWizardData.currentStep) {
            // Valider chaque étape intermédiaire
            for (var s = this.sfWizardData.currentStep; s < step; s++) {
                if (!this.validateSFWizardStep(s)) return;
            }
        }
        this._saveSFWizardStepState(this.sfWizardData.currentStep);
        this.sfWizardData.currentStep = step;
        this.renderSFWizardStep(step);
    },

    sfWizardPrevStep: function() {
        if (this.sfWizardData.currentStep > 1) {
            this._saveSFWizardStepState(this.sfWizardData.currentStep);
            this.sfWizardData.currentStep--;
            this.renderSFWizardStep(this.sfWizardData.currentStep);
        }
    },

    sfWizardNextStep: async function() {
        if (this._sfNavigating) return;
        this._sfNavigating = true;

        var nextBtn = document.getElementById('sfWizardNextBtn');

        try {
            if (!this.validateSFWizardStep(this.sfWizardData.currentStep)) return;

            this._saveSFWizardStepState(this.sfWizardData.currentStep);

            if (this.sfWizardData.currentStep < 4) {
                this.sfWizardData.currentStep++;
                this.renderSFWizardStep(this.sfWizardData.currentStep);
            } else {
                // Étape finale : sauvegarder
                if (nextBtn) {
                    nextBtn.disabled = true;
                    nextBtn.textContent = 'Enregistrement\u2026';
                }
                await this._saveSFWizardData();
            }
        } finally {
            this._sfNavigating = false;
        }
    },

    // ========== VALIDATION ==========

    validateSFWizardStep: function(step) {
        switch (step) {
        case 1: {
            var titre = document.getElementById('sfwTitre');
            if (titre && !titre.value.trim()) {
                this.showNotification('Le titre est requis', 'warning');
                titre.focus();
                return false;
            }
            var duree = document.getElementById('sfwDuree');
            if (duree) {
                var val = parseInt(duree.value) || 0;
                if (val < 1 || val > 999) {
                    this.showNotification('La dur\u00e9e doit \u00eatre entre 1 et 999 minutes', 'warning');
                    duree.focus();
                    return false;
                }
            }
            return true;
        }
        case 2: {
            if (!this.sfWizardData.formatId) {
                this.showNotification('Veuillez s\u00e9lectionner un format', 'warning');
                return false;
            }
            return true;
        }
        case 3: {
            return this._validateSFBuilderContent();
        }
        case 4:
            return true;
        default:
            return true;
        }
    },

    /** Valide le contenu du builder selon le format actif. */
    _validateSFBuilderContent: function() {
        var formatUI = this.sfWizardData.formatUI;

        if (formatUI === 'carte_cliquable') {
            var imgUrl = document.getElementById('carteImageUrl');
            if (imgUrl && !imgUrl.value.trim()) {
                this.showNotification('L\u2019URL de l\u2019image est requise', 'warning');
                return false;
            }
            if (!this.carteBuilder || this.carteBuilder.marqueurs.length === 0) {
                this.showNotification('Ajoutez au moins un marqueur', 'warning');
                return false;
            }
        } else if (formatUI === 'question_ouverte') {
            var donnees = this.buildDataFromQuestionBuilder();
            if (!donnees.questions || donnees.questions.length === 0) {
                this.showNotification('Ajoutez au moins une question', 'warning');
                return false;
            }
        } else if (formatUI === 'document_mixte') {
            this._saveEditorsState();
            if (!this._blocks || this._blocks.length === 0) {
                this.showNotification('Ajoutez au moins un bloc', 'warning');
                return false;
            }
        } else {
            // tableau_saisie ou document_tableau
            this.readTableBuilderValues();
            if (!this.tableBuilder || this.tableBuilder.columns.length === 0) {
                this.showNotification('Ajoutez au moins une colonne', 'warning');
                return false;
            }
            if (this.tableBuilder.rows.length === 0) {
                this.showNotification('Ajoutez au moins une ligne', 'warning');
                return false;
            }
        }
        return true;
    },

    // ========== SAUVEGARDE D'ÉTAT PAR ÉTAPE ==========

    _saveSFWizardStepState: function(step) {
        var e = this.sfWizardData.exercice || {};

        switch (step) {
        case 1: {
            var titre = document.getElementById('sfwTitre');
            var duree = document.getElementById('sfwDuree');
            var statut = document.getElementById('sfwStatut');

            e.titre = titre ? titre.value.trim() : (e.titre || '');
            e.duree = duree ? (parseInt(duree.value) || 10) : (e.duree || 10);
            e.statut = statut ? statut.value : (e.statut || 'brouillon');

            this.sfWizardData.exercice = e;
            break;
        }
        case 2:
            // Le format est déjà stocké via _selectSFFormat
            break;
        case 3: {
            // Sauvegarder la consigne si modifiée en étape 3
            var consigneEl = document.getElementById('sfwConsigneStep3');
            if (consigneEl) {
                e.consigne = consigneEl.value.trim();
                this.sfWizardData.exercice = e;
            }
            // Capturer les données du builder avant de quitter l'étape 3
            this.sfWizardData._builderSnapshot = this._buildSFDonnees();
            break;
        }
        case 4:
            break;
        }
    },

    // ========== RENDU DES ÉTAPES ==========

    renderSFWizardStep: function(step) {
        var content = document.getElementById('sfWizardContent');
        var prevBtn = document.getElementById('sfWizardPrevBtn');
        var nextBtn = document.getElementById('sfWizardNextBtn');
        if (!content) return;

        // Mettre à jour les indicateurs d'étapes
        var modalEl = document.getElementById('sfWizardModal');
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
            nextBtn.textContent = step === 4 ? '\u2713 Enregistrer' : 'Suivant \u2192';
        }

        switch (step) {
        case 1:
            content.innerHTML = this._renderSFWizardStep1();
            break;
        case 2:
            content.innerHTML = this._renderSFWizardStep2();
            break;
        case 3:
            content.innerHTML = this._renderSFWizardStep3();
            this._initSFWizardStep3();
            break;
        case 4:
            content.innerHTML = this._renderSFWizardStep4();
            break;
        }
    },

    // ========== ÉTAPE 1 : PARAMÈTRES ==========

    _renderSFWizardStep1: function() {
        var e = this.sfWizardData.exercice || {};
        var dureeMin = e.duree || 10;

        // Titre par défaut pour un nouvel exercice
        var defaultTitre = e.titre || '';
        if (!defaultTitre && !this.sfWizardData.isEditing) {
            var banqueId = this.sfWizardData.banqueId;
            var nbExo = this.exercices.filter(function(ex) { return ex.banque_id === banqueId; }).length;
            defaultTitre = 'Exercice ' + (nbExo + 1);
        }

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\u2699\uFE0F</span>' +
                '<div>' +
                    '<h3>Param\u00e8tres g\u00e9n\u00e9raux</h3>' +
                    '<p>Informations de base de l\u2019exercice</p>' +
                '</div>' +
            '</div>' +
            '<div class="wizard-form">' +
                '<div class="form-group">' +
                    '<label>Titre <span class="req">*</span></label>' +
                    '<input type="text" class="form-input" id="sfwTitre" value="' + escapeHtml(defaultTitre) + '" placeholder="Ex: Exercice 1 - Les dates cl\u00e9s">' +
                '</div>' +
                '<div class="form-row">' +
                    '<div class="form-group">' +
                        '<label>Dur\u00e9e (minutes)</label>' +
                        '<input type="number" class="form-input" id="sfwDuree" value="' + dureeMin + '" min="1" max="999">' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label>Statut</label>' +
                        '<select class="form-select" id="sfwStatut">' +
                            '<option value="brouillon"' + (e.statut !== 'publie' ? ' selected' : '') + '>Brouillon</option>' +
                            '<option value="publie"' + (e.statut === 'publie' ? ' selected' : '') + '>Publi\u00e9</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ========== ÉTAPE 2 : FORMAT ==========

    _renderSFWizardStep2: function() {
        var selectedFormatId = this.sfWizardData.formatId;
        var isEditing = this.sfWizardData.isEditing;

        // Icônes et labels courts par type_ui
        var formatIcons = {
            'tableau_saisie': '\uD83D\uDCCA',
            'carte_cliquable': '\uD83D\uDDFA\uFE0F',
            'document_tableau': '\uD83D\uDCC4',
            'question_ouverte': '\u270F\uFE0F',
            'document_mixte': '\uD83D\uDCDD'
        };
        var formatLabelsStep2 = {
            'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Image cliquable',
            'document_tableau': 'Document + Tableau',
            'question_ouverte': 'Question ouverte',
            'document_mixte': 'Document mixte'
        };

        var cardsHtml = '';
        this.formats.forEach(function(format) {
            var structure = format.structure;
            if (typeof structure === 'string') {
                try {
                    structure = JSON.parse(structure);
                    if (typeof structure === 'string') structure = JSON.parse(structure);
                } catch (e) { structure = {}; }
            }
            var typeUI = structure ? (structure.type_ui || 'tableau_saisie') : 'tableau_saisie';
            var icon = formatIcons[typeUI] || '\uD83D\uDCCB';
            var displayName = formatLabelsStep2[typeUI] || format.nom;
            var isSelected = String(format.id) === String(selectedFormatId);
            var isLocked = isEditing && selectedFormatId && !isSelected;

            var classes = 'sf-format-card';
            if (isSelected) classes += ' selected';
            if (isLocked) classes += ' locked';

            cardsHtml += '<button class="' + classes + '" ' +
                'data-format-id="' + format.id + '" ' +
                (isLocked
                    ? 'disabled'
                    : 'onclick="AdminBanquesExercices._selectSFFormat(\'' + format.id + '\', \'' + typeUI + '\')"') +
                '>' +
                '<span class="sf-format-icon">' + icon + '</span>' +
                '<span class="sf-format-name">' + escapeHtml(displayName) + '</span>' +
                '<span class="sf-format-desc">' + escapeHtml(format.description || '') + '</span>' +
                (isSelected ? '<span class="sf-format-check">\u2713</span>' : '') +
            '</button>';
        });

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83C\uDFAF</span>' +
                '<div>' +
                    '<h3>Format de l\u2019exercice</h3>' +
                    '<p>Choisissez le type d\u2019exercice' + (isEditing ? ' (non modifiable en \u00e9dition)' : '') + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="sf-format-grid">' +
                cardsHtml +
            '</div>' +
        '</div>';
    },

    _selectSFFormat: function(formatId, typeUI) {
        this.sfWizardData.formatId = formatId;
        this.sfWizardData.formatUI = typeUI;
        // Re-render pour mettre à jour la sélection visuelle
        var content = document.getElementById('sfWizardContent');
        if (content) {
            content.innerHTML = this._renderSFWizardStep2();
        }
    },

    // ========== ÉTAPE 3 : CONTENU (BUILDER) ==========

    _renderSFWizardStep3: function() {
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';

        var builderHtml = '';
        if (formatUI === 'carte_cliquable') {
            builderHtml = this._renderCarteBuilderHTML();
        } else if (formatUI === 'question_ouverte') {
            builderHtml = this._renderQuestionBuilderHTML();
        } else if (formatUI === 'document_tableau') {
            builderHtml = this._renderTableBuilderHTML(true);
        } else if (formatUI === 'document_mixte') {
            builderHtml = this._renderDocumentMixteBuilderHTML();
        } else {
            builderHtml = this._renderTableBuilderHTML(false);
        }

        // Nom du format pour affichage (label court basé sur le type UI)
        var formatLabels = {
            'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Image cliquable',
            'document_tableau': 'Document + Tableau',
            'question_ouverte': 'Question ouverte',
            'document_mixte': 'Document mixte'
        };
        var formatName = formatLabels[formatUI] || 'Exercice';

        var consigne = (this.sfWizardData.exercice && this.sfWizardData.exercice.consigne) || '';

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\uD83D\uDCDD</span>' +
                '<div>' +
                    '<h3>Contenu de l\u2019exercice</h3>' +
                    '<p>Format : ' + escapeHtml(formatName) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Consigne</label>' +
                '<textarea class="form-textarea" id="sfwConsigneStep3" rows="2" placeholder="Ex : Pour chaque date, trouve le si\u00e8cle\u2026">' + escapeHtml(consigne) + '</textarea>' +
            '</div>' +
            builderHtml +
        '</div>';
    },

    // --- HTML pour le builder Tableau (v2 — split construction / aperçu) ---
    _renderTableBuilderHTML: function(withDocument) {
        var docSection = '';
        if (withDocument) {
            docSection =
                '<div class="form-group" id="documentSectionTableau">' +
                    '<label>Document</label>' +
                    '<select class="form-select" id="docTypeTableau">' +
                        '<option value="texte">Texte</option>' +
                        '<option value="image">Image (URL)</option>' +
                    '</select>' +
                    '<textarea class="form-textarea" id="docContenuTableau" rows="4" placeholder="Contenu du document ou URL de l\'image\u2026"></textarea>' +
                '</div>';
        }

        return '<div id="builderTableau" class="format-builder">' +
            docSection +
            '<div class="tb-tabs">' +
                '<button type="button" class="tb-tab active" id="tbTabConstruction" onclick="AdminBanquesExercices.switchTableTab(\'construction\')">' +
                    '<span class="tb-tab-icon">\u2699\uFE0F</span> Construction' +
                '</button>' +
                '<button type="button" class="tb-tab" id="tbTabPreview" onclick="AdminBanquesExercices.switchTableTab(\'preview\')">' +
                    '<span class="tb-tab-icon">\uD83D\uDC41\uFE0F</span> Vue \u00e9l\u00e8ve' +
                '</button>' +
            '</div>' +
            '<div id="tbConstructionPanel">' +
                '<p class="tb-hint">Cliquez sur le badge <strong>D</strong> (donn\u00e9e) ou <strong>R</strong> (r\u00e9ponse) pour configurer une cellule</p>' +
                '<div class="table-builder-wrapper">' +
                    '<table class="table-builder" id="tableBuilder">' +
                        '<thead id="tableBuilderHead"></thead>' +
                        '<tbody id="tableBuilderBody"></tbody>' +
                    '</table>' +
                '</div>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="addRowBtn">+ Ajouter une ligne</button>' +
            '</div>' +
            '<div id="tbPreviewPanel" class="tb-preview-panel" style="display:none;"></div>' +
        '</div>';
    },

    // --- HTML pour le builder Image cliquable (v2 — popover) ---
    _renderCarteBuilderHTML: function() {
        return '<div id="builderCarte" class="format-builder">' +
            '<div class="form-group">' +
                '<label>URL de l\'image de fond <span class="req">*</span></label>' +
                '<input type="text" class="form-input" id="carteImageUrl" placeholder="https://\u2026">' +
                '<div class="form-help">URL de l\'image (carte, sch\u00e9ma, document\u2026)</div>' +
            '</div>' +
            // Tabs Construction / Vue élève
            '<div class="tb-tabs">' +
                '<button type="button" class="tb-tab active" id="carteTabConstruction" onclick="AdminBanquesExercices.switchCarteTab(\'construction\')">' +
                    '<span class="tb-tab-icon">\u2699\uFE0F</span> Construction' +
                '</button>' +
                '<button type="button" class="tb-tab" id="carteTabPreview" onclick="AdminBanquesExercices.switchCarteTab(\'preview\')">' +
                    '<span class="tb-tab-icon">\uD83D\uDC41\uFE0F</span> Vue \u00e9l\u00e8ve' +
                '</button>' +
            '</div>' +
            // Panel Construction
            '<div id="carteConstructionPanel">' +
                '<div class="form-group">' +
                    '<div class="carte-preview-container" id="cartePreviewContainer">' +
                        '<div class="carte-preview-placeholder" id="cartePreviewPlaceholder">' +
                            'Entrez une URL d\'image ci-dessus pour voir l\'aper\u00e7u' +
                        '</div>' +
                        '<div class="carte-preview-wrapper" id="cartePreviewWrapper" style="display: none;">' +
                            '<img src="" alt="Aper\u00e7u" id="cartePreviewImage">' +
                            '<div class="carte-preview-markers" id="cartePreviewMarkers"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cb-construction-footer">' +
                        '<span class="cb-marker-count" id="carteMarqueurCount">0 marqueur</span>' +
                        '<span class="cb-footer-hint">Clic image = ajouter \u2022 Clic marqueur = configurer</span>' +
                        '<button type="button" class="btn btn-secondary btn-sm" id="addMarqueurBtn" onclick="AdminBanquesExercices.addMarqueurManual()">+ Ajouter manuellement</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // Panel Vue élève
            '<div id="cartePreviewPanel" class="tb-preview-panel" style="display: none;"></div>' +
        '</div>';
    },

    // --- HTML pour le builder Question ouverte ---
    _renderQuestionBuilderHTML: function() {
        return '<div id="builderQuestionOuverte" class="format-builder">' +
            '<div class="form-section">Construction de la question ouverte</div>' +
            '<div class="form-group">' +
                '<label>Document</label>' +
                '<select class="form-select" id="docTypeQO">' +
                    '<option value="texte">Texte</option>' +
                    '<option value="image">Image (URL)</option>' +
                '</select>' +
                '<textarea class="form-textarea" id="docContenuQO" rows="4" placeholder="Contenu du document ou URL de l\'image\u2026"></textarea>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Questions</label>' +
                '<div class="questions-list" id="questionsList"></div>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="addQuestionBtn">+ Ajouter une question</button>' +
            '</div>' +
        '</div>';
    },

    // --- HTML pour le builder Document mixte (v3 — block editor) ---
    _renderDocumentMixteBuilderHTML: function() {
        return '<div id="builderDocumentMixte" class="format-builder">' +
            // Tabs Construction / Vue élève
            '<div class="tb-tabs">' +
                '<button type="button" class="tb-tab active" id="mixteTabConstruction" onclick="AdminBanquesExercices._switchMixteBlockTab(\'construction\')">' +
                    '<span class="tb-tab-icon">\u2699\uFE0F</span> Construction' +
                '</button>' +
                '<button type="button" class="tb-tab" id="mixteTabPreview" onclick="AdminBanquesExercices._switchMixteBlockTab(\'preview\')">' +
                    '<span class="tb-tab-icon">\uD83D\uDC41\uFE0F</span> Vue \u00e9l\u00e8ve' +
                '</button>' +
            '</div>' +
            // Panel Construction (block editor)
            '<div id="mixteConstructionPanel">' +
                '<div id="mixteBlockEditorContainer"></div>' +
                '<div class="block-add-bar">' +
                    '<div class="block-add-wrapper">' +
                        '<button type="button" class="block-add-plus" id="mixteAddBtn" onclick="AdminBanquesExercices._toggleMixteAddMenu()"' +
                            ' title="Ajouter un bloc">+</button>' +
                        '<div class="block-add-menu hidden" id="mixteAddMenu">' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'text\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
                                ' Texte</button>' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'document\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                                ' Document</button>' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'image\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                                ' Image</button>' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'video\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
                                ' Vid\u00e9o</button>' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'tableau\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' +
                                ' Tableau</button>' +
                            '<button type="button" class="block-add-menu-item" onclick="AdminBanquesExercices._addMixteBlock(\'question\')">' +
                                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                                ' Question</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // Panel Vue élève
            '<div id="mixtePreviewPanel" class="tb-preview-panel" style="display:none;"></div>' +
        '</div>';
    },

    // --- Block editor helpers pour document_mixte ---

    _toggleMixteAddMenu: function() {
        var menu = document.getElementById('mixteAddMenu');
        if (menu) menu.classList.toggle('hidden');
    },

    _addMixteBlock: function(type) {
        var menu = document.getElementById('mixteAddMenu');
        if (menu) menu.classList.add('hidden');
        this._blockEditorContainerId = 'mixteBlockEditorContainer';
        this.addBlock(type);
    },

    _switchMixteBlockTab: function(tab) {
        var constructionPanel = document.getElementById('mixteConstructionPanel');
        var previewPanel = document.getElementById('mixtePreviewPanel');
        var tabConstruction = document.getElementById('mixteTabConstruction');
        var tabPreview = document.getElementById('mixteTabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this._saveEditorsState();
            this._renderMixteBlocksPreview(previewPanel);
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

    /** Rendu prévisualisation des blocs (vue élève) */
    _renderMixteBlocksPreview: function(container) {
        var blocks = this._blocks || [];
        if (blocks.length === 0) {
            container.innerHTML = '<div class="tb-preview-empty">Aucun contenu \u00e0 pr\u00e9visualiser</div>';
            return;
        }

        // Récupérer la consigne
        var consigneEl = document.getElementById('sfwConsigneStep3');
        var consigne = consigneEl ? consigneEl.value.trim() : '';

        var html = '';
        if (consigne) {
            html += '<p class="tb-pv-consigne">' + escapeHtml(consigne) + '</p>';
        }
        html += '<div class="mixte-blocks-preview">';

        var self = this;
        blocks.forEach(function(block) {
            html += self._renderPreviewBlock(block);
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /** Rend un bloc dans la preview élève */
    _renderPreviewBlock: function(block) {
        if (block.type === 'group') {
            return this._renderPreviewGroup(block);
        }

        var html = '';
        switch (block.type) {
        case 'text': {
            var content = block.content || '';
            var legende = block.legende || '';
            if (content) {
                html += '<div class="comp-block-text">' + content + '</div>';
            }
            if (legende) {
                html += '<div class="comp-block-legende">' + legende.replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>';
            }
            break;
        }
        case 'document': {
            if (block.titre) {
                html += '<div class="comp-block-titre">' + escapeHtml(block.titre) + '</div>';
            }
            if (block.url) {
                var embedUrl = this._getPreviewEmbedUrl(block.url);
                if (embedUrl) {
                    html += '<iframe src="' + escapeHtml(embedUrl) + '" class="comp-block-document" frameborder="0" allowfullscreen></iframe>';
                }
            }
            if (block.legende) {
                html += '<div class="comp-block-legende">' + block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>';
            }
            break;
        }
        case 'image': {
            if (block.url) {
                var imgSrc = this._convertToDirectImageUrl(block.url);
                html += '<div class="comp-block-image"><img src="' + escapeHtml(imgSrc) + '" alt="Image"></div>';
            }
            if (block.legende) {
                html += '<div class="comp-block-legende">' + block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>';
            }
            break;
        }
        case 'video': {
            if (block.url) {
                var vidUrl = this._getPreviewEmbedUrl(block.url);
                if (vidUrl) {
                    html += '<div class="comp-block-video"><iframe src="' + escapeHtml(vidUrl) + '" frameborder="0" allowfullscreen></iframe></div>';
                }
            }
            if (block.legende) {
                html += '<div class="comp-block-legende">' + block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>') + '</div>';
            }
            break;
        }
        case 'tableau': {
            html += this._renderPreviewBlockTableau(block);
            break;
        }
        case 'question': {
            html += '<div class="comp-block-question">';
            if (block.question) {
                html += '<p class="comp-block-question-label">' + escapeHtml(block.question) + '</p>';
            }
            html += '<input type="text" class="comp-block-question-input" disabled placeholder="R\u00e9ponse de l\u2019\u00e9l\u00e8ve\u2026">';
            html += '</div>';
            break;
        }
        }
        return html;
    },

    _renderPreviewGroup: function(group) {
        var ratio = group.ratio || '50-50';
        var parts = ratio.split('-');
        var leftFlex = parseInt(parts[0]) || 50;
        var rightFlex = parseInt(parts[1]) || 50;

        var html = '<div class="comp-blocks-group">';
        var self = this;
        (group.children || []).forEach(function(child, i) {
            var flex = i === 0 ? leftFlex : rightFlex;
            html += '<div class="comp-blocks-group-child" style="flex:' + flex + '">';
            html += self._renderPreviewBlock(child);
            html += '</div>';
        });
        html += '</div>';
        return html;
    },

    _renderPreviewBlockTableau: function(block) {
        var cols = block.colonnes || [];
        var rows = block.lignes || [];
        if (cols.length === 0) return '<p style="color:#999;">Tableau vide</p>';

        var hasHeader = rows.some(function(r) { return r.header; });
        var html = '<table class="tb-preview-table">';
        if (hasHeader) {
            html += '<thead><tr>';
            cols.forEach(function(c) {
                html += '<th>' + AdminBanquesExercices.escapeHtml(c || '...') + '</th>';
            });
            html += '</tr></thead>';
        }
        html += '<tbody>';
        var colCount = cols.length;
        rows.forEach(function(ligne) {
            if (ligne.header) return;
            if (ligne.section) {
                html += '<tr><td colspan="' + colCount + '" class="tb-pv-section">' + AdminBanquesExercices.escapeHtml(ligne.text || '') + '</td></tr>';
                return;
            }
            html += '<tr>';
            (ligne.cells || []).forEach(function(cell) {
                if (cell.type === 'donnee') {
                    html += '<td class="tb-pv-donnee">' + AdminBanquesExercices.escapeHtml(cell.valeur || '') + '</td>';
                } else {
                    html += '<td class="tb-pv-reponse"><input type="text" disabled placeholder="..."></td>';
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    },

    /** Initialise un block editor vide pour document_mixte. */
    _initMixteBlockEditor: function() {
        this._blockEditorContainerId = 'mixteBlockEditorContainer';
        this.initBlockEditor(null);
    },

    /** Charge un block editor depuis des données existantes pour document_mixte. */
    _loadMixteBlockEditor: function(donnees) {
        this._blockEditorContainerId = 'mixteBlockEditorContainer';
        // Nouveau format (blocks) : charger directement
        if (donnees && donnees.blocks && Array.isArray(donnees.blocks)) {
            this.initBlockEditor(donnees.blocks);
            return;
        }
        // Ancien format (document/tableau/questions) : convertir vers blocks
        var blocks = this._convertLegacyMixteToBlocks(donnees);
        this.initBlockEditor(blocks.length > 0 ? blocks : null);
    },

    /** Convertit l'ancien format document_mixte en blocs. */
    _convertLegacyMixteToBlocks: function(donnees) {
        if (!donnees) return [];
        var blocks = [];
        var sectionOrder = donnees.sectionOrder || ['document', 'tableau', 'questions'];

        sectionOrder.forEach(function(section) {
            if (section === 'document' && donnees.document && donnees.document.actif) {
                var doc = donnees.document;
                if (doc.type === 'texte' && doc.texte) {
                    blocks.push({ type: 'text', content: doc.texte, legende: doc.legende || '' });
                } else if (doc.url) {
                    // Détecter si c'est une image ou un document
                    var url = doc.url.toLowerCase();
                    var isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url) ||
                        (url.indexOf('drive.google.com/file') !== -1 && !url.match(/docs\.google\.com/));
                    blocks.push({
                        type: isImage ? 'image' : 'document',
                        url: doc.url,
                        titre: doc.titre || '',
                        legende: doc.legende || ''
                    });
                }
            } else if (section === 'tableau' && donnees.tableau && donnees.tableau.actif) {
                var tab = donnees.tableau;
                if (tab.elements && tab.elements.length > 0) {
                    // Convertir elements vers colonnes/lignes v2
                    var colonnes = ['', ''];
                    var lignes = [];
                    tab.elements.forEach(function(el) {
                        if (el.type === 'row') {
                            var mainAnswer = (el.reponse || '').split('|')[0];
                            var alternatives = (el.reponse || '').split('|').slice(1).filter(function(a) { return a.trim(); });
                            lignes.push({ cells: [
                                { valeur: el.label || '', type: 'donnee' },
                                { valeur: mainAnswer, type: 'reponse', correction: 'souple', alternatives: alternatives }
                            ]});
                        }
                    });
                    if (lignes.length > 0) {
                        blocks.push({ type: 'tableau', colonnes: colonnes, lignes: lignes });
                    }
                } else if (tab.colonnes && tab.lignes) {
                    // Ancien format colonnes/lignes
                    var cols = tab.colonnes.map(function(c) { return typeof c === 'string' ? c : c.titre || ''; });
                    var rows = tab.lignes.map(function(ligne) {
                        return { cells: (ligne.cells || []).map(function(cell, ci) {
                            var col = tab.colonnes[ci];
                            if (col && col.editable) {
                                var parts = String(cell || '').split('|');
                                return { valeur: parts[0], type: 'reponse', correction: 'souple', alternatives: parts.slice(1) };
                            }
                            return { valeur: cell || '', type: 'donnee' };
                        })};
                    });
                    blocks.push({ type: 'tableau', colonnes: cols, lignes: rows });
                }
            } else if (section === 'questions' && donnees.questions && donnees.questions.actif) {
                // Convertir les questions en blocs texte (pas de bloc question dédié)
                var liste = donnees.questions.liste || [];
                if (liste.length > 0) {
                    var questionsHtml = '<ol>';
                    liste.forEach(function(q) {
                        questionsHtml += '<li>' + (q.question || '') + '</li>';
                    });
                    questionsHtml += '</ol>';
                    blocks.push({ type: 'text', content: questionsHtml, legende: '' });
                }
            }
        });

        return blocks;
    },

    /** Construit les données à sauvegarder depuis le block editor. */
    _buildMixteBlockData: function() {
        this._blockEditorContainerId = 'mixteBlockEditorContainer';
        this._saveEditorsState();
        var blocksJSON = this.getBlocksJSON();
        var blocks = blocksJSON ? JSON.parse(blocksJSON) : [];
        return { blocks: blocks };
    },

    /** Initialise le builder approprié après le rendu de l'étape 3. */
    _initSFWizardStep3: function() {
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var exercice = this.sfWizardData.exercice;
        var isEditing = this.sfWizardData.isEditing && exercice;
        this.currentFormatUI = formatUI;

        // Priorité au snapshot (données modifiées durant cette session de wizard)
        var snapshot = this.sfWizardData._builderSnapshot;

        if (snapshot) {
            // On a déjà travaillé sur l'étape 3 dans cette session → restaurer le snapshot
            if (formatUI === 'carte_cliquable') {
                this.loadCarteBuilderFromData(snapshot);
            } else if (formatUI === 'question_ouverte') {
                this.loadQuestionBuilderFromData(snapshot);
            } else if (formatUI === 'document_tableau') {
                var docType = document.getElementById('docTypeTableau');
                var docContenu = document.getElementById('docContenuTableau');
                if (snapshot.document) {
                    if (docType) docType.value = snapshot.document.type || 'texte';
                    if (docContenu) docContenu.value = snapshot.document.contenu || '';
                }
                this.loadTableBuilderFromData(snapshot);
            } else if (formatUI === 'document_mixte') {
                this._loadMixteBlockEditor(snapshot);
            } else {
                this.loadTableBuilderFromData(snapshot);
            }
        } else if (isEditing && exercice.donnees) {
            // Première visite de l'étape 3 en mode édition → charger les données originales
            var donnees = exercice.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }

            if (formatUI === 'carte_cliquable') {
                this.loadCarteBuilderFromData(donnees);
            } else if (formatUI === 'question_ouverte') {
                this.loadQuestionBuilderFromData(donnees);
            } else if (formatUI === 'document_tableau') {
                var docType2 = document.getElementById('docTypeTableau');
                var docContenu2 = document.getElementById('docContenuTableau');
                if (donnees.document) {
                    if (docType2) docType2.value = donnees.document.type || 'texte';
                    if (docContenu2) docContenu2.value = donnees.document.contenu || '';
                }
                this.loadTableBuilderFromData(donnees);
            } else if (formatUI === 'document_mixte') {
                this._loadMixteBlockEditor(donnees);
            } else {
                this.loadTableBuilderFromData(donnees);
            }
        } else {
            // Nouvel exercice : initialiser un builder vide
            if (formatUI === 'carte_cliquable') {
                this.initCarteBuilder();
            } else if (formatUI === 'question_ouverte') {
                this.initQuestionBuilder();
            } else if (formatUI === 'document_mixte') {
                this._initMixteBlockEditor();
            } else {
                this.initTableBuilder();
            }
        }
    },

    // ========== ÉTAPE 4 : VALIDATION (RÉSUMÉ) ==========

    _renderSFWizardStep4: function() {
        var e = this.sfWizardData.exercice || {};
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var formatLabelsStep4 = {
            'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Image cliquable',
            'document_tableau': 'Document + Tableau',
            'question_ouverte': 'Question ouverte',
            'document_mixte': 'Document mixte'
        };
        var formatName = formatLabelsStep4[formatUI] || 'Non s\u00e9lectionn\u00e9';
        var dureeMin = e.duree || 10;

        // Résumé du contenu selon le format
        var contentSummary = this._getSFContentSummary();

        return '<div class="wizard-step-content">' +
            '<div class="step-header">' +
                '<span class="step-icon">\u2705</span>' +
                '<div>' +
                    '<h3>R\u00e9sum\u00e9 de l\u2019exercice</h3>' +
                    '<p>V\u00e9rifiez les informations avant d\u2019enregistrer</p>' +
                '</div>' +
            '</div>' +
            '<div class="cw-summary">' +
                '<div class="summary-card">' +
                    '<h4>\u2699\uFE0F Param\u00e8tres</h4>' +
                    '<div class="summary-row"><span class="label">Titre</span><span class="value">' + escapeHtml(e.titre || '(vide)') + '</span></div>' +
                    (e.consigne ? '<div class="summary-row"><span class="label">Consigne</span><span class="value">' + escapeHtml(e.consigne) + '</span></div>' : '') +
                    '<div class="summary-row"><span class="label">Dur\u00e9e</span><span class="value">' + dureeMin + ' min</span></div>' +
                    '<div class="summary-row"><span class="label">Statut</span><span class="value status-badge ' + (e.statut || 'brouillon') + '">' + (e.statut === 'publie' ? 'Publi\u00e9' : 'Brouillon') + '</span></div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<h4>\uD83C\uDFAF Format & Contenu</h4>' +
                    '<div class="summary-row"><span class="label">Format</span><span class="value">' + escapeHtml(formatName) + '</span></div>' +
                    contentSummary +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _getSFContentSummary: function() {
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var snapshot = this.sfWizardData._builderSnapshot;
        var html = '';

        if (formatUI === 'carte_cliquable') {
            var nbMarqueurs = snapshot && snapshot.marqueurs ? snapshot.marqueurs.length : 0;
            html += '<div class="summary-row"><span class="label">Marqueurs</span><span class="value">' + nbMarqueurs + '</span></div>';
        } else if (formatUI === 'question_ouverte') {
            var nbQ = snapshot && snapshot.questions ? snapshot.questions.length : 0;
            html += '<div class="summary-row"><span class="label">Questions</span><span class="value">' + nbQ + '</span></div>';
        } else if (formatUI === 'document_mixte') {
            var nbBlocks = snapshot && snapshot.blocks ? snapshot.blocks.length : 0;
            var types = {};
            if (snapshot && snapshot.blocks) {
                snapshot.blocks.forEach(function(b) {
                    if (b.type === 'group') {
                        (b.children || []).forEach(function(c) { types[c.type] = (types[c.type] || 0) + 1; });
                    } else {
                        types[b.type] = (types[b.type] || 0) + 1;
                    }
                });
            }
            var typeLabelsMap = { text: 'Texte', document: 'Document', image: 'Image', video: 'Vid\u00e9o', tableau: 'Tableau', question: 'Question' };
            var typeSummary = Object.keys(types).map(function(t) { return types[t] + ' ' + (typeLabelsMap[t] || t); }).join(', ');
            html += '<div class="summary-row"><span class="label">Blocs</span><span class="value">' + nbBlocks + ' (' + (typeSummary || 'vide') + ')</span></div>';
        } else {
            var nbCols = snapshot && snapshot.colonnes ? snapshot.colonnes.length : 0;
            var nbRows = snapshot && snapshot.lignes ? snapshot.lignes.length : 0;
            html += '<div class="summary-row"><span class="label">Colonnes</span><span class="value">' + nbCols + '</span></div>';
            html += '<div class="summary-row"><span class="label">Lignes</span><span class="value">' + nbRows + '</span></div>';
            if (formatUI === 'document_tableau') {
                html += '<div class="summary-row"><span class="label">Document</span><span class="value">Oui</span></div>';
            }
        }

        return html;
    },

    // ========== CONSTRUCTION DES DONNÉES ==========

    /** Collecte les données du builder actif (lecture du DOM). */
    _buildSFDonnees: function() {
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var donnees;

        if (formatUI === 'carte_cliquable') {
            donnees = this.buildDataFromCarteBuilder();
        } else if (formatUI === 'question_ouverte') {
            donnees = this.buildDataFromQuestionBuilder();
        } else if (formatUI === 'document_tableau') {
            donnees = this.buildDataFromTableBuilder();
            var docType = document.getElementById('docTypeTableau');
            var docContenu = document.getElementById('docContenuTableau');
            donnees.document = {
                type: docType ? docType.value : 'texte',
                contenu: docContenu ? docContenu.value : ''
            };
        } else if (formatUI === 'document_mixte') {
            donnees = this._buildMixteBlockData();
        } else {
            donnees = this.buildDataFromTableBuilder();
        }

        return donnees;
    },

    // ========== SAUVEGARDE FINALE ==========

    _saveSFWizardData: async function() {
        var e = this.sfWizardData.exercice || {};
        var banqueId = this.sfWizardData.banqueId;
        var formatId = this.sfWizardData.formatId;
        var id = this.sfWizardData.isEditing ? e.id : null;

        var numero = id
            ? ((this.exercices.find(function(ex) { return ex.id === id; }) || {}).numero || 1)
            : this.exercices.filter(function(ex) { return ex.banque_id === banqueId; }).length + 1;

        // Récupérer les données du builder (depuis le snapshot pris en quittant l'étape 3)
        var donnees = this.sfWizardData._builderSnapshot || {};

        var data = {
            banque_id: banqueId,
            format_id: formatId,
            numero: numero,
            titre: e.titre || '',
            consigne: e.consigne || '',
            duree: e.duree || 10,
            donnees: JSON.stringify(donnees),
            statut: e.statut || 'brouillon'
        };

        // Mise à jour optimiste
        var tempId = id || 'temp_' + Date.now();
        var optimistic = Object.assign({}, data, { id: tempId, donnees: donnees });

        if (id) {
            var index = this.exercices.findIndex(function(ex) { return ex.id === id; });
            if (index >= 0) {
                this.exercices[index] = Object.assign({}, this.exercices[index], optimistic);
            }
        } else {
            this.exercices.push(optimistic);
        }

        this.renderBanques();
        this.closeSFWizard();

        // Synchronisation en arrière-plan
        try {
            var result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateExercice', data);
            } else {
                result = await this.callAPI('createExercice', data);
            }

            if (result.success) {
                if (!id && result.id) {
                    var tempIndex = this.exercices.findIndex(function(ex) { return ex.id === tempId; });
                    if (tempIndex >= 0) {
                        this.exercices[tempIndex].id = result.id;
                    }
                }
                this.saveToCache();
                this.showNotification(
                    id ? 'Exercice modifi\u00e9' : 'Exercice cr\u00e9\u00e9',
                    'success'
                );
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
                await this.loadDataFromAPI();
                this.renderBanques();
            }
        } catch (error) {
            console.error('Erreur sauvegarde exercice:', error);
            this.showNotification('Erreur de connexion. V\u00e9rifiez votre r\u00e9seau.', 'error');
        }
    }
});
