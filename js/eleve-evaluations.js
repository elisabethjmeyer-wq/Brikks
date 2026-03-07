/**
 * Eleve Evaluations - Liste des évaluations pour l'élève
 * Onglets : Évaluations (conn, SF, comp) / Bonus
 * Review modal pour les évaluations terminées
 */

const EleveEvaluations = {
    // Data
    evaluations: [],
    resultats: [],
    chapitres: [],
    parametresNotes: [],
    notesSommatives: [],
    resultatsSommatives: [],
    currentUserId: null,
    currentTab: 'evaluations',

    /**
     * Vérifie si une valeur représente "vrai" (booléen, string, majuscule/minuscule)
     */
    _isTruthy(val) {
        if (val === true) return true;
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        return false;
    },

    // Type config
    typeConfig: {
        'connaissances': { label: 'Connaissances', color: '#3b82f6', cssClass: 'type-conn' },
        'savoir-faire': { label: 'Savoir-faire', color: '#f59e0b', cssClass: 'type-sf' },
        'competences': { label: 'Compétences', color: '#8b5cf6', cssClass: 'type-comp' },
        'bonus': { label: 'Bonus', color: '#eab308', cssClass: 'type-bonus' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            this.currentUserId = this._getCurrentUserId();
            await this.loadData();
            this.categorizeEvaluations();
            this.render();
            this.updateTabCounts();
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
        const [chapitresData, evaluationsData, resultatsData, parametresData, sommativesData, resSommativesData] = await Promise.all([
            SheetsAPI.getSheetData('CHAPITRES').catch(() => []),
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => [])
        ]);

        this.chapitres = SheetsAPI.parseSheetData(chapitresData);
        this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        this.parametresNotes = SheetsAPI.parseSheetData(parametresData);
        this.notesSommatives = SheetsAPI.parseSheetData(sommativesData);

        // Filtrer les résultats de l'élève
        const allResultats = SheetsAPI.parseSheetData(resultatsData);
        this.resultats = allResultats.filter(r =>
            String(r.eleve_id).trim() === String(this.currentUserId).trim()
        );

        const allResSommatives = SheetsAPI.parseSheetData(resSommativesData);
        this.resultatsSommatives = allResSommatives.filter(r =>
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

    _getSemestreForEval(ev) {
        const dateStr = ev.date_ouverture || ev.date_debut || '';
        if (!dateStr) {
            const today = new Date();
            for (const p of this.parametresNotes) {
                const debut = p.date_debut ? new Date(p.date_debut) : null;
                const fin = p.date_fin ? new Date(p.date_fin) : null;
                if (debut && fin && today >= debut && today <= fin) return p.semestre;
            }
            return '1';
        }
        const evalDate = new Date(dateStr);
        if (isNaN(evalDate.getTime())) return '';
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && evalDate >= debut && evalDate <= fin) return p.semestre;
        }
        return '';
    },

    _getCondition(evaluation) {
        const type = evaluation.type || 'connaissances';
        const seuil = parseInt(evaluation.seuil) || 80;
        if (type === 'savoir-faire') return '100% de réussite';
        if (type === 'competences') return 'Critères de réussite';
        return seuil + '% de bonnes réponses';
    },

    // ========== CATEGORIZATION ==========
    categorizeEvaluations() {
        this.categories = {
            available: [],
            upcoming: [],
            done: [],
            bonus: []
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
                    this.categories.done.push({ ...ev, resultat, cardStatus: 'done' });
                }
                return;
            }

            // Planifiée
            if (effectiveStatut === 'planifiee') {
                if (isBonus) {
                    this.categories.bonus.push({ ...ev, cardStatus: 'upcoming' });
                } else {
                    this.categories.upcoming.push({ ...ev, cardStatus: 'upcoming' });
                }
                return;
            }

            // Publiée — toute évaluation avec résultat → terminée
            if (resultat) {
                const isValidated = this._isTruthy(resultat.is_validated);
                const status = isValidated ? 'validated' : 'failed';
                if (isBonus) {
                    this.categories.bonus.push({ ...ev, resultat, cardStatus: status });
                } else {
                    this.categories.done.push({ ...ev, resultat, cardStatus: status });
                }
            } else {
                if (isBonus) {
                    this.categories.bonus.push({ ...ev, cardStatus: 'available' });
                } else {
                    this.categories.available.push({ ...ev, cardStatus: 'available' });
                }
            }
        });
    },

    // ========== TABS ==========
    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.toggle('active', el.id === 'tab-' + tab);
        });
    },

    updateTabCounts() {
        const { available, upcoming, done } = this.categories;
        const evalsCount = available.length + upcoming.length + done.length;

        const elEvals = document.getElementById('tabCountEvals');
        const elBonus = document.getElementById('tabCountBonus');
        if (elEvals) elEvals.textContent = evalsCount;
        if (elBonus) elBonus.textContent = this.categories.bonus.length;
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
        this._renderEvaluationsTab();
        this._renderBonusTab();
    },

    _renderEvaluationsTab() {
        const container = document.getElementById('evaluationsList');
        const { available, upcoming, done } = this.categories;

        if (available.length + upcoming.length + done.length === 0) {
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

        if (available.length > 0) {
            html += this._renderSection('À passer', available, 'section-active');
        }

        if (upcoming.length > 0) {
            html += this._renderSection('À venir', upcoming, 'section-upcoming');
        }

        if (done.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminées <span class="section-count">${done.length}</span></h2>
                        <span class="section-toggle">▲</span>
                    </button>
                    <div class="section-cards">
                        ${done.map(e => this.renderCard(e)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    _renderBonusTab() {
        const container = document.getElementById('bonusList');
        const { bonus } = this.categories;

        if (bonus.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <h3>Aucun bonus disponible</h3>
                    <p>Les évaluations bonus apparaîtront ici.</p>
                </div>
            `;
            return;
        }

        const availableBonus = bonus.filter(b => b.cardStatus === 'available');
        const doneBonus = bonus.filter(b => b.cardStatus === 'validated' || b.cardStatus === 'failed');
        const upcomingBonus = bonus.filter(b => b.cardStatus === 'upcoming');

        let html = '';
        if (availableBonus.length > 0) {
            html += this._renderSection('Disponibles', availableBonus, 'section-active');
        }
        if (upcomingBonus.length > 0) {
            html += this._renderSection('À venir', upcomingBonus, 'section-upcoming');
        }
        if (doneBonus.length > 0) {
            html += this._renderSection('Terminés', doneBonus, 'section-done');
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
        const isDone = cardStatus === 'validated' || cardStatus === 'done' || cardStatus === 'failed';

        const title = evaluation.titre || 'Évaluation';
        const duree = parseInt(evaluation.duree) || 0;
        const briques = parseInt(evaluation.briques) || 1;
        const condition = this._getCondition(evaluation);
        const matiere = evaluation.matiere || '';

        // CSS card class
        let cardClass = `eval-card ${config.cssClass}`;
        if (cardStatus === 'upcoming') cardClass += ' upcoming';
        if (isDone) cardClass += ' done';
        if (cardStatus === 'validated') cardClass += ' validated';
        if (cardStatus === 'failed') cardClass += ' failed';

        // Clickable if has result
        let clickAttr = '';
        if (resultat && isDone) {
            clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')"`;
            cardClass += ' clickable';
        }

        // Points badge (top right)
        let pointsBadge = '';
        if (isDone && resultat) {
            const validations = parseFloat(resultat.validations) || 0;
            if (validations > 0) {
                pointsBadge = `<span class="card-points earned">+${validations}</span>`;
            } else {
                pointsBadge = `<span class="card-points lost">+0</span>`;
            }
        } else {
            pointsBadge = `<span class="card-points pending">${briques} point${briques > 1 ? 's' : ''} à gagner</span>`;
        }

        // Type subtitle (colored text)
        const typeSubtitle = `<div class="card-type ${config.cssClass}">${escapeHtml(config.label)}</div>`;

        // Meta line: date · durée · matière · mode
        const metaParts = [];
        const dateStr = this._getCardDate(evaluation, cardStatus);
        if (dateStr) metaParts.push(`<span class="meta-date">📅 ${escapeHtml(dateStr)}</span>`);
        if (duree > 0) metaParts.push(`<span class="meta-duree">⏱ ${duree} min</span>`);
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        if (isPapier) {
            metaParts.push('<span class="meta-mode papier">📄 Papier</span>');
        } else if (cardStatus !== 'upcoming') {
            metaParts.push('<span class="meta-mode numerique">💻 Numérique</span>');
        }
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        // Condition line
        const conditionLine = `<div class="card-condition">Réussite : ${escapeHtml(condition)}</div>`;

        // Action / status (right side of card)
        let actionHtml = '';
        if (cardStatus === 'available' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Commencer</a>`;
        } else if (cardStatus === 'available' && isPapier) {
            actionHtml = '<div class="card-action-info papier">📄 En classe</div>';
        } else if (cardStatus === 'upcoming') {
            const countdown = this.getCountdown(evaluation.date_ouverture);
            actionHtml = `<div class="card-action-info upcoming">🔒 ${escapeHtml(countdown)}</div>`;
        } else if (isDone) {
            actionHtml = '<div class="card-detail-link">Voir le détail →</div>';
        }

        return `
            <div class="${cardClass}"${clickAttr}>
                <div class="card-layout">
                    <div class="card-info">
                        <div class="card-title-row">
                            <span class="card-bullet ${config.cssClass}"></span>
                            <h3 class="card-title">${escapeHtml(title)}</h3>
                        </div>
                        ${typeSubtitle}
                        ${metaLine}
                        ${conditionLine}
                    </div>
                    <div class="card-right">
                        ${pointsBadge}
                        ${actionHtml}
                    </div>
                </div>
            </div>
        `;
    },

    _getCardDate(evaluation, cardStatus) {
        if (cardStatus === 'upcoming' && evaluation.date_ouverture) {
            return this.formatDate(evaluation.date_ouverture);
        }
        if (cardStatus === 'available' && evaluation.date_fermeture) {
            return 'Ferme le ' + this.formatDate(evaluation.date_fermeture);
        }
        // For done cards, show date_ouverture if available
        if (evaluation.date_ouverture) {
            return this.formatDate(evaluation.date_ouverture);
        }
        return '';
    },

    // ========== REVIEW MODAL ==========
    openReview(evaluationId) {
        const ev = this.categories.done.find(e => String(e.id) === String(evaluationId))
            || this.categories.bonus.find(e => String(e.id) === String(evaluationId));
        if (!ev || !ev.resultat) return;

        const resultat = ev.resultat;
        const type = ev.type || 'connaissances';
        const config = this.typeConfig[type] || this.typeConfig['connaissances'];
        const isValidated = this._isTruthy(resultat.is_validated);
        const score = resultat.score || 0;
        const validations = parseFloat(resultat.validations) || 0;
        const tempsPasse = parseInt(resultat.temps_passe) || 0;

        // Parse details
        let details = [];
        try {
            const raw = resultat.details || '[]';
            details = JSON.parse(raw);
        } catch (_e) { /* ignore */ }

        // Time formatting
        const minutes = Math.floor(tempsPasse / 60);
        const seconds = tempsPasse % 60;
        const tempsStr = minutes > 0 ? `${minutes} min ${seconds}s` : `${seconds}s`;

        let html = `
            <div class="review-header ${config.cssClass}">
                <h2>${escapeHtml(ev.titre || 'Évaluation')}</h2>
                <span class="review-type">${config.label}</span>
            </div>

            <div class="review-summary">
                <div class="review-score ${isValidated ? 'success' : 'fail'}">
                    <div class="review-score-value">${score}%</div>
                    <div class="review-score-label">${isValidated ? 'Validée' : 'Non validée'}</div>
                </div>
                <div class="review-stats">
                    <div class="review-stat">
                        <span class="stat-value">${validations}</span>
                        <span class="stat-label">Point${validations > 1 ? 's' : ''} gagné${validations > 1 ? 's' : ''}</span>
                    </div>
                    <div class="review-stat">
                        <span class="stat-value">${tempsStr}</span>
                        <span class="stat-label">Temps passé</span>
                    </div>
                </div>
            </div>
        `;

        // Details per step
        if (details && details.length > 0) {
            html += '<div class="review-details"><h3>Détail par étape</h3>';
            details.forEach((d, i) => {
                if (!d) return;
                const stepFormat = d.f || 'inconnu';
                const stepCorrect = d.c || 0;
                const stepTotal = d.t || 0;
                const stepPct = d.p || 0;
                const stepOk = stepPct >= (parseInt(ev.seuil) || 80);

                html += `
                    <div class="review-step ${stepOk ? 'step-ok' : 'step-ko'}">
                        <span class="step-num">${i + 1}</span>
                        <span class="step-format">${escapeHtml(this._formatLabel(stepFormat))}</span>
                        <span class="step-score">${stepCorrect}/${stepTotal}</span>
                        <span class="step-pct">${stepPct}%</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        document.getElementById('reviewContent').innerHTML = html;
        document.getElementById('reviewModal').classList.remove('hidden');
    },

    closeReview() {
        document.getElementById('reviewModal').classList.add('hidden');
    },

    _formatLabel(format) {
        const labels = {
            'qcm': 'QCM',
            'vrai_faux': 'Vrai / Faux',
            'texte_trou': 'Texte à trous',
            'texte_trous': 'Texte à trous',
            'association': 'Association',
            'timeline': 'Frise chronologique',
            'chronologie': 'Frise chronologique',
            'carte': 'Carte',
            'question_ouverte': 'Question ouverte',
            'flashcard': 'Flashcard',
            'savoir-faire': 'Savoir-faire',
            'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Carte cliquable',
            'document_tableau': 'Document + tableau',
            'document_mixte': 'Document mixte'
        };
        return labels[format] || format;
    },

    // ========== HELPERS ==========
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
            const day = days[date.getDay()];
            const num = date.getDate();
            const month = months[date.getMonth()];
            const hours = date.getHours();
            const mins = String(date.getMinutes()).padStart(2, '0');
            if (hours === 0 && mins === '00') {
                return `${day} ${num} ${month}`;
            }
            return `${day} ${num} ${month} à ${hours}h${mins}`;
        } catch {
            return dateStr;
        }
    },

    getCountdown(dateStr) {
        if (!dateStr) return 'Pas encore ouvert';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diff = date - now;
            if (diff <= 0) return 'Bientôt disponible';
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (days > 0) return `Pas encore ouvert — dans ${days}j ${hours}h`;
            if (hours > 0) return `Pas encore ouvert — dans ${hours}h ${minutes}min`;
            return `Pas encore ouvert — dans ${minutes}min`;
        } catch {
            return 'Pas encore ouvert';
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
