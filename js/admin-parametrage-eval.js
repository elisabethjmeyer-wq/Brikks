/**
 * Admin Paramétrage Évaluations
 * Onglet 1 : Configuration des notes de progression (par matière/semestre)
 * Onglet 2 : Référentiel des compétences avec critères de réussite
 */

const AdminParametrageEval = {
    // State
    parametresNotes: [],
    competences: [],
    criteresAll: [],
    criteresTemp: [],
    critereCounter: 0,
    currentMatiereFilter: 'all',
    hasNotesChanges: false,
    originalNotesData: null,
    _saving: false,

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.populateNotesForm();
            this.renderReferentiel();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des paramètres');
        }
    },

    // ========== DATA LOADING ==========
    async loadData() {
        var [notesResult, compResult, critResult] = await Promise.all([
            this.callAPI('getParametresNotes', {}),
            this.callAPI('getCompetencesReferentiel', {}),
            this.callAPI('getCriteresReussite', {})
        ]);

        if (notesResult.success) {
            this.parametresNotes = notesResult.data || [];
        }
        if (compResult.success) {
            this.competences = (compResult.data || []).sort(function(a, b) {
                return (a.ordre || 0) - (b.ordre || 0);
            });
        }
        if (critResult.success) {
            this.criteresAll = critResult.data || [];
        }
    },

    callAPI(action, params) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var timeout = setTimeout(function() {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Timeout'));
            }, 30000);

            window[callbackName] = function(response) {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            var queryParams = new URLSearchParams(Object.assign({ action: action, callback: callbackName }, params));
            var script = document.createElement('script');
            script.src = CONFIG.WEBAPP_URL + '?' + queryParams.toString();
            script.onerror = function() {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Erreur réseau'));
            };
            document.body.appendChild(script);
        });
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        var self = this;

        // Tab switching
        document.querySelectorAll('.param-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self.switchTab(this.dataset.tab);
            });
        });

        // Notes form change detection
        var noteFields = ['sem1Debut', 'sem1Fin', 'sem2Debut', 'sem2Fin',
                          'frNoteDepart', 'frBudget', 'frCoefficient',
                          'hgNoteDepart', 'hgBudget', 'hgCoefficient'];
        noteFields.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', function() { self.markNotesChanged(); });
            }
        });

        // Referentiel filter buttons
        document.querySelectorAll('.filter-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
                this.classList.add('active');
                self.currentMatiereFilter = this.dataset.matiere;
                self.renderReferentiel();
            });
        });

        // Add competence button
        document.getElementById('addCompetenceBtn').addEventListener('click', function() {
            self.openCompModal();
        });
    },

    // ========== TAB MANAGEMENT ==========
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.param-tab').forEach(function(tab) {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show/hide content
        document.querySelectorAll('.tab-content').forEach(function(content) {
            content.style.display = 'none';
        });
        var target = document.getElementById('tab-' + tabName);
        if (target) target.style.display = 'block';
    },

    // ========== UI HELPERS ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('tab-notes').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML =
            '<div style="text-align: center; color: #ef4444;">' +
                '<p>' + escapeHtml(message) + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Réessayer</button>' +
            '</div>';
    },

    showNotification(message, type) {
        var notif = document.createElement('div');
        notif.className = 'notification notification-' + (type || 'success');
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(function() { notif.classList.add('show'); }, 10);
        setTimeout(function() {
            notif.classList.remove('show');
            setTimeout(function() { notif.remove(); }, 300);
        }, type === 'error' ? 6000 : 4000);
    },

    // ========== NOTES DE PROGRESSION ==========
    populateNotesForm() {
        var self = this;

        // Populate each matière/semester pair
        this.parametresNotes.forEach(function(p) {
            var matiere = String(p.matiere).trim();
            var semestre = String(p.semestre).trim();

            if (semestre === '1') {
                if (p.date_debut) document.getElementById('sem1Debut').value = self._toDateInput(p.date_debut);
                if (p.date_fin) document.getElementById('sem1Fin').value = self._toDateInput(p.date_fin);
            }
            if (semestre === '2') {
                if (p.date_debut) document.getElementById('sem2Debut').value = self._toDateInput(p.date_debut);
                if (p.date_fin) document.getElementById('sem2Fin').value = self._toDateInput(p.date_fin);
            }

            if (matiere === 'FR') {
                if (p.note_depart !== undefined && p.note_depart !== '') document.getElementById('frNoteDepart').value = p.note_depart;
                if (p.budget_estime !== undefined && p.budget_estime !== '') document.getElementById('frBudget').value = p.budget_estime;
                if (p.coefficient_progression !== undefined && p.coefficient_progression !== '') document.getElementById('frCoefficient').value = p.coefficient_progression;
            }
            if (matiere === 'HG-EMC') {
                if (p.note_depart !== undefined && p.note_depart !== '') document.getElementById('hgNoteDepart').value = p.note_depart;
                if (p.budget_estime !== undefined && p.budget_estime !== '') document.getElementById('hgBudget').value = p.budget_estime;
                if (p.coefficient_progression !== undefined && p.coefficient_progression !== '') document.getElementById('hgCoefficient').value = p.coefficient_progression;
            }
        });

        // Snapshot for cancel
        this.originalNotesData = this._getNotesFormData();
        this.hasNotesChanges = false;
    },

    _toDateInput(dateStr) {
        if (!dateStr) return '';
        // Handle ISO dates or YYYY-MM-DD
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr).substring(0, 10);
        return d.toISOString().substring(0, 10);
    },

    _getNotesFormData() {
        return {
            sem1Debut: document.getElementById('sem1Debut').value,
            sem1Fin: document.getElementById('sem1Fin').value,
            sem2Debut: document.getElementById('sem2Debut').value,
            sem2Fin: document.getElementById('sem2Fin').value,
            frNoteDepart: document.getElementById('frNoteDepart').value,
            frBudget: document.getElementById('frBudget').value,
            frCoefficient: document.getElementById('frCoefficient').value,
            hgNoteDepart: document.getElementById('hgNoteDepart').value,
            hgBudget: document.getElementById('hgBudget').value,
            hgCoefficient: document.getElementById('hgCoefficient').value
        };
    },

    markNotesChanged() {
        this.hasNotesChanges = true;
        document.getElementById('notesSaveBar').style.display = 'flex';
    },

    cancelNotesChanges() {
        if (!this.originalNotesData) return;
        var data = this.originalNotesData;
        Object.keys(data).forEach(function(key) {
            var el = document.getElementById(key);
            if (el) el.value = data[key];
        });
        this.hasNotesChanges = false;
        document.getElementById('notesSaveBar').style.display = 'none';
    },

    async saveNotesConfig() {
        if (this._saving) return;
        this._saving = true;

        var data = this._getNotesFormData();

        try {
            // Save FR semestre 1
            await this.callAPI('saveParametresNotes', {
                matiere: 'FR', semestre: '1',
                note_depart: data.frNoteDepart, budget_estime: data.frBudget,
                coefficient_progression: data.frCoefficient,
                date_debut: data.sem1Debut, date_fin: data.sem1Fin
            });

            // Save FR semestre 2
            await this.callAPI('saveParametresNotes', {
                matiere: 'FR', semestre: '2',
                note_depart: data.frNoteDepart, budget_estime: data.frBudget,
                coefficient_progression: data.frCoefficient,
                date_debut: data.sem2Debut, date_fin: data.sem2Fin
            });

            // Save HG-EMC semestre 1
            await this.callAPI('saveParametresNotes', {
                matiere: 'HG-EMC', semestre: '1',
                note_depart: data.hgNoteDepart, budget_estime: data.hgBudget,
                coefficient_progression: data.hgCoefficient,
                date_debut: data.sem1Debut, date_fin: data.sem1Fin
            });

            // Save HG-EMC semestre 2
            await this.callAPI('saveParametresNotes', {
                matiere: 'HG-EMC', semestre: '2',
                note_depart: data.hgNoteDepart, budget_estime: data.hgBudget,
                coefficient_progression: data.hgCoefficient,
                date_debut: data.sem2Debut, date_fin: data.sem2Fin
            });

            this.originalNotesData = data;
            this.hasNotesChanges = false;
            document.getElementById('notesSaveBar').style.display = 'none';
            this.showNotification('Paramètres enregistrés');
        } catch (error) {
            console.error('Erreur sauvegarde paramètres:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            this._saving = false;
        }
    },

    // ========== REFERENTIEL COMPETENCES ==========
    getCriteresForCompetence(competenceId) {
        return this.criteresAll
            .filter(function(c) { return String(c.competence_id) === String(competenceId); })
            .sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    },

    renderReferentiel() {
        var self = this;
        var container = document.getElementById('referentielList');
        var emptyState = document.getElementById('referentielEmpty');

        var filtered = this.competences;
        if (this.currentMatiereFilter !== 'all') {
            filtered = filtered.filter(function(c) {
                return (c.matiere || 'Transversal') === self.currentMatiereFilter;
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        var html = filtered.map(function(comp) {
            var criteres = self.getCriteresForCompetence(comp.id);
            var matiere = comp.matiere || 'Transversal';
            var matiereLabel = matiere === 'FR' ? '🇫🇷 FR' : matiere === 'HG-EMC' ? '🌍 HG-EMC' : '🔗 Transversal';
            var matiereClass = matiere === 'FR' ? 'fr' : matiere === 'HG-EMC' ? 'hg' : 'transversal';

            return '<div class="comp-card">' +
                '<div class="comp-card-header">' +
                    '<div class="comp-card-info">' +
                        '<span class="comp-matiere-badge ' + matiereClass + '">' + matiereLabel + '</span>' +
                        '<h3 class="comp-name">' + escapeHtml(comp.nom) + '</h3>' +
                        (comp.description ? '<p class="comp-desc">' + escapeHtml(comp.description) + '</p>' : '') +
                    '</div>' +
                    '<div class="comp-card-actions">' +
                        '<button class="btn-icon" onclick="AdminParametrageEval.openCompModal(\'' + comp.id + '\')" title="Modifier">✏️</button>' +
                        '<button class="btn-icon" onclick="AdminParametrageEval.openDeleteModal(\'' + comp.id + '\')" title="Supprimer">🗑️</button>' +
                    '</div>' +
                '</div>' +
                (criteres.length > 0 ?
                    '<div class="comp-criteres">' +
                        criteres.map(function(c) {
                            return '<div class="critere-item">• ' + escapeHtml(c.libelle) + '</div>';
                        }).join('') +
                    '</div>'
                : '<div class="comp-no-criteres">Aucun critère défini</div>') +
            '</div>';
        }).join('');

        container.innerHTML = html;
    },

    // ========== COMPETENCE MODAL ==========
    openCompModal(competenceId) {
        var modal = document.getElementById('competenceModal');
        var titleEl = document.getElementById('compModalTitle');
        var saveBtn = document.getElementById('compSaveBtn');

        document.getElementById('editCompetenceId').value = '';
        document.getElementById('compNom').value = '';
        document.getElementById('compMatiere').value = 'Transversal';
        document.getElementById('compDescription').value = '';
        document.getElementById('compConsigne').value = '';
        this.criteresTemp = [];
        this.critereCounter = 0;

        if (competenceId) {
            // Edit mode
            var comp = this.competences.find(function(c) { return String(c.id) === String(competenceId); });
            if (comp) {
                document.getElementById('editCompetenceId').value = comp.id;
                document.getElementById('compNom').value = comp.nom || '';
                document.getElementById('compMatiere').value = comp.matiere || 'Transversal';
                document.getElementById('compDescription').value = comp.description || '';
                document.getElementById('compConsigne').value = comp.consigne || '';

                this.criteresTemp = this.getCriteresForCompetence(comp.id).map(function(c) {
                    return { id: c.id, libelle: c.libelle, ordre: c.ordre };
                });
            }
            titleEl.textContent = 'Modifier la compétence';
            saveBtn.textContent = 'Enregistrer';
        } else {
            titleEl.textContent = 'Ajouter une compétence';
            saveBtn.textContent = 'Créer';
        }

        this.renderCriteresEdit();
        modal.classList.remove('hidden');
    },

    closeCompModal() {
        document.getElementById('competenceModal').classList.add('hidden');
    },

    addCritereField() {
        this.critereCounter++;
        this.criteresTemp.push({ id: null, libelle: '', ordre: this.critereCounter });
        this.renderCriteresEdit();

        // Focus the new input
        var inputs = document.querySelectorAll('#criteresList input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
    },

    removeCritereField(index) {
        this.criteresTemp.splice(index, 1);
        this.renderCriteresEdit();
    },

    renderCriteresEdit() {
        var container = document.getElementById('criteresList');
        if (this.criteresTemp.length === 0) {
            container.innerHTML = '<p class="form-hint" style="margin: 0;">Aucun critère. Cliquez sur "Ajouter un critère".</p>';
            return;
        }

        container.innerHTML = this.criteresTemp.map(function(c, i) {
            return '<div class="critere-edit-row">' +
                '<input type="text" class="form-input critere-input" value="' + escapeHtml(c.libelle || '') + '" ' +
                    'placeholder="Ex: Identifier la nature du document" ' +
                    'onchange="AdminParametrageEval.criteresTemp[' + i + '].libelle = this.value">' +
                '<button class="btn-icon btn-remove" onclick="AdminParametrageEval.removeCritereField(' + i + ')" title="Supprimer">×</button>' +
            '</div>';
        }).join('');
    },

    async saveCompetence() {
        if (this._saving) return;

        var nom = document.getElementById('compNom').value.trim();
        if (!nom) {
            this.showNotification('Le nom de la compétence est requis', 'error');
            return;
        }

        this._saving = true;
        var editId = document.getElementById('editCompetenceId').value;
        var matiere = document.getElementById('compMatiere').value;
        var description = document.getElementById('compDescription').value.trim();
        var consigne = document.getElementById('compConsigne').value.trim();

        try {
            var compId;

            if (editId) {
                // Update
                await this.callAPI('updateCompetenceReferentiel', {
                    id: editId, nom: nom, matiere: matiere,
                    description: description, consigne: consigne
                });
                compId = editId;

                // Delete existing critères then recreate
                var existingCriteres = this.getCriteresForCompetence(editId);
                for (var i = 0; i < existingCriteres.length; i++) {
                    await this.callAPI('deleteCritereReussite', { id: existingCriteres[i].id });
                }
            } else {
                // Create
                var result = await this.callAPI('createCompetenceReferentiel', {
                    nom: nom, matiere: matiere, description: description,
                    consigne: consigne, ordre: this.competences.length + 1
                });
                if (!result.success) {
                    throw new Error(result.error || 'Erreur création');
                }
                compId = result.id;
            }

            // Create critères
            var validCriteres = this.criteresTemp.filter(function(c) { return c.libelle && c.libelle.trim(); });
            for (var j = 0; j < validCriteres.length; j++) {
                var res = await this.callAPI('createCritereReussite', {
                    competence_id: compId,
                    libelle: validCriteres[j].libelle.trim(),
                    ordre: j + 1
                });
                if (!res.success) {
                    console.error('Erreur création critère:', res.error);
                }
            }

            this.closeCompModal();
            this.showNotification(editId ? 'Compétence modifiée' : 'Compétence créée');

            // Reload data
            await this.loadData();
            this.renderReferentiel();
        } catch (error) {
            console.error('Erreur sauvegarde compétence:', error);
            this.showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            this._saving = false;
        }
    },

    // ========== DELETE ==========
    openDeleteModal(competenceId) {
        document.getElementById('deleteId').value = competenceId;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        var id = document.getElementById('deleteId').value;
        if (!id) return;

        try {
            // Delete critères first
            var criteres = this.getCriteresForCompetence(id);
            for (var i = 0; i < criteres.length; i++) {
                await this.callAPI('deleteCritereReussite', { id: criteres[i].id });
            }

            // Delete competence
            var result = await this.callAPI('deleteCompetenceReferentiel', { id: id });
            if (!result.success) {
                throw new Error(result.error || 'Erreur suppression');
            }

            this.closeDeleteModal();
            this.showNotification('Compétence supprimée');

            await this.loadData();
            this.renderReferentiel();
        } catch (error) {
            console.error('Erreur suppression:', error);
            this.showNotification('Erreur lors de la suppression', 'error');
        }
    }
};
