Object.assign(AdminBanquesExercices, {
    // ========== BANQUES DE QUESTIONS (ancien système conservé) ==========

    renderBanquesQuestions(container, emptyState) {
        // Filter banques de questions
        let filtered = this.banquesQuestions;

        if (this.filters.search) {
            filtered = filtered.filter(b =>
                (b.titre || '').toLowerCase().includes(this.filters.search) ||
                (b.description || '').toLowerCase().includes(this.filters.search)
            );
        }

        // Sort by date_creation desc
        filtered.sort((a, b) => (b.date_creation || '').localeCompare(a.date_creation || ''));

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = filtered.map(banque => {
            const questions = this.questionsConnaissances.filter(q => q.banque_id === banque.id);
            const questionsByType = {};
            questions.forEach(q => {
                questionsByType[q.type] = (questionsByType[q.type] || 0) + 1;
            });

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <div class="banque-card-icon connaissances">&#128994;</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || 'Sans titre')}
                            </div>
                            <div class="banque-card-meta">
                                ${banque.description ? this.escapeHtml(banque.description) : 'Aucune description'}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${questions.length}</div>
                                <div class="banque-stat-label">questions</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueQuestions('${banque.id}')" title="Modifier">&#9998;</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueQuestions('${banque.id}')" title="Supprimer">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Questions</h4>
                            <div class="exercices-header-actions">
                                <button class="btn btn-primary btn-sm" onclick="AdminBanquesExercices.addQuestionConnaissances('${banque.id}')">+ Ajouter</button>
                                <button class="btn btn-success btn-sm" onclick="AdminBanquesExercices.openEntrainementWizard(null, '${banque.id}')" ${questions.length === 0 ? 'disabled title="Ajoutez des questions d\'abord"' : ''}>🎯 Créer entraînement</button>
                            </div>
                        </div>
                        ${this.renderQuestionsConnaissances(questions, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderQuestionsConnaissances(questions, banqueId) {
        if (questions.length === 0) {
            return '<div class="exercices-empty">Aucune question dans cette banque</div>';
        }

        return `
            <div class="exercices-list">
                ${questions.map(q => {
                    const typeName = this.questionTypeNames[q.type] || q.type;
                    const preview = this.getQuestionPreview(q);

                    return `
                        <div class="exercice-item" data-id="${q.id}">
                            <div class="exercice-numero">${typeName.charAt(0)}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(preview)}</div>
                                <div class="exercice-meta">${typeName}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editQuestionConnaissances('${q.id}')" title="Modifier">&#9998;</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteQuestionConnaissances('${q.id}')" title="Supprimer">&#128465;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    getQuestionPreview(question) {
        // Titre prof prioritaire s'il existe
        if (question.titre_prof) return question.titre_prof;

        if (!question.donnees) return 'Question sans contenu';

        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
            case 'question_ouverte':
                return (question.donnees.question || '').substring(0, 60) || 'Question sans texte';
            case 'chronologie':
            case 'timeline':
                return (question.donnees.consigne || '').substring(0, 60) || 'Frise chronologique';
            case 'association':
                return (question.donnees.consigne || '').substring(0, 60) || 'Exercice d\'association';
            case 'texte_trou':
                return (question.donnees.texte || '').substring(0, 60) || 'Texte à trous';
            case 'carte':
                return (question.donnees.consigne || '').substring(0, 60) || 'Image cliquable';
            case 'flashcard':
                const fc = question.donnees.cartes || [];
                return fc.length > 0 ? `Flashcards (${fc.length} cartes)` : 'Flashcards';
            default:
                return 'Question';
        }
    },

    // CRUD pour Banques de Questions
    addBanqueQuestions() {
        this.openBanqueQuestionsModal();
    },

    editBanqueQuestions(id) {
        const banque = this.banquesQuestions.find(b => b.id === id);
        if (!banque) return;
        this.openBanqueQuestionsModal(banque);
    },

    openBanqueQuestionsModal(banque = null) {
        const modal = document.getElementById('banqueQuestionsModal');
        const title = document.getElementById('banqueQuestionsModalTitle');

        if (banque) {
            title.textContent = 'Modifier la banque de questions';
            document.getElementById('editBanqueQuestionsId').value = banque.id;
            document.getElementById('banqueQuestionsTitre').value = banque.titre || '';
            document.getElementById('banqueQuestionsDescription').value = banque.description || '';
        } else {
            title.textContent = 'Nouvelle banque de questions';
            document.getElementById('editBanqueQuestionsId').value = '';
            document.getElementById('banqueQuestionsTitre').value = '';
            document.getElementById('banqueQuestionsDescription').value = '';
        }

        modal.classList.remove('hidden');
    },

    closeBanqueQuestionsModal() {
        document.getElementById('banqueQuestionsModal').classList.add('hidden');
    },

    async saveBanqueQuestions() {
        const id = document.getElementById('editBanqueQuestionsId').value;
        const titre = document.getElementById('banqueQuestionsTitre').value.trim();
        const description = document.getElementById('banqueQuestionsDescription').value.trim();

        if (!titre) {
            alert('Le titre est requis');
            return;
        }

        try {
            let result;
            if (id) {
                result = await this.callAPI('updateBanqueQuestions', { id, titre, description });
            } else {
                result = await this.callAPI('createBanqueQuestions', { titre, description });
            }

            if (result.success) {
                this.closeBanqueQuestionsModal();
                await this.loadDataFromAPI();
                this.renderBanques();
                this.updateCounts();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la sauvegarde');
        }
    },

    async deleteBanqueQuestions(id) {
        if (!confirm('Supprimer cette banque et toutes ses questions ?')) return;

        try {
            const result = await this.callAPI('deleteBanqueQuestions', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
                this.updateCounts();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    },

    // CRUD pour Questions de Connaissances
    addQuestionConnaissances(banqueId) {
        this.currentQuestionBanqueId = banqueId;
        this.currentQuestionId = null;
        this.openQuestionModal();
    },

    editQuestionConnaissances(questionId) {
        const question = this.questionsConnaissances.find(q => q.id === questionId);
        if (!question) return;

        this.currentQuestionBanqueId = question.banque_id;
        this.currentQuestionId = questionId;
        this.openQuestionModal(question);
    },

    async deleteQuestionConnaissances(id) {
        if (!confirm('Supprimer cette question ?')) return;

        try {
            const result = await this.callAPI('deleteQuestionConnaissances', { id });
            if (result.success) {
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la suppression');
        }
    },

    openQuestionModal(question = null) {
        // Ouvrir le modal pour créer/éditer une question
        const modal = document.getElementById('questionConnaissancesModal');
        if (!modal) {
            alert('Modal non trouvé. Veuillez rafraîchir la page.');
            return;
        }

        const titleEl = document.getElementById('questionModalTitle');
        const typeSelect = document.getElementById('questionType');
        const titreProfInput = document.getElementById('questionTitreProf');
        const builderContainer = document.getElementById('questionBuilder');

        titleEl.textContent = question ? 'Modifier la question' : 'Nouvelle question';

        if (question) {
            // Rétro-compat: mapper chronologie → timeline
            const qType = question.type === 'chronologie' ? 'timeline' : (question.type || 'qcm');
            typeSelect.value = qType;
            if (titreProfInput) titreProfInput.value = question.titre_prof || '';
            this.renderQuestionBuilder(question.type, question.donnees);
        } else {
            typeSelect.value = 'qcm';
            if (titreProfInput) titreProfInput.value = '';
            this.renderQuestionBuilder('qcm', {});
        }

        modal.classList.remove('hidden');
    },

    closeQuestionModal() {
        const modal = document.getElementById('questionConnaissancesModal');
        if (modal) modal.classList.add('hidden');
    },

    renderQuestionBuilder(type, data = {}) {
        const container = document.getElementById('questionBuilder');
        if (!container) return;

        let html = '';

        switch (type) {
            case 'qcm':
                // Préparer les options existantes
                const existingOptions = data.options || [];
                const correctAnswers = Array.isArray(data.reponses_correctes)
                    ? data.reponses_correctes
                    : (data.reponse_correcte !== undefined ? [data.reponse_correcte] : [0]);

                const existingFeedbacks = data.feedbacks_options || [];

                html = `
                    <div class="form-group">
                        <label>Question</label>
                        <textarea id="qcmQuestion" class="form-textarea" rows="3">${this.escapeHtml(data.question || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Options de réponse</label>
                        <p class="form-help">Cochez la ou les bonnes réponses. Ajoutez un feedback personnalisé pour chaque option (optionnel).</p>
                        <div id="qcmOptionsList">
                            ${existingOptions.length > 0 ? existingOptions.map((opt, i) => `
                                <div class="qcm-option-row" style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="checkbox" class="qcm-correct-checkbox" ${correctAnswers.includes(i) ? 'checked' : ''} title="Cocher si bonne réponse">
                                        <input type="text" class="form-input qcm-option-text" placeholder="Option ${i + 1}" value="${this.escapeHtml(opt)}" style="flex: 1;">
                                        <button type="button" class="btn-icon danger" onclick="this.closest('.qcm-option-row').remove()" title="Supprimer">×</button>
                                    </div>
                                    <input type="text" class="form-input qcm-option-feedback" placeholder="Feedback si cette option est choisie (optionnel)" value="${this.escapeHtml(existingFeedbacks[i] || '')}" style="margin-top: 6px; font-size: 0.85em;">
                                </div>
                            `).join('') : `
                                <div class="qcm-option-row" style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="checkbox" class="qcm-correct-checkbox" checked title="Cocher si bonne réponse">
                                        <input type="text" class="form-input qcm-option-text" placeholder="Option 1" value="" style="flex: 1;">
                                        <button type="button" class="btn-icon danger" onclick="this.closest('.qcm-option-row').remove()" title="Supprimer">×</button>
                                    </div>
                                    <input type="text" class="form-input qcm-option-feedback" placeholder="Feedback si cette option est choisie (optionnel)" value="" style="margin-top: 6px; font-size: 0.85em;">
                                </div>
                                <div class="qcm-option-row" style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="checkbox" class="qcm-correct-checkbox" title="Cocher si bonne réponse">
                                        <input type="text" class="form-input qcm-option-text" placeholder="Option 2" value="" style="flex: 1;">
                                        <button type="button" class="btn-icon danger" onclick="this.closest('.qcm-option-row').remove()" title="Supprimer">×</button>
                                    </div>
                                    <input type="text" class="form-input qcm-option-feedback" placeholder="Feedback si cette option est choisie (optionnel)" value="" style="margin-top: 6px; font-size: 0.85em;">
                                </div>
                            `}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addQcmOption()">+ Ajouter une option</button>
                    </div>
                `;
                break;

            case 'vrai_faux':
                html = `
                    <div class="form-group">
                        <label>Question</label>
                        <textarea id="vfQuestion" class="form-textarea" rows="3">${this.escapeHtml(data.question || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Réponse correcte</label>
                        <select id="vfReponse" class="form-select">
                            <option value="vrai" ${data.reponse === 'vrai' ? 'selected' : ''}>Vrai</option>
                            <option value="faux" ${data.reponse === 'faux' ? 'selected' : ''}>Faux</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" id="vfShowFeedback" ${data.feedback_vrai || data.feedback_faux ? 'checked' : ''} onchange="document.getElementById('vfFeedbackSection').style.display = this.checked ? 'block' : 'none'">
                            Ajouter des feedbacks (optionnel)
                        </label>
                    </div>
                    <div id="vfFeedbackSection" style="display: ${data.feedback_vrai || data.feedback_faux ? 'block' : 'none'};">
                        <div class="form-group">
                            <label>Feedback si l'élève répond "Vrai"</label>
                            <textarea id="vfFeedbackVrai" class="form-textarea" rows="2" placeholder="Bravo ! ou Explication si faux...">${this.escapeHtml(data.feedback_vrai || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Feedback si l'élève répond "Faux"</label>
                            <textarea id="vfFeedbackFaux" class="form-textarea" rows="2" placeholder="Bravo ! ou Explication si faux...">${this.escapeHtml(data.feedback_faux || '')}</textarea>
                        </div>
                    </div>
                `;
                break;

            case 'chronologie': // rétro-compatibilité anciennes questions
            case 'timeline': {
                // Détecter le sous-mode depuis les données existantes
                const isTexteMode = !!(data.paires && data.mode) || type === 'chronologie';

                // --- Préparer les données Mode texte ---
                const pairesChronologie = data.paires || [{ date: '', evenement: '', cache: 'date' }];
                const modeChrono = data.mode || 'date';

                // --- Préparer les données Mode cartes ---
                let cartes = data.cartes || [];
                if (cartes.length === 0 && data.evenements && !isTexteMode) {
                    cartes = data.evenements.map(e => ({ titre: e, image_url: '' }));
                }
                if (cartes.length === 0) {
                    cartes = [{ titre: '', image_url: '' }];
                }

                html = `
                    <!-- Toggle mode texte / cartes -->
                    <div class="form-group">
                        <label>Type de frise</label>
                        <div class="timeline-mode-toggle" style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <label class="radio-card ${isTexteMode ? 'selected' : ''}" style="flex: 1; padding: 1rem; border: 2px solid ${isTexteMode ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                <input type="radio" name="timelineMode" value="texte" ${isTexteMode ? 'checked' : ''} onchange="AdminBanquesExercices.toggleTimelineMode(this.value)" style="display: none;">
                                <div style="font-weight: 600; margin-bottom: 0.25rem;">📝 Mode texte</div>
                                <div style="font-size: 0.8rem; color: var(--gray-500);">L'élève complète les dates ou événements manquants</div>
                            </label>
                            <label class="radio-card ${!isTexteMode ? 'selected' : ''}" style="flex: 1; padding: 1rem; border: 2px solid ${!isTexteMode ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                <input type="radio" name="timelineMode" value="cartes" ${!isTexteMode ? 'checked' : ''} onchange="AdminBanquesExercices.toggleTimelineMode(this.value)" style="display: none;">
                                <div style="font-weight: 600; margin-bottom: 0.25rem;">🖼️ Mode cartes</div>
                                <div style="font-size: 0.8rem; color: var(--gray-500);">L'élève remet les cartes dans l'ordre chronologique</div>
                            </label>
                        </div>
                    </div>

                    <!-- ===== Contenu Mode Texte ===== -->
                    <div id="timelineTexteMode" style="display: ${isTexteMode ? 'block' : 'none'}">
                        <div class="form-group">
                            <label>Consigne</label>
                            <input type="text" id="chronoConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Complétez la frise chronologique')}">
                        </div>
                        <div class="form-group">
                            <label>Que doit trouver l'élève ?</label>
                            <div class="chrono-mode-selector" style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                                <label class="radio-card ${modeChrono === 'date' ? 'selected' : ''}" style="flex: 1; padding: 1rem; border: 2px solid ${modeChrono === 'date' ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                    <input type="radio" name="chronoMode" value="date" ${modeChrono === 'date' ? 'checked' : ''} onchange="AdminBanquesExercices.updateChronoMode(this.value)" style="display: none;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">📅 Les dates</div>
                                    <div style="font-size: 0.8rem; color: var(--gray-500);">L'événement est affiché, l'élève trouve la date</div>
                                </label>
                                <label class="radio-card ${modeChrono === 'evenement' ? 'selected' : ''}" style="flex: 1; padding: 1rem; border: 2px solid ${modeChrono === 'evenement' ? 'var(--primary)' : 'var(--gray-200)'}; border-radius: 8px; cursor: pointer; text-align: center;">
                                    <input type="radio" name="chronoMode" value="evenement" ${modeChrono === 'evenement' ? 'checked' : ''} onchange="AdminBanquesExercices.updateChronoMode(this.value)" style="display: none;">
                                    <div style="font-weight: 600; margin-bottom: 0.25rem;">📝 Les événements</div>
                                    <div style="font-size: 0.8rem; color: var(--gray-500);">La date est affichée, l'élève trouve l'événement</div>
                                </label>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Aperçu de la frise <span style="font-weight: normal; color: var(--gray-500);">(triée par date)</span></label>
                            <div id="chronoFrisePreview" class="chrono-frise-preview">
                                <div class="chrono-frise-arrow">
                                    <div class="chrono-frise-line"></div>
                                    <div class="chrono-frise-arrow-head"></div>
                                </div>
                                <div id="chronoFriseMarkers" class="chrono-frise-markers"></div>
                            </div>
                            <p class="form-help" style="margin-top: 0.5rem;">Les éléments en <span style="background: #f3e8ff; color: #7c3aed; padding: 2px 6px; border-radius: 4px;">violet</span> sont cachés pour l'élève.</p>
                        </div>
                        <div class="form-group">
                            <label>Événements</label>
                            <p class="form-help">Les événements seront automatiquement triés par date sur la frise. Vous pouvez ajouter des réponses alternatives acceptées.</p>
                            <div id="chronoPaires">
                                ${pairesChronologie.map((p, i) => this.renderChronoEventRow(p, i)).join('')}
                            </div>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addChronoPair()">+ Ajouter un événement</button>
                        </div>
                        <div class="form-group">
                            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Mode de correction</label>
                            <label style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.5rem; cursor: pointer;">
                                <input type="radio" name="timelineCompMode" value="souple" ${!data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                                <span>
                                    <strong>Comparaison souple</strong> <span style="color: #6b7280; font-size: 0.85em;">(recommandé)</span><br>
                                    <span style="color: #6b7280; font-size: 0.85em;">Tolère les différences de casse, accents et ponctuation. Chiffres romains, arabes et en lettres équivalents.</span>
                                </span>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                                <input type="radio" name="timelineCompMode" value="stricte" ${data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                                <span>
                                    <strong>Réponse exacte</strong><br>
                                    <span style="color: #6b7280; font-size: 0.85em;">L'élève doit écrire exactement la réponse attendue (majuscules, accents, ponctuation...).</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- ===== Contenu Mode Cartes ===== -->
                    <div id="timelineCartesMode" style="display: ${!isTexteMode ? 'block' : 'none'}">
                        <div class="form-group">
                            <label>Consigne</label>
                            <input type="text" id="timelineConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Remettez les événements dans l\'ordre chronologique')}">
                        </div>
                        <div class="form-group">
                            <label>Aperçu des cartes (ordre correct)</label>
                            <p class="form-help">De gauche (le plus ancien) à droite (le plus récent). Glissez pour réordonner.</p>
                            <div id="timelineCardsPreview" class="timeline-cards-container">
                            </div>
                            <div class="timeline-axis">
                                <span class="timeline-axis-label">Ancien</span>
                                <div class="timeline-axis-line"></div>
                                <span class="timeline-axis-label">Récent</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Cartes (ordre chronologique)</label>
                            <p class="form-help">Définissez chaque carte avec son titre et une image de fond optionnelle.</p>
                            <div id="timelineEvents">
                                ${cartes.map((c, i) => this.renderTimelineCardForm(c, i)).join('')}
                            </div>
                            <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addTimelineEvent()">+ Ajouter une carte</button>
                        </div>
                    </div>
                `;
                // Initialiser les prévisualisations
                setTimeout(() => {
                    if (isTexteMode) {
                        this.chronoMode = modeChrono;
                        this.updateChronoPreview();
                    } else {
                        this.updateTimelinePreview();
                        this.initTimelineDragDrop();
                    }
                }, 50);
                break;
            }

            case 'association':
                const pairesAssoc = data.paires || [{ element1: '', element2: '' }];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="assocConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Associez les éléments')}">
                    </div>
                    <div class="form-group">
                        <label>Paires à associer</label>
                        <p class="form-help">Pour chaque élément, choisissez texte ou image (URL Google Drive partagée).</p>
                        <div id="assocPaires">
                            ${pairesAssoc.map((p, i) => this.renderAssocPairRow(p)).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addAssocPair()">+ Ajouter une paire</button>
                    </div>
                `;
                break;

            case 'texte_trou':
                // Extraire le texte brut et les trous existants
                const existingText = data.texte || '';
                const existingGaps = data.trous || [];
                // Convertir l'ancien format {mot} en nouveau format si nécessaire
                let cleanText = existingText;
                if (existingText.includes('{') && existingGaps.length === 0) {
                    // Ancien format - convertir
                    cleanText = existingText.replace(/\{([^}]+)\}/g, '$1');
                }

                html = `
                    <div class="form-group">
                        <label>1. Saisissez votre texte</label>
                        <textarea id="texteATrousInput" class="form-textarea" rows="4" placeholder="Saisissez le texte complet ici, puis cliquez sur les mots à cacher ci-dessous." oninput="AdminBanquesExercices.updateTexteATrousPreview()">${this.escapeHtml(cleanText)}</textarea>
                    </div>
                    <div class="form-group">
                        <label>2. Cliquez sur les mots à transformer en trous</label>
                        <p class="form-help">Les mots en violet sont les trous que l'élève devra compléter.</p>
                        <div id="texteATrousPreview" class="texte-trous-preview">
                            <p class="texte-trous-empty">Saisissez du texte ci-dessus pour commencer</p>
                        </div>
                    </div>
                    <div class="form-group" id="texteATrousGapsSection" style="display: none;">
                        <label>3. Réponses alternatives (optionnel)</label>
                        <p class="form-help">Pour chaque trou, vous pouvez ajouter des réponses alternatives acceptées.</p>
                        <div id="texteATrousGapsList"></div>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Mode de correction</label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="radio" name="texteATrousMode" value="souple" ${!data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Comparaison souple</strong> <span style="color: #6b7280; font-size: 0.85em;">(recommandé)</span><br>
                                <span style="color: #6b7280; font-size: 0.85em;">Tolère les différences de casse, accents et ponctuation. Chiffres romains, arabes et en lettres équivalents.</span>
                            </span>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                            <input type="radio" name="texteATrousMode" value="stricte" ${data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Réponse exacte</strong><br>
                                <span style="color: #6b7280; font-size: 0.85em;">L'élève doit écrire exactement la réponse attendue (majuscules, accents, ponctuation...).</span>
                            </span>
                        </label>
                    </div>
                `;
                // Initialiser avec les données existantes
                setTimeout(() => {
                    this.texteATrousGaps = [];
                    // Si ancien format, extraire les trous
                    if (existingText.includes('{') && existingGaps.length === 0) {
                        const regex = /\{([^}]+)\}/g;
                        let match;
                        let wordIndex = 0;
                        const words = cleanText.split(/(\s+)/);
                        while ((match = regex.exec(existingText)) !== null) {
                            const word = match[1];
                            // Trouver l'index du mot
                            for (let i = 0; i < words.length; i++) {
                                if (words[i] === word && !this.texteATrousGaps.find(g => g.wordIndex === i)) {
                                    this.texteATrousGaps.push({ wordIndex: i, reponse: word, alternatives: [] });
                                    break;
                                }
                            }
                        }
                    } else if (existingGaps.length > 0) {
                        this.texteATrousGaps = existingGaps.map(g => ({
                            wordIndex: g.wordIndex,
                            reponse: g.reponse,
                            alternatives: g.alternatives || []
                        }));
                    }
                    this.updateTexteATrousPreview();
                }, 50);
                break;

            case 'carte':
                const marqueurs = data.marqueurs || [];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="carteConsigneConn" class="form-input" value="${this.escapeHtml(data.consigne || 'Localisez les éléments sur la carte')}">
                    </div>
                    <div class="form-group">
                        <label>URL de l'image</label>
                        <input type="text" id="carteImageUrlConn" class="form-input" placeholder="https://..." value="${this.escapeHtml(data.image_url || '')}" onchange="AdminBanquesExercices.updateCartePreviewConn(this.value)">
                        <small style="color: var(--gray-500);">URL de l'image (carte, schéma, document...)</small>
                    </div>
                    <div class="form-group">
                        <label>Aperçu et placement des marqueurs</label>
                        <div id="cartePreviewContainerConn" style="border: 2px dashed var(--gray-300); border-radius: 8px; min-height: 200px; position: relative; overflow: hidden;">
                            <div id="cartePreviewPlaceholderConn" style="display: flex; align-items: center; justify-content: center; height: 200px; color: var(--gray-400);">
                                ${data.image_url ? '' : 'Entrez une URL d\'image ci-dessus'}
                            </div>
                            <div id="cartePreviewWrapperConn" style="display: ${data.image_url ? 'block' : 'none'}; position: relative; cursor: crosshair;">
                                <img id="cartePreviewImageConn" src="${this.escapeHtml(data.image_url || '')}" style="display: block; max-width: 100%; height: auto;" onclick="AdminBanquesExercices.onCarteClickConn(event)">
                                <div id="cartePreviewMarkersConn" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
                            </div>
                        </div>
                        <small style="color: var(--gray-500);">Cliquez sur l'image pour placer des marqueurs</small>
                    </div>
                    <div class="form-group">
                        <label>Marqueurs</label>
                        <div id="carteMarqueursListConn">
                            ${marqueurs.length === 0 ? '<p style="color: var(--gray-400); text-align: center; padding: 1rem;">Aucun marqueur. Cliquez sur l\'image ou ajoutez manuellement.</p>' : ''}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addCarteMarqueurConn()">+ Ajouter un marqueur</button>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Mode de correction</label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="radio" name="carteCompMode" value="souple" ${!data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Comparaison souple</strong> <span style="color: #6b7280; font-size: 0.85em;">(recommandé)</span><br>
                                <span style="color: #6b7280; font-size: 0.85em;">Tolère les différences de casse, accents et ponctuation. Chiffres romains, arabes et en lettres équivalents.</span>
                            </span>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                            <input type="radio" name="carteCompMode" value="stricte" ${data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Réponse exacte</strong><br>
                                <span style="color: #6b7280; font-size: 0.85em;">L'élève doit écrire exactement la réponse attendue (majuscules, accents, ponctuation...).</span>
                            </span>
                        </label>
                    </div>
                `;
                // Initialiser le builder après le rendu
                setTimeout(() => {
                    this.initCarteBuilderConn(data);
                }, 0);
                break;

            case 'question_ouverte':
                const reponsesAcceptees = data.reponses_acceptees || [];
                html = `
                    <div class="form-group">
                        <label>Question / Énoncé</label>
                        <textarea id="questionOuverteEnonce" class="form-textarea" rows="3" placeholder="Posez votre question ici...">${this.escapeHtml(data.question || data.enonce || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Réponses acceptées</label>
                        <p class="form-help">Ajoutez toutes les formulations de réponse que vous acceptez. L'élève doit donner une réponse correspondant à l'une d'entre elles.</p>
                        <div id="questionOuverteReponsesList">
                            ${reponsesAcceptees.length > 0 ? reponsesAcceptees.map((rep, i) => `
                                <div class="reponse-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                    <input type="text" class="form-input question-ouverte-reponse" placeholder="Réponse acceptée ${i + 1}" value="${this.escapeHtml(rep)}">
                                    <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" title="Supprimer">×</button>
                                </div>
                            `).join('') : `
                                <div class="reponse-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                    <input type="text" class="form-input question-ouverte-reponse" placeholder="Réponse acceptée 1" value="">
                                    <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" title="Supprimer">×</button>
                                </div>
                            `}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addQuestionOuverteReponse()">+ Ajouter une réponse acceptée</button>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Mode de correction</label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.5rem; cursor: pointer;">
                            <input type="radio" name="questionOuverteMode" value="souple" ${!data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Comparaison souple</strong> <span style="color: #6b7280; font-size: 0.85em;">(recommandé)</span><br>
                                <span style="color: #6b7280; font-size: 0.85em;">Tolère les différences de casse, accents, pluriel, ordre et petits mots (le, la, les, un, de...). Chiffres romains, arabes et en lettres équivalents.</span>
                            </span>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                            <input type="radio" name="questionOuverteMode" value="stricte" ${data.comparaison_stricte ? 'checked' : ''} style="margin-top: 3px;">
                            <span>
                                <strong>Réponse exacte</strong><br>
                                <span style="color: #6b7280; font-size: 0.85em;">L'élève doit écrire exactement la réponse attendue (majuscules, accents, ponctuation...).</span>
                            </span>
                        </label>
                    </div>
                `;
                break;

            case 'flashcard':
                const flashcartes = data.cartes || [{ recto: '', verso: '' }];
                html = `
                    <div class="form-group">
                        <label>Consigne</label>
                        <input type="text" id="flashcardConsigne" class="form-input" value="${this.escapeHtml(data.consigne || 'Retournez chaque carte et évaluez-vous')}">
                    </div>
                    <div class="form-group">
                        <label>Cartes</label>
                        <p class="form-help">Recto = question/indice visible, Verso = réponse révélée au retournement.</p>
                        <div id="flashcardCartes">
                            ${flashcartes.map((c, i) => this.renderFlashcardForm(c, i)).join('')}
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="AdminBanquesExercices.addFlashcard()">+ Ajouter une carte</button>
                    </div>
                `;
                break;

            default:
                html = '<p>Type de question non supporté</p>';
        }

        container.innerHTML = html;
    },

    addQcmOption() {
        const container = document.getElementById('qcmOptionsList');
        if (!container) return;
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'qcm-option-row';
        div.style.cssText = 'margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;';
        div.innerHTML = `
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="checkbox" class="qcm-correct-checkbox" title="Cocher si bonne réponse">
                <input type="text" class="form-input qcm-option-text" placeholder="Option ${count}" value="" style="flex: 1;">
                <button type="button" class="btn-icon danger" onclick="this.closest('.qcm-option-row').remove()" title="Supprimer">×</button>
            </div>
            <input type="text" class="form-input qcm-option-feedback" placeholder="Feedback si cette option est choisie (optionnel)" value="" style="margin-top: 6px; font-size: 0.85em;">
        `;
        container.appendChild(div);
    },

    renderChronoEventRow(p, i) {
        const reponsesAcceptees = p.reponses_acceptees || [];
        const hasAlternatives = reponsesAcceptees.length > 0;
        return `
            <div class="chrono-event-block" style="background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.75rem; margin-bottom: 0.75rem;">
                <div class="chrono-event-row" style="display: flex; gap: 8px; align-items: center;">
                    <span class="chrono-event-num" style="background: var(--primary); color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">${i + 1}</span>
                    <input type="text" class="form-input chrono-date" placeholder="Date (ex: 1789)" value="${this.escapeHtml(p.date || '')}" style="width: 100px;" oninput="AdminBanquesExercices.updateChronoPreview()">
                    <input type="text" class="form-input chrono-event" placeholder="Événement" value="${this.escapeHtml(p.evenement || '')}" oninput="AdminBanquesExercices.updateChronoPreview()">
                    <button type="button" class="btn-icon" onclick="AdminBanquesExercices.toggleChronoAlternatives(this)" title="Réponses alternatives" style="color: ${hasAlternatives ? 'var(--primary)' : 'var(--gray-400)'};">
                        <span style="font-size: 1.2rem;">±</span>
                    </button>
                    <button type="button" class="btn-icon danger" onclick="this.closest('.chrono-event-block').remove(); AdminBanquesExercices.updateChronoPreview(); AdminBanquesExercices.updateChronoNumbers();" title="Supprimer">×</button>
                </div>
                <div class="chrono-alternatives" style="display: ${hasAlternatives ? 'block' : 'none'}; margin-top: 0.5rem; padding-left: 32px;">
                    <label style="font-size: 0.8rem; color: var(--gray-600); display: block; margin-bottom: 0.25rem;">Réponses alternatives acceptées :</label>
                    <div class="chrono-alt-list">
                        ${reponsesAcceptees.map((alt, j) => `
                            <div class="chrono-alt-row" style="display: flex; gap: 4px; margin-bottom: 4px;">
                                <input type="text" class="form-input chrono-alt-input" placeholder="Alternative ${j + 1}" value="${this.escapeHtml(alt)}" style="flex: 1; font-size: 0.85rem;">
                                <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" style="font-size: 0.8rem;">×</button>
                            </div>
                        `).join('')}
                    </div>
                    <button type="button" class="btn btn-xs" onclick="AdminBanquesExercices.addChronoAlternative(this)" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">+ Alternative</button>
                </div>
            </div>
        `;
    },

    addChronoPair() {
        const container = document.getElementById('chronoPaires');
        if (!container) return;
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.innerHTML = this.renderChronoEventRow({ date: '', evenement: '', reponses_acceptees: [] }, count - 1);
        container.appendChild(div.firstElementChild);
        this.updateChronoNumbers();
        this.updateChronoPreview();
    },

    toggleChronoAlternatives(btn) {
        const block = btn.closest('.chrono-event-block');
        const altDiv = block.querySelector('.chrono-alternatives');
        if (altDiv) {
            const isHidden = altDiv.style.display === 'none';
            altDiv.style.display = isHidden ? 'block' : 'none';
            btn.style.color = isHidden ? 'var(--primary)' : 'var(--gray-400)';
        }
    },

    addChronoAlternative(btn) {
        const list = btn.previousElementSibling;
        const count = list.children.length + 1;
        const div = document.createElement('div');
        div.className = 'chrono-alt-row';
        div.style.cssText = 'display: flex; gap: 4px; margin-bottom: 4px;';
        div.innerHTML = `
            <input type="text" class="form-input chrono-alt-input" placeholder="Alternative ${count}" style="flex: 1; font-size: 0.85rem;">
            <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" style="font-size: 0.8rem;">×</button>
        `;
        list.appendChild(div);
    },

    chronoMode: 'date', // 'date' ou 'evenement'

    toggleTimelineMode(mode) {
        const texteDiv = document.getElementById('timelineTexteMode');
        const cartesDiv = document.getElementById('timelineCartesMode');
        if (!texteDiv || !cartesDiv) return;

        if (mode === 'texte') {
            texteDiv.style.display = 'block';
            cartesDiv.style.display = 'none';
            // Init chrono preview
            this.chronoMode = this.chronoMode || 'date';
            this.updateChronoPreview();
        } else {
            texteDiv.style.display = 'none';
            cartesDiv.style.display = 'block';
            // Init timeline preview
            this.updateTimelinePreview();
            this.initTimelineDragDrop();
        }

        // Mettre à jour le style des radio cards
        document.querySelectorAll('.timeline-mode-toggle .radio-card').forEach(card => {
            const input = card.querySelector('input[type="radio"]');
            if (input.value === mode) {
                card.style.borderColor = 'var(--primary)';
                card.classList.add('selected');
            } else {
                card.style.borderColor = 'var(--gray-200)';
                card.classList.remove('selected');
            }
        });
    },

    updateChronoNumbers() {
        const blocks = document.querySelectorAll('#chronoPaires .chrono-event-block');
        blocks.forEach((block, idx) => {
            const numSpan = block.querySelector('.chrono-event-num');
            if (numSpan) numSpan.textContent = idx + 1;
        });
    },

    updateChronoMode(mode) {
        this.chronoMode = mode;
        // Mettre à jour le style des radio cards
        document.querySelectorAll('.chrono-mode-selector .radio-card').forEach(card => {
            const input = card.querySelector('input[type="radio"]');
            if (input.value === mode) {
                card.style.borderColor = 'var(--primary)';
                card.classList.add('selected');
            } else {
                card.style.borderColor = 'var(--gray-200)';
                card.classList.remove('selected');
            }
        });
        this.updateChronoPreview();
    },

    updateChronoPreview() {
        const markersContainer = document.getElementById('chronoFriseMarkers');
        if (!markersContainer) return;

        const rows = document.querySelectorAll('#chronoPaires .chrono-event-row');
        const events = [];
        rows.forEach((row, idx) => {
            const date = row.querySelector('.chrono-date')?.value?.trim() || '';
            const event = row.querySelector('.chrono-event')?.value?.trim() || '';
            if (date || event) {
                // Extraire une valeur numérique de la date pour le tri
                const numericDate = this.extractNumericDate(date);
                events.push({ num: idx + 1, date, event, numericDate });
            }
        });

        if (events.length === 0) {
            markersContainer.innerHTML = '<p class="chrono-frise-empty">Ajoutez des événements pour voir la frise</p>';
            return;
        }

        // Trier par date (du plus ancien au plus récent)
        events.sort((a, b) => a.numericDate - b.numericDate);

        // Calculer les positions équidistantes
        const spacing = 100 / (events.length + 1);
        const mode = this.chronoMode || 'date';

        markersContainer.innerHTML = events.map((e, i) => {
            const isDateHidden = mode === 'date';
            const dateClass = isDateHidden ? 'chrono-marker-hidden' : '';
            const eventClass = !isDateHidden ? 'chrono-marker-hidden' : '';

            return `
                <div class="chrono-frise-marker" style="left: ${spacing * (i + 1)}%;">
                    <div class="chrono-marker-dot">${i + 1}</div>
                    <div class="chrono-marker-date ${dateClass}">${isDateHidden ? '???' : this.escapeHtml(e.date)}</div>
                    <div class="chrono-marker-event ${eventClass}">${!isDateHidden ? '???' : this.escapeHtml(e.event)}</div>
                </div>
            `;
        }).join('');
    },

    extractNumericDate(dateStr) {
        // Extraire un nombre de la date pour pouvoir trier
        // Gère: "1789", "-500", "500 av. J.-C.", "1er janvier 1789", etc.
        if (!dateStr) return 0;

        // Vérifier si c'est avant J.-C.
        const isBC = /av\.?\s*j\.?-?c\.?|bc|bce/i.test(dateStr);

        // Extraire le premier nombre trouvé
        const match = dateStr.match(/-?\d+/);
        if (!match) return 0;

        let num = parseInt(match[0], 10);

        // Si avant J.-C., rendre négatif
        if (isBC && num > 0) num = -num;

        return num;
    },

    // ========== TIMELINE CARTES BUILDER ==========
    renderTimelineCardForm(carte, index) {
        const c = carte || { titre: '', image_url: '' };
        return `
            <div class="timeline-card-form" data-index="${index}">
                <div class="timeline-card-form-header">
                    <span class="timeline-event-num" style="background: var(--primary); color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0;">${index + 1}</span>
                    <span style="font-weight: 600; flex: 1;">Carte ${index + 1}</span>
                    <button type="button" class="btn-icon danger" onclick="this.closest('.timeline-card-form').remove(); AdminBanquesExercices.updateTimelinePreview(); AdminBanquesExercices.updateTimelineNumbers();" title="Supprimer">×</button>
                </div>
                <div class="timeline-card-form-body" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <input type="text" class="form-input timeline-titre" placeholder="Titre de l'événement" value="${this.escapeHtml(c.titre || '')}" oninput="AdminBanquesExercices.updateTimelinePreview()">
                    <input type="text" class="form-input timeline-image" placeholder="Image de fond (URL Google Drive partagée, optionnel)" value="${this.escapeHtml(c.image_url || '')}" oninput="AdminBanquesExercices.updateTimelinePreview()">
                </div>
            </div>
        `;
    },

    addTimelineEvent() {
        const container = document.getElementById('timelineEvents');
        if (!container) return;
        const count = container.children.length;
        const div = document.createElement('div');
        div.innerHTML = this.renderTimelineCardForm({ titre: '', image_url: '' }, count);
        container.appendChild(div.firstElementChild);
        this.updateTimelinePreview();
    },

    updateTimelineNumbers() {
        const forms = document.querySelectorAll('#timelineEvents .timeline-card-form');
        forms.forEach((form, idx) => {
            const numSpan = form.querySelector('.timeline-event-num');
            if (numSpan) numSpan.textContent = idx + 1;
            const titleSpan = form.querySelector('.timeline-card-form-header span:nth-child(2)');
            if (titleSpan) titleSpan.textContent = `Carte ${idx + 1}`;
            form.dataset.index = idx;
        });
    },

    updateTimelinePreview() {
        const container = document.getElementById('timelineCardsPreview');
        if (!container) return;

        const forms = document.querySelectorAll('#timelineEvents .timeline-card-form');
        const cartes = [];
        forms.forEach((form, idx) => {
            const titre = form.querySelector('.timeline-titre')?.value?.trim() || '';
            const image_url = form.querySelector('.timeline-image')?.value?.trim() || '';
            if (titre) {
                cartes.push({ num: idx + 1, titre, image_url });
            }
        });

        if (cartes.length === 0) {
            container.innerHTML = '<p class="timeline-empty">Ajoutez des cartes ci-dessous</p>';
            return;
        }

        container.innerHTML = cartes.map((c, i) => {
            const imageUrl = this.normalizeImageUrl(c.image_url);
            const bgStyle = imageUrl ? `background-image: url('${this.escapeHtml(imageUrl)}'); background-size: cover; background-position: center;` : '';
            const hasImage = imageUrl ? 'has-image' : '';
            return `
                <div class="timeline-card ${hasImage}" draggable="true" data-index="${i}" style="${bgStyle}">
                    <span class="timeline-card-num">${c.num}</span>
                    <span class="timeline-card-text">${this.escapeHtml(c.titre)}</span>
                </div>
            `;
        }).join('');

        this.initTimelineDragDrop();
    },

    initTimelineDragDrop() {
        const container = document.getElementById('timelineCardsPreview');
        if (!container) return;

        const cards = container.querySelectorAll('.timeline-card');
        let draggedCard = null;

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedCard = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedCard = null;
                this.syncTimelineFromCards();
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedCard && draggedCard !== card) {
                    const rect = card.getBoundingClientRect();
                    const midX = rect.left + rect.width / 2;
                    if (e.clientX < midX) {
                        card.parentNode.insertBefore(draggedCard, card);
                    } else {
                        card.parentNode.insertBefore(draggedCard, card.nextSibling);
                    }
                }
            });
        });
    },

    syncTimelineFromCards() {
        const previewContainer = document.getElementById('timelineCardsPreview');
        const formsContainer = document.getElementById('timelineEvents');
        if (!previewContainer || !formsContainer) return;

        // Récupérer l'ordre des cartes dans l'aperçu
        const previewCards = previewContainer.querySelectorAll('.timeline-card');
        const newOrder = [];
        previewCards.forEach(card => {
            const idx = parseInt(card.dataset.index);
            newOrder.push(idx);
        });

        // Récupérer les données actuelles des formulaires
        const forms = formsContainer.querySelectorAll('.timeline-card-form');
        const cartesData = [];
        forms.forEach(form => {
            cartesData.push({
                titre: form.querySelector('.timeline-titre')?.value || '',
                image_url: form.querySelector('.timeline-image')?.value || ''
            });
        });

        // Réordonner les données selon le nouvel ordre
        const reorderedData = newOrder.map(i => cartesData[i]);

        // Recréer les formulaires
        formsContainer.innerHTML = reorderedData.map((c, i) => this.renderTimelineCardForm(c, i)).join('');

        // Mettre à jour les numéros sur les cartes preview
        previewCards.forEach((card, i) => {
            card.dataset.index = i;
            const numSpan = card.querySelector('.timeline-card-num');
            if (numSpan) numSpan.textContent = i + 1;
        });
    },

    renderAssocPairRow(p = {}) {
        const e1 = p.element1 || '';
        const e2 = p.element2 || '';
        const t1 = p.element1_type || 'text';
        const t2 = p.element2_type || 'text';
        return `
            <div class="pair-row" style="display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-start;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <select class="form-select assoc-type-left" style="font-size: 0.8em; padding: 4px 6px;" onchange="AdminBanquesExercices.toggleAssocPreview(this)">
                        <option value="text" ${t1 === 'text' ? 'selected' : ''}>Texte</option>
                        <option value="image" ${t1 === 'image' ? 'selected' : ''}>Image</option>
                    </select>
                    <input type="text" class="form-input assoc-left" placeholder="${t1 === 'image' ? 'URL Google Drive partagée' : 'Texte élément 1'}" value="${this.escapeHtml(e1)}">
                    ${t1 === 'image' && e1 ? `<img src="${this.escapeHtml(this.normalizeImageUrl(e1))}" style="max-height: 60px; border-radius: 6px; object-fit: cover;" onerror="this.style.display='none'">` : ''}
                </div>
                <span style="padding: 8px; margin-top: 22px;">↔</span>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                    <select class="form-select assoc-type-right" style="font-size: 0.8em; padding: 4px 6px;" onchange="AdminBanquesExercices.toggleAssocPreview(this)">
                        <option value="text" ${t2 === 'text' ? 'selected' : ''}>Texte</option>
                        <option value="image" ${t2 === 'image' ? 'selected' : ''}>Image</option>
                    </select>
                    <input type="text" class="form-input assoc-right" placeholder="${t2 === 'image' ? 'URL Google Drive partagée' : 'Texte élément 2'}" value="${this.escapeHtml(e2)}">
                    ${t2 === 'image' && e2 ? `<img src="${this.escapeHtml(this.normalizeImageUrl(e2))}" style="max-height: 60px; border-radius: 6px; object-fit: cover;" onerror="this.style.display='none'">` : ''}
                </div>
                <button type="button" class="btn btn-sm" style="margin-top: 22px;" onclick="this.closest('.pair-row').remove()">X</button>
            </div>
        `;
    },

    toggleAssocPreview(selectEl) {
        const row = selectEl.closest('.pair-row');
        if (!row) return;
        // Re-render the row with updated data
        const typeLeft = row.querySelector('.assoc-type-left').value;
        const typeRight = row.querySelector('.assoc-type-right').value;
        const valLeft = row.querySelector('.assoc-left').value;
        const valRight = row.querySelector('.assoc-right').value;
        const newRow = document.createElement('div');
        newRow.innerHTML = this.renderAssocPairRow({
            element1: valLeft, element1_type: typeLeft,
            element2: valRight, element2_type: typeRight
        });
        row.replaceWith(newRow.firstElementChild);
    },

    addAssocPair() {
        const container = document.getElementById('assocPaires');
        if (!container) return;
        const div = document.createElement('div');
        div.innerHTML = this.renderAssocPairRow();
        container.appendChild(div.firstElementChild);
    },

    // ========== FLASHCARD BUILDER ==========
    renderFlashcardForm(carte, index) {
        const c = carte || { recto: '', verso: '' };
        return `
            <div class="flashcard-form-item" style="margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 0.9em;">Carte ${index + 1}</span>
                    <button type="button" class="btn-icon danger" onclick="this.closest('.flashcard-form-item').remove()" title="Supprimer">×</button>
                </div>
                <input type="text" class="form-input flashcard-recto" placeholder="Recto (question / indice)" value="${this.escapeHtml(c.recto || '')}" style="margin-bottom: 6px;">
                <input type="text" class="form-input flashcard-verso" placeholder="Verso (réponse)" value="${this.escapeHtml(c.verso || '')}">
            </div>
        `;
    },

    addFlashcard() {
        const container = document.getElementById('flashcardCartes');
        if (!container) return;
        const count = container.children.length;
        const div = document.createElement('div');
        div.innerHTML = this.renderFlashcardForm({ recto: '', verso: '' }, count);
        container.appendChild(div.firstElementChild);
    },

    // ========== QUESTION OUVERTE BUILDER ==========
    addQuestionOuverteReponse() {
        const container = document.getElementById('questionOuverteReponsesList');
        if (!container) return;
        const count = container.children.length + 1;
        const div = document.createElement('div');
        div.className = 'reponse-row';
        div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
        div.innerHTML = `
            <input type="text" class="form-input question-ouverte-reponse" placeholder="Réponse acceptée ${count}" value="">
            <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" title="Supprimer">×</button>
        `;
        container.appendChild(div);
    },

    // ========== TEXTE A TROUS BUILDER ==========
    texteATrousGaps: [],

    updateTexteATrousPreview() {
        const textarea = document.getElementById('texteATrousInput');
        const preview = document.getElementById('texteATrousPreview');
        if (!textarea || !preview) return;

        const text = textarea.value;
        if (!text.trim()) {
            preview.innerHTML = '<p class="texte-trous-empty">Saisissez du texte ci-dessus pour commencer</p>';
            document.getElementById('texteATrousGapsSection').style.display = 'none';
            return;
        }

        // Séparer le texte en tokens (mots et espaces/ponctuation)
        const tokens = text.split(/(\s+)/);

        // Générer l'aperçu avec des mots cliquables
        preview.innerHTML = tokens.map((token, idx) => {
            // Ne rendre cliquables que les vrais mots (pas espaces/ponctuation seule)
            if (/^\s*$/.test(token)) {
                return token;
            }
            const isGap = this.texteATrousGaps.find(g => g.wordIndex === idx);
            const className = isGap ? 'texte-trou-word selected' : 'texte-trou-word';
            return `<span class="${className}" data-index="${idx}" onclick="AdminBanquesExercices.toggleTexteATrouWord(${idx})">${this.escapeHtml(token)}</span>`;
        }).join('');

        this.updateTexteATrousGapsList();
    },

    toggleTexteATrouWord(wordIndex) {
        const existingIdx = this.texteATrousGaps.findIndex(g => g.wordIndex === wordIndex);

        if (existingIdx >= 0) {
            // Retirer le trou
            this.texteATrousGaps.splice(existingIdx, 1);
        } else {
            // Ajouter un trou
            const textarea = document.getElementById('texteATrousInput');
            const tokens = textarea.value.split(/(\s+)/);
            const word = tokens[wordIndex];
            this.texteATrousGaps.push({
                wordIndex: wordIndex,
                reponse: word,
                alternatives: []
            });
        }

        this.updateTexteATrousPreview();
    },

    updateTexteATrousGapsList() {
        const section = document.getElementById('texteATrousGapsSection');
        const list = document.getElementById('texteATrousGapsList');
        if (!section || !list) return;

        if (this.texteATrousGaps.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        // Trier par ordre d'apparition dans le texte
        const sortedGaps = [...this.texteATrousGaps].sort((a, b) => a.wordIndex - b.wordIndex);

        list.innerHTML = sortedGaps.map((gap, i) => `
            <div class="texte-trou-gap-item" data-word-index="${gap.wordIndex}">
                <div class="gap-header">
                    <span class="gap-num">${i + 1}</span>
                    <span class="gap-word">${this.escapeHtml(gap.reponse)}</span>
                </div>
                <div class="gap-alternatives">
                    <input type="text" class="form-input" placeholder="Réponses alternatives (séparées par des virgules)"
                        value="${(gap.alternatives || []).join(', ')}"
                        onchange="AdminBanquesExercices.updateGapAlternatives(${gap.wordIndex}, this.value)">
                </div>
            </div>
        `).join('');
    },

    updateGapAlternatives(wordIndex, value) {
        const gap = this.texteATrousGaps.find(g => g.wordIndex === wordIndex);
        if (gap) {
            gap.alternatives = value.split(',').map(s => s.trim()).filter(s => s);
        }
    },

    buildTexteATrousData() {
        const textarea = document.getElementById('texteATrousInput');
        if (!textarea) return { texte: '', trous: [] };

        const text = textarea.value;

        // Créer aussi l'ancien format pour rétro-compatibilité
        const tokens = text.split(/(\s+)/);
        let legacyText = '';
        tokens.forEach((token, idx) => {
            const gap = this.texteATrousGaps.find(g => g.wordIndex === idx);
            if (gap) {
                legacyText += `{${token}}`;
            } else {
                legacyText += token;
            }
        });

        return {
            texte: legacyText, // Ancien format pour rétro-compatibilité
            texte_original: text,
            trous: this.texteATrousGaps.map(g => ({
                wordIndex: g.wordIndex,
                reponse: g.reponse,
                alternatives: g.alternatives || []
            }))
        };
    },

    // ========== CARTE BUILDER POUR CONNAISSANCES ==========
    carteBuilderConn: {
        imageUrl: '',
        marqueurs: []
    },

    initCarteBuilderConn(data = {}) {
        this.carteBuilderConn = {
            imageUrl: data.image_url || '',
            marqueurs: (data.marqueurs || []).map(m => ({
                x: m.x,
                y: m.y,
                reponse: m.reponse || '',
                reponses_acceptees: m.reponses_acceptees || []
            }))
        };
        if (this.carteBuilderConn.imageUrl) {
            this.updateCartePreviewConn(this.carteBuilderConn.imageUrl);
        }
        this.renderMarqueursListConn();
    },

    updateCartePreviewConn(url) {
        url = this.convertToDirectImageUrl(url);
        this.carteBuilderConn.imageUrl = url;

        const wrapper = document.getElementById('cartePreviewWrapperConn');
        const placeholder = document.getElementById('cartePreviewPlaceholderConn');
        const img = document.getElementById('cartePreviewImageConn');

        if (!wrapper || !placeholder || !img) return;

        if (url) {
            img.src = url;
            img.onload = () => {
                wrapper.style.display = 'block';
                placeholder.style.display = 'none';
                this.renderCarteMarkersConn();
            };
            img.onerror = () => {
                wrapper.style.display = 'none';
                placeholder.style.display = 'block';
                placeholder.textContent = 'Erreur de chargement de l\'image';
            };
        } else {
            wrapper.style.display = 'none';
            placeholder.style.display = 'block';
            placeholder.textContent = 'Entrez une URL d\'image ci-dessus';
        }
    },

    onCarteClickConn(event) {
        const img = event.target;
        const rect = img.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;

        this.carteBuilderConn.marqueurs.push({
            x: parseFloat(x.toFixed(2)),
            y: parseFloat(y.toFixed(2)),
            reponse: '',
            reponses_acceptees: []
        });

        this.renderCarteMarkersConn();
        this.renderMarqueursListConn();
    },

    renderCarteMarkersConn() {
        const container = document.getElementById('cartePreviewMarkersConn');
        if (!container) return;

        container.innerHTML = this.carteBuilderConn.marqueurs.map((m, i) => `
            <div style="position: absolute; left: ${m.x}%; top: ${m.y}%; transform: translate(-50%, -50%);
                        width: 28px; height: 28px; background: var(--primary); border: 3px solid white;
                        border-radius: 50%; display: flex; align-items: center; justify-content: center;
                        font-size: 0.75rem; font-weight: 700; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        pointer-events: auto; cursor: pointer;"
                 title="Marqueur ${i + 1}: ${this.escapeHtml(m.reponse)}">
                ${i + 1}
            </div>
        `).join('');
    },

    addCarteMarqueurConn() {
        this.carteBuilderConn.marqueurs.push({
            x: 50,
            y: 50,
            reponse: '',
            reponses_acceptees: []
        });
        this.renderCarteMarkersConn();
        this.renderMarqueursListConn();
    },

    removeCarteMarqueurConn(index) {
        this.carteBuilderConn.marqueurs.splice(index, 1);
        this.renderCarteMarkersConn();
        this.renderMarqueursListConn();
    },

    renderMarqueursListConn() {
        const container = document.getElementById('carteMarqueursListConn');
        if (!container) return;

        if (this.carteBuilderConn.marqueurs.length === 0) {
            container.innerHTML = '<p style="color: var(--gray-400); text-align: center; padding: 1rem;">Aucun marqueur. Cliquez sur l\'image ou ajoutez manuellement.</p>';
            return;
        }

        container.innerHTML = this.carteBuilderConn.marqueurs.map((m, i) => `
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border: 1px solid var(--gray-200); border-radius: 6px; margin-bottom: 0.5rem;">
                <span style="width: 24px; height: 24px; background: var(--primary); color: white; border-radius: 50%;
                             display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${i + 1}</span>
                <span style="font-size: 0.75rem; color: var(--gray-500); min-width: 90px;">X: ${m.x}% Y: ${m.y}%</span>
                <input type="text" class="form-input" placeholder="Réponse principale"
                       value="${this.escapeHtml(m.reponse)}" onchange="AdminBanquesExercices.updateMarqueurReponseConn(${i}, this.value)" style="flex: 2;">
                <input type="text" class="form-input" placeholder="Alternatives (virgule)"
                       value="${this.escapeHtml((m.reponses_acceptees || []).join(', '))}"
                       onchange="AdminBanquesExercices.updateMarqueurAlternativesConn(${i}, this.value)" style="flex: 2; font-size: 0.85rem;">
                <button type="button" class="btn btn-sm" onclick="AdminBanquesExercices.removeCarteMarqueurConn(${i})" style="color: #dc2626;">X</button>
            </div>
        `).join('');
    },

    updateMarqueurReponseConn(index, value) {
        if (this.carteBuilderConn.marqueurs[index]) {
            this.carteBuilderConn.marqueurs[index].reponse = value;
        }
    },

    updateMarqueurAlternativesConn(index, value) {
        if (this.carteBuilderConn.marqueurs[index]) {
            this.carteBuilderConn.marqueurs[index].reponses_acceptees = value.split(',').map(s => s.trim()).filter(s => s);
        }
    },

    buildCarteDataConn() {
        return {
            consigne: document.getElementById('carteConsigneConn')?.value || 'Localisez les éléments sur la carte',
            image_url: this.carteBuilderConn.imageUrl,
            marqueurs: this.carteBuilderConn.marqueurs.map((m, i) => ({
                id: i + 1,
                x: m.x,
                y: m.y,
                reponse: m.reponse,
                reponses_acceptees: m.reponses_acceptees
            }))
        };
    },

    async saveQuestionConnaissances() {
        let type = document.getElementById('questionType').value;
        let donnees = {};

        switch (type) {
            case 'qcm':
                // Récupérer les options, bonnes réponses et feedbacks depuis les lignes
                const optionRows = document.querySelectorAll('#qcmOptionsList .qcm-option-row');
                const options = [];
                const reponsesCorrectes = [];
                const feedbacksOptions = [];
                optionRows.forEach((row, idx) => {
                    const text = row.querySelector('.qcm-option-text')?.value?.trim();
                    if (text) {
                        options.push(text);
                        feedbacksOptions.push(row.querySelector('.qcm-option-feedback')?.value?.trim() || '');
                        if (row.querySelector('.qcm-correct-checkbox')?.checked) {
                            reponsesCorrectes.push(options.length - 1);
                        }
                    }
                });
                donnees = {
                    question: document.getElementById('qcmQuestion').value,
                    options: options,
                    reponses_correctes: reponsesCorrectes,
                    reponse_correcte: reponsesCorrectes[0] || 0,
                    feedbacks_options: feedbacksOptions
                };
                break;

            case 'vrai_faux':
                donnees = {
                    question: document.getElementById('vfQuestion').value,
                    reponse: document.getElementById('vfReponse').value
                };
                // Ajouter feedbacks si activés
                if (document.getElementById('vfShowFeedback')?.checked) {
                    const feedbackVrai = document.getElementById('vfFeedbackVrai')?.value?.trim();
                    const feedbackFaux = document.getElementById('vfFeedbackFaux')?.value?.trim();
                    if (feedbackVrai) donnees.feedback_vrai = feedbackVrai;
                    if (feedbackFaux) donnees.feedback_faux = feedbackFaux;
                }
                break;

            case 'chronologie': // rétro-compatibilité
            case 'timeline': {
                const timelineMode = document.querySelector('input[name="timelineMode"]:checked')?.value || 'cartes';
                if (timelineMode === 'texte') {
                    // Mode texte (ex-chronologie)
                    donnees = {
                        consigne: document.getElementById('chronoConsigne').value,
                        mode: this.chronoMode || 'date',
                        comparaison_stricte: document.querySelector('input[name="timelineCompMode"][value="stricte"]')?.checked || false,
                        paires: Array.from(document.querySelectorAll('#chronoPaires .chrono-event-block')).map(block => {
                            const altInputs = block.querySelectorAll('.chrono-alt-input');
                            const reponses_acceptees = Array.from(altInputs)
                                .map(input => input.value.trim())
                                .filter(v => v !== '');
                            return {
                                date: block.querySelector('.chrono-date').value,
                                evenement: block.querySelector('.chrono-event').value,
                                reponses_acceptees: reponses_acceptees
                            };
                        }).filter(p => p.date && p.evenement)
                    };
                } else {
                    // Mode cartes
                    const timelineCartes = Array.from(document.querySelectorAll('#timelineEvents .timeline-card-form')).map(form => ({
                        titre: form.querySelector('.timeline-titre')?.value || '',
                        image_url: form.querySelector('.timeline-image')?.value || ''
                    })).filter(c => c.titre);
                    donnees = {
                        consigne: document.getElementById('timelineConsigne').value,
                        cartes: timelineCartes,
                        evenements: timelineCartes.map(c => c.titre)
                    };
                }
                // Forcer le type à 'timeline' pour uniformiser
                type = 'timeline';
                break;
            }

            case 'association':
                donnees = {
                    consigne: document.getElementById('assocConsigne').value,
                    paires: Array.from(document.querySelectorAll('#assocPaires .pair-row')).map(row => ({
                        element1: row.querySelector('.assoc-left').value,
                        element1_type: row.querySelector('.assoc-type-left')?.value || 'text',
                        element2: row.querySelector('.assoc-right').value,
                        element2_type: row.querySelector('.assoc-type-right')?.value || 'text'
                    })).filter(p => p.element1 && p.element2)
                };
                break;

            case 'texte_trou':
                donnees = this.buildTexteATrousData();
                donnees.comparaison_stricte = document.querySelector('input[name="texteATrousMode"][value="stricte"]')?.checked || false;
                break;

            case 'carte':
                donnees = this.buildCarteDataConn();
                donnees.comparaison_stricte = document.querySelector('input[name="carteCompMode"][value="stricte"]')?.checked || false;
                break;

            case 'question_ouverte':
                // Récupérer les réponses acceptées
                const reponseInputs = document.querySelectorAll('#questionOuverteReponsesList .question-ouverte-reponse');
                const reponsesAcceptees = Array.from(reponseInputs)
                    .map(input => input.value.trim())
                    .filter(val => val.length > 0);

                donnees = {
                    question: document.getElementById('questionOuverteEnonce')?.value || '',
                    reponses_acceptees: reponsesAcceptees,
                    comparaison_stricte: document.querySelector('input[name="questionOuverteMode"][value="stricte"]')?.checked || false
                };
                break;

            case 'flashcard':
                donnees = {
                    consigne: document.getElementById('flashcardConsigne')?.value || '',
                    cartes: Array.from(document.querySelectorAll('#flashcardCartes .flashcard-form-item')).map(item => ({
                        recto: item.querySelector('.flashcard-recto')?.value?.trim() || '',
                        verso: item.querySelector('.flashcard-verso')?.value?.trim() || ''
                    })).filter(c => c.recto && c.verso)
                };
                break;
        }

        const titreProf = document.getElementById('questionTitreProf')?.value?.trim() || '';

        try {
            let result;
            if (this.currentQuestionId) {
                result = await this.callAPI('updateQuestionConnaissances', {
                    id: this.currentQuestionId,
                    type: type,
                    titre_prof: titreProf,
                    donnees: JSON.stringify(donnees)
                });
            } else {
                result = await this.callAPI('createQuestionConnaissances', {
                    banque_id: this.currentQuestionBanqueId,
                    type: type,
                    titre_prof: titreProf,
                    donnees: JSON.stringify(donnees)
                });
            }

            if (result.success) {
                this.closeQuestionModal();
                await this.loadDataFromAPI();
                this.renderBanques();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (e) {
            alert('Erreur lors de la sauvegarde');
        }
    },

    // ========== ENTRAINEMENTS COMPETENCES ==========
    renderTachesComplexes(container, emptyState) {
        // Afficher les banques de compétences (nouveau système)
        let banques = [...this.banquesCompetences].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        if (this.filters.search) {
            const search = this.filters.search;
            banques = banques.filter(b => {
                // Chercher dans le titre de la banque
                if ((b.titre || '').toLowerCase().includes(search)) return true;
                if ((b.description || '').toLowerCase().includes(search)) return true;
                // Chercher dans le nom de la compétence liée
                const comp = this.competencesReferentiel.find(c => c.id === b.competence_id);
                if (comp && (comp.nom || '').toLowerCase().includes(search)) return true;
                // Chercher dans les entraînements de cette banque
                return this.tachesComplexes.some(t =>
                    t.banque_id === b.id &&
                    ((t.titre || '').toLowerCase().includes(search) ||
                     (t.description || '').toLowerCase().includes(search))
                );
            });
        }

        if (this.filters.statut) {
            banques = banques.filter(b => b.statut === this.filters.statut);
        }

        if (banques.length === 0 && this.competencesReferentiel.length === 0) {
            emptyState.style.display = 'none';
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">&#128995;</div>
                    <h3>Aucune competence dans le referentiel</h3>
                    <p>Ajoutez des competences dans la page <strong>Referentiel des competences</strong> pour pouvoir creer des banques ici.</p>
                    <a href="competences.html" class="btn btn-primary" style="text-decoration: none;">Aller au referentiel</a>
                </div>
            `;
            return;
        }

        if (banques.length === 0) {
            emptyState.style.display = 'none';
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">&#128995;</div>
                    <h3>Aucune banque de competences</h3>
                    <p>Creez une banque pour organiser vos entrainements de competences.</p>
                    <button class="btn btn-primary" id="addBanqueBtnEmpty">+ Nouvelle banque</button>
                </div>
            `;
            return;
        }

        emptyState.style.display = 'none';

        container.innerHTML = banques.map(banque => {
            // Résoudre la compétence liée
            const comp = this.competencesReferentiel.find(c => c.id === banque.competence_id);
            const compNom = comp ? comp.nom : '(competence inconnue)';

            // Entraînements dans cette banque (par banque_id ou competence_id en fallback)
            const entrainements = this.tachesComplexes
                .filter(t => t.banque_id === banque.id || (!t.banque_id && t.competence_id === banque.competence_id))
                .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

            return `
                <div class="banque-card" data-banque-comp-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleTache('bc_${banque.id}')">
                        <div class="banque-card-icon competences">&#128995;</div>
                        <div class="banque-card-content">
                            <div class="banque-card-title">
                                ${this.escapeHtml(banque.titre || compNom)}
                            </div>
                            <div class="banque-card-meta">
                                Competence : ${this.escapeHtml(compNom)}
                                ${banque.description ? ' · ' + this.escapeHtml(banque.description) : ''}
                            </div>
                        </div>
                        <div class="banque-card-stats">
                            <div class="banque-stat">
                                <div class="banque-stat-value">${entrainements.length}</div>
                                <div class="banque-stat-label">entr.</div>
                            </div>
                        </div>
                        <span class="status-badge ${banque.statut}">${banque.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                        <div class="banque-card-actions">
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueCompetence('${banque.id}')" title="Modifier la banque">&#9998;</button>
                            <button class="btn-icon add" onclick="event.stopPropagation(); AdminBanquesExercices.addTacheForBanque('${banque.id}')" title="Ajouter un entrainement">+</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueCompetence('${banque.id}')" title="Supprimer la banque">&#128465;</button>
                        </div>
                        <div class="banque-card-toggle">&#9660;</div>
                    </div>
                    <div class="banque-exercices" id="bc_${banque.id}_list">
                        <div class="exercices-header">
                            <h4>Entrainements</h4>
                        </div>
                        ${this._renderCompetenceEntrainements(entrainements)}
                    </div>
                </div>
            `;
        }).join('');
    },

    _renderCompetenceEntrainements(entrainements) {
        if (entrainements.length === 0) {
            return '<div class="exercices-empty">Aucun entrainement dans cette competence</div>';
        }

        return `
            <div class="exercices-list">
                ${entrainements.map(tache => {
                    const dureeMin = Math.round((tache.duree || 1800) / 60);
                    const hasCorrige = this._hasCorrectionCommentee(tache);

                    return `
                        <div class="exercice-item" data-id="${tache.id}">
                            <div class="exercice-numero">${tache.ordre || '?'}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(tache.titre || 'Sans titre')}</div>
                                <div class="exercice-meta">
                                    ${dureeMin} min
                                    ${hasCorrige ? ' · &#9989; corrige' : ' · &#9888; sans corrige'}
                                </div>
                            </div>
                            <span class="status-badge ${tache.statut}">${tache.statut === 'publie' ? 'Publie' : 'Brouillon'}</span>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editTacheComplexe('${tache.id}')" title="Modifier">&#9998;</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteTacheComplexe('${tache.id}')" title="Supprimer">&#128465;</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    _hasCorrectionCommentee(tache) {
        if (!tache.correction_commentee) return false;
        const url = this._extractCorrectionUrl(tache.correction_commentee);
        return url && url.trim().length > 0;
    },

    toggleTache(id) {
        // Accordéon banque de compétence (bc_xxx) ou ancien format compétence/tâche
        if (id.startsWith('bc_')) {
            const banqueId = id.replace('bc_', '');
            const card = document.querySelector(`.banque-card[data-banque-comp-id="${banqueId}"]`);
            if (card) card.classList.toggle('expanded');
        } else if (id.startsWith('comp_')) {
            const compId = id.replace('comp_', '');
            const card = document.querySelector(`.banque-card[data-comp-id="${compId}"]`);
            if (card) card.classList.toggle('expanded');
        } else {
            const card = document.querySelector(`.tache-complexe-card[data-id="${id}"]`);
            if (card) card.classList.toggle('expanded');
        }
    },

    // ========== MODAL BANQUE COMPETENCE ==========
    openBanqueCompetenceModal(banque = null) {
        const modal = document.getElementById('tacheComplexeModal');
        if (!modal) {
            console.error('Modal tacheComplexeModal not found');
            return;
        }

        // Réutiliser la modal existante en mode « banque »
        this._banqueCompMode = true;
        const title = document.getElementById('tacheModalTitle');
        const compSelect = document.getElementById('tacheCompetenceId');

        // Remplir le dropdown des compétences (toutes, pas seulement les visibles)
        this._renderCompetenceSelect();

        // Masquer les champs spécifiques aux entraînements
        this._toggleBanqueFields(true);

        if (banque) {
            title.textContent = 'Modifier la banque de competences';
            document.getElementById('editTacheId').value = banque.id;
            document.getElementById('tacheTitre').value = banque.titre || '';
            document.getElementById('tacheDescription').value = banque.description || '';
            document.getElementById('tacheOrdre').value = banque.ordre || 1;
            document.getElementById('tacheStatut').value = banque.statut || 'brouillon';
            compSelect.value = banque.competence_id || '';
        } else {
            title.textContent = 'Nouvelle banque de competences';
            document.getElementById('editTacheId').value = '';
            document.getElementById('tacheTitre').value = '';
            document.getElementById('tacheDescription').value = '';
            document.getElementById('tacheOrdre').value = this.banquesCompetences.length + 1;
            document.getElementById('tacheStatut').value = 'brouillon';
            compSelect.value = '';
            compSelect.disabled = false;
        }

        modal.classList.remove('hidden');
    },

    editBanqueCompetence(banqueId) {
        const banque = this.banquesCompetences.find(b => b.id === banqueId);
        if (banque) this.openBanqueCompetenceModal(banque);
    },

    async deleteBanqueCompetence(banqueId) {
        const banque = this.banquesCompetences.find(b => b.id === banqueId);
        if (!banque) return;

        const entrCount = this.tachesComplexes.filter(t => t.banque_id === banqueId).length;
        const msg = entrCount > 0
            ? `Etes-vous sur de vouloir supprimer la banque "${banque.titre}" et ses ${entrCount} entrainement(s) ?`
            : `Etes-vous sur de vouloir supprimer la banque "${banque.titre}" ?`;

        document.getElementById('deleteType').value = 'banqueCompetence';
        document.getElementById('deleteId').value = banqueId;
        document.getElementById('deleteMessage').textContent = msg;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    _toggleBanqueFields(isBanque) {
        // Masquer/afficher les champs spécifiques aux entraînements
        const fields = ['tacheDuree'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                const group = el.closest('.form-group');
                if (group) group.style.display = isBanque ? 'none' : '';
            }
        });

        // Masquer/afficher les sections document et corrigé
        const docSection = document.getElementById('documentSection');
        if (docSection) docSection.style.display = isBanque ? 'none' : '';
        const corrSection = document.getElementById('correctionSection');
        if (corrSection) corrSection.style.display = isBanque ? 'none' : '';

        // Masquer/afficher le champ titre (en mode banque, le titre = nom de la compétence)
        const titreInput = document.getElementById('tacheTitre');
        if (titreInput) {
            const titreGroup = titreInput.closest('.form-group');
            if (titreGroup) titreGroup.style.display = isBanque ? 'none' : '';
            if (!isBanque) {
                const label = titreGroup.querySelector('label');
                const help = titreGroup.querySelector('.form-help');
                if (label) label.innerHTML = 'Titre de l\'exercice <span class="req">*</span>';
                titreInput.placeholder = 'Ex: Journal de Catherine Pozzi';
                if (help) help.textContent = 'Titre court identifiant le document utilise';
            }
        }

        // Adapter le label du dropdown compétence/banque
        const compSelect = document.getElementById('tacheCompetenceId');
        if (compSelect) {
            const label = compSelect.closest('.form-group').querySelector('label');
            if (label) label.innerHTML = isBanque
                ? 'Competence <span class="req">*</span>'
                : 'Banque <span class="req">*</span>';
        }
    },

    // ========== MODAL ENTRAINEMENT COMPETENCE ==========
    openTacheComplexeModal(tache = null, lockedBanqueId = null) {
        const modal = document.getElementById('tacheComplexeModal');
        if (!modal) {
            console.error('Modal tacheComplexeModal not found');
            return;
        }

        this._banqueCompMode = false;
        const title = document.getElementById('tacheModalTitle');
        const compSelect = document.getElementById('tacheCompetenceId');

        // Afficher tous les champs d'entraînement
        this._toggleBanqueFields(false);

        // Remplir le dropdown avec les banques de compétences (pas les compétences directement)
        this._renderBanqueCompetenceSelect();

        // Initialiser l'éditeur riche du corrigé
        this._initCorrectionEditor();

        if (tache) {
            title.textContent = 'Modifier l\'entrainement';
            document.getElementById('editTacheId').value = tache.id;
            document.getElementById('tacheTitre').value = tache.titre || '';
            document.getElementById('tacheDescription').value = tache.description || '';
            document.getElementById('tacheDuree').value = Math.round((tache.duree || 1800) / 60);
            document.getElementById('tacheOrdre').value = tache.ordre || 1;
            document.getElementById('tacheStatut').value = tache.statut || 'brouillon';

            // Sélectionner et verrouiller la banque
            compSelect.value = tache.banque_id || '';
            compSelect.disabled = true;

            // Document : initialiser le block editor avec les blocs existants
            const blocks = this.convertLegacyToBlocks(tache);
            this.initBlockEditor(blocks);

            // Corrigé : charger URL ou contenu riche
            if (tache.correction_contenu) {
                this.toggleSourceMode('correction', 'html');
                document.getElementById('correctionEditor').innerHTML = tache.correction_contenu;
                document.getElementById('tacheCorrectionUrl').value = '';
            } else {
                this.toggleSourceMode('correction', 'url');
                const corrUrl = this._extractCorrectionUrl(tache.correction_commentee);
                document.getElementById('tacheCorrectionUrl').value = corrUrl;
                document.getElementById('correctionEditor').innerHTML = '';
            }
        } else {
            title.textContent = 'Nouvel entrainement de competence';
            document.getElementById('editTacheId').value = '';
            document.getElementById('tacheTitre').value = '';
            document.getElementById('tacheDescription').value = '';
            document.getElementById('tacheDuree').value = 30;
            document.getElementById('tacheStatut').value = 'brouillon';
            document.getElementById('tacheCorrectionUrl').value = '';
            document.getElementById('correctionEditor').innerHTML = '';

            // Réinitialiser le toggle corrigé en mode lien
            this.toggleSourceMode('correction', 'url');

            // Initialiser le block editor vide
            this.initBlockEditor(null);

            if (lockedBanqueId) {
                // Ajout depuis le "+" d'une banque → verrouiller
                compSelect.value = lockedBanqueId;
                compSelect.disabled = true;
                // Calculer l'ordre : nb d'entraînements existants dans cette banque + 1
                const existing = this.tachesComplexes.filter(t => t.banque_id === lockedBanqueId);
                document.getElementById('tacheOrdre').value = existing.length + 1;
            } else {
                compSelect.value = '';
                compSelect.disabled = false;
                document.getElementById('tacheOrdre').value = this.tachesComplexes.length + 1;
            }
        }

        modal.classList.remove('hidden');
    },

    closeTacheComplexeModal() {
        const modal = document.getElementById('tacheComplexeModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        // Réactiver le select (pouvait être verrouillé)
        const compSelect = document.getElementById('tacheCompetenceId');
        if (compSelect) compSelect.disabled = false;
        this._banqueCompMode = false;
        // Nettoyer le block editor
        this._blocks = [];
        const blockContainer = document.getElementById('blockEditorContainer');
        if (blockContainer) blockContainer.innerHTML = '';
        // Nettoyer l'éditeur corrigé
        const corrEditor = document.getElementById('correctionEditor');
        if (corrEditor) corrEditor.innerHTML = '';
    },

    // ========== TOGGLE LIEN / TEXTE RICHE ==========

    toggleSourceMode(section, mode) {
        const toggle = document.getElementById(section + 'Toggle');
        if (!toggle) return;

        // Mettre à jour les boutons
        toggle.querySelectorAll('.source-toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Afficher le bon panneau
        const urlPanel = document.getElementById(section + 'UrlPanel');
        const htmlPanel = document.getElementById(section + 'HtmlPanel');
        if (urlPanel) urlPanel.classList.toggle('hidden', mode !== 'url');
        if (htmlPanel) htmlPanel.classList.toggle('hidden', mode !== 'html');
    },

    _getActiveSourceMode(section) {
        const toggle = document.getElementById(section + 'Toggle');
        if (!toggle) return 'url';
        const activeBtn = toggle.querySelector('.source-toggle-btn.active');
        return activeBtn ? activeBtn.dataset.mode : 'url';
    },

    _getEditorContent(editorId) {
        const editor = document.getElementById(editorId);
        if (!editor) return '';
        const html = editor.innerHTML.trim();
        // Retourner vide si l'éditeur est vide (juste des <br> ou espaces)
        if (!html || html === '<br>' || html === '<div><br></div>') return '';
        return html;
    },

    // ========== ÉDITEUR RICHE — GÉNÉRATEUR ==========

    /**
     * Crée un éditeur riche complet (toolbar + zone d'édition) dans un container.
     * @param {string} containerId - ID du div container (ex: 'documentEditorContainer')
     * @param {string} editorId - ID à donner à la zone d'édition (ex: 'documentEditor')
     * @param {Object} options
     * @param {string} options.placeholder - Texte placeholder
     * @param {boolean} options.media - Afficher les boutons image/vidéo (défaut: true)
     * @param {boolean} options.headings - Afficher les boutons de titre H2/H3 (défaut: false)
     */
    createRichTextEditor(containerId, editorId, options) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const opts = Object.assign({ placeholder: '', media: true, headings: false }, options);
        const colorId = editorId + 'Color';

        // — Générer le HTML de la toolbar —
        var toolbarHtml = '<div class="rt-toolbar">';

        // Groupe : formatage texte
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="bold" title="Gras"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="italic" title="Italique"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="underline" title="Souligné"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg></button>';
        toolbarHtml += '</div>';

        // Groupe : titres (optionnel)
        if (opts.headings) {
            toolbarHtml += '<div class="rt-group">';
            toolbarHtml += '<button type="button" class="rt-btn" data-heading="h2" title="Titre">H2</button>';
            toolbarHtml += '<button type="button" class="rt-btn" data-heading="h3" title="Sous-titre">H3</button>';
            toolbarHtml += '<button type="button" class="rt-btn" data-heading="p" title="Paragraphe">P</button>';
            toolbarHtml += '</div>';
        }

        // Groupe : listes
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertUnorderedList" title="Liste à puces"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg></button>';
        toolbarHtml += '<button type="button" class="rt-btn" data-cmd="insertOrderedList" title="Liste numérotée"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="2" y="8" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">1</text><text x="2" y="14" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">2</text><text x="2" y="20" font-size="8" fill="currentColor" stroke="none" font-family="sans-serif">3</text></svg></button>';
        toolbarHtml += '</div>';

        // Groupe : couleur
        toolbarHtml += '<div class="rt-group">';
        toolbarHtml += '<input type="color" class="rt-color" id="' + colorId + '" value="#000000" title="Couleur du texte">';
        toolbarHtml += '</div>';

        // Groupe : médias (optionnel)
        if (opts.media) {
            toolbarHtml += '<div class="rt-group rt-group-media">';
            toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="image" title="Insérer une image"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</button>';
            toolbarHtml += '<button type="button" class="rt-btn rt-btn-label" data-media="video" title="Insérer une vidéo"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg> Vidéo</button>';
            toolbarHtml += '</div>';
        }

        toolbarHtml += '</div>';

        // — Zone d'édition —
        var editorHtml = '<div class="rt-editor" id="' + editorId + '" contenteditable="true"'
            + (opts.placeholder ? ' data-placeholder="' + opts.placeholder + '"' : '')
            + '></div>';

        container.innerHTML = toolbarHtml + editorHtml;

        // — Attacher les handlers —
        var toolbar = container.querySelector('.rt-toolbar');
        var editor = document.getElementById(editorId);

        // Boutons execCommand (bold, italic, underline, listes)
        toolbar.querySelectorAll('.rt-btn[data-cmd]').forEach(function(btn) {
            btn.onmousedown = function(e) { e.preventDefault(); };
            btn.onclick = function() {
                editor.focus();
                document.execCommand(btn.dataset.cmd, false, null);
            };
        });

        // Boutons titres (h2, h3, p)
        toolbar.querySelectorAll('.rt-btn[data-heading]').forEach(function(btn) {
            btn.onmousedown = function(e) { e.preventDefault(); };
            btn.onclick = function() {
                editor.focus();
                document.execCommand('formatBlock', false, btn.dataset.heading);
            };
        });

        // Boutons médias (image, vidéo)
        var self = this;
        toolbar.querySelectorAll('.rt-btn[data-media]').forEach(function(btn) {
            btn.onmousedown = function(e) { e.preventDefault(); };
            btn.onclick = function() {
                self._insertMedia(editor, btn.dataset.media);
            };
        });

        // Couleur du texte
        var colorInput = document.getElementById(colorId);
        if (colorInput) {
            colorInput.oninput = function() {
                editor.focus();
                document.execCommand('foreColor', false, colorInput.value);
            };
        }
    },

    _initCorrectionEditor() {
        this.createRichTextEditor('correctionEditorContainer', 'correctionEditor', {
            placeholder: 'Saisissez le contenu du corrigé...',
            media: true
        });
    },

    // ========== INSERTION MÉDIA ==========

    _insertMedia(editor, type) {
        if (!editor) return;

        var hint = type === 'image'
            ? 'Collez le lien de l\'image :\n(Google Drive, lien direct...)'
            : 'Collez le lien de la vidéo :\n(YouTube, Google Drive...)';
        var url = prompt(hint, '');
        if (!url || !url.trim()) return;

        var src = url.trim();
        var html = '';

        if (type === 'image') {
            var imgSrc = this._convertToDirectImageUrl(src);
            html = '<div class="rt-media-wrapper"><img src="' + imgSrc + '" alt="Image"></div>';
        } else {
            var embedSrc = this._convertToEmbedVideoUrl(src);
            if (embedSrc) {
                html = '<div class="rt-media-wrapper"><iframe src="' + embedSrc + '" width="100%" height="315" frameborder="0" allowfullscreen></iframe></div>';
            } else {
                html = '<div class="rt-media-wrapper"><a href="' + src + '" target="_blank">' + src + '</a></div>';
            }
        }

        editor.focus();
        document.execCommand('insertHTML', false, html + '<p><br></p>');
    },

    _convertToDirectImageUrl(url) {
        var driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) return 'https://lh3.googleusercontent.com/d/' + driveMatch[1];
        var driveIdMatch = url.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveIdMatch) return 'https://lh3.googleusercontent.com/d/' + driveIdMatch[1];
        return url;
    },

    _convertToEmbedVideoUrl(url) {
        var ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytMatch) return 'https://www.youtube-nocookie.com/embed/' + ytMatch[1];
        var driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) return 'https://drive.google.com/file/d/' + driveMatch[1] + '/preview';
        return null;
    },

    _renderCompetenceSelect() {
        const select = document.getElementById('tacheCompetenceId');
        if (!select) return;

        const allComps = [...this.competencesReferentiel]
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        select.innerHTML = '<option value="">-- Choisir une competence --</option>' +
            allComps.map(comp =>
                `<option value="${comp.id}">${this.escapeHtml(comp.nom)}</option>`
            ).join('');
    },

    _renderBanqueCompetenceSelect() {
        const select = document.getElementById('tacheCompetenceId');
        if (!select) return;

        const banques = [...this.banquesCompetences]
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        select.innerHTML = '<option value="">-- Choisir une banque --</option>' +
            banques.map(b => {
                const comp = this.competencesReferentiel.find(c => c.id === b.competence_id);
                const label = b.titre || (comp ? comp.nom : '(sans titre)');
                return `<option value="${b.id}">${this.escapeHtml(label)}</option>`;
            }).join('');
    },

    // Extraire l'URL du corrigé — rétro-compatible avec l'ancien format JSON
    _extractCorrectionUrl(correction) {
        if (!correction) return '';
        // Nouveau format : c'est juste une URL string
        if (typeof correction === 'string') {
            // Vérifier si c'est du JSON (ancien format)
            if (correction.startsWith('{')) {
                try {
                    const parsed = JSON.parse(correction);
                    return parsed.url || parsed.proposition || '';
                } catch (e) { return correction; }
            }
            return correction;
        }
        // Ancien format objet
        if (typeof correction === 'object') {
            return correction.url || correction.proposition || '';
        }
        return '';
    },

    addTacheComplexe() {
        // Le bouton "+" global en mode compétences ouvre la modal banque
        this.openBanqueCompetenceModal(null);
    },

    addTacheForBanque(banqueId) {
        this.openCompWizard(null, banqueId);
    },

    editTacheComplexe(id) {
        const tache = this.tachesComplexes.find(t => t.id === id);
        if (tache) {
            this.openCompWizard(tache);
        }
    },

    async saveTacheComplexe() {
        // Mode banque : sauvegarder une banque de compétences
        if (this._banqueCompMode) {
            return this._saveBanqueCompetence();
        }

        if (this._savingEntrainement) return;

        // Mode entraînement : sauvegarder un entraînement
        const id = document.getElementById('editTacheId').value;
        const banqueId = document.getElementById('tacheCompetenceId').value;
        const titre = document.getElementById('tacheTitre').value.trim();
        const description = document.getElementById('tacheDescription').value.trim();
        const dureeMinutes = parseInt(document.getElementById('tacheDuree').value) || 30;
        const duree = dureeMinutes * 60;
        const ordre = parseInt(document.getElementById('tacheOrdre').value) || 1;
        const statut = document.getElementById('tacheStatut').value;

        // Document : sérialiser les blocs du block editor
        const documentContenu = this.getBlocksJSON();
        const documentUrl = '';
        const documentLegende = '';

        // Corrigé : URL ou contenu riche selon le mode actif
        const corrMode = this._getActiveSourceMode('correction');
        const correctionUrl = corrMode === 'url' ? document.getElementById('tacheCorrectionUrl').value.trim() : '';
        const correctionContenu = corrMode === 'html' ? this._getEditorContent('correctionEditor') : '';

        if (!titre) {
            alert('Le titre est requis');
            return;
        }
        if (!banqueId) {
            alert('Veuillez selectionner une banque');
            return;
        }

        this._savingEntrainement = true;
        const saveBtn = document.querySelector('#tacheComplexeModal .btn-primary');
        const saveBtnText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...'; }

        // Résoudre la compétence depuis la banque
        const banque = this.banquesCompetences.find(b => b.id === banqueId);
        const competenceId = banque ? banque.competence_id : '';

        const data = {
            titre,
            banque_id: banqueId,
            competence_id: competenceId,
            description,
            document_url: documentUrl,
            document_contenu: documentContenu,
            document_legende: documentLegende,
            correction_commentee: correctionUrl,
            correction_contenu: correctionContenu,
            duree,
            ordre,
            statut
        };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateTacheComplexe', data);
            } else {
                result = await this.callAPI('createTacheComplexe', data);
            }

            if (result.success) {
                await this.loadDataFromAPI();
                this.updateCounts();
                this.renderBanques();
                this.closeTacheComplexeModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde entrainement:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            this._savingEntrainement = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtnText; }
        }
    },

    async _saveBanqueCompetence() {
        if (this._savingBanqueComp) return;

        const id = document.getElementById('editTacheId').value;
        const competenceId = document.getElementById('tacheCompetenceId').value;
        const titre = document.getElementById('tacheTitre').value.trim();
        const description = document.getElementById('tacheDescription').value.trim();
        const ordre = parseInt(document.getElementById('tacheOrdre').value) || 1;
        const statut = document.getElementById('tacheStatut').value;

        if (!competenceId) {
            alert('Veuillez selectionner une competence');
            return;
        }

        // Si pas de titre, utiliser le nom de la compétence
        const comp = this.competencesReferentiel.find(c => c.id === competenceId);
        const finalTitre = titre || (comp ? comp.nom : '');

        const data = {
            competence_id: competenceId,
            titre: finalTitre,
            description,
            ordre,
            statut
        };

        this._savingBanqueComp = true;
        const saveBtn = document.querySelector('#tacheComplexeModal .btn-primary');
        const saveBtnText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...'; }

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateBanqueCompetence', data);
            } else {
                result = await this.callAPI('createBanqueCompetence', data);
            }

            if (result.success) {
                await this.loadDataFromAPI();
                this.updateCounts();
                this.renderBanques();
                this.closeTacheComplexeModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde banque competence:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            this._savingBanqueComp = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtnText; }
        }
    },

    deleteTacheComplexe(id) {
        const tache = this.tachesComplexes.find(t => t.id === id);
        if (!tache) return;

        document.getElementById('deleteType').value = 'tacheComplexe';
        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Etes-vous sur de vouloir supprimer l'entrainement "${tache.titre}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },
});
