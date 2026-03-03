/**
 * eleve-exercices-formats.js
 *
 * Rendus HTML des formats d'exercices, affichage des corrections et réinitialisations.
 * Formats supportés : tableau_saisie, carte_cliquable, document_tableau, question_ouverte, document_mixte
 *
 * Étend EleveExercices via Object.assign (même pattern que le module connaissances).
 */
Object.assign(EleveExercices, {
    // ===============================
    // RENDER EXERCISE TYPES
    // ===============================

    renderTableauSaisie(donnees, structure) {
        // Normaliser les données : supporter format v2 (objets) et v1 (ancien)
        const parsed = this._parseTableauDonnees(donnees, structure);
        const colonnes = parsed.colonnes;
        const lignes = parsed.lignes;

        let html = `
            <table class="tableau-exercice">
                <thead>
                    <tr>
                        ${colonnes.map(titre => `<th>${this.escapeHtml(titre)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        lignes.forEach((row, rowIndex) => {
            html += '<tr>';
            row.forEach((cell, colIndex) => {
                if (cell.type === 'reponse') {
                    html += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    html += `<td class="cell-display">${this.escapeHtml(cell.valeur)}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    /**
     * Normalise les données du tableau (v1 ou v2) vers un format interne unifié.
     * Retourne { colonnes: [string], lignes: [[{valeur, type, correction, alternatives}]] }
     */
    _parseTableauDonnees(donnees, structure) {
        // Format v2 : colonnes = strings, cells = objets avec .type
        if (donnees.colonnes && donnees.lignes && donnees.lignes[0]?.cells?.[0]?.type) {
            return {
                colonnes: donnees.colonnes.map(c => typeof c === 'string' ? c : c.titre || ''),
                lignes: donnees.lignes.map(ligne => (ligne.cells || []).map(cell => ({
                    valeur: cell.valeur || '',
                    type: cell.type || 'donnee',
                    correction: cell.correction || 'souple',
                    alternatives: cell.alternatives || []
                })))
            };
        }

        // Format v1 : colonnes = [{titre, editable}], cells = strings
        const colDefs = donnees.colonnes || (structure && structure.colonnes) || [
            { titre: 'Date', editable: false },
            { titre: 'Réponse', editable: true }
        ];
        const rawLignes = donnees.lignes || [];

        return {
            colonnes: colDefs.map(c => c.titre || ''),
            lignes: rawLignes.map(ligne => {
                const cells = ligne.cells || Object.values(ligne);
                return colDefs.map((col, i) => {
                    const raw = String(cells[i] || '');
                    if (col.editable) {
                        const parts = raw.split('|');
                        return {
                            valeur: parts[0],
                            type: 'reponse',
                            correction: 'souple',
                            alternatives: parts.slice(1).filter(a => a.trim())
                        };
                    }
                    return { valeur: raw, type: 'donnee' };
                });
            })
        };
    },

    /** Couleurs carte cliquable (id → hex) */
    CARTE_COLOR_MAP: {
        bleu: '#6366f1', rouge: '#ef4444', vert: '#10b981',
        orange: '#f59e0b', violet: '#8b5cf6', noir: '#374151'
    },

    /** Classe CSS pour la forme du marqueur */
    _getMarqueurShapeClass(shape) {
        const valid = ['cercle', 'losange', 'carre', 'pin'];
        return 'carte-shape-' + (valid.includes(shape) ? shape : 'cercle');
    },

    renderCarteCliquable(donnees, structure) {
        const imageUrl = this.convertToDirectImageUrl(donnees.image_url || '');
        const marqueurs = donnees.marqueurs || [];
        const colorMap = this.CARTE_COLOR_MAP;

        let marqueursHTML = marqueurs.map((m, index) => {
            const colorHex = colorMap[m.color] || colorMap.bleu;
            const shapeClass = this._getMarqueurShapeClass(m.shape);
            return `<div class="carte-marqueur ${shapeClass}" data-id="${m.id || index}"
                 data-reponse="${this.escapeHtml(m.reponse || '')}"
                 data-correction="${m.correction || 'souple'}"
                 style="left: ${m.x}%; top: ${m.y}%; background: ${colorHex};"
                 onclick="EleveExercices.openMarqueurModal(${index})">
                <span class="marqueur-numero">${index + 1}</span>
                <span class="marqueur-reponse-badge hidden" id="badge_${index}"></span>
            </div>`;
        }).join('');

        this.carteMarqueurs = marqueurs;
        this.carteReponses = new Array(marqueurs.length).fill('');
        this.currentMarqueurIndex = null;

        return `
            <div class="carte-cliquable-container">
                <div class="carte-image-wrapper">
                    <img src="${this.escapeHtml(imageUrl)}" alt="Carte" class="carte-image">
                    <div class="carte-marqueurs">${marqueursHTML}</div>
                </div>
            </div>
            <div class="carte-modal-overlay hidden" id="marqueurModal">
                <div class="carte-modal">
                    <div class="carte-modal-header">
                        <h3>Élément n°<span id="modalMarqueurNum"></span></h3>
                        <button class="carte-modal-close" onclick="EleveExercices.closeMarqueurModal()">×</button>
                    </div>
                    <div class="carte-modal-body">
                        <label>Identifiez cet élément :</label>
                        <input type="text" id="marqueurInput" placeholder="Votre réponse..." autocomplete="off">
                    </div>
                    <div class="carte-modal-footer">
                        <button class="btn-cancel" onclick="EleveExercices.closeMarqueurModal()">Annuler</button>
                        <button class="btn-validate" onclick="EleveExercices.saveMarqueurReponse()">Valider</button>
                    </div>
                </div>
            </div>
        `;
    },

    openMarqueurModal(index) {
        this.currentMarqueurIndex = index;
        document.getElementById('modalMarqueurNum').textContent = index + 1;
        document.getElementById('marqueurInput').value = this.carteReponses[index] || '';
        document.getElementById('marqueurModal').classList.remove('hidden');
        document.getElementById('marqueurInput').focus();
    },

    closeMarqueurModal() {
        document.getElementById('marqueurModal').classList.add('hidden');
        this.currentMarqueurIndex = null;
    },

    saveMarqueurReponse() {
        const index = this.currentMarqueurIndex;
        if (index === null) return;

        const reponse = document.getElementById('marqueurInput').value.trim();
        this.carteReponses[index] = reponse;

        const badge = document.getElementById(`badge_${index}`);
        if (badge) {
            if (reponse) {
                badge.textContent = reponse;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (marqueur) {
            marqueur.classList.toggle('answered', reponse !== '');
        }

        this.closeMarqueurModal();
    },

    renderDocumentTableau(donnees, structure) {
        const doc = donnees.document || {};

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        // Réutiliser le même parser que renderTableauSaisie pour supporter v1 et v2
        const parsed = this._parseTableauDonnees(donnees, structure);

        let tableHTML = `
            <table class="tableau-exercice">
                <thead><tr>${parsed.colonnes.map(titre => `<th>${this.escapeHtml(titre)}</th>`).join('')}</tr></thead>
                <tbody>
        `;

        parsed.lignes.forEach((row, rowIndex) => {
            tableHTML += '<tr>';
            row.forEach((cell, colIndex) => {
                if (cell.type === 'reponse') {
                    tableHTML += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    tableHTML += `<td class="cell-display">${this.escapeHtml(cell.valeur)}</td>`;
                }
            });
            tableHTML += '</tr>';
        });

        tableHTML += '</tbody></table>';

        return `
            <div class="document-tableau-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="tableau-section"><h4>À compléter</h4>${tableHTML}</div>
            </div>
        `;
    },

    renderQuestionOuverte(donnees, structure) {
        const doc = donnees.document || {};
        const questions = donnees.questions || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let questionsHTML = questions.map((q, qIndex) => {
            const etapesHTML = (q.etapes || []).map((etape, eIndex) => `
                <div class="question-etape">
                    <label>${this.escapeHtml(etape)}</label>
                    <textarea id="reponse_${qIndex}_${eIndex}" rows="2" placeholder="Votre réponse..."></textarea>
                </div>
            `).join('');

            return `
                <div class="question-ouverte-item" id="question_${qIndex}">
                    <h4>${this.escapeHtml(q.titre || `Question ${qIndex + 1}`)}</h4>
                    ${etapesHTML}
                    <div class="correction-box hidden" id="correctionBox_${qIndex}">
                        <h5>Correction</h5>
                        <div class="correction-content">${this.escapeHtml(q.reponse_attendue || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.questionsOuvertes = questions;

        return `
            <div class="question-ouverte-container">
                <div class="document-section"><h4>Document</h4>${documentHTML}</div>
                <div class="questions-section"><h4>Questions</h4>${questionsHTML}</div>
            </div>
        `;
    },

    renderDocumentMixte(donnees, structure) {
        this.mixteData = donnees;

        // Nouveau format : blocks
        if (donnees.blocks && Array.isArray(donnees.blocks)) {
            return this._renderMixteBlocks(donnees.blocks);
        }

        // Ancien format : document/tableau/questions
        const doc = donnees.document || { actif: false };
        const tableau = donnees.tableau || { actif: false };
        const questions = donnees.questions || { actif: false };
        const sectionOrder = donnees.sectionOrder || ['document', 'tableau', 'questions'];
        const layout = donnees.layout || 'vertical';

        if (layout === 'horizontal' && doc.actif) {
            const docHTML = this.renderMixteDocumentSection(doc);
            let rightHTML = '';
            sectionOrder.forEach(section => {
                if (section === 'tableau' && tableau.actif) {
                    rightHTML += this.renderMixteTableauSection(tableau);
                } else if (section === 'questions' && questions.actif) {
                    rightHTML += this.renderMixteQuestionsSection(questions);
                }
            });

            return `
                <div class="document-mixte-container horizontal-layout">
                    <div class="mixte-left-column">${docHTML}</div>
                    <div class="mixte-right-column">${rightHTML}</div>
                </div>
            `;
        }

        let sectionsHTML = '';
        sectionOrder.forEach(section => {
            if (section === 'document' && doc.actif) {
                sectionsHTML += this.renderMixteDocumentSection(doc);
            } else if (section === 'tableau' && tableau.actif) {
                sectionsHTML += this.renderMixteTableauSection(tableau);
            } else if (section === 'questions' && questions.actif) {
                sectionsHTML += this.renderMixteQuestionsSection(questions);
            }
        });

        return `<div class="document-mixte-container">${sectionsHTML}</div>`;
    },

    // ========== NOUVEAU FORMAT BLOCKS POUR DOCUMENT_MIXTE ==========

    _renderMixteBlocks(blocks) {
        // Collecter les tableaux et questions pour la validation
        this._mixteBlockTableaux = [];
        this._mixteBlockTableauCounter = 0;
        this._mixteBlockQuestions = [];
        this._mixteBlockQuestionCounter = 0;

        const self = this;
        const html = blocks.map(block => self._renderMixteBlock(block)).join('');
        return `<div class="document-mixte-container mixte-blocks-layout">${html}</div>`;
    },

    _renderMixteBlock(block) {
        if (block.type === 'group') {
            return this._renderMixteBlockGroup(block);
        }

        switch (block.type) {
        case 'text': {
            const content = block.content || '';
            const legende = block.legende || '';
            let html = '';
            if (content) {
                html += `<div class="mixte-block-text">${content}</div>`;
            }
            if (legende) {
                html += `<div class="mixte-block-legende">${this.escapeHtml(legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
            }
            return html;
        }
        case 'document': {
            let html = '';
            if (block.titre) {
                html += `<div class="mixte-block-titre">${this.escapeHtml(block.titre)}</div>`;
            }
            if (block.url) {
                const converted = this.convertGoogleUrl(block.url);
                if (converted.type === 'drive_file') {
                    html += `<img src="${converted.imageUrl}" alt="Document" class="mixte-block-doc-img"
                                 onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                             <iframe src="${converted.iframeUrl}" class="mixte-block-doc-iframe" style="display:none;"></iframe>`;
                } else if (converted.iframeUrl) {
                    html += `<iframe src="${this.escapeHtml(converted.iframeUrl)}" class="mixte-block-doc-iframe"></iframe>`;
                } else {
                    html += `<img src="${this.escapeHtml(this.convertToDirectImageUrl(block.url))}" alt="Document" class="mixte-block-doc-img">`;
                }
            }
            if (block.legende) {
                html += `<div class="mixte-block-legende">${this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
            }
            return html;
        }
        case 'image': {
            let html = '';
            if (block.url) {
                const imgSrc = this.convertToDirectImageUrl(block.url);
                html += `<div class="mixte-block-image"><img src="${this.escapeHtml(imgSrc)}" alt="Image"></div>`;
            }
            if (block.legende) {
                html += `<div class="mixte-block-legende">${this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
            }
            return html;
        }
        case 'video': {
            let html = '';
            if (block.url) {
                const embedUrl = this._getVideoEmbedUrl(block.url);
                if (embedUrl) {
                    html += `<div class="mixte-block-video"><iframe src="${this.escapeHtml(embedUrl)}" frameborder="0" allowfullscreen></iframe></div>`;
                }
            }
            if (block.legende) {
                html += `<div class="mixte-block-legende">${this.escapeHtml(block.legende).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</div>`;
            }
            return html;
        }
        case 'tableau': {
            return this._renderMixteBlockTableau(block);
        }
        case 'question': {
            return this._renderMixteBlockQuestion(block);
        }
        default:
            return '';
        }
    },

    _renderMixteBlockGroup(group) {
        const ratio = group.ratio || '50-50';
        const parts = ratio.split('-');
        const leftFlex = parseInt(parts[0]) || 50;
        const rightFlex = parseInt(parts[1]) || 50;

        const self = this;
        const childrenHTML = (group.children || []).map((child, i) => {
            const flex = i === 0 ? leftFlex : rightFlex;
            return `<div class="mixte-blocks-group-child" style="flex:${flex}">${self._renderMixteBlock(child)}</div>`;
        }).join('');

        return `<div class="mixte-blocks-group">${childrenHTML}</div>`;
    },

    _renderMixteBlockTableau(block) {
        const cols = block.colonnes || [];
        const lignes = block.lignes || [];
        const tableIdx = this._mixteBlockTableauCounter++;

        // Stocker le tableau pour la validation
        this._mixteBlockTableaux.push({ cols, lignes, tableIdx });

        const headerHTML = cols.map(c =>
            `<th>${this.escapeHtml(c || '')}</th>`
        ).join('');

        const bodyHTML = lignes.map((ligne, ri) =>
            `<tr>${(ligne.cells || []).map((cell, ci) => {
                if (cell.type === 'reponse') {
                    return `<td class="cell-editable">
                        <input type="text" class="cell-input" id="mixte_btab_${tableIdx}_${ri}_${ci}"
                               placeholder="..." autocomplete="off">
                    </td>`;
                }
                return `<td class="cell-donnee">${this.escapeHtml(cell.valeur || '')}</td>`;
            }).join('')}</tr>`
        ).join('');

        return `
            <div class="mixte-block-tableau">
                <table class="mixte-table">
                    <thead><tr>${headerHTML}</tr></thead>
                    <tbody>${bodyHTML}</tbody>
                </table>
            </div>
        `;
    },

    _renderMixteBlockQuestion(block) {
        const qIdx = this._mixteBlockQuestionCounter++;
        // Stocker la question pour la validation
        this._mixteBlockQuestions.push({
            qIdx,
            reponse: block.reponse || '',
            correction: block.correction || 'souple',
            alternatives: block.alternatives || []
        });

        return `
            <div class="mixte-block-question">
                <label class="mixte-block-question-label">${this.escapeHtml(block.question || '')}</label>
                <input type="text" class="mixte-block-question-input" id="mixte_bq_${qIdx}"
                       placeholder="Votre r\u00e9ponse\u2026" autocomplete="off">
            </div>
        `;
    },

    _getVideoEmbedUrl(url) {
        if (!url) return null;
        // YouTube
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
        if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
        // Google Drive video
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
        if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
        return url;
    },

    renderMixteDocumentSection(doc) {
        const docType = doc.type || 'url';
        const url = doc.url || '';
        const texte = doc.texte || '';
        const titre = doc.titre || '';
        const legende = doc.legende || '';

        const legendeHTML = this.escapeHtml(legende).replace(/\*([^*]+)\*/g, '<em>$1</em>');

        let contentHTML = '';

        if (docType === 'texte' && texte) {
            contentHTML = this.textToHtml(texte);
        } else if (url) {
            const converted = this.convertGoogleUrl(url);
            if (converted.type === 'empty') {
                contentHTML = '<div class="doc-placeholder">Document non disponible</div>';
            } else if (converted.type === 'drive_file') {
                contentHTML = `
                    <img src="${converted.imageUrl}" alt="Document" class="mixte-doc-image"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <iframe src="${converted.iframeUrl}" class="mixte-doc-iframe" style="display:none;"></iframe>
                `;
            } else if (converted.iframeUrl) {
                contentHTML = `<iframe src="${converted.iframeUrl}" class="mixte-doc-iframe"></iframe>`;
            } else {
                contentHTML = `<img src="${this.convertToDirectImageUrl(url)}" alt="Document" class="mixte-doc-image">`;
            }
        } else {
            contentHTML = '<div class="doc-placeholder">Aucun document</div>';
        }

        return `
            <div class="mixte-section mixte-document">
                ${titre ? `<div class="mixte-section-header doc-header">${this.escapeHtml(titre)}</div>` : ''}
                <div class="mixte-doc-content ${docType === 'texte' ? 'doc-text-content' : ''}">${contentHTML}</div>
                ${legende ? `<div class="mixte-doc-legend">${legendeHTML}</div>` : ''}
            </div>
        `;
    },

    textToHtml(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        const paragraphs = html.split(/\n\s*\n/);
        return paragraphs.map(p => {
            const withBreaks = p.trim().replace(/\n/g, '<br>');
            return `<p>${withBreaks}</p>`;
        }).join('');
    },

    renderMixteTableauSection(tableau) {
        const titre = tableau.titre || 'À compléter';

        if (tableau.elements && tableau.elements.length > 0) {
            this.mixteTableauElements = tableau.elements;

            const elementsHTML = tableau.elements.map((el, idx) => {
                if (el.type === 'section') {
                    return `<div class="mixte-tableau-section-row">${this.escapeHtml(el.text)}</div>`;
                } else {
                    return `
                        <div class="mixte-tableau-row">
                            <div class="row-label">${this.escapeHtml(el.label)}</div>
                            <div class="row-input">
                                <input type="text" class="cell-input" id="mixte_element_${idx}"
                                       placeholder="${this.escapeHtml(el.placeholder || '')}" data-index="${idx}"
                                       data-reponse="${this.escapeHtml(el.reponse || '')}" autocomplete="off">
                            </div>
                        </div>
                    `;
                }
            }).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">${elementsHTML}</div>
                </div>
            `;
        } else {
            const colonnes = tableau.colonnes || [];
            const lignes = tableau.lignes || [];

            this.mixteTableauColonnes = colonnes;
            this.mixteTableauLignes = lignes;

            const headerHTML = colonnes.map(col =>
                `<th class="${col.editable ? 'editable-header' : ''}">${this.escapeHtml(col.titre)}</th>`
            ).join('');

            const bodyHTML = lignes.map((ligne, rowIdx) =>
                `<tr>${colonnes.map((col, colIdx) => {
                    if (col.editable) {
                        return `<td class="cell-editable">
                            <input type="text" class="cell-input" id="mixte_cell_${rowIdx}_${colIdx}" placeholder="..." data-row="${rowIdx}" data-col="${colIdx}" autocomplete="off">
                        </td>`;
                    } else {
                        return `<td>${this.escapeHtml(ligne.cells[colIdx] || '')}</td>`;
                    }
                }).join('')}</tr>`
            ).join('');

            return `
                <div class="mixte-section mixte-tableau">
                    <div class="mixte-section-header tableau-header">${this.escapeHtml(titre)}</div>
                    <div class="mixte-tableau-content">
                        <table class="mixte-table">
                            <thead><tr>${headerHTML}</tr></thead>
                            <tbody>${bodyHTML}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
    },

    renderMixteQuestionsSection(questions) {
        const liste = questions.liste || [];
        this.mixteQuestions = liste;

        const questionsHTML = liste.map((q, idx) => `
            <div class="mixte-question-item" id="mixte_question_${idx}">
                <div class="mixte-question-text">${idx + 1}. ${this.escapeHtml(q.question)}</div>
                <textarea id="mixte_answer_${idx}" class="mixte-question-textarea" placeholder="Votre réponse..." rows="3"></textarea>
                <div class="mixte-correction hidden" id="mixte_correction_${idx}">
                    <strong>Correction:</strong> ${this.escapeHtml(q.reponse_attendue || '')}
                </div>
            </div>
        `).join('');

        return `
            <div class="mixte-section mixte-questions">
                <div class="mixte-section-header questions-header">Questions</div>
                <div class="mixte-questions-content">${questionsHTML}</div>
            </div>
        `;
    },

    convertGoogleUrl(url) {
        if (!url) return { type: 'empty', url: '' };

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

        const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
        if (docsMatch) {
            return { type: 'google_doc', id: docsMatch[1], iframeUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview` };
        }

        const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([^\/]+)/);
        if (sheetsMatch) {
            return { type: 'google_sheet', id: sheetsMatch[1], iframeUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview` };
        }

        const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([^\/]+)/);
        if (slidesMatch) {
            return { type: 'google_slide', id: slidesMatch[1], iframeUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed` };
        }

        return { type: 'direct_url', url: url, imageUrl: url };
    },

    // ===============================
    // CORRECTIONS (affichage corrigé)
    // ===============================

    /**
     * Applique les corrections sur l'exercice actuel (remplit les bonnes réponses)
     * @param {string} typeUI - Type d'interface de l'exercice
     */
    applyCorrections(typeUI) {
        const handler = this.getFormatHandler(typeUI);
        if (handler && handler.showCorrection) {
            handler.showCorrection.call(this);
        }
    },

    /**
     * Capture le HTML d'un élément en incluant les valeurs actuelles des inputs
     * (innerHTML ne capture pas les valeurs des inputs, seulement les attributs)
     */
    captureContentWithValues(element) {
        if (!element) return '';

        const clone = element.cloneNode(true);
        const originalInputs = element.querySelectorAll('input, textarea');
        const clonedInputs = clone.querySelectorAll('input, textarea');

        originalInputs.forEach((origInput, idx) => {
            const clonedInput = clonedInputs[idx];
            if (clonedInput) {
                clonedInput.setAttribute('value', origInput.value);
                if (origInput.tagName === 'TEXTAREA') {
                    clonedInput.textContent = origInput.value;
                }
            }
        });

        return clone.innerHTML;
    },

    showCorrige() {
        this.stopTimer();

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        this.applyCorrections(typeUI);

        const banner = document.getElementById('resultBanner');
        banner.className = 'result-banner show info';
        banner.textContent = 'Voici le corrigé complet.';
    },

    showCarteCorrige() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];

        marqueurs.forEach((m, index) => {
            const badge = document.getElementById(`badge_${index}`);
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const userAnswer = reponses[index] || '';
            const correctAnswer = m.reponse || '';
            const isStricte = m.correction === 'stricte';
            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer, isStricte);
            const firstCorrectAnswer = correctAnswer.split(/[|;]/)[0].trim();

            if (badge) {
                badge.classList.add('hidden');
            }

            if (marqueur) {
                marqueur.classList.remove('incorrect', 'correct', 'answered');
                marqueur.classList.add('show-correction');
                marqueur.classList.add(isCorrect ? 'correction-correct' : 'correction-incorrect');

                marqueur.setAttribute('data-user-answer', userAnswer);
                marqueur.setAttribute('data-correct-answer', firstCorrectAnswer);
                marqueur.setAttribute('data-is-correct', isCorrect ? 'true' : 'false');
                marqueur.setAttribute('data-correction-mode', 'true');

                marqueur.setAttribute('onclick', `EleveExercices.openMarqueurCorrectionModal(${index})`);
            }
        });
    },

    /**
     * Ouvre le popup de correction pour un marqueur de carte cliquable
     */
    openMarqueurCorrectionModal(index) {
        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (!marqueur || marqueur.getAttribute('data-correction-mode') !== 'true') {
            this.openMarqueurModal(index);
            return;
        }

        const userAnswer = marqueur.getAttribute('data-user-answer') || '';
        const correctAnswer = marqueur.getAttribute('data-correct-answer') || '';
        const isCorrect = marqueur.getAttribute('data-is-correct') === 'true';
        const hasAnswer = userAnswer.trim() !== '';

        let bodyHTML = '';

        if (isCorrect) {
            bodyHTML = `
                <div class="correction-answer correct">
                    <span class="answer-text">${this.escapeHtml(userAnswer)}</span>
                    <span class="answer-icon">✓</span>
                </div>
            `;
        } else {
            bodyHTML = `
                <div class="correction-answer incorrect">
                    <span class="answer-text">${hasAnswer ? this.escapeHtml(userAnswer) : 'Non répondu'}</span>
                    <span class="answer-icon">✗</span>
                </div>
                <div class="correction-answer expected">
                    <span class="answer-text">Réponse correcte : ${this.escapeHtml(correctAnswer)}</span>
                </div>
            `;
        }

        const modal = document.getElementById('marqueurModal');
        if (modal) {
            document.getElementById('modalMarqueurNum').textContent = index + 1;
            const modalBody = modal.querySelector('.carte-modal-body');
            if (modalBody) {
                modalBody.innerHTML = bodyHTML;
            }
            const modalFooter = modal.querySelector('.carte-modal-footer');
            if (modalFooter) {
                modalFooter.style.display = 'none';
            }
            modal.classList.remove('hidden');
        }
    },

    showQuestionOuverteCorrige() {
        const questions = this.questionsOuvertes || [];
        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.remove('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) textarea.disabled = true;
            });
        });
    },

    showDocumentMixteCorrige() {
        const data = this.mixteData || {};

        // Nouveau format : blocks
        if (data.blocks) {
            // Correction des tableaux
            if (this._mixteBlockTableaux) {
                this._mixteBlockTableaux.forEach(tab => {
                    tab.lignes.forEach((ligne, ri) => {
                        (ligne.cells || []).forEach((cell, ci) => {
                            if (cell.type === 'reponse') {
                                const input = document.getElementById(`mixte_btab_${tab.tableIdx}_${ri}_${ci}`);
                                if (!input) return;
                                const userAnswer = input.value.trim();
                                const correctAnswer = cell.valeur || '';
                                const alts = cell.alternatives || [];
                                const allCorrect = [correctAnswer].concat(alts).join('|');
                                const stricte = cell.correction === 'stricte';
                                const isCorrect = this.checkAnswerMatch(userAnswer, allCorrect, stricte);

                                input.classList.remove('incorrect', 'correct');
                                input.classList.add(isCorrect ? 'correct' : 'incorrect');
                                input.disabled = true;

                                if (!userAnswer) {
                                    input.value = '(non r\u00e9pondu)';
                                    input.classList.add('empty-answer');
                                }
                                if (!isCorrect) {
                                    const correctionDiv = document.createElement('div');
                                    correctionDiv.className = 'correction-expected-below';
                                    correctionDiv.innerHTML = `R\u00e9ponse : ${this.escapeHtml(correctAnswer)}`;
                                    input.parentNode.appendChild(correctionDiv);
                                }
                            }
                        });
                    });
                });
            }
            // Correction des questions
            if (this._mixteBlockQuestions) {
                this._mixteBlockQuestions.forEach(q => {
                    const input = document.getElementById(`mixte_bq_${q.qIdx}`);
                    if (!input) return;
                    const userAnswer = input.value.trim();
                    const correctAnswer = q.reponse || '';
                    const alts = q.alternatives || [];
                    const allCorrect = [correctAnswer].concat(alts).join('|');
                    const stricte = q.correction === 'stricte';
                    const isCorrect = this.checkAnswerMatch(userAnswer, allCorrect, stricte);

                    input.classList.remove('incorrect', 'correct');
                    input.classList.add(isCorrect ? 'correct' : 'incorrect');
                    input.disabled = true;

                    if (!userAnswer) {
                        input.value = '(non r\u00e9pondu)';
                        input.classList.add('empty-answer');
                    }
                    if (!isCorrect) {
                        const correctionDiv = document.createElement('div');
                        correctionDiv.className = 'correction-expected-below';
                        correctionDiv.innerHTML = `R\u00e9ponse : ${this.escapeHtml(correctAnswer)}`;
                        input.parentNode.appendChild(correctionDiv);
                    }
                });
            }
            return;
        }

        // Ancien format
        const container = document.querySelector('.document-mixte-container');

        const docSection = document.querySelector('.mixte-document') || document.querySelector('.mixte-left-column');
        let documentHTML = '';
        if (docSection) {
            documentHTML = docSection.innerHTML;
            docSection.remove();
        }

        if (container) {
            container.classList.remove('horizontal-layout');
            container.classList.add('correction-fullwidth');

            if (documentHTML && !document.getElementById('toggleDocumentBtn')) {
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'toggleDocumentBtn';
                toggleBtn.className = 'btn-toggle-document';
                toggleBtn.innerHTML = '\uD83D\uDCC4 Voir le document';
                toggleBtn.setAttribute('onclick', 'EleveExercices.openDocumentModal()');
                container.insertBefore(toggleBtn, container.firstChild);

                const modal = document.createElement('div');
                modal.id = 'documentModal';
                modal.className = 'document-modal-overlay hidden';
                modal.innerHTML = `
                    <div class="document-modal">
                        <div class="document-modal-header">
                            <h3>\uD83D\uDCC4 Document</h3>
                            <button class="document-modal-close" onclick="EleveExercices.closeDocumentModal()">\u00D7</button>
                        </div>
                        <div class="document-modal-body">
                            ${documentHTML}
                        </div>
                    </div>
                `;
                container.appendChild(modal);
            }
        }

        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row' && el.reponse) {
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            const userAnswer = input.value.trim();
                            const correctAnswerRaw = el.reponse;
                            const firstCorrectAnswer = correctAnswerRaw.split(/[|;]/)[0].trim();
                            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswerRaw);

                            input.classList.remove('incorrect', 'correct');
                            input.classList.add(isCorrect ? 'correct' : 'incorrect');
                            input.disabled = true;

                            if (!userAnswer) {
                                input.value = '(non r\u00e9pondu)';
                                input.classList.add('empty-answer');
                            }

                            if (!isCorrect) {
                                const correctionDiv = document.createElement('div');
                                correctionDiv.className = 'correction-expected-below';
                                correctionDiv.innerHTML = `R\u00e9ponse : ${this.escapeHtml(firstCorrectAnswer)}`;
                                input.parentNode.appendChild(correctionDiv);
                            }
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((ligne, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                const userAnswer = input.value.trim();
                                const correctAnswerRaw = ligne.cells[colIdx] || '';
                                const firstCorrectAnswer = correctAnswerRaw.split(/[|;]/)[0].trim();
                                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswerRaw);

                                input.classList.remove('incorrect', 'correct');
                                input.classList.add(isCorrect ? 'correct' : 'incorrect');
                                input.disabled = true;

                                if (!userAnswer) {
                                    input.value = '(non r\u00e9pondu)';
                                    input.classList.add('empty-answer');
                                }

                                if (!isCorrect) {
                                    const correctionDiv = document.createElement('div');
                                    correctionDiv.className = 'correction-expected-below';
                                    correctionDiv.innerHTML = `R\u00e9ponse : ${this.escapeHtml(firstCorrectAnswer)}`;
                                    input.parentNode.appendChild(correctionDiv);
                                }
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_answer_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) textarea.disabled = true;
                if (correctionDiv && q.reponse_attendue) {
                    const firstAnswer = q.reponse_attendue.split(/[|;]/)[0].trim();
                    correctionDiv.innerHTML = `<strong>R\u00e9ponse attendue :</strong> ${this.escapeHtml(firstAnswer)}`;
                    correctionDiv.classList.remove('hidden');
                }
            });
        }
    },

    openDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    closeDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    showTableauCorrige() {
        const donnees = parseJSONField(this.currentExercise.donnees);
        const parsed = this._parseTableauDonnees(donnees, {});

        parsed.lignes.forEach((row, rowIdx) => {
            row.forEach((cell, colIdx) => {
                if (cell.type === 'reponse') {
                    const input = document.getElementById(`input_${rowIdx}_${colIdx}`);
                    if (!input) return;

                    const expectedAnswer = cell.valeur;
                    const userAnswer = input.value.trim();
                    const isCorrect = input.classList.contains('correct');
                    const isEmpty = userAnswer === '';

                    const correctionCell = document.createElement('div');
                    correctionCell.className = 'correction-cell';

                    if (isCorrect) {
                        correctionCell.classList.add('correct');
                        correctionCell.innerHTML = `<span class="answer-text">${this.escapeHtml(userAnswer)}</span>`;
                    } else {
                        correctionCell.classList.add('incorrect');
                        if (isEmpty) {
                            correctionCell.innerHTML = `<span class="correct-answer">${this.escapeHtml(expectedAnswer)}</span>`;
                        } else {
                            correctionCell.innerHTML = `
                                <span class="wrong-answer">${this.escapeHtml(userAnswer)}</span>
                                <span class="arrow">&rarr;</span>
                                <span class="correct-answer">${this.escapeHtml(expectedAnswer)}</span>
                            `;
                        }
                    }

                    input.parentNode.replaceChild(correctionCell, input);
                }
            });
        });
    },

    // ===============================
    // RESET
    // ===============================

    resetExercise() {
        if (!this.currentExercise) return;

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'unknown';

        const handler = this.getFormatHandler(typeUI);
        if (handler && handler.reset) {
            handler.reset.call(this);
        } else {
            this.resetTableauSaisie();
        }

        // Hide result banner
        document.getElementById('resultBanner').className = 'result-banner';

        // Reset start time for tracking
        this.exerciseStartTime = Date.now();

        // Restart timer
        if (this.currentExercise.duree) {
            this.startTimer(this.currentExercise.duree);
        }

        // Réinitialiser l'état des boutons
        const btnCorrige = document.getElementById('btnCorrige');
        const btnRestart = document.getElementById('btnRestart');
        const btnVerifier = document.getElementById('btnVerifier');

        if (btnCorrige) btnCorrige.style.display = 'none';
        if (btnRestart) btnRestart.style.display = 'none';
        if (btnVerifier) btnVerifier.textContent = 'Vérifier mes réponses';
    },

    resetDocumentMixte() {
        const data = this.mixteData || {};

        // Nouveau format : blocks
        if (data.blocks) {
            // Reset tableaux
            if (this._mixteBlockTableaux) {
                this._mixteBlockTableaux.forEach(tab => {
                    tab.lignes.forEach((ligne, ri) => {
                        (ligne.cells || []).forEach((cell, ci) => {
                            if (cell.type === 'reponse') {
                                const input = document.getElementById(`mixte_btab_${tab.tableIdx}_${ri}_${ci}`);
                                if (input) {
                                    input.value = '';
                                    input.classList.remove('correct', 'incorrect', 'empty-answer');
                                    input.disabled = false;
                                    const correction = input.parentNode.querySelector('.correction-expected-below');
                                    if (correction) correction.remove();
                                }
                            }
                        });
                    });
                });
            }
            // Reset questions
            if (this._mixteBlockQuestions) {
                this._mixteBlockQuestions.forEach(q => {
                    const input = document.getElementById(`mixte_bq_${q.qIdx}`);
                    if (input) {
                        input.value = '';
                        input.classList.remove('correct', 'incorrect', 'empty-answer');
                        input.disabled = false;
                        const correction = input.parentNode.querySelector('.correction-expected-below');
                        if (correction) correction.remove();
                    }
                });
            }
            return;
        }

        // Ancien format
        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row') {
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            input.value = '';
                            input.className = 'cell-input';
                            input.disabled = false;
                            const correction = input.parentNode.querySelector('.correction-expected-below');
                            if (correction) correction.remove();
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((_, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                input.value = '';
                                input.classList.remove('correct', 'incorrect', 'empty-answer');
                                input.disabled = false;
                                const correction = input.parentNode.querySelector('.correction-expected-below');
                                if (correction) correction.remove();
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_answer_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
                if (correctionDiv) {
                    correctionDiv.classList.add('hidden');
                    correctionDiv.innerHTML = '';
                }
            });
        }
    },

    resetTableauSaisie() {
        const donnees = parseJSONField(this.currentExercise.donnees);
        const parsed = this._parseTableauDonnees(donnees, {});

        parsed.lignes.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                if (cell.type === 'reponse') {
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    const correction = document.getElementById(`correction_${rowIndex}_${colIndex}`);
                    if (input) {
                        input.value = '';
                        input.className = '';
                        input.disabled = false;
                    }
                    if (correction) correction.textContent = '';
                }
            });
        });
    },

    resetCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        this.carteReponses = new Array(marqueurs.length).fill('');

        marqueurs.forEach((_, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            if (badge) {
                badge.textContent = '';
                badge.classList.add('hidden');
                badge.classList.remove('correct', 'incorrect', 'correction');
            }
            if (marqueur) {
                marqueur.classList.remove('correct', 'incorrect', 'answered', 'show-correction');
                marqueur.style.pointerEvents = '';
            }
        });
    },

    resetQuestionOuverte() {
        const questions = this.questionsOuvertes || [];

        questions.forEach((q, qIndex) => {
            const correctionBox = document.getElementById(`correctionBox_${qIndex}`);
            if (correctionBox) correctionBox.classList.add('hidden');

            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
            });
        });
    },

});
