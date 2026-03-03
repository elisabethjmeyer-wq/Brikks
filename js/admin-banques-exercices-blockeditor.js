/**
 * Block Editor pour les entraînements de compétences et exercices SF document_mixte.
 * Extension de AdminBanquesExercices via Object.assign.
 *
 * Types de blocs : text, document, image, video, tableau
 * Groupement côte à côte par drag & drop, ratio configurable.
 * Stockage : JSON array dans document_contenu / donnees.blocks.
 */
Object.assign(AdminBanquesExercices, {

    // ========== ÉTAT DU BLOCK EDITOR ==========

    /** @type {Array} Liste de blocs [{type, id, ...}, {type:'group', children:[...]}] */
    _blocks: [],

    /** @type {number} Compteur auto-incrémenté pour IDs uniques */
    _blockIdCounter: 0,

    /** @type {string|null} ID du bloc en cours de drag */
    _dragBlockId: null,

    /** @type {string} ID du container du block editor (configurable pour le wizard) */
    _blockEditorContainerId: 'blockEditorContainer',

    // ========== API PUBLIQUE ==========

    /**
     * Initialise le block editor (vide ou depuis des blocs existants).
     * @param {Array|null} blocks — blocs JSON existants, ou null pour un éditeur vide
     */
    initBlockEditor(blocks) {
        this._blocks = [];
        this._blockIdCounter = 0;
        if (Array.isArray(blocks) && blocks.length > 0) {
            this._blocks = blocks.map(b => this._hydrateBlock(b));
        }
        this._renderBlocks();
    },

    /**
     * Ajoute un nouveau bloc à la fin.
     * @param {string} type — 'text', 'document', 'image', 'video'
     */
    addBlock(type) {
        this._saveEditorsState();
        var block = this._createBlock(type);
        this._blocks.push(block);
        this._renderBlocks();
        // Scroll au nouveau bloc et focus
        setTimeout(function() {
            var el = document.getElementById('block-' + block.id);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                var editor = el.querySelector('.rt-editor');
                if (editor) editor.focus();
                var input = el.querySelector('input[type="text"]');
                if (input) input.focus();
            }
        }, 50);
    },

    /**
     * Supprime un bloc par ID (y compris au sein d'un groupe).
     */
    removeBlock(blockId) {
        // Sauvegarder le contenu des éditeurs avant suppression
        this._saveEditorsState();
        this._blocks = this._blocks.filter(function(b) {
            if (b.id === blockId) return false;
            // Si c'est un groupe, filtrer l'enfant
            if (b.type === 'group' && b.children) {
                b.children = b.children.filter(function(c) { return c.id !== blockId; });
                // Si un seul enfant reste, dégrouper
                if (b.children.length <= 1) {
                    return false; // sera traité après
                }
            }
            return true;
        });
        // Dégrouper les groupes avec 1 enfant
        var newBlocks = [];
        for (var i = 0; i < this._blocks.length; i++) {
            var b = this._blocks[i];
            if (b.type === 'group' && b.children && b.children.length === 1) {
                newBlocks.push(b.children[0]);
            } else {
                newBlocks.push(b);
            }
        }
        this._blocks = newBlocks;
        this._renderBlocks();
    },

    /**
     * Sérialise les blocs en JSON (pour sauvegarde).
     * @returns {string} JSON string ou '' si vide
     */
    getBlocksJSON() {
        this._saveEditorsState();
        var clean = this._blocks.map(function(b) { return AdminBanquesExercices._serializeBlock(b); });
        // Filtrer les blocs vides
        clean = clean.filter(function(b) {
            if (b.type === 'text') return b.content && b.content.trim() !== '';
            if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
            if (b.type === 'tableau') return b.colonnes && b.colonnes.length > 0 && b.lignes && b.lignes.length > 0;
            if (b.type === 'group') return b.children && b.children.length > 0;
            if (b.type === 'question') return b.question && b.question.trim() !== '';
            return false;
        });
        if (clean.length === 0) return '';
        return JSON.stringify(clean);
    },

    // ========== CRÉATION DE BLOCS ==========

    _createBlock(type) {
        var id = 'blk_' + (++this._blockIdCounter);
        switch (type) {
        case 'text':
            return { id: id, type: 'text', content: '', legende: '' };
        case 'document':
            return { id: id, type: 'document', url: '', titre: '', legende: '' };
        case 'image':
            return { id: id, type: 'image', url: '', legende: '' };
        case 'video':
            return { id: id, type: 'video', url: '', legende: '' };
        case 'tableau':
            return {
                id: id, type: 'tableau',
                colonnes: ['Colonne 1', 'Colonne 2'],
                lignes: [{ cells: [
                    { valeur: '', type: 'donnee' },
                    { valeur: '', type: 'reponse', correction: 'souple', alternatives: [] }
                ]}]
            };
        case 'question':
            return { id: id, type: 'question', question: '', reponse: '', correction: 'souple', alternatives: [] };
        default:
            return { id: id, type: 'text', content: '' };
        }
    },

    /** Hydrate un bloc JSON (ajoute un ID interne s'il n'en a pas). */
    _hydrateBlock(raw) {
        var id = 'blk_' + (++this._blockIdCounter);
        if (raw.type === 'group') {
            var self = this;
            var group = {
                id: id,
                type: 'group',
                ratio: raw.ratio || '50-50',
                children: (raw.children || []).map(function(c) { return self._hydrateBlock(c); })
            };
            return group;
        }
        var block = Object.assign({ id: id }, raw);
        return block;
    },

    /** Sérialise un bloc (enlève l'ID interne). */
    _serializeBlock(block) {
        if (block.type === 'group') {
            var g = {
                type: 'group',
                layout: 'side-by-side',
                children: (block.children || []).map(function(c) {
                    return AdminBanquesExercices._serializeBlock(c);
                })
            };
            if (block.ratio && block.ratio !== '50-50') g.ratio = block.ratio;
            return g;
        }
        if (block.type === 'tableau') {
            return {
                type: 'tableau',
                colonnes: block.colonnes || [],
                lignes: (block.lignes || []).map(function(ligne) {
                    if (ligne.section) {
                        return { section: true, text: ligne.text || '' };
                    }
                    return { cells: (ligne.cells || []).map(function(cell) {
                        var out = { valeur: cell.valeur, type: cell.type };
                        if (cell.type === 'reponse') {
                            out.correction = cell.correction || 'souple';
                            if (cell.alternatives && cell.alternatives.length > 0) {
                                out.alternatives = cell.alternatives;
                            }
                        }
                        return out;
                    })};
                })
            };
        }
        if (block.type === 'question') {
            var qout = { type: 'question', question: block.question || '', reponse: block.reponse || '' };
            qout.correction = block.correction || 'souple';
            if (block.alternatives && block.alternatives.length > 0) {
                qout.alternatives = block.alternatives;
            }
            return qout;
        }
        var out = { type: block.type };
        if (block.type === 'text') {
            out.content = block.content || '';
        } else {
            out.url = block.url || '';
            if (block.titre) out.titre = block.titre;
        }
        if (block.legende) out.legende = block.legende;
        return out;
    },

    // ========== RENDU ==========

    _renderBlocks() {
        var container = document.getElementById(this._blockEditorContainerId);
        if (!container) return;

        if (this._blocks.length === 0) {
            container.innerHTML = '<div class="block-empty">Aucun contenu. Ajoutez des blocs ci-dessous.</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < this._blocks.length; i++) {
            // Zone de drop entre les blocs
            html += '<div class="block-dropzone" data-index="' + i + '"></div>';
            html += this._renderBlock(this._blocks[i]);
        }
        // Zone de drop finale
        html += '<div class="block-dropzone" data-index="' + this._blocks.length + '"></div>';
        container.innerHTML = html;

        // Initialiser les éditeurs riches dans les blocs texte
        this._initBlockEditors();
        // Initialiser le drag & drop
        this._initBlockDragDrop();
    },

    _renderBlock(block) {
        if (block.type === 'group') {
            return this._renderGroup(block);
        }

        var typeLabels = { text: 'Texte', document: 'Document', image: 'Image', video: 'Video', tableau: 'Tableau', question: 'Question' };
        var typeIcons = {
            text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            video: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
            tableau: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
            question: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };

        var html = '<div class="block-item" id="block-' + block.id + '" data-block-id="' + block.id + '" draggable="true">';
        html += '<div class="block-header">';
        html += '<span class="block-drag-handle" title="Glisser pour deplacer">&#10495;</span>';
        html += '<span class="block-type-badge">' + (typeIcons[block.type] || '') + ' ' + (typeLabels[block.type] || block.type) + '</span>';
        html += '<button type="button" class="block-delete-btn" onclick="AdminBanquesExercices.removeBlock(\'' + block.id + '\')" title="Supprimer ce bloc">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        html += '</button>';
        html += '</div>';
        html += '<div class="block-body">';
        html += this._renderBlockBody(block);
        html += '</div>';
        html += '</div>';
        return html;
    },

    _renderBlockBody(block) {
        switch (block.type) {
        case 'text':
            return '<div class="block-editor-container" id="block-editor-ctn-' + block.id + '"></div>' +
                '<div class="block-field">' +
                '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Extrait du *trait\u00e9 de Versailles*, 1919">' +
                '</div>';

        case 'document':
            return '<div class="block-field">' +
                '<label>URL du document</label>' +
                '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.url || '') + '" ' +
                'placeholder="Lien Google Drive, PDF, page web...">' +
                '</div>' +
                '<div class="block-field">' +
                '<label>Titre <span class="optional">(optionnel)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-titre-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.titre || '') + '" placeholder="Ex: Source 1 - Discours de Robespierre">' +
                '</div>' +
                '<div class="block-field">' +
                '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: *Archives nationales*, 1793">' +
                '</div>';

        case 'image':
            var preview = '';
            if (block.url) {
                var imgSrc = this._convertToDirectImageUrl(block.url);
                preview = '<div class="block-image-preview"><img src="' + this.escapeHtml(imgSrc) + '" alt="Apercu"></div>';
            }
            return '<div class="block-field">' +
                '<label>URL de l\'image</label>' +
                '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.url || '') + '" ' +
                'placeholder="Lien Google Drive, lien direct..." ' +
                'onchange="AdminBanquesExercices._onImageUrlChange(\'' + block.id + '\')">' +
                '</div>' +
                '<div id="block-preview-' + block.id + '">' + preview + '</div>' +
                '<div class="block-field">' +
                '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Carte de l\'*Empire romain*, IIe si\u00e8cle">' +
                '</div>';

        case 'video':
            return '<div class="block-field">' +
                '<label>URL de la video</label>' +
                '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.url || '') + '" ' +
                'placeholder="Lien YouTube ou Google Drive...">' +
                '</div>' +
                '<div class="block-field">' +
                '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Contexte historique de la *R\u00e9volution*">' +
                '</div>';

        case 'tableau':
            return this._renderBlockTableau(block);

        case 'question':
            return this._renderBlockQuestion(block);

        default:
            return '<p>Type de bloc inconnu: ' + block.type + '</p>';
        }
    },

    _renderGroup(group) {
        var ratio = group.ratio || '50-50';
        var ratioOptions = [
            { value: '50-50', label: '50 / 50' },
            { value: '40-60', label: '40 / 60' },
            { value: '60-40', label: '60 / 40' },
            { value: '33-67', label: '33 / 67' },
            { value: '67-33', label: '67 / 33' }
        ];
        var ratioSelect = '<select class="block-ratio-select" onchange="AdminBanquesExercices._setGroupRatio(\'' + group.id + '\', this.value)">';
        for (var r = 0; r < ratioOptions.length; r++) {
            ratioSelect += '<option value="' + ratioOptions[r].value + '"' +
                (ratio === ratioOptions[r].value ? ' selected' : '') + '>' +
                ratioOptions[r].label + '</option>';
        }
        ratioSelect += '</select>';

        var html = '<div class="block-group" id="block-' + group.id + '" data-block-id="' + group.id + '">';
        html += '<div class="block-group-header">';
        html += '<span class="block-type-badge">&#8596; C\u00f4te \u00e0 c\u00f4te</span>';
        html += ratioSelect;
        html += '<button type="button" class="block-degroup-btn" onclick="AdminBanquesExercices._degroupBlock(\'' + group.id + '\')" title="D\u00e9grouper">';
        html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        html += '</button>';
        html += '</div>';

        // Appliquer le ratio comme style flex
        var parts = ratio.split('-');
        var leftFlex = parseInt(parts[0]) || 50;
        var rightFlex = parseInt(parts[1]) || 50;

        html += '<div class="block-group-children">';
        for (var i = 0; i < group.children.length; i++) {
            var flex = i === 0 ? leftFlex : rightFlex;
            html += '<div class="block-group-child" data-block-id="' + group.children[i].id + '" style="flex:' + flex + '">';
            html += this._renderBlock(group.children[i]);
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    },

    // ========== ÉDITEURS RICHES DANS LES BLOCS TEXTE ==========

    _initBlockEditors() {
        var self = this;
        function initBlock(block) {
            if (block.type === 'text') {
                self._initSingleBlockEditor(block);
            }
            if (block.type === 'tableau') {
                self._initBlockTableauListeners(block);
            }
            if (block.type === 'group' && block.children) {
                block.children.forEach(initBlock);
            }
        }
        this._blocks.forEach(initBlock);
    },

    _initSingleBlockEditor(block) {
        var containerId = 'block-editor-ctn-' + block.id;
        var editorId = 'block-editor-' + block.id;
        this.createRichTextEditor(containerId, editorId, {
            placeholder: 'Saisissez le texte...',
            media: false,
            headings: false
        });
        // Restaurer le contenu si existant
        var editor = document.getElementById(editorId);
        if (editor && block.content) {
            editor.innerHTML = block.content;
        }
    },

    // ========== SAUVEGARDE ÉTAT DES ÉDITEURS ==========

    /** Lit le DOM et met à jour this._blocks avec les valeurs courantes. */
    _saveEditorsState() {
        var self = this;
        function saveBlock(block) {
            if (block.type === 'text') {
                var editor = document.getElementById('block-editor-' + block.id);
                if (editor) {
                    var html = editor.innerHTML.trim();
                    block.content = (!html || html === '<br>' || html === '<div><br></div>') ? '' : html;
                }
                var txtLegendeInput = document.getElementById('block-legende-' + block.id);
                if (txtLegendeInput) block.legende = txtLegendeInput.value.trim();
            } else if (block.type === 'tableau') {
                self._saveBlockTableauState(block);
            } else if (block.type === 'question') {
                self._saveBlockQuestionState(block);
            } else if (block.type === 'group') {
                if (block.children) block.children.forEach(saveBlock);
            } else {
                var urlInput = document.getElementById('block-url-' + block.id);
                if (urlInput) block.url = urlInput.value.trim();
                var titreInput = document.getElementById('block-titre-' + block.id);
                if (titreInput) block.titre = titreInput.value.trim();
                var legendeInput = document.getElementById('block-legende-' + block.id);
                if (legendeInput) block.legende = legendeInput.value.trim();
            }
        }
        this._blocks.forEach(saveBlock);
    },

    // ========== APERÇU IMAGE ==========

    _onImageUrlChange(blockId) {
        var input = document.getElementById('block-url-' + blockId);
        var previewContainer = document.getElementById('block-preview-' + blockId);
        if (!input || !previewContainer) return;
        var url = input.value.trim();
        if (url) {
            var imgSrc = this._convertToDirectImageUrl(url);
            previewContainer.innerHTML = '<div class="block-image-preview"><img src="' + this.escapeHtml(imgSrc) + '" alt="Apercu"></div>';
        } else {
            previewContainer.innerHTML = '';
        }
    },

    // ========== DRAG & DROP ==========

    _initBlockDragDrop() {
        var container = document.getElementById(this._blockEditorContainerId);
        if (!container) return;

        var self = this;

        // Rendre les blocs draggable via la poignée
        container.querySelectorAll('.block-item[draggable="true"]').forEach(function(el) {
            el.addEventListener('dragstart', function(e) {
                // Sauvegarder l'état des éditeurs AVANT le drag
                // (le navigateur peut modifier les contenteditable pendant le drag)
                self._saveEditorsState();
                var blockId = el.dataset.blockId;
                self._dragBlockId = blockId;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', blockId);
                el.classList.add('block-dragging');
                // Afficher les zones de drop
                setTimeout(function() {
                    container.classList.add('block-editor-dragging');
                }, 0);
            });

            el.addEventListener('dragend', function() {
                el.classList.remove('block-dragging');
                container.classList.remove('block-editor-dragging');
                self._dragBlockId = null;
                // Nettoyer les indicateurs
                container.querySelectorAll('.block-dropzone-active, .block-drop-left, .block-drop-right').forEach(function(z) {
                    z.classList.remove('block-dropzone-active', 'block-drop-left', 'block-drop-right');
                });
            });
        });

        // Zones de drop entre blocs (insertion empilée)
        container.querySelectorAll('.block-dropzone').forEach(function(zone) {
            zone.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add('block-dropzone-active');
            });
            zone.addEventListener('dragleave', function() {
                zone.classList.remove('block-dropzone-active');
            });
            zone.addEventListener('drop', function(e) {
                e.preventDefault();
                zone.classList.remove('block-dropzone-active');
                var dropIndex = parseInt(zone.dataset.index);
                var dragId = self._dragBlockId;
                if (!dragId) return;
                self._saveEditorsState();
                self._moveBlockToIndex(dragId, dropIndex);
            });
        });

        // Zones de drop côte à côte (survol d'un autre bloc)
        container.querySelectorAll('.block-item[draggable="true"]').forEach(function(targetEl) {
            var targetId = targetEl.dataset.blockId;

            targetEl.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (targetId === self._dragBlockId) return;

                // Vérifier si le bloc cible est déjà dans un groupe
                var targetBlock = self._findBlock(targetId);
                if (!targetBlock) return;

                // Déterminer si on survole la gauche ou la droite
                var rect = targetEl.getBoundingClientRect();
                var midX = rect.left + rect.width / 2;
                if (e.clientX < midX) {
                    targetEl.classList.add('block-drop-left');
                    targetEl.classList.remove('block-drop-right');
                } else {
                    targetEl.classList.add('block-drop-right');
                    targetEl.classList.remove('block-drop-left');
                }
            });

            targetEl.addEventListener('dragleave', function() {
                targetEl.classList.remove('block-drop-left', 'block-drop-right');
            });

            targetEl.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var dragId = self._dragBlockId;
                if (!dragId || dragId === targetId) return;

                targetEl.classList.remove('block-drop-left', 'block-drop-right');

                self._saveEditorsState();

                // Déterminer la position (gauche ou droite)
                var rect = targetEl.getBoundingClientRect();
                var midX = rect.left + rect.width / 2;
                var dropLeft = e.clientX < midX;

                self._groupBlocks(dragId, targetId, dropLeft);
            });
        });
    },

    // ========== OPÉRATIONS SUR LES BLOCS ==========

    /** Trouve un bloc par ID (y compris dans les groupes). */
    _findBlock(blockId) {
        for (var i = 0; i < this._blocks.length; i++) {
            if (this._blocks[i].id === blockId) return this._blocks[i];
            if (this._blocks[i].type === 'group' && this._blocks[i].children) {
                for (var j = 0; j < this._blocks[i].children.length; j++) {
                    if (this._blocks[i].children[j].id === blockId) return this._blocks[i].children[j];
                }
            }
        }
        return null;
    },

    /** Extrait un bloc de sa position actuelle (top level ou dans un groupe). Retourne le bloc. */
    _extractBlock(blockId) {
        var block = null;
        // Chercher au top level
        for (var i = 0; i < this._blocks.length; i++) {
            if (this._blocks[i].id === blockId) {
                block = this._blocks.splice(i, 1)[0];
                break;
            }
            // Chercher dans un groupe
            if (this._blocks[i].type === 'group' && this._blocks[i].children) {
                for (var j = 0; j < this._blocks[i].children.length; j++) {
                    if (this._blocks[i].children[j].id === blockId) {
                        block = this._blocks[i].children.splice(j, 1)[0];
                        // Si le groupe n'a plus qu'un enfant, le dégrouper
                        if (this._blocks[i].children.length <= 1) {
                            var remaining = this._blocks[i].children[0] || null;
                            if (remaining) {
                                this._blocks.splice(i, 1, remaining);
                            } else {
                                this._blocks.splice(i, 1);
                            }
                        }
                        break;
                    }
                }
                if (block) break;
            }
        }
        return block;
    },

    /** Déplace un bloc à l'index indiqué (insertion empilée). */
    _moveBlockToIndex(blockId, targetIndex) {
        var block = this._extractBlock(blockId);
        if (!block) return;

        // Ajuster l'index après extraction
        if (targetIndex > this._blocks.length) targetIndex = this._blocks.length;
        this._blocks.splice(targetIndex, 0, block);
        this._renderBlocks();
    },

    /** Groupe deux blocs côte à côte. */
    _groupBlocks(dragId, targetId, dropLeft) {
        // Vérifier que la cible n'est pas déjà un groupe (max 2 éléments)
        var targetBlock = this._findBlock(targetId);
        if (!targetBlock || targetBlock.type === 'group') return;

        // Vérifier que le drag n'est pas un groupe
        var dragBlock = this._findBlock(dragId);
        if (!dragBlock || dragBlock.type === 'group') return;

        // Extraire le bloc drag
        var extracted = this._extractBlock(dragId);
        if (!extracted) return;

        // Trouver l'index de la cible
        var targetIndex = -1;
        for (var i = 0; i < this._blocks.length; i++) {
            if (this._blocks[i].id === targetId) {
                targetIndex = i;
                break;
            }
            // La cible peut être dans un groupe existant — dans ce cas on ne groupe pas
            if (this._blocks[i].type === 'group' && this._blocks[i].children) {
                for (var j = 0; j < this._blocks[i].children.length; j++) {
                    if (this._blocks[i].children[j].id === targetId) {
                        // La cible est déjà dans un groupe, on insère à côté
                        if (this._blocks[i].children.length < 2) {
                            if (dropLeft) {
                                this._blocks[i].children.splice(j, 0, extracted);
                            } else {
                                this._blocks[i].children.splice(j + 1, 0, extracted);
                            }
                            this._renderBlocks();
                            return;
                        }
                        // Groupe plein, juste insérer au-dessus
                        this._blocks.splice(i, 0, extracted);
                        this._renderBlocks();
                        return;
                    }
                }
            }
        }

        if (targetIndex === -1) {
            // Cible non trouvée, remettre le bloc
            this._blocks.push(extracted);
            this._renderBlocks();
            return;
        }

        // Créer un groupe
        var target = this._blocks[targetIndex];
        var groupId = 'blk_' + (++this._blockIdCounter);
        var group = {
            id: groupId,
            type: 'group',
            ratio: '50-50',
            children: dropLeft ? [extracted, target] : [target, extracted]
        };

        this._blocks.splice(targetIndex, 1, group);
        this._renderBlocks();
    },

    // ========== GROUPES : RATIO + DÉGROUPER ==========

    _setGroupRatio(groupId, ratio) {
        this._saveEditorsState();
        var group = this._findBlock(groupId);
        if (group && group.type === 'group') {
            group.ratio = ratio;
            this._renderBlocks();
        }
    },

    _degroupBlock(groupId) {
        this._saveEditorsState();
        var idx = -1;
        for (var i = 0; i < this._blocks.length; i++) {
            if (this._blocks[i].id === groupId) { idx = i; break; }
        }
        if (idx === -1) return;
        var group = this._blocks[idx];
        if (!group || group.type !== 'group') return;
        // Remplacer le groupe par ses enfants
        var args = [idx, 1].concat(group.children || []);
        Array.prototype.splice.apply(this._blocks, args);
        this._renderBlocks();
    },

    // ========== BLOC TABLEAU (mini table-builder intégré) ==========

    /** Rend le contenu d'un bloc tableau */
    _renderBlockTableau(block) {
        var bid = block.id;
        var cols = block.colonnes || [];
        var rows = block.lignes || [];

        var theadHtml = '<tr>';
        for (var ci = 0; ci < cols.length; ci++) {
            theadHtml += '<th class="tb-header-cell">' +
                '<input type="text" class="tb-col-title" value="' + this.escapeHtml(cols[ci] || '') + '" ' +
                'placeholder="Colonne ' + (ci + 1) + '" data-col="' + ci + '" data-block="' + bid + '">' +
                (cols.length > 1
                    ? '<button type="button" class="tb-col-remove" onclick="AdminBanquesExercices._blockTableRemoveCol(\'' + bid + '\',' + ci + ')">&times;</button>'
                    : '') +
                '</th>';
        }
        theadHtml += '<th class="tb-actions-col">' +
            '<button type="button" class="tb-add-col" onclick="AdminBanquesExercices._blockTableAddCol(\'' + bid + '\')" title="Ajouter une colonne">+</button>' +
            '</th></tr>';

        var tbodyHtml = '';
        for (var ri = 0; ri < rows.length; ri++) {
            // Ligne section (titre violet)
            if (rows[ri].section) {
                tbodyHtml += '<tr data-row="' + ri + '" class="tb-section-row">' +
                    '<td colspan="' + (cols.length + 1) + '" class="tb-section-cell">' +
                    '<input type="text" class="tb-section-input" data-row="' + ri + '" data-block="' + bid + '" ' +
                    'value="' + this.escapeHtml(rows[ri].text || '') + '" placeholder="Titre de la section\u2026">' +
                    '<button type="button" class="tb-section-remove" onclick="AdminBanquesExercices._blockTableRemoveRow(\'' + bid + '\',' + ri + ')">&times;</button>' +
                    '</td></tr>';
                continue;
            }
            // Ligne normale avec cellules
            var cells = rows[ri].cells || [];
            tbodyHtml += '<tr data-row="' + ri + '">';
            for (var cj = 0; cj < cells.length; cj++) {
                var cell = cells[cj];
                var isDonnee = cell.type === 'donnee';
                var hasAlts = cell.alternatives && cell.alternatives.length > 0;
                var isSouple = cell.correction !== 'stricte';
                var typeLabel = isDonnee ? 'D' : 'R';
                var extraInd = '';
                if (!isDonnee) {
                    if (hasAlts) extraInd += '<span class="tb-indicator tb-ind-alt" title="' + cell.alternatives.length + ' alternative(s)">\u00B1' + cell.alternatives.length + '</span>';
                    if (!isSouple) extraInd += '<span class="tb-indicator tb-ind-strict" title="Correction stricte">S</span>';
                }
                tbodyHtml += '<td class="tb-cell ' + (isDonnee ? 'tb-cell-donnee' : 'tb-cell-reponse') + '">' +
                    '<div class="tb-cell-row">' +
                    '<button type="button" class="tb-cell-badge ' + (isDonnee ? 'tb-badge-donnee' : 'tb-badge-reponse') + '" ' +
                    'onclick="AdminBanquesExercices._blockTableSelectCell(\'' + bid + '\',' + ri + ',' + cj + ')">' + typeLabel + '</button>' +
                    '<input type="text" class="tb-cell-input" data-row="' + ri + '" data-col="' + cj + '" data-block="' + bid + '" ' +
                    'value="' + this.escapeHtml(cell.valeur || '') + '" placeholder="' + (isDonnee ? 'Donn\u00e9e...' : 'R\u00e9ponse...') + '">' +
                    (extraInd ? '<div class="tb-cell-indicators">' + extraInd + '</div>' : '') +
                    '</div></td>';
            }
            tbodyHtml += '<td class="tb-row-actions">' +
                (rows.length > 1
                    ? '<button type="button" class="tb-row-remove" onclick="AdminBanquesExercices._blockTableRemoveRow(\'' + bid + '\',' + ri + ')">&times;</button>'
                    : '') +
                '</td></tr>';
        }

        return '<div class="block-tableau-builder">' +
            '<p class="tb-hint">Cliquez sur <strong>D</strong>/<strong>R</strong> pour configurer chaque cellule</p>' +
            '<div class="table-builder-wrapper">' +
            '<table class="table-builder" id="blockTable-' + bid + '">' +
            '<thead>' + theadHtml + '</thead>' +
            '<tbody>' + tbodyHtml + '</tbody>' +
            '</table></div>' +
            '<div class="tb-add-buttons">' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices._blockTableAddRow(\'' + bid + '\')">+ Ligne</button>' +
            '<button type="button" class="btn btn-secondary btn-sm tb-add-section-btn" onclick="AdminBanquesExercices._blockTableAddSection(\'' + bid + '\')">+ Section</button>' +
            '</div></div>';
    },

    /** Sauve l'état DOM d'un bloc tableau */
    _saveBlockTableauState(block) {
        var table = document.getElementById('blockTable-' + block.id);
        if (!table) return;
        // Lire les titres de colonnes
        var headerInputs = table.querySelectorAll('thead .tb-col-title');
        headerInputs.forEach(function(input, i) {
            if (i < block.colonnes.length) block.colonnes[i] = input.value || '';
        });
        // Lire les valeurs des cellules
        var trs = table.querySelectorAll('tbody tr[data-row]');
        trs.forEach(function(tr) {
            var ri = parseInt(tr.dataset.row);
            if (isNaN(ri) || ri >= block.lignes.length) return;
            // Ligne section
            if (block.lignes[ri].section) {
                var secInput = tr.querySelector('.tb-section-input');
                if (secInput) block.lignes[ri].text = secInput.value || '';
                return;
            }
            // Ligne normale
            var inputs = tr.querySelectorAll('.tb-cell-input');
            inputs.forEach(function(input) {
                var ci = parseInt(input.dataset.col);
                if (!isNaN(ci) && block.lignes[ri].cells[ci]) {
                    block.lignes[ri].cells[ci].valeur = input.value || '';
                }
            });
        });
    },

    /** Initialise les listeners du tableau intégré */
    _initBlockTableauListeners(_block) {
        // Rien de spécial à initialiser (tout est en onclick inline)
    },

    // --- Actions tableau intégré ---

    _getBlockById(blockId) {
        return this._findBlock(blockId);
    },

    _blockTableAddCol(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        block.colonnes.push('');
        block.lignes.forEach(function(ligne) {
            if (ligne.section) return;
            ligne.cells.push({ valeur: '', type: 'reponse', correction: 'souple', alternatives: [] });
        });
        this._renderBlocks();
    },

    _blockTableRemoveCol(blockId, colIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        if (block.colonnes.length <= 1) return;
        block.colonnes.splice(colIndex, 1);
        block.lignes.forEach(function(ligne) {
            if (ligne.section) return;
            ligne.cells.splice(colIndex, 1);
        });
        this._renderBlocks();
    },

    _blockTableAddRow(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        var newRow = { cells: block.colonnes.map(function() {
            return { valeur: '', type: 'reponse', correction: 'souple', alternatives: [] };
        })};
        block.lignes.push(newRow);
        this._renderBlocks();
    },

    _blockTableRemoveRow(blockId, rowIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        if (block.lignes.length <= 1) return;
        block.lignes.splice(rowIndex, 1);
        this._renderBlocks();
    },

    _blockTableAddSection(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        block.lignes.push({ section: true, text: '' });
        this._renderBlocks();
    },

    _blockTableSelectCell(blockId, rowIndex, colIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        var cell = block.lignes[rowIndex] && block.lignes[rowIndex].cells[colIndex];
        if (!cell) return;

        // Fermer un éventuel popover précédent
        this._closeCellPopover();

        var colName = block.colonnes[colIndex] || 'Colonne ' + (colIndex + 1);
        var isDonnee = cell.type === 'donnee';
        var bid = blockId;

        var popoverHTML = '<div class="tb-popover" id="tbCellPopover">' +
            '<div class="tb-popover-header">' +
            '<span class="tb-popover-title">L' + (rowIndex + 1) + ' &times; ' + this.escapeHtml(colName) + '</span>' +
            '<button type="button" class="tb-popover-close" onclick="AdminBanquesExercices._closeBlockTablePopover()">&times;</button>' +
            '</div><div class="tb-popover-body">' +
            '<div class="tb-popover-field"><label class="tb-popover-label">Type</label>' +
            '<div class="tb-popover-radio-group">' +
            '<label class="tb-popover-radio ' + (!isDonnee ? 'active' : '') + '">' +
            '<input type="radio" name="tbCellType" value="reponse" ' + (!isDonnee ? 'checked' : '') +
            ' onchange="AdminBanquesExercices._blockTableSetCellType(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',\'reponse\')">' +
            '<span class="tb-radio-label tb-radio-reponse">R\u00e9ponse</span></label>' +
            '<label class="tb-popover-radio ' + (isDonnee ? 'active' : '') + '">' +
            '<input type="radio" name="tbCellType" value="donnee" ' + (isDonnee ? 'checked' : '') +
            ' onchange="AdminBanquesExercices._blockTableSetCellType(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',\'donnee\')">' +
            '<span class="tb-radio-label tb-radio-donnee">Donn\u00e9e</span></label>' +
            '</div></div>';

        if (!isDonnee) {
            var isSouple = cell.correction !== 'stricte';
            var alts = cell.alternatives || [];
            popoverHTML += '<div class="tb-popover-field"><label class="tb-popover-label">Correction</label>' +
                '<div class="tb-popover-radio-group">' +
                '<label class="tb-popover-radio ' + (isSouple ? 'active' : '') + '">' +
                '<input type="radio" name="tbCellCorrection" value="souple" ' + (isSouple ? 'checked' : '') +
                ' onchange="AdminBanquesExercices._blockTableSetCorrection(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',\'souple\')">' +
                '<span class="tb-radio-label">Souple</span></label>' +
                '<label class="tb-popover-radio ' + (!isSouple ? 'active' : '') + '">' +
                '<input type="radio" name="tbCellCorrection" value="stricte" ' + (!isSouple ? 'checked' : '') +
                ' onchange="AdminBanquesExercices._blockTableSetCorrection(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',\'stricte\')">' +
                '<span class="tb-radio-label">Stricte</span></label></div>' +
                '<div class="tb-popover-hint">' + (isSouple ? 'Tol\u00e8re accents, majuscules, ponctuation' : 'La r\u00e9ponse doit \u00eatre exacte') + '</div></div>';

            popoverHTML += '<div class="tb-popover-field"><label class="tb-popover-label">Alternatives accept\u00e9es</label>' +
                '<div class="tb-popover-alts" id="tbPopoverAlts">';
            for (var ai = 0; ai < alts.length; ai++) {
                popoverHTML += '<div class="tb-popover-alt-item">' +
                    '<input type="text" class="tb-popover-alt-input" value="' + this.escapeHtml(alts[ai]) + '" ' +
                    'placeholder="Alternative ' + (ai + 1) + '" data-alt-index="' + ai + '" ' +
                    'onchange="AdminBanquesExercices._blockTableUpdateAlt(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',' + ai + ',this.value)">' +
                    '<button type="button" class="tb-popover-alt-remove" ' +
                    'onclick="AdminBanquesExercices._blockTableRemoveAlt(\'' + bid + '\',' + rowIndex + ',' + colIndex + ',' + ai + ')">\u00D7</button>' +
                    '</div>';
            }
            popoverHTML += '</div>' +
                '<button type="button" class="tb-popover-add-alt" ' +
                'onclick="AdminBanquesExercices._blockTableAddAlt(\'' + bid + '\',' + rowIndex + ',' + colIndex + ')">+ Ajouter une alternative</button></div>';
        }

        popoverHTML += '</div></div>';

        // Positionner le popover
        var clickedBadge = document.querySelector('#blockTable-' + bid + ' .tb-cell-badge[onclick*="' + rowIndex + ',' + colIndex + '"]');
        var clickedTd = clickedBadge ? clickedBadge.closest('td') : null;
        if (!clickedTd) return;

        var wrapper = document.createElement('div');
        wrapper.id = 'tbPopoverWrapper';
        wrapper.innerHTML = popoverHTML;
        document.body.appendChild(wrapper);

        var rect = clickedTd.getBoundingClientRect();
        var popover = document.getElementById('tbCellPopover');
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        var left = rect.right + 8 + scrollLeft;
        if (left + 280 > window.innerWidth) left = rect.left - 288 + scrollLeft;
        var top = rect.top + scrollTop;
        if (top + 350 > window.innerHeight + scrollTop) top = window.innerHeight + scrollTop - 360;
        popover.style.position = 'absolute';
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';

        var self = this;
        setTimeout(function() {
            self._blockTablePopoverHandler = function(e) {
                var pop = document.getElementById('tbCellPopover');
                if (pop && !pop.contains(e.target) && !e.target.closest('.tb-cell-badge')) {
                    self._closeBlockTablePopover();
                }
            };
            document.addEventListener('click', self._blockTablePopoverHandler);
        }, 50);
    },

    _closeBlockTablePopover() {
        var wrapper = document.getElementById('tbPopoverWrapper');
        if (wrapper) wrapper.remove();
        if (this._blockTablePopoverHandler) {
            document.removeEventListener('click', this._blockTablePopoverHandler);
            this._blockTablePopoverHandler = null;
        }
    },

    _blockTableSetCellType(blockId, row, col, type) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block) return;
        var cell = block.lignes[row].cells[col];
        cell.type = type;
        if (type === 'reponse' && !cell.correction) {
            cell.correction = 'souple';
            cell.alternatives = cell.alternatives || [];
        }
        this._renderBlocks();
        this._blockTableSelectCell(blockId, row, col);
    },

    _blockTableSetCorrection(blockId, row, col, mode) {
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].correction = mode;
        var hint = document.querySelector('.tb-popover-hint');
        if (hint) hint.textContent = mode === 'souple' ? 'Tol\u00e8re accents, majuscules, ponctuation' : 'La r\u00e9ponse doit \u00eatre exacte';
    },

    _blockTableAddAlt(blockId, row, col) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block) return;
        var cell = block.lignes[row].cells[col];
        if (!cell.alternatives) cell.alternatives = [];
        cell.alternatives.push('');
        this._renderBlocks();
        this._blockTableSelectCell(blockId, row, col);
        setTimeout(function() {
            var inputs = document.querySelectorAll('.tb-popover-alt-input');
            if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }, 50);
    },

    _blockTableRemoveAlt(blockId, row, col, altIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].alternatives.splice(altIndex, 1);
        this._renderBlocks();
        this._blockTableSelectCell(blockId, row, col);
    },

    _blockTableUpdateAlt(blockId, row, col, altIndex, value) {
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].alternatives[altIndex] = value;
    },

    // ========== BLOC QUESTION (mini question ouverte intégrée) ==========

    /** Rend le contenu d'un bloc question */
    _renderBlockQuestion(block) {
        var bid = block.id;
        var isSouple = block.correction !== 'stricte';
        var alts = block.alternatives || [];

        var altsHtml = '';
        for (var i = 0; i < alts.length; i++) {
            altsHtml += '<div class="block-q-alt-row">' +
                '<input type="text" class="form-input block-q-alt-input" data-block="' + bid + '" data-alt="' + i + '" ' +
                'value="' + this.escapeHtml(alts[i] || '') + '" placeholder="Alternative ' + (i + 1) + '...">' +
                '<button type="button" class="btn-icon danger" onclick="AdminBanquesExercices._blockQuestionRemoveAlt(\'' + bid + '\',' + i + ')">&times;</button>' +
                '</div>';
        }

        return '<div class="block-question-builder">' +
            '<div class="block-field">' +
                '<label>Question</label>' +
                '<input type="text" class="form-input block-input" id="block-q-question-' + bid + '" ' +
                'value="' + this.escapeHtml(block.question || '') + '" placeholder="Ex : Quel est le nom du trait\u00e9 sign\u00e9 en 1919 ?">' +
            '</div>' +
            '<div class="block-field">' +
                '<label>R\u00e9ponse attendue</label>' +
                '<input type="text" class="form-input block-input" id="block-q-reponse-' + bid + '" ' +
                'value="' + this.escapeHtml(block.reponse || '') + '" placeholder="Ex : Le trait\u00e9 de Versailles">' +
            '</div>' +
            '<div class="block-q-options">' +
                '<div class="block-q-correction-toggle">' +
                    '<label>Correction :</label>' +
                    '<select class="form-select block-q-correction-select" id="block-q-correction-' + bid + '" data-block="' + bid + '">' +
                        '<option value="souple"' + (isSouple ? ' selected' : '') + '>Souple (tol\u00e8re accents, casse\u2026)</option>' +
                        '<option value="stricte"' + (!isSouple ? ' selected' : '') + '>Stricte (r\u00e9ponse exacte)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="block-q-alternatives">' +
                    '<label>Alternatives accept\u00e9es <span class="optional">(optionnel)</span></label>' +
                    '<div id="block-q-alts-' + bid + '">' + altsHtml + '</div>' +
                    '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices._blockQuestionAddAlt(\'' + bid + '\')">+ Alternative</button>' +
                '</div>' +
            '</div>' +
            '</div>';
    },

    /** Sauvegarde l'état DOM d'un bloc question */
    _saveBlockQuestionState(block) {
        var qInput = document.getElementById('block-q-question-' + block.id);
        if (qInput) block.question = qInput.value.trim();
        var rInput = document.getElementById('block-q-reponse-' + block.id);
        if (rInput) block.reponse = rInput.value.trim();
        var cSelect = document.getElementById('block-q-correction-' + block.id);
        if (cSelect) block.correction = cSelect.value;
        // Alternatives
        var altsContainer = document.getElementById('block-q-alts-' + block.id);
        if (altsContainer) {
            var altInputs = altsContainer.querySelectorAll('.block-q-alt-input');
            block.alternatives = Array.from(altInputs).map(function(inp) { return inp.value; });
        }
    },

    _blockQuestionAddAlt(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'question') return;
        if (!block.alternatives) block.alternatives = [];
        block.alternatives.push('');
        this._renderBlocks();
        // Focus le nouveau champ
        setTimeout(function() {
            var container = document.getElementById('block-q-alts-' + blockId);
            if (container) {
                var inputs = container.querySelectorAll('.block-q-alt-input');
                if (inputs.length > 0) inputs[inputs.length - 1].focus();
            }
        }, 50);
    },

    _blockQuestionRemoveAlt(blockId, altIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'question') return;
        block.alternatives.splice(altIndex, 1);
        this._renderBlocks();
    },

    // ========== FALLBACK MOBILE : FLÈCHES + BOUTON GROUPER ==========

    moveBlockUp(blockId) {
        this._saveEditorsState();
        var idx = this._blocks.findIndex(function(b) { return b.id === blockId; });
        if (idx <= 0) return;
        var temp = this._blocks[idx];
        this._blocks[idx] = this._blocks[idx - 1];
        this._blocks[idx - 1] = temp;
        this._renderBlocks();
    },

    moveBlockDown(blockId) {
        this._saveEditorsState();
        var idx = this._blocks.findIndex(function(b) { return b.id === blockId; });
        if (idx === -1 || idx >= this._blocks.length - 1) return;
        var temp = this._blocks[idx];
        this._blocks[idx] = this._blocks[idx + 1];
        this._blocks[idx + 1] = temp;
        this._renderBlocks();
    },

    // ========== RÉTRO-COMPATIBILITÉ ==========

    /**
     * Convertit les anciennes données (document_url / document_contenu HTML)
     * en tableau de blocs.
     */
    convertLegacyToBlocks(tache) {
        var blocks = [];

        // Essayer de parser document_contenu comme JSON (nouveau format)
        if (tache.document_contenu) {
            try {
                var parsed = JSON.parse(tache.document_contenu);
                if (Array.isArray(parsed)) {
                    return parsed; // Déjà au nouveau format
                }
            } catch (e) {
                // C'est du HTML brut (ancien format) → un bloc texte
                blocks.push({ type: 'text', content: tache.document_contenu });
            }
        }

        // Ancien format URL
        if (tache.document_url && blocks.length === 0) {
            blocks.push({
                type: 'document',
                url: tache.document_url,
                legende: tache.document_legende || ''
            });
        }

        // Si on a un contenu texte ET une légende séparée (ancien format avec légende)
        if (blocks.length > 0 && blocks[0].type === 'text' && tache.document_legende) {
            // Ajouter la légende comme info supplémentaire (pas idéal mais pas de perte)
            blocks[0].content += '<p><em>' + this.escapeHtml(tache.document_legende) + '</em></p>';
        }

        return blocks;
    }
});
