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
        let colonnes = donnees.colonnes || structure.colonnes || [
            { titre: 'Date', editable: false },
            { titre: 'Réponse', editable: true }
        ];
        const lignes = donnees.lignes || [];

        let html = `
            <table class="tableau-exercice">
                <thead>
                    <tr>
                        ${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            html += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    html += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    const value = cells[colIndex] || '';
                    html += `<td class="cell-display">${this.escapeHtml(value)}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    },

    renderCarteCliquable(donnees, structure) {
        const imageUrl = this.convertToDirectImageUrl(donnees.image_url || '');
        const marqueurs = donnees.marqueurs || [];

        let marqueursHTML = marqueurs.map((m, index) => `
            <div class="carte-marqueur" data-id="${m.id || index}"
                 data-reponse="${this.escapeHtml(m.reponse || '')}"
                 style="left: ${m.x}%; top: ${m.y}%;"
                 onclick="EleveExercices.openMarqueurModal(${index})">
                <span class="marqueur-numero">${index + 1}</span>
                <span class="marqueur-reponse-badge hidden" id="badge_${index}"></span>
            </div>
        `).join('');

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
        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        let documentHTML = '';
        if (doc.type === 'image') {
            const imgUrl = this.convertToDirectImageUrl(doc.contenu);
            documentHTML = `<img src="${this.escapeHtml(imgUrl)}" alt="Document" class="doc-image">`;
        } else {
            documentHTML = `<div class="doc-texte">${this.escapeHtml(doc.contenu || '')}</div>`;
        }

        let tableHTML = `
            <table class="tableau-exercice">
                <thead><tr>${colonnes.map(col => `<th>${this.escapeHtml(col.titre)}</th>`).join('')}</tr></thead>
                <tbody>
        `;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            tableHTML += '<tr>';
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    tableHTML += `
                        <td>
                            <input type="text" id="input_${rowIndex}_${colIndex}"
                                   data-row="${rowIndex}" data-col="${colIndex}"
                                   placeholder="..." autocomplete="off">
                            <div class="correction-text" id="correction_${rowIndex}_${colIndex}"></div>
                        </td>
                    `;
                } else {
                    tableHTML += `<td class="cell-display">${this.escapeHtml(cells[colIndex] || '')}</td>`;
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
        const doc = donnees.document || { actif: false };
        const tableau = donnees.tableau || { actif: false };
        const questions = donnees.questions || { actif: false };
        const sectionOrder = donnees.sectionOrder || ['document', 'tableau', 'questions'];
        const layout = donnees.layout || 'vertical';

        this.mixteData = donnees;

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
            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
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
                toggleBtn.innerHTML = '📄 Voir le document';
                toggleBtn.setAttribute('onclick', 'EleveExercices.openDocumentModal()');
                container.insertBefore(toggleBtn, container.firstChild);

                const modal = document.createElement('div');
                modal.id = 'documentModal';
                modal.className = 'document-modal-overlay hidden';
                modal.innerHTML = `
                    <div class="document-modal">
                        <div class="document-modal-header">
                            <h3>📄 Document</h3>
                            <button class="document-modal-close" onclick="EleveExercices.closeDocumentModal()">×</button>
                        </div>
                        <div class="document-modal-body">
                            ${documentHTML}
                        </div>
                    </div>
                `;
                container.appendChild(modal);
            }
        }

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
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
                            input.value = '(non répondu)';
                            input.classList.add('empty-answer');
                        }

                        if (!isCorrect) {
                            const correctionDiv = document.createElement('div');
                            correctionDiv.className = 'correction-expected-below';
                            correctionDiv.innerHTML = `Réponse : ${this.escapeHtml(firstCorrectAnswer)}`;
                            input.parentNode.appendChild(correctionDiv);
                        }
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) textarea.disabled = true;
                if (correctionDiv && q.reponse_attendue) {
                    const firstAnswer = q.reponse_attendue.split(/[|;]/)[0].trim();
                    correctionDiv.innerHTML = `<strong>Réponse attendue :</strong> ${this.escapeHtml(firstAnswer)}`;
                    correctionDiv.style.display = 'block';
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

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((ligne, rowIdx) => {
            colonnes.forEach((col, colIdx) => {
                if (col.editable) {
                    const input = document.getElementById(`input_${rowIdx}_${colIdx}`);
                    if (input) {
                        const fullAnswer = ligne.cells[colIdx] || '';
                        const firstAnswer = fullAnswer.split(/[|;]/)[0].trim();
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
                                correctionCell.innerHTML = `<span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>`;
                            } else {
                                correctionCell.innerHTML = `
                                    <span class="wrong-answer">${this.escapeHtml(userAnswer)}</span>
                                    <span class="arrow">→</span>
                                    <span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>
                                `;
                            }
                        }

                        input.parentNode.replaceChild(correctionCell, input);
                    }
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

        if (data.tableau && data.tableau.actif && this.mixteTableauElements) {
            this.mixteTableauElements.forEach((el, idx) => {
                if (el.type === 'row') {
                    const input = document.getElementById(`mixte_element_${idx}`);
                    if (input) {
                        input.value = '';
                        input.className = 'cell-input';
                        input.disabled = false;
                    }
                }
            });
        }

        if (data.questions && data.questions.actif && this.mixteQuestions) {
            this.mixteQuestions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                const correctionDiv = document.getElementById(`mixte_correction_${idx}`);
                if (textarea) {
                    textarea.value = '';
                    textarea.disabled = false;
                }
                if (correctionDiv) {
                    correctionDiv.style.display = 'none';
                    correctionDiv.innerHTML = '';
                }
            });
        }
    },

    resetTableauSaisie() {
        const donnees = parseJSONField(this.currentExercise.donnees);

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];

        lignes.forEach((_, rowIndex) => {
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
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
