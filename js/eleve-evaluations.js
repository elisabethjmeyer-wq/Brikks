/**
 * Eleve Evaluations - Liste des évaluations pour l'élève
 * Sections : À passer, À venir, Terminées, Bonus
 */

const EleveEvaluations = {
    // Data
    evaluations: [],
    resultats: [],
    chapitres: [],
    parametresNotes: [],
    currentUserId: null,

    // Type config
    typeConfig: {
        'connaissances': { label: 'Connaissances', icon: '🟢', color: 'green', cssClass: 'type-conn' },
        'savoir-faire': { label: 'Savoir-faire', icon: '🟠', color: 'orange', cssClass: 'type-sf' },
        'competences': { label: 'Compétences', icon: '🟣', color: 'purple', cssClass: 'type-comp' },
        'bonus': { label: 'Bonus', icon: '⭐', color: 'yellow', cssClass: 'type-bonus' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            this.currentUserId = this._getCurrentUserId();
            await this.loadData();
            this.categorizeEvaluations();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError('Erreur lors du chargement des évaluations');
        }
    },

    _getCurrentUserId() {
        try {
            if (typeof Auth !== 'undefined' && Auth.getCurrentUser) {
                const user = Auth.getCurrentUser();
                if (user && user.id) return user.id;
            }
            const sessionUser = sessionStorage.getItem('brikks_user');
            if (sessionUser) return JSON.parse(sessionUser).id;
            const localUser = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
            if (localUser) return JSON.parse(localUser).id;
        } catch (_e) { /* ignore */ }
        return localStorage.getItem('userId') || 'eleve_demo';
    },

    async loadData() {
        const [chapitresData, evaluationsData, resultatsData, parametresData] = await Promise.all([
            SheetsAPI.getSheetData('CHAPITRES').catch(() => []),
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => [])
        ]);

        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        this.parametresNotes = SheetsAPI.parseSheetData(parametresData);

        // Filtrer les résultats de l'élève
        const allResultats = SheetsAPI.parseSheetData(resultatsData);
        this.resultats = allResultats.filter(r =>
            String(r.eleve_id).trim() === String(this.currentUserId).trim()
        );

        // Ne garder que les évaluations visibles (pas brouillon)
        this.evaluations = this.evaluations.filter(e => {
            const effectiveStatut = this._computeEffectiveStatut(e);
            return effectiveStatut === 'planifiee' || effectiveStatut === 'publiee' || effectiveStatut === 'terminee';
        });
    },

    // ========== STATUS COMPUTATION ==========
    _computeEffectiveStatut(evaluation) {
        const now = new Date();
        if (evaluation.date_ouverture || evaluation.date_fermeture) {
            if (evaluation.date_ouverture && new Date(evaluation.date_ouverture) > now) return 'planifiee';
            if (evaluation.date_fermeture && new Date(evaluation.date_fermeture) < now) return 'terminee';
            return 'publiee';
        }
        return evaluation.statut || 'brouillon';
    },

    /**
     * Détermine le semestre d'une évaluation à partir de sa date
     */
    _getSemestreForEval(ev) {
        const dateStr = ev.date_ouverture || ev.date_debut || '';
        if (!dateStr) {
            // Fallback: semestre en cours
            const today = new Date();
            for (const p of this.parametresNotes) {
                const debut = p.date_debut ? new Date(p.date_debut) : null;
                const fin = p.date_fin ? new Date(p.date_fin) : null;
                if (debut && fin && today >= debut && today <= fin) return 'S' + p.semestre;
            }
            return 'S1';
        }
        const evalDate = new Date(dateStr);
        if (isNaN(evalDate.getTime())) return '';
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && evalDate >= debut && evalDate <= fin) return 'S' + p.semestre;
        }
        return '';
    },

    /**
     * Condition de réussite selon le type
     */
    _getCondition(evaluation) {
        const type = evaluation.type || 'connaissances';
        const seuil = parseInt(evaluation.seuil) || 80;
        if (type === 'savoir-faire') return '100% de réussite';
        if (type === 'competences') return 'Critères de réussite';
        if (type === 'bonus') return seuil + '% de réussite';
        return seuil + '% de réussite';
    },

    // ========== CATEGORIZATION ==========
    categorizeEvaluations() {
        this.categories = {
            aPasser: [],   // Disponibles + à repasser (sauf bonus)
            avenir: [],    // Planifiées
            terminees: [], // Validées ou fermées avec résultat
            bonus: []      // Bonus disponibles
        };

        this.evaluations.forEach(ev => {
            const resultat = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            const effectiveStatut = this._computeEffectiveStatut(ev);
            const isBonus = ev.type === 'bonus';

            // Fermée
            if (effectiveStatut === 'terminee') {
                if (resultat) {
                    this.categories.terminees.push({ ...ev, resultat, cardStatus: 'done' });
                }
                return;
            }

            // Planifiée (à venir)
            if (effectiveStatut === 'planifiee') {
                if (isBonus) {
                    this.categories.bonus.push({ ...ev, cardStatus: 'upcoming' });
                } else {
                    this.categories.avenir.push({ ...ev, cardStatus: 'upcoming' });
                }
                return;
            }

            // Publiée — vérifier les résultats
            if (resultat) {
                const isValidated = resultat.is_validated === 'true' || resultat.is_validated === true;
                if (isValidated) {
                    // Validée → terminée
                    this.categories.terminees.push({ ...ev, resultat, cardStatus: 'validated' });
                } else {
                    // Échouée → à repasser
                    if (isBonus) {
                        this.categories.bonus.push({ ...ev, resultat, cardStatus: 'retry' });
                    } else {
                        this.categories.aPasser.push({ ...ev, resultat, cardStatus: 'retry' });
                    }
                }
            } else {
                // Pas encore passée → disponible
                if (isBonus) {
                    this.categories.bonus.push({ ...ev, cardStatus: 'available' });
                } else {
                    this.categories.aPasser.push({ ...ev, cardStatus: 'available' });
                }
            }
        });

        // Trier : les "retry" en premier dans chaque catégorie
        this.categories.aPasser.sort((a, b) => (a.cardStatus === 'retry' ? -1 : 1) - (b.cardStatus === 'retry' ? -1 : 1));
    },

    // ========== RENDER ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluations-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Erreur</h3>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    },

    render() {
        const container = document.getElementById('evaluationsList');
        const { aPasser, avenir, terminees, bonus } = this.categories;

        const totalAll = aPasser.length + avenir.length + terminees.length + bonus.length;

        if (totalAll === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">✅</div>
                    <h3>Aucune évaluation pour le moment</h3>
                    <p>Tes évaluations apparaîtront ici quand ta professeure les publiera.</p>
                </div>
            `;
            return;
        }

        let html = '';

        // Section "À passer"
        if (aPasser.length > 0) {
            html += this._renderSection('À passer', aPasser, 'section-active');
        }

        // Section "À venir"
        if (avenir.length > 0) {
            html += this._renderSection('À venir', avenir, 'section-upcoming');
        }

        // Section "Bonus"
        if (bonus.length > 0) {
            html += this._renderSection('⭐ Bonus', bonus, 'section-bonus');
        }

        // Section "Terminées" (pliable)
        if (terminees.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminées <span class="section-count">${terminees.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
                        ${terminees.map(e => this.renderCard(e)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    _renderSection(title, evals, cssClass) {
        return `
            <div class="eval-section ${cssClass}">
                <div class="section-header">
                    <h2>${title} <span class="section-count">${evals.length}</span></h2>
                </div>
                <div class="section-cards">
                    ${evals.map(e => this.renderCard(e)).join('')}
                </div>
            </div>
        `;
    },

    toggleSection(btn) {
        const cards = btn.nextElementSibling;
        const toggle = btn.querySelector('.section-toggle');
        cards.classList.toggle('collapsed');
        toggle.textContent = cards.classList.contains('collapsed') ? '▼' : '▲';
    },

    // ========== CARD RENDER ==========
    renderCard(evaluation) {
        const type = evaluation.type || 'connaissances';
        const config = this.typeConfig[type] || this.typeConfig['connaissances'];
        const isPapier = evaluation.mode_passation === 'papier';
        const cardStatus = evaluation.cardStatus;
        const resultat = evaluation.resultat;

        // Titre
        const title = evaluation.titre || 'Évaluation';

        // Infos
        const duree = parseInt(evaluation.duree) || 0;
        const briques = parseInt(evaluation.briques) || 1;
        const condition = this._getCondition(evaluation);
        const semestre = this._getSemestreForEval(evaluation);

        // CSS de la carte
        let cardClass = `eval-card ${config.cssClass}`;
        if (cardStatus === 'retry') cardClass += ' retry';
        if (cardStatus === 'upcoming') cardClass += ' upcoming';
        if (cardStatus === 'validated' || cardStatus === 'done') cardClass += ' done';

        // Badge de statut
        let statusBadge = '';
        if (cardStatus === 'retry') {
            statusBadge = '<span class="status-badge retry">À repasser</span>';
        } else if (cardStatus === 'validated') {
            statusBadge = '<span class="status-badge validated">✓ Validée</span>';
        } else if (cardStatus === 'done') {
            statusBadge = '<span class="status-badge closed">Terminée</span>';
        }

        // Métadonnées
        let metaHtml = '<div class="eval-card-meta">';

        // Type avec pastille
        metaHtml += `<span class="meta-type ${config.cssClass}">${config.label}</span>`;

        // Durée
        if (duree > 0) metaHtml += `<span class="meta-item">⏱️ ${duree} min</span>`;

        // Points en jeu
        metaHtml += `<span class="meta-item">🎯 ${briques} pt${briques > 1 ? 's' : ''}</span>`;

        // Papier/numérique
        if (isPapier) {
            metaHtml += '<span class="meta-item meta-papier">📄 Papier</span>';
        }

        // Semestre tag
        if (semestre) {
            metaHtml += `<span class="meta-sem">${semestre}</span>`;
        }

        metaHtml += '</div>';

        // Date
        let dateHtml = '';
        if (cardStatus === 'upcoming' && evaluation.date_ouverture) {
            dateHtml = `<div class="eval-card-date">📅 Ouvre le ${this.formatDate(evaluation.date_ouverture)}</div>`;
        } else if (evaluation.date_ouverture && cardStatus !== 'validated' && cardStatus !== 'done') {
            dateHtml = `<div class="eval-card-date">📅 ${this.formatDate(evaluation.date_ouverture)}</div>`;
        }
        if (evaluation.date_fermeture && cardStatus !== 'done' && cardStatus !== 'validated') {
            dateHtml += `<div class="eval-card-date">🔒 Ferme le ${this.formatDate(evaluation.date_fermeture)}</div>`;
        }

        // Condition de réussite
        let conditionHtml = `<div class="eval-card-condition">Condition : ${escapeHtml(condition)}</div>`;

        // Résultat (si terminée)
        let resultHtml = '';
        if (resultat && (cardStatus === 'validated' || cardStatus === 'done')) {
            const score = resultat.score || 0;
            const validations = resultat.validations || 0;
            resultHtml = `
                <div class="eval-card-result">
                    <span class="result-score">${score}%</span>
                    <span class="result-pts">${validations} pt${validations > 1 ? 's' : ''} gagné${validations > 1 ? 's' : ''}</span>
                </div>
            `;
        }
        if (resultat && cardStatus === 'retry') {
            const score = resultat.score || 0;
            resultHtml = `<div class="eval-card-result retry-result">Dernier essai : ${score}%</div>`;
        }

        // Bouton d'action
        let actionHtml = '';
        if (cardStatus === 'available' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="btn-eval btn-start">Commencer</a>`;
        } else if (cardStatus === 'retry' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="btn-eval btn-retry">Repasser</a>`;
        } else if (cardStatus === 'upcoming') {
            const countdown = this.getCountdown(evaluation.date_ouverture);
            actionHtml = `<span class="countdown-badge">⏳ ${countdown}</span>`;
        } else if (cardStatus === 'validated' || cardStatus === 'done') {
            actionHtml = `<a href="notes.html" class="btn-eval btn-see-notes">Voir mes notes</a>`;
        }

        return `
            <div class="${cardClass}">
                <div class="eval-card-left">
                    <div class="eval-card-dot ${config.cssClass}"></div>
                </div>
                <div class="eval-card-body">
                    <div class="eval-card-top">
                        <div class="eval-card-title">${escapeHtml(title)} ${statusBadge}</div>
                        ${metaHtml}
                        ${dateHtml}
                        ${conditionHtml}
                        ${resultHtml}
                    </div>
                </div>
                <div class="eval-card-right">
                    ${actionHtml}
                </div>
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
                month: 'long',
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
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (days > 0) return `${days}j ${hours}h`;
            if (hours > 0) return `${hours}h ${minutes}min`;
            return `${minutes}min`;
        } catch {
            return '?';
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EleveEvaluations.init();
    }, 200);
});

window.EleveEvaluations = EleveEvaluations;
