/**
 * Admin Suivi - Suivi des activités élèves
 */

const AdminSuivi = {
    eleveTaches: [],
    eleves: [],
    tachesComplexes: [],
    currentFilter: 'all',

    async init() {
        await this.loadData();
        this.render();
    },

    async loadData() {
        try {
            const [eleveTachesResult, elevesResult, tachesResult] = await Promise.all([
                this.callAPI('getEleveTachesComplexes', {}),
                this.callAPI('getUtilisateurs', {}),
                this.callAPI('getTachesComplexes', {})
            ]);

            if (eleveTachesResult.success) {
                this.eleveTaches = eleveTachesResult.data || [];
            }
            if (elevesResult.success) {
                this.eleves = (elevesResult.data || []).filter(u => u.role === 'eleve');
            }
            if (tachesResult.success) {
                this.tachesComplexes = tachesResult.data || [];
            }
        } catch (error) {
            console.error('Erreur chargement données suivi:', error);
        }
    },

    render() {
        const container = document.getElementById('suivi-content');

        // Count stats
        const pendingCount = this.eleveTaches.filter(t => t.statut === 'soumis').length;
        const inProgressCount = this.eleveTaches.filter(t => t.statut === 'en_cours').length;
        const completedCount = this.eleveTaches.filter(t => t.statut === 'termine' || t.statut === 'corrige').length;
        const pointsBonusCount = this.eleveTaches.filter(t => t.mode === 'points_bonus').length;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1><span class="header-icon">👁️</span> Suivi des activités</h1>
                    <p class="page-subtitle">Suivez les activités de vos élèves en temps réel</p>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon-wrapper red">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="stat-value">${pendingCount}</div>
                    <div class="stat-label">Copies à corriger</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper orange">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </div>
                    <div class="stat-value">${inProgressCount}</div>
                    <div class="stat-label">En cours</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper green">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div class="stat-value">${completedCount}</div>
                    <div class="stat-label">Terminées</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper purple">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                    </div>
                    <div class="stat-value">${pointsBonusCount}</div>
                    <div class="stat-label">Points bonus</div>
                </div>
            </div>

            <div class="suivi-section">
                <div class="section-header">
                    <h2>Entraînements de compétences</h2>
                    <div class="filter-tabs">
                        <button class="filter-tab ${this.currentFilter === 'all' ? 'active' : ''}" onclick="AdminSuivi.setFilter('all')">
                            Tous
                        </button>
                        <button class="filter-tab ${this.currentFilter === 'soumis' ? 'active' : ''}" onclick="AdminSuivi.setFilter('soumis')">
                            À corriger ${pendingCount > 0 ? `<span class="tab-badge">${pendingCount}</span>` : ''}
                        </button>
                        <button class="filter-tab ${this.currentFilter === 'en_cours' ? 'active' : ''}" onclick="AdminSuivi.setFilter('en_cours')">
                            En cours
                        </button>
                        <button class="filter-tab ${this.currentFilter === 'termine' ? 'active' : ''}" onclick="AdminSuivi.setFilter('termine')">
                            Terminées
                        </button>
                    </div>
                </div>
                <div class="suivi-list" id="suiviList">
                    ${this.renderActivitiesList()}
                </div>
            </div>
        `;
    },

    renderActivitiesList() {
        let filteredTaches = [...this.eleveTaches];

        // Apply filter
        if (this.currentFilter === 'soumis') {
            filteredTaches = filteredTaches.filter(t => t.statut === 'soumis');
        } else if (this.currentFilter === 'en_cours') {
            filteredTaches = filteredTaches.filter(t => t.statut === 'en_cours');
        } else if (this.currentFilter === 'termine') {
            filteredTaches = filteredTaches.filter(t => t.statut === 'termine' || t.statut === 'corrige');
        }

        // Sort by date (most recent first)
        filteredTaches.sort((a, b) => {
            const dateA = new Date(a.date_soumission || a.date_debut || 0);
            const dateB = new Date(b.date_soumission || b.date_debut || 0);
            return dateB - dateA;
        });

        if (filteredTaches.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <h3>Aucune activité</h3>
                    <p>Aucune activité ne correspond à ce filtre.</p>
                </div>
            `;
        }

        return filteredTaches.map(tache => this.renderActivityCard(tache)).join('');
    },

    renderActivityCard(tache) {
        const eleve = this.eleves.find(e => e.id === tache.eleve_id);
        const tacheComplexe = this.tachesComplexes.find(t => t.id === tache.tache_id);

        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || eleve.identifiant : 'Élève inconnu';
        const tacheName = tacheComplexe ? tacheComplexe.titre : 'Tâche inconnue';

        const statusConfig = {
            'en_cours': { label: 'En cours', class: 'status-progress', icon: '⏳' },
            'soumis': { label: 'À corriger', class: 'status-pending', icon: '📝' },
            'termine': { label: 'Terminé', class: 'status-done', icon: '✅' },
            'corrige': { label: 'Corrigé', class: 'status-done', icon: '✅' }
        };

        const status = statusConfig[tache.statut] || { label: tache.statut, class: '', icon: '❓' };
        const modeLabel = tache.mode === 'points_bonus' ? 'Points bonus' : 'Entraînement';
        const modeClass = tache.mode === 'points_bonus' ? 'mode-bonus' : 'mode-training';

        // Format dates
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const actionButtons = tache.statut === 'soumis' ? `
            <button class="btn btn-primary btn-sm" onclick="AdminSuivi.markAsCorrected('${tache.id}')">
                Marquer comme corrigé
            </button>
        ` : '';

        return `
            <div class="activity-card ${tache.statut === 'soumis' ? 'highlight' : ''}">
                <div class="activity-header">
                    <div class="activity-eleve">
                        <div class="eleve-avatar">${this.getInitials(eleveName)}</div>
                        <div class="eleve-info">
                            <div class="eleve-name">${this.escapeHtml(eleveName)}</div>
                            <div class="activity-tache">${this.escapeHtml(tacheName)}</div>
                        </div>
                    </div>
                    <div class="activity-badges">
                        <span class="mode-badge ${modeClass}">${modeLabel}</span>
                        <span class="status-badge ${status.class}">${status.icon} ${status.label}</span>
                    </div>
                </div>
                <div class="activity-details">
                    <div class="detail-item">
                        <span class="detail-label">Début</span>
                        <span class="detail-value">${formatDate(tache.date_debut)}</span>
                    </div>
                    ${tache.date_soumission ? `
                        <div class="detail-item">
                            <span class="detail-label">Soumission</span>
                            <span class="detail-value">${formatDate(tache.date_soumission)}</span>
                        </div>
                    ` : ''}
                    ${tache.temps_passe ? `
                        <div class="detail-item">
                            <span class="detail-label">Temps passé</span>
                            <span class="detail-value">${this.formatDuration(tache.temps_passe)}</span>
                        </div>
                    ` : ''}
                </div>
                ${actionButtons ? `<div class="activity-actions">${actionButtons}</div>` : ''}
            </div>
        `;
    },

    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    },

    async markAsCorrected(tacheId) {
        try {
            const result = await this.callAPI('updateEleveTacheComplexe', {
                id: tacheId,
                statut: 'corrige',
                date_correction: new Date().toISOString()
            });

            if (result.success) {
                // Mettre à jour localement
                const tache = this.eleveTaches.find(t => t.id === tacheId);
                if (tache) {
                    tache.statut = 'corrige';
                }
                this.render();

                // Mettre à jour les badges de notification
                const pendingCount = this.eleveTaches.filter(t => t.statut === 'soumis').length;
                AdminLayout.updateNotificationBadges(pendingCount);
            } else {
                alert('Erreur lors de la mise à jour');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur lors de la mise à jour');
        }
    },

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    },

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remainMins = mins % 60;
            return `${hours}h ${remainMins}min`;
        }
        return `${mins}min ${secs}s`;
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const url = new URL(CONFIG.API_URL);
            url.searchParams.append('action', action);
            url.searchParams.append('callback', callbackName);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    url.searchParams.append(key, params[key]);
                }
            });

            window[callbackName] = (response) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(response);
            };

            const script = document.createElement('script');
            script.src = url.toString();
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };
            document.body.appendChild(script);
        });
    }
};

window.AdminSuivi = AdminSuivi;
