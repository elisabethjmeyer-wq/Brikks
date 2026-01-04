/**
 * Admin Suivi - Suivi global des activités élèves
 */

const AdminSuivi = {
    eleves: [],
    connexions: [],
    eleveTaches: [],
    tachesComplexes: [],
    currentTab: 'overview',

    async init() {
        await this.loadData();
        this.render();
    },

    async loadData() {
        try {
            const [elevesResult, connexionsResult, eleveTachesResult, tachesResult] = await Promise.all([
                this.callAPI('getUtilisateurs', {}),
                this.callAPI('getEleveConnexions', {}),
                this.callAPI('getEleveTachesComplexes', {}),
                this.callAPI('getTachesComplexes', {})
            ]);

            if (elevesResult.success) {
                this.eleves = (elevesResult.data || []).filter(u => u.role === 'eleve');
            }
            if (connexionsResult.success) {
                this.connexions = connexionsResult.data || [];
            }
            if (eleveTachesResult.success) {
                this.eleveTaches = eleveTachesResult.data || [];
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

        // Calculate global stats
        const today = new Date().toDateString();
        const connexionsToday = this.connexions.filter(c =>
            new Date(c.timestamp).toDateString() === today
        );
        const uniqueElevesToday = [...new Set(connexionsToday.map(c => c.eleve_id))].length;
        const totalVisitsToday = connexionsToday.length;
        const pendingCorrections = this.eleveTaches.filter(t => t.statut === 'soumis').length;
        const activeStudents = this.eleves.filter(e => e.derniere_connexion).length;

        container.innerHTML = `
            <div class="page-header">
                <div>
                    <h1><span class="header-icon">👁️</span> Suivi des activités</h1>
                    <p class="page-subtitle">Vue d'ensemble de l'activité de vos élèves</p>
                </div>
                <button class="btn btn-secondary" onclick="AdminSuivi.refreshData()">
                    🔄 Actualiser
                </button>
            </div>

            <!-- Stats globales -->
            <div class="stats-grid">
                <div class="stat-card clickable" onclick="AdminSuivi.setTab('students')">
                    <div class="stat-icon-wrapper blue">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                    </div>
                    <div class="stat-value">${uniqueElevesToday}</div>
                    <div class="stat-label">Élèves connectés aujourd'hui</div>
                </div>
                <div class="stat-card clickable" onclick="AdminSuivi.setTab('activity')">
                    <div class="stat-icon-wrapper green">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div class="stat-value">${totalVisitsToday}</div>
                    <div class="stat-label">Visites de pages aujourd'hui</div>
                </div>
                <div class="stat-card ${pendingCorrections > 0 ? 'highlight' : ''} clickable" onclick="AdminSuivi.setTab('corrections')">
                    <div class="stat-icon-wrapper ${pendingCorrections > 0 ? 'red' : 'gray'}">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                        </svg>
                    </div>
                    <div class="stat-value">${pendingCorrections}</div>
                    <div class="stat-label">Copies à corriger</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon-wrapper purple">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="24" height="24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                        </svg>
                    </div>
                    <div class="stat-value">${this.eleves.length}</div>
                    <div class="stat-label">Élèves inscrits</div>
                </div>
            </div>

            <!-- Navigation par onglets -->
            <div class="suivi-tabs">
                <button class="suivi-tab ${this.currentTab === 'overview' ? 'active' : ''}" onclick="AdminSuivi.setTab('overview')">
                    📊 Vue d'ensemble
                </button>
                <button class="suivi-tab ${this.currentTab === 'activity' ? 'active' : ''}" onclick="AdminSuivi.setTab('activity')">
                    📜 Activité récente
                </button>
                <button class="suivi-tab ${this.currentTab === 'students' ? 'active' : ''}" onclick="AdminSuivi.setTab('students')">
                    👥 Élèves
                </button>
                <button class="suivi-tab ${this.currentTab === 'corrections' ? 'active' : ''}" onclick="AdminSuivi.setTab('corrections')">
                    📝 Corrections ${pendingCorrections > 0 ? `<span class="tab-badge">${pendingCorrections}</span>` : ''}
                </button>
            </div>

            <!-- Contenu de l'onglet -->
            <div class="suivi-content">
                ${this.renderTabContent()}
            </div>
        `;
    },

    renderTabContent() {
        switch (this.currentTab) {
            case 'overview':
                return this.renderOverview();
            case 'activity':
                return this.renderActivityFeed();
            case 'students':
                return this.renderStudentsList();
            case 'corrections':
                return this.renderCorrections();
            default:
                return this.renderOverview();
        }
    },

    renderOverview() {
        // Recent activity (last 10)
        const recentActivity = this.getRecentActivity(10);

        // Students with recent connections
        const recentStudents = this.getStudentsWithStats()
            .sort((a, b) => new Date(b.lastConnection || 0) - new Date(a.lastConnection || 0))
            .slice(0, 5);

        // Page visit stats
        const pageStats = this.getPageVisitStats();

        return `
            <div class="overview-grid">
                <div class="overview-section">
                    <h3>🕐 Activité récente</h3>
                    <div class="activity-feed mini">
                        ${recentActivity.length > 0 ? recentActivity.map(a => this.renderActivityItem(a)).join('') :
                            '<p class="empty-text">Aucune activité récente</p>'}
                    </div>
                    ${recentActivity.length > 0 ? `<button class="btn-link" onclick="AdminSuivi.setTab('activity')">Voir tout →</button>` : ''}
                </div>

                <div class="overview-section">
                    <h3>👥 Dernières connexions</h3>
                    <div class="students-mini-list">
                        ${recentStudents.length > 0 ? recentStudents.map(s => `
                            <div class="student-mini-item">
                                <div class="student-avatar">${this.getInitials(s.name)}</div>
                                <div class="student-info">
                                    <div class="student-name">${this.escapeHtml(s.name)}</div>
                                    <div class="student-last">${s.lastConnection ? this.formatRelativeTime(s.lastConnection) : 'Jamais connecté'}</div>
                                </div>
                                <div class="student-visits">${s.totalVisits} visites</div>
                            </div>
                        `).join('') : '<p class="empty-text">Aucun élève connecté</p>'}
                    </div>
                    ${recentStudents.length > 0 ? `<button class="btn-link" onclick="AdminSuivi.setTab('students')">Voir tous →</button>` : ''}
                </div>

                <div class="overview-section full-width">
                    <h3>📊 Pages les plus visitées</h3>
                    <div class="page-stats-list">
                        ${pageStats.length > 0 ? pageStats.slice(0, 8).map(p => `
                            <div class="page-stat-item">
                                <span class="page-name">${this.formatPageName(p.page)}</span>
                                <div class="page-bar">
                                    <div class="page-bar-fill" style="width: ${(p.count / pageStats[0].count) * 100}%"></div>
                                </div>
                                <span class="page-count">${p.count}</span>
                            </div>
                        `).join('') : '<p class="empty-text">Aucune donnée de visite</p>'}
                    </div>
                </div>
            </div>
        `;
    },

    renderActivityFeed() {
        const allActivity = this.getRecentActivity(50);

        if (allActivity.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <h3>Aucune activité</h3>
                    <p>L'activité des élèves apparaîtra ici.</p>
                </div>
            `;
        }

        // Group by date
        const grouped = {};
        allActivity.forEach(a => {
            const dateKey = new Date(a.timestamp).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(a);
        });

        return Object.entries(grouped).map(([date, activities]) => `
            <div class="activity-date-group">
                <h3 class="activity-date">${date}</h3>
                <div class="activity-feed">
                    ${activities.map(a => this.renderActivityItem(a)).join('')}
                </div>
            </div>
        `).join('');
    },

    renderStudentsList() {
        const students = this.getStudentsWithStats()
            .sort((a, b) => new Date(b.lastConnection || 0) - new Date(a.lastConnection || 0));

        if (students.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>Aucun élève</h3>
                    <p>Les élèves apparaîtront ici une fois inscrits.</p>
                </div>
            `;
        }

        return `
            <div class="students-table-wrapper">
                <table class="students-table">
                    <thead>
                        <tr>
                            <th>Élève</th>
                            <th>Classe</th>
                            <th>Dernière connexion</th>
                            <th>Visites totales</th>
                            <th>Pages vues</th>
                            <th>Entraînements</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                            <tr>
                                <td>
                                    <div class="student-cell">
                                        <div class="student-avatar small">${this.getInitials(s.name)}</div>
                                        <span>${this.escapeHtml(s.name)}</span>
                                    </div>
                                </td>
                                <td>${s.classe || '-'}</td>
                                <td>
                                    ${s.lastConnection ? `
                                        <span class="connection-status ${this.isRecentConnection(s.lastConnection) ? 'recent' : ''}">
                                            ${this.formatRelativeTime(s.lastConnection)}
                                        </span>
                                    ` : '<span class="connection-status never">Jamais</span>'}
                                </td>
                                <td>${s.totalVisits}</td>
                                <td>${Object.keys(s.pagesVisited).length}</td>
                                <td>
                                    <span class="training-stats">
                                        ${s.trainingsCompleted}/${s.trainingsStarted} terminés
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderCorrections() {
        const pending = this.eleveTaches.filter(t => t.statut === 'soumis');
        const recent = this.eleveTaches
            .filter(t => t.statut === 'corrige')
            .sort((a, b) => new Date(b.date_correction || 0) - new Date(a.date_correction || 0))
            .slice(0, 10);

        return `
            <div class="corrections-section">
                <h3>📝 Copies en attente de correction</h3>
                ${pending.length === 0 ? `
                    <div class="empty-state small">
                        <div class="empty-state-icon">✅</div>
                        <p>Aucune copie en attente !</p>
                    </div>
                ` : `
                    <div class="corrections-list">
                        ${pending.map(t => this.renderCorrectionCard(t)).join('')}
                    </div>
                `}
            </div>

            ${recent.length > 0 ? `
                <div class="corrections-section">
                    <h3>✅ Récemment corrigées</h3>
                    <div class="corrections-list recent">
                        ${recent.map(t => this.renderCorrectionCard(t, true)).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    },

    renderCorrectionCard(tache, isDone = false) {
        const eleve = this.eleves.find(e => e.id === tache.eleve_id);
        const tacheComplexe = this.tachesComplexes.find(t => t.id === tache.tache_id);

        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || eleve.identifiant : 'Élève inconnu';
        const tacheName = tacheComplexe ? tacheComplexe.titre : 'Tâche inconnue';

        return `
            <div class="correction-card ${isDone ? 'done' : 'pending'}">
                <div class="correction-header">
                    <div class="correction-eleve">
                        <div class="student-avatar">${this.getInitials(eleveName)}</div>
                        <div>
                            <div class="student-name">${this.escapeHtml(eleveName)}</div>
                            <div class="correction-tache">${this.escapeHtml(tacheName)}</div>
                        </div>
                    </div>
                    <span class="mode-badge ${tache.mode === 'points_bonus' ? 'bonus' : 'training'}">
                        ${tache.mode === 'points_bonus' ? '⭐ Points bonus' : '📚 Entraînement'}
                    </span>
                </div>
                <div class="correction-meta">
                    <span>📅 Soumis le ${this.formatDate(tache.date_soumission || tache.date_debut)}</span>
                    ${tache.temps_passe ? `<span>⏱ ${this.formatDuration(tache.temps_passe)}</span>` : ''}
                </div>
                ${!isDone ? `
                    <div class="correction-actions">
                        <button class="btn btn-primary btn-sm" onclick="AdminSuivi.markAsCorrected('${tache.id}')">
                            ✓ Marquer comme corrigé
                        </button>
                    </div>
                ` : `
                    <div class="correction-done-info">
                        ✅ Corrigé le ${this.formatDate(tache.date_correction)}
                    </div>
                `}
            </div>
        `;
    },

    renderActivityItem(activity) {
        const eleve = this.eleves.find(e => e.id === activity.eleve_id);
        const eleveName = eleve ? `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || eleve.identifiant : 'Élève';

        let icon = '👁️';
        let action = '';

        if (activity.type === 'connexion') {
            icon = '🔵';
            action = `a visité <strong>${this.formatPageName(activity.page)}</strong>`;
        } else if (activity.type === 'tache_start') {
            icon = '🎯';
            action = `a commencé <strong>${activity.tacheName || 'un entraînement'}</strong>`;
        } else if (activity.type === 'tache_submit') {
            icon = '📤';
            action = `a soumis <strong>${activity.tacheName || 'un travail'}</strong>`;
        } else if (activity.type === 'tache_finish') {
            icon = '✅';
            action = `a terminé <strong>${activity.tacheName || 'un entraînement'}</strong>`;
        }

        return `
            <div class="activity-item">
                <span class="activity-icon">${icon}</span>
                <div class="activity-content">
                    <span class="activity-student">${this.escapeHtml(eleveName)}</span>
                    <span class="activity-action">${action}</span>
                </div>
                <span class="activity-time">${this.formatRelativeTime(activity.timestamp)}</span>
            </div>
        `;
    },

    // Data helpers
    getRecentActivity(limit = 20) {
        const activities = [];

        // Add connexions
        this.connexions.forEach(c => {
            activities.push({
                type: 'connexion',
                eleve_id: c.eleve_id,
                page: c.page,
                timestamp: c.timestamp
            });
        });

        // Add tache activities
        this.eleveTaches.forEach(t => {
            const tache = this.tachesComplexes.find(tc => tc.id === t.tache_id);
            if (t.date_debut) {
                activities.push({
                    type: 'tache_start',
                    eleve_id: t.eleve_id,
                    tacheName: tache?.titre,
                    timestamp: t.date_debut
                });
            }
            if (t.date_soumission) {
                activities.push({
                    type: 'tache_submit',
                    eleve_id: t.eleve_id,
                    tacheName: tache?.titre,
                    timestamp: t.date_soumission
                });
            }
        });

        // Sort by timestamp and limit
        return activities
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    },

    getStudentsWithStats() {
        return this.eleves.map(eleve => {
            const studentConnexions = this.connexions.filter(c => c.eleve_id === eleve.id);
            const studentTaches = this.eleveTaches.filter(t => t.eleve_id === eleve.id);

            const pagesVisited = {};
            studentConnexions.forEach(c => {
                pagesVisited[c.page] = (pagesVisited[c.page] || 0) + 1;
            });

            return {
                id: eleve.id,
                name: `${eleve.prenom || ''} ${eleve.nom || ''}`.trim() || eleve.identifiant,
                classe: eleve.classe_id,
                lastConnection: eleve.derniere_connexion || (studentConnexions.length > 0 ?
                    studentConnexions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0].timestamp : null),
                totalVisits: studentConnexions.length,
                pagesVisited,
                trainingsStarted: studentTaches.length,
                trainingsCompleted: studentTaches.filter(t => t.statut === 'termine' || t.statut === 'corrige').length
            };
        });
    },

    getPageVisitStats() {
        const stats = {};
        this.connexions.forEach(c => {
            const page = c.page || 'unknown';
            stats[page] = (stats[page] || 0) + 1;
        });
        return Object.entries(stats)
            .map(([page, count]) => ({ page, count }))
            .sort((a, b) => b.count - a.count);
    },

    // Actions
    setTab(tab) {
        this.currentTab = tab;
        this.render();
    },

    async refreshData() {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = '⏳ Chargement...';
        await this.loadData();
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
                const tache = this.eleveTaches.find(t => t.id === tacheId);
                if (tache) {
                    tache.statut = 'corrige';
                    tache.date_correction = new Date().toISOString();
                }
                this.render();

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

    // Utility functions
    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || '?';
    },

    formatPageName(page) {
        if (!page) return 'Page inconnue';
        const names = {
            'accueil': '🏠 Accueil',
            'lecons': '📖 Leçons',
            'methodologie': '🧠 Méthodologie',
            'connaissances': '🔵 Connaissances',
            'savoir-faire': '🟠 Savoir-faire',
            'competences': '🔴 Compétences',
            'evaluations': '📋 Évaluations',
            'notes': '📊 Notes',
            'videos': '🎬 Vidéos',
            'recommandations': '💡 Recommandations',
            'faq': '❓ FAQ',
            'messagerie': '✉️ Messagerie',
            'emploi-du-temps': '📆 Emploi du temps',
            'classeur': '📂 Classeur'
        };
        return names[page] || page;
    },

    formatRelativeTime(dateStr) {
        if (!dateStr) return 'Jamais';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} jours`;
        return date.toLocaleDateString('fr-FR');
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            return `${hours}h${mins % 60}`;
        }
        return `${mins} min`;
    },

    isRecentConnection(dateStr) {
        if (!dateStr) return false;
        const diffMs = new Date() - new Date(dateStr);
        return diffMs < 24 * 60 * 60 * 1000; // Last 24h
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
