/**
 * Eleve Evaluations - Liste des évaluations pour l'élève
 * Onglets : Mes évaluations (progression + contrôles) / Gagner plus de points (bonus)
 * Bandeau progression : moyenne par matière + barre objectif
 * Review modal pour les évaluations terminées
 */

const EleveEvaluations = {
    // Data
    evaluations: [],
    resultats: [],
    parametresNotes: [],
    notesSommatives: [],
    resultatsSommatives: [],
    objectifs: [],
    currentUserId: null,
    currentTab: 'evaluations',
    currentSemestre: null,

    _isTruthy(val) {
        if (val === true) return true;
        if (typeof val === 'string') return val.toLowerCase() === 'true';
        return false;
    },

    // Type config — includes 'controle' for sommatives
    typeConfig: {
        'connaissances': { label: 'Connaissances', sublabel: 'Progression', color: '#3b82f6', cssClass: 'type-conn' },
        'savoir-faire': { label: 'Savoir-faire', sublabel: 'Progression', color: '#f59e0b', cssClass: 'type-sf' },
        'competences': { label: 'Compétences', sublabel: 'Progression', color: '#8b5cf6', cssClass: 'type-comp' },
        'bonus': { label: 'Bonus', sublabel: 'Progression', color: '#eab308', cssClass: 'type-bonus' },
        'controle': { label: 'Contrôle', sublabel: 'Note classique', color: '#64748b', cssClass: 'type-controle' }
    },

    // ========== INITIALIZATION ==========
    async init() {
        try {
            this.currentUserId = this._getCurrentUserId();
            await this.loadData();
            this._detectCurrentSemestre();
            this.categorizeEvaluations();
            this.render();
            this._renderProgressionBanner();
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
        const [evaluationsData, resultatsData, parametresData, sommativesData, resSommativesData, objectifsData] = await Promise.all([
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => [])
        ]);

        this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        this.parametresNotes = SheetsAPI.parseSheetData(parametresData);
        this.notesSommatives = SheetsAPI.parseSheetData(sommativesData);
        this.objectifs = SheetsAPI.parseSheetData(objectifsData);

        const allResultats = SheetsAPI.parseSheetData(resultatsData);
        this.resultats = allResultats.filter(r =>
            String(r.eleve_id).trim() === String(this.currentUserId).trim()
        );

        const allResSommatives = SheetsAPI.parseSheetData(resSommativesData);
        this.resultatsSommatives = allResSommatives.filter(r =>
            String(r.eleve_id).trim() === String(this.currentUserId).trim()
        );

        // Only visible evaluations
        this.evaluations = this.evaluations.filter(e => {
            const s = this._computeEffectiveStatut(e);
            return s === 'planifiee' || s === 'publiee' || s === 'terminee';
        });
    },

    // ========== SEMESTRE ==========
    _detectCurrentSemestre() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && today >= debut && today <= fin) {
                this.currentSemestre = String(p.semestre);
                return;
            }
        }
        this.currentSemestre = '1';
    },

    // ========== STATUS ==========
    _computeEffectiveStatut(evaluation) {
        // Papier : statut géré manuellement (pas d'auto-calcul depuis les dates)
        if (evaluation.mode_passation === 'papier') {
            return evaluation.statut || 'brouillon';
        }
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
        if (!dateStr) return this.currentSemestre;
        const evalDate = new Date(dateStr);
        if (isNaN(evalDate.getTime())) return this.currentSemestre;
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && evalDate >= debut && evalDate <= fin) return String(p.semestre);
        }
        return this.currentSemestre;
    },

    _getCondition(evaluation) {
        const type = evaluation.type || 'connaissances';
        const seuil = parseInt(evaluation.seuil) || 80;
        if (type === 'savoir-faire') return '100% de réussite';
        if (type === 'competences') return 'Critères de réussite';
        return seuil + '% de bonnes réponses';
    },

    // ========== PROGRESSION CALCULATION (same logic as eleve-notes) ==========
    _getParams(matiere) {
        const p = this.parametresNotes.find(
            row => row.matiere === matiere && String(row.semestre) === String(this.currentSemestre)
        );
        return {
            noteDepart: parseFloat(p?.note_depart) || 8,
            budget: parseFloat(p?.budget_estime) || 100,
            coeffProg: parseFloat(p?.coefficient_progression) || 3
        };
    },

    _calculatePoints(matiere) {
        const cats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };
        const matchingEvals = this.evaluations.filter(ev => {
            const m = ev.matiere || '';
            if (m !== matiere && m !== 'Les deux') return false;
            return this._getSemestreForEval(ev) === String(this.currentSemestre);
        });
        matchingEvals.forEach(ev => {
            const result = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            if (result) {
                const validations = parseFloat(result.validations) || 0;
                const categorie = ev.categorie || ev.type || 'connaissances';
                if (cats[categorie] !== undefined) cats[categorie] += validations;
            }
        });
        const total = cats.connaissances + cats['savoir-faire'] + cats.competences + cats.bonus;
        return { ...cats, total };
    },

    _calculateProgression(matiere) {
        const params = this._getParams(matiere);
        const points = this._calculatePoints(matiere);
        const ptsSansBonus = points.connaissances + points['savoir-faire'] + points.competences;
        const noteBase = params.noteDepart + (ptsSansBonus / params.budget) * 19.5;
        const noteAvecBonus = noteBase + points.bonus;
        const note = Math.min(20, Math.max(0, Math.round(noteAvecBonus * 100) / 100));
        return { note, noteDepart: params.noteDepart };
    },

    _getSommatives(matiere) {
        return this.notesSommatives
            .filter(s => {
                const m = s.matiere || '';
                return (m === matiere || m === 'Les deux') && String(s.semestre || '1') === String(this.currentSemestre);
            })
            .map(s => {
                const r = this.resultatsSommatives.find(res =>
                    String(res.sommative_id).trim() === String(s.id).trim()
                );
                const note = r && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
                const bareme = parseFloat(s.bareme) || 20;
                const coefficient = parseFloat(s.coefficient) || 1;
                const note20 = note !== null ? (note / bareme) * 20 : null;
                return { ...s, note, bareme, coefficient, note20 };
            });
    },

    _calculateMoyenne(matiere) {
        const params = this._getParams(matiere);
        const prog = this._calculateProgression(matiere);
        const soms = this._getSommatives(matiere);
        let totalPts = prog.note * params.coeffProg;
        let totalCoefs = params.coeffProg;
        soms.forEach(s => {
            if (s.note20 !== null) {
                totalPts += s.note20 * s.coefficient;
                totalCoefs += s.coefficient;
            }
        });
        if (totalCoefs === 0) return null;
        return Math.min(20, Math.max(0, Math.round(totalPts / totalCoefs * 100) / 100));
    },

    _getObjectif(matiere) {
        const obj = this.objectifs.find(o =>
            String(o.eleve_id).trim() === String(this.currentUserId).trim() &&
            o.matiere === matiere &&
            String(o.semestre) === String(this.currentSemestre)
        );
        return obj ? parseFloat(obj.objectif_note) : null;
    },

    _fmt(note) {
        if (note === null || note === undefined) return '—';
        return (Math.round(note * 10) / 10).toFixed(1);
    },

    // ========== HERO HEADER (gauges) ==========
    _getNoteColor(note) {
        if (note === null) return '#9ca3af';
        const ratio = note / 20;
        if (ratio < 0.25) return '#ef4444';
        if (ratio < 0.4) return '#f97316';
        if (ratio < 0.5) return '#f59e0b';
        if (ratio < 0.6) return '#eab308';
        if (ratio < 0.75) return '#84cc16';
        return '#10b981';
    },

    _renderProgressionBanner() {
        const container = document.getElementById('progressionBanner');
        if (!container) return;

        const matieres = [
            { code: 'FR', label: 'FR', accentColor: '#6366f1' },
            { code: 'HG-EMC', label: 'HG-EMC', accentColor: '#8b5cf6' }
        ];

        const size = 80;
        const strokeW = 7;
        const r = (size - strokeW) / 2; // 36.5
        const circ = 2 * Math.PI * r;
        const cx = size / 2;
        const cy = size / 2;
        const tickLen = 5;

        const gauges = matieres.map(mat => {
            const moyenne = this._calculateMoyenne(mat.code);
            const objectif = this._getObjectif(mat.code);
            const note = moyenne !== null ? Math.round(moyenne * 10) / 10 : null;
            const pct = note !== null ? Math.min(1, Math.max(0, note / 20)) : 0;
            const dynColor = this._getNoteColor(note);
            const noteDisplay = note !== null ? note.toFixed(1) : '—';

            // Objective calculations
            const objPct = objectif ? Math.min(objectif / 20, 1) : null;

            // SVG layers
            // Layer 1: Track
            const trackCircle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f0f0f0" stroke-width="${strokeW}" style="transform:rotate(-90deg);transform-origin:center"/>`;

            // Layer 2: Objective zone (faint arc from 0 to objective)
            let objZone = '';
            if (objPct) {
                objZone = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${mat.accentColor}" stroke-width="${strokeW}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - objPct)}" opacity="0.1" style="transform:rotate(-90deg);transform-origin:center"/>`;
            }

            // Layer 3: Progress arc
            const progressCircle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${dynColor}" stroke-width="${strokeW}" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}" stroke-linecap="round" class="mini-gauge-arc" style="transform:rotate(-90deg);transform-origin:center"/>`;

            // Layer 4: Objective tick mark
            let objTick = '';
            let tooltipHtml = '';
            if (objPct) {
                const objAngle = (objPct * 360 - 90) * (Math.PI / 180);
                const x1 = cx + (r - tickLen) * Math.cos(objAngle);
                const y1 = cy + (r - tickLen) * Math.sin(objAngle);
                const x2 = cx + (r + tickLen) * Math.cos(objAngle);
                const y2 = cy + (r + tickLen) * Math.sin(objAngle);
                objTick = `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${mat.accentColor}" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>`;

                // Tooltip position (outside the arc)
                const tooltipX = cx + (r + 16) * Math.cos(objAngle);
                const tooltipY = cy + (r + 16) * Math.sin(objAngle);
                tooltipHtml = `<div class="mini-gauge-tooltip" style="left:${(tooltipX - 22).toFixed(1)}px;top:${(tooltipY - 12).toFixed(1)}px">🎯 Objectif\u00a0: ${objectif}/20</div>`;
            }

            // Below gauge
            let belowHtml = '';
            if (!objectif) {
                belowHtml = `<a href="notes.html" class="mini-gauge-obj" style="color:${mat.accentColor}">Fixe un obj.</a>`;
            }

            return `
                <div class="mini-gauge">
                    <div class="mini-gauge-circle">
                        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
                            ${trackCircle}
                            ${objZone}
                            ${progressCircle}
                            ${objTick}
                        </svg>
                        <div class="mini-gauge-center">
                            <span class="mini-gauge-value" style="color:${dynColor}">${noteDisplay}</span>
                            <span class="mini-gauge-unit">/20</span>
                        </div>
                        ${tooltipHtml}
                    </div>
                    <span class="mini-gauge-label" style="color:${mat.accentColor}">${mat.label}</span>
                    ${belowHtml}
                </div>
            `;
        }).join('');

        container.innerHTML = gauges;
    },

    // ========== CATEGORIZATION ==========
    categorizeEvaluations() {
        this.categories = {
            available: [],
            upcoming: [],
            done: [],
            bonus: [],
            sommatives: []
        };

        // Progression evaluations
        this.evaluations.forEach(ev => {
            const resultat = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            const effectiveStatut = this._computeEffectiveStatut(ev);
            const isBonus = ev.type === 'bonus';

            if (effectiveStatut === 'terminee') {
                if (resultat) {
                    // statut_resultat contient 'non_rendu' ou 'absent' si la prof l'a saisi
                    const statutRes = String(resultat.statut_resultat || '').trim();
                    if (statutRes === 'non_rendu') {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'non_rendu' });
                    } else if (statutRes === 'absent') {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'absent' });
                    } else {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'done' });
                    }
                } else {
                    // Pas de résultat du tout → carte visible en "non passée"
                    this.categories.done.push({ ...ev, cardStatus: 'not_done' });
                }
                return;
            }

            if (effectiveStatut === 'planifiee') {
                if (isBonus) this.categories.bonus.push({ ...ev, cardStatus: 'upcoming' });
                else this.categories.upcoming.push({ ...ev, cardStatus: 'upcoming' });
                return;
            }

            if (resultat) {
                // Vérifier NR/ABS même si l'éval n'est pas encore terminée
                const statutRes = String(resultat.statut_resultat || '').trim();
                if (statutRes === 'non_rendu' || statutRes === 'absent') {
                    const cs = statutRes === 'non_rendu' ? 'non_rendu' : 'absent';
                    if (isBonus) this.categories.bonus.push({ ...ev, resultat, cardStatus: cs });
                    else this.categories.done.push({ ...ev, resultat, cardStatus: cs });
                    return;
                }
                const isValidated = this._isTruthy(resultat.is_validated);
                const status = isValidated ? 'validated' : 'failed';
                if (isBonus) this.categories.bonus.push({ ...ev, resultat, cardStatus: status });
                else this.categories.done.push({ ...ev, resultat, cardStatus: status });
            } else {
                if (isBonus) this.categories.bonus.push({ ...ev, cardStatus: 'available' });
                else this.categories.available.push({ ...ev, cardStatus: 'available' });
            }
        });

        // Sommative evaluations (from NOTES_SOMMATIVES)
        this.notesSommatives.forEach(som => {
            if (this._getSemestreForEval(som) !== String(this.currentSemestre)) return;
            const r = this.resultatsSommatives.find(res =>
                String(res.sommative_id).trim() === String(som.id).trim()
            );
            const note = r && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
            const bareme = parseFloat(som.bareme) || 20;
            const coefficient = parseFloat(som.coefficient) || 1;
            const hasNote = note !== null;
            this.categories.sommatives.push({
                ...som,
                type: 'controle',
                note, bareme, coefficient,
                cardStatus: hasNote ? 'done' : 'upcoming',
                isSommative: true
            });
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
        const { available, upcoming, done, sommatives } = this.categories;
        const evalsCount = available.length + upcoming.length + done.length + sommatives.length;
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
        const { available, upcoming, done, sommatives } = this.categories;

        const totalCount = available.length + upcoming.length + done.length + sommatives.length;
        if (totalCount === 0) {
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

        // Sommatives with pending note
        const sommativesPending = sommatives.filter(s => s.cardStatus === 'upcoming');
        const sommativesDone = sommatives.filter(s => s.cardStatus === 'done');
        if (sommativesPending.length > 0) {
            html += this._renderSection('Contrôles à venir', sommativesPending, 'section-upcoming');
        }

        // Merge done progression + done sommatives
        const allDone = [...done, ...sommativesDone];
        if (allDone.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminées <span class="section-count">${allDone.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
                        ${allDone.map(e => e.isSommative ? this.renderSommativeCard(e) : this.renderCard(e)).join('')}
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
                    <p>Passe des évaluations bonus pour gagner des points supplémentaires !</p>
                </div>
            `;
            return;
        }

        const availableBonus = bonus.filter(b => b.cardStatus === 'available');
        const doneBonus = bonus.filter(b => b.cardStatus === 'validated' || b.cardStatus === 'failed');
        const upcomingBonus = bonus.filter(b => b.cardStatus === 'upcoming');

        let html = '';
        if (availableBonus.length > 0) html += this._renderSection('Disponibles', availableBonus, 'section-active');
        if (upcomingBonus.length > 0) html += this._renderSection('À venir', upcomingBonus, 'section-upcoming');
        if (doneBonus.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminés <span class="section-count">${doneBonus.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
                        ${doneBonus.map(e => this.renderCard(e)).join('')}
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
                    ${evals.map(e => e.isSommative ? this.renderSommativeCard(e) : this.renderCard(e)).join('')}
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

    // ========== PROGRESSION CARD ==========
    renderCard(evaluation) {
        const type = evaluation.type || 'connaissances';
        const config = this.typeConfig[type] || this.typeConfig['connaissances'];
        const isPapier = evaluation.mode_passation === 'papier';
        const cardStatus = evaluation.cardStatus;
        const resultat = evaluation.resultat;
        const isNonRendu = cardStatus === 'non_rendu';
        const isAbsent = cardStatus === 'absent';
        const isNotDone = cardStatus === 'not_done';
        const isMissed = isNonRendu || isAbsent || isNotDone;
        const isDone = cardStatus === 'validated' || cardStatus === 'done' || cardStatus === 'failed' || isMissed;

        const title = evaluation.titre || 'Évaluation';
        const duree = parseInt(evaluation.duree) || 0;
        const briques = parseInt(evaluation.briques) || 1;
        const condition = this._getCondition(evaluation);
        const matiere = evaluation.matiere || '';

        let cardClass = `eval-card ${config.cssClass}`;
        if (cardStatus === 'upcoming') cardClass += ' upcoming';
        if (isDone) cardClass += ' done';
        if (cardStatus === 'validated') cardClass += ' validated';
        if (cardStatus === 'failed' || isMissed) cardClass += ' failed';

        let clickAttr = '';
        if (resultat && isDone && !isMissed) {
            clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')"`;
            cardClass += ' clickable';
        }

        // Points badge
        let pointsBadge = '';
        if (isNonRendu) {
            pointsBadge = '<span class="card-points lost">Non rendu</span><span class="card-points-sub">+0</span>';
        } else if (isAbsent) {
            pointsBadge = '<span class="card-points lost">Absent(e)</span><span class="card-points-sub">+0</span>';
        } else if (isNotDone) {
            pointsBadge = '<span class="card-points lost">Non passée</span>';
        } else if (isDone && resultat) {
            const validations = parseFloat(resultat.validations) || 0;
            pointsBadge = validations > 0
                ? `<span class="card-points earned">+${validations}</span>`
                : '<span class="card-points lost">+0</span>';
        } else {
            pointsBadge = `<span class="card-points pending">${briques} point${briques > 1 ? 's' : ''} à gagner</span>`;
        }

        // Type subtitle
        const typeSubtitle = `<div class="card-type ${config.cssClass}">${escapeHtml(config.label)} · <span class="card-sublabel">Progression</span></div>`;

        // Meta
        const metaParts = [];
        const dateStr = this._getCardDate(evaluation, cardStatus);
        if (dateStr) metaParts.push(`<span class="meta-date">${escapeHtml(dateStr)}</span>`);
        if (duree > 0) metaParts.push(`<span class="meta-duree">${duree} min</span>`);
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        if (isPapier) metaParts.push('<span class="meta-mode papier">Papier</span>');
        else if (cardStatus !== 'upcoming') metaParts.push('<span class="meta-mode numerique">Numérique</span>');
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        const conditionLine = `<div class="card-condition">Réussite : ${escapeHtml(condition)}</div>`;

        // Action
        let actionHtml = '';
        if (cardStatus === 'available' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Commencer</a>`;
        } else if (cardStatus === 'available' && isPapier) {
            actionHtml = '<div class="card-action-info papier">En classe</div>';
        } else if (cardStatus === 'upcoming') {
            actionHtml = `<div class="card-action-info upcoming">${escapeHtml(this.getCountdown(evaluation.date_ouverture))}</div>`;
        } else if (isMissed) {
            actionHtml = '';
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

    // ========== SOMMATIVE CARD ==========
    renderSommativeCard(som) {
        const config = this.typeConfig['controle'];
        const hasNote = som.note !== null;
        const matiere = som.matiere || '';
        const title = som.titre || 'Contrôle';

        let cardClass = `eval-card ${config.cssClass}`;
        if (hasNote) cardClass += ' done';
        else cardClass += ' upcoming';

        // Badge: note or coef
        let badge = '';
        if (hasNote) {
            const note20 = som.bareme === 20 ? som.note : Math.round((som.note / som.bareme) * 20 * 10) / 10;
            const colorClass = note20 >= 10 ? 'earned' : 'lost';
            badge = `<span class="card-points ${colorClass}">${som.note}/${som.bareme}</span>`;
        } else {
            badge = `<span class="card-points pending">coef. ${som.coefficient}</span>`;
        }

        // Type subtitle
        const typeSubtitle = `<div class="card-type ${config.cssClass}">${escapeHtml(config.label)} · <span class="card-sublabel">coef. ${som.coefficient}</span></div>`;

        // Meta
        const metaParts = [];
        if (som.date) metaParts.push(`<span class="meta-date">${escapeHtml(this.formatDate(som.date))}</span>`);
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        // Status
        let statusHtml = '';
        if (hasNote) {
            statusHtml = '<div class="card-action-info">Note publiée</div>';
        } else {
            statusHtml = '<div class="card-action-info upcoming">Note à venir</div>';
        }

        return `
            <div class="${cardClass}">
                <div class="card-layout">
                    <div class="card-info">
                        <div class="card-title-row">
                            <span class="card-bullet ${config.cssClass}"></span>
                            <h3 class="card-title">${escapeHtml(title)}</h3>
                        </div>
                        ${typeSubtitle}
                        ${metaLine}
                    </div>
                    <div class="card-right">
                        ${badge}
                        ${statusHtml}
                    </div>
                </div>
            </div>
        `;
    },

    _getCardDate(evaluation, cardStatus) {
        if (cardStatus === 'upcoming' && evaluation.date_ouverture) return this.formatDate(evaluation.date_ouverture);
        if (cardStatus === 'available' && evaluation.date_fermeture) return 'Ferme le ' + this.formatDate(evaluation.date_fermeture);
        if (evaluation.date_ouverture) return this.formatDate(evaluation.date_ouverture);
        return '';
    },

    // ========== REVIEW ==========
    openReview(evaluationId) {
        window.location.href = 'evaluation.html?id=' + evaluationId + '&mode=review';
    },

    _formatLabel(format) {
        const labels = {
            'qcm': 'QCM', 'vrai_faux': 'Vrai / Faux', 'texte_trou': 'Texte à trous',
            'texte_trous': 'Texte à trous', 'association': 'Association',
            'timeline': 'Frise chronologique', 'chronologie': 'Frise chronologique',
            'carte': 'Carte', 'question_ouverte': 'Question ouverte', 'flashcard': 'Flashcard',
            'savoir-faire': 'Savoir-faire', 'tableau_saisie': 'Tableau',
            'carte_cliquable': 'Carte cliquable', 'document_tableau': 'Document + tableau',
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
            const d = days[date.getDay()];
            const num = date.getDate();
            const m = months[date.getMonth()];
            const h = date.getHours();
            const min = String(date.getMinutes()).padStart(2, '0');
            if (h === 0 && min === '00') return `${d} ${num} ${m}`;
            return `${d} ${num} ${m} à ${h}h${min}`;
        } catch { return dateStr; }
    },

    getCountdown(dateStr) {
        if (!dateStr) return 'Pas encore ouvert';
        try {
            const diff = new Date(dateStr) - new Date();
            if (diff <= 0) return 'Bientôt disponible';
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            if (days > 0) return `Dans ${days}j ${hours}h`;
            if (hours > 0) return `Dans ${hours}h ${mins}min`;
            return `Dans ${mins}min`;
        } catch { return 'Pas encore ouvert'; }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { EleveEvaluations.init(); }, 200);
});

window.EleveEvaluations = EleveEvaluations;
