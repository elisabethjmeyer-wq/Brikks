/**
 * Admin Competences - Gestion du référentiel des compétences
 */

const AdminCompetences = {
    // Data
    competences: [],

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.updateStats();
            this.renderList();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des compétences');
        }
    },

    // ========== DATA LOADING ==========
    async loadData() {
        const result = await this.callAPI('getCompetencesReferentiel', {});
        if (result.success) {
            this.competences = result.data || [];
            // Sort by ordre
            this.competences.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        }
    },

    callAPI(action, params) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            const queryParams = new URLSearchParams({
                action: action,
                callback: callbackName,
                ...params
            });

            script.src = `${CONFIG.WEBAPP_URL}?${queryParams.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed'));
            };

            document.body.appendChild(script);
        });
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        document.getElementById('addCompetenceBtn').addEventListener('click', () => {
            this.openModal();
        });
    },

    // ========== UI UPDATES ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('competences-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div style="text-align: center; color: #ef4444;">
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
            </div>
        `;
    },

    updateStats() {
        const total = this.competences.length;
        const actives = this.competences.filter(c => c.statut === 'actif').length;

        document.getElementById('totalCompetences').textContent = total;
        document.getElementById('totalActives').textContent = actives;
    },

    // ========== RENDER LIST ==========
    renderList() {
        const container = document.getElementById('competencesList');

        if (this.competences.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <p>Aucune compétence définie</p>
                    <p style="margin-top: 0.5rem; font-size: 0.875rem;">Commencez par ajouter une compétence au référentiel</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.competences.map(comp => `
            <div class="competence-item" data-id="${comp.id}">
                <div class="competence-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <div class="competence-info">
                    <div class="competence-nom">${this.escapeHtml(comp.nom)}</div>
                    <div class="competence-meta">
                        ${comp.categorie ? `<span class="competence-categorie">${this.escapeHtml(comp.categorie)}</span>` : ''}
                        <span class="competence-statut ${comp.statut}">${comp.statut === 'actif' ? 'Actif' : 'Inactif'}</span>
                        ${comp.description ? `<span title="${this.escapeHtml(comp.description)}">📝</span>` : ''}
                    </div>
                </div>
                <div class="competence-actions">
                    <button class="btn-edit" onclick="AdminCompetences.editCompetence('${comp.id}')" title="Modifier">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="btn-delete" onclick="AdminCompetences.deleteCompetence('${comp.id}')" title="Supprimer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    },

    // ========== MODAL ==========
    openModal(competence = null) {
        const modal = document.getElementById('competenceModal');
        const title = document.getElementById('modalTitle');

        if (competence) {
            title.textContent = 'Modifier la compétence';
            document.getElementById('editCompetenceId').value = competence.id;
            document.getElementById('competenceNom').value = competence.nom || '';
            document.getElementById('competenceDescription').value = competence.description || '';
            document.getElementById('competenceCategorie').value = competence.categorie || '';
            document.getElementById('competenceOrdre').value = competence.ordre || 1;
            document.getElementById('competenceStatut').value = competence.statut || 'actif';
        } else {
            title.textContent = 'Ajouter une compétence';
            document.getElementById('editCompetenceId').value = '';
            document.getElementById('competenceNom').value = '';
            document.getElementById('competenceDescription').value = '';
            document.getElementById('competenceCategorie').value = '';
            document.getElementById('competenceOrdre').value = this.competences.length + 1;
            document.getElementById('competenceStatut').value = 'actif';
        }

        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('competenceModal').classList.add('hidden');
    },

    editCompetence(id) {
        const competence = this.competences.find(c => c.id === id);
        if (competence) {
            this.openModal(competence);
        }
    },

    // ========== SAVE ==========
    async saveCompetence() {
        const id = document.getElementById('editCompetenceId').value;
        const nom = document.getElementById('competenceNom').value.trim();
        const description = document.getElementById('competenceDescription').value.trim();
        const categorie = document.getElementById('competenceCategorie').value;
        const ordre = parseInt(document.getElementById('competenceOrdre').value) || 1;
        const statut = document.getElementById('competenceStatut').value;

        if (!nom) {
            alert('Le nom de la compétence est requis');
            return;
        }

        const data = { nom, description, categorie, ordre, statut };

        try {
            let result;
            if (id) {
                data.id = id;
                result = await this.callAPI('updateCompetenceReferentiel', data);
            } else {
                result = await this.callAPI('createCompetenceReferentiel', data);
            }

            if (result.success) {
                await this.loadData();
                this.updateStats();
                this.renderList();
                this.closeModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    // ========== DELETE ==========
    deleteCompetence(id) {
        const competence = this.competences.find(c => c.id === id);
        if (!competence) return;

        document.getElementById('deleteId').value = id;
        document.getElementById('deleteMessage').textContent =
            `Êtes-vous sûr de vouloir supprimer la compétence "${competence.nom}" ?`;
        document.getElementById('deleteModal').classList.remove('hidden');
    },

    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    },

    async confirmDelete() {
        const id = document.getElementById('deleteId').value;

        try {
            const result = await this.callAPI('deleteCompetenceReferentiel', { id });

            if (result.success) {
                await this.loadData();
                this.updateStats();
                this.renderList();
                this.closeDeleteModal();
            } else {
                alert('Erreur: ' + (result.error || 'Erreur inconnue'));
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    // ========== UTILITIES ==========
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Make it globally accessible
window.AdminCompetences = AdminCompetences;
