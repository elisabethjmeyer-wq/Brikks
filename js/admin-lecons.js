/**
 * Admin Leçons - Gestion des leçons (disciplines, thèmes, chapitres)
 */

const AdminLecons = {
    // Données
    disciplines: [],
    themes: [],
    chapitres: [],
    supports: [],

    // Filtre actif
    currentFilter: '',

    // Supports temporaires pour le formulaire
    tempSupports: [],

    // Icônes par discipline
    disciplineIcons: {
        'litterature': '📚',
        'histoire': '🏛️',
        'geographie': '🗺️',
        'emc': '⚖️',
        'default': '📖'
    },

    /**
     * Initialise la page
     */
    async init() {
        try {
            await this.loadData();
            this.render();
            this.populateSelects();
            this.populateFilterSelect();
        } catch (error) {
            console.error('Erreur lors du chargement:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    /**
     * Charge les données depuis Google Sheets
     */
    async loadData() {
        const [disciplines, themes, chapitres, supports] = await Promise.all([
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.DISCIPLINES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.THEMES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.CHAPITRES),
            SheetsAPI.fetchAndParse(CONFIG.SHEETS.SUPPORTS_CHAPITRE).catch(() => [])
        ]);

        this.disciplines = disciplines || [];
        this.themes = themes || [];
        this.chapitres = chapitres || [];
        this.supports = supports || [];

        console.log('Données chargées:', {
            disciplines: this.disciplines.length,
            themes: this.themes.length,
            chapitres: this.chapitres.length,
            supports: this.supports.length
        });
    },

    /**
     * Remplit le select de filtre par discipline
     */
    populateFilterSelect() {
        const filterSelect = document.getElementById('filter-discipline');
        if (!filterSelect) return;

        filterSelect.innerHTML = '<option value="">Toutes les disciplines</option>';
        this.disciplines.forEach(d => {
            const icon = d.emoji || this.getIcon(d.nom);
            filterSelect.innerHTML += `<option value="${d.id}">${icon} ${d.nom}</option>`;
        });
    },

    /**
     * Filtre par discipline
     */
    filterByDiscipline() {
        const filterSelect = document.getElementById('filter-discipline');
        this.currentFilter = filterSelect.value;
        this.render();
    },

    /**
     * Affiche les données
     */
    render() {
        const loader = document.getElementById('loader');
        const container = document.getElementById('themes-container');
        const emptyState = document.getElementById('empty-state');

        loader.style.display = 'none';

        // Vérifier s'il y a des données (thèmes ou chapitres introductifs)
        const hasData = this.themes.length > 0 || this.chapitres.some(c => !c.theme_id);

        if (!hasData) {
            emptyState.style.display = 'block';
            container.style.display = 'none';
            this.updateStats();
            return;
        }

        container.style.display = 'flex';
        emptyState.style.display = 'none';

        let html = '';

        // Grouper par discipline
        const disciplinesToShow = this.currentFilter
            ? this.disciplines.filter(d => d.id === this.currentFilter)
            : this.disciplines;

        disciplinesToShow.forEach(discipline => {
            const icon = discipline.emoji || this.getIcon(discipline.nom);

            // Chapitres introductifs de cette discipline
            const introChapitres = this.chapitres.filter(c =>
                !c.theme_id && c.discipline_id === discipline.id
            ).sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));

            // Thèmes de cette discipline
            const disciplineThemes = this.themes.filter(t =>
                t.discipline_id === discipline.id
            ).sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));

            // Afficher les chapitres introductifs
            if (introChapitres.length > 0) {
                html += this.renderIntroSection(discipline, introChapitres, icon);
            }

            // Afficher les thèmes
            disciplineThemes.forEach(theme => {
                const chapitres = this.getChapitresForTheme(theme.id);
                html += this.renderThemeCard(theme, chapitres, icon, discipline.nom);
            });
        });

        container.innerHTML = html;
        this.updateStats();
        this.bindEvents();
    },

    /**
     * Génère le HTML pour les chapitres introductifs
     */
    renderIntroSection(discipline, chapitres, icon) {
        const chapitresHtml = chapitres.map((chapitre, index) =>
            this.renderChapterItem(chapitre, index + 1)
        ).join('');

        return `
            <div class="theme-card intro-section" data-discipline-id="${discipline.id}">
                <div class="theme-header intro-header">
                    <span class="drag-handle">⋮⋮</span>
                    <div class="theme-icon">${icon}</div>
                    <div class="theme-info">
                        <h2 class="theme-title">📌 Cours introductifs - ${discipline.nom}</h2>
                        <p class="theme-meta">${chapitres.length} chapitre${chapitres.length > 1 ? 's' : ''} hors thème</p>
                    </div>
                    <div class="theme-actions">
                        <button class="theme-toggle" title="Réduire">▼</button>
                    </div>
                </div>
                <div class="chapters-list">
                    ${chapitresHtml}
                    <button class="add-chapter-btn" onclick="AdminLecons.addIntroChapter('${discipline.id}')">
                        + Ajouter un cours introductif
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Groupe les thèmes par discipline
     */
    groupThemesByDiscipline() {
        const grouped = {};

        this.themes.forEach(theme => {
            const disciplineId = theme.discipline_id || 'other';
            if (!grouped[disciplineId]) {
                grouped[disciplineId] = [];
            }
            grouped[disciplineId].push(theme);
        });

        return grouped;
    },

    /**
     * Récupère les chapitres d'un thème
     */
    getChapitresForTheme(themeId) {
        return this.chapitres
            .filter(c => c.theme_id === themeId)
            .sort((a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0));
    },

    /**
     * Récupère l'icône d'une discipline
     */
    getIcon(disciplineName) {
        const name = (disciplineName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (name.includes('litt')) return this.disciplineIcons.litterature;
        if (name.includes('hist')) return this.disciplineIcons.histoire;
        if (name.includes('geo')) return this.disciplineIcons.geographie;
        if (name.includes('emc') || name.includes('civique')) return this.disciplineIcons.emc;

        return this.disciplineIcons.default;
    },

    /**
     * Génère le HTML d'une carte thème
     */
    renderThemeCard(theme, chapitres, icon, disciplineName) {
        const chapitresHtml = chapitres.map((chapitre, index) =>
            this.renderChapterItem(chapitre, index + 1)
        ).join('');

        const themeName = theme.nom || theme.titre || 'Thème sans titre';

        return `
            <div class="theme-card" data-theme-id="${theme.id}">
                <div class="theme-header">
                    <span class="drag-handle">⋮⋮</span>
                    <div class="theme-icon">${icon}</div>
                    <div class="theme-info">
                        <h2 class="theme-title">${themeName}</h2>
                        <p class="theme-meta">${icon} ${disciplineName} • ${chapitres.length} chapitre${chapitres.length > 1 ? 's' : ''}</p>
                    </div>
                    <div class="theme-actions">
                        <button class="btn btn-ghost btn-xs" onclick="AdminLecons.editTheme('${theme.id}')">✏️ Modifier</button>
                        <button class="btn btn-ghost btn-xs danger" onclick="AdminLecons.deleteTheme('${theme.id}')">🗑️</button>
                        <button class="theme-toggle" title="Réduire">▼</button>
                    </div>
                </div>
                <div class="chapters-list">
                    ${chapitresHtml}
                    <button class="add-chapter-btn" onclick="AdminLecons.addChapterToTheme('${theme.id}')">
                        + Ajouter un chapitre
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Génère le HTML d'un chapitre
     */
    renderChapterItem(chapitre, numero) {
        const status = (chapitre.statut || 'brouillon').toLowerCase();
        const statusBadge = this.getStatusBadge(status);
        const lessonTag = chapitre.numero_lecon
            ? `<span class="lesson-tag">L${chapitre.numero_lecon}</span>`
            : `<span class="lesson-tag empty">—</span>`;

        // Compter les supports
        const supportsCount = this.supports.filter(s => s.chapitre_id === chapitre.id).length;
        const lien = chapitre.lien || '';

        let lienHtml = '';
        if (supportsCount > 0) {
            lienHtml = `<div class="chapter-link"><span>📎 ${supportsCount} support${supportsCount > 1 ? 's' : ''}</span></div>`;
        } else if (lien) {
            lienHtml = `<div class="chapter-link"><a href="${lien}" target="_blank">📄 ${this.truncateUrl(lien)}</a></div>`;
        }

        return `
            <div class="chapter-item" data-chapter-id="${chapitre.id}">
                <span class="chapter-drag">⋮⋮</span>
                <span class="chapter-number">${numero}</span>
                <div class="chapter-info">
                    <div class="chapter-title">
                        ${chapitre.titre || 'Chapitre sans titre'}
                        ${lessonTag}
                    </div>
                    ${lienHtml}
                </div>
                ${statusBadge}
                <div class="chapter-actions">
                    <button class="action-btn" onclick="AdminLecons.editChapter('${chapitre.id}')" title="Modifier">✏️</button>
                    <button class="action-btn" onclick="AdminLecons.viewChapter('${chapitre.id}')" title="Voir">👁️</button>
                    <button class="action-btn danger" onclick="AdminLecons.deleteChapter('${chapitre.id}')" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    },

    /**
     * Retourne le badge de statut
     */
    getStatusBadge(status) {
        switch(status) {
            case 'publie':
                return '<span class="status-badge visible">🟢 Publié</span>';
            case 'pret':
                return '<span class="status-badge ready">🟡 Prêt</span>';
            default:
                return '<span class="status-badge draft">⚪ Brouillon</span>';
        }
    },

    /**
     * Tronque une URL
     */
    truncateUrl(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            let display = urlObj.hostname + urlObj.pathname;
            if (display.length > 40) {
                display = display.substring(0, 37) + '...';
            }
            return display;
        } catch {
            return url.length > 40 ? url.substring(0, 37) + '...' : url;
        }
    },

    /**
     * Met à jour les statistiques
     */
    updateStats() {
        const publies = this.chapitres.filter(c => (c.statut || '').toLowerCase() === 'publie').length;
        const prets = this.chapitres.filter(c => (c.statut || '').toLowerCase() === 'pret').length;
        const brouillons = this.chapitres.filter(c => {
            const s = (c.statut || '').toLowerCase();
            return s === 'brouillon' || s === '';
        }).length;
        const total = this.chapitres.length;

        document.getElementById('stat-publies').textContent = publies;
        document.getElementById('stat-prets').textContent = prets;
        document.getElementById('stat-brouillons').textContent = brouillons;
        document.getElementById('stat-total').textContent = `${total} chapitre${total > 1 ? 's' : ''}`;
    },

    /**
     * Remplit les selects des modales
     */
    populateSelects() {
        // Select disciplines pour nouveau thème
        const disciplineSelect = document.getElementById('theme-discipline-select');
        if (disciplineSelect) {
            disciplineSelect.innerHTML = '<option value="">— Sélectionner une discipline —</option>';
            this.disciplines.forEach(d => {
                const icon = d.emoji || this.getIcon(d.nom);
                disciplineSelect.innerHTML += `<option value="${d.id}">${icon} ${d.nom}</option>`;
            });
        }

        // Select disciplines pour chapitre introductif
        const chapterDisciplineSelect = document.getElementById('chapter-discipline-select');
        if (chapterDisciplineSelect) {
            chapterDisciplineSelect.innerHTML = '<option value="">— Sélectionner une discipline —</option>';
            this.disciplines.forEach(d => {
                const icon = d.emoji || this.getIcon(d.nom);
                chapterDisciplineSelect.innerHTML += `<option value="${d.id}">${icon} ${d.nom}</option>`;
            });
        }

        // Select thèmes pour nouveau chapitre
        const themeSelect = document.getElementById('chapter-theme-select');
        if (themeSelect) {
            themeSelect.innerHTML = '<option value="">— Sélectionner un thème —</option>';

            // Grouper par discipline
            this.disciplines.forEach(discipline => {
                const disciplineThemes = this.themes.filter(t => t.discipline_id === discipline.id);
                const icon = discipline.emoji || this.getIcon(discipline.nom);

                disciplineThemes.forEach(theme => {
                    const themeName = theme.nom || theme.titre || 'Sans titre';
                    themeSelect.innerHTML += `<option value="${theme.id}">${themeName} (${icon} ${discipline.nom})</option>`;
                });
            });
        }
    },

    /**
     * Bind les événements
     */
    bindEvents() {
        // Toggle des thèmes
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.theme-card');
                const list = card.querySelector('.chapters-list');
                if (list.style.display === 'none') {
                    list.style.display = 'block';
                    btn.textContent = '▼';
                } else {
                    list.style.display = 'none';
                    btn.textContent = '▶';
                }
            });
        });
    },

    /**
     * Déplie tous les thèmes
     */
    expandAll() {
        document.querySelectorAll('.theme-card').forEach(card => {
            const list = card.querySelector('.chapters-list');
            const btn = card.querySelector('.theme-toggle');
            if (list) list.style.display = 'block';
            if (btn) btn.textContent = '▼';
        });
    },

    /**
     * Replie tous les thèmes
     */
    collapseAll() {
        document.querySelectorAll('.theme-card').forEach(card => {
            const list = card.querySelector('.chapters-list');
            const btn = card.querySelector('.theme-toggle');
            if (list) list.style.display = 'none';
            if (btn) btn.textContent = '▶';
        });
    },

    /**
     * Toggle entre chapitre de thème et cours introductif
     */
    toggleChapterType() {
        const isIntro = document.getElementById('type-intro').checked;
        document.getElementById('theme-select-group').style.display = isIntro ? 'none' : 'block';
        document.getElementById('discipline-select-group').style.display = isIntro ? 'block' : 'none';
    },

    /**
     * Ouvre le modal pour ajouter un chapitre à un thème spécifique
     */
    addChapterToTheme(themeId) {
        this.resetChapterForm();
        document.getElementById('type-theme').checked = true;
        this.toggleChapterType();
        document.getElementById('chapter-theme-select').value = themeId;
        openModal('modal-chapter');
    },

    /**
     * Ouvre le modal pour ajouter un chapitre introductif
     */
    addIntroChapter(disciplineId) {
        this.resetChapterForm();
        document.getElementById('type-intro').checked = true;
        this.toggleChapterType();
        document.getElementById('chapter-discipline-select').value = disciplineId;
        openModal('modal-chapter');
    },

    /**
     * Ajoute un support au formulaire
     */
    addSupport(data = {}) {
        const supportsList = document.getElementById('supports-list');
        const index = supportsList.children.length;

        const supportHtml = `
            <div class="support-item" data-index="${index}" draggable="true">
                <div class="support-drag-handle" title="Glisser pour réordonner">⋮⋮</div>
                <select class="support-type" name="support-type-${index}">
                    <option value="document" ${data.type === 'document' ? 'selected' : ''}>📄 Document</option>
                    <option value="video" ${data.type === 'video' ? 'selected' : ''}>🎬 Vidéo</option>
                    <option value="audio" ${data.type === 'audio' ? 'selected' : ''}>🎧 Audio</option>
                    <option value="lien" ${data.type === 'lien' ? 'selected' : ''}>🔗 Lien externe</option>
                </select>
                <input type="text" class="support-name" name="support-name-${index}" placeholder="Nom du support" value="${data.nom || ''}">
                <input type="url" class="support-url" name="support-url-${index}" placeholder="https://..." value="${data.url || ''}">
                <button type="button" class="support-remove" onclick="AdminLecons.removeSupport(this)" title="Supprimer">🗑️</button>
            </div>
        `;

        supportsList.insertAdjacentHTML('beforeend', supportHtml);

        // Ajouter les événements drag-and-drop
        const newItem = supportsList.lastElementChild;
        this.initDragEvents(newItem);
    },

    /**
     * Supprime un support du formulaire
     */
    removeSupport(btn) {
        const supportItem = btn.closest('.support-item');
        if (supportItem) {
            supportItem.remove();
        }
    },

    /**
     * Initialise les événements drag-and-drop pour un élément
     */
    initDragEvents(item) {
        const handle = item.querySelector('.support-drag-handle');

        // Empêcher le drag sauf depuis la poignée
        item.addEventListener('dragstart', (e) => {
            if (!e.target.classList.contains('support-drag-handle') &&
                !e.target.closest('.support-drag-handle')) {
                // Autoriser quand même si on a cliqué sur la poignée récemment
                if (!item.classList.contains('drag-ready')) {
                    e.preventDefault();
                    return;
                }
            }
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.outerHTML);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            item.classList.remove('drag-ready');
            document.querySelectorAll('.support-item.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragging = document.querySelector('.support-item.dragging');
            if (dragging && dragging !== item) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const dragging = document.querySelector('.support-item.dragging');
            if (dragging && dragging !== item) {
                const supportsList = document.getElementById('supports-list');
                const items = [...supportsList.children];
                const dragIndex = items.indexOf(dragging);
                const dropIndex = items.indexOf(item);

                if (dragIndex < dropIndex) {
                    item.after(dragging);
                } else {
                    item.before(dragging);
                }
            }
        });

        // Permettre le drag depuis la poignée
        handle.addEventListener('mousedown', () => {
            item.classList.add('drag-ready');
        });

        handle.addEventListener('mouseup', () => {
            setTimeout(() => item.classList.remove('drag-ready'), 100);
        });
    },

    /**
     * Récupère les supports du formulaire
     */
    getSupportsFromForm() {
        const supports = [];
        document.querySelectorAll('.support-item').forEach((item, index) => {
            const type = item.querySelector('.support-type').value;
            const nom = item.querySelector('.support-name').value;
            const url = item.querySelector('.support-url').value;

            if (url) {
                supports.push({
                    type,
                    nom: nom || `Support ${index + 1}`,
                    url,
                    ordre: index + 1
                });
            }
        });
        return supports;
    },

    // ID en cours d'édition
    editingThemeId: null,
    editingChapterId: null,

    /**
     * Appelle le Web App (compatible CORS via JSONP)
     */
    callWebApp(action, data) {
        return new Promise((resolve) => {
            if (CONFIG.WEBAPP_URL === 'REMPLACER_PAR_URL_WEB_APP') {
                alert('Erreur : Le Web App n\'est pas configuré.\nVoir google-apps-script/DEPLOIEMENT.md');
                resolve({ success: false, error: 'Web App non configuré' });
                return;
            }

            const params = new URLSearchParams();
            params.append('action', action);
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    params.append(key, data[key]);
                }
            });

            const callbackName = 'brikksCallback_' + Date.now();
            params.append('callback', callbackName);

            const url = CONFIG.WEBAPP_URL + '?' + params.toString();

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            const script = document.createElement('script');
            script.src = url;
            script.onerror = function() {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve({ success: false, error: 'Erreur de connexion au serveur' });
            };

            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) script.parentNode.removeChild(script);
                    resolve({ success: false, error: 'Timeout - le serveur ne répond pas' });
                }
            }, 30000);
        });
    },

    /**
     * Ouvre le modal pour éditer un thème
     */
    editTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        this.editingThemeId = themeId;

        document.getElementById('theme-discipline-select').value = theme.discipline_id || '';
        document.getElementById('theme-numero').value = theme.ordre || '';
        document.getElementById('theme-titre').value = theme.nom || theme.titre || '';

        document.getElementById('modal-theme-title').textContent = 'Modifier le thème';
        openModal('modal-theme');
    },

    /**
     * Ouvre le modal pour éditer un chapitre
     */
    editChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        if (!chapitre) return;

        this.editingChapterId = chapitreId;

        // Type de chapitre
        const isIntro = !chapitre.theme_id && chapitre.discipline_id;
        if (isIntro) {
            document.getElementById('type-intro').checked = true;
            document.getElementById('chapter-discipline-select').value = chapitre.discipline_id || '';
        } else {
            document.getElementById('type-theme').checked = true;
            document.getElementById('chapter-theme-select').value = chapitre.theme_id || '';
        }
        this.toggleChapterType();

        document.getElementById('chapter-titre').value = chapitre.titre || '';
        document.getElementById('chapter-numero').value = chapitre.numero || '';
        document.getElementById('chapter-lecon').value = chapitre.numero_lecon || '';
        document.getElementById('chapter-contenu-texte').value = chapitre.contenu_texte || '';

        // Statut
        const statut = (chapitre.statut || 'brouillon').toLowerCase();
        const radioBtn = document.querySelector(`input[name="chapter-status"][value="${statut}"]`);
        if (radioBtn) radioBtn.checked = true;

        // Charger les supports
        const supportsList = document.getElementById('supports-list');
        supportsList.innerHTML = '';

        const chapterSupports = this.supports.filter(s => s.chapitre_id === chapitreId);
        if (chapterSupports.length > 0) {
            chapterSupports.forEach(support => {
                this.addSupport({
                    type: support.type,
                    nom: support.nom,
                    url: support.url
                });
            });
        } else if (chapitre.lien) {
            // Migration : utiliser l'ancien champ lien
            this.addSupport({
                type: 'document',
                nom: 'Document principal',
                url: chapitre.lien
            });
        }

        document.getElementById('modal-chapter-title').textContent = 'Modifier le chapitre';
        openModal('modal-chapter');
    },

    /**
     * Voir un chapitre
     */
    viewChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        const chapterSupports = this.supports.filter(s => s.chapitre_id === chapitreId);

        if (chapterSupports.length > 0) {
            window.open(chapterSupports[0].url, '_blank');
        } else if (chapitre && chapitre.lien) {
            window.open(chapitre.lien, '_blank');
        } else {
            alert('Ce chapitre n\'a pas de support associé.');
        }
    },

    /**
     * Supprime un chapitre
     */
    async deleteChapter(chapitreId) {
        const chapitre = this.chapitres.find(c => c.id === chapitreId);
        if (!chapitre) return;

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le chapitre "${chapitre.titre}" ?`)) {
            return;
        }

        const result = await this.callWebApp('deleteChapter', { id: chapitreId });

        if (result.success) {
            this.showNotification('Chapitre supprimé avec succès', 'success');
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Supprime un thème
     */
    async deleteTheme(themeId) {
        const theme = this.themes.find(t => t.id === themeId);
        if (!theme) return;

        const themeName = theme.nom || theme.titre || 'ce thème';
        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${themeName}" ?\n\nNote : Vous ne pourrez pas supprimer un thème qui contient des chapitres.`)) {
            return;
        }

        const result = await this.callWebApp('deleteTheme', { id: themeId });

        if (result.success) {
            this.showNotification('Thème supprimé avec succès', 'success');
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Sauvegarde un thème (création ou modification)
     */
    async saveTheme() {
        const disciplineId = document.getElementById('theme-discipline-select').value;
        const ordre = document.getElementById('theme-numero').value;
        const nom = document.getElementById('theme-titre').value;

        if (!disciplineId || !nom) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        const data = {
            discipline_id: disciplineId,
            nom: nom,
            ordre: ordre || undefined
        };

        let result;
        if (this.editingThemeId) {
            data.id = this.editingThemeId;
            result = await this.callWebApp('updateTheme', data);
        } else {
            result = await this.callWebApp('addTheme', data);
        }

        if (result.success) {
            this.showNotification(this.editingThemeId ? 'Thème modifié' : 'Thème créé', 'success');
            closeModal('modal-theme');
            this.resetThemeForm();
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Sauvegarde un chapitre (création ou modification)
     */
    async saveChapter() {
        const isIntro = document.getElementById('type-intro').checked;
        const themeId = isIntro ? '' : document.getElementById('chapter-theme-select').value;
        const disciplineId = isIntro ? document.getElementById('chapter-discipline-select').value : '';
        const titre = document.getElementById('chapter-titre').value;
        const numero = document.getElementById('chapter-numero').value;
        const numeroLecon = document.getElementById('chapter-lecon').value;
        const contenuTexte = document.getElementById('chapter-contenu-texte').value;
        const statut = document.querySelector('input[name="chapter-status"]:checked').value;

        // Validation
        if (isIntro && !disciplineId) {
            alert('Veuillez sélectionner une discipline.');
            return;
        }
        if (!isIntro && !themeId) {
            alert('Veuillez sélectionner un thème.');
            return;
        }
        if (!titre) {
            alert('Veuillez entrer un titre.');
            return;
        }

        // Récupérer les supports
        const supports = this.getSupportsFromForm();

        // Premier support pour le champ lien (rétrocompatibilité)
        const lien = supports.length > 0 ? supports[0].url : '';

        const data = {
            theme_id: themeId || undefined,
            discipline_id: disciplineId || undefined,
            titre: titre,
            numero: numero || undefined,
            numero_lecon: numeroLecon || undefined,
            contenu_texte: contenuTexte || undefined,
            lien: lien || undefined,
            statut: statut
        };

        let result;
        if (this.editingChapterId) {
            data.id = this.editingChapterId;
            result = await this.callWebApp('updateChapter', data);
        } else {
            result = await this.callWebApp('addChapter', data);
        }

        if (result.success) {
            const chapterId = this.editingChapterId || result.id;

            // Sauvegarder les supports
            if (supports.length > 0) {
                // Supprimer les anciens supports
                if (this.editingChapterId) {
                    await this.callWebApp('deleteChapterSupports', { chapitre_id: chapterId });
                }
                // Ajouter les nouveaux
                for (const support of supports) {
                    await this.callWebApp('addSupport', {
                        chapitre_id: chapterId,
                        type: support.type,
                        nom: support.nom,
                        url: support.url,
                        ordre: support.ordre
                    });
                }
            }

            this.showNotification(this.editingChapterId ? 'Chapitre modifié' : 'Chapitre créé', 'success');
            closeModal('modal-chapter');
            this.resetChapterForm();
            await this.loadData();
            this.render();
            this.populateSelects();
        } else {
            alert('Erreur : ' + result.error);
        }
    },

    /**
     * Réinitialise le formulaire thème
     */
    resetThemeForm() {
        this.editingThemeId = null;
        document.getElementById('theme-discipline-select').value = '';
        document.getElementById('theme-numero').value = '';
        document.getElementById('theme-titre').value = '';
        document.getElementById('modal-theme-title').textContent = 'Nouveau thème';
    },

    /**
     * Réinitialise le formulaire chapitre
     */
    resetChapterForm() {
        this.editingChapterId = null;
        document.getElementById('type-theme').checked = true;
        this.toggleChapterType();
        document.getElementById('chapter-theme-select').value = '';
        document.getElementById('chapter-discipline-select').value = '';
        document.getElementById('chapter-titre').value = '';
        document.getElementById('chapter-numero').value = '1';
        document.getElementById('chapter-lecon').value = '';
        document.getElementById('chapter-contenu-texte').value = '';
        document.getElementById('supports-list').innerHTML = '';
        document.querySelector('input[name="chapter-status"][value="brouillon"]').checked = true;
        document.getElementById('modal-chapter-title').textContent = 'Nouveau chapitre';

        // Ajouter un support vide par défaut
        this.addSupport();
    },

    /**
     * Affiche une notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${type === 'success' ? '✓' : 'ℹ'}</span>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    /**
     * Affiche une erreur
     */
    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <div class="icon">❌</div>
                <h3>Erreur</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    }
};

// Fonctions globales pour les modales
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Fermer modal sur clic overlay
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Export
window.AdminLecons = AdminLecons;
window.openModal = openModal;
window.closeModal = closeModal;
