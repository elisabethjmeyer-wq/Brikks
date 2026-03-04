/**
 * Block Editor pour les entraînements de compétences et exercices SF document_mixte.
 * Extension de AdminBanquesExercices via le mixin partagé createBlockEditorMixin().
 *
 * Le mixin fournit : text, document, image, video, group.
 * Ce fichier ajoute : tableau, question (spécifiques aux banques d'exercices).
 */

// Monter le mixin partagé (text, document, image, video, group, drag & drop, rich text editor)
Object.assign(AdminBanquesExercices, createBlockEditorMixin('AdminBanquesExercices'));

// Ajouter les types de blocs spécifiques (tableau, question) + override _createBlock
Object.assign(AdminBanquesExercices, {

    // Override _createBlock pour ajouter tableau et question
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
        case 'tableau':
            return {
                id: id, type: 'tableau',
                colonnes: ['', ''],
                lignes: [
                    { header: true },
                    { cells: [
                        { valeur: '', type: 'donnee', correction: 'souple', alternatives: [] },
                        { valeur: '', type: 'reponse', correction: 'souple', alternatives: [] }
                    ]}
                ]
            };
        case 'question':
            return { id: id, type: 'question', question: '', reponse: '', correction: 'souple', alternatives: [] };
        default:
            return { id: id, type: 'text', content: '' };
        }
    },

    // ========== BLOC TABLEAU (mini table-builder intégré) ==========

    /** Rend le contenu d'un bloc tableau */
    _renderBlockTableau: function(block) {
        var bid = block.id;
        var cols = block.colonnes || [];
        var rows = block.lignes || [];

        var hasHeader = rows.some(function(r) { return r.header; });

        var tbodyHtml = '';
        for (var ri = 0; ri < rows.length; ri++) {
            // Flèches de déplacement (communes à tous les types de lignes)
            var moveButtons = '<span class="tb-row-move">' +
                (ri > 0 ? '<button type="button" class="tb-move-btn" onclick="AdminBanquesExercices._blockTableMoveRow(\'' + bid + '\',' + ri + ',-1)" title="Monter">\u25B2</button>' : '') +
                (ri < rows.length - 1 ? '<button type="button" class="tb-move-btn" onclick="AdminBanquesExercices._blockTableMoveRow(\'' + bid + '\',' + ri + ',1)" title="Descendre">\u25BC</button>' : '') +
                '</span>';

            // Ligne d'en-tête (colonnes) — toujours en position 0, pas de déplacement
            if (rows[ri].header) {
                tbodyHtml += '<tr data-row="' + ri + '" class="tb-header-row">';
                for (var ci = 0; ci < cols.length; ci++) {
                    tbodyHtml += '<td class="tb-header-cell">' +
                        '<input type="text" class="tb-col-title" value="' + escapeHtml(cols[ci] || '') + '" ' +
                        'placeholder="Colonne ' + (ci + 1) + '" data-col="' + ci + '" data-block="' + bid + '">' +
                        (cols.length > 1
                            ? '<button type="button" class="tb-col-remove" onclick="AdminBanquesExercices._blockTableRemoveCol(\'' + bid + '\',' + ci + ')">&times;</button>'
                            : '') +
                        '</td>';
                }
                tbodyHtml += '<td class="tb-actions-col">' +
                    '<button type="button" class="tb-add-col" onclick="AdminBanquesExercices._blockTableAddCol(\'' + bid + '\')" title="Ajouter une colonne">+</button>' +
                    (rows.length > 1
                        ? '<button type="button" class="tb-header-remove" onclick="AdminBanquesExercices._blockTableRemoveRow(\'' + bid + '\',' + ri + ')" title="Supprimer l\'en-t\u00eate">&times;</button>'
                        : '') +
                    '</td></tr>';
                continue;
            }

            // Ligne section (titre violet)
            if (rows[ri].section) {
                tbodyHtml += '<tr data-row="' + ri + '" class="tb-section-row">' +
                    '<td colspan="' + (cols.length + 1) + '" class="tb-section-cell">' +
                    moveButtons +
                    '<input type="text" class="tb-section-input" data-row="' + ri + '" data-block="' + bid + '" ' +
                    'value="' + escapeHtml(rows[ri].text || '') + '" placeholder="Titre de la section\u2026">' +
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
                    (cj === 0 ? moveButtons : '') +
                    '<button type="button" class="tb-cell-badge ' + (isDonnee ? 'tb-badge-donnee' : 'tb-badge-reponse') + '" ' +
                    'onclick="AdminBanquesExercices._blockTableSelectCell(\'' + bid + '\',' + ri + ',' + cj + ')">' + typeLabel + '</button>' +
                    '<input type="text" class="tb-cell-input" data-row="' + ri + '" data-col="' + cj + '" data-block="' + bid + '" ' +
                    'value="' + escapeHtml(cell.valeur || '') + '" placeholder="' + (isDonnee ? 'Donn\u00e9e...' : 'R\u00e9ponse...') + '">' +
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
            '<tbody>' + tbodyHtml + '</tbody>' +
            '</table></div>' +
            '<div class="tb-add-buttons">' +
            (!hasHeader
                ? '<button type="button" class="btn btn-secondary btn-sm tb-add-header-btn" onclick="AdminBanquesExercices._blockTableAddHeader(\'' + bid + '\')">+ En-t\u00eate</button>'
                : '') +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices._blockTableAddRow(\'' + bid + '\')">+ Ligne</button>' +
            '<button type="button" class="btn btn-secondary btn-sm tb-add-section-btn" onclick="AdminBanquesExercices._blockTableAddSection(\'' + bid + '\')">+ Section</button>' +
            '</div></div>';
    },

    /** Sauve l'état DOM d'un bloc tableau */
    _saveBlockTableauState: function(block) {
        var table = document.getElementById('blockTable-' + block.id);
        if (!table) return;
        var trs = table.querySelectorAll('tbody tr[data-row]');
        trs.forEach(function(tr) {
            var ri = parseInt(tr.dataset.row);
            if (isNaN(ri) || ri >= block.lignes.length) return;
            if (block.lignes[ri].header) {
                var headerInputs = tr.querySelectorAll('.tb-col-title');
                headerInputs.forEach(function(input, i) {
                    if (i < block.colonnes.length) block.colonnes[i] = input.value || '';
                });
                return;
            }
            if (block.lignes[ri].section) {
                var secInput = tr.querySelector('.tb-section-input');
                if (secInput) block.lignes[ri].text = secInput.value || '';
                return;
            }
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
    _initBlockTableauListeners: function(_block) {
        // Rien de spécial (tout est en onclick inline)
    },

    // --- Actions tableau intégré ---

    _blockTableAddCol: function(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        block.colonnes.push('');
        block.lignes.forEach(function(ligne) {
            if (ligne.section || ligne.header) return;
            ligne.cells.push({ valeur: '', type: 'reponse', correction: 'souple', alternatives: [] });
        });
        this._renderBlocks();
    },

    _blockTableRemoveCol: function(blockId, colIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        if (block.colonnes.length <= 1) return;
        block.colonnes.splice(colIndex, 1);
        block.lignes.forEach(function(ligne) {
            if (ligne.section || ligne.header) return;
            ligne.cells.splice(colIndex, 1);
        });
        this._renderBlocks();
    },

    _blockTableAddRow: function(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        var newRow = { cells: block.colonnes.map(function() {
            return { valeur: '', type: 'reponse', correction: 'souple', alternatives: [] };
        })};
        block.lignes.push(newRow);
        this._renderBlocks();
    },

    _blockTableRemoveRow: function(blockId, rowIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        if (block.lignes.length <= 1) return;
        block.lignes.splice(rowIndex, 1);
        this._renderBlocks();
    },

    _blockTableAddSection: function(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        block.lignes.push({ section: true, text: '' });
        this._renderBlocks();
    },

    _blockTableAddHeader: function(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        if (block.lignes.some(function(r) { return r.header; })) return;
        block.lignes.unshift({ header: true });
        this._renderBlocks();
    },

    _blockTableMoveRow: function(blockId, rowIndex, direction) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        var newIndex = rowIndex + direction;
        if (newIndex < 0 || newIndex >= block.lignes.length) return;
        var row = block.lignes[rowIndex];
        var target = block.lignes[newIndex];
        if (row.header && direction > 0) return;
        if (target.header && direction < 0) return;
        block.lignes[rowIndex] = target;
        block.lignes[newIndex] = row;
        this._renderBlocks();
    },

    _blockTableSelectCell: function(blockId, rowIndex, colIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'tableau') return;
        var cell = block.lignes[rowIndex] && block.lignes[rowIndex].cells[colIndex];
        if (!cell) return;

        this._closeCellPopover();

        var colName = block.colonnes[colIndex] || 'Colonne ' + (colIndex + 1);
        var isDonnee = cell.type === 'donnee';
        var bid = blockId;

        var popoverHTML = '<div class="tb-popover" id="tbCellPopover">' +
            '<div class="tb-popover-header">' +
            '<span class="tb-popover-title">L' + (rowIndex + 1) + ' &times; ' + escapeHtml(colName) + '</span>' +
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
                    '<input type="text" class="tb-popover-alt-input" value="' + escapeHtml(alts[ai]) + '" ' +
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

    _closeBlockTablePopover: function() {
        var wrapper = document.getElementById('tbPopoverWrapper');
        if (wrapper) wrapper.remove();
        if (this._blockTablePopoverHandler) {
            document.removeEventListener('click', this._blockTablePopoverHandler);
            this._blockTablePopoverHandler = null;
        }
    },

    _blockTableSetCellType: function(blockId, row, col, type) {
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

    _blockTableSetCorrection: function(blockId, row, col, mode) {
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].correction = mode;
        var hint = document.querySelector('.tb-popover-hint');
        if (hint) hint.textContent = mode === 'souple' ? 'Tol\u00e8re accents, majuscules, ponctuation' : 'La r\u00e9ponse doit \u00eatre exacte';
    },

    _blockTableAddAlt: function(blockId, row, col) {
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

    _blockTableRemoveAlt: function(blockId, row, col, altIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].alternatives.splice(altIndex, 1);
        this._renderBlocks();
        this._blockTableSelectCell(blockId, row, col);
    },

    _blockTableUpdateAlt: function(blockId, row, col, altIndex, value) {
        var block = this._getBlockById(blockId);
        if (!block) return;
        block.lignes[row].cells[col].alternatives[altIndex] = value;
    },

    // ========== BLOC QUESTION (mini question ouverte intégrée) ==========

    /** Rend le contenu d'un bloc question */
    _renderBlockQuestion: function(block) {
        var bid = block.id;
        var isSouple = block.correction !== 'stricte';
        var alts = block.alternatives || [];

        var altsHtml = '';
        for (var i = 0; i < alts.length; i++) {
            altsHtml += '<div class="block-q-alt-row">' +
                '<input type="text" class="form-input block-q-alt-input" data-block="' + bid + '" data-alt="' + i + '" ' +
                'value="' + escapeHtml(alts[i] || '') + '" placeholder="Alternative ' + (i + 1) + '...">' +
                '<button type="button" class="btn-icon danger" onclick="AdminBanquesExercices._blockQuestionRemoveAlt(\'' + bid + '\',' + i + ')">&times;</button>' +
                '</div>';
        }

        return '<div class="block-question-builder">' +
            '<div class="block-field">' +
                '<label>Question</label>' +
                '<input type="text" class="form-input block-input" id="block-q-question-' + bid + '" ' +
                'value="' + escapeHtml(block.question || '') + '" placeholder="Ex : Quel est le nom du trait\u00e9 sign\u00e9 en 1919 ?">' +
            '</div>' +
            '<div class="block-field">' +
                '<label>R\u00e9ponse attendue</label>' +
                '<input type="text" class="form-input block-input" id="block-q-reponse-' + bid + '" ' +
                'value="' + escapeHtml(block.reponse || '') + '" placeholder="Ex : Le trait\u00e9 de Versailles">' +
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
    _saveBlockQuestionState: function(block) {
        var qInput = document.getElementById('block-q-question-' + block.id);
        if (qInput) block.question = qInput.value.trim();
        var rInput = document.getElementById('block-q-reponse-' + block.id);
        if (rInput) block.reponse = rInput.value.trim();
        var cSelect = document.getElementById('block-q-correction-' + block.id);
        if (cSelect) block.correction = cSelect.value;
        var altsContainer = document.getElementById('block-q-alts-' + block.id);
        if (altsContainer) {
            var altInputs = altsContainer.querySelectorAll('.block-q-alt-input');
            block.alternatives = Array.from(altInputs).map(function(inp) { return inp.value; });
        }
    },

    _blockQuestionAddAlt: function(blockId) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'question') return;
        if (!block.alternatives) block.alternatives = [];
        block.alternatives.push('');
        this._renderBlocks();
        setTimeout(function() {
            var container = document.getElementById('block-q-alts-' + blockId);
            if (container) {
                var inputs = container.querySelectorAll('.block-q-alt-input');
                if (inputs.length > 0) inputs[inputs.length - 1].focus();
            }
        }, 50);
    },

    _blockQuestionRemoveAlt: function(blockId, altIndex) {
        this._saveEditorsState();
        var block = this._getBlockById(blockId);
        if (!block || block.type !== 'question') return;
        block.alternatives.splice(altIndex, 1);
        this._renderBlocks();
    }
});
