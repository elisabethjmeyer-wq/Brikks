/**
 * Eleve Evaluations - Liste des évaluations pour l'élève
 */

const EleveEvaluations = {
    // Data
    evaluations: [],
    resultats: [],
    chapitres: [],
    currentUserId: null,

    // Type icons & colors
    typeConfig: {
        'connaissances': { icon: '🟢', color: 'green' },
        'savoir-faire': { icon: '🟠', color: 'orange' },
        'competences': { icon: '🟣', color: 'purple' },
        'bonus': { icon: '⭐', color: 'yellow' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            // Get current user from auth
            this.currentUserId = localStorage.getItem('userId') || 'eleve_demo';

            await this.loadData();
            this.categorizeEvaluations();
            this.renderEvaluations();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des évaluations');
        }
    },

    async loadData() {
        const [chapitresData] = await Promise.all([
            SheetsAPI.getSheetData('CHAPITRES')
        ]);

        this.chapitres = SheetsAPI.parseSheetData(chapitresData);

        // Try to load evaluations
        try {
            const evaluationsData = await SheetsAPI.getSheetData('EVALUATIONS');
            this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        } catch (e) {
            this.evaluations = [];
        }

        // Try to load student results
        try {
            const resultatsData = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
            this.resultats = SheetsAPI.parseSheetData(resultatsData)
                .filter(r => r.eleve_id === this.currentUserId);
        } catch (e) {
            this.resultats = [];
        }

        // Filter only published evaluations
        this.evaluations = this.evaluations.filter(e =>
            e.statut === 'publiee' || e.statut === 'terminee'
        );
    },

    categorizeEvaluations() {
        const now = new Date();

        this.categories = {
            repasser: [],
            disponibles: [],
            avenir: []
        };

        this.evaluations.forEach(eval => {
            const resultat = this.resultats.find(r => r.evaluation_id === eval.id);

            if (resultat) {
                if (resultat.valide === 'true' || resultat.valide === true) {
                    // Validée - ne pas afficher (l'élève doit aller voir "Mes notes")
                    return;
                } else {
                    // Non validée - à repasser
                    this.categories.repasser.push({ ...eval, resultat });
                }
            } else {
                // Pas encore passée
                if (eval.date_ouverture) {
                    const dateOuverture = new Date(eval.date_ouverture);
                    if (dateOuverture > now) {
                        // À venir
                        this.categories.avenir.push(eval);
                    } else {
                        // Disponible
                        this.categories.disponibles.push(eval);
                    }
                } else {
                    // Disponible par défaut
                    this.categories.disponibles.push(eval);
                }
            }
        });
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluations-content').style.display = 'block';
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

    // ========== RENDER ==========
    renderEvaluations() {
        const container = document.getElementById('evaluationsList');
        const emptyState = document.getElementById('emptyState');

        // Combine all in order: repasser first, then disponibles, then avenir
        const allEvals = [
            ...this.categories.repasser.map(e => ({ ...e, status: 'retry' })),
            ...this.categories.disponibles.map(e => ({ ...e, status: 'available' })),
            ...this.categories.avenir.map(e => ({ ...e, status: 'upcoming' }))
        ];

        if (allEvals.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = allEvals.map(e => this.renderCard(e)).join('');
    },

    renderCard(evaluation) {
        const type = evaluation.type || 'connaissances';
        const config = this.typeConfig[type] || this.typeConfig['connaissances'];
        const chapitre = this.chapitres.find(c => c.id === evaluation.chapitre_id);

        // Build title - use chapter name for connaissances, or eval title
        let title = evaluation.titre || 'Évaluation';
        if (type === 'connaissances' && chapitre) {
            title = chapitre.titre || title;
        }

        // Build card classes
        let cardClass = 'eval-card';
        if (evaluation.status === 'retry') cardClass += ' retry';
        if (evaluation.status === 'upcoming') cardClass += ' upcoming';

        // Build meta items
        let metaItems = [];
        if (evaluation.date_limite) {
            metaItems.push(`📅 Jusqu'au ${this.formatDate(evaluation.date_limite)}`);
        } else if (evaluation.status === 'upcoming' && evaluation.date_ouverture) {
            metaItems.push(`📅 Ouvre le ${this.formatDate(evaluation.date_ouverture)}`);
        }
        metaItems.push(`⏱️ ${evaluation.duree_estimee || evaluation.duree || 15} min`);

        // Build action/status
        let actionHtml = '';
        let statusBadge = '';

        switch (evaluation.status) {
            case 'retry':
                statusBadge = '<span class="status-badge retry">⚠️ À repasser</span>';
                actionHtml = `
                    <div class="eval-card-actions">
                        <a href="evaluation.html?id=${evaluation.id}" class="btn btn-warning">▶️ Repasser</a>
                    </div>
                `;
                break;

            case 'available':
                actionHtml = `
                    <div class="eval-card-actions">
                        <a href="evaluation.html?id=${evaluation.id}" class="btn btn-primary">▶️ Commencer</a>
                    </div>
                `;
                break;

            case 'upcoming':
                const countdown = this.getCountdown(evaluation.date_ouverture);
                actionHtml = `
                    <div class="eval-card-actions">
                        <span class="upcoming-info">⏳ Dans <span class="time">${countdown}</span></span>
                    </div>
                `;
                break;
        }

        return `
            <div class="${cardClass}">
                <div class="eval-card-icon ${config.color}">${config.icon}</div>
                <div class="eval-card-content">
                    <div class="eval-card-title">
                        ${escapeHtml(title)}
                        ${statusBadge}
                    </div>
                    <div class="eval-card-meta">
                        ${metaItems.map(item => `<span>${item}</span>`).join('')}
                    </div>
                </div>
                ${actionHtml}
            </div>
        `;
    },

    // ========== HELPERS ==========
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(' ', ' à ');
        } catch {
            return dateStr;
        }
    },

    getCountdown(dateStr) {
        if (!dateStr) return '?';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = date - now;

            if (diff <= 0) return 'Bientôt';

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            if (days > 0) {
                return `${days}j ${hours}h`;
            }
            return `${hours}h`;
        } catch {
            return '?';
        }
    },

};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EleveEvaluations.init();
    }, 200);
});

window.EleveEvaluations = EleveEvaluations;
