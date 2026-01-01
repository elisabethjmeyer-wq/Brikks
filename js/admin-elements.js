/**
 * Admin Elements - Banque d'elements
 * Gestion des questions et elements d'entrainement
 */

const AdminElements = {
    // Data
    elements: [],
    disciplines: [],
    themes: [],
    chapitres: [],
    tags: [],
    formats: [],

    // Filters
    filters: {
        search: '',
        chapitre: '',
        format: '',
        difficulte: ''
    },

    // Pagination
    currentPage: 1,
    itemsPerPage: 10,

    // Format icons mapping
    formatIcons: {
        'format_001': '?',
        'format_002': '?',
        'format_003': 'V/F',
        'format_004': '_',
        'format_005': '<->',
        'format_006': '123',
        'format_007': 'Txt',
        'format_008': 'Img'
    },

    formatNames: {
        'format_001': 'QCM',
        'format_002': 'QCM Multiple',
        'format_003': 'Vrai/Faux',
        'format_004': 'Texte a trous',
        'format_005': 'Association',
        'format_006': 'Ordonner',
        'format_007': 'Question ouverte',
        'format_008': 'Image cliquable'
    },

    formatClasses: {
        'format_001': 'qcm',
        'format_002': 'qcm',
        'format_003': 'qcm',
        'format_004': 'trous',
        'format_005': 'association',
        'format_006': 'ordonner',
        'format_007': 'question-ouverte',
        'format_008': 'image-cliquable'
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderChaptersTree();
            this.renderElements();
            this.updateStats();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    async loadData() {
        // Load all data in parallel
        const [
            disciplinesData,
            themesData,
            chapitresData,
            questionsData,
            tagsData
        ] = await Promise.all([
            SheetsAPI.getSheetData('DISCIPLINES'),
            SheetsAPI.getSheetData('THEMES'),
            SheetsAPI.getSheetData('CHAPITRES'),
            SheetsAPI.getSheetData('QUESTIONS'),
            SheetsAPI.getSheetData('TAGS')
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.elements = SheetsAPI.parseSheetData(questionsData);
        this.tags = SheetsAPI.parseSheetData(tagsData);

        // Parse donnees JSON for each element
        this.elements = this.elements.map(el => {
            if (el.donnees && typeof el.donnees === 'string') {
                try {
                    el.donnees = JSON.parse(el.donnees);
                } catch (e) {
                    el.donnees = {};
                }
            }
            return el;
        });
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('elements-content').style.display = 'block';
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
        // Add element button
        document.getElementById('addElementBtn').addEventListener('click', () => this.openModal());

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.renderElements();
        });

        // Filter by format
        document.getElementById('filterFormat').addEventListener('change', (e) => {
            this.filters.format = e.target.value;
            this.currentPage = 1;
            this.renderElements();
        });

        // Filter by difficulty
        document.getElementById('filterDifficulte').addEventListener('change', (e) => {
            this.filters.difficulte = e.target.value;
            this.currentPage = 1;
            this.renderElements();
        });

        // Clear chapter filter
        document.getElementById('clearChapterFilter').addEventListener('click', () => {
            this.filters.chapitre = '';
            document.getElementById('selectedChapterName').textContent = 'Tous les chapitres';
            document.getElementById('clearChapterFilter').style.display = 'none';
            document.querySelectorAll('.tree-chapter').forEach(el => el.classList.remove('active'));
            this.currentPage = 1;
            this.renderElements();
        });

        // Modal events
        document.getElementById('closeElementModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelElementBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveElementBtn').addEventListener('click', () => this.saveElement());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteElement());

        // Format change in modal
        document.getElementById('elementFormat').addEventListener('change', (e) => {
            this.renderFormatFields(e.target.value);
        });

        // Discipline change - load themes
        document.getElementById('elementDiscipline').addEventListener('change', (e) => {
            this.onDisciplineChange(e.target.value);
        });

        // Theme change - load chapters
        document.getElementById('elementTheme').addEventListener('change', (e) => {
            this.onThemeChange(e.target.value);
        });

        // Close modal on overlay click
        document.getElementById('elementModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });

        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeDeleteModal();
            }
        });
    },

    // ========== CHAPTERS TREE ==========
    renderChaptersTree() {
        const container = document.getElementById('chaptersTree');

        // Group by discipline
        const tree = {};

        this.disciplines.forEach(disc => {
            tree[disc.id] = {
                ...disc,
                themes: {}
            };
        });

        // Add themes to disciplines
        this.themes.forEach(theme => {
            if (tree[theme.discipline_id]) {
                tree[theme.discipline_id].themes[theme.id] = {
                    ...theme,
                    chapitres: []
                };
            }
        });

        // Add chapters to themes
        this.chapitres.forEach(chap => {
            if (chap.theme_id) {
                const disc = Object.values(tree).find(d => d.themes[chap.theme_id]);
                if (disc && disc.themes[chap.theme_id]) {
                    // Count elements for this chapter
                    const count = this.elements.filter(el => el.chapitre_id === chap.id).length;
                    disc.themes[chap.theme_id].chapitres.push({
                        ...chap,
                        elementCount: count
                    });
                }
            }
        });

        // Render HTML
        let html = '';

        Object.values(tree).forEach(disc => {
            const themeCount = Object.keys(disc.themes).length;
            if (themeCount === 0) return;

            html += `
                <div class="tree-discipline" data-id="${disc.id}">
                    <div class="tree-discipline-header" onclick="AdminElements.toggleDiscipline('${disc.id}')">
                        <span class="toggle-icon">></span>
                        <span>${this.escapeHtml(disc.nom || disc.id)}</span>
                    </div>
                    <div class="tree-discipline-content">
            `;

            Object.values(disc.themes).forEach(theme => {
                html += `
                    <div class="tree-theme" data-id="${theme.id}">
                        <div class="tree-theme-header" onclick="AdminElements.toggleTheme('${theme.id}')">
                            <span class="toggle-icon">></span>
                            <span>${this.escapeHtml(theme.nom || theme.id)}</span>
                        </div>
                        <div class="tree-theme-content">
                `;

                theme.chapitres.forEach(chap => {
                    html += `
                        <div class="tree-chapter" data-id="${chap.id}" onclick="AdminElements.selectChapter('${chap.id}')">
                            <span>${this.escapeHtml(chap.titre || chap.id)}</span>
                            <span class="count">${chap.elementCount}</span>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.innerHTML = html || '<p style="padding: 16px; color: var(--gray-500);">Aucun chapitre</p>';
    },

    toggleDiscipline(id) {
        const el = document.querySelector(`.tree-discipline[data-id="${id}"]`);
        if (el) {
            el.classList.toggle('expanded');
        }
    },

    toggleTheme(id) {
        const el = document.querySelector(`.tree-theme[data-id="${id}"]`);
        if (el) {
            el.classList.toggle('expanded');
        }
    },

    selectChapter(id) {
        // Update filter
        this.filters.chapitre = id;
        this.currentPage = 1;

        // Update UI
        document.querySelectorAll('.tree-chapter').forEach(el => el.classList.remove('active'));
        document.querySelector(`.tree-chapter[data-id="${id}"]`)?.classList.add('active');

        // Update chapter bar
        const chapitre = this.chapitres.find(c => c.id === id);
        document.getElementById('selectedChapterName').textContent = chapitre?.titre || id;
        document.getElementById('clearChapterFilter').style.display = 'inline-block';

        this.renderElements();
    },

    // ========== ELEMENTS LIST ==========
    renderElements() {
        const container = document.getElementById('elementsList');
        const emptyState = document.getElementById('emptyState');

        // Filter elements
        let filtered = this.elements.filter(el => {
            // Search filter
            if (this.filters.search) {
                const searchIn = `${el.enonce || ''} ${el.tags || ''}`.toLowerCase();
                if (!searchIn.includes(this.filters.search)) return false;
            }

            // Chapter filter
            if (this.filters.chapitre && el.chapitre_id !== this.filters.chapitre) {
                return false;
            }

            // Format filter
            if (this.filters.format && el.format_id !== this.filters.format) {
                return false;
            }

            // Difficulty filter
            if (this.filters.difficulte && el.difficulte !== this.filters.difficulte) {
                return false;
            }

            return true;
        });

        // Pagination
        const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const paginated = filtered.slice(start, start + this.itemsPerPage);

        // Render
        if (paginated.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = paginated.map(el => this.renderElementCard(el)).join('');
        }

        // Update pagination
        this.renderPagination(filtered.length, totalPages);
    },

    renderElementCard(element) {
        const formatClass = this.formatClasses[element.format_id] || 'qcm';
        const formatIcon = this.formatIcons[element.format_id] || '?';
        const formatName = this.formatNames[element.format_id] || element.format_id;

        // Get chapter name
        const chapitre = this.chapitres.find(c => c.id === element.chapitre_id);
        const chapitreName = chapitre?.titre || element.chapitre_id || 'Non defini';

        // Parse tags
        const tags = element.tags ? element.tags.split(',').map(t => t.trim()).filter(t => t) : [];

        return `
            <div class="element-card" data-id="${element.id}">
                <div class="element-format-icon ${formatClass}">${formatIcon}</div>
                <div class="element-content">
                    <div class="element-header">
                        <div class="element-enonce">${this.escapeHtml(element.enonce || 'Sans enonce')}</div>
                    </div>
                    <div class="element-meta">
                        <span class="element-badge format">${formatName}</span>
                        <span class="element-badge difficulte-${element.difficulte || 'facile'}">${element.difficulte || 'Facile'}</span>
                        <span class="element-chapter">${this.escapeHtml(chapitreName)}</span>
                    </div>
                    ${tags.length > 0 ? `
                        <div class="element-tags">
                            ${tags.slice(0, 5).map(t => `<span class="element-tag">${this.escapeHtml(t)}</span>`).join('')}
                            ${tags.length > 5 ? `<span class="element-tag">+${tags.length - 5}</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="element-actions">
                    <button class="btn-icon" onclick="AdminElements.editElement('${element.id}')" title="Modifier">E</button>
                    <button class="btn-icon danger" onclick="AdminElements.confirmDelete('${element.id}')" title="Supprimer">X</button>
                </div>
            </div>
        `;
    },

    renderPagination(total, totalPages) {
        const info = document.getElementById('paginationInfo');
        const pagination = document.getElementById('pagination');

        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, total);

        info.textContent = total === 0 ? '0 elements' : `${start}-${end} sur ${total} elements`;

        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let html = `
            <button onclick="AdminElements.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}><</button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="AdminElements.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                html += `<button disabled>...</button>`;
            }
        }

        html += `
            <button onclick="AdminElements.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>></button>
        `;

        pagination.innerHTML = html;
    },

    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredElements().length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderElements();
    },

    getFilteredElements() {
        return this.elements.filter(el => {
            if (this.filters.search) {
                const searchIn = `${el.enonce || ''} ${el.tags || ''}`.toLowerCase();
                if (!searchIn.includes(this.filters.search)) return false;
            }
            if (this.filters.chapitre && el.chapitre_id !== this.filters.chapitre) return false;
            if (this.filters.format && el.format_id !== this.filters.format) return false;
            if (this.filters.difficulte && el.difficulte !== this.filters.difficulte) return false;
            return true;
        });
    },

    // ========== STATS ==========
    updateStats() {
        document.getElementById('statTotal').textContent = this.elements.length;

        const qcmCount = this.elements.filter(el =>
            ['format_001', 'format_002', 'format_003'].includes(el.format_id)
        ).length;
        document.getElementById('statQCM').textContent = qcmCount;

        const timelineCount = this.elements.filter(el =>
            ['format_006'].includes(el.format_id)
        ).length;
        document.getElementById('statTimeline').textContent = timelineCount;

        const associationCount = this.elements.filter(el =>
            ['format_005'].includes(el.format_id)
        ).length;
        document.getElementById('statAssociation').textContent = associationCount;
    },

    // ========== MODAL ==========
    openModal(element = null) {
        const modal = document.getElementById('elementModal');
        const title = document.getElementById('elementModalTitle');

        // Populate disciplines
        this.populateDisciplines();

        if (element) {
            title.textContent = 'Modifier l\'element';
            document.getElementById('editElementId').value = element.id;
            document.getElementById('elementFormat').value = element.format_id || '';
            document.getElementById('elementDifficulte').value = element.difficulte || 'facile';
            document.getElementById('elementEnonce').value = element.enonce || '';
            document.getElementById('elementTags').value = element.tags || '';
            document.getElementById('elementExplication').value = element.explication || '';

            // Set discipline, theme, chapter
            if (element.chapitre_id) {
                const chap = this.chapitres.find(c => c.id === element.chapitre_id);
                if (chap && chap.theme_id) {
                    const theme = this.themes.find(t => t.id === chap.theme_id);
                    if (theme) {
                        document.getElementById('elementDiscipline').value = theme.discipline_id;
                        this.onDisciplineChange(theme.discipline_id, () => {
                            document.getElementById('elementTheme').value = theme.id;
                            this.onThemeChange(theme.id, () => {
                                document.getElementById('elementChapitre').value = element.chapitre_id;
                            });
                        });
                    }
                }
            }

            // Render format fields with data
            this.renderFormatFields(element.format_id, element.donnees);
        } else {
            title.textContent = 'Ajouter un element';
            document.getElementById('editElementId').value = '';
            document.getElementById('elementFormat').value = '';
            document.getElementById('elementDifficulte').value = 'facile';
            document.getElementById('elementEnonce').value = '';
            document.getElementById('elementTags').value = '';
            document.getElementById('elementExplication').value = '';
            document.getElementById('elementDiscipline').value = '';
            document.getElementById('elementTheme').innerHTML = '<option value="">Selectionner d\'abord une discipline...</option>';
            document.getElementById('elementTheme').disabled = true;
            document.getElementById('elementChapitre').innerHTML = '<option value="">Selectionner d\'abord un theme...</option>';
            document.getElementById('elementChapitre').disabled = true;
            document.getElementById('formatFields').innerHTML = '';
            document.getElementById('formatFieldsSection').style.display = 'none';
        }

        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('elementModal').classList.add('hidden');
    },

    populateDisciplines() {
        const select = document.getElementById('elementDiscipline');
        select.innerHTML = '<option value="">Selectionner...</option>' +
            this.disciplines.map(d => `<option value="${d.id}">${this.escapeHtml(d.nom || d.id)}</option>`).join('');
    },

    onDisciplineChange(disciplineId, callback) {
        const themeSelect = document.getElementById('elementTheme');
        const chapitreSelect = document.getElementById('elementChapitre');

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
        const chapitreSelect = document.getElementById('elementChapitre');

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

    // ========== FORMAT SPECIFIC FIELDS ==========
    renderFormatFields(formatId, data = {}) {
        const container = document.getElementById('formatFields');
        const section = document.getElementById('formatFieldsSection');

        if (!formatId) {
            container.innerHTML = '';
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';

        switch (formatId) {
            case 'format_001': // QCM
                container.innerHTML = this.renderQCMFields(data, false);
                break;
            case 'format_002': // QCM Multiple
                container.innerHTML = this.renderQCMFields(data, true);
                break;
            case 'format_003': // Vrai/Faux
                container.innerHTML = this.renderVraiFauxFields(data);
                break;
            case 'format_004': // Trous
                container.innerHTML = this.renderTrousFields(data);
                break;
            case 'format_005': // Association
                container.innerHTML = this.renderAssociationFields(data);
                break;
            case 'format_006': // Ordonner
                container.innerHTML = this.renderOrdonnerFields(data);
                break;
            case 'format_007': // Question ouverte
                container.innerHTML = this.renderQuestionOuverteFields(data);
                break;
            case 'format_008': // Image cliquable
                container.innerHTML = this.renderImageCliquableFields(data);
                break;
            default:
                container.innerHTML = '<p>Format non supporte</p>';
        }
    },

    renderQCMFields(data, multiple) {
        const options = data.options || ['', '', '', ''];
        const correctIndex = data.reponse_correcte ?? 0;
        const correctIndices = data.reponses_correctes || [];

        const inputType = multiple ? 'checkbox' : 'radio';

        return `
            <div class="form-group">
                <label>Options de reponse <span class="req">*</span></label>
                <div class="options-list" id="optionsList">
                    ${options.map((opt, i) => `
                        <div class="option-item">
                            <input type="${inputType}" name="correctOption" value="${i}"
                                   ${multiple ? (correctIndices.includes(i) ? 'checked' : '') : (i === correctIndex ? 'checked' : '')}>
                            <input type="text" class="form-input option-text" value="${this.escapeHtml(opt)}" placeholder="Option ${i + 1}">
                            <button type="button" class="btn-remove-option" onclick="AdminElements.removeOption(${i})">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-option" onclick="AdminElements.addOption()">+ Ajouter une option</button>
                <div class="form-help">${multiple ? 'Cochez les bonnes reponses' : 'Selectionnez la bonne reponse'}</div>
            </div>
        `;
    },

    renderVraiFauxFields(data) {
        const correct = data.reponse_correcte ?? true;
        return `
            <div class="form-group">
                <label>Reponse correcte <span class="req">*</span></label>
                <div style="display: flex; gap: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="vraiFaux" value="true" ${correct === true ? 'checked' : ''}>
                        Vrai
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="vraiFaux" value="false" ${correct === false ? 'checked' : ''}>
                        Faux
                    </label>
                </div>
            </div>
        `;
    },

    renderTrousFields(data) {
        const texte = data.texte || '';
        const trous = data.trous || [];

        return `
            <div class="form-group">
                <label>Texte avec trous <span class="req">*</span></label>
                <textarea class="form-textarea" id="trousTexte" rows="4" placeholder="Utilisez {0}, {1}, etc. pour marquer les trous">${this.escapeHtml(texte)}</textarea>
                <div class="form-help">Exemple: "La Revolution francaise a commence en {0} avec la prise de {1}."</div>
            </div>
            <div class="form-group">
                <label>Reponses pour les trous</label>
                <div class="options-list" id="trousList">
                    ${trous.length > 0 ? trous.map((t, i) => `
                        <div class="option-item">
                            <span style="min-width: 30px;">{${i}}</span>
                            <input type="text" class="form-input trou-reponse" value="${this.escapeHtml(t.reponse || '')}" placeholder="Reponse">
                            <input type="text" class="form-input trou-indice" value="${this.escapeHtml(t.indice || '')}" placeholder="Indice (optionnel)" style="max-width: 150px;">
                        </div>
                    `).join('') : `
                        <div class="option-item">
                            <span style="min-width: 30px;">{0}</span>
                            <input type="text" class="form-input trou-reponse" value="" placeholder="Reponse">
                            <input type="text" class="form-input trou-indice" value="" placeholder="Indice (optionnel)" style="max-width: 150px;">
                        </div>
                    `}
                </div>
                <button type="button" class="btn-add-option" onclick="AdminElements.addTrou()">+ Ajouter un trou</button>
            </div>
        `;
    },

    renderAssociationFields(data) {
        const paires = data.paires || [{ gauche: '', droite: '' }];

        return `
            <div class="form-group">
                <label>Paires a associer <span class="req">*</span></label>
                <div class="pairs-list" id="pairsList">
                    ${paires.map((p, i) => `
                        <div class="pair-item">
                            <input type="text" class="form-input pair-gauche" value="${this.escapeHtml(p.gauche || '')}" placeholder="Element gauche">
                            <span class="pair-separator"><-></span>
                            <input type="text" class="form-input pair-droite" value="${this.escapeHtml(p.droite || '')}" placeholder="Element droite">
                            <button type="button" class="btn-remove-option" onclick="AdminElements.removePair(${i})">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-option" onclick="AdminElements.addPair()">+ Ajouter une paire</button>
            </div>
        `;
    },

    renderOrdonnerFields(data) {
        const elements = data.elements || [''];

        return `
            <div class="form-group">
                <label>Elements a ordonner <span class="req">*</span></label>
                <div class="form-help" style="margin-bottom: 8px;">Entrez les elements dans l'ordre correct (du premier au dernier)</div>
                <div class="timeline-items" id="timelineList">
                    ${elements.map((el, i) => `
                        <div class="timeline-item">
                            <span style="color: var(--gray-500); font-size: 12px;">${i + 1}.</span>
                            <input type="text" class="form-input timeline-element" value="${this.escapeHtml(el)}" placeholder="Element ${i + 1}">
                            <button type="button" class="btn-remove-option" onclick="AdminElements.removeTimelineItem(${i})">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-option" onclick="AdminElements.addTimelineItem()">+ Ajouter un element</button>
            </div>
        `;
    },

    renderQuestionOuverteFields(data) {
        const motsCles = data.mots_cles || [];

        return `
            <div class="form-group">
                <label>Mots-cles attendus</label>
                <input type="text" class="form-input" id="motsCles" value="${motsCles.join(', ')}" placeholder="Ex: revolution, liberte, egalite (separes par des virgules)">
                <div class="form-help">Ces mots-cles seront recherches dans la reponse de l'eleve</div>
            </div>
        `;
    },

    renderImageCliquableFields(data) {
        const imageUrl = data.image_url || '';
        const zones = data.zones || [];

        return `
            <div class="form-group">
                <label>URL de l'image <span class="req">*</span></label>
                <input type="text" class="form-input" id="imageUrl" value="${this.escapeHtml(imageUrl)}" placeholder="https://...">
            </div>
            <div class="form-group">
                <label>Zones cliquables</label>
                <div class="form-help" style="margin-bottom: 8px;">Definissez les zones (en % de l'image)</div>
                <div id="zonesList">
                    ${zones.map((z, i) => `
                        <div class="zone-item" style="display: grid; grid-template-columns: repeat(6, 1fr) auto; gap: 8px; margin-bottom: 8px;">
                            <input type="text" class="form-input zone-id" value="${this.escapeHtml(z.id || '')}" placeholder="ID">
                            <input type="text" class="form-input zone-label" value="${this.escapeHtml(z.label || '')}" placeholder="Label">
                            <input type="number" class="form-input zone-x" value="${z.x || 0}" placeholder="X%">
                            <input type="number" class="form-input zone-y" value="${z.y || 0}" placeholder="Y%">
                            <input type="number" class="form-input zone-w" value="${z.width || 5}" placeholder="W%">
                            <input type="number" class="form-input zone-h" value="${z.height || 5}" placeholder="H%">
                            <button type="button" class="btn-remove-option" onclick="AdminElements.removeZone(${i})">X</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-add-option" onclick="AdminElements.addZone()">+ Ajouter une zone</button>
            </div>
        `;
    },

    // Add/Remove helpers for dynamic fields
    addOption() {
        const list = document.getElementById('optionsList');
        const format = document.getElementById('elementFormat').value;
        const inputType = format === 'format_002' ? 'checkbox' : 'radio';
        const count = list.children.length;

        const div = document.createElement('div');
        div.className = 'option-item';
        div.innerHTML = `
            <input type="${inputType}" name="correctOption" value="${count}">
            <input type="text" class="form-input option-text" value="" placeholder="Option ${count + 1}">
            <button type="button" class="btn-remove-option" onclick="AdminElements.removeOption(${count})">X</button>
        `;
        list.appendChild(div);
    },

    removeOption(index) {
        const list = document.getElementById('optionsList');
        if (list.children.length > 2) {
            list.children[index].remove();
            // Reindex
            Array.from(list.children).forEach((item, i) => {
                item.querySelector('input[name="correctOption"]').value = i;
                item.querySelector('.option-text').placeholder = `Option ${i + 1}`;
            });
        }
    },

    addTrou() {
        const list = document.getElementById('trousList');
        const count = list.children.length;

        const div = document.createElement('div');
        div.className = 'option-item';
        div.innerHTML = `
            <span style="min-width: 30px;">{${count}}</span>
            <input type="text" class="form-input trou-reponse" value="" placeholder="Reponse">
            <input type="text" class="form-input trou-indice" value="" placeholder="Indice (optionnel)" style="max-width: 150px;">
        `;
        list.appendChild(div);
    },

    addPair() {
        const list = document.getElementById('pairsList');
        const count = list.children.length;

        const div = document.createElement('div');
        div.className = 'pair-item';
        div.innerHTML = `
            <input type="text" class="form-input pair-gauche" value="" placeholder="Element gauche">
            <span class="pair-separator"><-></span>
            <input type="text" class="form-input pair-droite" value="" placeholder="Element droite">
            <button type="button" class="btn-remove-option" onclick="AdminElements.removePair(${count})">X</button>
        `;
        list.appendChild(div);
    },

    removePair(index) {
        const list = document.getElementById('pairsList');
        if (list.children.length > 1) {
            list.children[index].remove();
        }
    },

    addTimelineItem() {
        const list = document.getElementById('timelineList');
        const count = list.children.length;

        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
            <span style="color: var(--gray-500); font-size: 12px;">${count + 1}.</span>
            <input type="text" class="form-input timeline-element" value="" placeholder="Element ${count + 1}">
            <button type="button" class="btn-remove-option" onclick="AdminElements.removeTimelineItem(${count})">X</button>
        `;
        list.appendChild(div);
    },

    removeTimelineItem(index) {
        const list = document.getElementById('timelineList');
        if (list.children.length > 1) {
            list.children[index].remove();
            // Reindex
            Array.from(list.children).forEach((item, i) => {
                item.querySelector('span').textContent = `${i + 1}.`;
            });
        }
    },

    addZone() {
        const list = document.getElementById('zonesList');

        const div = document.createElement('div');
        div.className = 'zone-item';
        div.style.cssText = 'display: grid; grid-template-columns: repeat(6, 1fr) auto; gap: 8px; margin-bottom: 8px;';
        div.innerHTML = `
            <input type="text" class="form-input zone-id" value="" placeholder="ID">
            <input type="text" class="form-input zone-label" value="" placeholder="Label">
            <input type="number" class="form-input zone-x" value="0" placeholder="X%">
            <input type="number" class="form-input zone-y" value="0" placeholder="Y%">
            <input type="number" class="form-input zone-w" value="5" placeholder="W%">
            <input type="number" class="form-input zone-h" value="5" placeholder="H%">
            <button type="button" class="btn-remove-option" onclick="this.parentElement.remove()">X</button>
        `;
        list.appendChild(div);
    },

    removeZone(index) {
        const list = document.getElementById('zonesList');
        list.children[index]?.remove();
    },

    // ========== SAVE ELEMENT ==========
    async saveElement() {
        const id = document.getElementById('editElementId').value;
        const formatId = document.getElementById('elementFormat').value;
        const chapitreId = document.getElementById('elementChapitre').value;
        const enonce = document.getElementById('elementEnonce').value.trim();
        const tags = document.getElementById('elementTags').value.trim();
        const difficulte = document.getElementById('elementDifficulte').value;
        const explication = document.getElementById('elementExplication').value.trim();

        // Validation
        if (!formatId) {
            alert('Veuillez selectionner un format');
            return;
        }
        if (!chapitreId) {
            alert('Veuillez selectionner un chapitre');
            return;
        }
        if (!enonce) {
            alert('Veuillez saisir un enonce');
            return;
        }

        // Get format-specific data
        const donnees = this.collectFormatData(formatId);
        if (donnees === null) return; // Validation failed

        // Get discipline and theme from chapitre
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        const theme = chapitre ? this.themes.find(t => t.id === chapitre.theme_id) : null;

        const data = {
            format_id: formatId,
            discipline_id: theme?.discipline_id || '',
            theme_id: chapitre?.theme_id || '',
            chapitre_id: chapitreId,
            enonce: enonce,
            donnees: JSON.stringify(donnees),
            explication: explication,
            tags: tags,
            difficulte: difficulte
        };

        try {
            document.getElementById('saveElementBtn').disabled = true;
            document.getElementById('saveElementBtn').textContent = 'Enregistrement...';

            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateQuestion', data);
            } else {
                result = await this.callAPI('createQuestion', data);
            }

            if (result.success) {
                this.closeModal();
                await this.loadData();
                this.renderChaptersTree();
                this.renderElements();
                this.updateStats();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            document.getElementById('saveElementBtn').disabled = false;
            document.getElementById('saveElementBtn').textContent = 'Enregistrer';
        }
    },

    collectFormatData(formatId) {
        const donnees = {};

        switch (formatId) {
            case 'format_001': // QCM
            case 'format_002': // QCM Multiple
                const options = Array.from(document.querySelectorAll('.option-text')).map(el => el.value.trim());
                if (options.filter(o => o).length < 2) {
                    alert('Veuillez saisir au moins 2 options');
                    return null;
                }
                donnees.options = options;

                if (formatId === 'format_002') {
                    donnees.reponses_correctes = Array.from(document.querySelectorAll('input[name="correctOption"]:checked'))
                        .map(el => parseInt(el.value));
                    if (donnees.reponses_correctes.length === 0) {
                        alert('Veuillez selectionner au moins une bonne reponse');
                        return null;
                    }
                } else {
                    const correct = document.querySelector('input[name="correctOption"]:checked');
                    donnees.reponse_correcte = correct ? parseInt(correct.value) : 0;
                }
                break;

            case 'format_003': // Vrai/Faux
                const vf = document.querySelector('input[name="vraiFaux"]:checked');
                donnees.reponse_correcte = vf ? vf.value === 'true' : true;
                break;

            case 'format_004': // Trous
                donnees.texte = document.getElementById('trousTexte')?.value.trim() || '';
                donnees.trous = Array.from(document.querySelectorAll('#trousList .option-item')).map(item => ({
                    reponse: item.querySelector('.trou-reponse')?.value.trim() || '',
                    indice: item.querySelector('.trou-indice')?.value.trim() || ''
                }));
                break;

            case 'format_005': // Association
                donnees.paires = Array.from(document.querySelectorAll('.pair-item')).map(item => ({
                    gauche: item.querySelector('.pair-gauche')?.value.trim() || '',
                    droite: item.querySelector('.pair-droite')?.value.trim() || ''
                })).filter(p => p.gauche && p.droite);
                if (donnees.paires.length < 2) {
                    alert('Veuillez saisir au moins 2 paires');
                    return null;
                }
                break;

            case 'format_006': // Ordonner
                donnees.elements = Array.from(document.querySelectorAll('.timeline-element'))
                    .map(el => el.value.trim())
                    .filter(e => e);
                donnees.ordre_correct = donnees.elements.map((_, i) => i);
                if (donnees.elements.length < 2) {
                    alert('Veuillez saisir au moins 2 elements');
                    return null;
                }
                break;

            case 'format_007': // Question ouverte
                const motsCles = document.getElementById('motsCles')?.value.trim() || '';
                donnees.mots_cles = motsCles.split(',').map(m => m.trim()).filter(m => m);
                break;

            case 'format_008': // Image cliquable
                donnees.image_url = document.getElementById('imageUrl')?.value.trim() || '';
                donnees.zones = Array.from(document.querySelectorAll('.zone-item')).map(item => ({
                    id: item.querySelector('.zone-id')?.value.trim() || '',
                    label: item.querySelector('.zone-label')?.value.trim() || '',
                    x: parseFloat(item.querySelector('.zone-x')?.value) || 0,
                    y: parseFloat(item.querySelector('.zone-y')?.value) || 0,
                    width: parseFloat(item.querySelector('.zone-w')?.value) || 5,
                    height: parseFloat(item.querySelector('.zone-h')?.value) || 5
                })).filter(z => z.id && z.label);
                break;
        }

        return donnees;
    },

    // ========== DELETE ==========
    editElement(id) {
        const element = this.elements.find(el => el.id === id);
        if (element) {
            this.openModal(element);
        }
    },

    confirmDelete(id) {
        document.getElementById('deleteElementId').value = id;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async deleteElement() {
        const id = document.getElementById('deleteElementId').value;

        try {
            document.getElementById('confirmDeleteBtn').disabled = true;
            document.getElementById('confirmDeleteBtn').textContent = 'Suppression...';

            const result = await this.callAPI('deleteQuestion', { id });

            if (result.success) {
                this.closeDeleteModal();
                await this.loadData();
                this.renderChaptersTree();
                this.renderElements();
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

    // ========== API CALL ==========
    async callAPI(action, data = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        return new Promise((resolve, reject) => {
            const callbackName = 'adminElementsCallback_' + Date.now();
            const script = document.createElement('script');

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(response);
            };

            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur reseau'));
            };

            // Add data as URL params (for JSONP)
            Object.keys(data).forEach(key => {
                url.searchParams.set(key, data[key]);
            });

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            // Timeout
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
    },

    normalizeText(text) {
        if (!text) return '';
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .trim();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for AdminLayout to initialize
    setTimeout(() => {
        AdminElements.init();
    }, 100);
});

// Make it globally accessible
window.AdminElements = AdminElements;
