Object.assign(AdminBanquesExercices, {
    // ========== NOUVEAU SYSTÈME CONNAISSANCES ==========

    // Noms des formats de questions
    questionTypeNames: {
        'qcm': 'QCM',
        'vrai_faux': 'Vrai/Faux',
        'chronologie': 'Frise à compléter',
        'timeline': 'Cartes à ordonner',
        'association': 'Association',
        'texte_trou': 'Texte à trous',
        'ordre': 'Mise en ordre',
        'flashcard': 'Flashcards',
        'carte': 'Image cliquable',
        'question_ouverte': 'Question ouverte'
    },

    /**
     * Vue principale de l'onglet Connaissances
     * Affiche un toggle pour switcher entre Entraînements et Banques de questions
     */
    renderConnaissancesView(container, emptyState) {
        emptyState.style.display = 'none';

        // Sous-vue par défaut : entrainements
        if (!this.connaissancesSubView) {
            this.connaissancesSubView = 'entrainements';
        }

        const entrainementsCount = this.banquesExercicesConn.length;
        const questionsCount = this.banquesQuestions.length;

        container.innerHTML = `
            <div class="conn-toggle-container">
                <div class="conn-toggle">
                    <button class="conn-toggle-btn ${this.connaissancesSubView === 'entrainements' ? 'active' : ''}"
                            onclick="AdminBanquesExercices.switchConnaissancesView('entrainements')">
                        Banques d'exercices
                        <span class="conn-toggle-count">${entrainementsCount}</span>
                    </button>
                    <button class="conn-toggle-btn ${this.connaissancesSubView === 'questions' ? 'active' : ''}"
                            onclick="AdminBanquesExercices.switchConnaissancesView('questions')">
                        Banques de questions
                        <span class="conn-toggle-count">${questionsCount}</span>
                    </button>
                </div>
            </div>

            <div class="banques-list" id="connaissancesContent">
                ${this.connaissancesSubView === 'entrainements' ?
                    this.renderEntrainementsAccordions() :
                    this.renderBanquesQuestionsAccordions()}
            </div>
        `;

        // Initialiser le drag & drop après le rendu
        if (this.connaissancesSubView === 'entrainements') {
            setTimeout(() => this.initEntrainementsDragDrop(), 0);
        }
        if (this.connaissancesSubView === 'questions') {
            setTimeout(() => this.initBanquesQuestionsDragDrop(), 0);
        }
    },

    /**
     * Switch entre les sous-vues de Connaissances
     */
    switchConnaissancesView(subView) {
        this.connaissancesSubView = subView;
        this.renderBanques();
    },

    /**
     * Accordéons des banques d'exercices (Entraînements)
     */
    renderEntrainementsAccordions() {
        if (this.banquesExercicesConn.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📚</div>
                    <h3>Aucune banque d'exercices</h3>
                    <p>Créez votre première banque pour organiser vos entraînements</p>
                    <button class="btn btn-primary" onclick="AdminBanquesExercices.addBanqueExercicesConn()">
                        + Nouvelle banque d'exercices
                    </button>
                </div>
            `;
        }

        const sorted = [...this.banquesExercicesConn].sort((a, b) => {
            const oA = parseInt(a.ordre) || 9999;
            const oB = parseInt(b.ordre) || 9999;
            if (oA !== oB) return oA - oB;
            return (a.date_creation || '').localeCompare(b.date_creation || '');
        });

        return sorted.map(banque => {
            const entrainements = this.entrainementsConn.filter(e => e.banque_exercice_id === banque.id);
            const publies = entrainements.filter(e => e.statut === 'publie').length;

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <span class="drag-handle" title="Glisser pour réordonner">⋮⋮</span>
                        <div class="banque-card-icon connaissances">📚</div>
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
                                <div class="banque-stat-value">${entrainements.length}</div>
                                <div class="banque-stat-label">entraînement${entrainements.length > 1 ? 's' : ''}</div>
                            </div>
                            <div class="banque-stat">
                                <div class="banque-stat-value">${publies}</div>
                                <div class="banque-stat-label">publié${publies > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon success" onclick="event.stopPropagation(); AdminBanquesExercices.addEntrainementConn('${banque.id}')" title="Ajouter un entraînement">➕</button>
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueExercicesConn('${banque.id}')" title="Modifier la banque">✏️</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueExercicesConn('${banque.id}')" title="Supprimer">🗑️</button>
                        </div>
                        <div class="banque-card-toggle">▼</div>
                    </div>
                    <div class="banque-exercices">
                        ${this.renderEntrainementsList(entrainements, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Liste des entraînements dans une banque (style Savoir-faire)
     */
    renderEntrainementsList(entrainements, banqueId) {
        if (entrainements.length === 0) {
            return '<div class="exercices-empty">Aucun entraînement. Cliquez sur ➕ pour en ajouter.</div>';
        }

        const sorted = [...entrainements].sort((a, b) => {
            const oA = parseInt(a.ordre) || 9999;
            const oB = parseInt(b.ordre) || 9999;
            return oA - oB;
        });

        return `
            <div class="exercices-list" data-banque-id="${banqueId}">
                ${sorted.map((entr, index) => {
                    return `
                        <div class="exercice-item" data-id="${entr.id}" onclick="AdminBanquesExercices.openEntrainementWizard(AdminBanquesExercices.entrainementsConn.find(e => e.id === '${entr.id}'), '${banqueId}')" style="cursor:pointer;">
                            <span class="drag-handle drag-handle-sm" title="Glisser pour réordonner">⋮⋮</span>
                            <div class="exercice-numero">${index + 1}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(entr.titre || 'Sans titre')}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editEntrainementConnModal('${entr.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteEntrainementConn('${entr.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    /**
     * Accordéons des banques de questions
     */
    renderBanquesQuestionsAccordions() {
        if (this.banquesQuestions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Aucune banque de questions</h3>
                    <p>Créez votre première banque pour stocker vos questions</p>
                    <button class="btn btn-primary" onclick="AdminBanquesExercices.addBanqueQuestions()">
                        + Nouvelle banque de questions
                    </button>
                </div>
            `;
        }

        // Trier par ordre (les banques sans ordre vont à la fin, triées par date)
        const sorted = [...this.banquesQuestions].sort((a, b) => {
            const oA = parseInt(a.ordre) || 9999;
            const oB = parseInt(b.ordre) || 9999;
            if (oA !== oB) return oA - oB;
            return (a.date_creation || '').localeCompare(b.date_creation || '');
        });

        return sorted.map(banque => {
            const questions = this.questionsConnaissances.filter(q => q.banque_id === banque.id);
            const typesCounts = {};
            questions.forEach(q => {
                typesCounts[q.type] = (typesCounts[q.type] || 0) + 1;
            });

            return `
                <div class="banque-card" data-id="${banque.id}">
                    <div class="banque-card-header" onclick="AdminBanquesExercices.toggleBanque('${banque.id}')">
                        <span class="drag-handle" title="Glisser pour réordonner">⋮⋮</span>
                        <div class="banque-card-icon connaissances">📋</div>
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
                                <div class="banque-stat-label">question${questions.length > 1 ? 's' : ''}</div>
                            </div>
                        </div>
                        <div class="banque-card-actions">
                            <button class="btn-icon add" onclick="event.stopPropagation(); AdminBanquesExercices.addQuestionConnaissances('${banque.id}')" title="Ajouter une question">➕</button>
                            <button class="btn-icon" onclick="event.stopPropagation(); AdminBanquesExercices.editBanqueQuestions('${banque.id}')" title="Modifier la banque">✏️</button>
                            <button class="btn-icon danger" onclick="event.stopPropagation(); AdminBanquesExercices.deleteBanqueQuestions('${banque.id}')" title="Supprimer">🗑️</button>
                        </div>
                        <div class="banque-card-toggle">▼</div>
                    </div>
                    <div class="banque-exercices">
                        <div class="exercices-header">
                            <h4>Questions</h4>
                        </div>
                        ${this.renderQuestionsListAccordion(questions, banque.id)}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Liste des questions dans un accordéon
     */
    renderQuestionsListAccordion(questions, banqueId) {
        if (questions.length === 0) {
            return '<div class="exercices-empty">Aucune question. Cliquez sur "+ Ajouter une question" pour commencer.</div>';
        }

        // Trier par ordre (les questions sans ordre gardent leur position d'origine)
        const sorted = [...questions].sort((a, b) => {
            const oA = parseInt(a.ordre) || 9999;
            const oB = parseInt(b.ordre) || 9999;
            return oA - oB;
        });

        return `
            <div class="exercices-list" data-banque-id="${banqueId}">
                ${sorted.map((q) => {
                    const typeName = this.questionTypeNames[q.type] || q.type;
                    const preview = this.getQuestionPreview(q);

                    return `
                        <div class="exercice-item" data-id="${q.id}">
                            <span class="drag-handle drag-handle-sm" title="Glisser pour réordonner">⋮⋮</span>
                            <div class="exercice-numero" style="background:var(--accent-blue-light);color:var(--accent-blue);font-size:11px;">${typeName.substring(0, 3).toUpperCase()}</div>
                            <div class="exercice-info">
                                <div class="exercice-title">${this.escapeHtml(preview)}</div>
                                <div class="exercice-meta">${typeName}</div>
                            </div>
                            <div class="exercice-actions">
                                <button class="btn-icon" onclick="AdminBanquesExercices.editQuestionConnaissances('${q.id}')" title="Modifier">✏️</button>
                                <button class="btn-icon danger" onclick="AdminBanquesExercices.deleteQuestionConnaissances('${q.id}')" title="Supprimer">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ========== DRAG & DROP : BANQUES ET QUESTIONS ==========

    /**
     * Initialise le drag & drop pour les banques de questions ET les questions à l'intérieur
     */
    initBanquesQuestionsDragDrop() {
        const container = document.getElementById('connaissancesContent');
        if (!container) return;

        // Helper : activer le drag seulement depuis la poignée
        const enableDragFromHandle = (draggableEl) => {
            draggableEl.setAttribute('draggable', 'false');
            const handle = draggableEl.querySelector('.drag-handle');
            if (!handle) return;
            handle.addEventListener('mousedown', () => {
                draggableEl.setAttribute('draggable', 'true');
            });
            // Désactiver après le drag (ou si on relâche sans drag)
            draggableEl.addEventListener('dragend', () => {
                draggableEl.setAttribute('draggable', 'false');
            });
            handle.addEventListener('mouseup', () => {
                draggableEl.setAttribute('draggable', 'false');
            });
        };

        // --- Drag & drop des banques ---
        let draggedBanque = null;
        container.querySelectorAll('.banque-card').forEach(card => {
            enableDragFromHandle(card);

            card.addEventListener('dragstart', (e) => {
                draggedBanque = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', 'banque');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                if (draggedBanque) {
                    draggedBanque = null;
                    this.saveBanquesQuestionsOrder();
                }
            });

            card.addEventListener('dragover', (e) => {
                if (!draggedBanque || draggedBanque === card) return;
                e.preventDefault();
                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    card.parentNode.insertBefore(draggedBanque, card);
                } else {
                    card.parentNode.insertBefore(draggedBanque, card.nextSibling);
                }
            });
        });

        // --- Drag & drop des questions (dans chaque banque) ---
        container.querySelectorAll('.exercices-list[data-banque-id]').forEach(list => {
            let draggedQuestion = null;

            list.querySelectorAll('.exercice-item').forEach(item => {
                enableDragFromHandle(item);

                item.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    draggedQuestion = item;
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', 'question');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    if (draggedQuestion) {
                        draggedQuestion = null;
                        // Recalculer les numéros affichés
                        list.querySelectorAll('.exercice-item').forEach((el, idx) => {
                            const numero = el.querySelector('.exercice-numero');
                            if (numero) numero.textContent = idx + 1;
                        });
                        this.saveQuestionsOrder(list);
                    }
                });

                item.addEventListener('dragover', (e) => {
                    if (!draggedQuestion || draggedQuestion === item) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedQuestion, item);
                    } else {
                        item.parentNode.insertBefore(draggedQuestion, item.nextSibling);
                    }
                });
            });
        });
    },

    /**
     * Sauvegarde l'ordre des banques de questions après drag & drop
     */
    async saveBanquesQuestionsOrder() {
        const container = document.getElementById('connaissancesContent');
        if (!container) return;

        const cards = container.querySelectorAll('.banque-card[data-id]');
        const newOrder = [];
        cards.forEach((card, index) => {
            newOrder.push({ id: card.dataset.id, ordre: index + 1 });
        });

        if (newOrder.length === 0) return;

        try {
            await this.callAPI('updateBanquesQuestionsOrdre', {
                banques: JSON.stringify(newOrder)
            });
            // Mettre à jour les données locales
            newOrder.forEach(({ id, ordre }) => {
                const banque = this.banquesQuestions.find(b => b.id === id);
                if (banque) banque.ordre = ordre;
            });
            this.saveToCache();
        } catch (error) {
            console.error('Erreur sauvegarde ordre banques:', error);
        }
    },

    /**
     * Sauvegarde l'ordre des questions dans une banque après drag & drop
     */
    async saveQuestionsOrder(list) {
        const items = list.querySelectorAll('.exercice-item[data-id]');
        const newOrder = [];
        items.forEach((item, index) => {
            newOrder.push({ id: item.dataset.id, ordre: index + 1 });
        });

        if (newOrder.length === 0) return;

        try {
            await this.callAPI('updateQuestionsConnaissancesOrdre', {
                questions: JSON.stringify(newOrder)
            });
            // Mettre à jour les données locales
            newOrder.forEach(({ id, ordre }) => {
                const q = this.questionsConnaissances.find(qc => qc.id === id);
                if (q) q.ordre = ordre;
            });
            this.saveToCache();
        } catch (error) {
            console.error('Erreur sauvegarde ordre questions:', error);
        }
    },

    // ========== DRAG & DROP : BANQUES ET ENTRAÎNEMENTS ==========

    /**
     * Initialise le drag & drop pour les banques d'exercices ET les entraînements à l'intérieur
     */
    initEntrainementsDragDrop() {
        const container = document.getElementById('connaissancesContent');
        if (!container) return;

        // Helper : activer le drag seulement depuis la poignée
        const enableDragFromHandle = (draggableEl) => {
            draggableEl.setAttribute('draggable', 'false');
            const handle = draggableEl.querySelector('.drag-handle');
            if (!handle) return;
            handle.addEventListener('mousedown', () => {
                draggableEl.setAttribute('draggable', 'true');
            });
            draggableEl.addEventListener('dragend', () => {
                draggableEl.setAttribute('draggable', 'false');
            });
            handle.addEventListener('mouseup', () => {
                draggableEl.setAttribute('draggable', 'false');
            });
        };

        // --- Drag & drop des banques ---
        let draggedBanque = null;
        container.querySelectorAll('.banque-card').forEach(card => {
            enableDragFromHandle(card);

            card.addEventListener('dragstart', (e) => {
                draggedBanque = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', 'banque');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                if (draggedBanque) {
                    draggedBanque = null;
                    this.saveBanquesExercicesConnOrder();
                }
            });

            card.addEventListener('dragover', (e) => {
                if (!draggedBanque || draggedBanque === card) return;
                e.preventDefault();
                const rect = card.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    card.parentNode.insertBefore(draggedBanque, card);
                } else {
                    card.parentNode.insertBefore(draggedBanque, card.nextSibling);
                }
            });
        });

        // --- Drag & drop des entraînements (dans chaque banque) ---
        container.querySelectorAll('.exercices-list[data-banque-id]').forEach(list => {
            let draggedEntrainement = null;

            list.querySelectorAll('.exercice-item').forEach(item => {
                enableDragFromHandle(item);

                item.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    draggedEntrainement = item;
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', 'entrainement');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    if (draggedEntrainement) {
                        draggedEntrainement = null;
                        // Recalculer les numéros affichés
                        list.querySelectorAll('.exercice-item').forEach((el, idx) => {
                            const numero = el.querySelector('.exercice-numero');
                            if (numero) numero.textContent = idx + 1;
                        });
                        this.saveEntrainementsConnOrder(list);
                    }
                });

                item.addEventListener('dragover', (e) => {
                    if (!draggedEntrainement || draggedEntrainement === item) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedEntrainement, item);
                    } else {
                        item.parentNode.insertBefore(draggedEntrainement, item.nextSibling);
                    }
                });
            });
        });
    },

    /**
     * Sauvegarde l'ordre des banques d'exercices conn après drag & drop
     */
    async saveBanquesExercicesConnOrder() {
        const container = document.getElementById('connaissancesContent');
        if (!container) return;

        const cards = container.querySelectorAll('.banque-card[data-id]');
        const newOrder = [];
        cards.forEach((card, index) => {
            newOrder.push({ id: card.dataset.id, ordre: index + 1 });
        });

        if (newOrder.length === 0) return;

        try {
            await this.callAPI('updateBanquesExercicesConnOrdre', {
                banques: JSON.stringify(newOrder)
            });
            newOrder.forEach(({ id, ordre }) => {
                const banque = this.banquesExercicesConn.find(b => b.id === id);
                if (banque) banque.ordre = ordre;
            });
            this.saveToCache();
        } catch (error) {
            console.error('Erreur sauvegarde ordre banques exercices conn:', error);
        }
    },

    /**
     * Sauvegarde l'ordre des entraînements dans une banque après drag & drop
     */
    async saveEntrainementsConnOrder(list) {
        const items = list.querySelectorAll('.exercice-item[data-id]');
        const newOrder = [];
        items.forEach((item, index) => {
            newOrder.push({ id: item.dataset.id, ordre: index + 1 });
        });

        if (newOrder.length === 0) return;

        try {
            await this.callAPI('updateEntrainementsConnOrdre', {
                entrainements: JSON.stringify(newOrder)
            });
            newOrder.forEach(({ id, ordre }) => {
                const e = this.entrainementsConn.find(ec => ec.id === id);
                if (e) e.ordre = ordre;
            });
            this.saveToCache();
        } catch (error) {
            console.error('Erreur sauvegarde ordre entrainements:', error);
        }
    },

    /**
     * Ajouter un nouvel entraînement à une banque
     */
    addEntrainementConn(banqueId) {
        this.openEntrainementWizard(null, banqueId);
    },

    /**
     * Modifier un entraînement existant (ouvre le wizard)
     */
    editEntrainementConnModal(entrainementId) {
        const entr = this.entrainementsConn.find(e => e.id === entrainementId);
        if (!entr) return;
        this.openEntrainementWizard(entr, entr.banque_exercice_id);
    },

    // ========== WIZARD ENTRAÎNEMENT 4 ÉTAPES ==========

    wizardData: {
        entrainement: null,
        banqueId: null,
        currentStep: 1,
        etapes: [], // Les étapes ajoutées dans le wizard
        isEditing: false
    },

    /**
     * Ouvre le wizard pour créer/modifier un entraînement
     */
    openEntrainementWizard(entrainement = null, banqueId = null) {
        const etapes = entrainement ? this.etapesConn.filter(e => e.entrainement_id === entrainement.id) : [];

        // Initialiser les sélections de questions depuis les données serveur (dédupliquées)
        const selectedQuestions = {};
        if (entrainement && this.etapeQuestionsConn) {
            etapes.forEach(etape => {
                selectedQuestions[etape.id] = [...new Set(
                    this.etapeQuestionsConn
                        .filter(eq => eq.etape_id === etape.id)
                        .map(eq => eq.question_id)
                )];
            });
        }

        this.wizardData = {
            entrainement: entrainement,
            banqueId: banqueId,
            currentStep: 1,
            etapes: etapes,
            selectedQuestions: selectedQuestions,
            isEditing: !!entrainement
        };

        // Créer le modal wizard
        let modal = document.getElementById('entrainementWizardModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'entrainementWizardModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-wizard">
                <div class="wizard-header">
                    <div class="wizard-title">
                        <h2>${entrainement ? '✏️ Modifier l\'entraînement' : '➕ Nouvel entraînement'}</h2>
                        <span class="wizard-subtitle">Connaissances • ${entrainement ? entrainement.titre : 'Créez une série d\'exercices'}</span>
                    </div>
                    <div class="wizard-steps">
                        <button class="wizard-step active" data-step="1" onclick="AdminBanquesExercices.goToWizardStep(1)">
                            <span class="step-number">1</span>
                            <span class="step-label">Paramètres</span>
                        </button>
                        <button class="wizard-step" data-step="2" onclick="AdminBanquesExercices.goToWizardStep(2)">
                            <span class="step-number">2</span>
                            <span class="step-label">Étapes</span>
                        </button>
                        <button class="wizard-step" data-step="3" onclick="AdminBanquesExercices.goToWizardStep(3)">
                            <span class="step-number">3</span>
                            <span class="step-label">Questions</span>
                        </button>
                        <button class="wizard-step" data-step="4" onclick="AdminBanquesExercices.goToWizardStep(4)">
                            <span class="step-number">4</span>
                            <span class="step-label">Validation</span>
                        </button>
                    </div>
                    <button class="modal-close" onclick="AdminBanquesExercices.closeEntrainementWizard()">&times;</button>
                </div>
                <div class="wizard-body" id="wizardContent">
                    <!-- Contenu dynamique -->
                </div>
                <div class="wizard-footer">
                    <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeEntrainementWizard()">Annuler</button>
                    <div class="wizard-nav">
                        <button class="btn btn-secondary" id="wizardPrevBtn" onclick="AdminBanquesExercices.wizardPrevStep()" style="display:none;">
                            ← Précédent
                        </button>
                        <button class="btn btn-primary" id="wizardNextBtn" onclick="AdminBanquesExercices.wizardNextStep()">
                            Suivant →
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        this.renderWizardStep(1);
    },

    closeEntrainementWizard() {
        const modal = document.getElementById('entrainementWizardModal');
        if (modal) modal.remove();
        this.wizardData = { entrainement: null, banqueId: null, currentStep: 1, etapes: [], isEditing: false };
    },

    goToWizardStep(step) {
        // Validation avant de changer d'étape
        if (step > this.wizardData.currentStep) {
            if (!this.validateWizardStep(this.wizardData.currentStep)) return;
        }
        this.wizardData.currentStep = step;
        this.renderWizardStep(step);
    },

    wizardPrevStep() {
        if (this.wizardData.currentStep > 1) {
            this.wizardData.currentStep--;
            this.renderWizardStep(this.wizardData.currentStep);
        }
    },

    async wizardNextStep() {
        // Éviter les doubles clics
        if (this._navigating) return;
        this._navigating = true;

        const nextBtn = document.getElementById('wizardNextBtn');

        try {
            if (!this.validateWizardStep(this.wizardData.currentStep)) {
                this._navigating = false;
                return;
            }

            if (this.wizardData.currentStep === 1) {
                if (this.wizardData.entrainement) {
                    // Mode édition : sauvegarde optimiste, on navigue immédiatement
                    const formData = {
                        id: this.wizardData.entrainement.id,
                        titre: document.getElementById('wizardTitre').value.trim(),
                        description: document.getElementById('wizardDescription').value.trim(),
                        duree: parseInt(document.getElementById('wizardDuree').value) || 15,
                        seuil: parseInt(document.getElementById('wizardSeuil').value) || 80,
                        statut: document.getElementById('wizardStatut').value,
                        banque_exercice_id: this.wizardData.banqueId
                    };
                    Object.assign(this.wizardData.entrainement, formData);
                    // Sauvegarde en arrière-plan
                    this.callAPI('updateEntrainementConn', formData).catch(err => {
                        console.error('Erreur sauvegarde étape 1:', err);
                        this.showNotification('Les paramètres n\'ont pas pu être sauvegardés. Vérifiez votre connexion.', 'error');
                    });
                } else {
                    // Mode création : on a besoin de l'ID du serveur → indicateur de chargement
                    if (nextBtn) {
                        nextBtn.disabled = true;
                        nextBtn.textContent = 'Création...';
                    }
                    const saved = await this.saveWizardStepData(1);
                    if (!saved) {
                        this._navigating = false;
                        if (nextBtn) {
                            nextBtn.disabled = false;
                            nextBtn.textContent = 'Suivant →';
                        }
                        return;
                    }
                }
            }

            if (this.wizardData.currentStep < 4) {
                this.wizardData.currentStep++;
                this.renderWizardStep(this.wizardData.currentStep);
            } else {
                // Étape finale - Publier
                await this.finalizeEntrainement();
            }
        } finally {
            this._navigating = false;
        }
    },

    validateWizardStep(step) {
        switch(step) {
            case 1:
                const titre = document.getElementById('wizardTitre')?.value.trim();
                if (!titre) {
                    this.showNotification('Le titre est requis', 'warning');
                    return false;
                }

                // Validations pour durée et seuil
                const duree = parseInt(document.getElementById('wizardDuree')?.value) || 15;
                if (duree <= 0 || duree > 999) {
                    this.showNotification('La durée doit être entre 1 et 999 minutes', 'warning');
                    return false;
                }

                const seuil = parseInt(document.getElementById('wizardSeuil')?.value) || 80;
                if (seuil < 0 || seuil > 100) {
                    this.showNotification('Le seuil doit être entre 0 et 100%', 'warning');
                    return false;
                }

                const statut = document.getElementById('wizardStatut')?.value;
                if (!['brouillon', 'publie'].includes(statut)) {
                    this.showNotification('Statut invalide', 'warning');
                    return false;
                }

                return true;
            case 2:
                if (this.wizardData.etapes.length === 0) {
                    this.showNotification('Ajoutez au moins une étape', 'warning');
                    return false;
                }
                return true;
            case 3:
                // Vérifier que chaque étape a des questions configurées
                const etapesProblemes = [];
                for (const etape of this.wizardData.etapes) {
                    const availableQuestions = this.getQuestionsForFormat(etape.format_code);

                    if (etape.mode_selection === 'aleatoire') {
                        // Mode aléatoire: vérifier nb_questions > 0 et <= disponibles
                        const nbQuestions = parseInt(etape.nb_questions) || 0;
                        if (nbQuestions <= 0) {
                            etapesProblemes.push(`Étape "${etape.format_code}": nombre de questions non défini`);
                        } else if (nbQuestions > availableQuestions.length) {
                            etapesProblemes.push(`Étape "${etape.format_code}": ${nbQuestions} demandées mais seulement ${availableQuestions.length} disponibles`);
                        }
                    } else {
                        // Mode manuel: vérifier qu'au moins une question est sélectionnée
                        const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
                        if (selectedIds.length === 0) {
                            etapesProblemes.push(`Étape "${etape.format_code}": aucune question sélectionnée`);
                        }
                    }
                }
                if (etapesProblemes.length > 0) {
                    this.showNotification('Configuration incomplète : ' + etapesProblemes.join(' | '), 'warning');
                    return false;
                }
                return true;
            case 4:
                return true;
            default:
                return true;
        }
    },

    async saveWizardStepData(step) {
        switch(step) {
            case 1:
                // Récupérer les données du formulaire
                const formData = {
                    titre: document.getElementById('wizardTitre').value.trim(),
                    description: document.getElementById('wizardDescription').value.trim(),
                    duree: parseInt(document.getElementById('wizardDuree').value) || 15,
                    seuil: parseInt(document.getElementById('wizardSeuil').value) || 80,
                    statut: document.getElementById('wizardStatut').value,
                    banque_exercice_id: this.wizardData.banqueId
                };

                // Les validations ont déjà été vérifiées par validateWizardStep()
                // On procède directement à la sauvegarde

                if (this.wizardData.entrainement) {
                    // Mise à jour
                    formData.id = this.wizardData.entrainement.id;
                    const result = await this.callAPI('updateEntrainementConn', formData);
                    if (result.success) {
                        Object.assign(this.wizardData.entrainement, formData);
                        return true;
                    }
                    return false;
                } else {
                    // Création
                    const result = await this.callAPI('createEntrainementConn', formData);
                    if (result.success) {
                        // Mise à jour locale au lieu de loadDataFromAPI()
                        const newEntrainement = { ...formData, id: result.id };
                        this.entrainementsConn.push(newEntrainement);
                        this.wizardData.entrainement = newEntrainement;
                        this.wizardData.isEditing = true;
                        this.saveToCache();
                        return true;
                    }
                    return false;
                }
            case 2:
                // Les étapes sont sauvegardées au fur et à mesure
                return true;
            case 3:
                // Les questions sont sauvegardées au fur et à mesure
                return true;
        }
    },

    renderWizardStep(step) {
        const content = document.getElementById('wizardContent');
        const prevBtn = document.getElementById('wizardPrevBtn');
        const nextBtn = document.getElementById('wizardNextBtn');

        // Mettre à jour les indicateurs d'étapes
        document.querySelectorAll('.wizard-step').forEach((el, i) => {
            el.classList.toggle('active', i + 1 === step);
            el.classList.toggle('completed', i + 1 < step);
        });

        // Mettre à jour les boutons de navigation (toujours réactiver, au cas où un step précédent les avait désactivés)
        prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        nextBtn.textContent = step === 4 ? '✓ Valider et fermer' : 'Suivant →';

        switch(step) {
            case 1:
                content.innerHTML = this.renderWizardStep1();
                break;
            case 2:
                content.innerHTML = this.renderWizardStep2();
                this.initWizardStep2();
                break;
            case 3:
                content.innerHTML = this.renderWizardStep3();
                break;
            case 4:
                content.innerHTML = this.renderWizardStep4();
                break;
        }
    },

    // ===== ÉTAPE 1: PARAMÈTRES =====
    renderWizardStep1() {
        const e = this.wizardData.entrainement || {};
        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">⚙️</span>
                    <div>
                        <h3>Paramètres généraux</h3>
                        <p>Définissez les informations de base de l'entraînement</p>
                    </div>
                </div>
                <div class="wizard-form">
                    <div class="form-group">
                        <label>Titre de l'entraînement <span class="req">*</span></label>
                        <input type="text" class="form-input" id="wizardTitre" value="${this.escapeHtml(e.titre || '')}" placeholder="Ex: Les grandes découvertes">
                    </div>
                    <div class="form-group">
                        <label>Description <span class="optional">(optionnel)</span></label>
                        <textarea class="form-textarea" id="wizardDescription" rows="2" placeholder="Description de l'entraînement...">${this.escapeHtml(e.description || '')}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Durée (minutes)</label>
                            <input type="number" class="form-input" id="wizardDuree" value="${e.duree || 15}" min="1" max="999">
                        </div>
                        <div class="form-group">
                            <label>Seuil de réussite (%)</label>
                            <input type="number" class="form-input" id="wizardSeuil" value="${e.seuil || 80}" min="0" max="100">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Statut</label>
                        <select class="form-select" id="wizardStatut">
                            <option value="brouillon" ${e.statut !== 'publie' ? 'selected' : ''}>Brouillon</option>
                            <option value="publie" ${e.statut === 'publie' ? 'selected' : ''}>Publié</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    // ===== ÉTAPE 2: ÉTAPES (FORMATS) =====
    renderWizardStep2() {
        const formats = this.formatsQuestions || [];
        const etapes = this.wizardData.etapes || [];

        return `
            <div class="wizard-step-content wizard-step2">
                <div class="step-header">
                    <span class="step-icon">📝</span>
                    <div>
                        <h3>Étapes de l'entraînement</h3>
                        <p>Ajoutez et ordonnez les types d'exercices</p>
                    </div>
                </div>
                <div class="wizard-two-columns">
                    <div class="wizard-col-left">
                        <div class="etapes-list-header">
                            <h4>Exercices de la série <span class="badge">${etapes.length}</span></h4>
                            <span class="hint">Glissez pour réordonner</span>
                        </div>
                        <div class="etapes-list" id="wizardEtapesList">
                            ${etapes.length === 0 ?
                                '<div class="etapes-empty">Aucune étape. Sélectionnez un format à droite pour ajouter une étape.</div>' :
                                etapes.map((etape, index) => this.renderWizardEtapeItem(etape, index)).join('')
                            }
                        </div>
                    </div>
                    <div class="wizard-col-right">
                        <h4>➕ Ajouter un exercice</h4>
                        <div class="format-section">
                            <label class="section-label">1. CHOISIR LE FORMAT</label>
                            <div class="format-grid">
                                ${formats.map(f => `
                                    <button class="format-card" onclick="AdminBanquesExercices.addWizardEtape('${f.code}')">
                                        <span class="format-icon">${f.icone || '📋'}</span>
                                        <span class="format-name">${this.questionTypeNames[f.code] || f.nom}</span>
                                        <span class="format-count">${this.countQuestionsForFormat(f.code)} disponibles</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderWizardEtapeItem(etape, index) {
        const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
        // Utiliser getSelectedQuestionsForEtape qui filtre les questions existantes
        const selectedQuestions = this.getSelectedQuestionsForEtape(etape.id);
        const questionsCount = selectedQuestions.length;

        return `
            <div class="wizard-etape-item" data-id="${etape.id || 'temp-' + index}" data-index="${index}" draggable="true">
                <div class="etape-drag-handle">☰</div>
                <div class="etape-number">${index + 1}</div>
                <div class="etape-format-icon">${format.icone || '📋'}</div>
                <div class="etape-info">
                    <div class="etape-format-name">${this.questionTypeNames[etape.format_code] || format.nom || etape.format_code}</div>
                    <div class="etape-meta">
                        ${questionsCount} question${questionsCount > 1 ? 's' : ''}
                        <span class="etape-mode ${etape.mode_selection}">${etape.mode_selection === 'aleatoire' ? '🎲 Aléatoire' : '✋ Manuel'}</span>
                    </div>
                </div>
                <div class="etape-actions">
                    <button class="btn-icon danger" onclick="AdminBanquesExercices.removeWizardEtape(${index})" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    initWizardStep2() {
        // Initialiser le drag & drop pour réordonner les étapes
        const list = document.getElementById('wizardEtapesList');
        if (!list) return;

        let draggedItem = null;

        list.querySelectorAll('.wizard-etape-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                // Mettre à jour les numéros visuels immédiatement
                const allItems = list.querySelectorAll('.wizard-etape-item');
                allItems.forEach((el, i) => {
                    const numEl = el.querySelector('.etape-number');
                    if (numEl) numEl.textContent = i + 1;
                });
                // Sauvegarder le nouvel ordre après le drag-and-drop
                this.saveWizardEtapesOrder(list);
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        item.parentNode.insertBefore(draggedItem, item);
                    } else {
                        item.parentNode.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    },

    async saveWizardEtapesOrder(container) {
        // Récupérer le nouvel ordre depuis le DOM
        const items = container.querySelectorAll('.wizard-etape-item');
        const newOrder = [];

        items.forEach((item, index) => {
            const etapeId = item.dataset.id;
            // Ignorer les IDs temporaires
            if (etapeId && !etapeId.startsWith('temp-')) {
                newOrder.push({ id: etapeId, ordre: index + 1 });
            }
        });

        if (newOrder.length === 0) return;

        try {
            // Sauvegarder en parallèle
            const updatePromises = newOrder.map(({ id, ordre }) =>
                this.callAPI('updateEtapeConn', { id, ordre })
            );
            await Promise.all(updatePromises);

            // Mettre à jour les données locales
            newOrder.forEach(({ id, ordre }) => {
                const etape = this.wizardData.etapes.find(e => e.id === id);
                if (etape) etape.ordre = ordre;
                const etapeConn = this.etapesConn.find(e => e.id === id);
                if (etapeConn) etapeConn.ordre = ordre;
            });

            // Réorganiser wizardData.etapes selon le nouvel ordre
            this.wizardData.etapes.sort((a, b) => a.ordre - b.ordre);

            // Ordre sauvegardé
        } catch (error) {
            console.error('Erreur sauvegarde ordre:', error);
        }
    },

    /**
     * Normalise les formats chargés depuis le Google Sheet :
     * - Met à jour les noms/icônes des formats chronologie et timeline
     * - Ajoute flashcard si absent
     */
    normalizeFormatsQuestions() {
        if (!this.formatsQuestions) return;

        // 1. Mettre à jour l'entrée chronologie (frise à compléter)
        const chronoFormat = this.formatsQuestions.find(f => f.code === 'chronologie');
        if (chronoFormat) {
            chronoFormat.nom = 'Frise à compléter';
            chronoFormat.icone = '📝';
            chronoFormat.description = 'L\'élève complète les dates ou événements manquants';
        } else {
            this.formatsQuestions.push({
                id: 'fmt_chronologie',
                code: 'chronologie',
                nom: 'Frise à compléter',
                icone: '📝',
                description: 'L\'élève complète les dates ou événements manquants'
            });
        }

        // 2. Mettre à jour l'entrée timeline (cartes à ordonner)
        const timelineFormat = this.formatsQuestions.find(f => f.code === 'timeline');
        if (timelineFormat) {
            timelineFormat.nom = 'Cartes à ordonner';
            timelineFormat.icone = '🗂️';
            timelineFormat.description = 'L\'élève remet les cartes dans l\'ordre chronologique';
        }

        // 3. Ajouter flashcard si absent
        const hasFlashcard = this.formatsQuestions.some(f => f.code === 'flashcard');
        if (!hasFlashcard) {
            this.formatsQuestions.push({
                id: 'fmt_flashcard',
                code: 'flashcard',
                nom: 'Flashcards',
                icone: '🃏',
                description: 'Cartes recto-verso (auto-évaluation)'
            });
        }

    },

    // Infère le type de question depuis la structure de ses données
    inferQuestionType(donnees) {
        if (!donnees || typeof donnees !== 'object') return '';
        // Flashcard: a des cartes avec recto/verso
        if (donnees.cartes && Array.isArray(donnees.cartes) && donnees.cartes.length > 0 && donnees.cartes[0].recto !== undefined) {
            return 'flashcard';
        }
        // Question ouverte: a reponses_acceptees
        if (donnees.reponses_acceptees) return 'question_ouverte';
        // QCM: a options + reponses_correctes ou reponse_correcte
        if (donnees.options && (donnees.reponses_correctes || donnees.reponse_correcte !== undefined)) return 'qcm';
        // Vrai/Faux: a question + reponse (vrai/faux)
        if (donnees.question && donnees.reponse && (donnees.reponse === 'vrai' || donnees.reponse === 'faux')) return 'vrai_faux';
        // Chronologie (frise à compléter) : a paires avec date + mode
        if (donnees.paires && donnees.mode && donnees.paires[0]?.date !== undefined) return 'chronologie';
        // Timeline (cartes à ordonner) : a cartes sans recto, ou evenements
        if (donnees.cartes || donnees.evenements) return 'timeline';
        // Association: a paires avec element1/element2
        if (donnees.paires && donnees.paires.length > 0 && donnees.paires[0].element1 !== undefined) return 'association';
        // Texte à trous: structure spécifique
        if (donnees.texte || donnees.segments) return 'texte_trou';
        // Carte géo
        if (donnees.marqueurs || donnees.carte_url) return 'carte';
        return '';
    },

    countQuestionsForFormat(formatCode) {
        return this.getQuestionsForFormat(formatCode).length;
    },

    // Filtre les questions disponibles pour un format donné
    // etapeId est optionnel : s'il est fourni, on utilise la banque source de l'étape
    getQuestionsForFormat(formatCode, etapeId) {
        const questions = this.questionsConnaissances || [];

        // Déterminer la banque source
        let banqueFilter = null;
        if (etapeId) {
            const etape = this.wizardData.etapes.find(e => e.id === etapeId);
            if (etape && etape.banque_source_id) {
                banqueFilter = etape.banque_source_id;
            }
        }
        // Fallback : utiliser la banque du wizard si création depuis une banque
        if (!banqueFilter && this.wizardData && this.wizardData.banqueId && !this.wizardData.entrainement) {
            banqueFilter = this.wizardData.banqueId;
        }

        // Filtrer par banque si applicable
        let filtered = questions;
        if (banqueFilter) {
            filtered = questions.filter(q => q.banque_id === banqueFilter);
        }

        // Chronologie / Timeline : classer selon la structure réelle des données
        if (formatCode === 'chronologie' || formatCode === 'timeline') {
            return filtered.filter(q => {
                if (q.type !== 'timeline' && q.type !== 'chronologie') return false;
                const d = typeof q.donnees === 'string' ? JSON.parse(q.donnees || '{}') : (q.donnees || {});
                const isTexteMode = !!(d.paires && d.mode);
                return formatCode === 'chronologie' ? isTexteMode : !isTexteMode;
            });
        }
        return filtered.filter(q => q.type === formatCode);
    },

    async addWizardEtape(formatCode) {
        // Empêcher les doubles clics
        if (this._addingEtape) return;
        this._addingEtape = true;

        // Désactiver visuellement les boutons de format pendant l'ajout
        document.querySelectorAll('.format-card').forEach(btn => {
            btn.style.pointerEvents = 'none';
            btn.style.opacity = '0.6';
        });

        try {
            if (!this.wizardData.entrainement) {
                // D'abord sauvegarder l'entraînement
                if (!this.validateWizardStep(1)) {
                    this._addingEtape = false;
                    return;
                }
                await this.saveWizardStepData(1);
            }

            const format = this.formatsQuestions.find(f => f.code === formatCode);
            const ordre = this.wizardData.etapes.length + 1;

            const result = await this.callAPI('createEtapeConn', {
                entrainement_id: this.wizardData.entrainement.id,
                format_code: formatCode,
                ordre: ordre,
                mode_selection: 'manuel',
                nb_questions: 5
            });

            if (result.success) {
                // Mise à jour locale au lieu de loadDataFromAPI
                const newEtape = {
                    id: result.id,
                    entrainement_id: this.wizardData.entrainement.id,
                    format_code: formatCode,
                    ordre: ordre,
                    mode_selection: 'manuel',
                    nb_questions: 5
                };
                this.etapesConn.push(newEtape);
                this.wizardData.etapes.push(newEtape);
                this.renderWizardStep(2);
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur ajout étape:', error);
        } finally {
            this._addingEtape = false;
            document.querySelectorAll('.format-card').forEach(btn => {
                btn.style.pointerEvents = '';
                btn.style.opacity = '';
            });
        }
    },

    async removeWizardEtape(index) {
        const etape = this.wizardData.etapes[index];
        if (!etape || !etape.id) return;

        if (!confirm('Supprimer cette étape ?')) return;

        try {
            const result = await this.callAPI('deleteEtapeConn', { id: etape.id });
            if (result.success) {
                // Mise à jour locale au lieu de loadDataFromAPI
                this.etapesConn = this.etapesConn.filter(e => e.id !== etape.id);
                this.wizardData.etapes.splice(index, 1);
                // Supprimer aussi les questions sélectionnées pour cette étape
                if (this.wizardData.selectedQuestions) {
                    delete this.wizardData.selectedQuestions[etape.id];
                }
                // Mettre à jour les ordres après suppression
                this.wizardData.etapes.forEach((e, i) => e.ordre = i + 1);
                this.renderWizardStep(2);
            }
        } catch (error) {
            console.error('Erreur suppression étape:', error);
        }
    },

    async moveWizardEtape(index, direction) {
        // Éviter les doubles clics
        if (this._movingEtape) return;

        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.wizardData.etapes.length) return;

        this._movingEtape = true;

        // Échanger les positions
        const etapes = [...this.wizardData.etapes];
        [etapes[index], etapes[newIndex]] = [etapes[newIndex], etapes[index]];

        // Mettre à jour l'ordre dans la base
        try {
            // Appels API en parallèle pour plus de rapidité
            const updatePromises = etapes.map((etape, i) =>
                this.callAPI('updateEtapeConn', { id: etape.id, ordre: i + 1 })
            );
            await Promise.all(updatePromises);

            // Mise à jour locale au lieu de recharger toutes les données
            this.wizardData.etapes = etapes;

            // Mettre à jour aussi etapesConn
            etapes.forEach((etape, i) => {
                const found = this.etapesConn.find(e => e.id === etape.id);
                if (found) found.ordre = i + 1;
            });

            this.renderWizardStep(2);
        } catch (error) {
            console.error('Erreur réordonnancement:', error);
        } finally {
            this._movingEtape = false;
        }
    },

    // ===== ÉTAPE 3: QUESTIONS =====
    renderWizardStep3() {
        const etapes = this.wizardData.etapes || [];

        if (etapes.length === 0) {
            return `
                <div class="wizard-step-content">
                    <div class="step-header">
                        <span class="step-icon">❓</span>
                        <div>
                            <h3>Configuration des questions</h3>
                            <p>Aucune étape à configurer. Retournez à l'étape précédente pour ajouter des étapes.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">❓</span>
                    <div>
                        <h3>Configuration des questions</h3>
                        <p>Pour chaque étape, configurez le mode de sélection et les questions</p>
                    </div>
                </div>
                <div class="wizard-questions-list">
                    ${etapes.map((etape, index) => this.renderWizardEtapeQuestions(etape, index)).join('')}
                </div>
            </div>
        `;
    },

    renderWizardEtapeQuestions(etape, index) {
        const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
        const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
        const availableQuestions = this.getQuestionsForFormat(etape.format_code, etape.id);

        // Récupérer les banques qui contiennent des questions de ce format
        const banquesAvecQuestions = [...new Set(availableQuestions.map(q => q.banque_id))];
        const banquesOptions = banquesAvecQuestions.map(bId => {
            const banque = this.banquesQuestions.find(b => b.id === bId);
            return banque ? `<option value="${bId}">${this.escapeHtml(banque.titre)}</option>` : '';
        }).join('');

        // Panel fermé par défaut (plus lisible quand il y en a beaucoup)
        const isOpen = false;

        return `
            <div class="wizard-etape-questions" data-etape-id="${etape.id}">
                <div class="etape-questions-header" onclick="AdminBanquesExercices.toggleEtapeQuestionsPanel(${index})">
                    <div class="etape-header-left">
                        <span class="etape-number">${index + 1}</span>
                        <span class="etape-format-icon">${format.icone || '📋'}</span>
                        <span class="etape-format-name">${this.questionTypeNames[etape.format_code] || format.nom || etape.format_code}</span>
                    </div>
                    <div class="etape-header-right">
                        <span class="questions-count ${selectedIds.length === 0 ? 'warning' : ''}">${selectedIds.length} / ${availableQuestions.length} question${selectedIds.length > 1 ? 's' : ''}</span>
                        <span class="toggle-icon">${isOpen ? '▲' : '▼'}</span>
                    </div>
                </div>
                <div class="etape-questions-panel" id="etapePanel${index}" style="display: ${isOpen ? 'block' : 'none'};">
                    <div class="mode-selection">
                        <label class="section-label">Mode de sélection</label>
                        <div class="mode-options">
                            <label class="mode-option ${etape.mode_selection === 'aleatoire' ? 'selected' : ''}" onclick="AdminBanquesExercices.setEtapeMode('${etape.id}', 'aleatoire')">
                                <span class="mode-icon">🎲</span>
                                <span class="mode-label">Aléatoire</span>
                                <span class="mode-desc">Tirage au sort</span>
                            </label>
                            <label class="mode-option ${etape.mode_selection !== 'aleatoire' ? 'selected' : ''}" onclick="AdminBanquesExercices.setEtapeMode('${etape.id}', 'manuel')">
                                <span class="mode-icon">✋</span>
                                <span class="mode-label">Manuel</span>
                                <span class="mode-desc">Je choisis</span>
                            </label>
                        </div>
                    </div>
                    <div class="random-config" id="randomConfig${index}" style="display: ${etape.mode_selection === 'aleatoire' ? 'block' : 'none'};">
                        <div class="form-row">
                            <label>Banque source :</label>
                            <select class="form-select" onchange="AdminBanquesExercices.setEtapeBanqueSource('${etape.id}', this.value)">
                                <option value="" ${!etape.banque_source_id ? 'selected' : ''}>Toutes les banques</option>
                                ${this.banquesQuestions.map(b => `
                                    <option value="${b.id}" ${String(etape.banque_source_id) === String(b.id) ? 'selected' : ''}>${this.escapeHtml(b.titre)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Nombre de questions :</label>
                            <input type="number" class="form-input" value="${parseInt(etape.nb_questions) || 5}" min="1" max="${Math.max(availableQuestions.length, 1)}"
                                onchange="AdminBanquesExercices.setEtapeNbQuestions('${etape.id}', this.value)">
                            <span class="hint">/ ${availableQuestions.length} disponibles</span>
                        </div>
                    </div>
                    <div class="manual-selection" id="manualSelection${index}" style="display: ${etape.mode_selection !== 'aleatoire' ? 'block' : 'none'};">
                        <div class="questions-filter">
                            <label class="section-label">Sélectionner les questions (${availableQuestions.length} disponibles)</label>
                            ${banquesAvecQuestions.length > 1 ? `
                                <select class="form-select form-select-sm" onchange="AdminBanquesExercices.filterWizardQuestions(${index}, this.value)">
                                    <option value="">Toutes les banques</option>
                                    ${banquesOptions}
                                </select>
                            ` : ''}
                        </div>
                        <div class="questions-checklist" id="questionsChecklist${index}">
                            ${this.renderQuestionsChecklist(availableQuestions, selectedIds, etape.id)}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderQuestionsChecklist(questions, selectedIds, etapeId) {
        if (questions.length === 0) {
            return '<p class="no-questions">Aucune question disponible pour ce format. Créez des questions dans "Banques de questions".</p>';
        }

        return questions.map(q => {
            const banque = this.banquesQuestions.find(b => b.id === q.banque_id);
            const banqueNom = banque ? banque.titre : 'Sans banque';

            // Extraire le texte depuis donnees (qui peut être un objet ou un JSON string parsé)
            let donnees = q.donnees || {};
            if (typeof donnees === 'string') {
                try { donnees = JSON.parse(donnees); } catch(e) { donnees = {}; }
            }

            // Afficher le titre prof (identifiant interne pour le professeur)
            let questionText = q.titre_prof || 'Sans titre prof';

            return `
                <label class="question-checkbox ${selectedIds.includes(q.id) ? 'selected' : ''}" data-banque="${q.banque_id}">
                    <input type="checkbox" ${selectedIds.includes(q.id) ? 'checked' : ''}
                        onchange="AdminBanquesExercices.toggleEtapeQuestion('${etapeId}', '${q.id}', this.checked)">
                    <div class="question-content">
                        <span class="question-text">${this.escapeHtml(questionText.substring(0, 80))}${questionText.length > 80 ? '...' : ''}</span>
                        <span class="question-meta">📚 ${this.escapeHtml(banqueNom)}</span>
                    </div>
                </label>
            `;
        }).join('');
    },

    filterWizardQuestions(index, banqueId) {
        const checklist = document.getElementById(`questionsChecklist${index}`);
        const items = checklist.querySelectorAll('.question-checkbox');

        items.forEach(item => {
            if (!banqueId || item.dataset.banque === banqueId) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    },

    toggleEtapeQuestionsPanel(index) {
        const panel = document.getElementById(`etapePanel${index}`);
        const isOpen = panel.style.display !== 'none';
        panel.style.display = isOpen ? 'none' : 'block';

        // Toggle icon
        const header = panel.previousElementSibling;
        const icon = header.querySelector('.toggle-icon');
        if (icon) icon.textContent = isOpen ? '▼' : '▲';
    },

    async setEtapeMode(etapeId, mode) {
        try {
            // Sauvegarder l'état des accordéons ouverts avant le changement
            const openPanels = this.getOpenAccordionPanels();

            await this.callAPI('updateEtapeConn', { id: etapeId, mode_selection: mode });

            // Mise à jour locale au lieu de recharger toutes les données
            const etape = this.etapesConn.find(e => e.id === etapeId);
            if (etape) {
                etape.mode_selection = mode;
            }
            const wizardEtape = this.wizardData.etapes.find(e => e.id === etapeId);
            if (wizardEtape) {
                wizardEtape.mode_selection = mode;
            }

            // NOTE: On ne supprime PAS les questions sélectionnées ici.
            // Le changement de mode est un choix d'affichage/comportement,
            // pas une raison de perdre les sélections manuelles existantes.
            // Les sélections sont conservées pour permettre un retour au mode manuel.

            // Re-render et restaurer l'état des accordéons
            this.renderWizardStep(3);
            this.restoreOpenAccordionPanels(openPanels);
        } catch (error) {
            console.error('Erreur changement mode:', error);
        }
    },

    // Récupère les index des accordéons ouverts
    getOpenAccordionPanels() {
        const openIndexes = [];
        document.querySelectorAll('.etape-questions-panel').forEach((panel, index) => {
            if (panel.style.display !== 'none') {
                openIndexes.push(index);
            }
        });
        return openIndexes;
    },

    // Restaure les accordéons qui étaient ouverts
    restoreOpenAccordionPanels(indexes) {
        indexes.forEach(index => {
            const panel = document.getElementById(`etapePanel${index}`);
            if (panel) {
                panel.style.display = 'block';
                const header = panel.previousElementSibling;
                const icon = header?.querySelector('.toggle-icon');
                if (icon) icon.textContent = '▲';
            }
        });
    },

    async setEtapeNbQuestions(etapeId, nb) {
        try {
            await this.callAPI('updateEtapeConn', { id: etapeId, nb_questions: parseInt(nb) });
            // Mettre à jour localement dans les deux sources de données
            const etape = this.etapesConn.find(e => e.id === etapeId);
            if (etape) {
                etape.nb_questions = parseInt(nb);
            }
            const wizardEtape = this.wizardData.etapes.find(e => e.id === etapeId);
            if (wizardEtape) {
                wizardEtape.nb_questions = parseInt(nb);
            }
        } catch (error) {
            console.error('Erreur mise à jour nb questions:', error);
        }
    },

    async setEtapeBanqueSource(etapeId, banqueId) {
        try {
            await this.callAPI('updateEtapeConn', { id: etapeId, banque_source_id: banqueId || '' });
            // Mettre à jour localement
            const etape = this.etapesConn.find(e => e.id === etapeId);
            if (etape) {
                etape.banque_source_id = banqueId || '';
            }
            // Aussi mettre à jour dans wizardData
            const wizardEtape = this.wizardData.etapes.find(e => e.id === etapeId);
            if (wizardEtape) {
                wizardEtape.banque_source_id = banqueId || '';
            }

            // Redessiner l'étape pour mettre à jour le compteur
            this.updateRandomConfigDisplay(etapeId);
        } catch (error) {
            console.error('Erreur mise à jour banque source:', error);
        }
    },

    updateRandomConfigDisplay(etapeId) {
        const etape = this.wizardData.etapes.find(e => e.id === etapeId);
        if (!etape) return;

        // Calculer le nombre de questions disponibles avec la nouvelle banque source
        const availableQuestions = this.getQuestionsForFormat(etape.format_code, etapeId);

        // Trouver l'index de l'étape pour localiser le bon panneau
        const etapeIndex = this.wizardData.etapes.findIndex(e => e.id === etapeId);

        // Mettre à jour le compteur dans le DOM
        const hintSpan = document.querySelector(`#randomConfig${etapeIndex} .hint`);
        if (hintSpan) {
            hintSpan.textContent = `/ ${availableQuestions.length} disponibles`;
        }

        // Aussi mettre à jour le max du champ nombre de questions
        const numberInput = document.querySelector(`#randomConfig${etapeIndex} input[type="number"]`);
        if (numberInput) {
            numberInput.max = Math.max(availableQuestions.length, 1);
        }
    },

    toggleEtapeQuestion(etapeId, questionId, isChecked) {
        // Stocker localement dans wizardData (sauvegarde à la fin)
        if (!this.wizardData.selectedQuestions) {
            this.wizardData.selectedQuestions = {};
        }
        if (!this.wizardData.selectedQuestions[etapeId]) {
            this.wizardData.selectedQuestions[etapeId] = [];
        }

        const currentSelection = this.wizardData.selectedQuestions[etapeId];

        if (isChecked) {
            if (!currentSelection.includes(questionId)) {
                currentSelection.push(questionId);
            }
        } else {
            const index = currentSelection.indexOf(questionId);
            if (index > -1) {
                currentSelection.splice(index, 1);
            }
        }

        // Mettre à jour le compteur et la classe selected
        const etapeEl = document.querySelector(`.wizard-etape-questions[data-etape-id="${etapeId}"]`);
        if (etapeEl) {
            const etape = this.wizardData.etapes.find(e => e.id === etapeId);
            const selectedCount = currentSelection.length;
            const availableQuestions = this.getQuestionsForFormat(etape?.format_code);
            const countEl = etapeEl.querySelector('.questions-count');
            if (countEl) {
                countEl.textContent = `${selectedCount} / ${availableQuestions.length} question${selectedCount > 1 ? 's' : ''}`;
                countEl.classList.toggle('warning', selectedCount === 0);
            }
            // Mettre à jour la classe selected sur la checkbox
            const checkbox = etapeEl.querySelector(`input[onchange*="${questionId}"]`);
            if (checkbox) {
                checkbox.closest('.question-checkbox').classList.toggle('selected', isChecked);
            }
        }
    },

    // Récupérer les questions sélectionnées pour une étape (local ou serveur)
    // IMPORTANT: Filtre les IDs pour ne garder que ceux qui existent réellement
    getSelectedQuestionsForEtape(etapeId) {
        // Trouver l'étape pour connaître son format
        const etape = this.wizardData?.etapes?.find(e => e.id === etapeId) ||
                      this.etapesConn?.find(e => e.id === etapeId);

        // Obtenir les IDs des questions réellement disponibles pour ce format
        const availableQuestionIds = etape ?
            this.getQuestionsForFormat(etape.format_code).map(q => q.id) : [];

        let selectedIds = [];

        // D'abord vérifier les sélections locales du wizard
        if (this.wizardData?.selectedQuestions?.[etapeId]) {
            selectedIds = this.wizardData.selectedQuestions[etapeId];
        } else {
            // Sinon utiliser les données serveur
            selectedIds = (this.etapeQuestionsConn || [])
                .filter(eq => eq.etape_id === etapeId)
                .map(eq => eq.question_id);
        }

        // Dédupliquer + filtrer pour ne garder que les IDs qui existent dans les questions disponibles
        return [...new Set(selectedIds)].filter(id => availableQuestionIds.includes(id));
    },

    // ===== ÉTAPE 4: VALIDATION =====
    renderWizardStep4() {
        const e = this.wizardData.entrainement || {};
        const etapes = this.wizardData.etapes || [];

        let totalQuestions = 0;
        etapes.forEach(etape => {
            if (etape.mode_selection === 'aleatoire') {
                totalQuestions += parseInt(etape.nb_questions) || 5;
            } else {
                const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
                totalQuestions += selectedIds.length;
            }
        });

        return `
            <div class="wizard-step-content">
                <div class="step-header">
                    <span class="step-icon">✅</span>
                    <div>
                        <h3>Validation</h3>
                        <p>Vérifiez le résumé de votre entraînement avant de valider</p>
                    </div>
                </div>
                <div class="validation-summary">
                    <div class="summary-card">
                        <h4>📚 Informations générales</h4>
                        <div class="summary-row">
                            <span class="label">Titre :</span>
                            <span class="value">${this.escapeHtml(e.titre || 'Sans titre')}</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Description :</span>
                            <span class="value">${e.description ? this.escapeHtml(e.description) : '<em>Aucune</em>'}</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Durée :</span>
                            <span class="value">${e.duree || 15} minutes</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Seuil de réussite :</span>
                            <span class="value">${e.seuil || 80}%</span>
                        </div>
                        <div class="summary-row">
                            <span class="label">Statut :</span>
                            <span class="value status-badge ${e.statut === 'publie' ? 'published' : 'draft'}">${e.statut === 'publie' ? '✅ Publié' : '📝 Brouillon'}</span>
                        </div>
                    </div>

                    <div class="summary-card">
                        <h4>📝 Étapes (${etapes.length})</h4>
                        ${etapes.length === 0 ? '<p class="empty">Aucune étape</p>' : `
                            <div class="summary-etapes">
                                ${etapes.map((etape, index) => {
                                    const format = this.formatsQuestions.find(f => f.code === etape.format_code) || {};
                                    const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
                                    const qCount = etape.mode_selection === 'aleatoire' ? (parseInt(etape.nb_questions) || 5) : selectedIds.length;

                                    return `
                                        <div class="summary-etape">
                                            <span class="etape-num">${index + 1}</span>
                                            <span class="etape-icon">${format.icone || '📋'}</span>
                                            <span class="etape-name">${this.questionTypeNames[etape.format_code] || format.nom || etape.format_code}</span>
                                            <span class="etape-questions">${qCount} question${qCount > 1 ? 's' : ''}</span>
                                            <span class="etape-mode-badge ${etape.mode_selection}">${etape.mode_selection === 'aleatoire' ? '🎲' : '✋'}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>

                    <div class="summary-stats">
                        <div class="stat-box">
                            <span class="stat-value">${etapes.length}</span>
                            <span class="stat-label">Étapes</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-value">${totalQuestions}</span>
                            <span class="stat-label">Questions</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-value">${e.duree || 15}</span>
                            <span class="stat-label">Minutes</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async finalizeEntrainement() {
        // Éviter les doubles clics sur "Valider et fermer"
        if (this._finalizing) return;
        this._finalizing = true;

        // Feedback visuel : désactiver les deux boutons de navigation
        const nextBtn = document.getElementById('wizardNextBtn');
        const prevBtn = document.getElementById('wizardPrevBtn');
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.textContent = 'Sauvegarde...';
        }
        if (prevBtn) {
            prevBtn.disabled = true;
        }

        try {
            // Sauvegarder les questions sélectionnées pour chaque étape en mode manuel
            // Sauvegarde séquentielle pour éviter les race conditions sur le sheet
            if (this.wizardData.etapes) {
                for (const etape of this.wizardData.etapes) {
                    // Les étapes en mode aléatoire n'utilisent pas ETAPE_QUESTIONS_CONN
                    if (etape.mode_selection === 'aleatoire') continue;

                    const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
                    const questionsFormatted = selectedIds.map(id => ({ question_id: id }));

                    try {
                        await this.callAPI('setEtapeQuestionsConn', {
                            etape_id: etape.id,
                            questions: JSON.stringify(questionsFormatted)
                        });
                    } catch (error) {
                        console.error(`Erreur sauvegarde questions étape ${etape.id}:`, error);
                        throw error;
                    }
                }
            }

            // Mise à jour locale des etapeQuestionsConn au lieu de loadDataFromAPI()
            if (this.wizardData.etapes) {
                for (const etape of this.wizardData.etapes) {
                    if (etape.mode_selection === 'aleatoire') continue;
                    const selectedIds = this.getSelectedQuestionsForEtape(etape.id);
                    // Supprimer les anciennes entrées pour cette étape
                    this.etapeQuestionsConn = (this.etapeQuestionsConn || []).filter(eq => eq.etape_id !== etape.id);
                    // Ajouter les nouvelles
                    selectedIds.forEach(qId => {
                        this.etapeQuestionsConn.push({ etape_id: etape.id, question_id: qId });
                    });
                }
            }

            // Mettre à jour l'entraînement dans les données locales
            if (this.wizardData.entrainement) {
                const idx = this.entrainementsConn.findIndex(e => e.id === this.wizardData.entrainement.id);
                if (idx >= 0) {
                    Object.assign(this.entrainementsConn[idx], this.wizardData.entrainement);
                }
            }

            this.saveToCache();

            // Fermer le wizard et rafraîchir l'affichage
            this.closeEntrainementWizard();
            this.renderBanques();

            // Afficher un message de succès
            this.showNotification('Entraînement sauvegardé avec succès !', 'success');
        } catch (error) {
            console.error('Erreur finalisation entraînement:', error);
            this.showNotification('Erreur lors de la sauvegarde. Vérifiez votre connexion et réessayez.', 'error');
        } finally {
            this._finalizing = false;
            if (nextBtn) {
                nextBtn.disabled = false;
                nextBtn.textContent = '✓ Valider et fermer';
            }
            if (prevBtn) {
                prevBtn.disabled = false;
            }
        }
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);
    },

    // ========== CRUD BANQUES D'EXERCICES CONN ==========

    addBanqueExercicesConn() {
        this.openBanqueExercicesConnModal();
    },

    editBanqueExercicesConn(id) {
        const banque = this.banquesExercicesConn.find(b => b.id === id);
        if (!banque) return;
        this.openBanqueExercicesConnModal(banque);
    },

    openBanqueExercicesConnModal(banque = null) {
        // Créer le modal dynamiquement s'il n'existe pas
        let modal = document.getElementById('banqueExercicesConnModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'banqueExercicesConnModal';
            modal.className = 'modal-overlay hidden';
            modal.innerHTML = `
                <div class="modal modal-medium">
                    <div class="modal-header">
                        <h2 id="banqueExConnModalTitle">Nouvelle banque d'exercices</h2>
                        <button class="modal-close" onclick="AdminBanquesExercices.closeBanqueExercicesConnModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="editBanqueExConnId">
                        <div class="form-group">
                            <label>Titre <span class="req">*</span></label>
                            <input type="text" class="form-input" id="banqueExConnTitre" placeholder="Ex: Leçon 1 - La Révolution">
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea class="form-textarea" id="banqueExConnDescription" rows="2" placeholder="Description optionnelle..."></textarea>
                        </div>
                        <div class="form-group">
                            <label>Statut</label>
                            <select class="form-select" id="banqueExConnStatut">
                                <option value="brouillon">Brouillon</option>
                                <option value="publie">Publié</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="AdminBanquesExercices.closeBanqueExercicesConnModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="AdminBanquesExercices.saveBanqueExercicesConn()">Enregistrer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const title = document.getElementById('banqueExConnModalTitle');
        if (banque) {
            title.textContent = 'Modifier la banque d\'exercices';
            document.getElementById('editBanqueExConnId').value = banque.id;
            document.getElementById('banqueExConnTitre').value = banque.titre || '';
            document.getElementById('banqueExConnDescription').value = banque.description || '';
            document.getElementById('banqueExConnStatut').value = banque.statut || 'brouillon';
        } else {
            title.textContent = 'Nouvelle banque d\'exercices';
            document.getElementById('editBanqueExConnId').value = '';
            document.getElementById('banqueExConnTitre').value = '';
            document.getElementById('banqueExConnDescription').value = '';
            document.getElementById('banqueExConnStatut').value = 'brouillon';
        }

        modal.classList.remove('hidden');
    },

    closeBanqueExercicesConnModal() {
        const modal = document.getElementById('banqueExercicesConnModal');
        if (modal) modal.classList.add('hidden');
    },

    async saveBanqueExercicesConn() {
        if (this._savingBanque) return;
        this._savingBanque = true;

        const id = document.getElementById('editBanqueExConnId').value;
        const titre = document.getElementById('banqueExConnTitre').value.trim();
        const description = document.getElementById('banqueExConnDescription').value.trim();
        const statut = document.getElementById('banqueExConnStatut').value;

        if (!titre) {
            this.showNotification('Le titre est requis', 'warning');
            this._savingBanque = false;
            return;
        }

        const data = { titre, description, statut };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateBanqueExercicesConn', data);
            } else {
                result = await this.callAPI('createBanqueExercicesConn', data);
            }

            if (result.success) {
                this.closeBanqueExercicesConnModal();
                // Mise à jour locale au lieu de loadDataFromAPI()
                if (id) {
                    const index = this.banquesExercicesConn.findIndex(b => b.id === id);
                    if (index >= 0) Object.assign(this.banquesExercicesConn[index], data);
                } else {
                    this.banquesExercicesConn.push({ ...data, id: result.id });
                }
                this.saveToCache();
                this.renderBanques();
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde banque:', error);
            this.showNotification('Erreur lors de la sauvegarde. Vérifiez votre connexion.', 'error');
        } finally {
            this._savingBanque = false;
        }
    },

    async deleteBanqueExercicesConn(id) {
        if (!confirm('Supprimer cette banque et tous ses entraînements ?')) return;

        // Mise à jour optimiste : UI d'abord, API en arrière-plan
        const oldBanques = this.banquesExercicesConn;
        const oldEntrainements = this.entrainementsConn;
        const oldEtapes = this.etapesConn;
        const oldEtapeQuestions = this.etapeQuestionsConn;

        const entrIds = this.entrainementsConn.filter(e => e.banque_exercice_id === id).map(e => e.id);
        this.banquesExercicesConn = this.banquesExercicesConn.filter(b => b.id !== id);
        this.entrainementsConn = this.entrainementsConn.filter(e => e.banque_exercice_id !== id);
        this.etapesConn = this.etapesConn.filter(e => !entrIds.includes(e.entrainement_id));
        this.etapeQuestionsConn = (this.etapeQuestionsConn || []).filter(eq => {
            const etape = this.etapesConn.find(e => e.id === eq.etape_id);
            return etape !== undefined;
        });
        this.saveToCache();
        this.renderBanques();

        // API en arrière-plan
        try {
            const result = await this.callAPI('deleteBanqueExercicesConn', { id });
            if (!result.success) {
                // Rollback
                this.banquesExercicesConn = oldBanques;
                this.entrainementsConn = oldEntrainements;
                this.etapesConn = oldEtapes;
                this.etapeQuestionsConn = oldEtapeQuestions;
                this.saveToCache();
                this.renderBanques();
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            // Rollback
            this.banquesExercicesConn = oldBanques;
            this.entrainementsConn = oldEntrainements;
            this.etapesConn = oldEtapes;
            this.etapeQuestionsConn = oldEtapeQuestions;
            this.saveToCache();
            this.renderBanques();
            this.showNotification('Erreur lors de la suppression. Vérifiez votre connexion.', 'error');
        }
    },

    // ========== CRUD ENTRAINEMENTS CONN ==========

    async deleteEntrainementConn(id) {
        if (!confirm('Supprimer cet entraînement et toutes ses étapes ?')) return;

        // Mise à jour optimiste : UI d'abord, API en arrière-plan
        const oldEntrainements = this.entrainementsConn;
        const oldEtapes = this.etapesConn;
        const oldEtapeQuestions = this.etapeQuestionsConn;

        const etapeIds = this.etapesConn.filter(e => e.entrainement_id === id).map(e => e.id);
        this.entrainementsConn = this.entrainementsConn.filter(e => e.id !== id);
        this.etapesConn = this.etapesConn.filter(e => e.entrainement_id !== id);
        this.etapeQuestionsConn = (this.etapeQuestionsConn || []).filter(eq => !etapeIds.includes(eq.etape_id));
        this.saveToCache();
        this.renderBanques();

        // API en arrière-plan
        try {
            const result = await this.callAPI('deleteEntrainementConn', { id });
            if (!result.success) {
                // Rollback
                this.entrainementsConn = oldEntrainements;
                this.etapesConn = oldEtapes;
                this.etapeQuestionsConn = oldEtapeQuestions;
                this.saveToCache();
                this.renderBanques();
                this.showNotification('Erreur : ' + (result.error || 'Erreur inconnue'), 'error');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            // Rollback
            this.entrainementsConn = oldEntrainements;
            this.etapesConn = oldEtapes;
            this.etapeQuestionsConn = oldEtapeQuestions;
            this.saveToCache();
            this.renderBanques();
            this.showNotification('Erreur lors de la suppression. Vérifiez votre connexion.', 'error');
        }
    },
});
