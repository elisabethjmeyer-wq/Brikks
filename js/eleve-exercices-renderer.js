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
    // VALIDATION
    // ===============================

    /**
     * Bloque l'exercice pendant le chargement (après clic sur Terminer)
     * Désactive tous les inputs et affiche un overlay
     */
    lockExercise() {
        const exerciseContent = document.querySelector('.exercise-content');
        if (!exerciseContent) return;

        // Désactiver tous les champs de saisie
        const inputs = exerciseContent.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = true;
            input.classList.add('locked');
        });

        // Ajouter un overlay de chargement sur l'exercice
        const overlay = document.createElement('div');
        overlay.className = 'exercise-loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <span class="loading-text">Calcul du résultat...</span>
            </div>
        `;
        exerciseContent.style.position = 'relative';
        exerciseContent.appendChild(overlay);
    },

    async validateExercise() {
        if (!this.currentExercise) return;

        // Empêcher les clics multiples
        if (this.isValidating) return;
        this.isValidating = true;

        // Désactiver le bouton et afficher le chargement
        const btnVerifier = document.getElementById('btnVerifier');
        if (btnVerifier) {
            btnVerifier.disabled = true;
            btnVerifier.innerHTML = '<span class="spinner-small"></span> Validation...';
        }

        // Bloquer tout l'exercice pendant le chargement
        this.lockExercise();

        this.stopTimer();

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';
        let result;

        if (typeUI === 'carte_cliquable') {
            result = this.validateCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            result = this.validateQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            result = this.validateDocumentMixte();
        } else {
            result = this.validateTableauSaisie();
        }

        const { correct, total } = result;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Sauvegarder le résultat
        await this.saveResult(correct, total, percent);

        // Pour les savoir-faire: afficher l'écran de résultat dédié
        if (this.currentType === 'savoir-faire') {
            // Appliquer les corrections sur l'exercice actuel
            this.applyCorrections(typeUI);

            // Supprimer l'overlay de chargement avant de capturer le HTML
            const overlay = document.querySelector('.exercise-loading-overlay');
            if (overlay) overlay.remove();

            // Capturer le HTML de l'exercice corrigé avec les valeurs des inputs
            const exerciseContent = document.querySelector('.exercise-content');
            const correctedHTML = this.captureContentWithValues(exerciseContent);

            // Capturer aussi la consigne si présente
            const consigneEl = document.querySelector('.exercise-consigne');
            const consigneHTML = consigneEl ? consigneEl.outerHTML : '';

            this.renderResultScreenSF({
                correct,
                total,
                percent,
                correctedHTML,
                consigneHTML
            });
            return;
        }

        // Pour les autres types: comportement existant (bandeau + boutons)
        const banner = document.getElementById('resultBanner');
        if (percent === 100) {
            banner.className = 'result-banner show success';
            banner.textContent = `Parfait ! ${correct}/${total} réponses correctes`;
        } else if (percent >= 50) {
            banner.className = 'result-banner show partial';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        } else {
            banner.className = 'result-banner show error';
            banner.textContent = `${correct}/${total} réponses correctes (${percent}%)`;
        }

        // Après validation : afficher les boutons "Corrigé" et "Recommencer"
        const btnCorrige = document.getElementById('btnCorrige');
        const btnRestart = document.getElementById('btnRestart');

        if (btnCorrige) btnCorrige.style.display = 'inline-flex';
        if (btnRestart) btnRestart.style.display = 'inline-flex';

        // Modifier le bouton "Vérifier" pour permettre de re-vérifier (réutiliser la variable existante)
        if (btnVerifier) {
            btnVerifier.disabled = false;
            btnVerifier.textContent = 'Vérifier à nouveau';
            this.isValidating = false;
        }
    },

    validateTableauSaisie() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

        const colonnes = donnees.colonnes || [];
        const lignes = donnees.lignes || [];
        let correct = 0, total = 0;

        lignes.forEach((ligne, rowIndex) => {
            const cells = ligne.cells || Object.values(ligne);
            colonnes.forEach((col, colIndex) => {
                if (col.editable) {
                    total++;
                    const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                    if (!input) return;

                    const correctAnswerRaw = cells[colIndex] || '';

                    if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                        input.className = 'correct';
                        correct++;
                    } else {
                        input.className = 'incorrect';
                        // DON'T show correction here - only mark as incorrect
                    }
                    // Don't disable input so student can retry
                }
            });
        });

        return { correct, total };
    },

    validateCarteCliquable() {
        const marqueurs = this.carteMarqueurs || [];
        const reponses = this.carteReponses || [];
        let correct = 0, total = marqueurs.length;

        marqueurs.forEach((m, index) => {
            const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
            const badge = document.getElementById(`badge_${index}`);

            const correctAnswerRaw = m.reponse || '';

            if (this.checkAnswerMatch(reponses[index] || '', correctAnswerRaw)) {
                if (marqueur) marqueur.classList.add('correct');
                if (badge) badge.classList.add('correct');
                correct++;
            } else {
                if (marqueur) marqueur.classList.add('incorrect');
                if (badge) badge.classList.add('incorrect');
            }
        });

        // Don't disable markers - student can still modify and retry

        return { correct, total };
    },

    validateQuestionOuverte() {
        // Question ouverte: no auto-correction possible, just mark as answered
        const questions = this.questionsOuvertes || [];
        let hasAnswers = false;

        questions.forEach((q, qIndex) => {
            (q.etapes || []).forEach((_, eIndex) => {
                const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                if (textarea && textarea.value.trim()) {
                    hasAnswers = true;
                    textarea.classList.add('answered');
                }
            });
        });

        // Don't show correction boxes yet - wait for "Voir le corrigé"
        return { correct: 0, total: 0 };
    },

    validateDocumentMixte() {
        let correct = 0, total = 0;
        const data = this.mixteData || {};

        if (data.tableau && data.tableau.actif) {
            if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                this.mixteTableauElements.forEach((el, idx) => {
                    if (el.type === 'row' && el.reponse) {
                        total++;
                        const input = document.getElementById(`mixte_element_${idx}`);
                        if (input) {
                            const correctAnswerRaw = el.reponse;

                            if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                input.classList.add('correct');
                                input.classList.remove('incorrect');
                                correct++;
                            } else {
                                input.classList.add('incorrect');
                                input.classList.remove('correct');
                            }
                            // Don't disable - allow retry
                        }
                    }
                });
            } else {
                const colonnes = this.mixteTableauColonnes || [];
                const lignes = this.mixteTableauLignes || [];

                lignes.forEach((ligne, rowIdx) => {
                    colonnes.forEach((col, colIdx) => {
                        if (col.editable) {
                            total++;
                            const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                            if (input) {
                                const correctAnswerRaw = ligne.cells[colIdx] || '';

                                if (this.checkAnswerMatch(input.value, correctAnswerRaw)) {
                                    input.classList.add('correct');
                                    input.classList.remove('incorrect');
                                    correct++;
                                } else {
                                    input.classList.add('incorrect');
                                    input.classList.remove('correct');
                                    // DON'T show correction - only mark as incorrect
                                }
                                // Don't disable - allow retry
                            }
                        }
                    });
                });
            }
        }

        if (data.questions && data.questions.actif) {
            const questions = this.mixteQuestions || [];
            questions.forEach((q, idx) => {
                const textarea = document.getElementById(`mixte_question_${idx}`);
                if (textarea && textarea.value.trim()) {
                    textarea.classList.add('answered');
                }
                // DON'T show correction yet - wait for "Voir le corrigé"
            });
        }

        return { correct, total };
    },

    async saveResult(correct, total, percent) {
        console.log('[SF] saveResult appelé - currentUser:', this.currentUser, 'currentExercise:', this.currentExercise?.id);

        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = this.currentExercise?.duree || 300; // duree est déjà en secondes

        // IMPORTANT: Capturer isEntrainementLibre AU DÉBUT avant tout appel async
        // Car la valeur peut changer pendant les awaits
        const isEntrainementLibreSnapshot = this.isEntrainementLibre;
        console.log('[SF] isEntrainementLibre capturé au début:', isEntrainementLibreSnapshot);

        // OPTION B: Pour les savoir-faire, calculer la validation au niveau BANQUE
        let validationResult = null;
        if (this.currentType === 'savoir-faire' && this.currentExercise) {
            const banqueId = String(this.currentExercise.banque_id);
            const statsBanque = this.statsSFBanque[banqueId];
            validationResult = this.validerRepetitionSF(this.currentExercise, percent, timeSpent, statsBanque);

            // Stocker le résultat de validation pour l'écran de résultat
            this.lastValidationResult = validationResult;

            // Mettre à jour les stats locales
            const pratiqueData = {
                eleve_id: this.currentUser?.id || 'preview',
                exercice_id: this.currentExercise.id,
                banque_id: this.currentExercise.banque_id,
                score: percent,
                temps_passe: timeSpent,
                temps_prevu: tempsPrevu,
                repetition_validee: validationResult.repetitionValidee,
                nouvelle_repetition: validationResult.nouvelleRepetition,
                est_entrainement_libre: isEntrainementLibreSnapshot  // Utiliser la valeur capturée
            };
            this.updateLocalStatsSF(pratiqueData);
        }

        // Ne pas sauvegarder au backend si pas d'utilisateur
        if (!this.currentUser || !this.currentUser.id || !this.currentExercise) {
            console.log('[SF] Pas de sauvegarde backend (preview mode ou user manquant)');
            return;
        }

        const resultData = {
            eleve_id: this.currentUser.id,
            exercice_id: this.currentExercise.id,
            banque_id: this.currentExercise.banque_id,
            score: percent,
            bonnes_reponses: correct,
            total_questions: total,
            temps_passe: timeSpent,
            date: new Date().toISOString()
        };

        try {
            // Sauvegarder dans l'ancien système (pour compatibilité)
            const result = await this.callAPI('saveResultatExercice', resultData);
            if (result.success) {
                this.updateLocalResult(resultData);
            }

            // Pour les savoir-faire, sauvegarder dans l'historique des pratiques avec nouvelles infos
            if (this.currentType === 'savoir-faire') {
                // DEBUG: Afficher les détails de validation
                console.log('[SF DEBUG] Validation details:', {
                    score: percent,
                    isEntrainementLibreSnapshot: isEntrainementLibreSnapshot,
                    isEntrainementLibreActuel: this.isEntrainementLibre,
                    validationResult: validationResult,
                    repetitionValidee: validationResult?.repetitionValidee,
                    nouvelleRepetition: validationResult?.nouvelleRepetition
                });

                const pratiqueData = {
                    eleve_id: this.currentUser.id,
                    exercice_id: this.currentExercise.id,
                    banque_id: this.currentExercise.banque_id,
                    score: percent,
                    temps_passe: timeSpent,
                    temps_prevu: tempsPrevu,
                    // Nouvelles données système 4 répétitions
                    repetition_numero: validationResult?.repetitionValidee ? validationResult.nouvelleRepetition : 0,
                    est_entrainement_libre: isEntrainementLibreSnapshot  // Utiliser la valeur capturée au début
                };
                console.log('[SF] Envoi sauvegarde pratique au backend:', pratiqueData);
                try {
                    const sfResult = await this.callAPI('savePratiqueSF', pratiqueData);
                    console.log('[SF] Réponse backend savePratiqueSF:', sfResult);
                    if (sfResult.success) {
                        console.log('[SF] DEBUG - Sheet:', sfResult.debug?.sheetName,
                                    '| Created:', sfResult.debug?.sheetCreated,
                                    '| Rows:', sfResult.debug?.rowCount);
                    } else {
                        console.error('[SF] Erreur backend:', sfResult.error);
                    }
                } catch (e) {
                    console.error('[SF] Erreur appel savePratiqueSF:', e);
                }
            }
        } catch (e) {
            console.error('[EleveExercices] Erreur sauvegarde résultat:', e);
        }
    },

    /**
     * OPTION B: Met à jour les stats locales au niveau BANQUE (plus par exercice)
     */
    updateLocalStatsSF(pratiqueData) {
        const exoId = String(pratiqueData.exercice_id);
        const banqueId = String(pratiqueData.banque_id);
        console.log('[SF-OptionB] Mise à jour stats pour banque:', banqueId, 'exercice:', exoId, 'Score:', pratiqueData.score);

        // ========== Mise à jour des stats par BANQUE (nouveau système Option B) ==========
        if (!this.statsSFBanque[banqueId]) {
            this.statsSFBanque[banqueId] = {
                banque_id: banqueId,
                repetitions_validees: 0,
                exercices_reussis: [],
                date_derniere_validation: null,
                total_pratiques: 0
            };
        }

        const statsBanque = this.statsSFBanque[banqueId];
        statsBanque.total_pratiques++;

        // Si répétition validée, mettre à jour la banque
        if (pratiqueData.repetition_validee && !pratiqueData.est_entrainement_libre) {
            statsBanque.repetitions_validees = pratiqueData.nouvelle_repetition;
            statsBanque.date_derniere_validation = new Date().toISOString();

            // Ajouter l'exercice à la liste des réussis (si pas déjà dedans)
            if (!statsBanque.exercices_reussis.includes(exoId)) {
                statsBanque.exercices_reussis.push(exoId);
            }
            console.log('[SF-OptionB] Répétition banque validée!', statsBanque);
        }

        // Sauvegarder stats banque dans le cache
        this.saveHistoriqueSFBanqueToCache(this.statsSFBanque);

        // ========== Mise à jour des stats par exercice (legacy, pour compatibilité) ==========
        if (!this.statsSF[exoId]) {
            this.statsSF[exoId] = {
                exercice_id: exoId,
                banque_id: banqueId,
                total_pratiques: 0,
                pratiques_parfaites: 0,
                repetitions_validees: 0,
                derniere_pratique: null,
                date_derniere_validation: null,
                temps_moyen: 0,
                temps_prevu: pratiqueData.temps_prevu || 0
            };
        }

        const statsExo = this.statsSF[exoId];
        statsExo.total_pratiques++;

        if (pratiqueData.score === 100) {
            statsExo.pratiques_parfaites++;
        }

        // Mettre à jour temps moyen
        const oldTotal = (statsExo.total_pratiques - 1) * statsExo.temps_moyen;
        statsExo.temps_moyen = Math.round((oldTotal + pratiqueData.temps_passe) / statsExo.total_pratiques);
        statsExo.derniere_pratique = new Date().toISOString();

        this.saveHistoriqueSFToCache(this.statsSF);
        console.log('[SF-OptionB] Stats banque:', this.statsSFBanque[banqueId]);
    },

    /**
     * Sauvegarde les stats SF par banque dans le cache local
     */
    saveHistoriqueSFBanqueToCache(statsBanque) {
        try {
            localStorage.setItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY, JSON.stringify({
                data: statsBanque,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('[SF] Erreur sauvegarde cache banque:', e);
        }
    },

    /**
     * Charge les stats SF par banque depuis le cache local
     */
    loadHistoriqueSFBanqueFromCache() {
        try {
            const cached = localStorage.getItem(this.CACHE_HISTORIQUE_SF_BANQUE_KEY);
            if (!cached) return null;
            const data = JSON.parse(cached);
            if (data.timestamp && (Date.now() - data.timestamp) < this.CACHE_TTL) {
                return data.data;
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    updateLocalResult(newResult) {
        const existingIndex = this.resultats.findIndex(r => r.exercice_id === newResult.exercice_id);
        if (existingIndex >= 0) {
            if (newResult.score > this.resultats[existingIndex].score) {
                this.resultats[existingIndex] = newResult;
            }
        } else {
            this.resultats.push(newResult);
        }
        this.saveResultatsToCache(this.resultats);
    },

    normalizeAnswer(str) {
        return String(str).toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    },

    /**
     * Vérifie si la réponse utilisateur correspond à la réponse correcte
     * Supporte les réponses multiples séparées par | ou ;
     * @param {string} userAnswer - Réponse de l'élève
     * @param {string} correctAnswer - Réponse(s) correcte(s), séparées par | ou ;
     * @returns {boolean} true si la réponse est correcte
     */
    checkAnswerMatch(userAnswer, correctAnswer) {
        const normalizedUser = this.normalizeAnswer(userAnswer);
        if (normalizedUser === '') return false;

        // Séparer les réponses multiples par | ou ;
        const correctOptions = String(correctAnswer).split(/[|;]/).map(opt => this.normalizeAnswer(opt));

        // Vérifier si la réponse utilisateur correspond à l'une des options
        return correctOptions.some(opt => opt !== '' && normalizedUser === opt);
    },

    // ===============================
    // ÉCRAN DE RÉSULTAT SF
    // ===============================

    /**
     * Collecte les détails des réponses utilisateur pour l'écran de résultat
     * @returns {Array} Liste des détails {question, reponseUtilisateur, reponseAttendue, correct}
     */
    collectExerciseDetails() {
        const details = [];
        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }
        const typeUI = structure ? structure.type_ui : 'tableau_saisie';

        if (typeUI === 'carte_cliquable') {
            const marqueurs = this.carteMarqueurs || [];
            const reponses = this.carteReponses || [];
            marqueurs.forEach((m, index) => {
                const userAnswer = reponses[index] || '';
                const correctAnswer = m.reponse || '';
                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                details.push({
                    question: m.question || `Point ${index + 1}`,
                    reponseUtilisateur: userAnswer,
                    reponseAttendue: correctAnswer.split(/[|;]/)[0], // Première option seulement
                    correct: isCorrect
                });
            });
        } else if (typeUI === 'document_mixte') {
            const data = this.mixteData || {};
            if (data.tableau && data.tableau.actif) {
                if (this.mixteTableauElements && this.mixteTableauElements.length > 0) {
                    this.mixteTableauElements.forEach((el, idx) => {
                        if (el.type === 'row' && el.reponse) {
                            const input = document.getElementById(`mixte_element_${idx}`);
                            const userAnswer = input ? input.value : '';
                            const correctAnswer = el.reponse;
                            const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                            details.push({
                                question: el.label || `Ligne ${idx + 1}`,
                                reponseUtilisateur: userAnswer,
                                reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                correct: isCorrect
                            });
                        }
                    });
                } else {
                    const colonnes = this.mixteTableauColonnes || [];
                    const lignes = this.mixteTableauLignes || [];
                    lignes.forEach((ligne, rowIdx) => {
                        colonnes.forEach((col, colIdx) => {
                            if (col.editable) {
                                const input = document.getElementById(`mixte_cell_${rowIdx}_${colIdx}`);
                                const userAnswer = input ? input.value : '';
                                const correctAnswer = ligne.cells[colIdx] || '';
                                const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);
                                details.push({
                                    question: `${col.titre || 'Colonne ' + (colIdx + 1)} - Ligne ${rowIdx + 1}`,
                                    reponseUtilisateur: userAnswer,
                                    reponseAttendue: correctAnswer.split(/[|;]/)[0],
                                    correct: isCorrect
                                });
                            }
                        });
                    });
                }
            }
        } else if (typeUI === 'question_ouverte') {
            // Question ouverte: pas de correction automatique, mais on affiche les réponses
            const questions = this.questionsOuvertes || [];
            questions.forEach((q, qIndex) => {
                (q.etapes || []).forEach((etape, eIndex) => {
                    const textarea = document.getElementById(`reponse_${qIndex}_${eIndex}`);
                    const userAnswer = textarea ? textarea.value.trim() : '';
                    details.push({
                        question: etape.question || `Question ${eIndex + 1}`,
                        reponseUtilisateur: userAnswer,
                        reponseAttendue: etape.correction || '(voir corrigé)',
                        correct: null, // Non évaluable automatiquement
                        isOpenQuestion: true
                    });
                });
            });
        } else {
            // Tableau saisie
            let donnees = this.currentExercise.donnees;
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
            }
            const colonnes = donnees.colonnes || [];
            const lignes = donnees.lignes || [];
            lignes.forEach((ligne, rowIndex) => {
                const cells = ligne.cells || Object.values(ligne);
                colonnes.forEach((col, colIndex) => {
                    if (col.editable) {
                        const input = document.getElementById(`input_${rowIndex}_${colIndex}`);
                        const userAnswer = input ? input.value : '';
                        const correctAnswer = cells[colIndex] || '';
                        const isCorrect = this.checkAnswerMatch(userAnswer, correctAnswer);

                        // Trouver un libellé pour la question
                        let questionLabel = '';
                        const nonEditableCols = colonnes.filter(c => !c.editable);
                        if (nonEditableCols.length > 0) {
                            const labelColIdx = colonnes.indexOf(nonEditableCols[0]);
                            questionLabel = cells[labelColIdx] || '';
                        }
                        if (!questionLabel) {
                            questionLabel = `Ligne ${rowIndex + 1} - ${col.titre || 'Colonne ' + (colIndex + 1)}`;
                        }

                        details.push({
                            question: questionLabel,
                            reponseUtilisateur: userAnswer,
                            reponseAttendue: correctAnswer.split(/[|;]/)[0],
                            correct: isCorrect
                        });
                    }
                });
            });
        }

        return details;
    },

    /**
     * Affiche l'écran de résultats SF avec 2 blocs (bilan + correction)
     * Système 4 répétitions
     * @param {Object} results - {correct, total, percent, correctedHTML, consigneHTML}
     */
    renderResultScreenSF(results) {
        const container = document.getElementById('exercices-content');
        const exo = this.currentExercise;

        // Calculer le temps passé
        const timeSpent = this.exerciseStartTime ? Math.round((Date.now() - this.exerciseStartTime) / 1000) : 0;
        const tempsPrevu = exo.duree || 300;
        const tempsOK = timeSpent <= tempsPrevu;

        // Récupérer le résultat de validation (calculé dans saveResult)
        const validationResult = this.lastValidationResult || {
            repetitionValidee: false,
            nouvelleRepetition: 0,
            message: 'Résultat',
            conseil: '',
            estMaitrise: false
        };

        // Déterminer le type de résultat pour le style
        const isSuccess = validationResult.repetitionValidee;
        const resultType = isSuccess ? 'success' : (results.percent === 100 ? 'partial' : 'error');

        // Générer les points de progression (5 dots avec numéros)
        const generateRepDots = () => {
            let html = '<div class="rep-dots">';
            for (let i = 1; i <= this.SEUIL_REPETITIONS; i++) {
                const status = i <= validationResult.nouvelleRepetition ? 'completed' : 'pending';
                html += `<span class="rep-dot ${status}">${i}</span>`;
            }
            html += '</div>';
            return html;
        };

        // Trouver l'exercice suivant
        const nextExercise = this.findNextExercise();

        // Prochaine date si applicable
        let prochaineDateStr = '';
        if (validationResult.prochaineDispo) {
            prochaineDateStr = new Date(validationResult.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }

        // Collecter les détails de correction
        const correctionDetails = this.collectExerciseDetails();

        // Générer le HTML de correction avec tableau clair montrant réponses élève vs attendues
        const generateCorrectionHTML = () => {
            if (correctionDetails.length === 0) {
                return '<p class="correction-fallback">Correction non disponible.</p>';
            }

            let html = `
                <div class="correction-table-wrapper">
                    <table class="correction-table-display">
                        <thead>
                            <tr>
                                <th class="col-question">Question</th>
                                <th class="col-reponse">Ta réponse</th>
                                <th class="col-attendue">Réponse attendue</th>
                                <th class="col-status">Résultat</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            correctionDetails.forEach((detail) => {
                const isCorrect = detail.correct === true;
                const isOpenQuestion = detail.isOpenQuestion === true;
                const statusClass = isOpenQuestion ? 'open' : (isCorrect ? 'correct' : 'incorrect');
                const statusIcon = isOpenQuestion ? '📝' : (isCorrect ? '✅' : '❌');
                const userAnswer = detail.reponseUtilisateur || '';
                const displayUserAnswer = userAnswer.trim() === '' ? '<span class="empty-answer">Non répondu</span>' : this.escapeHtml(userAnswer);

                html += `
                    <tr class="correction-row ${statusClass}">
                        <td class="col-question">${this.escapeHtml(detail.question)}</td>
                        <td class="col-reponse ${statusClass}">${displayUserAnswer}</td>
                        <td class="col-attendue">${this.escapeHtml(detail.reponseAttendue)}</td>
                        <td class="col-status"><span class="status-icon">${statusIcon}</span></td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
            return html;
        };

        container.innerHTML = `
            <div class="result-view sf">
                <button class="exercise-back-btn" onclick="EleveExercices.backToList()">
                    ← Retour aux exercices
                </button>

                <div class="result-card-sf">
                    <!-- BLOC GAUCHE : BILAN -->
                    <div class="result-bilan">
                        <div class="bilan-header ${resultType}">
                            <span class="bilan-icon">${isSuccess ? '✅' : (results.percent === 100 ? '⏱️' : '❌')}</span>
                            <span class="bilan-message">${validationResult.message}</span>
                        </div>

                        <div class="bilan-score">
                            <div class="score-circle ${resultType}">
                                <span class="score-value">${results.percent}%</span>
                            </div>
                            <span class="score-detail">${results.correct}/${results.total}</span>
                        </div>

                        <div class="bilan-temps-compact">
                            <span class="temps-info">⏱️ ${this.formatTime(timeSpent)} / ${this.formatTime(tempsPrevu)}</span>
                            <span class="temps-status ${tempsOK ? 'success' : 'warning'}">${tempsOK ? '✓' : '⚠️'}</span>
                        </div>

                        ${!this.isEntrainementLibre ? `
                        <div class="bilan-repetition-compact">
                            <span class="rep-dots-inline">${generateRepDots()}</span>
                            <span class="rep-label">Niveau ${validationResult.nouvelleRepetition}/${this.SEUIL_REPETITIONS}</span>
                        </div>
                        ` : `
                        <div class="bilan-entrainement-libre-badge">
                            <span class="libre-badge-icon">🔄</span>
                            <span class="libre-badge-text">Entraînement libre</span>
                        </div>
                        <div class="bilan-actions-libre">
                            ${validationResult.scoreEntrainementLibre === 100 ? `
                                <button class="btn btn-primary btn-continuer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                    🔄 Continuer de s'entraîner
                                </button>
                            ` : `
                                <button class="btn btn-primary btn-reessayer-libre" onclick="EleveExercices.restartExercise()">
                                    🔄 Réessayer cet exercice
                                </button>
                            `}
                        </div>
                        `}

                        <!-- Messages -->
                        <div class="bilan-messages">
                            ${validationResult.conseil && !isSuccess && !this.isEntrainementLibre ? `
                                <div class="bilan-conseil warning">
                                    <span class="conseil-icon">💡</span>
                                    <p>${validationResult.conseil}</p>
                                </div>
                            ` : ''}

                            ${isSuccess && prochaineDateStr && !validationResult.estMaitrise ? `
                                <div class="bilan-prochaine-new">
                                    <p class="prochaine-main">🎯 Reviens le <strong>${prochaineDateStr}</strong> pour valider le niveau ${validationResult.nouvelleRepetition + 1} !</p>
                                    <p class="prochaine-sub">En attendant, tu peux t'entraîner autant que tu veux</p>
                                    <button class="btn btn-entrainer-libre" onclick="EleveExercices.startEntrainementLibre()">
                                        💪 Continuer à s'entraîner
                                    </button>
                                </div>
                            ` : ''}

                            ${validationResult.estMaitrise ? `
                                <div class="bilan-maitrise">
                                    <span class="maitrise-icon">🎉</span>
                                    <p>Bravo ! Tu maîtrises cette banque !</p>
                                </div>
                            ` : ''}


                            <div class="bilan-actions">
                                ${!isSuccess && !this.isEntrainementLibre ? `
                                    <button class="btn btn-primary btn-restart-sf" onclick="EleveExercices.restartExercise()">
                                        🔄 Réessayer cet exercice
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- BLOC DROITE : CORRECTION (tableau original avec corrections inline) -->
                    <div class="result-correction">
                        <div class="correction-header">
                            <h3>📝 Correction</h3>
                        </div>
                        <div class="correction-content correction-table">
                            <div class="exercise-content">${results.correctedHTML || '<p class="correction-fallback">Correction non disponible.</p>'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Déclencher l'animation de célébration si réussite (pas en entraînement libre)
        if (isSuccess && !this.isEntrainementLibre) {
            // Petit délai pour que le DOM soit rendu
            setTimeout(() => {
                this.triggerCelebration(validationResult.nouvelleRepetition);
            }, 100);
        }

        // Reset le flag entraînement libre
        this.isEntrainementLibre = false;
    },

    /**
     * Toggle l'affichage du corrigé dans l'écran de résultat SF
     */
    toggleCorrige() {
        const wrapper = document.getElementById('correctedContentWrapper');
        const toggle = document.querySelector('.corrected-toggle');
        const icon = toggle ? toggle.querySelector('.toggle-icon') : null;

        if (wrapper) {
            const isHidden = wrapper.style.display === 'none';
            wrapper.style.display = isHidden ? 'block' : 'none';
            if (toggle) {
                toggle.innerHTML = isHidden
                    ? '📋 Masquer le corrigé <span class="toggle-icon">▲</span>'
                    : '📋 Voir le corrigé <span class="toggle-icon">▼</span>';
            }
        }
    },

    /**
     * Toggle l'affichage des détails dans l'écran de résultat (ancien)
     */
    toggleResultDetails() {
        const content = document.getElementById('resultDetailsContent');
        const icon = document.querySelector('.result-details .toggle-icon');
        if (content) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            if (icon) icon.textContent = isHidden ? '▲' : '▼';
        }
    },

    /**
     * Trouve l'exercice suivant dans la même banque
     */
    findNextExercise() {
        if (!this.currentExercise || !this.exercices) return null;

        const currentBanqueExercices = this.exercices
            .filter(e => String(e.banque_id) === String(this.currentExercise.banque_id))
            .sort((a, b) => (a.numero || 0) - (b.numero || 0));

        const currentIndex = currentBanqueExercices.findIndex(e => e.id === this.currentExercise.id);
        if (currentIndex >= 0 && currentIndex < currentBanqueExercices.length - 1) {
            return currentBanqueExercices[currentIndex + 1];
        }
        return null;
    },

    /**
     * Recommence l'exercice actuel
     */
    restartExercise() {
        if (this.currentExercise) {
            this.startExercise(this.currentExercise.id);
        }
    },

    /**
     * Lance un exercice aléatoire de la même banque en mode entraînement libre
     */
    startEntrainementLibre() {
        if (!this.currentExercise || !this.exercices) return;

        // Récupérer tous les exercices de la même banque
        const exercicesMêmeBanque = this.exercices.filter(
            e => String(e.banque_id) === String(this.currentExercise.banque_id)
        );

        if (exercicesMêmeBanque.length <= 1) {
            // Si un seul exercice, relancer le même
            this.startExercise(this.currentExercise.id, true);
            return;
        }

        // Exclure l'exercice courant et en choisir un aléatoire
        const autresExercices = exercicesMêmeBanque.filter(
            e => e.id !== this.currentExercise.id
        );
        const exerciceAleatoire = autresExercices[Math.floor(Math.random() * autresExercices.length)];

        this.startExercise(exerciceAleatoire.id, true);
    },

    /**
     * Déclenche une animation de célébration (paillettes/confettis)
     * @param {number} level - Niveau atteint (1-5), détermine l'intensité
     */
    triggerCelebration(level) {
        // Supprimer une célébration existante
        const existing = document.querySelector('.celebration-container');
        if (existing) existing.remove();

        // Créer le conteneur
        const container = document.createElement('div');
        container.className = `celebration-container level-${level}`;
        document.body.appendChild(container);

        // Configuration selon le niveau
        const config = {
            1: { sparkles: 20, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b'] },
            2: { sparkles: 35, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#34d399'] },
            3: { sparkles: 40, confetti: 20, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6'] },
            4: { sparkles: 50, confetti: 40, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            5: { sparkles: 60, confetti: 60, stars: 15, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'] }
        };

        const cfg = config[Math.min(level, 5)] || config[1];

        // Créer les paillettes
        for (let i = 0; i < cfg.sparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            sparkle.style.animationDelay = Math.random() * 0.5 + 's';
            sparkle.style.width = (6 + Math.random() * 8) + 'px';
            sparkle.style.height = sparkle.style.width;
            container.appendChild(sparkle);
        }

        // Créer les confettis (niveau 3+)
        for (let i = 0; i < cfg.confetti; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            confetti.style.animationDelay = Math.random() * 0.8 + 's';
            confetti.style.width = (6 + Math.random() * 6) + 'px';
            confetti.style.height = (12 + Math.random() * 10) + 'px';
            container.appendChild(confetti);
        }

        // Créer les étoiles dorées (niveau 5)
        for (let i = 0; i < cfg.stars; i++) {
            const star = document.createElement('div');
            star.className = 'golden-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 1 + 's';
            star.style.width = (15 + Math.random() * 15) + 'px';
            star.style.height = star.style.width;
            container.appendChild(star);
        }

        // Supprimer après l'animation
        setTimeout(() => {
            container.remove();
        }, 5000);
    },

    /**
     * Lance l'exercice suivant
     */
    startNextExercise() {
        const next = this.findNextExercise();
        if (next) {
            this.startExercise(next.id);
        } else {
            this.backToList();
        }
    },

    // ===============================
    // CORRECTIONS
    // ===============================

    /**
     * Applique les corrections sur l'exercice actuel (remplit les bonnes réponses)
     * @param {string} typeUI - Type d'interface de l'exercice
     */
    applyCorrections(typeUI) {
        if (typeUI === 'carte_cliquable') {
            this.showCarteCorrige();
        } else if (typeUI === 'document_mixte') {
            this.showDocumentMixteCorrige();
        } else if (typeUI === 'question_ouverte') {
            this.showQuestionOuverteCorrige();
        } else if (typeUI === 'tableau_saisie' || typeUI === 'document_tableau') {
            this.showTableauCorrige();
        }
    },

    /**
     * Capture le HTML d'un élément en incluant les valeurs actuelles des inputs
     * (innerHTML ne capture pas les valeurs des inputs, seulement les attributs)
     */
    captureContentWithValues(element) {
        if (!element) return '';

        // Cloner l'élément pour ne pas modifier l'original
        const clone = element.cloneNode(true);

        // Pour chaque input dans le clone, mettre la valeur comme attribut
        const originalInputs = element.querySelectorAll('input, textarea');
        const clonedInputs = clone.querySelectorAll('input, textarea');

        originalInputs.forEach((origInput, idx) => {
            const clonedInput = clonedInputs[idx];
            if (clonedInput) {
                // Définir l'attribut value avec la valeur actuelle
                clonedInput.setAttribute('value', origInput.value);
                // Pour les textareas, mettre le contenu
                if (origInput.tagName === 'TEXTAREA') {
                    clonedInput.textContent = origInput.value;
                }
            }
        });

        return clone.innerHTML;
    },

    // ===============================
    // SHOW CORRIGE
    // ===============================

    showCorrige() {
        this.stopTimer(); // Stop timer when showing correction

        const format = this.formats.find(f => f.id === this.currentExercise.format_id);
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }
        const typeUI = structure ? structure.type_ui : 'tableau_saisie';

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
                // Masquer le badge texte pour éviter les chevauchements — le détail est dans le popup
                badge.classList.add('hidden');
            }

            if (marqueur) {
                // Colorer le marqueur selon le résultat
                marqueur.classList.remove('incorrect', 'correct', 'answered');
                marqueur.classList.add('show-correction');
                marqueur.classList.add(isCorrect ? 'correction-correct' : 'correction-incorrect');

                // Stocker les données de correction dans des attributs data
                marqueur.setAttribute('data-user-answer', userAnswer);
                marqueur.setAttribute('data-correct-answer', firstCorrectAnswer);
                marqueur.setAttribute('data-is-correct', isCorrect ? 'true' : 'false');
                marqueur.setAttribute('data-correction-mode', 'true');

                // Changer l'attribut onclick pour le mode correction
                marqueur.setAttribute('onclick', `EleveExercices.openMarqueurCorrectionModal(${index})`);
            }
        });
    },

    /**
     * Ouvre le popup de correction pour un marqueur de carte cliquable
     * @param {number} index - Index du marqueur
     */
    openMarqueurCorrectionModal(index) {
        // Récupérer les données depuis les attributs du marqueur
        const marqueur = document.querySelector(`.carte-marqueur[data-id="${index}"]`);
        if (!marqueur || marqueur.getAttribute('data-correction-mode') !== 'true') {
            // Si pas en mode correction, ouvrir le modal normal
            this.openMarqueurModal(index);
            return;
        }

        const userAnswer = marqueur.getAttribute('data-user-answer') || '';
        const correctAnswer = marqueur.getAttribute('data-correct-answer') || '';
        const isCorrect = marqueur.getAttribute('data-is-correct') === 'true';
        const hasAnswer = userAnswer.trim() !== '';

        // Construire le contenu du popup
        let bodyHTML = '';

        if (isCorrect) {
            // Réponse correcte : un seul encart vert
            bodyHTML = `
                <div class="correction-answer correct">
                    <span class="answer-text">${this.escapeHtml(userAnswer)}</span>
                    <span class="answer-icon">✓</span>
                </div>
            `;
        } else {
            // Réponse incorrecte ou non répondue
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

        // Mettre à jour le modal
        const modal = document.getElementById('marqueurModal');
        if (modal) {
            document.getElementById('modalMarqueurNum').textContent = index + 1;

            // Remplacer le body du modal par le contenu de correction
            const modalBody = modal.querySelector('.carte-modal-body');
            if (modalBody) {
                modalBody.innerHTML = bodyHTML;
            }

            // Cacher le footer (pas de boutons Annuler/Valider en mode correction)
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

        // Récupérer le contenu du document avant de le masquer
        const docSection = document.querySelector('.mixte-document') || document.querySelector('.mixte-left-column');
        let documentHTML = '';
        if (docSection) {
            documentHTML = docSection.innerHTML;
            // Supprimer complètement la section document du layout
            docSection.remove();
        }

        // Passer le container en layout vertical pleine largeur
        if (container) {
            container.classList.remove('horizontal-layout');
            container.classList.add('correction-fullwidth');

            // Créer le bouton "Voir le document" et le modal s'ils n'existent pas
            if (documentHTML && !document.getElementById('toggleDocumentBtn')) {
                // Bouton pour ouvrir le modal
                const toggleBtn = document.createElement('button');
                toggleBtn.id = 'toggleDocumentBtn';
                toggleBtn.className = 'btn-toggle-document';
                toggleBtn.innerHTML = '📄 Voir le document';
                toggleBtn.setAttribute('onclick', 'EleveExercices.openDocumentModal()');
                container.insertBefore(toggleBtn, container.firstChild);

                // Modal pour le document
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

                        // Garder la réponse de l'élève et colorer selon le résultat
                        input.classList.remove('incorrect', 'correct');
                        input.classList.add(isCorrect ? 'correct' : 'incorrect');
                        input.disabled = true;

                        // Si non répondu, afficher un placeholder
                        if (!userAnswer) {
                            input.value = '(non répondu)';
                            input.classList.add('empty-answer');
                        }

                        // Si incorrect, afficher la bonne réponse en dessous
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
                    // Prendre uniquement la première réponse acceptable
                    const firstAnswer = q.reponse_attendue.split(/[|;]/)[0].trim();
                    correctionDiv.innerHTML = `<strong>Réponse attendue :</strong> ${this.escapeHtml(firstAnswer)}`;
                    correctionDiv.style.display = 'block';
                }
            });
        }
    },

    /**
     * Ouvre le modal avec le document
     */
    openDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    /**
     * Ferme le modal du document
     */
    closeDocumentModal() {
        const modal = document.getElementById('documentModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    showTableauCorrige() {
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

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

                        // Créer un conteneur pour remplacer l'input
                        const correctionCell = document.createElement('div');
                        correctionCell.className = 'correction-cell';

                        if (isCorrect) {
                            // Réponse correcte : fond vert
                            correctionCell.classList.add('correct');
                            correctionCell.innerHTML = `<span class="answer-text">${this.escapeHtml(userAnswer)}</span>`;
                        } else {
                            // Incorrect ou vide : fond rouge avec la bonne réponse
                            correctionCell.classList.add('incorrect');
                            if (isEmpty) {
                                // Pas de réponse : juste la bonne réponse
                                correctionCell.innerHTML = `<span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>`;
                            } else {
                                // Mauvaise réponse : réponse barrée + bonne réponse
                                correctionCell.innerHTML = `
                                    <span class="wrong-answer">${this.escapeHtml(userAnswer)}</span>
                                    <span class="arrow">→</span>
                                    <span class="correct-answer">${this.escapeHtml(firstAnswer)}</span>
                                `;
                            }
                        }

                        // Remplacer l'input par le conteneur de correction
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
        let structure = format ? format.structure : null;
        if (typeof structure === 'string') {
            try { structure = JSON.parse(structure); } catch (e) { structure = {}; }
        }

        const typeUI = structure ? structure.type_ui : 'unknown';

        if (typeUI === 'carte_cliquable') {
            this.resetCarteCliquable();
        } else if (typeUI === 'question_ouverte') {
            this.resetQuestionOuverte();
        } else if (typeUI === 'document_mixte') {
            this.resetDocumentMixte();
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
        let donnees = this.currentExercise.donnees;
        if (typeof donnees === 'string') {
            try { donnees = JSON.parse(donnees); } catch (e) { donnees = {}; }
        }

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
