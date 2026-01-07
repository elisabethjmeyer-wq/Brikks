/**
 * Admin Entrainements - Gestion des entrainements
 */

const AdminEntrainements = {
    // Data
    entrainements: [],
    entrainementQuestions: [],
    questions: [],
    disciplines: [],
    themes: [],
    chapitres: [],

    // Data pour connaissances
    banquesQuestions: [],
    questionsConnaissances: [],

    // Filters
    filters: {
        search: '',
        type: '',
        statut: '',
        discipline: ''
    },

    // Wizard state
    currentStep: 1,
    composedExercises: [],
    composedEtapes: [], // Pour les entraînements de connaissances

    // Noms des types de questions connaissances
    questionTypeNames: {
        'qcm': 'QCM',
        'vrai_faux': 'Vrai/Faux',
        'chronologie': 'Chronologie',
        'timeline': 'Timeline',
        'association': 'Association',
        'texte_trou': 'Texte à trous'
    },

    // Format names
    formatNames: {
        'format_001': 'QCM',
        'format_002': 'QCM Multiple',
        'format_003': 'Vrai/Faux',
        'format_004': 'Texte à trous',
        'format_005': 'Association',
        'format_006': 'Ordonner',
        'format_007': 'Question ouverte',
        'format_008': 'Image cliquable'
    },

    // Mapping format_id → type (pour connecter avec la banque d'éléments)
    formatToType: {
        'format_001': 'qcm',
        'format_002': 'qcm',           // QCM Multiple utilise aussi le type qcm
        'format_003': 'qcm',           // Vrai/Faux est un type de QCM
        'format_004': 'texte_trous',
        'format_005': 'paire',         // Association = paires
        'format_006': 'evenement',     // Ordonner = événements à ordonner
        'format_007': 'reponse_libre',
        'format_008': 'point_carte'    // Image cliquable = points sur carte
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.populateDisciplineFilter();
            this.setupEventListeners();
            this.renderEntrainements();
            this.updateStats();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    populateDisciplineFilter() {
        const select = document.getElementById('filterDiscipline');
        if (!select) return;

        select.innerHTML = '<option value="">📚 Toutes les matières</option>' +
            this.disciplines.map(d => {
                const emoji = d.emoji || '📖';
                return `<option value="${d.id}">${emoji} ${this.escapeHtml(d.nom || d.id)}</option>`;
            }).join('');
    },

    async loadData() {
        const [
            disciplinesData,
            themesData,
            chapitresData,
            entrainementsData,
            entrainementQuestionsData,
            questionsData,
            banquesQuestionsData,
            questionsConnaissancesData
        ] = await Promise.all([
            SheetsAPI.getSheetData('DISCIPLINES'),
            SheetsAPI.getSheetData('THEMES'),
            SheetsAPI.getSheetData('CHAPITRES'),
            SheetsAPI.getSheetData('ENTRAINEMENTS'),
            SheetsAPI.getSheetData('ENTRAINEMENT_QUESTIONS'),
            SheetsAPI.getSheetData('QUESTIONS'),
            SheetsAPI.getSheetData('BANQUES_QUESTIONS'),
            SheetsAPI.getSheetData('QUESTIONS_CONNAISSANCES')
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.entrainements = SheetsAPI.parseSheetData(entrainementsData);
        this.entrainementQuestions = SheetsAPI.parseSheetData(entrainementQuestionsData);
        this.questions = SheetsAPI.parseSheetData(questionsData);
        this.banquesQuestions = SheetsAPI.parseSheetData(banquesQuestionsData);
        this.questionsConnaissances = SheetsAPI.parseSheetData(questionsConnaissancesData);

        // Parse donnees JSON
        this.questions = this.questions.map(q => {
            if (q.donnees && typeof q.donnees === 'string') {
                try {
                    q.donnees = JSON.parse(q.donnees);
                } catch (e) {
                    q.donnees = {};
                }
            }
            return q;
        });

        // Parse données JSON des questions de connaissances
        this.questionsConnaissances = this.questionsConnaissances.map(q => {
            if (q.donnees && typeof q.donnees === 'string') {
                try {
                    q.donnees = JSON.parse(q.donnees);
                } catch (e) {
                    q.donnees = {};
                }
            }
            return q;
        });
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('entrainements-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">!</div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Add button
        document.getElementById('addEntrainementBtn').addEventListener('click', () => this.openModal());

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderEntrainements();
        });

        // Type tabs
        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const clickedTab = e.target.closest('.type-tab');
                if (!clickedTab) return;
                document.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
                clickedTab.classList.add('active');
                this.filters.type = clickedTab.dataset.type;
                this.renderEntrainements();
            });
        });

        // Filter discipline
        document.getElementById('filterDiscipline').addEventListener('change', (e) => {
            this.filters.discipline = e.target.value;
            this.renderEntrainements();
        });

        // Filter status
        document.getElementById('filterStatut').addEventListener('change', (e) => {
            this.filters.statut = e.target.value;
            this.renderEntrainements();
        });

        // Modal events
        document.getElementById('closeEntrainementModal').addEventListener('click', () => this.closeModal());

        // Wizard navigation
        document.getElementById('prevStepBtn').addEventListener('click', () => this.prevStep());
        document.getElementById('nextStepBtn').addEventListener('click', () => this.nextStep());
        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveEntrainement('brouillon'));
        document.getElementById('publishBtn').addEventListener('click', () => this.saveEntrainement('publie'));
        document.getElementById('previewBtn').addEventListener('click', () => this.previewEntrainement());

        // Discipline change
        document.getElementById('entrainementDiscipline').addEventListener('change', (e) => {
            this.onDisciplineChange(e.target.value);
        });

        // Theme change
        document.getElementById('entrainementTheme').addEventListener('change', (e) => {
            this.onThemeChange(e.target.value);
        });

        // Selection mode change
        document.querySelectorAll('input[name="selectionMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleManualSelection(e.target.value === 'manual');
            });
        });

        // Format change in step 2
        document.getElementById('exerciseFormat').addEventListener('change', () => {
            this.updateAvailableElements();
        });

        // Add exercise
        document.getElementById('addExerciseBtn').addEventListener('click', () => this.addExercise());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteEntrainement());

        // Close on overlay click
        document.getElementById('entrainementModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) this.closeModal();
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) this.closeDeleteModal();
        });

        // ========== CONNAISSANCES - Event listeners ==========
        // Type change - basculer entre les deux interfaces
        document.getElementById('entrainementType').addEventListener('change', (e) => {
            this.onTypeChange(e.target.value);
        });

        // Banque de questions change
        document.getElementById('connBanque').addEventListener('change', (e) => {
            this.onBanqueChange(e.target.value);
        });

        // Type de question connaissances change
        document.getElementById('connQuestionType').addEventListener('change', () => {
            this.updateConnQuestionsAvailable();
        });

        // Mode de sélection connaissances
        document.querySelectorAll('input[name="connSelectionMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.toggleConnManualSelection(e.target.value === 'manual');
            });
        });

        // Ajouter une étape
        document.getElementById('addEtapeBtn').addEventListener('click', () => this.addEtape());
    },

    // ========== TYPE CHANGE ==========
    onTypeChange(type) {
        const step2Standard = document.getElementById('step2Standard');
        const step2Connaissances = document.getElementById('step2Connaissances');

        if (type === 'connaissances') {
            step2Standard.style.display = 'none';
            step2Connaissances.style.display = 'grid';
            this.populateBanquesQuestions();
        } else {
            step2Standard.style.display = 'grid';
            step2Connaissances.style.display = 'none';
        }
    },

    // ========== CONNAISSANCES - Méthodes ==========
    populateBanquesQuestions() {
        const select = document.getElementById('connBanque');
        const chapitreId = document.getElementById('entrainementChapitre').value;

        // Filtrer les banques par chapitre si un chapitre est sélectionné
        let banques = this.banquesQuestions;
        if (chapitreId) {
            banques = banques.filter(b => b.chapitre_id === chapitreId || !b.chapitre_id);
        }

        select.innerHTML = '<option value="">Sélectionner une banque...</option>' +
            banques.map(b => `<option value="${b.id}">${this.escapeHtml(b.titre || 'Sans titre')}</option>`).join('');
    },

    onBanqueChange(banqueId) {
        this.updateConnQuestionsAvailable();
    },

    updateConnQuestionsAvailable() {
        const banqueId = document.getElementById('connBanque').value;
        const questionType = document.getElementById('connQuestionType').value;
        const isManual = document.querySelector('input[name="connSelectionMode"]:checked')?.value === 'manual';

        // Filtrer les questions par banque et type
        const available = this.questionsConnaissances.filter(q =>
            q.banque_id === banqueId && q.type === questionType
        );

        // Mettre à jour le compteur
        document.getElementById('connQuestionsInfo').innerHTML =
            `<span class="conn-available">${available.length} questions disponibles</span>`;

        // Mettre à jour le max du champ nombre
        const countInput = document.getElementById('connQuestionCount');
        if (available.length > 0) {
            countInput.max = available.length;
            if (parseInt(countInput.value) > available.length) {
                countInput.value = available.length;
            }
        }

        // Si mode manuel, afficher les questions
        if (isManual) {
            this.renderConnQuestionsCheckboxes(available);
        }
    },

    toggleConnManualSelection(show) {
        const container = document.getElementById('connQuestionsAvailable');
        container.style.display = show ? 'block' : 'none';
        if (show) {
            this.updateConnQuestionsAvailable();
        }
    },

    renderConnQuestionsCheckboxes(questions) {
        const container = document.getElementById('connQuestionsCheckboxes');

        if (questions.length === 0) {
            container.innerHTML = '<p style="padding: 16px; color: var(--gray-500); text-align: center;">Aucune question disponible</p>';
        } else {
            container.innerHTML = questions.map(q => {
                const preview = this.getQuestionPreview(q);
                return `
                    <label class="element-checkbox">
                        <input type="checkbox" value="${q.id}">
                        <span class="element-checkbox-label">${this.escapeHtml(preview)}</span>
                    </label>
                `;
            }).join('');
        }
    },

    getQuestionPreview(question) {
        if (!question.donnees) return 'Question sans contenu';

        switch (question.type) {
            case 'qcm':
            case 'vrai_faux':
                return question.donnees.question?.substring(0, 80) || 'Question sans texte';
            case 'chronologie':
            case 'association':
                return question.donnees.consigne?.substring(0, 80) || 'Exercice d\'association';
            case 'timeline':
                return question.donnees.consigne?.substring(0, 80) || 'Exercice de timeline';
            case 'texte_trou':
                return question.donnees.texte?.substring(0, 80) || 'Texte à trous';
            default:
                return 'Question';
        }
    },

    addEtape() {
        const banqueId = document.getElementById('connBanque').value;
        const questionType = document.getElementById('connQuestionType').value;
        const count = parseInt(document.getElementById('connQuestionCount').value) || 5;
        const mode = document.querySelector('input[name="connSelectionMode"]:checked')?.value || 'random';

        if (!banqueId) {
            alert('Veuillez sélectionner une banque de questions');
            return;
        }

        // Vérifier qu'il y a assez de questions
        const available = this.questionsConnaissances.filter(q =>
            q.banque_id === banqueId && q.type === questionType
        );

        if (available.length === 0) {
            alert('Aucune question disponible pour ce type dans cette banque');
            return;
        }

        let selectedQuestions = [];
        if (mode === 'manual') {
            selectedQuestions = Array.from(document.querySelectorAll('#connQuestionsCheckboxes input:checked'))
                .map(cb => cb.value);
            if (selectedQuestions.length === 0) {
                alert('Veuillez sélectionner au moins une question');
                return;
            }
        }

        // Récupérer le nom de la banque
        const banque = this.banquesQuestions.find(b => b.id === banqueId);

        this.composedEtapes.push({
            banque_id: banqueId,
            banque_titre: banque?.titre || 'Banque',
            type: questionType,
            count: mode === 'manual' ? selectedQuestions.length : Math.min(count, available.length),
            mode: mode,
            questions: selectedQuestions
        });

        this.renderEtapesList();

        // Reset form
        document.getElementById('connQuestionCount').value = 5;
        document.querySelector('input[name="connSelectionMode"][value="random"]').checked = true;
        this.toggleConnManualSelection(false);
    },

    removeEtape(index) {
        this.composedEtapes.splice(index, 1);
        this.renderEtapesList();
    },

    renderEtapesList() {
        const container = document.getElementById('etapesList');
        const empty = document.getElementById('etapesEmpty');
        const countEl = document.getElementById('etapesCount');

        if (this.composedEtapes.length === 0) {
            container.innerHTML = '';
            empty.style.display = 'block';
            countEl.textContent = '0 étapes';
        } else {
            empty.style.display = 'none';
            countEl.textContent = `${this.composedEtapes.length} étapes`;

            container.innerHTML = this.composedEtapes.map((etape, i) => `
                <div class="exercise-item">
                    <div class="exercise-info">
                        <div class="exercise-format">Étape ${i + 1}: ${this.questionTypeNames[etape.type] || etape.type}</div>
                        <div class="exercise-details">${etape.count} questions - ${etape.mode === 'random' ? 'Aléatoire' : 'Manuel'}</div>
                    </div>
                    <button class="exercise-remove" onclick="AdminEntrainements.removeEtape(${i})">X</button>
                </div>
            `).join('');
        }
    },

    // ========== RENDER ENTRAINEMENTS ==========
    renderEntrainements() {
        const container = document.getElementById('entrainementsGrid');
        const emptyState = document.getElementById('emptyState');

        let filtered = this.entrainements.filter(e => {
            if (this.filters.search) {
                const searchIn = `${e.titre || ''} ${e.description || ''}`.toLowerCase();
                if (!searchIn.includes(this.filters.search)) return false;
            }
            if (this.filters.type && e.niveau !== this.filters.type) return false;
            if (this.filters.statut && e.statut !== this.filters.statut) return false;
            if (this.filters.discipline) {
                // Find chapter and check its discipline
                const chapitre = this.chapitres.find(c => c.id === e.chapitre_id);
                if (chapitre) {
                    const theme = this.themes.find(t => t.id === chapitre.theme_id);
                    if (!theme || theme.discipline_id !== this.filters.discipline) return false;
                } else {
                    return false;
                }
            }
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = filtered.map(e => this.renderEntrainementCard(e)).join('');
        }
    },

    renderEntrainementCard(entrainement) {
        const chapitre = this.chapitres.find(c => c.id === entrainement.chapitre_id);
        const chapterName = chapitre?.titre || 'Non défini';

        // Get discipline info
        let disciplineEmoji = '📖';
        let disciplineName = '';
        let disciplineClass = 'histoire';
        if (chapitre) {
            const theme = this.themes.find(t => t.id === chapitre.theme_id);
            if (theme) {
                const discipline = this.disciplines.find(d => d.id === theme.discipline_id);
                if (discipline) {
                    disciplineEmoji = discipline.emoji || '📖';
                    disciplineName = discipline.nom || '';
                    disciplineClass = (discipline.nom || '').toLowerCase().replace(/[^a-z]/g, '') || 'histoire';
                }
            }
        }

        // Get exercises for this entrainement
        const exercises = this.entrainementQuestions.filter(eq => eq.entrainement_id === entrainement.id);
        const exerciseCount = exercises.length;

        // Get unique formats
        const formats = [...new Set(exercises.map(eq => eq.format_id))];

        const typeClass = entrainement.niveau || 'connaissances';
        const statusClass = entrainement.statut || 'brouillon';
        const participations = parseInt(entrainement.participations) || 0;

        // Type labels
        const typeLabels = {
            'connaissances': '✅ Connaissances',
            'savoir-faire': '🔧 Savoir-faire',
            'competences': '🎯 Compétences'
        };

        // Status labels
        const statusLabels = {
            'publie': 'Publié',
            'brouillon': 'Brouillon'
        };

        return `
            <div class="entrainement-card ${typeClass}" data-id="${entrainement.id}">
                <div class="entrainement-card-header">
                    <div class="entrainement-card-icon ${disciplineClass}">${disciplineEmoji}</div>
                    <div class="entrainement-card-info">
                        <div class="entrainement-card-badges">
                            <span class="entrainement-card-type ${typeClass}">${typeLabels[typeClass] || typeClass}</span>
                            <span class="entrainement-card-status ${statusClass}">${statusLabels[statusClass] || statusClass}</span>
                        </div>
                        <h3 class="entrainement-card-title">${this.escapeHtml(entrainement.titre || 'Sans titre')}</h3>
                        <p class="entrainement-card-chapter">${disciplineName ? disciplineName + ' • ' : ''}${this.escapeHtml(chapterName)}</p>
                    </div>
                </div>
                <div class="entrainement-card-body">
                    <div class="entrainement-card-stats">
                        <span class="entrainement-stat">📝 <strong>${exerciseCount}</strong> exercices</span>
                        <span class="entrainement-stat">⏱️ <strong>~${entrainement.duree_estimee || 15}</strong> min</span>
                        <span class="entrainement-stat">👥 <strong>${participations}</strong> participations</span>
                    </div>
                    ${formats.length > 0 ? `
                        <div class="entrainement-card-formats">
                            ${formats.map(f => `<span class="format-tag">${this.formatNames[f] || f}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="entrainement-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="AdminEntrainements.editEntrainement('${entrainement.id}')">✏️ Modifier</button>
                        ${statusClass === 'brouillon'
                            ? `<button class="btn btn-primary btn-sm" onclick="AdminEntrainements.publishEntrainement('${entrainement.id}')">🚀 Publier</button>`
                            : `<button class="btn btn-secondary btn-sm" onclick="AdminEntrainements.previewEntrainementById('${entrainement.id}')">👁️ Aperçu</button>`
                        }
                        <button class="btn btn-icon danger" onclick="AdminEntrainements.confirmDelete('${entrainement.id}')" title="Supprimer">✕</button>
                    </div>
                </div>
            </div>
        `;
    },

    async publishEntrainement(id) {
        try {
            const result = await this.callAPI('updateEntrainement', { id, statut: 'publie' });
            if (result.success) {
                await this.loadData();
                this.renderEntrainements();
                this.updateStats();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur publication:', error);
            alert('Erreur lors de la publication');
        }
    },

    // ========== STATS ==========
    updateStats() {
        const total = this.entrainements.length;
        const publies = this.entrainements.filter(e => e.statut === 'publie').length;
        const brouillons = this.entrainements.filter(e => e.statut === 'brouillon').length;
        const connaissances = this.entrainements.filter(e => e.niveau === 'connaissances').length;
        const savoirFaire = this.entrainements.filter(e => e.niveau === 'savoir-faire').length;
        const competences = this.entrainements.filter(e => e.niveau === 'competences').length;

        // Calculate total participations (placeholder - would come from results data)
        const participations = this.entrainements.reduce((sum, e) => sum + (parseInt(e.participations) || 0), 0);

        // Update stat cards
        document.getElementById('statTotal').textContent = total;
        document.getElementById('statPublies').textContent = publies;
        document.getElementById('statBrouillons').textContent = brouillons;
        document.getElementById('statParticipations').textContent = participations;

        // Update tab counts
        document.getElementById('countAll').textContent = total;
        document.getElementById('countConnaissances').textContent = connaissances;
        document.getElementById('countSavoirFaire').textContent = savoirFaire;
        document.getElementById('countCompetences').textContent = competences;
    },

    // ========== MODAL / WIZARD ==========
    openModal(entrainement = null) {
        const modal = document.getElementById('entrainementModal');
        const title = document.getElementById('entrainementModalTitle');

        // Reset wizard
        this.currentStep = 1;
        this.composedExercises = [];
        this.composedEtapes = [];
        this.updateWizardUI();

        // Populate disciplines
        this.populateDisciplines();

        if (entrainement) {
            title.textContent = 'Modifier l\'entrainement';
            document.getElementById('editEntrainementId').value = entrainement.id;
            document.getElementById('entrainementTitre').value = entrainement.titre || '';
            document.getElementById('entrainementType').value = entrainement.niveau || 'connaissances';
            document.getElementById('entrainementOrdre').value = entrainement.ordre || 1;
            document.getElementById('entrainementDescription').value = entrainement.description || '';
            document.getElementById('entrainementDuree').value = entrainement.duree_estimee || 15;
            document.getElementById('entrainementStatut').value = entrainement.statut || 'brouillon';

            // Load chapter selection
            if (entrainement.chapitre_id) {
                const chap = this.chapitres.find(c => c.id === entrainement.chapitre_id);
                if (chap && chap.theme_id) {
                    const theme = this.themes.find(t => t.id === chap.theme_id);
                    if (theme) {
                        document.getElementById('entrainementDiscipline').value = theme.discipline_id;
                        this.onDisciplineChange(theme.discipline_id, () => {
                            document.getElementById('entrainementTheme').value = theme.id;
                            this.onThemeChange(theme.id, () => {
                                document.getElementById('entrainementChapitre').value = entrainement.chapitre_id;
                            });
                        });
                    }
                }
            }

            // Load composed exercises ou étapes selon le type
            const exercises = this.entrainementQuestions.filter(eq => eq.entrainement_id === entrainement.id);

            if (entrainement.niveau === 'connaissances') {
                // Charger les étapes de connaissances
                // Group by type de question
                const groupedEtapes = {};
                exercises.forEach(ex => {
                    const key = `${ex.banque_id || ''}_${ex.question_type || ''}`;
                    if (!groupedEtapes[key]) {
                        const banque = this.banquesQuestions.find(b => b.id === ex.banque_id);
                        groupedEtapes[key] = {
                            banque_id: ex.banque_id,
                            banque_titre: banque?.titre || 'Banque',
                            type: ex.question_type,
                            count: 0,
                            mode: ex.question_id ? 'manual' : 'random',
                            questions: []
                        };
                    }
                    groupedEtapes[key].count++;
                    if (ex.question_id) groupedEtapes[key].questions.push(ex.question_id);
                });
                this.composedEtapes = Object.values(groupedEtapes);
            } else {
                // Load composed exercises standard
                this.composedExercises = exercises.map(ex => ({
                    format_id: ex.format_id,
                    count: 1,
                    mode: ex.question_id ? 'manual' : 'random',
                    questions: ex.question_id ? [ex.question_id] : []
                }));
                // Group by format
                const grouped = {};
                exercises.forEach(ex => {
                    const key = ex.format_id;
                    if (!grouped[key]) {
                        grouped[key] = { format_id: key, count: 0, mode: 'manual', questions: [] };
                    }
                    grouped[key].count++;
                    if (ex.question_id) grouped[key].questions.push(ex.question_id);
                });
                this.composedExercises = Object.values(grouped);
            }

            // Afficher la bonne interface selon le type
            this.onTypeChange(entrainement.niveau || 'connaissances');
        } else {
            title.textContent = 'Creer un entrainement';
            document.getElementById('editEntrainementId').value = '';
            document.getElementById('entrainementTitre').value = '';
            document.getElementById('entrainementType').value = 'connaissances';
            document.getElementById('entrainementOrdre').value = 1;
            document.getElementById('entrainementDescription').value = '';
            document.getElementById('entrainementDuree').value = 15;
            document.getElementById('entrainementStatut').value = 'brouillon';
            document.getElementById('entrainementDiscipline').value = '';
            document.getElementById('entrainementTheme').innerHTML = '<option value="">Selectionner d\'abord une discipline...</option>';
            document.getElementById('entrainementTheme').disabled = true;
            document.getElementById('entrainementChapitre').innerHTML = '<option value="">Selectionner d\'abord un theme...</option>';
            document.getElementById('entrainementChapitre').disabled = true;

            // Par défaut, afficher l'interface connaissances
            this.onTypeChange('connaissances');
        }

        this.renderExercisesList();
        this.renderEtapesList();
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('entrainementModal').classList.add('hidden');
    },

    populateDisciplines() {
        const select = document.getElementById('entrainementDiscipline');
        select.innerHTML = '<option value="">Selectionner...</option>' +
            this.disciplines.map(d => `<option value="${d.id}">${this.escapeHtml(d.nom || d.id)}</option>`).join('');
    },

    onDisciplineChange(disciplineId, callback) {
        const themeSelect = document.getElementById('entrainementTheme');
        const chapitreSelect = document.getElementById('entrainementChapitre');

        if (!disciplineId) {
            themeSelect.innerHTML = '<option value="">Selectionner d\'abord une discipline...</option>';
            themeSelect.disabled = true;
            chapitreSelect.innerHTML = '<option value="">Selectionner d\'abord un theme...</option>';
            chapitreSelect.disabled = true;
            return;
        }

        const themes = this.themes.filter(t => t.discipline_id === disciplineId);
        themeSelect.innerHTML = '<option value="">Selectionner un theme...</option>' +
            themes.map(t => `<option value="${t.id}">${this.escapeHtml(t.nom || t.id)}</option>`).join('');
        themeSelect.disabled = false;

        chapitreSelect.innerHTML = '<option value="">Selectionner d\'abord un theme...</option>';
        chapitreSelect.disabled = true;

        if (callback) setTimeout(callback, 0);
    },

    onThemeChange(themeId, callback) {
        const chapitreSelect = document.getElementById('entrainementChapitre');

        if (!themeId) {
            chapitreSelect.innerHTML = '<option value="">Selectionner d\'abord un theme...</option>';
            chapitreSelect.disabled = true;
            return;
        }

        const chapitres = this.chapitres.filter(c => c.theme_id === themeId);
        chapitreSelect.innerHTML = '<option value="">Selectionner un chapitre...</option>' +
            chapitres.map(c => `<option value="${c.id}">${this.escapeHtml(c.titre || c.id)}</option>`).join('');
        chapitreSelect.disabled = false;

        if (callback) setTimeout(callback, 0);
    },

    // ========== WIZARD NAVIGATION ==========
    updateWizardUI() {
        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');
            if (stepNum === this.currentStep) {
                step.classList.add('active');
            } else if (stepNum < this.currentStep) {
                step.classList.add('completed');
            }
        });

        // Show/hide content
        document.querySelectorAll('.wizard-content').forEach((content, i) => {
            content.style.display = (i + 1) === this.currentStep ? 'block' : 'none';
        });

        // Update buttons
        document.getElementById('prevStepBtn').style.display = this.currentStep > 1 ? 'inline-flex' : 'none';
        document.getElementById('nextStepBtn').style.display = this.currentStep < 3 ? 'inline-flex' : 'none';
        document.getElementById('publishBtn').style.display = this.currentStep === 3 ? 'inline-flex' : 'none';
    },

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateWizardUI();
        }
    },

    nextStep() {
        if (this.currentStep === 1 && !this.validateStep1()) return;
        if (this.currentStep === 2) {
            this.updateRecap();
        }

        if (this.currentStep < 3) {
            this.currentStep++;
            this.updateWizardUI();

            // Load elements when entering step 2
            if (this.currentStep === 2) {
                this.updateAvailableElements();
            }
        }
    },

    validateStep1() {
        const titre = document.getElementById('entrainementTitre').value.trim();
        const chapitre = document.getElementById('entrainementChapitre').value;

        if (!titre) {
            alert('Veuillez saisir un titre');
            return false;
        }
        if (!chapitre) {
            alert('Veuillez selectionner un chapitre');
            return false;
        }
        return true;
    },

    // ========== STEP 2: EXERCISES ==========
    toggleManualSelection(show) {
        const container = document.getElementById('elementsAvailable');
        container.style.display = show ? 'block' : 'none';
        if (show) {
            this.updateAvailableElements();
        }
    },

    updateAvailableElements() {
        const chapitreId = document.getElementById('entrainementChapitre').value;
        const formatId = document.getElementById('exerciseFormat').value;
        const isManual = document.querySelector('input[name="selectionMode"]:checked')?.value === 'manual';

        if (!isManual) return;

        // Convertir format_id en type pour filtrer les éléments de la banque
        const elementType = this.formatToType[formatId];

        // Filter questions by chapter and type (pas format_id)
        const available = this.questions.filter(q =>
            q.chapitre_id === chapitreId && q.type === elementType
        );

        document.getElementById('availableCount').textContent = available.length;

        const container = document.getElementById('elementsCheckboxes');
        if (available.length === 0) {
            container.innerHTML = '<p style="padding: 16px; color: var(--gray-500); text-align: center;">Aucun élément disponible pour ce format</p>';
        } else {
            container.innerHTML = available.map(q => `
                <label class="element-checkbox">
                    <input type="checkbox" value="${q.id}">
                    <span class="element-checkbox-label">${this.escapeHtml(q.contenu?.substring(0, 80) || 'Sans contenu')}${q.contenu?.length > 80 ? '...' : ''}</span>
                </label>
            `).join('');
        }
    },

    addExercise() {
        const formatId = document.getElementById('exerciseFormat').value;
        const count = parseInt(document.getElementById('exerciseCount').value) || 5;
        const mode = document.querySelector('input[name="selectionMode"]:checked')?.value || 'random';

        let questions = [];
        if (mode === 'manual') {
            questions = Array.from(document.querySelectorAll('#elementsCheckboxes input:checked'))
                .map(cb => cb.value);
            if (questions.length === 0) {
                alert('Veuillez selectionner au moins un element');
                return;
            }
        }

        this.composedExercises.push({
            format_id: formatId,
            count: mode === 'manual' ? questions.length : count,
            mode: mode,
            questions: questions
        });

        this.renderExercisesList();

        // Reset form
        document.getElementById('exerciseCount').value = 5;
        document.querySelector('input[name="selectionMode"][value="random"]').checked = true;
        this.toggleManualSelection(false);
    },

    removeExercise(index) {
        this.composedExercises.splice(index, 1);
        this.renderExercisesList();
    },

    renderExercisesList() {
        const container = document.getElementById('exercisesList');
        const empty = document.getElementById('exercisesEmpty');
        const countEl = document.getElementById('exercisesCount');

        if (this.composedExercises.length === 0) {
            container.innerHTML = '';
            empty.style.display = 'block';
            countEl.textContent = '0 exercices';
        } else {
            empty.style.display = 'none';
            countEl.textContent = `${this.composedExercises.length} exercices`;

            container.innerHTML = this.composedExercises.map((ex, i) => `
                <div class="exercise-item">
                    <div class="exercise-info">
                        <div class="exercise-format">${this.formatNames[ex.format_id] || ex.format_id}</div>
                        <div class="exercise-details">${ex.count} elements - ${ex.mode === 'random' ? 'Aleatoire' : 'Manuel'}</div>
                    </div>
                    <button class="exercise-remove" onclick="AdminEntrainements.removeExercise(${i})">X</button>
                </div>
            `).join('');
        }
    },

    // ========== STEP 3: RECAP ==========
    updateRecap() {
        const titre = document.getElementById('entrainementTitre').value;
        const type = document.getElementById('entrainementType').value;
        const chapitreId = document.getElementById('entrainementChapitre').value;
        const duree = document.getElementById('entrainementDuree').value;
        const statut = document.getElementById('entrainementStatut').value;

        const chapitre = this.chapitres.find(c => c.id === chapitreId);

        // Type labels
        const typeLabels = {
            'connaissances': 'Connaissances',
            'savoir-faire': 'Savoir-faire',
            'competences': 'Compétences'
        };

        document.getElementById('recapTitre').textContent = titre || '-';
        document.getElementById('recapType').textContent = typeLabels[type] || type || '-';
        document.getElementById('recapChapitre').textContent = chapitre?.titre || '-';
        document.getElementById('recapDuree').textContent = `${duree || 15} min`;
        document.getElementById('recapStatut').textContent = statut || 'brouillon';

        const exercisesContainer = document.getElementById('recapExercises');

        if (type === 'connaissances') {
            // Récapitulatif des étapes de connaissances
            if (this.composedEtapes.length === 0) {
                exercisesContainer.innerHTML = '<p style="color: var(--gray-500);">Aucune étape composée</p>';
            } else {
                exercisesContainer.innerHTML = this.composedEtapes.map((etape, i) => `
                    <div class="recap-exercise">
                        <span class="recap-exercise-name">Étape ${i + 1}: ${this.questionTypeNames[etape.type] || etape.type}</span>
                        <span class="recap-exercise-count">${etape.count} questions</span>
                    </div>
                `).join('');
            }
        } else {
            // Récapitulatif des exercices standard
            if (this.composedExercises.length === 0) {
                exercisesContainer.innerHTML = '<p style="color: var(--gray-500);">Aucun exercice compose</p>';
            } else {
                exercisesContainer.innerHTML = this.composedExercises.map(ex => `
                    <div class="recap-exercise">
                        <span class="recap-exercise-name">${this.formatNames[ex.format_id] || ex.format_id}</span>
                        <span class="recap-exercise-count">${ex.count} elements</span>
                    </div>
                `).join('');
            }
        }
    },

    previewEntrainement() {
        const entrainementId = document.getElementById('editEntrainementId').value;
        if (entrainementId) {
            window.open(`../eleve/entrainement.html?id=${entrainementId}&preview=true`, '_blank');
        } else {
            alert('Enregistrez d\'abord l\'entrainement pour le previsualiser');
        }
    },

    previewEntrainementById(id) {
        window.open(`../eleve/entrainement.html?id=${id}&preview=true`, '_blank');
    },

    // ========== SAVE ==========
    async saveEntrainement(statut) {
        const id = document.getElementById('editEntrainementId').value;
        const titre = document.getElementById('entrainementTitre').value.trim();
        const type = document.getElementById('entrainementType').value;
        const ordre = document.getElementById('entrainementOrdre').value;
        const chapitreId = document.getElementById('entrainementChapitre').value;
        const description = document.getElementById('entrainementDescription').value.trim();
        const duree = document.getElementById('entrainementDuree').value;

        if (!titre) {
            alert('Veuillez saisir un titre');
            return;
        }
        if (!chapitreId) {
            alert('Veuillez selectionner un chapitre');
            return;
        }

        // Validation selon le type
        if (type === 'connaissances' && this.composedEtapes.length === 0) {
            alert('Veuillez ajouter au moins une étape');
            return;
        }
        if (type !== 'connaissances' && this.composedExercises.length === 0) {
            alert('Veuillez ajouter au moins un exercice');
            return;
        }

        const data = {
            titre,
            niveau: type,
            ordre: parseInt(ordre) || 1,
            chapitre_id: chapitreId,
            description,
            duree_estimee: parseInt(duree) || 15,
            statut: statut || 'brouillon'
        };

        try {
            // Disable buttons
            const buttons = document.querySelectorAll('.modal-footer .btn');
            buttons.forEach(b => b.disabled = true);

            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateEntrainement', data);
            } else {
                result = await this.callAPI('createEntrainement', data);
            }

            if (result.success) {
                const entrainementId = result.id || id;

                // Save exercises ou étapes selon le type
                if (type === 'connaissances') {
                    await this.saveEtapes(entrainementId);
                } else {
                    await this.saveExercises(entrainementId);
                }

                this.closeModal();
                await this.loadData();
                this.renderEntrainements();
                this.updateStats();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            const buttons = document.querySelectorAll('.modal-footer .btn');
            buttons.forEach(b => b.disabled = false);
        }
    },

    async saveExercises(entrainementId) {
        // Delete existing questions for this entrainement first
        const existingQuestions = this.entrainementQuestions.filter(eq => eq.entrainement_id === entrainementId);
        for (const eq of existingQuestions) {
            try {
                await this.callAPI('deleteEntrainementQuestion', { id: eq.id });
            } catch (e) {
                console.warn('Could not delete question:', e);
            }
        }

        // Add new questions
        let ordre = 1;
        for (const exercise of this.composedExercises) {
            if (exercise.mode === 'manual' && exercise.questions.length > 0) {
                // Manual selection - use specific questions
                for (const questionId of exercise.questions) {
                    await this.callAPI('createEntrainementQuestion', {
                        entrainement_id: entrainementId,
                        question_id: questionId,
                        format_id: exercise.format_id,
                        ordre: ordre++
                    });
                }
            } else {
                // Random selection - just store the format and count
                for (let i = 0; i < exercise.count; i++) {
                    await this.callAPI('createEntrainementQuestion', {
                        entrainement_id: entrainementId,
                        question_id: '', // Empty = random selection at runtime
                        format_id: exercise.format_id,
                        ordre: ordre++
                    });
                }
            }
        }
    },

    async saveEtapes(entrainementId) {
        // Delete existing questions for this entrainement first
        const existingQuestions = this.entrainementQuestions.filter(eq => eq.entrainement_id === entrainementId);
        for (const eq of existingQuestions) {
            try {
                await this.callAPI('deleteEntrainementQuestion', { id: eq.id });
            } catch (e) {
                console.warn('Could not delete question:', e);
            }
        }

        // Add new étapes (questions de connaissances)
        let ordre = 1;
        for (const etape of this.composedEtapes) {
            if (etape.mode === 'manual' && etape.questions.length > 0) {
                // Manual selection - use specific questions
                for (const questionId of etape.questions) {
                    await this.callAPI('createEntrainementQuestion', {
                        entrainement_id: entrainementId,
                        question_id: questionId,
                        banque_id: etape.banque_id,
                        question_type: etape.type,
                        ordre: ordre++
                    });
                }
            } else {
                // Random selection - store banque and type with count
                for (let i = 0; i < etape.count; i++) {
                    await this.callAPI('createEntrainementQuestion', {
                        entrainement_id: entrainementId,
                        question_id: '', // Empty = random selection at runtime
                        banque_id: etape.banque_id,
                        question_type: etape.type,
                        ordre: ordre++
                    });
                }
            }
        }
    },

    // ========== EDIT / DELETE ==========
    editEntrainement(id) {
        const entrainement = this.entrainements.find(e => e.id === id);
        if (entrainement) {
            this.openModal(entrainement);
        }
    },

    confirmDelete(id) {
        document.getElementById('deleteEntrainementId').value = id;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async deleteEntrainement() {
        const id = document.getElementById('deleteEntrainementId').value;

        try {
            document.getElementById('confirmDeleteBtn').disabled = true;
            document.getElementById('confirmDeleteBtn').textContent = 'Suppression...';

            const result = await this.callAPI('deleteEntrainement', { id });

            if (result.success) {
                this.closeDeleteModal();
                await this.loadData();
                this.renderEntrainements();
                this.updateStats();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        } finally {
            document.getElementById('confirmDeleteBtn').disabled = false;
            document.getElementById('confirmDeleteBtn').textContent = 'Supprimer';
        }
    },

    // ========== API ==========
    async callAPI(action, data = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        return new Promise((resolve, reject) => {
            const callbackName = 'adminEntrainementsCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = (response) => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(response);
            };

            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur reseau'));
            };

            Object.keys(data).forEach(key => {
                url.searchParams.set(key, data[key]);
            });

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    },

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AdminEntrainements.init();
    }, 100);
});

window.AdminEntrainements = AdminEntrainements;
