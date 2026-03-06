/**
 * Eleve Evaluations - Liste des évaluations pour l'élève
 * Onglets : Évaluations (conn, SF, comp) / Bonus
 * Carte de progression avec note calculée
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

    // Type config
    typeConfig: {
        'connaissances': { label: 'Connaissances', color: '#3b82f6', bg: '#dbeafe', textColor: '#1e40af', cssClass: 'type-conn' },
        'savoir-faire': { label: 'Savoir-faire', color: '#f59e0b', bg: '#fef3c7', textColor: '#92400e', cssClass: 'type-sf' },
        'competences': { label: 'Compétences', color: '#8b5cf6', bg: '#ede9fe', textColor: '#5b21b6', cssClass: 'type-comp' },
        'bonus': { label: 'Bonus', color: '#eab308', bg: '#fef9c3', textColor: '#854d0e', cssClass: 'type-bonus' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            this.currentUserId = this._getCurrentUserId();
            await this.loadData();
            this.categorizeEvaluations();
            this.renderProgressionCard();
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

    _getCurrentSemestre() {
        const today = new Date();
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && today >= debut && today <= fin) return p.semestre;
        }
        return '1';
    },

    _getCondition(evaluation) {
        const type = evaluation.type || 'connaissances';
        const seuil = parseInt(evaluation.seuil) || 80;
        if (type === 'savoir-faire') return '100% de réussite';
        if (type === 'competences') return 'Critères de réussite';
        return seuil + '% de réussite';
    },

    // ========== PROGRESSION CALCULATION ==========
    _getParams(matiere, semestre) {
        const p = this.parametresNotes.find(
            row => row.matiere === matiere && String(row.semestre) === String(semestre)
        );
        return {
            noteDepart: parseFloat(p?.note_depart) || 8,
            budget: parseFloat(p?.budget_estime) || 100,
            coeffProg: parseFloat(p?.coefficient_progression) || 3
        };
    },

    _calculatePoints(matiere, semestre) {
        const cats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };

        const matchingEvals = this.evaluations.filter(ev => {
            const m = ev.matiere || '';
            if (m !== matiere && m !== 'Les deux') return false;
            return this._getSemestreForEval(ev) === String(semestre);
        });

        matchingEvals.forEach(ev => {
            const result = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            if (result) {
                const validations = parseFloat(result.validations) || 0;
                const categorie = ev.categorie || ev.type || 'connaissances';
                if (cats[categorie] !== undefined) {
                    cats[categorie] += validations;
                }
            }
        });

        return cats;
    },

    _calculateNoteProgression(matiere, semestre) {
        const params = this._getParams(matiere, semestre);
        const points = this._calculatePoints(matiere, semestre);

        const ptsSansBonus = points.connaissances + points['savoir-faire'] + points.competences;
        const noteBase = params.noteDepart + (ptsSansBonus / params.budget) * 19.5;
        const noteAvecBonus = noteBase + points.bonus;
        const note = Math.min(20, Math.max(0, Math.round(noteAvecBonus * 100) / 100));

        return { note, noteDepart: params.noteDepart, budget: params.budget, ptsSansBonus, bonus: points.bonus, categories: points, coeffProg: params.coeffProg };
    },

    _calculateMoyenne(noteProg, coeffProg, matiere, semestre) {
        let totalPts = noteProg * coeffProg;
        let totalCoefs = coeffProg;

        this.notesSommatives
            .filter(s => s.matiere === matiere && String(s.semestre) === String(semestre))
            .forEach(s => {
                const res = this.resultatsSommatives.find(r =>
                    String(r.sommative_id).trim() === String(s.id).trim()
                );
                if (res && res.note !== '' && res.note !== undefined) {
                    const note = parseFloat(res.note);
                    const bareme = parseFloat(s.bareme) || 20;
                    const coef = parseFloat(s.coefficient) || 1;
                    if (!isNaN(note)) {
                        const note20 = (note / bareme) * 20;
                        totalPts += note20 * coef;
                        totalCoefs += coef;
                    }
                }
            });

        if (totalCoefs === 0) return null;
        return Math.round(Math.min(20, Math.max(0, totalPts / totalCoefs)) * 100) / 100;
    },

    // ========== PROGRESSION CARD ==========
    renderProgressionCard() {
        const container = document.getElementById('progressionCard');
        if (!container) return;

        // Determine current matière — use first available or default HG-EMC
        const matieres = [...new Set(this.parametresNotes.map(p => p.matiere))];
        const matiere = matieres[0] || 'HG-EMC';
        const semestre = this._getCurrentSemestre();

        const prog = this._calculateNoteProgression(matiere, semestre);
        const moyenne = this._calculateMoyenne(prog.note, prog.coeffProg, matiere, semestre);

        const noteDisplay = moyenne !== null ? moyenne : prog.note;
        const noteLabel = moyenne !== null ? 'Moyenne' : 'Note de progression';
        const percentage = Math.min(100, (noteDisplay / 20) * 100);

        container.innerHTML = `
            <a href="notes.html" class="progression-link">
                <div class="progression-note">${noteDisplay.toFixed(1)}<span class="progression-sur">/20</span></div>
                <div class="progression-bar">
                    <div class="progression-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progression-label">${escapeHtml(noteLabel)} · S${escapeHtml(String(semestre))} · ${escapeHtml(matiere)}</div>
                <div class="progression-detail">Voir mes notes →</div>
            </a>
        `;
    },

    // ========== CATEGORIZATION ==========
    categorizeEvaluations() {
        this.categories = {
            available: [],   // Disponibles (pas encore passées)
            upcoming: [],    // Planifiées
            done: [],        // Terminées (avec résultat, validé ou non)
            bonus: []        // Bonus disponibles
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
                const isValidated = resultat.is_validated === 'true' || resultat.is_validated === true;
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

        // Toggle active button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Toggle content
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

        // Available evaluations
        if (available.length > 0) {
            html += this._renderSection('À passer', available, 'section-active');
        }

        // Upcoming
        if (upcoming.length > 0) {
            html += this._renderSection('À venir', upcoming, 'section-upcoming');
        }

        // Done (collapsible)
        if (done.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminées <span class="section-count">${done.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
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

        const title = evaluation.titre || 'Évaluation';
        const duree = parseInt(evaluation.duree) || 0;
        const briques = parseInt(evaluation.briques) || 1;
        const condition = this._getCondition(evaluation);

        // CSS card class
        let cardClass = `eval-card ${config.cssClass}`;
        if (cardStatus === 'upcoming') cardClass += ' upcoming';
        if (cardStatus === 'validated' || cardStatus === 'done' || cardStatus === 'failed') cardClass += ' done';

        // Clickable if has result
        let clickAttr = '';
        if (resultat && (cardStatus === 'validated' || cardStatus === 'done' || cardStatus === 'failed')) {
            clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')" style="cursor:pointer"`;
        }

        // Status badge
        let statusBadge = '';
        if (cardStatus === 'validated') {
            statusBadge = '<span class="status-badge validated">Validée</span>';
        } else if (cardStatus === 'failed') {
            statusBadge = '<span class="status-badge failed">Non validée</span>';
        } else if (cardStatus === 'done') {
            statusBadge = '<span class="status-badge closed">Terminée</span>';
        }

        // Points badge (top right)
        let pointsBadge = '';
        if (resultat && (cardStatus === 'validated' || cardStatus === 'done')) {
            const validations = parseFloat(resultat.validations) || 0;
            if (validations > 0) {
                pointsBadge = `<span class="points-badge earned">+${validations} pt${validations > 1 ? 's' : ''}</span>`;
            }
        } else if (cardStatus === 'available') {
            pointsBadge = `<span class="points-badge available">${briques} pt${briques > 1 ? 's' : ''}</span>`;
        }

        // Meta line
        let metaParts = [];
        metaParts.push(`<span class="meta-type ${config.cssClass}">${config.label}</span>`);
        if (duree > 0) metaParts.push(`<span class="meta-item">${duree} min</span>`);
        if (isPapier) metaParts.push('<span class="meta-item meta-papier">En classe</span>');

        const metaHtml = `<div class="eval-card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`;

        // Date info
        let dateHtml = '';
        if (cardStatus === 'upcoming' && evaluation.date_ouverture) {
            dateHtml = `<div class="eval-card-date">Ouvre le ${this.formatDate(evaluation.date_ouverture)}</div>`;
        }
        if (evaluation.date_fermeture && cardStatus === 'available') {
            dateHtml += `<div class="eval-card-date">Ferme le ${this.formatDate(evaluation.date_fermeture)}</div>`;
        }

        // Condition
        const conditionHtml = `<div class="eval-card-condition">${escapeHtml(condition)}</div>`;

        // Result for done cards
        let resultHtml = '';
        if (resultat && (cardStatus === 'validated' || cardStatus === 'done' || cardStatus === 'failed')) {
            const score = resultat.score || 0;
            resultHtml = `<div class="eval-card-result"><span class="result-score ${cardStatus === 'validated' ? 'success' : ''}">${score}%</span></div>`;
        }

        // Action button
        let actionHtml = '';
        if (cardStatus === 'available' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="btn-eval btn-start ${config.cssClass}">Commencer</a>`;
        } else if (cardStatus === 'available' && isPapier) {
            actionHtml = '<span class="papier-label">Évaluation en classe</span>';
        } else if (cardStatus === 'upcoming') {
            const countdown = this.getCountdown(evaluation.date_ouverture);
            actionHtml = `<span class="countdown-badge">${countdown}</span>`;
        } else if (resultat) {
            actionHtml = '<span class="btn-review">Voir le détail</span>';
        }

        return `
            <div class="${cardClass}"${clickAttr}>
                <div class="eval-card-body">
                    <div class="eval-card-top">
                        <div class="eval-card-title">${escapeHtml(title)} ${statusBadge}</div>
                        ${pointsBadge}
                    </div>
                    ${metaHtml}
                    ${dateHtml}
                    ${conditionHtml}
                    ${resultHtml}
                </div>
                <div class="eval-card-right">
                    ${actionHtml}
                </div>
            </div>
        `;
    },

    // ========== REVIEW MODAL ==========
    openReview(evaluationId) {
        const ev = this.categories.done.find(e => String(e.id) === String(evaluationId))
            || this.categories.bonus.find(e => String(e.id) === String(evaluationId));
        if (!ev || !ev.resultat) return;

        const resultat = ev.resultat;
        const type = ev.type || 'connaissances';
        const config = this.typeConfig[type] || this.typeConfig['connaissances'];
        const isValidated = resultat.is_validated === 'true' || resultat.is_validated === true;
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
