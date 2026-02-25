/**
 * Admin Competences - Référentiel des compétences
 * Gère les compétences et leurs critères de réussite.
 * Les entraînements (exercices) sont gérés dans Banques d'exercices > Compétences.
 */

const AdminCompetences = {
    // Data
    competences: [],
    criteresAll: [],
    criteresTemp: [],
    critereCounter: 0,
    expandedCards: new Set(),

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderProgressBanner();
            this.renderList();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des compétences');
        }
    },

    // ========== DATA LOADING ==========
    async loadData() {
        const [compResult, critResult] = await Promise.all([
            this.callAPI('getCompetencesReferentiel', {}),
            this.callAPI('getCriteresReussite', {})
        ]);

        if (compResult.success) {
            this.competences = compResult.data || [];
            this.competences.sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
        }

        if (critResult.success) {
            this.criteresAll = critResult.data || [];
        }
    },

    getCriteresForCompetence(competenceId) {
        return this.criteresAll
            .filter(function(c) { return c.competence_id === competenceId; })
            .sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    },

    callAPI(action, params) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            var queryParams = new URLSearchParams(Object.assign({ action: action, callback: callbackName }, params));
            script.src = CONFIG.WEBAPP_URL + '?' + queryParams.toString();
            script.onerror = function() {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed'));
            };

            document.body.appendChild(script);
        });
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        document.getElementById('addCompetenceBtn').addEventListener('click', function() {
            AdminCompetences.openModal();
        });
    },

    // ========== UI UPDATES ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('competences-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML =
            '<div style="text-align: center; color: #ef4444;">' +
                '<p>' + this.escapeHtml(message) + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Réessayer</button>' +
            '</div>';
    },

    renderProgressBanner() {
        var total = this.competences.length;

        var container = document.getElementById('progressBanner');
        container.innerHTML =
            '<span class="progress-text">' + total + ' compétence' + (total > 1 ? 's' : '') + ' au référentiel</span>';
    },

    // ========== RENDER LIST ==========
    renderList() {
        var container = document.getElementById('competencesList');
        var self = this;

        if (this.competences.length === 0) {
            container.innerHTML =
                '<div class="empty-state">' +
                    '<div class="empty-state-icon">🎯</div>' +
                    '<p>Aucune compétence définie</p>' +
                    '<p class="empty-state-sub">Commencez par ajouter une compétence au référentiel</p>' +
                '</div>';
            return;
        }

        container.innerHTML = this.competences.map(function(comp) {
            var criteres = self.getCriteresForCompetence(comp.id);
            var criteresCount = criteres.length;
            var isExpanded = self.expandedCards.has(comp.id);

            var cardHtml =
                '<div class="comp-card' + (isExpanded ? ' expanded' : '') + '" data-id="' + comp.id + '">' +
                    // Header (clickable pour déplier)
                    '<div class="comp-card-header" onclick="AdminCompetences.toggleExpand(\'' + comp.id + '\')">' +
                        '<div class="comp-card-icon">' +
                            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
                                '<polyline points="22 4 12 14.01 9 11.01"/>' +
                            '</svg>' +
                        '</div>' +
                        '<div class="comp-card-content">' +
                            '<div class="comp-card-top">' +
                                '<span class="comp-card-nom">' + self.escapeHtml(comp.nom) + '</span>' +
                                (criteresCount > 0 ? '<span class="comp-badge badge-criteres">' + criteresCount + ' critère' + (criteresCount > 1 ? 's' : '') + '</span>' : '') +
                            '</div>' +
                            (comp.description ? '<p class="comp-card-desc">' + self.escapeHtml(comp.description) + '</p>' : '') +
                        '</div>' +
                        '<div class="comp-card-actions" onclick="event.stopPropagation()">' +
                            // Edit
                            '<button class="btn-icon btn-edit" onclick="AdminCompetences.editCompetence(\'' + comp.id + '\')" title="Modifier">' +
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                    '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>' +
                                    '<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' +
                                '</svg>' +
                            '</button>' +
                            // Delete
                            '<button class="btn-icon btn-delete" onclick="AdminCompetences.deleteCompetence(\'' + comp.id + '\')" title="Supprimer">' +
                                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                    '<polyline points="3 6 5 6 21 6"/>' +
                                    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
                                '</svg>' +
                            '</button>' +
                        '</div>' +
                        // Chevron
                        '<div class="comp-card-chevron">' +
                            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                '<polyline points="6 9 12 15 18 9"/>' +
                            '</svg>' +
                        '</div>' +
                    '</div>';

            // Body (critères, visible seulement si déplié)
            if (criteresCount > 0) {
                cardHtml +=
                    '<div class="comp-card-body" style="' + (isExpanded ? '' : 'display:none') + '">' +
                        '<div class="comp-criteres-header">' +
                            '<h4>Critères de réussite</h4>' +
                            '<span class="comp-criteres-rule">Tous doivent être validés</span>' +
                        '</div>' +
                        '<ol class="comp-criteres-list">' +
                            criteres.map(function(c) {
                                return '<li>' + self.escapeHtml(c.libelle) + '</li>';
                            }).join('') +
                        '</ol>' +
                    '</div>';
            } else {
                cardHtml +=
                    '<div class="comp-card-body" style="' + (isExpanded ? '' : 'display:none') + '">' +
                        '<p class="comp-no-criteres">Aucun critère défini — ajoutez-en via le bouton modifier.</p>' +
                    '</div>';
            }

            cardHtml += '</div>';
            return cardHtml;
        }).join('');
    },

    // ========== CARD INTERACTIONS ==========
    toggleExpand(id) {
        if (this.expandedCards.has(id)) {
            this.expandedCards.delete(id);
        } else {
            this.expandedCards.add(id);
        }

        var card = document.querySelector('.comp-card[data-id="' + id + '"]');
        if (!card) return;

        var body = card.querySelector('.comp-card-body');
        var isExpanded = this.expandedCards.has(id);

        card.classList.toggle('expanded', isExpanded);
        if (body) body.style.display = isExpanded ? '' : 'none';
    },

    // ========== MODAL ==========
    openModal(competence) {
        var modal = document.getElementById('competenceModal');
        var title = document.getElementById('modalTitle');
        var saveBtn = document.getElementById('modalSaveBtn');

        this.criteresTemp = [];
        this.critereCounter = 0;

        if (competence) {
            title.textContent = 'Modifier la compétence';
            saveBtn.textContent = 'Enregistrer';
            document.getElementById('editCompetenceId').value = competence.id;
            document.getElementById('competenceNom').value = competence.nom || '';
            document.getElementById('competenceDescription').value = competence.description || '';
            document.getElementById('competenceConsigne').value = competence.consigne || '';

            // Charger les critères existants
            var existingCriteres = this.getCriteresForCompetence(competence.id);
            var self = this;
            existingCriteres.forEach(function(c) {
                self.criteresTemp.push({
                    id: c.id,
                    libelle: c.libelle,
                    ordre: c.ordre,
                    isExisting: true
                });
            });
        } else {
            title.textContent = 'Ajouter une compétence';
            saveBtn.textContent = 'Créer la compétence';
            document.getElementById('editCompetenceId').value = '';
            document.getElementById('competenceNom').value = '';
            document.getElementById('competenceDescription').value = '';
            document.getElementById('competenceConsigne').value = '';
        }

        this.renderCriteresList();
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('competenceModal').classList.add('hidden');
    },

    editCompetence(id) {
        var competence = this.competences.find(function(c) { return c.id === id; });
        if (competence) {
            this.openModal(competence);
        }
    },

    // ========== CRITERES MANAGEMENT ==========
    renderCriteresList() {
        var container = document.getElementById('criteresList');
        var self = this;

        if (this.criteresTemp.length === 0) {
            container.innerHTML =
                '<div class="criteres-empty">' +
                    '<p>Aucun critère défini</p>' +
                '</div>';
            return;
        }

        container.innerHTML = this.criteresTemp.map(function(critere, index) {
            return '<div class="critere-field" data-index="' + index + '">' +
                '<span class="critere-order">' + (index + 1) + '</span>' +
                '<input type="text" class="critere-input" value="' + self.escapeHtml(critere.libelle) + '"' +
                ' placeholder="Ex: Le texte est rédigé en phrases complètes"' +
                ' onchange="AdminCompetences.updateCritereText(' + index + ', this.value)">' +
                '<button type="button" class="btn-remove-critere" onclick="AdminCompetences.removeCritere(' + index + ')" title="Supprimer">' +
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<line x1="18" y1="6" x2="6" y2="18"/>' +
                        '<line x1="6" y1="6" x2="18" y2="18"/>' +
                    '</svg>' +
                '</button>' +
            '</div>';
        }).join('');
    },

    addCritereField() {
        this.critereCounter++;
        this.criteresTemp.push({
            id: null,
            libelle: '',
            ordre: this.criteresTemp.length + 1,
            isNew: true
        });
        this.renderCriteresList();

        setTimeout(function() {
            var inputs = document.querySelectorAll('.critere-input');
            if (inputs.length > 0) {
                inputs[inputs.length - 1].focus();
            }
        }, 50);
    },

    updateCritereText(index, value) {
        if (this.criteresTemp[index]) {
            this.criteresTemp[index].libelle = value;
        }
    },

    removeCritere(index) {
        this.criteresTemp.splice(index, 1);
        this.criteresTemp.forEach(function(c, i) { c.ordre = i + 1; });
        this.renderCriteresList();
    },

    // ========== SAVE ==========
    async saveCompetence() {
        if (this._saving) return;

        var id = document.getElementById('editCompetenceId').value;
        var nom = document.getElementById('competenceNom').value.trim();
        var description = document.getElementById('competenceDescription').value.trim();
        var consigne = document.getElementById('competenceConsigne').value.trim();

        if (!nom) {
            alert('Le nom de la compétence est requis');
            return;
        }

        var validCriteres = this.criteresTemp.filter(function(c) { return c.libelle && c.libelle.trim(); });
        var data = { nom: nom, description: description, consigne: consigne };

        // Pour une nouvelle compétence, visible par défaut
        if (!id) {
            data.ordre = this.competences.length + 1;
            data.visible = true;
        }

        this._saving = true;
        var saveBtn = document.getElementById('modalSaveBtn');
        var saveBtnText = saveBtn ? saveBtn.textContent : '';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Enregistrement...'; }

        try {
            var competenceId = id;
            var result;

            if (id) {
                data.id = id;
                result = await this.callAPI('updateCompetenceReferentiel', data);
            } else {
                result = await this.callAPI('createCompetenceReferentiel', data);
                if (result.success && result.id) {
                    competenceId = result.id;
                }
            }

            if (!result.success) {
                alert('Erreur : ' + (result.error || 'Erreur inconnue'));
                return;
            }

            // Gérer les critères
            // 1. Supprimer ceux retirés de la liste
            if (id) {
                var existingCriteres = this.getCriteresForCompetence(id);
                var self = this;
                for (var j = 0; j < existingCriteres.length; j++) {
                    var existing = existingCriteres[j];
                    var stillExists = self.criteresTemp.find(function(c) { return c.id === existing.id; });
                    if (!stillExists) {
                        await self.callAPI('deleteCritereReussite', { id: existing.id });
                    }
                }
            }

            // 2. Créer ou mettre à jour les critères
            for (var i = 0; i < validCriteres.length; i++) {
                var critere = validCriteres[i];
                var critereData = {
                    competence_id: competenceId,
                    libelle: critere.libelle.trim(),
                    ordre: i + 1
                };

                if (critere.id && critere.isExisting) {
                    critereData.id = critere.id;
                    await this.callAPI('updateCritereReussite', critereData);
                } else {
                    await this.callAPI('createCritereReussite', critereData);
                }
            }

            await this.loadData();
            this.renderProgressBanner();
            this.renderList();
            this.closeModal();
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        } finally {
            this._saving = false;
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = saveBtnText; }
        }
    },

    // ========== DELETE ==========
    deleteCompetence(id) {
        var competence = this.competences.find(function(c) { return c.id === id; });
        if (!competence) return;

        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            'Êtes-vous sûr de vouloir supprimer la compétence « ' + competence.nom + ' » et tous ses critères ?';
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        var id = document.getElementById('deleteId').value;

        try {
            // Supprimer les critères d'abord
            var criteres = this.getCriteresForCompetence(id);
            for (var i = 0; i < criteres.length; i++) {
                await this.callAPI('deleteCritereReussite', { id: criteres[i].id });
            }

            var result = await this.callAPI('deleteCompetenceReferentiel', { id: id });

            if (result.success) {
                this.expandedCards.delete(id);
                await this.loadData();
                this.renderProgressBanner();
                this.renderList();
                this.closeDeleteModal();
            } else {
                alert('Erreur : ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    // ========== UTILITIES ==========
    escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.AdminCompetences = AdminCompetences;
