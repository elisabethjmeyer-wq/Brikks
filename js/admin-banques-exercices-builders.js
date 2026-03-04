Object.assign(AdminBanquesExercices, {
    // ========== TABLE BUILDER (v2 — cellule par cellule) ==========

    /**
     * Modèle de données v2 :
     *   tableBuilder.columns = ["Date", "Événement", "Siècle"]   (titres uniquement)
     *   tableBuilder.rows = [
     *     [ {valeur, type, correction?, alternatives?}, ... ],   (1 objet par cellule)
     *   ]
     * type = "donnee" | "reponse"
     * correction = "souple" | "stricte"  (uniquement si type="reponse")
     * alternatives = ["alt1", "alt2"]    (uniquement si type="reponse")
     */

    initTableBuilder() {
        this.tableBuilder = {
            columns: ['Date', 'Événement'],
            rows: [
                [
                    { valeur: '', type: 'donnee' },
                    { valeur: '', type: 'reponse', correction: 'souple', alternatives: [] }
                ]
            ]
        };
        this._selectedCell = null;
        this.renderTableBuilder();
    },

    /** Charge les données existantes dans le builder. Gère l'ancien et le nouveau format. */
    loadTableBuilderFromData(donnees) {
        if (!donnees) { this.initTableBuilder(); return; }

        // Nouveau format v2 : colonnes = tableau de strings, cells = objets
        if (donnees.colonnes && donnees.lignes && donnees.lignes[0]?.cells?.[0]?.type) {
            this.tableBuilder = {
                columns: donnees.colonnes.map(c => typeof c === 'string' ? c : c.titre || ''),
                rows: donnees.lignes.map(ligne => (ligne.cells || []).map(cell => ({
                    valeur: cell.valeur || '',
                    type: cell.type || 'donnee',
                    correction: cell.correction || 'souple',
                    alternatives: cell.alternatives || []
                })))
            };
        }
        // Ancien format v1 : colonnes = [{titre, editable}], cells = strings
        else if (donnees.colonnes && donnees.lignes) {
            const oldCols = donnees.colonnes;
            this.tableBuilder = {
                columns: oldCols.map(c => c.titre || ''),
                rows: donnees.lignes.map(ligne => {
                    const cells = ligne.cells || Object.values(ligne);
                    return oldCols.map((col, i) => {
                        const raw = cells[i] || '';
                        if (col.editable) {
                            const parts = String(raw).split('|');
                            return {
                                valeur: parts[0] || '',
                                type: 'reponse',
                                correction: 'souple',
                                alternatives: parts.slice(1).filter(a => a.trim())
                            };
                        }
                        return { valeur: raw, type: 'donnee' };
                    });
                })
            };
        }
        // Legacy format : lignes avec propriétés nommées
        else if (donnees.lignes && Array.isArray(donnees.lignes) && donnees.lignes.length > 0) {
            const firstRow = donnees.lignes[0];
            const keys = Object.keys(firstRow).filter(k => k !== 'cells');
            this.tableBuilder = {
                columns: keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)),
                rows: donnees.lignes.map(ligne => keys.map(k => ({
                    valeur: ligne[k] || '',
                    type: k === 'date' ? 'donnee' : 'reponse',
                    correction: 'souple',
                    alternatives: []
                })))
            };
        } else {
            this.initTableBuilder();
            return;
        }
        this._selectedCell = null;
        this.renderTableBuilder();
    },

    /** Construit les données pour la sauvegarde (nouveau format v2). */
    buildDataFromTableBuilder() {
        this.readTableBuilderValues();
        return {
            colonnes: this.tableBuilder.columns,
            lignes: this.tableBuilder.rows.map(row => ({
                cells: row.map(cell => {
                    const out = { valeur: cell.valeur, type: cell.type };
                    if (cell.type === 'reponse') {
                        out.correction = cell.correction || 'souple';
                        if (cell.alternatives && cell.alternatives.length > 0) {
                            out.alternatives = cell.alternatives;
                        }
                    }
                    return out;
                })
            }))
        };
    },

    /** Lit les valeurs actuelles depuis le DOM (en-têtes + cellules). */
    readTableBuilderValues() {
        // Lire les titres de colonnes
        const headerInputs = document.querySelectorAll('#tableBuilderHead .tb-col-title');
        if (headerInputs.length > 0) {
            headerInputs.forEach((input, i) => {
                if (i < this.tableBuilder.columns.length) {
                    this.tableBuilder.columns[i] = input.value || '';
                }
            });
        }

        // Lire les valeurs des cellules
        const tbody = document.getElementById('tableBuilderBody');
        if (!tbody) return;
        const rows = tbody.querySelectorAll('tr[data-row]');
        rows.forEach((tr, rowIndex) => {
            if (rowIndex >= this.tableBuilder.rows.length) return;
            const inputs = tr.querySelectorAll('.tb-cell-input');
            inputs.forEach(input => {
                const colIndex = parseInt(input.dataset.col);
                if (!isNaN(colIndex) && colIndex < this.tableBuilder.rows[rowIndex].length) {
                    this.tableBuilder.rows[rowIndex][colIndex].valeur = input.value || '';
                }
            });
        });
    },

    /** Rend la grille éditable dans le panneau gauche. */
    renderTableBuilder() {
        const thead = document.getElementById('tableBuilderHead');
        const tbody = document.getElementById('tableBuilderBody');
        if (!thead || !tbody) return;

        const cols = this.tableBuilder.columns;
        const rows = this.tableBuilder.rows;

        // En-têtes éditables
        thead.innerHTML = `<tr>
            ${cols.map((col, i) => `
                <th class="tb-header-cell">
                    <input type="text" class="tb-col-title" value="${escapeHtml(col)}"
                           placeholder="Colonne ${i + 1}" data-col="${i}"
                           oninput="AdminBanquesExercices.readTableBuilderValues()">
                    <button type="button" class="tb-col-remove" onclick="AdminBanquesExercices.removeColumn(${i})" title="Supprimer la colonne">&times;</button>
                </th>
            `).join('')}
            <th class="tb-actions-col">
                <button type="button" class="tb-add-col" onclick="AdminBanquesExercices.addColumn()" title="Ajouter une colonne">+</button>
            </th>
        </tr>`;

        // Lignes
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100" class="table-builder-empty">Aucune ligne. Cliquez sur "Ajouter une ligne".</td></tr>';
        } else {
            tbody.innerHTML = rows.map((row, ri) => `
                <tr data-row="${ri}">
                    ${row.map((cell, ci) => {
                        const isDonnee = cell.type === 'donnee';
                        const hasAlts = cell.alternatives && cell.alternatives.length > 0;
                        const isSouple = cell.correction === 'souple';
                        const isSelected = this._selectedCell && this._selectedCell.row === ri && this._selectedCell.col === ci;

                        // Badge type : bouton cliquable qui ouvre le popover
                        const typeLabel = isDonnee ? 'D' : 'R';
                        const typeTitle = isDonnee ? 'Donnée — cliquer pour configurer' : 'Réponse — cliquer pour configurer';

                        // Indicateurs supplémentaires pour les cellules réponse
                        let extraIndicators = '';
                        if (!isDonnee) {
                            if (hasAlts) extraIndicators += `<span class="tb-indicator tb-ind-alt" title="${cell.alternatives.length} alternative(s)">\u00B1${cell.alternatives.length}</span>`;
                            if (!isSouple) extraIndicators += '<span class="tb-indicator tb-ind-strict" title="Correction stricte">S</span>';
                        }

                        return `
                            <td class="tb-cell ${isDonnee ? 'tb-cell-donnee' : 'tb-cell-reponse'} ${isSelected ? 'tb-cell-selected' : ''}">
                                <div class="tb-cell-row">
                                    <button type="button" class="tb-cell-badge ${isDonnee ? 'tb-badge-donnee' : 'tb-badge-reponse'}"
                                            onclick="AdminBanquesExercices.selectCell(${ri}, ${ci})"
                                            title="${typeTitle}">${typeLabel}</button>
                                    <input type="text" class="tb-cell-input"
                                           data-row="${ri}" data-col="${ci}"
                                           value="${escapeHtml(cell.valeur)}"
                                           placeholder="${isDonnee ? 'Donnée...' : 'Réponse...'}"
                                           oninput="AdminBanquesExercices.readTableBuilderValues()">
                                    ${extraIndicators ? `<div class="tb-cell-indicators">${extraIndicators}</div>` : ''}
                                </div>
                            </td>`;
                    }).join('')}
                    <td class="tb-row-actions">
                        <button type="button" class="tb-row-remove" onclick="AdminBanquesExercices.removeRow(${ri})" title="Supprimer la ligne">&times;</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    // ========== TABS CONSTRUCTION / VUE ÉLÈVE ==========

    switchTableTab(tab) {
        const constructionPanel = document.getElementById('tbConstructionPanel');
        const previewPanel = document.getElementById('tbPreviewPanel');
        const tabConstruction = document.getElementById('tbTabConstruction');
        const tabPreview = document.getElementById('tbTabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this.readTableBuilderValues();
            this._renderTablePreview(previewPanel);
            constructionPanel.style.display = 'none';
            previewPanel.style.display = '';
            tabConstruction.classList.remove('active');
            tabPreview.classList.add('active');
        } else {
            constructionPanel.style.display = '';
            previewPanel.style.display = 'none';
            tabConstruction.classList.add('active');
            tabPreview.classList.remove('active');
        }
    },

    _renderTablePreview(container) {
        const cols = this.tableBuilder.columns;
        const rows = this.tableBuilder.rows;

        if (cols.length === 0 || rows.length === 0) {
            container.innerHTML = '<div class="tb-preview-empty">Ajoutez des colonnes et des lignes pour voir l\'aper\u00e7u</div>';
            return;
        }

        // Récupérer la consigne
        const consigneEl = document.getElementById('sfwConsigneStep3');
        const consigne = consigneEl ? consigneEl.value.trim() : '';

        let html = '';
        if (consigne) {
            html += `<p class="tb-pv-consigne">${escapeHtml(consigne)}</p>`;
        }

        html += '<table class="tb-preview-table"><thead><tr>';
        cols.forEach(c => { html += `<th>${escapeHtml(c) || '...'}</th>`; });
        html += '</tr></thead><tbody>';

        rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => {
                if (cell.type === 'donnee') {
                    html += `<td class="tb-pv-donnee">${escapeHtml(cell.valeur) || '\u2014'}</td>`;
                } else {
                    html += '<td class="tb-pv-reponse"><input type="text" disabled placeholder="..."></td>';
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // ========== SÉLECTION DE CELLULE + POPOVER ==========

    selectCell(rowIndex, colIndex) {
        this.readTableBuilderValues();
        this._selectedCell = { row: rowIndex, col: colIndex };
        this.renderTableBuilder();
        this._showCellPopover(rowIndex, colIndex);
    },

    _showCellPopover(rowIndex, colIndex) {
        this._closeCellPopover();

        const cell = this.tableBuilder.rows[rowIndex]?.[colIndex];
        if (!cell) return;

        const colName = this.tableBuilder.columns[colIndex] || 'Colonne ' + (colIndex + 1);
        const isDonnee = cell.type === 'donnee';

        // Construire le contenu du popover
        let popoverHTML = `
            <div class="tb-popover" id="tbCellPopover">
                <div class="tb-popover-header">
                    <span class="tb-popover-title">L${rowIndex + 1} &times; ${escapeHtml(colName)}</span>
                    <button type="button" class="tb-popover-close" onclick="AdminBanquesExercices._closeCellPopover()">&times;</button>
                </div>
                <div class="tb-popover-body">
                    <div class="tb-popover-field">
                        <label class="tb-popover-label">Type</label>
                        <div class="tb-popover-radio-group">
                            <label class="tb-popover-radio ${!isDonnee ? 'active' : ''}">
                                <input type="radio" name="tbCellType" value="reponse" ${!isDonnee ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setCellType(${rowIndex}, ${colIndex}, 'reponse')">
                                <span class="tb-radio-label tb-radio-reponse">Réponse</span>
                            </label>
                            <label class="tb-popover-radio ${isDonnee ? 'active' : ''}">
                                <input type="radio" name="tbCellType" value="donnee" ${isDonnee ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setCellType(${rowIndex}, ${colIndex}, 'donnee')">
                                <span class="tb-radio-label tb-radio-donnee">Donnée</span>
                            </label>
                        </div>
                    </div>`;

        if (!isDonnee) {
            const isSouple = cell.correction !== 'stricte';
            const alts = cell.alternatives || [];

            popoverHTML += `
                    <div class="tb-popover-field">
                        <label class="tb-popover-label">Correction</label>
                        <div class="tb-popover-radio-group">
                            <label class="tb-popover-radio ${isSouple ? 'active' : ''}">
                                <input type="radio" name="tbCellCorrection" value="souple" ${isSouple ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setCellCorrection(${rowIndex}, ${colIndex}, 'souple')">
                                <span class="tb-radio-label">Souple</span>
                            </label>
                            <label class="tb-popover-radio ${!isSouple ? 'active' : ''}">
                                <input type="radio" name="tbCellCorrection" value="stricte" ${!isSouple ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setCellCorrection(${rowIndex}, ${colIndex}, 'stricte')">
                                <span class="tb-radio-label">Stricte</span>
                            </label>
                        </div>
                        <div class="tb-popover-hint">${isSouple ? 'Tolère accents, majuscules, ponctuation' : 'La réponse doit être exacte'}</div>
                    </div>
                    <div class="tb-popover-field">
                        <label class="tb-popover-label">Alternatives acceptées</label>
                        <div class="tb-popover-alts" id="tbPopoverAlts">
                            ${alts.map((alt, i) => `
                                <div class="tb-popover-alt-item">
                                    <input type="text" class="tb-popover-alt-input" value="${escapeHtml(alt)}"
                                           placeholder="Alternative ${i + 1}" data-alt-index="${i}"
                                           onchange="AdminBanquesExercices._updateAlt(${rowIndex}, ${colIndex}, ${i}, this.value)">
                                    <button type="button" class="tb-popover-alt-remove"
                                            onclick="AdminBanquesExercices._removeAlt(${rowIndex}, ${colIndex}, ${i})">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="tb-popover-add-alt"
                                onclick="AdminBanquesExercices._addAlt(${rowIndex}, ${colIndex})">+ Ajouter une alternative</button>
                    </div>`;
        }

        popoverHTML += `
                </div>
            </div>`;

        // Positionner le popover à côté du badge cliqué
        const clickedBadge = document.querySelector(`.tb-cell-badge[onclick*="selectCell(${rowIndex}, ${colIndex})"]`);
        const clickedTd = clickedBadge ? clickedBadge.closest('td') : null;
        if (!clickedTd) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'tbPopoverWrapper';
        wrapper.innerHTML = popoverHTML;
        document.body.appendChild(wrapper);

        // Positionner
        const rect = clickedTd.getBoundingClientRect();
        const popover = document.getElementById('tbCellPopover');
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Essayer à droite de la cellule, sinon à gauche
        let left = rect.right + 8 + scrollLeft;
        if (left + 280 > window.innerWidth) {
            left = rect.left - 288 + scrollLeft;
        }
        let top = rect.top + scrollTop;
        // Vérifier que le popover ne dépasse pas en bas
        if (top + 350 > window.innerHeight + scrollTop) {
            top = window.innerHeight + scrollTop - 360;
        }

        popover.style.position = 'absolute';
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';

        // Fermer au clic en dehors
        setTimeout(() => {
            this._popoverOutsideHandler = (e) => {
                const pop = document.getElementById('tbCellPopover');
                if (pop && !pop.contains(e.target) && !e.target.closest('.tb-cell-badge')) {
                    this._closeCellPopover();
                }
            };
            document.addEventListener('click', this._popoverOutsideHandler);
        }, 50);
    },

    _closeCellPopover() {
        const wrapper = document.getElementById('tbPopoverWrapper');
        if (wrapper) wrapper.remove();
        if (this._popoverOutsideHandler) {
            document.removeEventListener('click', this._popoverOutsideHandler);
            this._popoverOutsideHandler = null;
        }
        this._selectedCell = null;
        this.renderTableBuilder();
    },

    // ========== ACTIONS POPOVER ==========

    _setCellType(row, col, type) {
        this.readTableBuilderValues();
        const cell = this.tableBuilder.rows[row][col];
        cell.type = type;
        if (type === 'reponse' && !cell.correction) {
            cell.correction = 'souple';
            cell.alternatives = cell.alternatives || [];
        }
        // Re-afficher le popover avec le nouveau contenu
        this._selectedCell = { row, col };
        this.renderTableBuilder();

        this._showCellPopover(row, col);
    },

    _setCellCorrection(row, col, mode) {
        this.tableBuilder.rows[row][col].correction = mode;
        // Mettre à jour le hint sans tout re-render
        const hint = document.querySelector('.tb-popover-hint');
        if (hint) {
            hint.textContent = mode === 'souple' ? 'Tolère accents, majuscules, ponctuation' : 'La réponse doit être exacte';
        }
        this.renderTableBuilder();
    },

    _addAlt(row, col) {
        const cell = this.tableBuilder.rows[row][col];
        if (!cell.alternatives) cell.alternatives = [];
        cell.alternatives.push('');
        this._selectedCell = { row, col };
        this._showCellPopover(row, col);
        // Focus le nouveau champ
        setTimeout(() => {
            const inputs = document.querySelectorAll('.tb-popover-alt-input');
            if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }, 50);
    },

    _removeAlt(row, col, altIndex) {
        this.tableBuilder.rows[row][col].alternatives.splice(altIndex, 1);
        this._selectedCell = { row, col };
        this.renderTableBuilder();
        this._showCellPopover(row, col);
    },

    _updateAlt(row, col, altIndex, value) {
        this.tableBuilder.rows[row][col].alternatives[altIndex] = value;
        this.renderTableBuilder();
    },

    // ========== COLONNES & LIGNES ==========

    addColumn() {
        this.readTableBuilderValues();
        this.tableBuilder.columns.push('');
        this.tableBuilder.rows.forEach(row => {
            row.push({ valeur: '', type: 'reponse', correction: 'souple', alternatives: [] });
        });
        this.renderTableBuilder();

    },

    removeColumn(index) {
        if (this.tableBuilder.columns.length <= 1) {
            this.showNotification('Il faut au moins une colonne', 'warning');
            return;
        }
        this.readTableBuilderValues();
        this._closeCellPopover();
        this.tableBuilder.columns.splice(index, 1);
        this.tableBuilder.rows.forEach(row => row.splice(index, 1));
        this.renderTableBuilder();

    },

    addRow() {
        this.readTableBuilderValues();
        const newRow = this.tableBuilder.columns.map(() => ({
            valeur: '', type: 'reponse', correction: 'souple', alternatives: []
        }));
        this.tableBuilder.rows.push(newRow);
        this.renderTableBuilder();

    },

    removeRow(index) {
        if (this.tableBuilder.rows.length <= 1) {
            this.showNotification('Il faut au moins une ligne', 'warning');
            return;
        }
        this.readTableBuilderValues();
        this._closeCellPopover();
        this.tableBuilder.rows.splice(index, 1);
        this.renderTableBuilder();

    },

    previewExercice() {
        const consigne = document.getElementById('exerciceConsigne').value;
        const titre = document.getElementById('exerciceTitre').value || 'Exercice';
        const formatUI = this.currentFormatUI || 'tableau_saisie';

        let contentHTML = '';
        let extraStyles = '';

        if (formatUI === 'carte_cliquable') {
            const donnees = this.buildDataFromCarteBuilder();
            const colorMap = { bleu: '#6366f1', rouge: '#ef4444', vert: '#10b981', orange: '#f59e0b', violet: '#8b5cf6', noir: '#374151' };
            extraStyles = `
                .carte-container { position: relative; display: inline-block; max-width: 100%; }
                .carte-image { max-width: 100%; height: auto; display: block; border-radius: 8px; }
                .carte-marker { position: absolute; width: 32px; height: 32px; color: white;
                    border: 3px solid white; display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 14px; transform: translate(-50%, -50%); cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
                .carte-marker.shape-cercle { border-radius: 50%; }
                .carte-marker.shape-losange { border-radius: 4px; transform: translate(-50%, -50%) rotate(45deg); }
                .carte-marker.shape-losange span { transform: rotate(-45deg); }
                .carte-marker.shape-carre { border-radius: 4px; }
                .carte-marker.shape-pin { border-radius: 50% 50% 50% 0; transform: translate(-50%, -50%) rotate(-45deg); }
                .carte-marker.shape-pin span { transform: rotate(45deg); }
                .carte-marker .badge { position: absolute; top: -8px; left: 100%; margin-left: 4px; background: white;
                    color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
                .preview-note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 1rem;
                    font-size: 0.875rem; color: #92400e; }
            `;
            const imageUrl = this.convertToDirectImageUrl(donnees.image_url);
            contentHTML = `
                <div class="carte-container">
                    <img src="${escapeHtml(imageUrl)}" class="carte-image" alt="Carte" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display:none; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;">
                        Impossible de charger l'image. Vérifiez le lien.
                    </div>
                    ${donnees.marqueurs.map((m, i) => {
                        const bg = colorMap[m.color] || colorMap.bleu;
                        const shape = m.shape || 'cercle';
                        return `<div class="carte-marker shape-${shape}" style="left: ${m.x}%; top: ${m.y}%; background: ${bg};">
                            <span>${i + 1}</span>
                            <span class="badge">${escapeHtml((m.reponse || '').split('|')[0])}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div class="preview-note">
                    <strong>Aperçu admin :</strong> Les élèves cliqueront sur les marqueurs pour saisir leur réponse.
                    ${donnees.marqueurs.length} marqueur(s) configuré(s).
                </div>
            `;
        } else if (formatUI === 'question_ouverte') {
            const donnees = this.buildDataFromQuestionBuilder();
            extraStyles = `
                .qo-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .qo-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .qo-document img { max-width: 100%; height: auto; }
                .qo-questions { display: flex; flex-direction: column; gap: 1rem; }
                .qo-question { background: #fafafa; padding: 1rem; border-radius: 8px; }
                .qo-question-text { font-weight: 500; margin-bottom: 0.5rem; }
                .qo-textarea { width: 100%; min-height: 80px; padding: 10px; border: 2px solid #dbeafe; border-radius: 6px; resize: vertical; }
            `;
            const docImgUrl = this.convertToDirectImageUrl(donnees.document.contenu);
            const docContent = donnees.document.type === 'image'
                ? `<img src="${escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${escapeHtml(donnees.document.contenu)}</p>`;
            contentHTML = `
                <div class="qo-layout">
                    <div class="qo-document">${docContent}</div>
                    <div class="qo-questions">
                        ${donnees.questions.map((q, i) => `
                            <div class="qo-question">
                                <div class="qo-question-text">${i + 1}. ${escapeHtml(q.question)}</div>
                                <textarea class="qo-textarea" placeholder="Votre réponse..."></textarea>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_tableau') {
            // Document + Table format (v2)
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            const docType = document.getElementById('docTypeTableau').value;
            const docContenu = document.getElementById('docContenuTableau').value;
            const docImgUrl = this.convertToDirectImageUrl(docContenu);
            extraStyles = `
                .dt-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .dt-document { background: #f8f9ff; padding: 1rem; border-radius: 8px; border-left: 4px solid #667eea; }
                .dt-document img { max-width: 100%; height: auto; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            const docContent = docType === 'image'
                ? `<img src="${escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${escapeHtml(docContenu)}</p>`;
            contentHTML = `
                <div class="dt-layout">
                    <div class="dt-document">${docContent}</div>
                    <div class="dt-table">
                        ${this._buildPreviewTableHTML(donnees)}
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_mixte') {
            // Document Mixte format — block editor v3
            const donnees = this._buildMixteBlockData();
            const blocks = donnees.blocks || [];

            extraStyles = `
                .blocks-container { display: flex; flex-direction: column; gap: 1rem; }
                .blocks-container p { margin: 0.25rem 0; }
                .blocks-container img { max-width: 100%; height: auto; border-radius: 8px; }
                .blocks-container iframe { width: 100%; min-height: 300px; border: none; border-radius: 8px; }
                .block-legende { font-size: 0.9rem; color: #666; padding: 4px 0; font-style: italic; }
                .block-titre { font-weight: 600; padding: 4px 0; }
                .blocks-group { display: flex; gap: 1rem; }
                .blocks-group-child { min-width: 0; }
                table { width: 100%; border-collapse: collapse; }
                th { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 10px 14px; font-weight: 600; text-align: left; }
                td { padding: 8px 14px; border-bottom: 1px solid #e5e7eb; }
                .cell-donnee { font-weight: 500; background: #f9fafb; }
                .cell-editable input { width: 100%; padding: 6px 10px; border: 2px solid #fbbf24; border-radius: 6px; }
            `;

            const self = this;
            function renderPreviewBlockPopup(block) {
                if (block.type === 'group') {
                    const ratio = block.ratio || '50-50';
                    const parts = ratio.split('-');
                    return `<div class="blocks-group">${(block.children || []).map((c, i) =>
                        `<div class="blocks-group-child" style="flex:${parseInt(parts[i] || 50)}">${renderPreviewBlockPopup(c)}</div>`
                    ).join('')}</div>`;
                }
                let html = '';
                if (block.type === 'text') {
                    html += block.content || '';
                    if (block.legende) html += `<div class="block-legende">${block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
                } else if (block.type === 'document' || block.type === 'image') {
                    if (block.titre) html += `<div class="block-titre">${escapeHtml(block.titre)}</div>`;
                    if (block.url) {
                        const imgSrc = self._convertToDirectImageUrl(block.url);
                        html += `<img src="${escapeHtml(imgSrc)}" alt="">`;
                    }
                    if (block.legende) html += `<div class="block-legende">${block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
                } else if (block.type === 'video') {
                    if (block.url) {
                        const embedUrl = self._getPreviewEmbedUrl(block.url);
                        if (embedUrl) html += `<iframe src="${escapeHtml(embedUrl)}"></iframe>`;
                    }
                    if (block.legende) html += `<div class="block-legende">${block.legende.replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
                } else if (block.type === 'tableau') {
                    const cols = block.colonnes || [];
                    const rows = block.lignes || [];
                    html += `<table><thead><tr>${cols.map(c => `<th>${escapeHtml(c || '')}</th>`).join('')}</tr></thead><tbody>`;
                    rows.forEach(ligne => {
                        html += '<tr>';
                        (ligne.cells || []).forEach(cell => {
                            if (cell.type === 'donnee') {
                                html += `<td class="cell-donnee">${escapeHtml(cell.valeur || '')}</td>`;
                            } else {
                                html += '<td class="cell-editable"><input type="text" placeholder="..."></td>';
                            }
                        });
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                }
                return html;
            }

            contentHTML = `<div class="blocks-container">${blocks.map(renderPreviewBlockPopup).join('')}</div>`;
        } else {
            // Default: tableau_saisie (v2)
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            extraStyles = `
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            contentHTML = this._buildPreviewTableHTML(donnees);
        }

        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation - ${escapeHtml(titre)}</title>
                <style>
                    body { font-family: 'Inter', Arial, sans-serif; padding: 2rem; background: #f5f5f5; }
                    .preview-card { background: white; border-radius: 12px; max-width: 800px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    .preview-header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 1.5rem; border-radius: 12px 12px 0 0; }
                    .preview-header h1 { margin: 0; font-size: 1.3rem; }
                    .preview-consigne { background: #f8f9ff; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
                    .preview-content { padding: 1.5rem; }
                    ${extraStyles}
                </style>
            </head>
            <body>
                <div class="preview-card">
                    <div class="preview-header">
                        <h1>${escapeHtml(titre)}</h1>
                    </div>
                    ${consigne ? `<div class="preview-consigne">${escapeHtml(consigne)}</div>` : ''}
                    <div class="preview-content">
                        ${contentHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
    },

    /** Construit le HTML d'un tableau pour la prévisualisation (format v2). */
    _buildPreviewTableHTML(donnees) {
        const cols = donnees.colonnes || [];
        const rows = donnees.lignes || [];
        return `
            <table>
                <thead>
                    <tr>${cols.map(c => `<th>${escapeHtml(typeof c === 'string' ? c : c.titre || '')}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(ligne => `
                        <tr>
                            ${(ligne.cells || []).map(cell => {
                                if (typeof cell === 'object' && cell.type === 'reponse') {
                                    return '<td class="input-cell"><input type="text" placeholder="..."></td>';
                                } else if (typeof cell === 'object') {
                                    return `<td class="data-cell">${escapeHtml(cell.valeur || '')}</td>`;
                                }
                                // Fallback ancien format string
                                return `<td class="data-cell">${escapeHtml(cell || '')}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
    },

    // ========== FORMAT SWITCHING ==========
    onFormatChange(formatId) {
        // Compare as strings to handle type mismatch
        const format = this.formats.find(f => String(f.id) === String(formatId));
        let structure = format ? format.structure : null;

        // Handle double-stringified JSON from Google Sheets
        if (typeof structure === 'string') {
            try {
                structure = JSON.parse(structure);
                // Check if it's still a string (double-encoded)
                if (typeof structure === 'string') {
                    structure = JSON.parse(structure);
                }
            } catch (e) {
                structure = {};
            }
        }

        const typeUI = structure ? structure.type_ui : 'tableau_saisie';
        this.currentFormatUI = typeUI;

        // Hide all builders
        document.querySelectorAll('.format-builder').forEach(el => el.style.display = 'none');

        // Show appropriate builder
        if (typeUI === 'carte_cliquable') {
            document.getElementById('builderCarte').style.display = 'block';
            this.initCarteBuilder();
        } else if (typeUI === 'question_ouverte') {
            document.getElementById('builderQuestionOuverte').style.display = 'block';
            this.initQuestionBuilder();
        } else if (typeUI === 'document_tableau') {
            document.getElementById('builderTableau').style.display = 'block';
            const docSection = document.getElementById('documentSectionTableau');
            if (docSection) docSection.style.display = 'block';
            this.initTableBuilder();
        } else if (typeUI === 'document_mixte') {
            document.getElementById('builderDocumentMixte').style.display = 'block';
            this.initDocumentMixteBuilder();
        } else {
            // Default: tableau_saisie
            document.getElementById('builderTableau').style.display = 'block';
            this.initTableBuilder();
        }
    },

    // ========== CARTE CLIQUABLE BUILDER (v2 — popover + forme/couleur) ==========

    /** Constantes formes et couleurs disponibles pour les marqueurs */
    CARTE_SHAPES: [
        { id: 'cercle', label: 'Cercle', icon: '●' },
        { id: 'losange', label: 'Losange', icon: '◆' },
        { id: 'carre', label: 'Carré', icon: '■' },
        { id: 'pin', label: 'Épingle', icon: '📍' }
    ],

    CARTE_COLORS: [
        { id: 'bleu', hex: '#6366f1', label: 'Bleu' },
        { id: 'rouge', hex: '#ef4444', label: 'Rouge' },
        { id: 'vert', hex: '#10b981', label: 'Vert' },
        { id: 'orange', hex: '#f59e0b', label: 'Orange' },
        { id: 'violet', hex: '#8b5cf6', label: 'Violet' },
        { id: 'noir', hex: '#374151', label: 'Noir' }
    ],

    initCarteBuilder() {
        this.carteBuilder = { imageUrl: '', marqueurs: [] };
        this._selectedMarqueur = null;
        const urlInput = document.getElementById('carteImageUrl');
        if (urlInput) urlInput.value = '';
        const wrapper = document.getElementById('cartePreviewWrapper');
        if (wrapper) wrapper.style.display = 'none';
        const placeholder = document.getElementById('cartePreviewPlaceholder');
        if (placeholder) placeholder.style.display = 'block';
        this.renderCarteMarkers();
        this.switchCarteTab('construction');
    },

    loadCarteBuilderFromData(donnees) {
        this.carteBuilder = {
            imageUrl: donnees.image_url || '',
            marqueurs: (donnees.marqueurs || []).map(m => ({
                x: m.x,
                y: m.y,
                reponse: m.reponse || '',
                correction: m.correction || 'souple',
                shape: m.shape || 'cercle',
                color: m.color || 'bleu'
            }))
        };
        this._selectedMarqueur = null;
        const urlInput = document.getElementById('carteImageUrl');
        if (urlInput) urlInput.value = this.carteBuilder.imageUrl;
        if (this.carteBuilder.imageUrl) {
            this.updateCartePreview(this.carteBuilder.imageUrl);
        }
        this.renderCarteMarkers();
        this.switchCarteTab('construction');
    },

    updateCartePreview(url) {
        url = this.convertToDirectImageUrl(url);
        this.carteBuilder.imageUrl = url;

        const wrapper = document.getElementById('cartePreviewWrapper');
        const placeholder = document.getElementById('cartePreviewPlaceholder');
        const img = document.getElementById('cartePreviewImage');

        if (url) {
            img.src = url;
            img.onload = () => {
                wrapper.style.display = 'block';
                placeholder.style.display = 'none';
                this.renderCarteMarkers();
            };
            img.onerror = () => {
                wrapper.style.display = 'none';
                placeholder.style.display = 'block';
                placeholder.textContent = 'Erreur de chargement de l\'image';
            };
        } else {
            wrapper.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = 'Entrez une URL d\'image ci-dessus pour voir l\'aperçu';
        }
    },

    convertToDirectImageUrl(url) {
        if (!url) return url;
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
        }
        return url;
    },

    // ========== CARTE TABS CONSTRUCTION / VUE ÉLÈVE ==========

    switchCarteTab(tab) {
        const constructionPanel = document.getElementById('carteConstructionPanel');
        const previewPanel = document.getElementById('cartePreviewPanel');
        const tabConstruction = document.getElementById('carteTabConstruction');
        const tabPreview = document.getElementById('carteTabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this._renderCartePreview(previewPanel);
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

    _renderCartePreview(container) {
        const marqueurs = this.carteBuilder.marqueurs;
        const imageUrl = this.carteBuilder.imageUrl;

        if (!imageUrl) {
            container.innerHTML = '<div class="cb-preview-empty">Ajoutez une image pour voir l\'aperçu</div>';
            return;
        }

        const consigneEl = document.getElementById('sfwConsigneStep3');
        const consigne = consigneEl ? consigneEl.value.trim() : '';

        let html = '';
        if (consigne) {
            html += `<p class="cb-pv-consigne">${escapeHtml(consigne)}</p>`;
        }

        html += `<div class="cb-pv-image-wrapper">
            <img src="${escapeHtml(imageUrl)}" alt="Aperçu carte" class="cb-pv-image">
            <div class="cb-pv-marqueurs">`;

        marqueurs.forEach((m, i) => {
            const colorHex = (this.CARTE_COLORS.find(c => c.id === m.color) || this.CARTE_COLORS[0]).hex;
            const shapeClass = 'cb-shape-' + (m.shape || 'cercle');
            html += `<div class="cb-pv-marker ${shapeClass}" style="left:${m.x}%;top:${m.y}%;background:${colorHex};">
                <span class="cb-pv-marker-num">${i + 1}</span>
            </div>`;
        });

        html += `</div></div>`;

        // Indication sous l'image
        if (marqueurs.length > 0) {
            html += '<p class="cb-pv-hint">L\'élève clique sur un marqueur pour saisir sa réponse</p>';
        } else {
            html += '<p class="cb-pv-hint">Aucun marqueur — revenez à l\'onglet Construction pour en ajouter</p>';
        }

        container.innerHTML = html;

        // Rendre les marqueurs cliquables pour simuler la vue élève
        container.querySelectorAll('.cb-pv-marker').forEach((marker, _idx) => {
            marker.style.cursor = 'pointer';
            marker.addEventListener('click', () => {
                // Toggle un petit input simulé
                const existing = marker.querySelector('.cb-pv-input-sim');
                if (existing) {
                    existing.remove();
                    return;
                }
                // Fermer les autres
                container.querySelectorAll('.cb-pv-input-sim').forEach(el => el.remove());
                const sim = document.createElement('div');
                sim.className = 'cb-pv-input-sim';
                sim.innerHTML = '<input type="text" disabled placeholder="Réponse..." class="cb-pv-input-field">';
                marker.appendChild(sim);
            });
        });
    },

    // ========== CARTE MARKERS RENDERING ==========

    _getMarkerShapeClass(shape) {
        const valid = ['cercle', 'losange', 'carre', 'pin'];
        return 'cb-shape-' + (valid.includes(shape) ? shape : 'cercle');
    },

    _getMarkerColorHex(colorId) {
        const color = this.CARTE_COLORS.find(c => c.id === colorId);
        return color ? color.hex : this.CARTE_COLORS[0].hex;
    },

    renderCarteMarkers() {
        const container = document.getElementById('cartePreviewMarkers');
        if (!container) return;

        const marqueurs = this.carteBuilder.marqueurs;

        container.innerHTML = marqueurs.map((m, i) => {
            const colorHex = this._getMarkerColorHex(m.color);
            const shapeClass = this._getMarkerShapeClass(m.shape);
            const isSelected = this._selectedMarqueur === i;
            const mainAnswer = (m.reponse || '').split('|')[0];
            const hasAnswer = mainAnswer !== '';
            const alts = (m.reponse || '').split('|').slice(1).filter(a => a.trim());
            const isStricte = m.correction === 'stricte';

            let indicators = '';
            if (hasAnswer) {
                indicators += `<span class="cb-marker-answer-badge">${escapeHtml(mainAnswer)}</span>`;
            }
            if (alts.length > 0) {
                indicators += `<span class="cb-marker-indicator cb-ind-alt">\u00B1${alts.length}</span>`;
            }
            if (isStricte) {
                indicators += '<span class="cb-marker-indicator cb-ind-strict">S</span>';
            }

            return `<div class="carte-marker-preview ${shapeClass} ${isSelected ? 'cb-marker-selected' : ''}"
                 style="left:${m.x}%;top:${m.y}%;background:${colorHex};"
                 data-index="${i}"
                 title="Marqueur ${i + 1}${mainAnswer ? ': ' + mainAnswer : ''}">
                <span class="cb-marker-num">${i + 1}</span>
                ${indicators ? '<div class="cb-marker-indicators">' + indicators + '</div>' : ''}
            </div>`;
        }).join('');

        // Make markers clickable to open popover
        container.querySelectorAll('.carte-marker-preview').forEach(marker => {
            marker.style.pointerEvents = 'auto';
            marker.style.cursor = 'pointer';
            marker.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(marker.dataset.index);
                this.selectMarqueur(idx);
            });
        });

        // Add click handler to wrapper for adding markers
        const wrapper = document.getElementById('cartePreviewWrapper');
        if (wrapper) {
            wrapper.onclick = (e) => {
                // Ignore clicks on existing markers
                if (e.target.closest('.carte-marker-preview')) return;
                const rect = wrapper.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
                const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
                this.addMarqueur(parseFloat(x), parseFloat(y));
            };
        }

        // Update counter
        const counter = document.getElementById('carteMarqueurCount');
        if (counter) {
            counter.textContent = marqueurs.length + ' marqueur' + (marqueurs.length > 1 ? 's' : '');
        }
    },

    addMarqueur(x, y) {
        this.carteBuilder.marqueurs.push({
            x, y, reponse: '', correction: 'souple', shape: 'cercle', color: 'bleu'
        });
        const newIndex = this.carteBuilder.marqueurs.length - 1;
        this.renderCarteMarkers();
        // Ouvrir le popover du nouveau marqueur automatiquement
        this.selectMarqueur(newIndex);
    },

    addMarqueurManual() {
        this.addMarqueur(50, 50);
    },

    removeMarqueur(index) {
        this._closeCartePopover();
        this.carteBuilder.marqueurs.splice(index, 1);
        this.renderCarteMarkers();
    },

    // ========== CARTE POPOVER (même pattern que le tableau) ==========

    selectMarqueur(index) {
        this._selectedMarqueur = index;
        this.renderCarteMarkers();
        this._showCartePopover(index);
    },

    _showCartePopover(index) {
        this._removeCartePopoverDOM();

        const m = this.carteBuilder.marqueurs[index];
        if (!m) return;

        const mainAnswer = (m.reponse || '').split('|')[0];
        const alts = (m.reponse || '').split('|').slice(1);
        const isSouple = m.correction !== 'stricte';

        // Construire les sélecteurs de forme
        const shapesHTML = this.CARTE_SHAPES.map(s =>
            `<button type="button" class="cb-shape-btn ${m.shape === s.id ? 'active' : ''} cb-shape-opt-${s.id}"
                     onclick="AdminBanquesExercices._setMarqueurShape(${index}, '${s.id}')"
                     title="${s.label}">${s.icon}</button>`
        ).join('');

        // Construire les sélecteurs de couleur
        const colorsHTML = this.CARTE_COLORS.map(c =>
            `<button type="button" class="cb-color-btn ${m.color === c.id ? 'active' : ''}"
                     style="background:${c.hex};"
                     onclick="AdminBanquesExercices._setMarqueurColor(${index}, '${c.id}')"
                     title="${c.label}"></button>`
        ).join('');

        const popoverHTML = `
            <div class="cb-popover" id="cbPopover">
                <div class="cb-popover-header">
                    <span class="cb-popover-title">Marqueur ${index + 1}</span>
                    <button type="button" class="cb-popover-close" onclick="AdminBanquesExercices._closeCartePopover()">&times;</button>
                </div>
                <div class="cb-popover-body">
                    <div class="cb-popover-field">
                        <label class="cb-popover-label">Réponse attendue</label>
                        <input type="text" class="cb-popover-input" id="cbPopoverAnswer"
                               value="${escapeHtml(mainAnswer)}" placeholder="Ex : Paris"
                               oninput="AdminBanquesExercices._updateMarqueurAnswer(${index}, this.value)">
                    </div>
                    <div class="cb-popover-field">
                        <label class="cb-popover-label">Apparence</label>
                        <div class="cb-popover-appearance">
                            <div class="cb-shapes-row">${shapesHTML}</div>
                            <div class="cb-colors-row">${colorsHTML}</div>
                        </div>
                    </div>
                    <div class="cb-popover-field">
                        <label class="cb-popover-label">Correction</label>
                        <div class="cb-popover-radio-group">
                            <label class="cb-popover-radio ${isSouple ? 'active' : ''}">
                                <input type="radio" name="cbCorrection" value="souple" ${isSouple ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setMarqueurCorrection(${index}, 'souple')">
                                <span>Souple</span>
                            </label>
                            <label class="cb-popover-radio ${!isSouple ? 'active' : ''}">
                                <input type="radio" name="cbCorrection" value="stricte" ${!isSouple ? 'checked' : ''}
                                       onchange="AdminBanquesExercices._setMarqueurCorrection(${index}, 'stricte')">
                                <span>Stricte</span>
                            </label>
                        </div>
                        <div class="cb-popover-hint" id="cbCorrectionHint">${isSouple ? 'Tolère accents, majuscules, ponctuation' : 'La réponse doit être exacte'}</div>
                    </div>
                    <div class="cb-popover-field">
                        <label class="cb-popover-label">Alternatives acceptées</label>
                        <div class="cb-popover-alts" id="cbPopoverAlts">
                            ${alts.map((alt, i) => `
                                <div class="cb-popover-alt-item">
                                    <input type="text" class="cb-popover-alt-input" value="${escapeHtml(alt)}"
                                           placeholder="Alternative ${i + 1}" data-alt-index="${i}"
                                           onchange="AdminBanquesExercices._updateMarqueurAlt(${index}, ${i}, this.value)">
                                    <button type="button" class="cb-popover-alt-remove"
                                            onclick="AdminBanquesExercices._removeMarqueurAlt(${index}, ${i})">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="cb-popover-add-alt"
                                onclick="AdminBanquesExercices._addMarqueurAlt(${index})">+ Ajouter une alternative</button>
                    </div>
                    <div class="cb-popover-footer">
                        <button type="button" class="cb-popover-delete"
                                onclick="AdminBanquesExercices.removeMarqueur(${index})">Supprimer ce marqueur</button>
                    </div>
                </div>
            </div>`;

        // Positionner à côté du marqueur cliqué
        const clickedMarker = document.querySelector(`.carte-marker-preview[data-index="${index}"]`);
        if (!clickedMarker) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'cbPopoverWrapper';
        wrapper.innerHTML = popoverHTML;
        document.body.appendChild(wrapper);

        const rect = clickedMarker.getBoundingClientRect();
        const popover = document.getElementById('cbPopover');
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Essayer à droite, sinon à gauche
        let left = rect.right + 10 + scrollLeft;
        if (left + 300 > window.innerWidth) {
            left = rect.left - 310 + scrollLeft;
        }
        // Si toujours hors écran, centrer sous le marqueur
        if (left < 0) {
            left = rect.left + scrollLeft - 130;
        }
        let top = rect.top + scrollTop - 20;
        if (top + 420 > window.innerHeight + scrollTop) {
            top = window.innerHeight + scrollTop - 430;
        }
        if (top < scrollTop) top = scrollTop + 10;

        popover.style.position = 'absolute';
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';

        // Focus sur le champ réponse
        setTimeout(() => {
            const input = document.getElementById('cbPopoverAnswer');
            if (input) input.focus();
        }, 50);

        // Fermer au clic en dehors
        setTimeout(() => {
            this._cartePopoverOutsideHandler = (e) => {
                const pop = document.getElementById('cbPopover');
                if (pop && !pop.contains(e.target) && !e.target.closest('.carte-marker-preview')) {
                    this._closeCartePopover();
                }
            };
            document.addEventListener('click', this._cartePopoverOutsideHandler);
        }, 50);
    },

    /** Retire le popover du DOM sans sync ni nettoyage (utilisé avant reconstruction) */
    _removeCartePopoverDOM() {
        const wrapper = document.getElementById('cbPopoverWrapper');
        if (wrapper) wrapper.remove();
        if (this._cartePopoverOutsideHandler) {
            document.removeEventListener('click', this._cartePopoverOutsideHandler);
            this._cartePopoverOutsideHandler = null;
        }
    },

    /** Ferme le popover : sync les valeurs, nettoie les alternatives vides, retire le DOM */
    _closeCartePopover() {
        if (this._selectedMarqueur != null) {
            this._syncCartePopoverToModel(this._selectedMarqueur);
            // Nettoyer les alternatives vides à la fermeture
            const m = this.carteBuilder.marqueurs[this._selectedMarqueur];
            if (m) {
                const parts = (m.reponse || '').split('|');
                const main = parts[0];
                const alts = parts.slice(1).filter(a => a.trim());
                m.reponse = alts.length > 0 ? [main, ...alts].join('|') : main;
            }
        }
        this._removeCartePopoverDOM();
        this._selectedMarqueur = null;
        this.renderCarteMarkers();
    },

    // ========== CARTE POPOVER ACTIONS ==========

    /** Synchronise les valeurs du popover ouvert vers le modèle avant de le reconstruire */
    _syncCartePopoverToModel(index) {
        const m = this.carteBuilder.marqueurs[index];
        if (!m) return;
        // Lire la réponse principale depuis le champ input
        const answerInput = document.getElementById('cbPopoverAnswer');
        if (answerInput) {
            const parts = (m.reponse || '').split('|');
            parts[0] = answerInput.value;
            m.reponse = parts.join('|');
        }
        // Lire les alternatives depuis les champs input
        const altInputs = document.querySelectorAll('.cb-popover-alt-input');
        if (altInputs.length > 0) {
            const mainPart = (m.reponse || '').split('|')[0];
            const alts = [];
            altInputs.forEach(input => {
                alts.push(input.value);
            });
            m.reponse = [mainPart, ...alts].join('|');
        }
    },

    _updateMarqueurAnswer(index, value) {
        const m = this.carteBuilder.marqueurs[index];
        const parts = (m.reponse || '').split('|');
        parts[0] = value;
        m.reponse = parts.join('|');
        // Mettre à jour le marqueur visuellement sans fermer le popover
        const marker = document.querySelector(`.carte-marker-preview[data-index="${index}"]`);
        if (marker) {
            const badge = marker.querySelector('.cb-marker-answer-badge');
            if (badge) {
                badge.textContent = value;
                badge.style.display = value ? '' : 'none';
            }
        }
    },

    _setMarqueurShape(index, shape) {
        this._syncCartePopoverToModel(index);
        this.carteBuilder.marqueurs[index].shape = shape;
        this._selectedMarqueur = index;
        this.renderCarteMarkers();
        this._showCartePopover(index);
    },

    _setMarqueurColor(index, color) {
        this._syncCartePopoverToModel(index);
        this.carteBuilder.marqueurs[index].color = color;
        this._selectedMarqueur = index;
        this.renderCarteMarkers();
        this._showCartePopover(index);
    },

    _setMarqueurCorrection(index, mode) {
        this.carteBuilder.marqueurs[index].correction = mode;
        const hint = document.getElementById('cbCorrectionHint');
        if (hint) {
            hint.textContent = mode === 'souple' ? 'Tolère accents, majuscules, ponctuation' : 'La réponse doit être exacte';
        }
        // Mettre à jour les classes active sur les radios
        document.querySelectorAll('.cb-popover-radio').forEach(label => {
            label.classList.toggle('active', label.querySelector('input').value === mode);
        });
    },

    _addMarqueurAlt(index) {
        this._syncCartePopoverToModel(index);
        const m = this.carteBuilder.marqueurs[index];
        // Séparer réponse principale et alternatives existantes
        const mainAnswer = (m.reponse || '').split('|')[0];
        const existingAlts = (m.reponse || '').split('|').slice(1);
        existingAlts.push('');
        m.reponse = [mainAnswer, ...existingAlts].join('|');
        this._selectedMarqueur = index;
        this._showCartePopover(index);
        setTimeout(() => {
            const inputs = document.querySelectorAll('.cb-popover-alt-input');
            if (inputs.length > 0) inputs[inputs.length - 1].focus();
        }, 50);
    },

    _removeMarqueurAlt(index, altIndex) {
        this._syncCartePopoverToModel(index);
        const m = this.carteBuilder.marqueurs[index];
        const mainAnswer = (m.reponse || '').split('|')[0];
        const alts = (m.reponse || '').split('|').slice(1);
        alts.splice(altIndex, 1);
        m.reponse = alts.length > 0 ? [mainAnswer, ...alts].join('|') : mainAnswer;
        this._selectedMarqueur = index;
        this._showCartePopover(index);
    },

    _updateMarqueurAlt(index, altIndex, value) {
        const m = this.carteBuilder.marqueurs[index];
        const parts = (m.reponse || '').split('|');
        parts[altIndex + 1] = value;
        m.reponse = parts.join('|');
    },

    buildDataFromCarteBuilder() {
        return {
            image_url: this.carteBuilder.imageUrl,
            marqueurs: this.carteBuilder.marqueurs.map((m, i) => ({
                id: i,
                x: m.x,
                y: m.y,
                reponse: m.reponse,
                correction: m.correction || 'souple',
                shape: m.shape || 'cercle',
                color: m.color || 'bleu'
            }))
        };
    },

    // ========== QUESTION OUVERTE BUILDER ==========
    initQuestionBuilder() {
        this.questionBuilder = {
            document: { type: 'texte', contenu: '' },
            questions: []
        };
        document.getElementById('docTypeQO').value = 'texte';
        document.getElementById('docContenuQO').value = '';
        this.renderQuestionsList();
    },

    loadQuestionBuilderFromData(donnees) {
        this.questionBuilder = {
            document: donnees.document || { type: 'texte', contenu: '' },
            questions: (donnees.questions || []).map(q => ({
                titre: q.titre || '',
                etapes: q.etapes || [],
                reponse_attendue: q.reponse_attendue || ''
            }))
        };
        document.getElementById('docTypeQO').value = this.questionBuilder.document.type || 'texte';
        document.getElementById('docContenuQO').value = this.questionBuilder.document.contenu || '';
        this.renderQuestionsList();
    },

    addQuestion() {
        this.questionBuilder.questions.push({
            titre: 'Question ' + (this.questionBuilder.questions.length + 1),
            etapes: [''],
            reponse_attendue: ''
        });
        this.renderQuestionsList();
    },

    removeQuestion(index) {
        this.questionBuilder.questions.splice(index, 1);
        this.renderQuestionsList();
    },

    addEtape(qIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.push('');
        this.renderQuestionsList();
    },

    removeEtape(qIndex, eIndex) {
        this.readQuestionsFromDOM();
        this.questionBuilder.questions[qIndex].etapes.splice(eIndex, 1);
        this.renderQuestionsList();
    },

    readQuestionsFromDOM() {
        const container = document.getElementById('questionsList');
        const items = container.querySelectorAll('.question-item');

        this.questionBuilder.questions = Array.from(items).map((item, _qIndex) => {
            const titre = item.querySelector('.question-titre').value;
            const etapes = Array.from(item.querySelectorAll('.etape-input')).map(inp => inp.value);
            const reponse = item.querySelector('.question-correction').value;
            return { titre, etapes, reponse_attendue: reponse };
        });
    },

    renderQuestionsList() {
        const container = document.getElementById('questionsList');
        if (this.questionBuilder.questions.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucune question. Cliquez sur "Ajouter une question".</div>';
            return;
        }

        container.innerHTML = this.questionBuilder.questions.map((q, qIndex) => `
            <div class="question-item" data-index="${qIndex}">
                <div class="question-header">
                    <span class="question-num">${qIndex + 1}</span>
                    <input type="text" class="form-input question-titre" value="${escapeHtml(q.titre)}" placeholder="Titre de la question">
                    <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeQuestion(${qIndex})">&times;</button>
                </div>
                <div class="question-etapes">
                    <label>Etapes/Guidage</label>
                    ${q.etapes.map((e, eIndex) => `
                        <div class="etape-row">
                            <input type="text" class="form-input etape-input" value="${escapeHtml(e)}" placeholder="Ex: Identifiez les elements cles...">
                            <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeEtape(${qIndex}, ${eIndex})">&times;</button>
                        </div>
                    `).join('')}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addEtape(${qIndex})">+ Etape</button>
                </div>
                <div class="question-correction-wrap">
                    <label>Correction attendue</label>
                    <textarea class="form-textarea question-correction" rows="3" placeholder="Reponse modele...">${escapeHtml(q.reponse_attendue)}</textarea>
                </div>
            </div>
        `).join('');
    },

    buildDataFromQuestionBuilder() {
        this.readQuestionsFromDOM();
        return {
            document: {
                type: document.getElementById('docTypeQO').value,
                contenu: document.getElementById('docContenuQO').value
            },
            questions: this.questionBuilder.questions
        };
    },


    // ========== DOCUMENT MIXTE BUILDER (v2 — blocs + rangées + toggle) ==========

    /**
     * Modèle de données v2 :
     *   mixteBuilder.document = { actif, type, url, texte, titre, legende }
     *   mixteBuilder.tableau  = { actif, titre, elements: [{type:'section'|'row', ...}] }
     *   mixteBuilder.questions = { actif, liste: [{question, reponse_attendue, reponses_alternatives}] }
     *   mixteBuilder.rows = [ ['document','tableau'], ['questions'] ]
     *   Chaque sous-tableau = une rangée visuelle. Max 2 blocs par rangée.
     *   Rétro-compat : si rows absent → reconstruit depuis sectionOrder + layout.
     */

    BLOCK_TYPES: {
        document:  { icon: '\uD83D\uDCC4', label: 'Document' },
        tableau:   { icon: '\uD83D\uDCCB', label: 'Tableau' },
        questions: { icon: '\u2753', label: 'Questions' }
    },

    initDocumentMixteBuilder() {
        this.mixteBuilder = {
            document:  { actif: false, type: 'url', url: '', texte: '', titre: '', legende: '' },
            tableau:   { actif: false, titre: '', elements: [] },
            questions: { actif: false, liste: [] },
            rows: []
        };
        this.renderMixteRows();
        this.updateMixteBlockMenu();
    },

    loadDocumentMixteFromData(donnees) {
        if (!donnees) return;

        let tableauData = donnees.tableau || { actif: false, titre: '', elements: [] };
        if (tableauData.colonnes && !tableauData.elements) {
            tableauData.elements = this.convertOldTableauFormat(tableauData);
        }

        const docData = donnees.document || {};

        this.mixteBuilder = {
            document: {
                actif: docData.actif !== undefined ? docData.actif : !!docData.url || !!docData.texte,
                type: docData.type || 'url',
                url: docData.url || '',
                texte: docData.texte || '',
                titre: docData.titre || '',
                legende: docData.legende || ''
            },
            tableau: {
                actif: tableauData.actif || false,
                titre: tableauData.titre || '',
                elements: tableauData.elements || []
            },
            questions: donnees.questions || { actif: false, liste: [] },
            rows: []
        };

        // Rétro-compat : convertir sectionOrder+layout → rows
        if (donnees.rows && donnees.rows.length > 0) {
            this.mixteBuilder.rows = donnees.rows;
        } else {
            this.mixteBuilder.rows = this._convertLegacyToRows(
                donnees.sectionOrder || ['document', 'tableau', 'questions'],
                donnees.layout || 'vertical'
            );
        }

        this.renderMixteRows();
        this.updateMixteBlockMenu();
    },

    // Rétro-compat : sectionOrder+layout → rows[]
    _convertLegacyToRows(sectionOrder, layout) {
        const activeBlocks = sectionOrder.filter(s => this.mixteBuilder[s]?.actif);
        if (activeBlocks.length === 0) return [];

        if (layout === 'horizontal' && activeBlocks.includes('document')) {
            // Document côte à côte avec le reste
            const others = activeBlocks.filter(s => s !== 'document');
            if (others.length > 0) {
                const rows = [['document', others[0]]];
                for (let i = 1; i < others.length; i++) {
                    rows.push([others[i]]);
                }
                return rows;
            }
        }
        // Vertical : chaque bloc seul dans sa rangée
        return activeBlocks.map(s => [s]);
    },

    convertOldTableauFormat(oldTableau) {
        const elements = [];
        const colonnes = oldTableau.colonnes || [];
        const lignes = oldTableau.lignes || [];
        if (colonnes.length === 2 && colonnes[1].editable) {
            lignes.forEach(ligne => {
                elements.push({ type: 'row', label: ligne.cells[0] || '', placeholder: ligne.cells[1] || '' });
            });
        }
        return elements;
    },

    // ===== TOGGLE Construction / Vue élève =====

    switchMixteTab(tab) {
        const constructionPanel = document.getElementById('mixteConstructionPanel');
        const previewPanel = document.getElementById('mixtePreviewPanel');
        const tabConstruction = document.getElementById('mixteTabConstruction');
        const tabPreview = document.getElementById('mixteTabPreview');
        if (!constructionPanel || !previewPanel) return;

        if (tab === 'preview') {
            this._readMixteBuilderValues();
            this._renderMixtePreview(previewPanel);
            constructionPanel.style.display = 'none';
            previewPanel.style.display = '';
            tabConstruction.classList.remove('active');
            tabPreview.classList.add('active');
        } else {
            constructionPanel.style.display = '';
            previewPanel.style.display = 'none';
            tabConstruction.classList.add('active');
            tabPreview.classList.remove('active');
        }
    },

    // ===== AJOUT / SUPPRESSION DE BLOCS =====

    toggleMixteBlockMenu() {
        const menu = document.getElementById('mixteBlockMenu');
        if (menu) menu.classList.toggle('hidden');
    },

    updateMixteBlockMenu() {
        const menu = document.getElementById('mixteBlockMenu');
        if (!menu) return;
        menu.querySelectorAll('.block-menu-item').forEach(btn => {
            const blockType = btn.dataset.block;
            const isUsed = this.mixteBuilder[blockType]?.actif;
            btn.disabled = isUsed;
            btn.classList.toggle('disabled', isUsed);
        });
    },

    addMixteBlock(type) {
        if (!this.mixteBuilder[type]) return;
        this.mixteBuilder[type].actif = true;
        // Ajouter le bloc dans une nouvelle rangée en bas
        this.mixteBuilder.rows.push([type]);
        this.renderMixteRows();
        this.updateMixteBlockMenu();
        // Fermer le menu
        const menu = document.getElementById('mixteBlockMenu');
        if (menu) menu.classList.add('hidden');
    },

    removeMixteBlock(type) {
        if (!this.mixteBuilder[type]) return;
        this.mixteBuilder[type].actif = false;
        // Retirer le bloc de toutes les rangées
        this.mixteBuilder.rows = this.mixteBuilder.rows
            .map(row => row.filter(b => b !== type))
            .filter(row => row.length > 0);
        this.renderMixteRows();
        this.updateMixteBlockMenu();
    },

    toggleMixteBlockCollapse(type) {
        const content = document.getElementById(`mixteBlockContent_${type}`);
        const btn = document.querySelector(`[data-collapse="${type}"]`);
        if (!content || !btn) return;
        const collapsed = content.style.display === 'none';
        content.style.display = collapsed ? '' : 'none';
        btn.textContent = collapsed ? '\u25BE' : '\u25B8';
    },

    // ===== RENDU DES RANGÉES (layout) =====

    renderMixteRows() {
        const container = document.getElementById('mixteRowsContainer');
        if (!container) return;

        if (this.mixteBuilder.rows.length === 0) {
            container.innerHTML = '<div class="mixte-empty-hint">Ajoutez des \u00e9l\u00e9ments pour construire l\'exercice</div>';
            return;
        }

        container.innerHTML = this.mixteBuilder.rows.map((row, rowIdx) => {
            const isSideBySide = row.length === 2;
            const blocksHTML = row.map(type => this._renderMixteBlockCard(type)).join('');

            return `<div class="mixte-row ${isSideBySide ? 'side-by-side' : ''}" data-row="${rowIdx}">
                ${blocksHTML}
            </div>`;
        }).join('');

        this._initMixteRowsDragDrop();
    },

    _renderMixteBlockCard(type) {
        const info = this.BLOCK_TYPES[type];
        if (!info) return '';

        let innerHTML = '';
        if (type === 'document') {
            innerHTML = this._renderDocumentBlockContent();
        } else if (type === 'tableau') {
            innerHTML = this._renderTableauBlockContent();
        } else if (type === 'questions') {
            innerHTML = this._renderQuestionsBlockContent();
        }

        return `<div class="mixte-block-card" data-block="${type}" draggable="true">
            <div class="mixte-block-header">
                <span class="drag-handle">\u22EE\u22EE</span>
                <span class="mixte-block-title">${info.icon} ${info.label}</span>
                <div class="mixte-block-actions">
                    <button type="button" class="btn-collapse" data-collapse="${type}"
                            onclick="AdminBanquesExercices.toggleMixteBlockCollapse('${type}')">\u25BE</button>
                    <button type="button" class="btn-remove-block"
                            onclick="AdminBanquesExercices.removeMixteBlock('${type}')"
                            title="Supprimer">\uD83D\uDDD1\uFE0F</button>
                </div>
            </div>
            <div class="mixte-block-content" id="mixteBlockContent_${type}">
                ${innerHTML}
            </div>
        </div>`;
    },

    // ===== CONTENU DES BLOCS =====

    _renderDocumentBlockContent() {
        const doc = this.mixteBuilder.document;
        const docType = doc.type || 'url';
        return `
            <div class="form-row">
                <label>Type de document</label>
                <div class="doc-type-toggle">
                    <label class="toggle-option">
                        <input type="radio" name="docType" value="url" ${docType === 'url' ? 'checked' : ''}
                               onchange="AdminBanquesExercices.toggleDocType('url')">
                        <span>\uD83D\uDD17 Image/URL</span>
                    </label>
                    <label class="toggle-option">
                        <input type="radio" name="docType" value="texte" ${docType === 'texte' ? 'checked' : ''}
                               onchange="AdminBanquesExercices.toggleDocType('texte')">
                        <span>\uD83D\uDCDD Texte</span>
                    </label>
                </div>
            </div>
            <div id="docUrlSection" class="form-row" style="display:${docType === 'url' ? 'block' : 'none'}">
                <label>URL du document</label>
                <input type="text" class="form-input" id="docUrlMixte" value="${escapeHtml(doc.url)}"
                       placeholder="Lien Google Drive, image, PDF\u2026">
                <div class="form-help">Collez un lien Google Drive (image, PDF, Doc) ou une URL directe</div>
            </div>
            <div id="docTexteSection" class="form-row" style="display:${docType === 'texte' ? 'block' : 'none'}">
                <label>Contenu du texte</label>
                <div class="wysiwyg-container">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras (Ctrl+B)"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique (Ctrl+I)"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Soulign\u00e9 (Ctrl+U)"><u>S</u></button>
                        <span class="wysiwyg-sep"></span>
                        <button type="button" class="wysiwyg-btn" data-cmd="justifyLeft" title="Aligner \u00e0 gauche">\u25C0</button>
                        <button type="button" class="wysiwyg-btn" data-cmd="justifyCenter" title="Centrer">\u25C6</button>
                        <button type="button" class="wysiwyg-btn" data-cmd="justifyRight" title="Aligner \u00e0 droite">\u25B6</button>
                        <span class="wysiwyg-sep"></span>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">Couleur</option>
                            <option value="#000000">Noir</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" id="docTexteMixte" contenteditable="true"
                         data-placeholder="Saisissez votre texte ici\u2026">${doc.texte || ''}</div>
                </div>
            </div>
            <div class="form-row">
                <label>Titre du document</label>
                <input type="text" class="form-input" id="docTitreMixte" value="${escapeHtml(doc.titre)}"
                       placeholder="Ex: Doc. 1 - Titre du document">
            </div>
            <div class="form-row">
                <label>L\u00e9gende <span class="optional">(optionnel)</span></label>
                <textarea class="form-textarea" id="docLegendeMixte" rows="2"
                          placeholder="L\u00e9gende du document\u2026">${escapeHtml(doc.legende)}</textarea>
                <div class="form-help">Utilisez *texte* pour mettre en italique</div>
            </div>`;
    },

    _renderTableauBlockContent() {
        const tab = this.mixteBuilder.tableau;
        return `
            <div class="form-row">
                <label>Titre du tableau <span class="optional">(optionnel)</span></label>
                <input type="text" class="form-input" id="tableauTitreMixte" value="${escapeHtml(tab.titre)}"
                       placeholder="Ex: \u00c0 COMPL\u00c9TER">
            </div>
            <div class="form-row">
                <label>\u00c9l\u00e9ments du tableau</label>
                <div class="tableau-elements-list" id="tableauElementsList"></div>
                <div class="tableau-add-buttons">
                    <button type="button" class="btn btn-secondary btn-sm"
                            onclick="AdminBanquesExercices.addTableauElement('section')">+ Section</button>
                    <button type="button" class="btn btn-secondary btn-sm"
                            onclick="AdminBanquesExercices.addTableauElement('row')">+ Ligne</button>
                </div>
            </div>`;
    },

    _renderQuestionsBlockContent() {
        return `
            <div class="questions-list-mixte" id="questionsListMixte"></div>
            <button type="button" class="btn btn-secondary btn-sm"
                    onclick="AdminBanquesExercices.addQuestionMixte()">+ Ajouter une question</button>`;
    },

    toggleDocType(type) {
        const urlSection = document.getElementById('docUrlSection');
        const texteSection = document.getElementById('docTexteSection');
        if (type === 'url') {
            if (urlSection) urlSection.style.display = 'block';
            if (texteSection) texteSection.style.display = 'none';
        } else {
            if (urlSection) urlSection.style.display = 'none';
            if (texteSection) texteSection.style.display = 'block';
        }
        if (this.mixteBuilder?.document) {
            this.mixteBuilder.document.type = type;
        }
    },

    // ===== DRAG & DROP DES BLOCS ENTRE RANGÉES =====

    _initMixteRowsDragDrop() {
        const container = document.getElementById('mixteRowsContainer');
        if (!container) return;

        const blocks = container.querySelectorAll('.mixte-block-card');
        blocks.forEach(block => {
            const handle = block.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', () => {
                block.setAttribute('draggable', 'true');
            });

            block.addEventListener('dragstart', (e) => {
                block.classList.add('dragging');
                e.dataTransfer.setData('text/plain', block.dataset.block);
                e.dataTransfer.effectAllowed = 'move';
            });

            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
                block.removeAttribute('draggable');
                container.querySelectorAll('.drop-indicator').forEach(d => d.remove());
                container.querySelectorAll('.drop-side').forEach(d => d.remove());
                this._readRowsFromDOM();
                this.renderMixteRows();
                this.updateMixteBlockMenu();
            });
        });

        // Zones de drop sur les rangées
        const rows = container.querySelectorAll('.mixte-row');
        rows.forEach(row => {
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const dragging = container.querySelector('.dragging');
                if (!dragging) return;

                const draggingType = dragging.dataset.block;
                const rowBlocks = Array.from(row.querySelectorAll('.mixte-block-card:not(.dragging)')).map(b => b.dataset.block);

                // Déterminer la zone : haut, bas, ou côté droit
                const rect = row.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const relX = e.clientX - rect.left;
                const isTopHalf = relY < rect.height / 3;
                const isBottomHalf = relY > rect.height * 2 / 3;
                const isRightSide = relX > rect.width * 0.6 && rowBlocks.length < 2;

                // Nettoyer les indicateurs
                container.querySelectorAll('.drop-indicator, .drop-side').forEach(d => d.remove());

                if (isRightSide && rowBlocks.length === 1 && !rowBlocks.includes(draggingType)) {
                    // Indicateur côte à côte
                    const indicator = document.createElement('div');
                    indicator.className = 'drop-side';
                    row.appendChild(indicator);
                } else if (isTopHalf) {
                    const indicator = document.createElement('div');
                    indicator.className = 'drop-indicator drop-before';
                    row.parentNode.insertBefore(indicator, row);
                } else if (isBottomHalf) {
                    const indicator = document.createElement('div');
                    indicator.className = 'drop-indicator drop-after';
                    row.parentNode.insertBefore(indicator, row.nextSibling);
                }
            });

            row.addEventListener('dragleave', () => {
                // Les indicateurs sont nettoyés dans dragover
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggingType = e.dataTransfer.getData('text/plain');
                if (!draggingType) return;

                // Retirer le bloc de son ancienne position
                this.mixteBuilder.rows = this.mixteBuilder.rows
                    .map(r => r.filter(b => b !== draggingType))
                    .filter(r => r.length > 0);

                const rowIdx = parseInt(row.dataset.row);
                const rect = row.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const relX = e.clientX - rect.left;
                const isRightSide = relX > rect.width * 0.6;
                const currentRowBlocks = this.mixteBuilder.rows[rowIdx] || [];

                if (isRightSide && currentRowBlocks.length === 1 && currentRowBlocks[0] !== draggingType) {
                    // Fusionner dans la même rangée (côte à côte)
                    this.mixteBuilder.rows[rowIdx].push(draggingType);
                } else if (relY < rect.height / 2) {
                    // Insérer avant cette rangée
                    this.mixteBuilder.rows.splice(rowIdx, 0, [draggingType]);
                } else {
                    // Insérer après cette rangée
                    this.mixteBuilder.rows.splice(rowIdx + 1, 0, [draggingType]);
                }

                container.querySelectorAll('.drop-indicator, .drop-side').forEach(d => d.remove());
                this.renderMixteRows();
                this.updateMixteBlockMenu();
            });
        });

        // Après le rendu, initialiser le contenu des blocs dynamiques
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
        this.renderMixteQuestions();
    },

    _readRowsFromDOM() {
        const container = document.getElementById('mixteRowsContainer');
        if (!container) return;
        const newRows = [];
        container.querySelectorAll('.mixte-row').forEach(rowEl => {
            const blocks = [];
            rowEl.querySelectorAll('.mixte-block-card').forEach(b => {
                blocks.push(b.dataset.block);
            });
            if (blocks.length > 0) newRows.push(blocks);
        });
        this.mixteBuilder.rows = newRows;
    },

    // ===== TABLEAU ELEMENTS (inchangé — sections + lignes) =====

    addTableauElement(type) {
        if (!this.mixteBuilder) this.initDocumentMixteBuilder();
        if (!this.mixteBuilder.tableau.elements) this.mixteBuilder.tableau.elements = [];

        if (type === 'section') {
            this.mixteBuilder.tableau.elements.push({ type: 'section', text: '' });
        } else if (type === 'row') {
            this.mixteBuilder.tableau.elements.push({ type: 'row', label: '', reponse: '' });
        }
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    removeTableauElement(index) {
        this.mixteBuilder.tableau.elements.splice(index, 1);
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    renderTableauElements() {
        const container = document.getElementById('tableauElementsList');
        if (!container) return;
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            container.innerHTML = '<div style="color:#999;font-style:italic;padding:1rem;text-align:center;">Ajoutez des sections et des lignes</div>';
            return;
        }

        container.innerHTML = elements.map((el, i) => {
            if (el.type === 'section') {
                return `
                    <div class="tableau-element section-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">\u22EE\u22EE</span>
                        <div class="element-content">
                            <input type="text" class="section-input" value="${escapeHtml(el.text)}"
                                   placeholder="Titre de la section (ex: OEUVRE D'ORIGINE)"
                                   onchange="AdminBanquesExercices.updateTableauElement(${i}, 'text', this.value)">
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>`;
            } else {
                const reponseValue = el.reponse || '';
                const alternatives = reponseValue.split('|');
                const mainAnswer = alternatives[0] || '';
                const altCount = alternatives.length - 1;
                return `
                    <div class="tableau-element row-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">\u22EE\u22EE</span>
                        <div class="element-content">
                            <div class="row-inputs">
                                <input type="text" class="label-input" value="${escapeHtml(el.label)}"
                                       placeholder="Label (ex: Auteur)"
                                       onchange="AdminBanquesExercices.updateTableauElement(${i}, 'label', this.value)">
                                <div class="answer-with-alternatives">
                                    <input type="text" class="answer-input" value="${escapeHtml(mainAnswer)}"
                                           data-element-index="${i}"
                                           placeholder="R\u00e9ponse attendue"
                                           onchange="AdminBanquesExercices.updateTableauElementMainAnswer(${i}, this.value)">
                                    <button type="button" class="btn-alternatives-small ${altCount > 0 ? 'has-alternatives' : ''}"
                                            onclick="AdminBanquesExercices.openTableauElementAlternativesModal(${i})"
                                            title="R\u00e9ponses alternatives">
                                        \u00b1${altCount > 0 ? `<span class="alt-count">${altCount}</span>` : ''}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>`;
            }
        }).join('');
    },

    updateTableauElement(index, field, value) {
        this.mixteBuilder.tableau.elements[index][field] = value;
    },

    updateTableauElementMainAnswer(index, newMainAnswer) {
        const el = this.mixteBuilder.tableau.elements[index];
        const alternatives = (el.reponse || '').split('|');
        alternatives[0] = newMainAnswer;
        el.reponse = alternatives.join('|');
    },

    openTableauElementAlternativesModal(index) {
        const el = this.mixteBuilder.tableau.elements[index];
        const alternatives = (el.reponse || '').split('|');
        const mainAnswer = alternatives[0] || '';
        const altAnswers = alternatives.slice(1);

        const existingModal = document.getElementById('alternativesModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'alternativesModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modal-alternatives">
                <div class="modal-header">
                    <h3>R\u00e9ponses alternatives</h3>
                    <button type="button" class="modal-close" onclick="AdminBanquesExercices.closeAlternativesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="help-text">La r\u00e9ponse principale est "<strong>${escapeHtml(mainAnswer)}</strong>". Ajoutez des r\u00e9ponses alternatives qui seront aussi accept\u00e9es.</p>
                    <div id="alternativesList">
                        ${altAnswers.map((alt, i) => `
                            <div class="alternative-item">
                                <input type="text" class="alt-input" value="${escapeHtml(alt)}" placeholder="R\u00e9ponse alternative ${i + 1}">
                                <button type="button" class="btn-remove-alt" onclick="this.parentElement.remove()">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn-add-alternative" onclick="AdminBanquesExercices.addAlternativeInput()">
                        + Ajouter une alternative
                    </button>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="AdminBanquesExercices.closeAlternativesModal()">Annuler</button>
                    <button type="button" class="btn btn-primary" onclick="AdminBanquesExercices.saveTableauElementAlternatives(${index})">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (altAnswers.length === 0) this.addAlternativeInput();
    },

    saveTableauElementAlternatives(index) {
        const mainInput = document.querySelector(`input[data-element-index="${index}"]`);
        const mainAnswer = mainInput ? mainInput.value : '';
        const altInputs = document.querySelectorAll('#alternativesList .alt-input');
        const alternatives = [mainAnswer];
        altInputs.forEach(input => { const val = input.value.trim(); if (val) alternatives.push(val); });
        this.mixteBuilder.tableau.elements[index].reponse = alternatives.join('|');
        this.closeAlternativesModal();
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    initTableauElementsDragDrop() {
        const container = document.getElementById('tableauElementsList');
        if (!container) return;
        const items = container.querySelectorAll('.tableau-element');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.stopPropagation(); // Ne pas déclencher le drag de bloc parent
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this._updateTableauElementsOrder();
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    const rect = item.getBoundingClientRect();
                    if (e.clientY < rect.top + rect.height / 2) {
                        container.insertBefore(dragging, item);
                    } else {
                        container.insertBefore(dragging, item.nextSibling);
                    }
                }
            });
        });
    },

    _updateTableauElementsOrder() {
        const container = document.getElementById('tableauElementsList');
        if (!container) return;
        const items = container.querySelectorAll('.tableau-element');
        const oldElements = [...this.mixteBuilder.tableau.elements];
        const newElements = [];
        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            if (oldElements[oldIndex]) newElements.push(oldElements[oldIndex]);
        });
        this.mixteBuilder.tableau.elements = newElements;
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    // ===== QUESTIONS MIXTE (inchangé) =====

    addQuestionMixte() {
        this.mixteBuilder.questions.liste.push({ question: '', reponse_attendue: '' });
        this.renderMixteQuestions();
    },

    removeQuestionMixte(index) {
        this.mixteBuilder.questions.liste.splice(index, 1);
        this.renderMixteQuestions();
    },

    renderMixteQuestions() {
        const container = document.getElementById('questionsListMixte');
        if (!container) return;
        container.innerHTML = this.mixteBuilder.questions.liste.map((q, i) => {
            const alternatives = q.reponses_alternatives || [];
            const altCount = alternatives.length;
            return `
            <div class="question-item-mixte">
                <div class="question-header">
                    <span class="question-label">Question ${i + 1}</span>
                    <button type="button" class="btn-icon" onclick="AdminBanquesExercices.removeQuestionMixte(${i})">×</button>
                </div>
                <div class="wysiwyg-container wysiwyg-mini">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Soulign\u00e9"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">\uD83C\uDFA8</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" contenteditable="true"
                         data-index="${i}" data-field="question"
                         data-placeholder="Texte de la question..."
                         oninput="AdminBanquesExercices.updateMixteQuestion(${i}, 'question', this.innerHTML)">${q.question || ''}</div>
                </div>
                <div class="question-label" style="margin-top:0.5rem;">R\u00e9ponse attendue (pour correction)</div>
                <div class="wysiwyg-container wysiwyg-mini">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Soulign\u00e9"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">\uD83C\uDFA8</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" contenteditable="true"
                         data-index="${i}" data-field="reponse_attendue"
                         data-placeholder="R\u00e9ponse mod\u00e8le..."
                         oninput="AdminBanquesExercices.updateMixteQuestion(${i}, 'reponse_attendue', this.innerHTML)">${q.reponse_attendue || ''}</div>
                </div>
                <div class="alternatives-section-mixte">
                    <button type="button" class="btn-toggle-alternatives ${altCount > 0 ? 'has-alternatives' : ''}"
                            onclick="AdminBanquesExercices.toggleMixteAlternatives(${i})">
                        <span class="toggle-icon">\u25B6</span>
                        R\u00e9ponses alternatives ${altCount > 0 ? `(${altCount})` : ''}
                    </button>
                    <div class="alternatives-content" id="altContent_${i}" style="display: none;">
                        <p class="alt-help-text">Ces r\u00e9ponses seront aussi accept\u00e9es comme correctes</p>
                        <div class="alternatives-list-mixte" id="altList_${i}">
                            ${alternatives.map((alt, ai) => `
                                <div class="alternative-item-mixte">
                                    <input type="text" class="alt-input-mixte" value="${escapeHtml(alt)}"
                                           onchange="AdminBanquesExercices.updateMixteAlternative(${i}, ${ai}, this.value)"
                                           placeholder="R\u00e9ponse alternative ${ai + 1}">
                                    <button type="button" class="btn-remove-alt" onclick="AdminBanquesExercices.removeMixteAlternative(${i}, ${ai})">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn-add-alt-mixte" onclick="AdminBanquesExercices.addMixteAlternative(${i})">
                            + Ajouter une alternative
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    toggleMixteAlternatives(questionIndex) {
        const content = document.getElementById(`altContent_${questionIndex}`);
        const btn = content.previousElementSibling;
        const icon = btn.querySelector('.toggle-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '\u25BC';
        } else {
            content.style.display = 'none';
            icon.textContent = '\u25B6';
        }
    },

    addMixteAlternative(questionIndex) {
        if (!this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives) {
            this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives = [];
        }
        this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives.push('');
        this.renderMixteQuestions();
        const content = document.getElementById(`altContent_${questionIndex}`);
        if (content) {
            content.style.display = 'block';
            const btn = content.previousElementSibling;
            const icon = btn.querySelector('.toggle-icon');
            if (icon) icon.textContent = '\u25BC';
        }
    },

    updateMixteAlternative(questionIndex, altIndex, value) {
        if (this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives) {
            this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives[altIndex] = value;
        }
    },

    removeMixteAlternative(questionIndex, altIndex) {
        if (this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives) {
            this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives.splice(altIndex, 1);
            this.renderMixteQuestions();
            const content = document.getElementById(`altContent_${questionIndex}`);
            if (content) {
                content.style.display = 'block';
                const btn = content.previousElementSibling;
                const icon = btn.querySelector('.toggle-icon');
                if (icon) icon.textContent = '\u25BC';
            }
        }
    },

    updateMixteQuestion(index, field, value) {
        this.mixteBuilder.questions.liste[index][field] = value;
    },

    // ===== PREVIEW (Vue élève) =====

    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveFileMatch) {
            const fileId = driveFileMatch[1];
            return { type: 'drive_file', id: fileId, imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`, iframeUrl: `https://drive.google.com/file/d/${fileId}/preview` };
        }
        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) return { type: 'google_doc', id: docsMatch[1], iframeUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview` };
        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) return { type: 'google_sheet', id: sheetsMatch[1], iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview` };
        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) return { type: 'google_slide', id: slidesMatch[1], iframeUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed` };
        return { type: 'direct_url', url: url, imageUrl: url };
    },

    _readMixteBuilderValues() {
        if (!this.mixteBuilder) return;
        const docUrlEl = document.getElementById('docUrlMixte');
        const docTexteEl = document.getElementById('docTexteMixte');
        const docTitreEl = document.getElementById('docTitreMixte');
        const docLegendeEl = document.getElementById('docLegendeMixte');
        const tableauTitreEl = document.getElementById('tableauTitreMixte');
        const docTypeRadio = document.querySelector('input[name="docType"]:checked');

        if (docTypeRadio) this.mixteBuilder.document.type = docTypeRadio.value;
        if (docUrlEl) this.mixteBuilder.document.url = docUrlEl.value;
        if (docTexteEl) this.mixteBuilder.document.texte = docTexteEl.innerHTML;
        if (docTitreEl) this.mixteBuilder.document.titre = docTitreEl.value;
        if (docLegendeEl) this.mixteBuilder.document.legende = docLegendeEl.value;
        if (tableauTitreEl) this.mixteBuilder.tableau.titre = tableauTitreEl.value;
    },

    _renderMixtePreview(container) {
        this._readMixteBuilderValues();
        const rows = this.mixteBuilder.rows;

        if (rows.length === 0) {
            container.innerHTML = '<div class="preview-placeholder">Ajoutez des \u00e9l\u00e9ments pour voir l\'aper\u00e7u</div>';
            return;
        }

        let html = '';
        rows.forEach(row => {
            if (row.length === 2) {
                html += `<div class="preview-horizontal-layout">
                    <div class="preview-left">${this._renderMixteBlockPreview(row[0])}</div>
                    <div class="preview-right">${this._renderMixteBlockPreview(row[1])}</div>
                </div>`;
            } else if (row.length === 1) {
                html += this._renderMixteBlockPreview(row[0]);
            }
        });

        container.innerHTML = html;
    },

    _renderMixteBlockPreview(type) {
        if (type === 'document') return this._renderMixteDocumentPreview();
        if (type === 'tableau') return this._renderMixteTableauPreview();
        if (type === 'questions') return this._renderMixteQuestionsPreview();
        return '';
    },

    _renderMixteDocumentPreview() {
        const doc = this.mixteBuilder.document;
        const url = doc.url || '';
        const titre = doc.titre || '';
        const legende = doc.legende || '';
        const legendeHTML = legende.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        let contentHTML = '';
        if (doc.type === 'texte') {
            contentHTML = doc.texte || '<div style="color:#999;">Texte vide</div>';
        } else {
            const converted = this.convertGoogleUrl(url);
            if (!url) {
                contentHTML = '<div style="color:#999;font-style:italic;">Entrez une URL de document</div>';
            } else if (converted.type === 'drive_file') {
                contentHTML = `<img src="${converted.imageUrl}" alt="Document" onerror="this.style.display='none';this.nextElementSibling.style.display='block';"><iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
            } else if (converted.iframeUrl) {
                contentHTML = `<iframe src="${converted.iframeUrl}"></iframe>`;
            } else {
                contentHTML = `<img src="${converted.imageUrl || url}" alt="Document" onerror="this.outerHTML='<div style=\\'color:#ef4444;\\'>Impossible de charger</div>'">`;
            }
        }

        return `<div class="preview-document">
            ${titre ? `<div class="preview-doc-header">${escapeHtml(titre)}</div>` : ''}
            <div class="preview-doc-content">${contentHTML}</div>
            ${legende ? `<div class="preview-doc-legend">${legendeHTML}</div>` : ''}
        </div>`;
    },

    _renderMixteTableauPreview() {
        const titre = this.mixteBuilder.tableau.titre || '';
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            return '<div class="preview-tableau"><div class="preview-tableau-header">Tableau</div><div style="padding:1rem;color:#999;">Ajoutez des sections et des lignes</div></div>';
        }

        const contentHTML = elements.map(el => {
            if (el.type === 'section') {
                return `<div class="preview-tableau-section">${escapeHtml(el.text) || 'Section...'}</div>`;
            }
            const reponse = el.reponse || '';
            const label = el.label || 'Label...';
            return `<div class="preview-tableau-row">
                <div class="row-label">${escapeHtml(label)}</div>
                <div class="row-input-preview" title="R\u00e9ponse: ${escapeHtml(reponse)}">
                    <input type="text" disabled placeholder="Champ \u00e9l\u00e8ve" class="preview-input">
                    ${reponse ? `<span class="answer-hint">\u2713 ${escapeHtml(reponse)}</span>` : '<span class="answer-missing">\u26A0 R\u00e9ponse manquante</span>'}
                </div>
            </div>`;
        }).join('');

        return `<div class="preview-tableau">
            <div class="preview-tableau-header">${escapeHtml(titre) || '\u00c0 COMPL\u00c9TER'}</div>
            ${contentHTML}
        </div>`;
    },

    _renderMixteQuestionsPreview() {
        const questions = this.mixteBuilder.questions.liste;
        if (questions.length === 0) {
            return '<div class="preview-questions"><div class="preview-questions-header">Questions</div><div style="padding:1rem;color:#999;">Ajoutez des questions</div></div>';
        }
        return `<div class="preview-questions">
            <div class="preview-questions-header">Questions ouvertes</div>
            ${questions.map((q, i) => `
                <div class="preview-question-item">
                    <div class="preview-question-text">${i + 1}. ${q.question || 'Question...'}</div>
                    <div class="preview-question-answer">Zone de r\u00e9ponse \u00e9l\u00e8ve</div>
                </div>
            `).join('')}
        </div>`;
    },

    // ===== BUILD DATA (pour sauvegarde) =====

    buildDataFromDocumentMixte() {
        if (!this.mixteBuilder) this.initDocumentMixteBuilder();

        this._readMixteBuilderValues();

        // Reconstruire sectionOrder pour rétro-compat côté élève
        const activeBlocks = [];
        this.mixteBuilder.rows.forEach(row => row.forEach(b => { if (!activeBlocks.includes(b)) activeBlocks.push(b); }));

        // Déterminer layout pour rétro-compat
        let layout = 'vertical';
        const docRow = this.mixteBuilder.rows.find(r => r.includes('document'));
        if (docRow && docRow.length === 2) layout = 'horizontal';

        return {
            document: { ...this.mixteBuilder.document, type: this.mixteBuilder.document.type || 'url' },
            tableau:  { ...this.mixteBuilder.tableau, elements: this.mixteBuilder.tableau.elements || [] },
            questions: { ...this.mixteBuilder.questions, liste: this.mixteBuilder.questions.liste || [] },
            rows: this.mixteBuilder.rows,
            // Rétro-compat pour le rendu élève existant
            sectionOrder: activeBlocks,
            layout: layout
        };
    },
});
