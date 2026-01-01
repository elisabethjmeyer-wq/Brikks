/**
 * Admin Elements - Banque d'elements (version atomique)
 * Structure: id, type, chapitre_id, contenu, donnees, tags, explication, difficulte, date_creation
 */

const AdminElements = {
    // Data
    elements: [],
    disciplines: [],
    themes: [],
    chapitres: [],
    cartes: [],

    // Types d'elements
    types: {
        qcm: { icon: '📝', label: 'Question QCM', color: 'blue' },
        evenement: { icon: '📅', label: 'Evenement', color: 'orange' },
        paire: { icon: '🔗', label: 'Paire', color: 'green' },
        point_carte: { icon: '📍', label: 'Point carte', color: 'teal' },
        item_categorie: { icon: '📂', label: 'Item categorie', color: 'pink' },
        reponse_libre: { icon: '💬', label: 'Reponse libre', color: 'purple' }
    },

    // Filters
    filters: {
        search: '',
        chapitre: '',
        type: 'all'
    },

    // Pagination
    currentPage: 1,
    itemsPerPage: 10,

    // Current type in modal
    currentType: 'qcm',

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderChaptersTree();
            this.renderElements();
            this.updateStats();
            this.updateCounts();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des donnees');
        }
    },

    async loadData() {
        const [disciplinesData, themesData, chapitresData, questionsData, cartesData] = await Promise.all([
            SheetsAPI.getSheetData('DISCIPLINES'),
            SheetsAPI.getSheetData('THEMES'),
            SheetsAPI.getSheetData('CHAPITRES'),
            SheetsAPI.getSheetData('QUESTIONS'),
            SheetsAPI.getSheetData('CARTES')
        ]);

        this.disciplines = SheetsAPI.parseSheetData(disciplinesData);
        this.themes = SheetsAPI.parseSheetData(themesData);
        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.elements = SheetsAPI.parseSheetData(questionsData);
        this.cartes = SheetsAPI.parseSheetData(cartesData);

        // Auto-fill discipline_id from theme if missing
        this.chapitres = this.chapitres.map(chap => {
            if (!chap.discipline_id && chap.theme_id) {
                const theme = this.themes.find(t => t.id === chap.theme_id);
                if (theme && theme.discipline_id) {
                    chap.discipline_id = theme.discipline_id;
                }
            }
            return chap;
        });

        // Parse donnees JSON
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
                <div class="empty-icon">⚠️</div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Add element buttons
        document.getElementById('addElementBtn').addEventListener('click', () => this.openModal());
        document.getElementById('addElementBtnHeader').addEventListener('click', () => this.openModal());
        document.getElementById('addElementBtnEmpty')?.addEventListener('click', () => this.openModal());

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.currentPage = 1;
            this.renderElements();
        });

        // Type filters (pills)
        document.querySelectorAll('.type-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-filter').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters.type = btn.dataset.type;
                this.currentPage = 1;
                this.renderElements();
            });
        });

        // Type selector in modal
        document.querySelectorAll('.type-selector-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.type-selector-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentType = btn.dataset.type;
                this.showTypeForm(btn.dataset.type);
            });
        });

        // Discipline change
        document.getElementById('elementDiscipline').addEventListener('change', (e) => {
            this.onDisciplineChange(e.target.value);
        });

        // Modal events
        document.getElementById('closeElementModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelElementBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveElementBtn').addEventListener('click', () => this.saveElement());

        // Delete modal
        document.getElementById('closeDeleteModal').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.deleteElement());

        // QCM reponses
        document.getElementById('addQcmOption').addEventListener('click', () => this.addQcmOption());
        this.setupQcmReponseListeners();

        // Close on overlay click
        document.getElementById('elementModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) this.closeModal();
        });
        document.getElementById('deleteModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) this.closeDeleteModal();
        });
    },

    setupQcmReponseListeners() {
        const container = document.getElementById('qcmReponses');

        container.addEventListener('click', (e) => {
            const item = e.target.closest('.reponse-item');
            if (!item) return;

            // Delete button
            if (e.target.classList.contains('reponse-delete')) {
                if (container.children.length > 2) {
                    item.remove();
                }
                return;
            }

            // Don't toggle if clicking input
            if (e.target.classList.contains('reponse-input')) return;

            // Toggle correct
            container.querySelectorAll('.reponse-item').forEach(i => {
                i.classList.remove('correct');
                i.querySelector('.reponse-radio').textContent = '';
            });
            item.classList.add('correct');
            item.querySelector('.reponse-radio').textContent = '✓';
        });
    },

    addQcmOption() {
        const container = document.getElementById('qcmReponses');
        const div = document.createElement('div');
        div.className = 'reponse-item';
        div.innerHTML = `
            <div class="reponse-radio"></div>
            <input type="text" class="form-input reponse-input" placeholder="Nouvelle reponse">
            <button type="button" class="reponse-delete">&times;</button>
        `;
        container.appendChild(div);
    },

    // ========== CHAPTERS TREE ==========
    renderChaptersTree() {
        const container = document.getElementById('chaptersTree');

        // Group chapitres by discipline
        const tree = {};

        this.disciplines.forEach(disc => {
            tree[disc.id] = {
                ...disc,
                chapitres: []
            };
        });

        this.chapitres.forEach(chap => {
            const chapDiscId = String(chap.discipline_id || '');
            const chapDiscNumber = chapDiscId.replace('disc_', '').replace(/^0+/, '');

            // Find matching discipline flexibly
            let matchedDiscId = null;
            for (const discId of Object.keys(tree)) {
                const discNumber = discId.replace('disc_', '').replace(/^0+/, '');
                if (chapDiscId === discId || chapDiscNumber === discNumber) {
                    matchedDiscId = discId;
                    break;
                }
            }

            if (matchedDiscId && tree[matchedDiscId]) {
                const count = this.elements.filter(el => el.chapitre_id === chap.id).length;
                tree[matchedDiscId].chapitres.push({
                    ...chap,
                    elementCount: count
                });
            }
        });

        let html = '';
        Object.values(tree).forEach(disc => {
            if (disc.chapitres.length === 0) return;

            html += `
                <div class="tree-discipline expanded" data-id="${disc.id}">
                    <div class="tree-discipline-header" onclick="AdminElements.toggleDiscipline('${disc.id}')">
                        <span class="toggle-icon">▶</span>
                        <span>${disc.emoji || '📚'} ${this.escapeHtml(disc.nom || disc.id)}</span>
                    </div>
                    <div class="tree-discipline-content">
            `;

            disc.chapitres.forEach(chap => {
                html += `
                    <div class="tree-chapter" data-id="${chap.id}" onclick="AdminElements.selectChapter('${chap.id}')">
                        <span class="tree-chapter-icon">📜</span>
                        <div class="tree-chapter-info">
                            <h4>${this.escapeHtml(chap.titre || chap.id)}</h4>
                        </div>
                        <span class="tree-chapter-count">${chap.elementCount}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html || '<p style="padding: 20px; color: var(--gray-500); text-align: center;">Aucun chapitre</p>';
    },

    toggleDiscipline(id) {
        const el = document.querySelector(`.tree-discipline[data-id="${id}"]`);
        if (el) el.classList.toggle('expanded');
    },

    selectChapter(id) {
        this.filters.chapitre = id;
        this.currentPage = 1;

        // Update UI
        document.querySelectorAll('.tree-chapter').forEach(el => el.classList.remove('active'));
        document.querySelector(`.tree-chapter[data-id="${id}"]`)?.classList.add('active');

        // Update header
        const chapitre = this.chapitres.find(c => c.id === id);
        const disc = this.disciplines.find(d => d.id === chapitre?.discipline_id);

        document.getElementById('selectedChapterName').textContent = chapitre?.titre || id;
        document.getElementById('selectedChapterMeta').textContent =
            `${this.getFilteredElements().length} elements • ${disc?.nom || ''}`;
        document.getElementById('headerIcon').textContent = disc?.emoji || '📜';

        this.renderElements();
        this.updateCounts();
    },

    clearChapterFilter() {
        this.filters.chapitre = '';
        this.currentPage = 1;
        document.querySelectorAll('.tree-chapter').forEach(el => el.classList.remove('active'));
        document.getElementById('selectedChapterName').textContent = 'Tous les chapitres';
        document.getElementById('selectedChapterMeta').textContent = `${this.elements.length} elements`;
        document.getElementById('headerIcon').textContent = '📋';
        this.renderElements();
        this.updateCounts();
    },

    // ========== ELEMENTS LIST ==========
    renderElements() {
        const container = document.getElementById('elementsList');
        const emptyState = document.getElementById('emptyState');

        const filtered = this.getFilteredElements();

        // Pagination
        const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const paginated = filtered.slice(start, start + this.itemsPerPage);

        if (paginated.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            container.innerHTML = paginated.map(el => this.renderElementCard(el)).join('');
        }

        this.renderPagination(filtered.length, totalPages);
    },

    renderElementCard(element) {
        const typeInfo = this.types[element.type] || { icon: '❓', label: element.type, color: 'gray' };
        const chapitre = this.chapitres.find(c => c.id === element.chapitre_id);

        // Build details based on type
        let detailsHtml = '';
        const donnees = element.donnees || {};

        switch (element.type) {
            case 'qcm':
                const nbOptions = donnees.options?.length || 0;
                const correctIdx = donnees.reponse_correcte;
                const correctAnswer = donnees.options?.[correctIdx] || '';
                detailsHtml = `
                    <span class="element-detail"><span class="element-detail-icon">🔢</span> ${nbOptions} choix</span>
                    <span class="element-detail correct"><span class="element-detail-icon">✓</span> ${this.escapeHtml(correctAnswer)}</span>
                `;
                break;
            case 'evenement':
                detailsHtml = `
                    <span class="element-detail date"><span class="element-detail-icon">📆</span> ${this.escapeHtml(donnees.date || '')}</span>
                    ${donnees.periode ? `<span class="element-detail"><span class="element-detail-icon">🕐</span> ${this.escapeHtml(donnees.periode)}</span>` : ''}
                `;
                break;
            case 'paire':
                detailsHtml = `
                    <span class="element-detail"><span class="element-detail-icon">🔗</span> ${this.escapeHtml(donnees.terme_a || '')} ↔ ${this.escapeHtml(donnees.terme_b || '')}</span>
                `;
                break;
            case 'point_carte':
                detailsHtml = `
                    <span class="element-detail"><span class="element-detail-icon">🗺️</span> ${this.escapeHtml(donnees.carte_id || 'Carte non definie')}</span>
                `;
                break;
            case 'item_categorie':
                detailsHtml = `
                    <span class="element-detail"><span class="element-detail-icon">📂</span> ${this.escapeHtml(donnees.categorie || '')}</span>
                `;
                break;
            case 'reponse_libre':
                const nbMots = donnees.mots_cles?.length || 0;
                detailsHtml = `
                    <span class="element-detail"><span class="element-detail-icon">🔑</span> ${nbMots} mots-cles</span>
                `;
                break;
        }

        return `
            <div class="element-card" data-id="${element.id}">
                <div class="element-type-badge ${element.type}">${typeInfo.icon}</div>
                <div class="element-content">
                    <span class="element-type-label">${typeInfo.label}</span>
                    <h3 class="element-title">${this.escapeHtml(element.contenu || 'Sans contenu')}</h3>
                    <div class="element-details">
                        ${detailsHtml}
                        <span class="element-detail"><span class="element-detail-icon">📁</span> ${this.escapeHtml(chapitre?.titre || '')}</span>
                    </div>
                </div>
                <div class="element-actions">
                    <button class="btn-icon" onclick="AdminElements.editElement('${element.id}')" title="Modifier">✏️</button>
                    <button class="btn-icon danger" onclick="AdminElements.confirmDelete('${element.id}')" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    getFilteredElements() {
        return this.elements.filter(el => {
            if (this.filters.search) {
                const searchIn = `${el.contenu || ''} ${el.tags || ''}`.toLowerCase();
                if (!searchIn.includes(this.filters.search)) return false;
            }
            if (this.filters.chapitre && el.chapitre_id !== this.filters.chapitre) return false;
            if (this.filters.type !== 'all' && el.type !== this.filters.type) return false;
            return true;
        });
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

        let html = `<button onclick="AdminElements.goToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) {
                html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="AdminElements.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
                html += `<button disabled>...</button>`;
            }
        }

        html += `<button onclick="AdminElements.goToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
        pagination.innerHTML = html;
    },

    goToPage(page) {
        const totalPages = Math.ceil(this.getFilteredElements().length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderElements();
    },

    // ========== STATS ==========
    updateStats() {
        document.getElementById('statQCM').textContent = this.elements.filter(el => el.type === 'qcm').length;
        document.getElementById('statEvenement').textContent = this.elements.filter(el => el.type === 'evenement').length;
        document.getElementById('statPaire').textContent = this.elements.filter(el => el.type === 'paire').length;
        document.getElementById('statPointCarte').textContent = this.elements.filter(el => el.type === 'point_carte').length;
        document.getElementById('statItemCategorie').textContent = this.elements.filter(el => el.type === 'item_categorie').length;
    },

    updateCounts() {
        const filtered = this.filters.chapitre
            ? this.elements.filter(el => el.chapitre_id === this.filters.chapitre)
            : this.elements;

        document.getElementById('countAll').textContent = filtered.length;
        document.getElementById('countQCM').textContent = filtered.filter(el => el.type === 'qcm').length;
        document.getElementById('countEvenement').textContent = filtered.filter(el => el.type === 'evenement').length;
        document.getElementById('countPaire').textContent = filtered.filter(el => el.type === 'paire').length;
        document.getElementById('countPointCarte').textContent = filtered.filter(el => el.type === 'point_carte').length;
        document.getElementById('countItemCategorie').textContent = filtered.filter(el => el.type === 'item_categorie').length;
        document.getElementById('countRepLibre').textContent = filtered.filter(el => el.type === 'reponse_libre').length;
    },

    // ========== MODAL ==========
    openModal(element = null) {
        const modal = document.getElementById('elementModal');
        const title = document.getElementById('elementModalTitle');

        // Populate disciplines and cartes
        this.populateDisciplines();
        this.populateCartes();

        if (element) {
            title.textContent = '✏️ Modifier l\'element';
            document.getElementById('editElementId').value = element.id;

            // Set type
            this.currentType = element.type || 'qcm';
            document.querySelectorAll('.type-selector-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === this.currentType);
            });
            this.showTypeForm(this.currentType);

            // Set discipline and chapitre
            if (element.chapitre_id) {
                const chap = this.chapitres.find(c => c.id === element.chapitre_id);
                if (chap) {
                    document.getElementById('elementDiscipline').value = chap.discipline_id || '';
                    this.onDisciplineChange(chap.discipline_id, () => {
                        document.getElementById('elementChapitre').value = element.chapitre_id;
                    });
                }
            }

            // Fill form based on type
            this.fillFormData(element);

            // Common fields
            document.getElementById('elementTags').value = element.tags || '';
            document.getElementById('elementDifficulte').value = element.difficulte || 'facile';
            document.getElementById('elementExplication').value = element.explication || '';
        } else {
            title.textContent = '➕ Nouvel element';
            document.getElementById('editElementId').value = '';
            this.currentType = 'qcm';
            document.querySelectorAll('.type-selector-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === 'qcm');
            });
            this.showTypeForm('qcm');
            this.resetForm();
        }

        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('elementModal').classList.add('hidden');
    },

    showTypeForm(type) {
        document.querySelectorAll('.form-dynamic').forEach(f => f.classList.remove('active'));
        document.getElementById(`form-${type}`)?.classList.add('active');
    },

    populateDisciplines() {
        const select = document.getElementById('elementDiscipline');
        select.innerHTML = '<option value="">Selectionner...</option>' +
            this.disciplines.map(d => `<option value="${d.id}">${d.emoji || ''} ${this.escapeHtml(d.nom || d.id)}</option>`).join('');
    },

    onDisciplineChange(disciplineId, callback) {
        const chapitreSelect = document.getElementById('elementChapitre');

        if (!disciplineId) {
            chapitreSelect.innerHTML = '<option value="">Selectionner d\'abord une discipline...</option>';
            chapitreSelect.disabled = true;
            return;
        }

        // Match discipline_id flexibly: "disc_001" matches "disc_001", "1", or "001"
        const discNumber = disciplineId.replace('disc_', '').replace(/^0+/, '');
        const chapitres = this.chapitres.filter(c => {
            const chapDiscId = String(c.discipline_id || '');
            const chapDiscNumber = chapDiscId.replace('disc_', '').replace(/^0+/, '');
            return chapDiscId === disciplineId || chapDiscNumber === discNumber;
        });

        chapitreSelect.innerHTML = '<option value="">Selectionner un chapitre...</option>' +
            chapitres.map(c => `<option value="${c.id}">${this.escapeHtml(c.titre || c.id)}</option>`).join('');
        chapitreSelect.disabled = false;

        if (callback) setTimeout(callback, 0);
    },

    resetForm() {
        // Reset all form fields
        document.getElementById('elementDiscipline').value = '';
        document.getElementById('elementChapitre').innerHTML = '<option value="">Selectionner d\'abord une discipline...</option>';
        document.getElementById('elementChapitre').disabled = true;
        document.getElementById('elementTags').value = '';
        document.getElementById('elementDifficulte').value = 'facile';
        document.getElementById('elementExplication').value = '';

        // QCM
        document.getElementById('qcmEnonce').value = '';
        this.resetQcmReponses();

        // Evenement
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventDate').value = '';
        document.getElementById('eventPeriode').value = '';

        // Paire
        document.getElementById('paireTermeA').value = '';
        document.getElementById('paireTermeB').value = '';

        // Point carte
        document.getElementById('pointNom').value = '';
        document.getElementById('pointCarteSelect').value = '';
        document.getElementById('pointX').value = '';
        document.getElementById('pointY').value = '';
        document.getElementById('cartePreviewContainer').style.display = 'none';
        document.getElementById('carteMarker').style.display = 'none';

        // Item categorie
        document.getElementById('itemElement').value = '';
        document.getElementById('itemCategorie').value = '';

        // Reponse libre
        document.getElementById('libreQuestion').value = '';
        document.getElementById('libreMotsCles').value = '';
        document.getElementById('libreReponseModele').value = '';
    },

    resetQcmReponses() {
        const container = document.getElementById('qcmReponses');
        container.innerHTML = `
            <div class="reponse-item correct">
                <div class="reponse-radio">✓</div>
                <input type="text" class="form-input reponse-input" placeholder="Bonne reponse">
                <button type="button" class="reponse-delete">&times;</button>
            </div>
            <div class="reponse-item">
                <div class="reponse-radio"></div>
                <input type="text" class="form-input reponse-input" placeholder="Mauvaise reponse">
                <button type="button" class="reponse-delete">&times;</button>
            </div>
            <div class="reponse-item">
                <div class="reponse-radio"></div>
                <input type="text" class="form-input reponse-input" placeholder="Mauvaise reponse">
                <button type="button" class="reponse-delete">&times;</button>
            </div>
            <div class="reponse-item">
                <div class="reponse-radio"></div>
                <input type="text" class="form-input reponse-input" placeholder="Mauvaise reponse">
                <button type="button" class="reponse-delete">&times;</button>
            </div>
        `;
    },

    fillFormData(element) {
        const donnees = element.donnees || {};

        switch (element.type) {
            case 'qcm':
                document.getElementById('qcmEnonce').value = element.contenu || '';
                this.fillQcmReponses(donnees.options || [], donnees.reponse_correcte || 0);
                break;
            case 'evenement':
                document.getElementById('eventDescription').value = element.contenu || '';
                document.getElementById('eventDate').value = donnees.date || '';
                document.getElementById('eventPeriode').value = donnees.periode || '';
                break;
            case 'paire':
                document.getElementById('paireTermeA').value = donnees.terme_a || '';
                document.getElementById('paireTermeB').value = donnees.terme_b || '';
                break;
            case 'point_carte':
                document.getElementById('pointNom').value = element.contenu || '';
                document.getElementById('pointCarteSelect').value = donnees.carte_id || '';
                document.getElementById('pointX').value = donnees.x || '';
                document.getElementById('pointY').value = donnees.y || '';
                // Load carte preview if exists
                if (donnees.carte_id) {
                    this.onCarteChange(donnees.carte_id);
                }
                break;
            case 'item_categorie':
                document.getElementById('itemElement').value = element.contenu || '';
                document.getElementById('itemCategorie').value = donnees.categorie || '';
                break;
            case 'reponse_libre':
                document.getElementById('libreQuestion').value = element.contenu || '';
                document.getElementById('libreMotsCles').value = (donnees.mots_cles || []).join(', ');
                document.getElementById('libreReponseModele').value = donnees.reponse_modele || '';
                break;
        }
    },

    fillQcmReponses(options, correctIndex) {
        const container = document.getElementById('qcmReponses');
        container.innerHTML = options.map((opt, i) => `
            <div class="reponse-item ${i === correctIndex ? 'correct' : ''}">
                <div class="reponse-radio">${i === correctIndex ? '✓' : ''}</div>
                <input type="text" class="form-input reponse-input" value="${this.escapeHtml(opt)}" placeholder="Reponse">
                <button type="button" class="reponse-delete">&times;</button>
            </div>
        `).join('');

        if (options.length < 2) {
            this.resetQcmReponses();
        }
    },

    // ========== SAVE ==========
    async saveElement() {
        const id = document.getElementById('editElementId').value;
        const chapitreId = document.getElementById('elementChapitre').value;
        const tags = document.getElementById('elementTags').value.trim();
        const difficulte = document.getElementById('elementDifficulte').value;
        const explication = document.getElementById('elementExplication').value.trim();

        // Validation
        if (!chapitreId) {
            alert('Veuillez selectionner un chapitre');
            return;
        }

        // Get contenu and donnees based on type
        const { contenu, donnees } = this.collectFormData();
        if (contenu === null) return; // Validation failed

        const data = {
            type: this.currentType,
            chapitre_id: chapitreId,
            contenu: contenu,
            donnees: JSON.stringify(donnees),
            tags: tags,
            explication: explication,
            difficulte: difficulte,
            date_creation: new Date().toISOString().split('T')[0]
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
                this.updateCounts();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            document.getElementById('saveElementBtn').disabled = false;
            document.getElementById('saveElementBtn').textContent = '💾 Enregistrer';
        }
    },

    collectFormData() {
        let contenu = '';
        let donnees = {};

        switch (this.currentType) {
            case 'qcm':
                contenu = document.getElementById('qcmEnonce').value.trim();
                if (!contenu) {
                    alert('Veuillez saisir l\'enonce de la question');
                    return { contenu: null, donnees: null };
                }
                const options = Array.from(document.querySelectorAll('#qcmReponses .reponse-input'))
                    .map(input => input.value.trim());
                const correctItem = document.querySelector('#qcmReponses .reponse-item.correct');
                const correctIndex = correctItem
                    ? Array.from(document.querySelectorAll('#qcmReponses .reponse-item')).indexOf(correctItem)
                    : 0;
                if (options.filter(o => o).length < 2) {
                    alert('Veuillez saisir au moins 2 reponses');
                    return { contenu: null, donnees: null };
                }
                donnees = { options, reponse_correcte: correctIndex };
                break;

            case 'evenement':
                contenu = document.getElementById('eventDescription').value.trim();
                const date = document.getElementById('eventDate').value.trim();
                if (!contenu || !date) {
                    alert('Veuillez saisir la description et la date');
                    return { contenu: null, donnees: null };
                }
                donnees = {
                    date: date,
                    periode: document.getElementById('eventPeriode').value.trim()
                };
                break;

            case 'paire':
                const termeA = document.getElementById('paireTermeA').value.trim();
                const termeB = document.getElementById('paireTermeB').value.trim();
                if (!termeA || !termeB) {
                    alert('Veuillez saisir les deux termes');
                    return { contenu: null, donnees: null };
                }
                contenu = `${termeA} ↔ ${termeB}`;
                donnees = { terme_a: termeA, terme_b: termeB };
                break;

            case 'point_carte':
                contenu = document.getElementById('pointNom').value.trim();
                const carteId = document.getElementById('pointCarteSelect').value;
                if (!contenu) {
                    alert('Veuillez saisir le nom du lieu');
                    return { contenu: null, donnees: null };
                }
                if (!carteId) {
                    alert('Veuillez selectionner une carte');
                    return { contenu: null, donnees: null };
                }
                const pointX = parseFloat(document.getElementById('pointX').value) || 0;
                const pointY = parseFloat(document.getElementById('pointY').value) || 0;
                if (pointX === 0 && pointY === 0) {
                    alert('Veuillez cliquer sur la carte pour placer le point');
                    return { contenu: null, donnees: null };
                }
                donnees = {
                    carte_id: carteId,
                    x: pointX,
                    y: pointY
                };
                break;

            case 'item_categorie':
                contenu = document.getElementById('itemElement').value.trim();
                const categorie = document.getElementById('itemCategorie').value.trim();
                if (!contenu || !categorie) {
                    alert('Veuillez saisir l\'element et la categorie');
                    return { contenu: null, donnees: null };
                }
                donnees = { categorie: categorie };
                break;

            case 'reponse_libre':
                contenu = document.getElementById('libreQuestion').value.trim();
                if (!contenu) {
                    alert('Veuillez saisir la question');
                    return { contenu: null, donnees: null };
                }
                const motsCles = document.getElementById('libreMotsCles').value
                    .split(',').map(m => m.trim()).filter(m => m);
                donnees = {
                    mots_cles: motsCles,
                    reponse_modele: document.getElementById('libreReponseModele').value.trim()
                };
                break;
        }

        return { contenu, donnees };
    },

    // ========== DELETE ==========
    editElement(id) {
        const element = this.elements.find(el => el.id === id);
        if (element) this.openModal(element);
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
                this.updateCounts();
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

    // ========== CARTES ==========
    populateCartes() {
        const select = document.getElementById('pointCarteSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Selectionner une carte...</option>' +
            this.cartes.map(c => `<option value="${c.id}" data-url="${this.escapeHtml(c.image_url || '')}">${this.escapeHtml(c.nom || c.id)}</option>`).join('');
    },

    onCarteChange(carteId) {
        const preview = document.getElementById('cartePreview');
        const container = document.getElementById('cartePreviewContainer');
        const coords = document.getElementById('carteCoords');

        if (!carteId) {
            container.style.display = 'none';
            return;
        }

        const carte = this.cartes.find(c => c.id === carteId);

        // If no image URL, show manual input directly
        if (!carte || !carte.image_url) {
            this.showManualCoordinateInput(container, coords, preview);
            return;
        }

        // Normalize URL to handle Google Drive, Dropbox, etc.
        preview.src = this.normalizeImageUrl(carte.image_url);
        preview.onload = () => {
            container.style.display = 'block';
            preview.style.display = 'block';
            coords.textContent = 'Cliquez sur la carte pour placer le point';
            // Reset marker
            const marker = document.getElementById('carteMarker');
            const x = parseFloat(document.getElementById('pointX').value) || 0;
            const y = parseFloat(document.getElementById('pointY').value) || 0;
            if (x > 0 || y > 0) {
                this.placeMarker(x, y);
            } else {
                marker.style.display = 'none';
            }
        };
        preview.onerror = () => {
            this.showManualCoordinateInput(container, coords, preview);
        };

        coords.textContent = 'Cliquez sur la carte pour placer le point';
    },

    showManualCoordinateInput(container, coords, preview) {
        container.style.display = 'block';
        preview.style.display = 'none';

        const currentX = document.getElementById('pointX').value || 50;
        const currentY = document.getElementById('pointY').value || 50;

        coords.innerHTML = `
            <div style="padding: 20px; background: #f0f9ff; border-radius: 8px; text-align: center; border: 1px solid #bae6fd;">
                <p style="margin-bottom: 12px; color: #0369a1; font-weight: 500;">📍 Coordonnees du point :</p>
                <div style="display: flex; gap: 16px; justify-content: center; align-items: center;">
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 14px;">
                        X: <input type="number" id="manualPointX" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" min="0" max="100" value="${currentX}" onchange="document.getElementById('pointX').value = this.value">%
                    </label>
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 14px;">
                        Y: <input type="number" id="manualPointY" style="width: 80px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" min="0" max="100" value="${currentY}" onchange="document.getElementById('pointY').value = this.value">%
                    </label>
                </div>
                <p style="margin-top: 12px; font-size: 12px; color: #6b7280;">0% = haut/gauche, 100% = bas/droite</p>
            </div>
        `;

        // Set default values in hidden inputs
        if (!document.getElementById('pointX').value) document.getElementById('pointX').value = 50;
        if (!document.getElementById('pointY').value) document.getElementById('pointY').value = 50;
    },

    onCarteClick(event) {
        const preview = document.getElementById('cartePreview');
        const rect = preview.getBoundingClientRect();

        // Calculate percentage position
        const x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1);
        const y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1);

        // Update hidden inputs
        document.getElementById('pointX').value = x;
        document.getElementById('pointY').value = y;

        // Update coords display
        document.getElementById('carteCoords').textContent = `Position: ${x}%, ${y}%`;

        // Place marker
        this.placeMarker(x, y);
    },

    placeMarker(x, y) {
        const marker = document.getElementById('carteMarker');
        marker.style.display = 'block';
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
    },

    // ========== UTILS ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Convert various image URL formats to direct viewable URLs
     * Supports: Google Drive, Dropbox, and direct URLs
     */
    normalizeImageUrl(url) {
        if (!url) return '';

        // Google Drive formats
        // https://drive.google.com/file/d/FILE_ID/view
        // https://drive.google.com/open?id=FILE_ID
        // https://drive.google.com/uc?id=FILE_ID
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
        if (driveFileMatch) {
            // Try lh3.googleusercontent.com format (often works better for CORS)
            return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
        }

        const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
        if (driveOpenMatch) {
            return `https://drive.google.com/uc?export=view&id=${driveOpenMatch[1]}`;
        }

        const driveUcMatch = url.match(/drive\.google\.com\/uc\?id=([^&]+)/);
        if (driveUcMatch && !url.includes('export=view')) {
            return `https://drive.google.com/uc?export=view&id=${driveUcMatch[1]}`;
        }

        // Dropbox: change dl=0 to dl=1 for direct link
        if (url.includes('dropbox.com') && url.includes('dl=0')) {
            return url.replace('dl=0', 'dl=1');
        }

        // Already a direct URL or unknown format - return as is
        return url;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => AdminElements.init(), 100);
});

window.AdminElements = AdminElements;
