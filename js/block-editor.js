/**
 * Block Editor Mixin — module partagé entre admin-banques-exercices et admin-corrections.
 *
 * Usage :
 *   Object.assign(MonModule, createBlockEditorMixin('MonModule'));
 *
 * Types de blocs : text, document, image, video, group.
 * Les blocs spécifiques (tableau, question) sont ajoutés par admin-banques-exercices-blockeditor.js.
 */

/* eslint-disable no-unused-vars */
function createBlockEditorMixin(hostName) {
    var H = hostName; // raccourci pour les onclick

    return {

        // ========== ÉTAT DU BLOCK EDITOR ==========

        _blocks: [],
        _blockIdCounter: 0,
        _dragBlockId: null,
        _blockEditorContainerId: 'blockEditorContainer',

        // ========== API PUBLIQUE ==========

        initBlockEditor: function(blocks) {
            this._blocks = [];
            this._blockIdCounter = 0;
            if (Array.isArray(blocks) && blocks.length > 0) {
                var self = this;
                this._blocks = blocks.map(function(b) { return self._hydrateBlock(b); });
            }
            this._renderBlocks();
        },

        addBlock: function(type) {
            this._saveEditorsState();
            var block = this._createBlock(type);
            this._blocks.push(block);
            this._renderBlocks();
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

        removeBlock: function(blockId) {
            this._saveEditorsState();
            this._blocks = this._blocks.filter(function(b) {
                if (b.id === blockId) return false;
                if (b.type === 'group' && b.children) {
                    b.children = b.children.filter(function(c) { return c.id !== blockId; });
                    if (b.children.length <= 1) return false;
                }
                return true;
            });
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

        getBlocksJSON: function() {
            this._saveEditorsState();
            var self = this;
            var clean = this._blocks.map(function(b) { return self._serializeBlock(b); });
            clean = clean.filter(function(b) {
                if (b.type === 'text') return b.content && b.content.trim() !== '';
                if (b.type === 'document' || b.type === 'image' || b.type === 'video') return b.url && b.url.trim() !== '';
                if (b.type === 'tableau') return b.colonnes && b.colonnes.length > 0 && b.lignes && b.lignes.filter(function(r) { return !r.header; }).length > 0;
                if (b.type === 'group') return b.children && b.children.length > 0;
                if (b.type === 'question') return b.question && b.question.trim() !== '';
                return false;
            });
            if (clean.length === 0) return '';
            return JSON.stringify(clean);
        },

        // ========== CRÉATION DE BLOCS ==========

        _createBlock: function(type) {
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
            default:
                return { id: id, type: 'text', content: '' };
            }
        },

        _hydrateBlock: function(raw) {
            var id = 'blk_' + (++this._blockIdCounter);
            if (raw.type === 'group') {
                var self = this;
                return {
                    id: id,
                    type: 'group',
                    ratio: raw.ratio || '50-50',
                    children: (raw.children || []).map(function(c) { return self._hydrateBlock(c); })
                };
            }
            var block = Object.assign({ id: id }, raw);
            if (block.type === 'tableau' && block.showHeader !== false) {
                var hasHdr = (block.lignes || []).some(function(r) { return r.header; });
                if (!hasHdr) {
                    block.lignes = [{ header: true }].concat(block.lignes || []);
                }
            }
            return block;
        },

        _serializeBlock: function(block) {
            var self = this;
            if (block.type === 'group') {
                var g = {
                    type: 'group',
                    layout: 'side-by-side',
                    children: (block.children || []).map(function(c) { return self._serializeBlock(c); })
                };
                if (block.ratio && block.ratio !== '50-50') g.ratio = block.ratio;
                return g;
            }
            if (block.type === 'tableau') {
                var hasHdr = (block.lignes || []).some(function(r) { return r.header; });
                var tableOut = {
                    type: 'tableau',
                    colonnes: block.colonnes || [],
                    lignes: (block.lignes || []).filter(function(ligne) { return !ligne.header; }).map(function(ligne) {
                        if (ligne.section) return { section: true, text: ligne.text || '' };
                        return { cells: (ligne.cells || []).map(function(cell) {
                            var c = { valeur: cell.valeur, type: cell.type };
                            if (cell.type === 'reponse') {
                                c.correction = cell.correction || 'souple';
                                if (cell.alternatives && cell.alternatives.length > 0) c.alternatives = cell.alternatives;
                            }
                            return c;
                        })};
                    })
                };
                if (!hasHdr) tableOut.showHeader = false;
                return tableOut;
            }
            if (block.type === 'question') {
                var qout = { type: 'question', question: block.question || '', reponse: block.reponse || '' };
                qout.correction = block.correction || 'souple';
                if (block.alternatives && block.alternatives.length > 0) qout.alternatives = block.alternatives;
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

        _renderBlocks: function() {
            var container = document.getElementById(this._blockEditorContainerId);
            if (!container) return;

            if (this._blocks.length === 0) {
                container.innerHTML = '<div class="block-empty">Aucun contenu. Ajoutez des blocs ci-dessous.</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < this._blocks.length; i++) {
                html += '<div class="block-dropzone" data-index="' + i + '"></div>';
                html += this._renderBlock(this._blocks[i]);
            }
            html += '<div class="block-dropzone" data-index="' + this._blocks.length + '"></div>';
            container.innerHTML = html;

            this._initBlockEditors();
            this._initBlockDragDrop();
        },

        _renderBlock: function(block) {
            if (block.type === 'group') return this._renderGroup(block);

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
            html += '<button type="button" class="block-delete-btn" onclick="' + H + '.removeBlock(\'' + block.id + '\')" title="Supprimer ce bloc">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
            html += '</button>';
            html += '</div>';
            html += '<div class="block-body">';
            html += this._renderBlockBody(block);
            html += '</div>';
            html += '</div>';
            return html;
        },

        _renderBlockBody: function(block) {
            switch (block.type) {
            case 'text':
                return '<div class="block-editor-container" id="block-editor-ctn-' + block.id + '"></div>' +
                    '<div class="block-field">' +
                    '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                    '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                    'value="' + escapeHtml(block.legende || '') + '" placeholder="Ex: Extrait du *trait\u00e9 de Versailles*, 1919">' +
                    '</div>';

            case 'document':
                return '<div class="block-field">' +
                    '<label>URL du document</label>' +
                    '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                    'value="' + escapeHtml(block.url || '') + '" placeholder="Lien Google Drive, PDF, page web...">' +
                    '</div>' +
                    '<div class="block-field">' +
                    '<label>Titre <span class="optional">(optionnel)</span></label>' +
                    '<input type="text" class="form-input block-input" id="block-titre-' + block.id + '" ' +
                    'value="' + escapeHtml(block.titre || '') + '" placeholder="Ex: Source 1 - Discours de Robespierre">' +
                    '</div>' +
                    '<div class="block-field">' +
                    '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                    '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                    'value="' + escapeHtml(block.legende || '') + '" placeholder="Ex: *Archives nationales*, 1793">' +
                    '</div>';

            case 'image': {
                var preview = '';
                if (block.url) {
                    var imgSrc = this._convertToDirectImageUrl(block.url);
                    preview = '<div class="block-image-preview"><img src="' + escapeHtml(imgSrc) + '" alt="Apercu"></div>';
                }
                return '<div class="block-field">' +
                    '<label>URL de l\'image</label>' +
                    '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                    'value="' + escapeHtml(block.url || '') + '" placeholder="Lien Google Drive, lien direct..." ' +
                    'onchange="' + H + '._onImageUrlChange(\'' + block.id + '\')">' +
                    '</div>' +
                    '<div id="block-preview-' + block.id + '">' + preview + '</div>' +
                    '<div class="block-field">' +
                    '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                    '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                    'value="' + escapeHtml(block.legende || '') + '" placeholder="Ex: Carte de l\'*Empire romain*, IIe si\u00e8cle">' +
                    '</div>';
            }

            case 'video':
                return '<div class="block-field">' +
                    '<label>URL de la video</label>' +
                    '<input type="text" class="form-input block-input" id="block-url-' + block.id + '" ' +
                    'value="' + escapeHtml(block.url || '') + '" placeholder="Lien YouTube ou Google Drive...">' +
                    '</div>' +
                    '<div class="block-field">' +
                    '<label>L\u00e9gende <span class="optional">(optionnel \u2014 *texte* pour italique)</span></label>' +
                    '<input type="text" class="form-input block-input" id="block-legende-' + block.id + '" ' +
                    'value="' + escapeHtml(block.legende || '') + '" placeholder="Ex: Contexte historique de la *R\u00e9volution*">' +
                    '</div>';

            case 'tableau':
                // Délégué au module spécifique (admin-banques-exercices-blockeditor.js)
                if (typeof this._renderBlockTableau === 'function') return this._renderBlockTableau(block);
                return '<p>Type tableau non disponible dans ce contexte.</p>';

            case 'question':
                if (typeof this._renderBlockQuestion === 'function') return this._renderBlockQuestion(block);
                return '<p>Type question non disponible dans ce contexte.</p>';

            default:
                return '<p>Type de bloc inconnu: ' + block.type + '</p>';
            }
        },

        _renderGroup: function(group) {
            var ratio = group.ratio || '50-50';
            var ratioOptions = [
                { value: '50-50', label: '50 / 50' },
                { value: '40-60', label: '40 / 60' },
                { value: '60-40', label: '60 / 40' },
                { value: '33-67', label: '33 / 67' },
                { value: '67-33', label: '67 / 33' }
            ];
            var ratioSelect = '<select class="block-ratio-select" onchange="' + H + '._setGroupRatio(\'' + group.id + '\', this.value)">';
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
            html += '<button type="button" class="block-degroup-btn" onclick="' + H + '._degroupBlock(\'' + group.id + '\')" title="D\u00e9grouper">';
            html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            html += '</button>';
            html += '</div>';

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

        _initBlockEditors: function() {
            var self = this;
            function initBlock(block) {
                if (block.type === 'text') self._initSingleBlockEditor(block);
                if (block.type === 'tableau' && typeof self._initBlockTableauListeners === 'function') {
                    self._initBlockTableauListeners(block);
                }
                if (block.type === 'group' && block.children) block.children.forEach(initBlock);
            }
            this._blocks.forEach(initBlock);
        },

        _initSingleBlockEditor: function(block) {
            var containerId = 'block-editor-ctn-' + block.id;
            var editorId = 'block-editor-' + block.id;
            this.createRichTextEditor(containerId, editorId, {
                placeholder: 'Saisissez le texte...',
                media: false,
                headings: false
            });
            var editor = document.getElementById(editorId);
            if (editor && block.content) editor.innerHTML = block.content;
        },

        // ========== SAUVEGARDE ÉTAT DES ÉDITEURS ==========

        _saveEditorsState: function() {
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
                } else if (block.type === 'tableau' && typeof self._saveBlockTableauState === 'function') {
                    self._saveBlockTableauState(block);
                } else if (block.type === 'question' && typeof self._saveBlockQuestionState === 'function') {
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

        _onImageUrlChange: function(blockId) {
            var input = document.getElementById('block-url-' + blockId);
            var previewContainer = document.getElementById('block-preview-' + blockId);
            if (!input || !previewContainer) return;
            var url = input.value.trim();
            if (url) {
                var imgSrc = this._convertToDirectImageUrl(url);
                previewContainer.innerHTML = '<div class="block-image-preview"><img src="' + escapeHtml(imgSrc) + '" alt="Apercu"></div>';
            } else {
                previewContainer.innerHTML = '';
            }
        },

        _convertToDirectImageUrl: function(url) {
            var driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch) return 'https://lh3.googleusercontent.com/d/' + driveMatch[1];
            var driveIdMatch = url.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/);
            if (driveIdMatch) return 'https://lh3.googleusercontent.com/d/' + driveIdMatch[1];
            return url;
        },

        // ========== DRAG & DROP ==========

        _initBlockDragDrop: function() {
            var container = document.getElementById(this._blockEditorContainerId);
            if (!container) return;

            var self = this;

            container.querySelectorAll('.block-item[draggable="true"]').forEach(function(el) {
                el.addEventListener('dragstart', function(e) {
                    self._saveEditorsState();
                    var blockId = el.dataset.blockId;
                    self._dragBlockId = blockId;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', blockId);
                    el.classList.add('block-dragging');
                    setTimeout(function() { container.classList.add('block-editor-dragging'); }, 0);
                });
                el.addEventListener('dragend', function() {
                    el.classList.remove('block-dragging');
                    container.classList.remove('block-editor-dragging');
                    self._dragBlockId = null;
                    container.querySelectorAll('.block-dropzone-active, .block-drop-left, .block-drop-right').forEach(function(z) {
                        z.classList.remove('block-dropzone-active', 'block-drop-left', 'block-drop-right');
                    });
                });
            });

            container.querySelectorAll('.block-dropzone').forEach(function(zone) {
                zone.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    zone.classList.add('block-dropzone-active');
                });
                zone.addEventListener('dragleave', function() { zone.classList.remove('block-dropzone-active'); });
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

            container.querySelectorAll('.block-item[draggable="true"]').forEach(function(targetEl) {
                var targetId = targetEl.dataset.blockId;
                targetEl.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (targetId === self._dragBlockId) return;
                    var targetBlock = self._findBlock(targetId);
                    if (!targetBlock) return;
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
                    var rect = targetEl.getBoundingClientRect();
                    var midX = rect.left + rect.width / 2;
                    var dropLeft = e.clientX < midX;
                    self._groupBlocks(dragId, targetId, dropLeft);
                });
            });
        },

        // ========== OPÉRATIONS SUR LES BLOCS ==========

        _findBlock: function(blockId) {
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

        _getBlockById: function(blockId) {
            return this._findBlock(blockId);
        },

        _extractBlock: function(blockId) {
            var block = null;
            for (var i = 0; i < this._blocks.length; i++) {
                if (this._blocks[i].id === blockId) {
                    block = this._blocks.splice(i, 1)[0];
                    break;
                }
                if (this._blocks[i].type === 'group' && this._blocks[i].children) {
                    for (var j = 0; j < this._blocks[i].children.length; j++) {
                        if (this._blocks[i].children[j].id === blockId) {
                            block = this._blocks[i].children.splice(j, 1)[0];
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

        _moveBlockToIndex: function(blockId, targetIndex) {
            var block = this._extractBlock(blockId);
            if (!block) return;
            if (targetIndex > this._blocks.length) targetIndex = this._blocks.length;
            this._blocks.splice(targetIndex, 0, block);
            this._renderBlocks();
        },

        _groupBlocks: function(dragId, targetId, dropLeft) {
            var targetBlock = this._findBlock(targetId);
            if (!targetBlock || targetBlock.type === 'group') return;
            var dragBlock = this._findBlock(dragId);
            if (!dragBlock || dragBlock.type === 'group') return;
            var extracted = this._extractBlock(dragId);
            if (!extracted) return;

            var targetIndex = -1;
            for (var i = 0; i < this._blocks.length; i++) {
                if (this._blocks[i].id === targetId) {
                    targetIndex = i;
                    break;
                }
                if (this._blocks[i].type === 'group' && this._blocks[i].children) {
                    for (var j = 0; j < this._blocks[i].children.length; j++) {
                        if (this._blocks[i].children[j].id === targetId) {
                            if (this._blocks[i].children.length < 2) {
                                if (dropLeft) {
                                    this._blocks[i].children.splice(j, 0, extracted);
                                } else {
                                    this._blocks[i].children.splice(j + 1, 0, extracted);
                                }
                                this._renderBlocks();
                                return;
                            }
                            this._blocks.splice(i, 0, extracted);
                            this._renderBlocks();
                            return;
                        }
                    }
                }
            }

            if (targetIndex === -1) {
                this._blocks.push(extracted);
                this._renderBlocks();
                return;
            }

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

        _setGroupRatio: function(groupId, ratio) {
            this._saveEditorsState();
            var group = this._findBlock(groupId);
            if (group && group.type === 'group') {
                group.ratio = ratio;
                this._renderBlocks();
            }
        },

        _degroupBlock: function(groupId) {
            this._saveEditorsState();
            var idx = -1;
            for (var i = 0; i < this._blocks.length; i++) {
                if (this._blocks[i].id === groupId) { idx = i; break; }
            }
            if (idx === -1) return;
            var group = this._blocks[idx];
            if (!group || group.type !== 'group') return;
            var args = [idx, 1].concat(group.children || []);
            Array.prototype.splice.apply(this._blocks, args);
            this._renderBlocks();
        },

        // ========== FALLBACK MOBILE ==========

        moveBlockUp: function(blockId) {
            this._saveEditorsState();
            var idx = this._blocks.findIndex(function(b) { return b.id === blockId; });
            if (idx <= 0) return;
            var temp = this._blocks[idx];
            this._blocks[idx] = this._blocks[idx - 1];
            this._blocks[idx - 1] = temp;
            this._renderBlocks();
        },

        moveBlockDown: function(blockId) {
            this._saveEditorsState();
            var idx = this._blocks.findIndex(function(b) { return b.id === blockId; });
            if (idx === -1 || idx >= this._blocks.length - 1) return;
            var temp = this._blocks[idx];
            this._blocks[idx] = this._blocks[idx + 1];
            this._blocks[idx + 1] = temp;
            this._renderBlocks();
        },

        // ========== RÉTRO-COMPATIBILITÉ ==========

        convertLegacyToBlocks: function(tache) {
            var blocks = [];
            if (tache.document_contenu) {
                try {
                    var parsed = JSON.parse(tache.document_contenu);
                    if (Array.isArray(parsed)) return parsed;
                } catch (_e) {
                    blocks.push({ type: 'text', content: tache.document_contenu });
                }
            }
            if (tache.document_url && blocks.length === 0) {
                blocks.push({ type: 'document', url: tache.document_url, legende: tache.document_legende || '' });
            }
            if (blocks.length > 0 && blocks[0].type === 'text' && tache.document_legende) {
                blocks[0].content += '<p><em>' + escapeHtml(tache.document_legende) + '</em></p>';
            }
            return blocks;
        },

        // ========== ÉDITEUR RICHE PARTAGÉ ==========

        createRichTextEditor: function(containerId, editorId, options) {
            var container = document.getElementById(containerId);
            if (!container) return;

            var opts = Object.assign({ placeholder: '', media: true, headings: false }, options);
            var colorId = editorId + 'Color';

            var toolbarHtml = '<div class="rt-toolbar">';

            // Formatage texte
            toolbarHtml += '<div class="rt-group">';
            toolbarHtml += '<button type="button" class="rt-btn" data-cmd="bold" title="Gras"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>';
            toolbarHtml += '<button type="button" class="rt-btn" data-cmd="italic" title="Italique"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>';
            toolbarHtml += '<button type="button" class="rt-btn" data-cmd="underline" title="Souligné"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg></button>';
            toolbarHtml += '</div>';

            // Titres (optionnel)
            if (opts.headings) {
                toolbarHtml += '<div class="rt-group">';
                toolbarHtml += '<button type="button" class="rt-btn" data-heading="h2" title="Titre">H2</button>';
                toolbarHtml += '<button type="button" class="rt-btn" data-heading="h3" title="Sous-titre">H3</button>';
                toolbarHtml += '<button type="button" class="rt-btn" data-heading="p" title="Paragraphe">P</button>';
                toolbarHtml += '</div>';
            }

            // Listes
            toolbarHtml += '<div class="rt-group">';
            toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertUnorderedList" title="Liste à puces">\u2022</button>';
            toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertOrderedList" title="Liste numérotée">1.</button>';
            toolbarHtml += '</div>';

            // Couleur
            toolbarHtml += '<div class="rt-group">';
            toolbarHtml += '<input type="color" class="rt-color" id="' + colorId + '" value="#000000" title="Couleur du texte">';
            toolbarHtml += '</div>';

            // Médias (optionnel)
            if (opts.media) {
                toolbarHtml += '<div class="rt-group rt-group-media">';
                toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="image" title="Insérer une image"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</button>';
                toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="video" title="Insérer une vidéo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Vidéo</button>';
                toolbarHtml += '</div>';
            }

            toolbarHtml += '</div>';

            var editorHtml = '<div class="rt-editor" id="' + editorId + '" contenteditable="true"' +
                (opts.placeholder ? ' data-placeholder="' + opts.placeholder + '"' : '') + '></div>';

            container.innerHTML = toolbarHtml + editorHtml;

            var editor = document.getElementById(editorId);
            var toolbar = container.querySelector('.rt-toolbar');

            // Commandes de formatage
            toolbar.querySelectorAll('.rt-btn[data-cmd]').forEach(function(btn) {
                btn.onmousedown = function(e) { e.preventDefault(); };
                btn.onclick = function() {
                    editor.focus();
                    document.execCommand(btn.dataset.cmd, false, null);
                };
            });

            // Titres
            toolbar.querySelectorAll('.rt-btn[data-heading]').forEach(function(btn) {
                btn.onmousedown = function(e) { e.preventDefault(); };
                btn.onclick = function() {
                    editor.focus();
                    document.execCommand('formatBlock', false, '<' + btn.dataset.heading + '>');
                };
            });

            // Insertion média
            toolbar.querySelectorAll('.rt-btn[data-media]').forEach(function(btn) {
                btn.onmousedown = function(e) { e.preventDefault(); };
                btn.onclick = function() {
                    var type = btn.dataset.media;
                    var hint = type === 'image'
                        ? 'Collez le lien de l\'image :\n(Google Drive, lien direct...)'
                        : 'Collez le lien de la vid\u00e9o :\n(YouTube, Google Drive...)';
                    var mediaUrl = prompt(hint, '');
                    if (!mediaUrl || !mediaUrl.trim()) return;
                    var src = mediaUrl.trim();
                    var mediaHtml = '';
                    if (type === 'image') {
                        var driveMatch = src.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        var imgSrc = driveMatch ? 'https://drive.google.com/uc?export=view&id=' + driveMatch[1] : src;
                        mediaHtml = '<div class="rt-media-wrapper"><img src="' + imgSrc + '" alt="Image" style="max-width:100%"></div>';
                    } else {
                        var ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
                        if (ytMatch) {
                            mediaHtml = '<div class="rt-media-wrapper"><iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '" width="100%" height="315" frameborder="0" allowfullscreen></iframe></div>';
                        } else {
                            mediaHtml = '<div class="rt-media-wrapper"><a href="' + src + '" target="_blank">' + src + '</a></div>';
                        }
                    }
                    editor.focus();
                    document.execCommand('insertHTML', false, mediaHtml + '<p><br></p>');
                };
            });

            // Couleur
            var colorInput = document.getElementById(colorId);
            if (colorInput) {
                colorInput.oninput = function() {
                    editor.focus();
                    document.execCommand('foreColor', false, colorInput.value);
                };
            }
        },

        // ========== BARRE D'AJOUT DE BLOCS ==========

        renderBlockAddBar: function() {
            return '<div class="block-add-bar">' +
                '<span class="block-add-label">Ajouter</span>' +
                '<button type="button" class="block-add-btn" onclick="' + H + '.addBlock(\'text\')" title="Texte">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
                    ' Texte' +
                '</button>' +
                '<button type="button" class="block-add-btn" onclick="' + H + '.addBlock(\'document\')" title="Document Google">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                    ' Document' +
                '</button>' +
                '<button type="button" class="block-add-btn" onclick="' + H + '.addBlock(\'image\')" title="Image">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                    ' Image' +
                '</button>' +
                '<button type="button" class="block-add-btn" onclick="' + H + '.addBlock(\'video\')" title="Video">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
                    ' Vid\u00e9o' +
                '</button>' +
            '</div>';
        }
    };
}
