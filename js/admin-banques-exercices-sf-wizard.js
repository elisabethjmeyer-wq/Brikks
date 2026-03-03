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
                        '<span class="wizard-subtitle">Savoir-faire \u2022 ' + (isEdit ? this.escapeHtml(exercice.titre) : 'Cr\u00e9ez un exercice') + '</span>' +
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
            var doc = document.getElementById('toggleDocument');
            var tab = document.getElementById('toggleTableau');
            var q = document.getElementById('toggleQuestions');
            var hasContent = (doc && doc.checked) || (tab && tab.checked) || (q && q.checked);
            if (!hasContent) {
                this.showNotification('Activez au moins une section', 'warning');
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
            e.duree = duree ? (parseInt(duree.value) || 10) * 60 : (e.duree || 600);
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
            // Sauvegarder l'état du builder avant de quitter l'étape 3
            this._saveSFBuilderSnapshot();
            content.innerHTML = this._renderSFWizardStep4();
            break;
        }
    },

    // ========== ÉTAPE 1 : PARAMÈTRES ==========

    _renderSFWizardStep1: function() {
        var e = this.sfWizardData.exercice || {};
        var dureeMin = Math.round((e.duree || 600) / 60);

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
                    '<input type="text" class="form-input" id="sfwTitre" value="' + this.escapeHtml(defaultTitre) + '" placeholder="Ex: Exercice 1 - Les dates cl\u00e9s">' +
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
        var self = this;
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
            'carte_cliquable': 'Carte cliquable',
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
                '<span class="sf-format-name">' + self.escapeHtml(displayName) + '</span>' +
                '<span class="sf-format-desc">' + self.escapeHtml(format.description || '') + '</span>' +
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
            'carte_cliquable': 'Carte cliquable',
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
                    '<p>Format : ' + this.escapeHtml(formatName) + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Consigne</label>' +
                '<textarea class="form-textarea" id="sfwConsigneStep3" rows="2" placeholder="Ex : Pour chaque date, trouve le si\u00e8cle\u2026">' + this.escapeHtml(consigne) + '</textarea>' +
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

    // --- HTML pour le builder Carte cliquable ---
    _renderCarteBuilderHTML: function() {
        return '<div id="builderCarte" class="format-builder">' +
            '<div class="form-section">Construction de la carte cliquable</div>' +
            '<div class="form-group">' +
                '<label>URL de l\'image de fond <span class="req">*</span></label>' +
                '<input type="text" class="form-input" id="carteImageUrl" placeholder="https://\u2026">' +
                '<div class="form-help">URL de l\'image (carte, sch\u00e9ma, document\u2026)</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Aper\u00e7u et placement des marqueurs</label>' +
                '<div class="carte-preview-container" id="cartePreviewContainer">' +
                    '<div class="carte-preview-placeholder" id="cartePreviewPlaceholder">' +
                        'Entrez une URL d\'image ci-dessus pour voir l\'aper\u00e7u' +
                    '</div>' +
                    '<div class="carte-preview-wrapper" id="cartePreviewWrapper" style="display: none;">' +
                        '<img src="" alt="Aper\u00e7u" id="cartePreviewImage">' +
                        '<div class="carte-preview-markers" id="cartePreviewMarkers"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="form-help">Cliquez sur l\'image pour placer des marqueurs</div>' +
            '</div>' +
            '<div class="form-group">' +
                '<label>Marqueurs</label>' +
                '<div class="marqueurs-list" id="marqueursList"></div>' +
                '<button type="button" class="btn btn-secondary btn-sm" id="addMarqueurBtn">+ Ajouter un marqueur manuellement</button>' +
            '</div>' +
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

    // --- HTML pour le builder Document mixte ---
    _renderDocumentMixteBuilderHTML: function() {
        return '<div id="builderDocumentMixte" class="format-builder">' +
            '<div class="form-section">Construction de l\'exercice</div>' +
            '<div class="mixte-toggles">' +
                '<label class="toggle-label">' +
                    '<input type="checkbox" id="toggleDocument" checked onchange="AdminBanquesExercices.onMixteToggle(\'document\', this.checked)">' +
                    '<span class="toggle-text">\uD83D\uDCC4 Document</span>' +
                '</label>' +
                '<label class="toggle-label">' +
                    '<input type="checkbox" id="toggleTableau" onchange="AdminBanquesExercices.onMixteToggle(\'tableau\', this.checked)">' +
                    '<span class="toggle-text">\uD83D\uDCCA Tableau \u00e0 compl\u00e9ter</span>' +
                '</label>' +
                '<label class="toggle-label">' +
                    '<input type="checkbox" id="toggleQuestions" onchange="AdminBanquesExercices.onMixteToggle(\'questions\', this.checked)">' +
                    '<span class="toggle-text">\u2753 Questions ouvertes</span>' +
                '</label>' +
            '</div>' +
            '<div class="mixte-layout-option">' +
                '<label>Disposition :</label>' +
                '<select id="mixteLayoutSelect" onchange="AdminBanquesExercices.onLayoutChange(this.value)">' +
                    '<option value="vertical">Vertical (empil\u00e9)</option>' +
                    '<option value="horizontal">Horizontal (document \u00e0 gauche)</option>' +
                '</select>' +
            '</div>' +
            '<div class="mixte-builder-sections" id="mixteBuilderSections">' +
                // Section Document
                '<div id="sectionDocument" class="mixte-section" data-section="document">' +
                    '<div class="section-header">' +
                        '<span class="drag-handle" title="Glisser pour r\u00e9organiser">\u22EE\u22EE</span>' +
                        '<h4>\uD83D\uDCC4 Document</h4>' +
                    '</div>' +
                    '<div class="section-content">' +
                        '<div class="form-row">' +
                            '<label>Type de document</label>' +
                            '<div class="doc-type-toggle">' +
                                '<label class="toggle-option">' +
                                    '<input type="radio" name="docType" value="url" checked onchange="AdminBanquesExercices.toggleDocType(\'url\')">' +
                                    '<span>\uD83D\uDD17 Image/URL</span>' +
                                '</label>' +
                                '<label class="toggle-option">' +
                                    '<input type="radio" name="docType" value="texte" onchange="AdminBanquesExercices.toggleDocType(\'texte\')">' +
                                    '<span>\uD83D\uDCDD Texte</span>' +
                                '</label>' +
                            '</div>' +
                        '</div>' +
                        '<div id="docUrlSection" class="form-row">' +
                            '<label>URL du document</label>' +
                            '<input type="text" class="form-input" id="docUrlMixte" placeholder="Lien Google Drive, image, PDF\u2026">' +
                            '<div class="form-help">Collez un lien Google Drive (image, PDF, Doc) ou une URL directe</div>' +
                        '</div>' +
                        '<div id="docTexteSection" class="form-row" style="display: none;">' +
                            '<label>Contenu du texte</label>' +
                            '<div class="wysiwyg-container">' +
                                '<div class="wysiwyg-toolbar">' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras (Ctrl+B)"><b>G</b></button>' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="underline" title="Soulign\u00e9 (Ctrl+U)"><u>S</u></button>' +
                                    '<span class="wysiwyg-sep"></span>' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="justifyLeft" title="Aligner \u00e0 gauche">\u25C0</button>' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="justifyCenter" title="Centrer">\u25C6</button>' +
                                    '<button type="button" class="wysiwyg-btn" data-cmd="justifyRight" title="Aligner \u00e0 droite">\u25B6</button>' +
                                    '<span class="wysiwyg-sep"></span>' +
                                    '<select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">' +
                                        '<option value="">Couleur</option>' +
                                        '<option value="#000000">Noir</option>' +
                                        '<option value="#dc2626">Rouge</option>' +
                                        '<option value="#2563eb">Bleu</option>' +
                                        '<option value="#16a34a">Vert</option>' +
                                    '</select>' +
                                '</div>' +
                                '<div class="wysiwyg-editor" id="docTexteMixte" contenteditable="true" data-placeholder="Saisissez votre texte ici\u2026"></div>' +
                            '</div>' +
                            '<div class="form-help">Utilisez la barre d\'outils pour le formatage (gras, italique, couleurs\u2026)</div>' +
                        '</div>' +
                        '<div class="form-row">' +
                            '<label>Titre du document</label>' +
                            '<input type="text" class="form-input" id="docTitreMixte" placeholder="Ex: Doc. 1 - Titre du document">' +
                        '</div>' +
                        '<div class="form-row">' +
                            '<label>L\u00e9gende <span class="optional">(optionnel)</span></label>' +
                            '<textarea class="form-textarea" id="docLegendeMixte" rows="2" placeholder="L\u00e9gende du document\u2026"></textarea>' +
                            '<div class="form-help">Utilisez *texte* pour mettre en italique</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                // Section Tableau
                '<div id="sectionTableau" class="mixte-section" data-section="tableau" style="display: none;">' +
                    '<div class="section-header">' +
                        '<span class="drag-handle" title="Glisser pour r\u00e9organiser">\u22EE\u22EE</span>' +
                        '<h4>\uD83D\uDCCA Tableau \u00e0 compl\u00e9ter</h4>' +
                    '</div>' +
                    '<div class="section-content">' +
                        '<div class="form-row">' +
                            '<label>Titre du tableau <span class="optional">(optionnel)</span></label>' +
                            '<input type="text" class="form-input" id="tableauTitreMixte" placeholder="Ex: \u00c0 COMPL\u00c9TER">' +
                        '</div>' +
                        '<div class="form-row">' +
                            '<label>\u00c9l\u00e9ments du tableau</label>' +
                            '<div class="tableau-elements-list" id="tableauElementsList"></div>' +
                            '<div class="tableau-add-buttons">' +
                                '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addTableauElement(\'section\')">+ Section</button>' +
                                '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addTableauElement(\'row\')">+ Ligne</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                // Section Questions
                '<div id="sectionQuestions" class="mixte-section" data-section="questions" style="display: none;">' +
                    '<div class="section-header">' +
                        '<span class="drag-handle" title="Glisser pour r\u00e9organiser">\u22EE\u22EE</span>' +
                        '<h4>\u2753 Questions ouvertes</h4>' +
                    '</div>' +
                    '<div class="section-content">' +
                        '<div class="questions-list-mixte" id="questionsListMixte"></div>' +
                        '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addQuestionMixte()">+ Ajouter une question</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="mixte-preview-section">' +
                '<div class="form-section">Aper\u00e7u</div>' +
                '<div class="mixte-preview-content" id="mixtePreviewContent">' +
                    '<div class="preview-placeholder">Activez des sections pour voir l\'aper\u00e7u</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    /** Initialise le builder approprié après le rendu de l'étape 3. */
    _initSFWizardStep3: function() {
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var exercice = this.sfWizardData.exercice;
        var isEditing = this.sfWizardData.isEditing && exercice;
        this.currentFormatUI = formatUI;

        if (isEditing && exercice.donnees) {
            // Parse donnees
            var donnees = exercice.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }

            // Charger les données dans le builder approprié
            if (formatUI === 'carte_cliquable') {
                this.loadCarteBuilderFromData(donnees);
            } else if (formatUI === 'question_ouverte') {
                this.loadQuestionBuilderFromData(donnees);
            } else if (formatUI === 'document_tableau') {
                var docType = document.getElementById('docTypeTableau');
                var docContenu = document.getElementById('docContenuTableau');
                if (donnees.document) {
                    if (docType) docType.value = donnees.document.type || 'texte';
                    if (docContenu) docContenu.value = donnees.document.contenu || '';
                }
                this.loadTableBuilderFromData(donnees);
            } else if (formatUI === 'document_mixte') {
                this.loadDocumentMixteFromData(donnees);
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
                this.initDocumentMixteBuilder();
            } else {
                this.initTableBuilder();
            }
        }
    },

    /** Capture un snapshot des données du builder avant de quitter l'étape 3. */
    _saveSFBuilderSnapshot: function() {
        // On ne snapshot que si on était sur l'étape 3
        if (this.sfWizardData.currentStep === 3 || this._lastSFStep === 3) {
            this.sfWizardData._builderSnapshot = this._buildSFDonnees();
        }
    },

    // ========== ÉTAPE 4 : VALIDATION (RÉSUMÉ) ==========

    _renderSFWizardStep4: function() {
        var e = this.sfWizardData.exercice || {};
        var formatUI = this.sfWizardData.formatUI || 'tableau_saisie';
        var formatLabelsStep4 = {
            'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Carte cliquable',
            'document_tableau': 'Document + Tableau',
            'question_ouverte': 'Question ouverte',
            'document_mixte': 'Document mixte'
        };
        var formatName = formatLabelsStep4[formatUI] || 'Non s\u00e9lectionn\u00e9';
        var dureeMin = Math.round((e.duree || 600) / 60);

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
                    '<div class="summary-row"><span class="label">Titre</span><span class="value">' + this.escapeHtml(e.titre || '(vide)') + '</span></div>' +
                    (e.consigne ? '<div class="summary-row"><span class="label">Consigne</span><span class="value">' + this.escapeHtml(e.consigne) + '</span></div>' : '') +
                    '<div class="summary-row"><span class="label">Dur\u00e9e</span><span class="value">' + dureeMin + ' min</span></div>' +
                    '<div class="summary-row"><span class="label">Statut</span><span class="value status-badge ' + (e.statut || 'brouillon') + '">' + (e.statut === 'publie' ? 'Publi\u00e9' : 'Brouillon') + '</span></div>' +
                '</div>' +
                '<div class="summary-card">' +
                    '<h4>\uD83C\uDFAF Format & Contenu</h4>' +
                    '<div class="summary-row"><span class="label">Format</span><span class="value">' + this.escapeHtml(formatName) + '</span></div>' +
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
            var sections = [];
            if (snapshot && snapshot.document && snapshot.document.actif) sections.push('Document');
            if (snapshot && snapshot.tableau && snapshot.tableau.actif) sections.push('Tableau');
            if (snapshot && snapshot.questions && snapshot.questions.actif) sections.push('Questions');
            html += '<div class="summary-row"><span class="label">Sections actives</span><span class="value">' + (sections.join(', ') || 'Aucune') + '</span></div>';
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
            donnees = this.buildDataFromDocumentMixte();
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
            duree: e.duree || 600,
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
