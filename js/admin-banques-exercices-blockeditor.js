/**
 * Block Editor pour les entraînements de compétences.
 * Extension de AdminBanquesExercices via Object.assign.
 *
 * Types de blocs : text, document, image, video
 * Groupement côte à côte par drag & drop.
 * Stockage : JSON array dans document_contenu.
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
            if (b.type === 'group') return b.children && b.children.length > 0;
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
            return { id: id, type: 'text', content: '' };
        case 'document':
            return { id: id, type: 'document', url: '', titre: '', legende: '' };
        case 'image':
            return { id: id, type: 'image', url: '', legende: '' };
        case 'video':
            return { id: id, type: 'video', url: '', legende: '' };
        default:
            return { id: id, type: 'text', content: '' };
        }
    },

    /** Hydrate un bloc JSON (ajoute un ID interne s'il n'en a pas). */
    _hydrateBlock(raw) {
        var id = 'blk_' + (++this._blockIdCounter);
        if (raw.type === 'group') {
            var self = this;
            return {
                id: id,
                type: 'group',
                children: (raw.children || []).map(function(c) { return self._hydrateBlock(c); })
            };
        }
        var block = Object.assign({ id: id }, raw);
        return block;
    },

    /** Sérialise un bloc (enlève l'ID interne). */
    _serializeBlock(block) {
        if (block.type === 'group') {
            return {
                type: 'group',
                layout: 'side-by-side',
                children: (block.children || []).map(function(c) {
                    return AdminBanquesExercices._serializeBlock(c);
                })
            };
        }
        var out = { type: block.type };
        if (block.type === 'text') {
            out.content = block.content || '';
        } else {
            out.url = block.url || '';
            if (block.titre) out.titre = block.titre;
            if (block.legende) out.legende = block.legende;
        }
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

        var typeLabels = { text: 'Texte', document: 'Document', image: 'Image', video: 'Video' };
        var typeIcons = {
            text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            document: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            video: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
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
                '<label>L\u00e9gende <span class="optional">(optionnel)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Extrait du trait\u00e9 de Versailles, 1919">' +
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
                '<label>Legende <span class="optional">(optionnel)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Archives nationales, 1793">' +
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
                '<label>Legende <span class="optional">(optionnel)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Carte de l\'Empire romain, IIe siecle">' +
                '</div>';

        case 'video':
            return '<div class="block-field">' +
                '<label>URL de la video</label>' +
                '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.url || '') + '" ' +
                'placeholder="Lien YouTube ou Google Drive...">' +
                '</div>' +
                '<div class="block-field">' +
                '<label>Legende <span class="optional">(optionnel)</span></label>' +
                '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                'value="' + this.escapeHtml(block.legende || '') + '" placeholder="Ex: Contexte historique de la Revolution">' +
                '</div>';

        default:
            return '<p>Type de bloc inconnu: ' + block.type + '</p>';
        }
    },

    _renderGroup(group) {
        var html = '<div class="block-group" id="block-' + group.id + '" data-block-id="' + group.id + '">';
        html += '<div class="block-group-header">';
        html += '<span class="block-type-badge">&#8596; Cote a cote</span>';
        html += '</div>';
        html += '<div class="block-group-children">';
        for (var i = 0; i < group.children.length; i++) {
            html += '<div class="block-group-child" data-block-id="' + group.children[i].id + '">';
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
        this._blocks.forEach(function(block) {
            if (block.type === 'text') {
                self._initSingleBlockEditor(block);
            }
            if (block.type === 'group' && block.children) {
                block.children.forEach(function(child) {
                    if (child.type === 'text') {
                        self._initSingleBlockEditor(child);
                    }
                });
            }
        });
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
        function saveBlock(block) {
            if (block.type === 'text') {
                var editor = document.getElementById('block-editor-' + block.id);
                if (editor) {
                    var html = editor.innerHTML.trim();
                    block.content = (!html || html === '<br>' || html === '<div><br></div>') ? '' : html;
                }
                var txtLegendeInput = document.getElementById('block-legende-' + block.id);
                if (txtLegendeInput) block.legende = txtLegendeInput.value.trim();
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
            children: dropLeft ? [extracted, target] : [target, extracted]
        };

        this._blocks.splice(targetIndex, 1, group);
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
