/**
 * Eleve Evaluations - Liste des evaluations pour l'eleve
 */

const EleveEvaluations = {
    // Data
    evaluations: [],
    resultats: [],
    chapitres: [],
    currentUserId: null,

    // Type colors
    typeColors: {
        'connaissances': 'green',
        'savoir-faire': 'orange',
        'competences': 'purple',
        'bonus': 'yellow'
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            // Get current user from auth
            this.currentUserId = localStorage.getItem('userId') || 'eleve_demo';

            await this.loadData();
            this.categorizeEvaluations();
            this.updateStats();
            this.renderEvaluations();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des evaluations');
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
            console.log('Table EVALUATIONS not found');
            this.evaluations = [];
        }

        // Try to load student results
        try {
            const resultatsData = await SheetsAPI.getSheetData('EVALUATION_RESULTATS');
            this.resultats = SheetsAPI.parseSheetData(resultatsData)
                .filter(r => r.eleve_id === this.currentUserId);
        } catch (e) {
            console.log('Table EVALUATION_RESULTATS not found');
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
            avenir: [],
            terminees: []
        };

        this.evaluations.forEach(eval => {
            const resultat = this.resultats.find(r => r.evaluation_id === eval.id);

            if (resultat) {
                if (resultat.valide === 'true' || resultat.valide === true) {
                    // Validee - terminee
                    this.categories.terminees.push({ ...eval, resultat });
                } else {
                    // Non validee - a repasser
                    this.categories.repasser.push({ ...eval, resultat });
                }
            } else {
                // Pas encore passee
                if (eval.date_ouverture) {
                    const dateOuverture = new Date(eval.date_ouverture);
                    if (dateOuverture > now) {
                        // A venir
                        this.categories.avenir.push(eval);
                    } else {
                        // Disponible
                        this.categories.disponibles.push(eval);
                    }
                } else {
                    // Disponible par defaut
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
                <div class="empty-icon">!</div>
                <h3>Erreur</h3>
                <p>${message}</p>
            </div>
        `;
    },

    // ========== STATS ==========
    updateStats() {
        document.getElementById('statARepasser').textContent = this.categories.repasser.length;
        document.getElementById('statDisponibles').textContent = this.categories.disponibles.length;
        document.getElementById('statAVenir').textContent = this.categories.avenir.length;
        document.getElementById('statTerminees').textContent = this.categories.terminees.length;
    },

    // ========== RENDER ==========
    renderEvaluations() {
        const hasAny = this.evaluations.length > 0;

        if (!hasAny) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        // Render each section
        this.renderSection('Repasser', this.categories.repasser, 'repasser');
        this.renderSection('Disponibles', this.categories.disponibles, 'disponible');
        this.renderSection('AVenir', this.categories.avenir, 'avenir');
        this.renderSection('Terminees', this.categories.terminees, 'terminee');
    },

    renderSection(name, evals, status) {
        const section = document.getElementById(`section${name}`);
        const grid = document.getElementById(`grid${name}`);

        if (evals.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        grid.innerHTML = evals.map(e => this.renderCard(e, status)).join('');
    },

    renderCard(evaluation, status) {
        const typeClass = evaluation.type || 'connaissances';
        const chapitre = this.chapitres.find(c => c.id === evaluation.chapitre_id);
        const chapterName = chapitre?.titre || '';

        let statusClass = '';
        let actionHtml = '';
        let extraHtml = '';

        switch (status) {
            case 'repasser':
                statusClass = 'repasser';
                actionHtml = `
                    <div class="card-actions">
                        <button class="btn btn-warning" onclick="EleveEvaluations.startEvaluation('${evaluation.id}')">
                            Repasser
                        </button>
                    </div>
                `;
                if (evaluation.resultat) {
                    extraHtml = `
                        <div class="card-result">
                            <div>
                                <div class="card-result-score failed">${evaluation.resultat.score || 0}%</div>
                                <div class="card-result-label">Score precedent</div>
                            </div>
                            <div class="card-validations">
                                <span class="validation-badge not-earned">Non valide</span>
                            </div>
                        </div>
                    `;
                }
                break;

            case 'disponible':
                statusClass = '';
                actionHtml = `
                    <div class="card-actions">
                        <button class="btn btn-primary" onclick="EleveEvaluations.startEvaluation('${evaluation.id}')">
                            Commencer
                        </button>
                    </div>
                `;
                break;

            case 'avenir':
                statusClass = 'avenir';
                const dateOuverture = evaluation.date_ouverture ? new Date(evaluation.date_ouverture) : null;
                if (dateOuverture) {
                    const diff = Math.ceil((dateOuverture - new Date()) / (1000 * 60 * 60 * 24));
                    extraHtml = `
                        <div class="card-countdown">
                            Disponible dans ${diff} jour${diff > 1 ? 's' : ''}
                        </div>
                    `;
                }
                actionHtml = `
                    <div class="card-actions">
                        <button class="btn btn-secondary" disabled>
                            Pas encore disponible
                        </button>
                    </div>
                `;
                break;

            case 'terminee':
                statusClass = 'terminee';
                if (evaluation.resultat) {
                    extraHtml = `
                        <div class="card-result">
                            <div>
                                <div class="card-result-score success">${evaluation.resultat.score || 100}%</div>
                                <div class="card-result-label">Score</div>
                            </div>
                            <div class="card-validations">
                                <span class="validation-badge earned">+${evaluation.briques || 3} validations</span>
                            </div>
                        </div>
                    `;
                }
                actionHtml = `
                    <div class="card-actions">
                        <a href="notes.html" class="btn btn-secondary">
                            Voir le detail
                        </a>
                    </div>
                `;
                break;
        }

        return `
            <div class="evaluation-card ${typeClass} ${statusClass}">
                <div class="card-header">
                    <span class="card-title">${this.escapeHtml(evaluation.titre || 'Evaluation')}</span>
                    <span class="card-type-badge ${typeClass}">${typeClass}</span>
                </div>
                <div class="card-meta">
                    ${chapterName ? `<span>${this.escapeHtml(chapterName)}</span>` : ''}
                    <span>${evaluation.briques || 3} validations en jeu</span>
                </div>
                ${extraHtml}
                ${actionHtml}
            </div>
        `;
    },

    // ========== ACTIONS ==========
    startEvaluation(evaluationId) {
        // Redirect to evaluation execution page
        window.location.href = `evaluation.html?id=${evaluationId}`;
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
        EleveEvaluations.init();
    }, 200);
});

window.EleveEvaluations = EleveEvaluations;
