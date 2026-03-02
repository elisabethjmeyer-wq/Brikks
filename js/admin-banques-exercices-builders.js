Object.assign(AdminBanquesExercices, {
    // ========== TABLE BUILDER ==========
    initTableBuilder() {
        // Default: 2 columns (Date = display, Siècle = editable)
        this.tableBuilder = {
            columns: [
                { titre: 'Date', editable: false },
                { titre: 'Siècle', editable: true }
            ],
            rows: [
                ['', '']
            ]
        };
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    loadTableBuilderFromData(donnees) {
        if (donnees && donnees.colonnes && donnees.lignes) {
            this.tableBuilder = {
                columns: donnees.colonnes.map(c => ({
                    titre: c.titre || '',
                    editable: c.editable !== false
                })),
                rows: donnees.lignes.map(ligne => ligne.cells || [])
            };
        } else if (donnees && donnees.lignes && Array.isArray(donnees.lignes)) {
            // Legacy format: lignes with named properties
            // Try to infer columns from first row
            const firstRow = donnees.lignes[0];
            const keys = Object.keys(firstRow);
            this.tableBuilder = {
                columns: keys.map(key => ({
                    titre: key.charAt(0).toUpperCase() + key.slice(1),
                    editable: key !== 'date'
                })),
                rows: donnees.lignes.map(ligne => keys.map(k => ligne[k] || ''))
            };
        } else {
            this.initTableBuilder();
            return;
        }
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    buildDataFromTableBuilder() {
        // Read current values from DOM
        this.readTableBuilderValues();

        return {
            colonnes: this.tableBuilder.columns.map(c => ({
                titre: c.titre,
                editable: c.editable
            })),
            lignes: this.tableBuilder.rows.map(row => ({
                cells: row
            }))
        };
    },

    readTableBuilderValues() {
        // Read columns
        const colDefs = document.querySelectorAll('.column-def');
        this.tableBuilder.columns = Array.from(colDefs).map(def => ({
            titre: def.querySelector('.col-title-input').value || '',
            editable: def.querySelector('.col-editable-check').checked
        }));

        // Sauvegarder les anciennes valeurs (avec alternatives) avant de reconstruire
        const oldRows = this.tableBuilder.rows || [];

        // Read rows - préserver les alternatives pour les colonnes éditables
        const tbody = document.getElementById('tableBuilderBody');
        const rows = tbody.querySelectorAll('tr[data-row]');
        this.tableBuilder.rows = Array.from(rows).map((tr, rowIndex) => {
            return this.tableBuilder.columns.map((col, colIndex) => {
                if (col.editable) {
                    // Pour les colonnes éditables, préserver les alternatives
                    const input = tr.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
                    if (input) {
                        const currentValue = oldRows[rowIndex] ? oldRows[rowIndex][colIndex] || '' : '';
                        const alternatives = currentValue.split('|');
                        alternatives[0] = input.value || '';
                        return alternatives.join('|');
                    }
                    return oldRows[rowIndex] ? oldRows[rowIndex][colIndex] || '' : '';
                } else {
                    // Pour les colonnes non-éditables, lire directement depuis le DOM
                    const inputs = tr.querySelectorAll('td input[type="text"]');
                    return inputs[colIndex] ? inputs[colIndex].value || '' : '';
                }
            });
        });
    },

    renderColumnsBuilder() {
        const container = document.getElementById('columnsBuilder');
        container.innerHTML = this.tableBuilder.columns.map((col, index) => `
            <div class="column-def" data-index="${index}">
                <span class="column-num">${index + 1}</span>
                <input type="text" class="col-title-input" value="${this.escapeHtml(col.titre)}" placeholder="Nom de la colonne">
                <label class="column-editable">
                    <input type="checkbox" class="col-editable-check" ${col.editable ? 'checked' : ''}>
                    <span>Réponse élève</span>
                </label>
                <button type="button" class="btn-remove-col" onclick="AdminBanquesExercices.removeColumn(${index})" title="Supprimer">&times;</button>
            </div>
        `).join('');

        // Add change listeners
        container.querySelectorAll('.col-title-input, .col-editable-check').forEach(input => {
            input.addEventListener('change', () => this.onColumnChange());
        });
    },

    renderTableBuilder() {
        const thead = document.getElementById('tableBuilderHead');
        const tbody = document.getElementById('tableBuilderBody');

        // Render headers
        thead.innerHTML = `
            <tr>
                ${this.tableBuilder.columns.map((col, i) => `
                    <th class="${col.editable ? 'editable-col' : ''}">
                        ${this.escapeHtml(col.titre) || 'Colonne ' + (i + 1)}
                        <span class="col-hint">${col.editable ? '(réponse)' : '(donnée)'}</span>
                    </th>
                `).join('')}
                <th class="row-actions"></th>
            </tr>
        `;

        // Ensure rows have correct number of cells
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            const newRow = [...row];
            while (newRow.length < this.tableBuilder.columns.length) {
                newRow.push('');
            }
            return newRow.slice(0, this.tableBuilder.columns.length);
        });

        // Render rows
        if (this.tableBuilder.rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="100" class="table-builder-empty">Aucune ligne. Cliquez sur "Ajouter une ligne".</td></tr>';
        } else {
            tbody.innerHTML = this.tableBuilder.rows.map((row, rowIndex) => `
                <tr data-row="${rowIndex}">
                    ${this.tableBuilder.columns.map((col, colIndex) => {
                        const cellValue = row[colIndex] || '';
                        const alternatives = cellValue.split('|');
                        const mainAnswer = alternatives[0] || '';
                        const altCount = alternatives.length - 1;

                        if (col.editable) {
                            return `
                                <td class="cell-with-alternatives">
                                    <div class="cell-answer-wrapper">
                                        <input type="text"
                                               class="editable-input main-answer-input"
                                               data-row="${rowIndex}" data-col="${colIndex}"
                                               value="${this.escapeHtml(mainAnswer)}"
                                               placeholder="Réponse attendue"
                                               onchange="AdminBanquesExercices.updateCellMainAnswer(${rowIndex}, ${colIndex}, this.value)">
                                        <button type="button" class="btn-alternatives ${altCount > 0 ? 'has-alternatives' : ''}"
                                                onclick="AdminBanquesExercices.openAlternativesModal(${rowIndex}, ${colIndex})"
                                                title="Réponses alternatives">
                                            <span class="alt-icon">±</span>
                                            ${altCount > 0 ? `<span class="alt-count">${altCount}</span>` : ''}
                                        </button>
                                    </div>
                                </td>
                            `;
                        } else {
                            return `
                                <td>
                                    <input type="text"
                                           value="${this.escapeHtml(cellValue)}"
                                           placeholder="Donnée affichée">
                                </td>
                            `;
                        }
                    }).join('')}
                    <td class="row-actions">
                        <button type="button" class="btn-remove-row" onclick="AdminBanquesExercices.removeRow(${rowIndex})" title="Supprimer">&times;</button>
                    </td>
                </tr>
            `).join('');
        }
    },

    // Gestion des réponses alternatives pour les cellules de tableau
    updateCellMainAnswer(rowIndex, colIndex, newMainAnswer) {
        const cellValue = this.tableBuilder.rows[rowIndex][colIndex] || '';
        const alternatives = cellValue.split('|');
        alternatives[0] = newMainAnswer;
        this.tableBuilder.rows[rowIndex][colIndex] = alternatives.join('|');
    },

    openAlternativesModal(rowIndex, colIndex) {
        const cellValue = this.tableBuilder.rows[rowIndex][colIndex] || '';
        const alternatives = cellValue.split('|');
        const mainAnswer = alternatives[0] || '';
        const altAnswers = alternatives.slice(1);

        // Créer le modal
        const existingModal = document.getElementById('alternativesModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'alternativesModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modal-alternatives">
                <div class="modal-header">
                    <h3>Réponses alternatives</h3>
                    <button type="button" class="modal-close" onclick="AdminBanquesExercices.closeAlternativesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="help-text">La réponse principale est "<strong>${this.escapeHtml(mainAnswer)}</strong>". Ajoutez des réponses alternatives qui seront aussi acceptées.</p>
                    <div id="alternativesList">
                        ${altAnswers.map((alt, i) => `
                            <div class="alternative-item">
                                <input type="text" class="alt-input" value="${this.escapeHtml(alt)}" placeholder="Réponse alternative ${i + 1}">
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
                    <button type="button" class="btn btn-primary" onclick="AdminBanquesExercices.saveAlternatives(${rowIndex}, ${colIndex})">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Focus sur le premier champ vide ou ajouter un nouveau
        if (altAnswers.length === 0) {
            this.addAlternativeInput();
        }
    },

    addAlternativeInput() {
        const list = document.getElementById('alternativesList');
        const count = list.querySelectorAll('.alternative-item').length;
        const div = document.createElement('div');
        div.className = 'alternative-item';
        div.innerHTML = `
            <input type="text" class="alt-input" placeholder="Réponse alternative ${count + 1}">
            <button type="button" class="btn-remove-alt" onclick="this.parentElement.remove()">×</button>
        `;
        list.appendChild(div);
        div.querySelector('input').focus();
    },

    saveAlternatives(rowIndex, colIndex) {
        const mainInput = document.querySelector(`input[data-row="${rowIndex}"][data-col="${colIndex}"]`);
        const mainAnswer = mainInput ? mainInput.value : '';
        const altInputs = document.querySelectorAll('#alternativesList .alt-input');
        const alternatives = [mainAnswer];

        altInputs.forEach(input => {
            const val = input.value.trim();
            if (val) alternatives.push(val);
        });

        this.tableBuilder.rows[rowIndex][colIndex] = alternatives.join('|');
        this.closeAlternativesModal();
        this.renderTableBuilder();
    },

    closeAlternativesModal() {
        const modal = document.getElementById('alternativesModal');
        if (modal) modal.remove();
    },

    onColumnChange() {
        this.readTableBuilderValues();
        this.renderTableBuilder();
    },

    addColumn() {
        this.readTableBuilderValues();
        this.tableBuilder.columns.push({ titre: '', editable: true });
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => [...row, '']);
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    removeColumn(index) {
        if (this.tableBuilder.columns.length <= 1) {
            alert('Il faut au moins une colonne');
            return;
        }
        this.readTableBuilderValues();
        this.tableBuilder.columns.splice(index, 1);
        this.tableBuilder.rows = this.tableBuilder.rows.map(row => {
            row.splice(index, 1);
            return row;
        });
        this.renderColumnsBuilder();
        this.renderTableBuilder();
    },

    addRow() {
        this.readTableBuilderValues();
        const newRow = this.tableBuilder.columns.map(() => '');
        this.tableBuilder.rows.push(newRow);
        this.renderTableBuilder();
    },

    removeRow(index) {
        if (this.tableBuilder.rows.length <= 1) {
            alert('Il faut au moins une ligne');
            return;
        }
        this.readTableBuilderValues();
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
            extraStyles = `
                .carte-container { position: relative; display: inline-block; max-width: 100%; }
                .carte-image { max-width: 100%; height: auto; display: block; border-radius: 8px; }
                .carte-marker { position: absolute; width: 32px; height: 32px; background: #6366f1; color: white;
                    border: 3px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 14px; transform: translate(-50%, -50%); cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
                .carte-marker:hover { background: #4f46e5; transform: translate(-50%, -50%) scale(1.1); }
                .carte-marker .badge { position: absolute; top: -8px; left: 100%; margin-left: 4px; background: white;
                    color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
                .preview-note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 1rem;
                    font-size: 0.875rem; color: #92400e; }
            `;
            const imageUrl = this.convertToDirectImageUrl(donnees.imageUrl);
            contentHTML = `
                <div class="carte-container">
                    <img src="${this.escapeHtml(imageUrl)}" class="carte-image" alt="Carte" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div style="display:none; padding: 2rem; background: #fee2e2; color: #991b1b; border-radius: 8px; text-align: center;">
                        ⚠️ Impossible de charger l'image. Vérifiez le lien.
                    </div>
                    ${donnees.marqueurs.map((m, i) => `
                        <div class="carte-marker" style="left: ${m.x}%; top: ${m.y}%;${m.couleur ? ' background: ' + m.couleur + ';' : ''}">
                            ${i + 1}
                            <span class="badge">${this.escapeHtml(m.reponse)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="preview-note">
                    <strong>Aperçu admin:</strong> Les élèves cliqueront sur les numéros pour saisir leur réponse dans un popup.
                    Les réponses attendues (${donnees.marqueurs.length}) sont affichées ici à titre indicatif.
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
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(donnees.document.contenu)}</p>`;
            contentHTML = `
                <div class="qo-layout">
                    <div class="qo-document">${docContent}</div>
                    <div class="qo-questions">
                        ${donnees.questions.map((q, i) => `
                            <div class="qo-question">
                                <div class="qo-question-text">${i + 1}. ${this.escapeHtml(q.question)}</div>
                                <textarea class="qo-textarea" placeholder="Votre réponse..."></textarea>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_tableau') {
            // Document + Table format
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
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            const docContent = docType === 'image'
                ? `<img src="${this.escapeHtml(docImgUrl)}" alt="Document">`
                : `<p>${this.escapeHtml(docContenu)}</p>`;
            contentHTML = `
                <div class="dt-layout">
                    <div class="dt-document">${docContent}</div>
                    <div class="dt-table">
                        <table>
                            <thead>
                                <tr>
                                    ${donnees.colonnes.map(col => `<th class="${col.editable ? 'editable' : ''}">${this.escapeHtml(col.titre)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${donnees.lignes.map(ligne => `
                                    <tr>
                                        ${donnees.colonnes.map((col, i) => col.editable
                                            ? `<td class="input-cell"><input type="text" placeholder="..."></td>`
                                            : `<td class="data-cell">${this.escapeHtml(ligne.cells[i] || '')}</td>`
                                        ).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else if (formatUI === 'document_mixte') {
            // Document Mixte format
            const donnees = this.buildDataFromDocumentMixte();
            const layout = donnees.layout || 'vertical';

            extraStyles = `
                .mixte-container { display: flex; flex-direction: column; gap: 1.5rem; }
                .mixte-container.horizontal { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
                .mixte-container.horizontal .mixte-left, .mixte-container.horizontal .mixte-right { display: flex; flex-direction: column; gap: 1rem; }
                .mixte-section { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .mixte-section-header { padding: 0.75rem 1rem; font-weight: 600; }
                .doc-header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
                .tableau-header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; }
                .questions-header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
                .mixte-doc-content { padding: 1rem; }
                .mixte-doc-content img { max-width: 100%; height: auto; border-radius: 4px; }
                .mixte-doc-content iframe { width: 100%; height: 300px; border: none; }
                .mixte-doc-legend { padding: 0.75rem 1rem; font-size: 0.9rem; color: #666; border-top: 1px solid #eee; }
                .tableau-section-row { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 0.6rem 1rem; font-weight: 600; }
                .tableau-row { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e5e7eb; }
                .tableau-row:last-child { border-bottom: none; }
                .tableau-row .label { padding: 0.75rem 1rem; background: #f9fafb; font-weight: 500; border-right: 1px solid #e5e7eb; }
                .tableau-row .input { padding: 0.75rem 1rem; background: #fef3c7; }
                .tableau-row .input input { width: 100%; padding: 0.5rem; border: 1px solid #fbbf24; border-radius: 4px; }
                .question-item { padding: 1rem; border-bottom: 1px solid #eee; }
                .question-item:last-child { border-bottom: none; }
                .question-text { font-weight: 500; margin-bottom: 0.5rem; }
                .question-textarea { width: 100%; min-height: 80px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; resize: vertical; }
            `;

            // Build document HTML
            let docHTML = '';
            if (donnees.document?.actif) {
                const doc = donnees.document;
                const converted = this.convertGoogleUrl(doc.url);
                let docContent = '';
                if (converted.type === 'drive_file') {
                    docContent = `<img src="${converted.imageUrl}" alt="Document" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                        <iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
                } else if (converted.iframeUrl) {
                    docContent = `<iframe src="${converted.iframeUrl}"></iframe>`;
                } else if (doc.url) {
                    docContent = `<img src="${this.convertToDirectImageUrl(doc.url)}" alt="Document">`;
                }
                docHTML = `
                    <div class="mixte-section">
                        ${doc.titre ? `<div class="mixte-section-header doc-header">${this.escapeHtml(doc.titre)}</div>` : ''}
                        <div class="mixte-doc-content">${docContent || '<div style="color:#999;">Aucun document</div>'}</div>
                        ${doc.legende ? `<div class="mixte-doc-legend">${this.escapeHtml(doc.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>` : ''}
                    </div>
                `;
            }

            // Build tableau HTML
            let tableauHTML = '';
            if (donnees.tableau?.actif) {
                const elements = donnees.tableau.elements || [];
                let tableContent = elements.map(el => {
                    if (el.type === 'section') {
                        return `<div class="tableau-section-row">${this.escapeHtml(el.text)}</div>`;
                    } else {
                        // Show empty input like student will see
                        return `<div class="tableau-row">
                            <div class="label">${this.escapeHtml(el.label)}</div>
                            <div class="input"><input type="text" placeholder=""></div>
                        </div>`;
                    }
                }).join('');

                tableauHTML = `
                    <div class="mixte-section">
                        <div class="mixte-section-header tableau-header">${this.escapeHtml(donnees.tableau.titre) || 'À COMPLÉTER'}</div>
                        ${tableContent || '<div style="padding:1rem;color:#999;">Aucun élément</div>'}
                    </div>
                `;
            }

            // Build questions HTML
            let questionsHTML = '';
            if (donnees.questions?.actif) {
                const questions = donnees.questions.liste || [];
                let questionsContent = questions.map((q, i) => `
                    <div class="question-item">
                        <div class="question-text">${i + 1}. ${this.escapeHtml(q.question)}</div>
                        <textarea class="question-textarea" placeholder="Votre réponse..."></textarea>
                    </div>
                `).join('');

                questionsHTML = `
                    <div class="mixte-section">
                        <div class="mixte-section-header questions-header">Questions ouvertes</div>
                        ${questionsContent || '<div style="padding:1rem;color:#999;">Aucune question</div>'}
                    </div>
                `;
            }

            // Combine based on layout
            if (layout === 'horizontal' && docHTML && (tableauHTML || questionsHTML)) {
                contentHTML = `<div class="mixte-container horizontal">
                    <div class="mixte-left">${docHTML}</div>
                    <div class="mixte-right">${tableauHTML}${questionsHTML}</div>
                </div>`;
            } else {
                contentHTML = `<div class="mixte-container">${docHTML}${tableauHTML}${questionsHTML}</div>`;
            }
        } else {
            // Default: tableau_saisie
            this.readTableBuilderValues();
            const donnees = this.buildDataFromTableBuilder();
            extraStyles = `
                table { width: 100%; border-collapse: collapse; }
                th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
                th.editable { background: #dbeafe; color: #2563eb; }
                td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
                .data-cell { font-weight: 500; }
                .input-cell input { width: 100%; padding: 8px 12px; border: 2px solid #dbeafe; border-radius: 6px; font-size: 14px; }
            `;
            contentHTML = `
                <table>
                    <thead>
                        <tr>
                            ${donnees.colonnes.map(col => `<th class="${col.editable ? 'editable' : ''}">${this.escapeHtml(col.titre)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${donnees.lignes.map(ligne => `
                            <tr>
                                ${donnees.colonnes.map((col, i) => col.editable
                                    ? `<td class="input-cell"><input type="text" placeholder="..."></td>`
                                    : `<td class="data-cell">${this.escapeHtml(ligne.cells[i] || '')}</td>`
                                ).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prévisualisation - ${this.escapeHtml(titre)}</title>
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
                        <h1>${this.escapeHtml(titre)}</h1>
                    </div>
                    ${consigne ? `<div class="preview-consigne">${this.escapeHtml(consigne)}</div>` : ''}
                    <div class="preview-content">
                        ${contentHTML}
                    </div>
                </div>
            </body>
            </html>
        `);
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
            document.getElementById('documentSectionTableau').style.display = 'block';
            this.initTableBuilder();
        } else if (typeUI === 'document_mixte') {
            document.getElementById('builderDocumentMixte').style.display = 'block';
            this.initDocumentMixteBuilder();
        } else {
            // Default: tableau_saisie
            document.getElementById('builderTableau').style.display = 'block';
            document.getElementById('documentSectionTableau').style.display = 'none';
            this.initTableBuilder();
        }
    },

    // ========== CARTE CLIQUABLE BUILDER ==========
    initCarteBuilder() {
        this.carteBuilder = { imageUrl: '', marqueurs: [] };
        document.getElementById('carteImageUrl').value = '';
        document.getElementById('cartePreviewWrapper').style.display = 'none';
        document.getElementById('cartePreviewPlaceholder').style.display = 'block';
        this.renderMarqueursList();
    },

    loadCarteBuilderFromData(donnees) {
        this.carteBuilder = {
            imageUrl: donnees.image_url || '',
            marqueurs: (donnees.marqueurs || []).map(m => ({
                x: m.x,
                y: m.y,
                reponse: m.reponse || '',
                couleur: m.couleur || '#6366f1'
            }))
        };
        document.getElementById('carteImageUrl').value = this.carteBuilder.imageUrl;
        if (this.carteBuilder.imageUrl) {
            this.updateCartePreview(this.carteBuilder.imageUrl);
        }
        this.renderMarqueursList();
    },

    updateCartePreview(url) {
        // Convert Google Drive share links to direct image URLs
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
            placeholder.textContent = 'Entrez une URL d\'image ci-dessus pour voir l\'apercu';
        }
    },

    // Convert Google Drive share links to direct image URLs
    convertToDirectImageUrl(url) {
        if (!url) return url;

        // Pattern: https://drive.google.com/file/d/FILE_ID/view...
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) {
            const fileId = driveMatch[1];
            // Use lh3.googleusercontent.com format which works better for embedding
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }

        // Already a direct link or other URL format
        return url;
    },

    renderCarteMarkers() {
        const container = document.getElementById('cartePreviewMarkers');
        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => `
            <div class="carte-marker-preview"
                 style="left: ${m.x}%; top: ${m.y}%;${m.couleur ? ' background: ' + m.couleur + ';' : ''}"
                 title="Marqueur ${i + 1}: ${this.escapeHtml(m.reponse)}">
                ${i + 1}
            </div>
        `).join('');

        // Add click handler to image for adding markers
        const wrapper = document.getElementById('cartePreviewWrapper');
        wrapper.onclick = (e) => {
            const rect = wrapper.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
            const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
            this.addMarqueur(parseFloat(x), parseFloat(y));
        };
    },

    addMarqueur(x, y) {
        this.carteBuilder.marqueurs.push({ x, y, reponse: '', couleur: '#6366f1' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    addMarqueurManual() {
        this.carteBuilder.marqueurs.push({ x: 50, y: 50, reponse: '', couleur: '#6366f1' });
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    removeMarqueur(index) {
        this.carteBuilder.marqueurs.splice(index, 1);
        this.renderCarteMarkers();
        this.renderMarqueursList();
    },

    renderMarqueursList() {
        const container = document.getElementById('marqueursList');
        if (this.carteBuilder.marqueurs.length === 0) {
            container.innerHTML = '<div class="exercices-empty">Aucun marqueur. Cliquez sur l\'image ou ajoutez manuellement.</div>';
            return;
        }

        const colors = this.MARKER_COLORS;

        container.innerHTML = this.carteBuilder.marqueurs.map((m, i) => {
            const reponseValue = m.reponse || '';
            const alternatives = reponseValue.split('|');
            const mainAnswer = alternatives[0] || '';
            const altCount = alternatives.length - 1;
            const markerColor = m.couleur || '#6366f1';
            const colorDots = colors.map(c => `
                <span class="marker-color-dot${c.value === markerColor ? ' active' : ''}"
                      style="width: 18px; height: 18px; background: ${c.value}; border-radius: 50%;
                             border: 2px solid ${c.value === markerColor ? '#1f2937' : 'transparent'};
                             cursor: pointer; display: inline-block; transition: border-color 0.15s;"
                      title="${c.label}"
                      data-index="${i}" data-color="${c.value}"></span>
            `).join('');
            return `
            <div class="marqueur-item">
                <span class="marqueur-num" style="background: ${markerColor};">${i + 1}</span>
                <div class="marqueur-coords">X: ${m.x}% Y: ${m.y}%</div>
                <div class="marqueur-answer-wrapper">
                    <input type="text" class="form-input marqueur-reponse" data-index="${i}"
                           value="${this.escapeHtml(mainAnswer)}" placeholder="Réponse attendue...">
                    <button type="button" class="btn-alternatives-small ${altCount > 0 ? 'has-alternatives' : ''}"
                            onclick="AdminBanquesExercices.openMarqueurAlternativesModal(${i})"
                            title="Réponses alternatives">
                        ±${altCount > 0 ? `<span class="alt-count">${altCount}</span>` : ''}
                    </button>
                </div>
                <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeMarqueur(${i})">&times;</button>
                <div class="marqueur-color-row" style="display: flex; gap: 4px; align-items: center; width: 100%; padding-left: 30px; margin-top: 4px;">
                    <span style="font-size: 0.7rem; color: var(--gray-400); margin-right: 2px;">Couleur :</span>
                    ${colorDots}
                </div>
            </div>
        `;}).join('');

        // Add listeners for reponse inputs (main answer only)
        container.querySelectorAll('.marqueur-reponse').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.updateMarqueurMainAnswer(idx, e.target.value);
            });
        });

        // Add listeners for color dots
        container.querySelectorAll('.marker-color-dot').forEach(dot => {
            dot.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const color = e.target.dataset.color;
                this.updateMarqueurCouleurSF(idx, color);
            });
        });
    },

    updateMarqueurCouleurSF(index, couleur) {
        if (this.carteBuilder.marqueurs[index]) {
            this.carteBuilder.marqueurs[index].couleur = couleur;
            this.renderCarteMarkers();
            this.renderMarqueursList();
        }
    },

    updateMarqueurMainAnswer(index, newMainAnswer) {
        const reponseValue = this.carteBuilder.marqueurs[index].reponse || '';
        const alternatives = reponseValue.split('|');
        alternatives[0] = newMainAnswer;
        this.carteBuilder.marqueurs[index].reponse = alternatives.join('|');
    },

    openMarqueurAlternativesModal(index) {
        const reponseValue = this.carteBuilder.marqueurs[index].reponse || '';
        const alternatives = reponseValue.split('|');
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
                    <h3>Réponses alternatives - Marqueur ${index + 1}</h3>
                    <button type="button" class="modal-close" onclick="AdminBanquesExercices.closeAlternativesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="help-text">La réponse principale est "<strong>${this.escapeHtml(mainAnswer)}</strong>". Ajoutez des réponses alternatives qui seront aussi acceptées.</p>
                    <div id="alternativesList">
                        ${altAnswers.map((alt, i) => `
                            <div class="alternative-item">
                                <input type="text" class="alt-input" value="${this.escapeHtml(alt)}" placeholder="Réponse alternative ${i + 1}">
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
                    <button type="button" class="btn btn-primary" onclick="AdminBanquesExercices.saveMarqueurAlternatives(${index})">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        if (altAnswers.length === 0) {
            this.addAlternativeInput();
        }
    },

    saveMarqueurAlternatives(index) {
        const mainInput = document.querySelector(`.marqueur-reponse[data-index="${index}"]`);
        const mainAnswer = mainInput ? mainInput.value : '';
        const altInputs = document.querySelectorAll('#alternativesList .alt-input');
        const alternatives = [mainAnswer];

        altInputs.forEach(input => {
            const val = input.value.trim();
            if (val) alternatives.push(val);
        });

        this.carteBuilder.marqueurs[index].reponse = alternatives.join('|');
        this.closeAlternativesModal();
        this.renderMarqueursList();
    },

    buildDataFromCarteBuilder() {
        return {
            image_url: this.carteBuilder.imageUrl,
            marqueurs: this.carteBuilder.marqueurs.map((m, i) => ({
                id: i,
                x: m.x,
                y: m.y,
                reponse: m.reponse,
                couleur: m.couleur || '#6366f1'
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

        this.questionBuilder.questions = Array.from(items).map((item, qIndex) => {
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
                    <input type="text" class="form-input question-titre" value="${this.escapeHtml(q.titre)}" placeholder="Titre de la question">
                    <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeQuestion(${qIndex})">&times;</button>
                </div>
                <div class="question-etapes">
                    <label>Etapes/Guidage</label>
                    ${q.etapes.map((e, eIndex) => `
                        <div class="etape-row">
                            <input type="text" class="form-input etape-input" value="${this.escapeHtml(e)}" placeholder="Ex: Identifiez les elements cles...">
                            <button type="button" class="btn-icon danger" onclick="AdminBanquesExercices.removeEtape(${qIndex}, ${eIndex})">&times;</button>
                        </div>
                    `).join('')}
                    <button type="button" class="btn btn-secondary btn-sm" onclick="AdminBanquesExercices.addEtape(${qIndex})">+ Etape</button>
                </div>
                <div class="question-correction-wrap">
                    <label>Correction attendue</label>
                    <textarea class="form-textarea question-correction" rows="3" placeholder="Reponse modele...">${this.escapeHtml(q.reponse_attendue)}</textarea>
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

    // ========== DOCUMENT MIXTE BUILDER ==========
    initDocumentMixteBuilder() {
        this.mixteBuilder = {
            document: { actif: true, type: 'url', url: '', texte: '', titre: '', legende: '' },
            tableau: { actif: false, titre: '', elements: [] },
            questions: { actif: false, liste: [] },
            sectionOrder: ['document', 'tableau', 'questions'],
            layout: 'vertical'
        };

        // Reset UI
        document.getElementById('toggleDocument').checked = true;
        document.getElementById('toggleTableau').checked = false;
        document.getElementById('toggleQuestions').checked = false;
        document.getElementById('mixteLayoutSelect').value = 'vertical';
        document.getElementById('docUrlMixte').value = '';
        document.getElementById('docTitreMixte').value = '';
        document.getElementById('docLegendeMixte').value = '';
        document.getElementById('tableauTitreMixte').value = '';
        document.getElementById('tableauElementsList').innerHTML = '';
        document.getElementById('questionsListMixte').innerHTML = '';

        // Reset document type toggle
        const docTypeUrl = document.querySelector('input[name="docType"][value="url"]');
        if (docTypeUrl) docTypeUrl.checked = true;
        const docTexteEl = document.getElementById('docTexteMixte');
        if (docTexteEl) docTexteEl.innerHTML = '';
        this.toggleDocType('url');

        // Show/hide sections
        document.getElementById('sectionDocument').style.display = 'block';
        document.getElementById('sectionTableau').style.display = 'none';
        document.getElementById('sectionQuestions').style.display = 'none';

        // Initialize drag and drop
        this.initMixteDragDrop();

        // Update preview
        this.updateMixtePreview();
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

        if (this.mixteBuilder && this.mixteBuilder.document) {
            this.mixteBuilder.document.type = type;
        }

        this.updateMixtePreview();
    },

    onLayoutChange(layout) {
        if (this.mixteBuilder) {
            this.mixteBuilder.layout = layout;
        }
        this.updateMixtePreview();
    },

    loadDocumentMixteFromData(donnees) {
        if (!donnees) return;

        // Handle both old format (colonnes/lignes) and new format (elements)
        let tableauData = donnees.tableau || { actif: false, titre: '', elements: [] };

        // Convert old format to new format if needed
        if (tableauData.colonnes && !tableauData.elements) {
            tableauData.elements = this.convertOldTableauFormat(tableauData);
        }

        const docData = donnees.document || { actif: true, type: 'url', url: '', texte: '', titre: '', legende: '' };

        this.mixteBuilder = {
            document: {
                actif: docData.actif !== undefined ? docData.actif : true,
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
            sectionOrder: donnees.sectionOrder || ['document', 'tableau', 'questions'],
            layout: donnees.layout || 'vertical'
        };

        // Set toggles
        document.getElementById('toggleDocument').checked = this.mixteBuilder.document.actif;
        document.getElementById('toggleTableau').checked = this.mixteBuilder.tableau.actif;
        document.getElementById('toggleQuestions').checked = this.mixteBuilder.questions.actif;
        document.getElementById('mixteLayoutSelect').value = this.mixteBuilder.layout;

        // Set document type toggle
        const docType = this.mixteBuilder.document.type || 'url';
        const docTypeRadio = document.querySelector(`input[name="docType"][value="${docType}"]`);
        if (docTypeRadio) docTypeRadio.checked = true;
        this.toggleDocType(docType);

        // Set document fields
        document.getElementById('docUrlMixte').value = this.mixteBuilder.document.url || '';
        const docTexteEl = document.getElementById('docTexteMixte');
        if (docTexteEl) docTexteEl.innerHTML = this.mixteBuilder.document.texte || '';
        document.getElementById('docTitreMixte').value = this.mixteBuilder.document.titre || '';
        document.getElementById('docLegendeMixte').value = this.mixteBuilder.document.legende || '';

        // Set tableau fields
        document.getElementById('tableauTitreMixte').value = this.mixteBuilder.tableau.titre || '';
        this.renderTableauElements();

        // Set questions
        this.renderMixteQuestions();

        // Show/hide sections based on toggles
        document.getElementById('sectionDocument').style.display = this.mixteBuilder.document.actif ? 'block' : 'none';
        document.getElementById('sectionTableau').style.display = this.mixteBuilder.tableau.actif ? 'block' : 'none';
        document.getElementById('sectionQuestions').style.display = this.mixteBuilder.questions.actif ? 'block' : 'none';

        // Reorder sections
        this.reorderMixteSections();

        this.initMixteDragDrop();
        this.updateMixtePreview();
    },

    // Convert old colonnes/lignes format to new elements format
    convertOldTableauFormat(oldTableau) {
        const elements = [];
        const colonnes = oldTableau.colonnes || [];
        const lignes = oldTableau.lignes || [];

        // If we have 2 columns (label/response pattern), convert to rows
        if (colonnes.length === 2 && colonnes[1].editable) {
            lignes.forEach(ligne => {
                elements.push({
                    type: 'row',
                    label: ligne.cells[0] || '',
                    placeholder: ligne.cells[1] || ''
                });
            });
        }
        return elements;
    },

    onMixteToggle(section, checked) {
        this.mixteBuilder[section].actif = checked;

        const sectionEl = document.getElementById(`section${section.charAt(0).toUpperCase() + section.slice(1)}`);
        if (sectionEl) {
            sectionEl.style.display = checked ? 'block' : 'none';
        }

        // Add to order if not present
        if (checked && !this.mixteBuilder.sectionOrder.includes(section)) {
            this.mixteBuilder.sectionOrder.push(section);
        }

        this.updateMixtePreview();
    },

    initMixteDragDrop() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');

        sections.forEach(section => {
            const handle = section.querySelector('.drag-handle');
            if (!handle) return;

            handle.addEventListener('mousedown', (e) => {
                section.setAttribute('draggable', 'true');
            });

            section.addEventListener('dragstart', (e) => {
                section.classList.add('dragging');
                e.dataTransfer.setData('text/plain', section.dataset.section);
            });

            section.addEventListener('dragend', () => {
                section.classList.remove('dragging');
                section.removeAttribute('draggable');
                this.updateSectionOrder();
                this.updateMixtePreview();
            });

            section.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== section) {
                    section.classList.add('drag-over');
                    const rect = section.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, section);
                    } else {
                        container.insertBefore(dragging, section.nextSibling);
                    }
                }
            });

            section.addEventListener('dragleave', () => {
                section.classList.remove('drag-over');
            });

            section.addEventListener('drop', () => {
                section.classList.remove('drag-over');
            });
        });
    },

    updateSectionOrder() {
        const container = document.getElementById('mixteBuilderSections');
        const sections = container.querySelectorAll('.mixte-section');
        this.mixteBuilder.sectionOrder = Array.from(sections).map(s => s.dataset.section);
    },

    reorderMixteSections() {
        const container = document.getElementById('mixteBuilderSections');
        const order = this.mixteBuilder.sectionOrder;

        order.forEach(sectionName => {
            const section = container.querySelector(`[data-section="${sectionName}"]`);
            if (section) {
                container.appendChild(section);
            }
        });
    },

    // Flexible Tableau Elements
    addTableauElement(type) {
        // Ensure mixteBuilder is initialized
        if (!this.mixteBuilder) {
            this.initDocumentMixteBuilder();
        }
        if (!this.mixteBuilder.tableau.elements) {
            this.mixteBuilder.tableau.elements = [];
        }

        if (type === 'section') {
            this.mixteBuilder.tableau.elements.push({
                type: 'section',
                text: ''
            });
        } else if (type === 'row') {
            this.mixteBuilder.tableau.elements.push({
                type: 'row',
                label: '',
                reponse: ''
            });
        }
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
        this.updateMixtePreview();
    },

    removeTableauElement(index) {
        this.mixteBuilder.tableau.elements.splice(index, 1);
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
        this.updateMixtePreview();
    },

    renderTableauElements() {
        const container = document.getElementById('tableauElementsList');
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            container.innerHTML = '<div style="color:#999;font-style:italic;padding:1rem;text-align:center;">Ajoutez des sections et des lignes</div>';
            return;
        }

        container.innerHTML = elements.map((el, i) => {
            if (el.type === 'section') {
                return `
                    <div class="tableau-element section-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">⋮⋮</span>
                        <div class="element-content">
                            <input type="text" class="section-input" value="${this.escapeHtml(el.text)}"
                                   placeholder="Titre de la section (ex: OEUVRE D'ORIGINE)"
                                   onchange="AdminBanquesExercices.updateTableauElement(${i}, 'text', this.value)">
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>
                `;
            } else {
                const reponseValue = el.reponse || '';
                const alternatives = reponseValue.split('|');
                const mainAnswer = alternatives[0] || '';
                const altCount = alternatives.length - 1;
                return `
                    <div class="tableau-element row-element" data-index="${i}" draggable="true">
                        <span class="drag-handle-small">⋮⋮</span>
                        <div class="element-content">
                            <div class="row-inputs">
                                <input type="text" class="label-input" value="${this.escapeHtml(el.label)}"
                                       placeholder="Label (ex: Auteur)"
                                       onchange="AdminBanquesExercices.updateTableauElement(${i}, 'label', this.value)">
                                <div class="answer-with-alternatives">
                                    <input type="text" class="answer-input" value="${this.escapeHtml(mainAnswer)}"
                                           data-element-index="${i}"
                                           placeholder="Réponse attendue"
                                           onchange="AdminBanquesExercices.updateTableauElementMainAnswer(${i}, this.value)">
                                    <button type="button" class="btn-alternatives-small ${altCount > 0 ? 'has-alternatives' : ''}"
                                            onclick="AdminBanquesExercices.openTableauElementAlternativesModal(${i})"
                                            title="Réponses alternatives">
                                        ±${altCount > 0 ? `<span class="alt-count">${altCount}</span>` : ''}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="btn-remove" onclick="AdminBanquesExercices.removeTableauElement(${i})">×</button>
                    </div>
                `;
            }
        }).join('');
    },

    updateTableauElement(index, field, value) {
        this.mixteBuilder.tableau.elements[index][field] = value;
        this.updateMixtePreview();
    },

    // Gestion des alternatives pour les éléments tableau du Document Mixte
    updateTableauElementMainAnswer(index, newMainAnswer) {
        const el = this.mixteBuilder.tableau.elements[index];
        const reponseValue = el.reponse || '';
        const alternatives = reponseValue.split('|');
        alternatives[0] = newMainAnswer;
        el.reponse = alternatives.join('|');
        this.updateMixtePreview();
    },

    openTableauElementAlternativesModal(index) {
        const el = this.mixteBuilder.tableau.elements[index];
        const reponseValue = el.reponse || '';
        const alternatives = reponseValue.split('|');
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
                    <h3>Réponses alternatives</h3>
                    <button type="button" class="modal-close" onclick="AdminBanquesExercices.closeAlternativesModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="help-text">La réponse principale est "<strong>${this.escapeHtml(mainAnswer)}</strong>". Ajoutez des réponses alternatives qui seront aussi acceptées.</p>
                    <div id="alternativesList">
                        ${altAnswers.map((alt, i) => `
                            <div class="alternative-item">
                                <input type="text" class="alt-input" value="${this.escapeHtml(alt)}" placeholder="Réponse alternative ${i + 1}">
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

        if (altAnswers.length === 0) {
            this.addAlternativeInput();
        }
    },

    saveTableauElementAlternatives(index) {
        const mainInput = document.querySelector(`input[data-element-index="${index}"]`);
        const mainAnswer = mainInput ? mainInput.value : '';
        const altInputs = document.querySelectorAll('#alternativesList .alt-input');
        const alternatives = [mainAnswer];

        altInputs.forEach(input => {
            const val = input.value.trim();
            if (val) alternatives.push(val);
        });

        this.mixteBuilder.tableau.elements[index].reponse = alternatives.join('|');
        this.closeAlternativesModal();
        this.renderTableauElements();
        this.updateMixtePreview();
    },

    initTableauElementsDragDrop() {
        const container = document.getElementById('tableauElementsList');
        const items = container.querySelectorAll('.tableau-element');

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.index);
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this.updateTableauElementsOrder();
                this.updateMixtePreview();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== item) {
                    item.classList.add('drag-over');
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        container.insertBefore(dragging, item);
                    } else {
                        container.insertBefore(dragging, item.nextSibling);
                    }
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', () => {
                item.classList.remove('drag-over');
            });
        });
    },

    updateTableauElementsOrder() {
        const container = document.getElementById('tableauElementsList');
        const items = container.querySelectorAll('.tableau-element');
        const oldElements = [...this.mixteBuilder.tableau.elements];
        const newElements = [];

        items.forEach(item => {
            const oldIndex = parseInt(item.dataset.index);
            newElements.push(oldElements[oldIndex]);
        });

        this.mixteBuilder.tableau.elements = newElements;
        this.renderTableauElements();
        this.initTableauElementsDragDrop();
    },

    // Questions for mixte
    addQuestionMixte() {
        this.mixteBuilder.questions.liste.push({
            question: '',
            reponse_attendue: ''
        });
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    removeQuestionMixte(index) {
        this.mixteBuilder.questions.liste.splice(index, 1);
        this.renderMixteQuestions();
        this.updateMixtePreview();
    },

    renderMixteQuestions() {
        const container = document.getElementById('questionsListMixte');
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
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Souligné"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">🎨</option>
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
                <div class="question-label" style="margin-top:0.5rem;">Réponse attendue (pour correction)</div>
                <div class="wysiwyg-container wysiwyg-mini">
                    <div class="wysiwyg-toolbar">
                        <button type="button" class="wysiwyg-btn" data-cmd="bold" title="Gras"><b>G</b></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="italic" title="Italique"><i>I</i></button>
                        <button type="button" class="wysiwyg-btn" data-cmd="underline" title="Souligné"><u>S</u></button>
                        <select class="wysiwyg-color" data-cmd="foreColor" title="Couleur">
                            <option value="">🎨</option>
                            <option value="#dc2626">Rouge</option>
                            <option value="#2563eb">Bleu</option>
                            <option value="#16a34a">Vert</option>
                        </select>
                    </div>
                    <div class="wysiwyg-editor" contenteditable="true"
                         data-index="${i}" data-field="reponse_attendue"
                         data-placeholder="Réponse modèle..."
                         oninput="AdminBanquesExercices.updateMixteQuestion(${i}, 'reponse_attendue', this.innerHTML)">${q.reponse_attendue || ''}</div>
                </div>
                <div class="alternatives-section-mixte">
                    <button type="button" class="btn-toggle-alternatives ${altCount > 0 ? 'has-alternatives' : ''}"
                            onclick="AdminBanquesExercices.toggleMixteAlternatives(${i})">
                        <span class="toggle-icon">▶</span>
                        Réponses alternatives ${altCount > 0 ? `(${altCount})` : ''}
                    </button>
                    <div class="alternatives-content" id="altContent_${i}" style="display: none;">
                        <p class="alt-help-text">Ces réponses seront aussi acceptées comme correctes (pour la validation automatique)</p>
                        <div class="alternatives-list-mixte" id="altList_${i}">
                            ${alternatives.map((alt, ai) => `
                                <div class="alternative-item-mixte">
                                    <input type="text" class="alt-input-mixte" value="${this.escapeHtml(alt)}"
                                           onchange="AdminBanquesExercices.updateMixteAlternative(${i}, ${ai}, this.value)"
                                           placeholder="Réponse alternative ${ai + 1}">
                                    <button type="button" class="btn-remove-alt" onclick="AdminBanquesExercices.removeMixteAlternative(${i}, ${ai})">×</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn-add-alt-mixte" onclick="AdminBanquesExercices.addMixteAlternative(${i})">
                            + Ajouter une alternative
                        </button>
                    </div>
                </div>
            </div>
        `;}).join('');
    },

    toggleMixteAlternatives(questionIndex) {
        const content = document.getElementById(`altContent_${questionIndex}`);
        const btn = content.previousElementSibling;
        const icon = btn.querySelector('.toggle-icon');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            icon.textContent = '▼';
        } else {
            content.style.display = 'none';
            icon.textContent = '▶';
        }
    },

    addMixteAlternative(questionIndex) {
        if (!this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives) {
            this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives = [];
        }
        this.mixteBuilder.questions.liste[questionIndex].reponses_alternatives.push('');
        this.renderMixteQuestions();
        // Réouvrir le panneau alternatives
        const content = document.getElementById(`altContent_${questionIndex}`);
        if (content) {
            content.style.display = 'block';
            const btn = content.previousElementSibling;
            const icon = btn.querySelector('.toggle-icon');
            if (icon) icon.textContent = '▼';
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
            // Réouvrir le panneau alternatives
            const content = document.getElementById(`altContent_${questionIndex}`);
            if (content) {
                content.style.display = 'block';
                const btn = content.previousElementSibling;
                const icon = btn.querySelector('.toggle-icon');
                if (icon) icon.textContent = '▼';
            }
        }
    },

    updateMixteQuestion(index, field, value) {
        this.mixteBuilder.questions.liste[index][field] = value;
        this.updateMixtePreview();
    },

    // Convert various Google URLs to embeddable format
    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

        // Google Drive file: /file/d/ID/view
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveFileMatch) {
            const fileId = driveFileMatch[1];
            return {
                type: 'drive_file',
                id: fileId,
                imageUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
                iframeUrl: `https://drive.google.com/file/d/${fileId}/preview`
            };
        }

        // Google Docs: /document/d/ID/
        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            const docId = docsMatch[1];
            return {
                type: 'google_doc',
                id: docId,
                iframeUrl: `https://docs.google.com/document/d/${docId}/preview`
            };
        }

        // Google Sheets: /spreadsheets/d/ID/
        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            const sheetId = sheetsMatch[1];
            return {
                type: 'google_sheet',
                id: sheetId,
                iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/preview`
            };
        }

        // Google Slides: /presentation/d/ID/
        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            const slideId = slidesMatch[1];
            return {
                type: 'google_slide',
                id: slideId,
                iframeUrl: `https://docs.google.com/presentation/d/${slideId}/embed`
            };
        }

        // Regular URL - assume image
        return {
            type: 'direct_url',
            url: url,
            imageUrl: url
        };
    },

    updateMixtePreview() {
        const preview = document.getElementById('mixtePreviewContent');
        if (!this.mixteBuilder) return;

        const layout = this.mixteBuilder.layout || 'vertical';

        // Get active sections in order
        const activeSections = this.mixteBuilder.sectionOrder.filter(s => this.mixteBuilder[s]?.actif);

        if (activeSections.length === 0) {
            preview.innerHTML = '<div class="preview-placeholder">Activez des sections pour voir l\'aperçu</div>';
            return;
        }

        let html = '';

        if (layout === 'horizontal' && activeSections.includes('document')) {
            // Horizontal layout: document on left, rest on right
            const docHTML = this.renderMixteDocumentPreview();
            const otherSections = activeSections.filter(s => s !== 'document');
            let rightHTML = '';
            otherSections.forEach(section => {
                if (section === 'tableau') {
                    rightHTML += this.renderMixteTableauPreview();
                } else if (section === 'questions') {
                    rightHTML += this.renderMixteQuestionsPreview();
                }
            });

            if (rightHTML) {
                html = `<div class="preview-horizontal-layout">
                    <div class="preview-left">${docHTML}</div>
                    <div class="preview-right">${rightHTML}</div>
                </div>`;
            } else {
                html = docHTML;
            }
        } else {
            // Vertical layout
            activeSections.forEach(section => {
                if (section === 'document') {
                    html += this.renderMixteDocumentPreview();
                } else if (section === 'tableau') {
                    html += this.renderMixteTableauPreview();
                } else if (section === 'questions') {
                    html += this.renderMixteQuestionsPreview();
                }
            });
        }

        preview.innerHTML = html;
    },

    renderMixteDocumentPreview() {
        const doc = this.mixteBuilder.document;
        const url = document.getElementById('docUrlMixte').value;
        const titre = document.getElementById('docTitreMixte').value;
        const legende = document.getElementById('docLegendeMixte').value;

        // Parse legende for italics (*text*)
        const legendeHTML = legende.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        const converted = this.convertGoogleUrl(url);
        let contentHTML = '';

        if (!url) {
            contentHTML = '<div style="color:#999;font-style:italic;">Entrez une URL de document</div>';
        } else if (converted.type === 'drive_file') {
            // Try as image first, with iframe fallback
            contentHTML = `<img src="${converted.imageUrl}" alt="Document"
                onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                <iframe src="${converted.iframeUrl}" style="display:none;"></iframe>`;
        } else if (converted.iframeUrl) {
            contentHTML = `<iframe src="${converted.iframeUrl}"></iframe>`;
        } else {
            contentHTML = `<img src="${converted.imageUrl || url}" alt="Document"
                onerror="this.outerHTML='<div style=\\'color:#ef4444;\\'>Impossible de charger l\\'image</div>'">`;
        }

        return `
            <div class="preview-document">
                ${titre ? `<div class="preview-doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="preview-doc-content">${contentHTML}</div>
                ${legende ? `<div class="preview-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    renderMixteTableauPreview() {
        const titre = document.getElementById('tableauTitreMixte').value;
        const elements = this.mixteBuilder.tableau.elements;

        if (elements.length === 0) {
            return '<div class="preview-tableau"><div class="preview-tableau-header">Tableau</div><div style="padding:1rem;color:#999;">Ajoutez des sections et des lignes</div></div>';
        }

        let contentHTML = elements.map(el => {
            if (el.type === 'section') {
                return `<div class="preview-tableau-section">${this.escapeHtml(el.text) || 'Section...'}</div>`;
            } else {
                // Show empty input like student will see, with answer in tooltip
                const reponse = el.reponse || '';
                const label = el.label || 'Label...';
                return `
                    <div class="preview-tableau-row">
                        <div class="row-label">${this.escapeHtml(label)}</div>
                        <div class="row-input-preview" title="Réponse attendue: ${this.escapeHtml(reponse)}">
                            <input type="text" disabled placeholder="Champ élève" class="preview-input">
                            ${reponse ? `<span class="answer-hint">✓ ${this.escapeHtml(reponse)}</span>` : '<span class="answer-missing">⚠ Réponse manquante</span>'}
                        </div>
                    </div>
                `;
            }
        }).join('');

        return `
            <div class="preview-tableau">
                <div class="preview-tableau-header">${this.escapeHtml(titre) || 'À COMPLÉTER'}</div>
                ${contentHTML}
            </div>
        `;
    },

    renderMixteQuestionsPreview() {
        const questions = this.mixteBuilder.questions.liste;

        if (questions.length === 0) {
            return '<div class="preview-questions"><div class="preview-questions-header">Questions</div><div style="padding:1rem;color:#999;">Ajoutez des questions</div></div>';
        }

        return `
            <div class="preview-questions">
                <div class="preview-questions-header">Questions ouvertes</div>
                ${questions.map((q, i) => `
                    <div class="preview-question-item">
                        <div class="preview-question-text">${i + 1}. ${this.escapeHtml(q.question) || 'Question...'}</div>
                        <div class="preview-question-answer">Zone de réponse élève</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    buildDataFromDocumentMixte() {
        // Ensure mixteBuilder is initialized
        if (!this.mixteBuilder) {
            this.initDocumentMixteBuilder();
        }

        // Ensure all nested objects exist
        if (!this.mixteBuilder.document) {
            this.mixteBuilder.document = { actif: false, type: 'url', url: '', texte: '', titre: '', legende: '' };
        }
        if (!this.mixteBuilder.tableau) {
            this.mixteBuilder.tableau = { actif: false, titre: '', elements: [] };
        }
        if (!this.mixteBuilder.tableau.elements) {
            this.mixteBuilder.tableau.elements = [];
        }
        if (!this.mixteBuilder.questions) {
            this.mixteBuilder.questions = { actif: false, liste: [] };
        }
        if (!this.mixteBuilder.questions.liste) {
            this.mixteBuilder.questions.liste = [];
        }

        // Read current values from DOM
        const docUrlEl = document.getElementById('docUrlMixte');
        const docTexteEl = document.getElementById('docTexteMixte');
        const docTitreEl = document.getElementById('docTitreMixte');
        const docLegendeEl = document.getElementById('docLegendeMixte');
        const tableauTitreEl = document.getElementById('tableauTitreMixte');
        const layoutEl = document.getElementById('mixteLayoutSelect');

        // Get document type from radio buttons
        const docTypeRadio = document.querySelector('input[name="docType"]:checked');
        if (docTypeRadio) this.mixteBuilder.document.type = docTypeRadio.value;

        if (docUrlEl) this.mixteBuilder.document.url = docUrlEl.value;
        if (docTexteEl) this.mixteBuilder.document.texte = docTexteEl.innerHTML;
        if (docTitreEl) this.mixteBuilder.document.titre = docTitreEl.value;
        if (docLegendeEl) this.mixteBuilder.document.legende = docLegendeEl.value;
        if (tableauTitreEl) this.mixteBuilder.tableau.titre = tableauTitreEl.value;
        if (layoutEl) this.mixteBuilder.layout = layoutEl.value;

        return {
            document: {
                ...this.mixteBuilder.document,
                type: this.mixteBuilder.document.type || 'url'
            },
            tableau: { ...this.mixteBuilder.tableau, elements: this.mixteBuilder.tableau.elements || [] },
            questions: { ...this.mixteBuilder.questions, liste: this.mixteBuilder.questions.liste || [] },
            sectionOrder: this.mixteBuilder.sectionOrder || ['document', 'tableau', 'questions'],
            layout: this.mixteBuilder.layout || 'vertical'
        };
    },
});
