/**
 * Admin Tableau de Bord - Notes et progression
 * Calcul des notes de progression, moyennes pondérées, vue classe et détail élève
 */

const AdminTableauBord = {
    // Data
    eleves: [],
    evaluations: [],
    resultats: [],
    sommatives: [],
    resultatsSommatives: [],
    parametresNotes: [],

    // Computed grades per student
    grades: {},

    // Current state
    currentSemestre: '1',
    searchFilter: '',
    sortColumn: 'name',
    sortAsc: true,

    // ========== INITIALIZATION ==========
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.calculateAllGrades();
            this.renderSummary();
            this.renderTable();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation tableau de bord:', error);
            this.showError('Erreur lors du chargement des données');
        }
    },

    async loadData() {
        const [
            elevesData,
            evaluationsData,
            resultatsData,
            sommativesData,
            resultatsSommativesData,
            parametresData,
            referentielData
        ] = await Promise.all([
            SheetsAPI.getSheetData('UTILISATEURS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('CompetencesReferentiel').catch(() => [])
        ]);

        this.eleves = SheetsAPI.parseSheetData(elevesData).filter(u => u.role === 'eleve');
        this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        this.resultats = SheetsAPI.parseSheetData(resultatsData);
        this.sommatives = SheetsAPI.parseSheetData(sommativesData);
        this.resultatsSommatives = SheetsAPI.parseSheetData(resultatsSommativesData);
        this.parametresNotes = SheetsAPI.parseSheetData(parametresData);
        this.competencesReferentiel = SheetsAPI.parseSheetData(referentielData);
    },

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('tdb-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div style="text-align: center; padding: 60px 24px; color: #94a3b8;">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <h3 style="color: #475569;">${escapeHtml(message)}</h3>
            </div>
        `;
    },

    // ========== EVENT LISTENERS ==========
    setupEventListeners() {
        // Semestre toggle
        document.querySelectorAll('.sem-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sem-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentSemestre = e.currentTarget.dataset.semestre;
                this.calculateAllGrades();
                this.renderSummary();
                this.renderTable();
            });
        });

        // Search
        document.getElementById('searchEleve').addEventListener('input', (e) => {
            this.searchFilter = e.target.value.toLowerCase();
            this.renderTable();
        });

        // Sort headers
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortColumn === col) {
                    this.sortAsc = !this.sortAsc;
                } else {
                    this.sortColumn = col;
                    this.sortAsc = true;
                }
                this.renderTable();
            });
        });

        // Detail overlay close on click outside
        document.getElementById('detailOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'detailOverlay') {
                this.closeDetail();
            }
        });
    },

    // ========== GRADE CALCULATION ==========

    /**
     * Détermine le semestre d'une évaluation à partir de sa date
     * et des plages de dates dans PARAMETRES_NOTES.
     * Fallback : semestre en cours.
     */
    _getSemestreForEval(ev) {
        const dateStr = ev.date_ouverture || ev.date_debut || '';
        if (!dateStr) return this.currentSemestre;

        const evalDate = new Date(dateStr);
        if (isNaN(evalDate.getTime())) return this.currentSemestre;

        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && evalDate >= debut && evalDate <= fin) {
                return String(p.semestre);
            }
        }
        return this.currentSemestre;
    },

    /**
     * Get parameters for a matière/semestre
     */
    _getParams(matiere, semestre) {
        const params = this.parametresNotes.find(p =>
            p.matiere === matiere && String(p.semestre) === String(semestre)
        );
        return {
            noteDepart: parseFloat(params?.note_depart) || 8,
            budget: parseFloat(params?.budget_estime) || 100,
            coeffProgression: parseFloat(params?.coefficient_progression) || 3
        };
    },

    /**
     * Calculate points acquired by a student for a matière
     * Returns: { connaissances, savoirFaire, competences, bonus, total }
     */
    _calculatePoints(eleveId, matiere, semestre) {
        const cats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };

        // Toutes les évals du semestre (on filtre la matière en dessous, selon le mode)
        const semestreEvals = this.evaluations.filter(ev => {
            return this._getSemestreForEval(ev) === String(semestre);
        });

        semestreEvals.forEach(ev => {
            const result = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim() &&
                String(r.eleve_id).trim() === String(eleveId).trim()
            );
            if (!result) return;

            // NE (non évalué) : ne pas compter dans les points
            const statutRes = String(result.statut_resultat || '').trim();
            if (statutRes === 'non_evalue') return;

            const categorie = ev.categorie || ev.type || 'connaissances';
            if (cats[categorie] === undefined) return;

            // Mode points par compétence : ventiler par matière de la compétence
            const resPpc = this._parsePointsParCompetence(result.points_par_competence);
            if (resPpc && Object.keys(resPpc).length > 0) {
                for (const compId in resPpc) {
                    const compMat = this._getCompetenceMatiere(compId, ev);
                    if (compMat === matiere || compMat === 'Transversal') {
                        cats[categorie] += parseFloat(resPpc[compId]) || 0;
                    }
                }
            } else {
                // Fallback : ancien mode global (filtrer par matière de l'éval)
                const m = ev.matiere || '';
                if (m === matiere || m === 'Les deux') {
                    cats[categorie] += parseFloat(result.validations) || 0;
                }
            }
        });

        const total = cats.connaissances + cats['savoir-faire'] + cats.competences + cats.bonus;
        return { ...cats, total };
    },

    _parsePointsParCompetence(raw) {
        if (!raw) return null;
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        } catch (_e) { return null; }
    },

    _getCompetenceMatiere(compId, evaluation) {
        const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
        if (comp) return comp.matiere || 'Transversal';
        // Compétences personnalisées : chercher dans criteres_libres de l'évaluation
        if (evaluation && evaluation.criteres_libres) {
            try {
                const parsed = typeof evaluation.criteres_libres === 'string'
                    ? JSON.parse(evaluation.criteres_libres) : evaluation.criteres_libres;
                if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
                    const cc = parsed.find(c => c.id === compId);
                    if (cc) return cc.matiere || 'FR';
                }
            } catch (_e) { /* ignore */ }
        }
        return 'Transversal';
    },

    /**
     * Calculate note de progression
     * Formula: noteDepart + (points / budget) × 19.5, capped at 20
     * Bonus is added on top (also capped at 20)
     */
    _calculateNoteProgression(eleveId, matiere, semestre) {
        const params = this._getParams(matiere, semestre);
        const points = this._calculatePoints(eleveId, matiere, semestre);

        const pointsSansBonus = points.connaissances + points['savoir-faire'] + points.competences;
        const noteBase = params.noteDepart + (pointsSansBonus / params.budget) * 19.5;
        const noteAvecBonus = noteBase + points.bonus;
        const noteCapped = Math.min(20, Math.max(0, noteAvecBonus));

        return {
            note: Math.round(noteCapped * 100) / 100,
            noteDepart: params.noteDepart,
            budget: params.budget,
            pointsSansBonus,
            bonus: points.bonus,
            pointsTotal: points.total,
            categories: points
        };
    },

    /**
     * Get sommatives results for a student in a matière/semestre
     * Returns array of { titre, note, bareme, coefficient, note20 }
     */
    _getSommativesEleve(eleveId, matiere, semestre) {
        const matchingSom = this.sommatives.filter(s => {
            const m = s.matiere || '';
            const sem = String(s.semestre || '1');
            return (m === matiere || m === 'Les deux') && sem === String(semestre);
        });

        return matchingSom.map(s => {
            const result = this.resultatsSommatives.find(r =>
                String(r.sommative_id).trim() === String(s.id).trim() &&
                String(r.eleve_id).trim() === String(eleveId).trim()
            );
            const note = result && result.note !== '' && result.note !== undefined ? parseFloat(result.note) : null;
            const bareme = parseFloat(s.bareme) || 20;
            const coefficient = parseFloat(s.coefficient) || 1;
            const note20 = note !== null ? (note / bareme) * 20 : null;

            return {
                titre: s.titre || 'Sans titre',
                note,
                bareme,
                coefficient,
                note20: note20 !== null ? Math.round(note20 * 100) / 100 : null
            };
        });
    },

    /**
     * Calculate weighted average (moyenne pondérée)
     * (progression × coefProg + Σ(sommative_note20 × coef)) / (coefProg + Σ(coef))
     */
    _calculateMoyenne(noteProgression, coeffProgression, sommatives) {
        let totalPoints = noteProgression * coeffProgression;
        let totalCoefs = coeffProgression;

        sommatives.forEach(s => {
            if (s.note20 !== null) {
                totalPoints += s.note20 * s.coefficient;
                totalCoefs += s.coefficient;
            }
        });

        if (totalCoefs === 0) return null;
        const moyenne = totalPoints / totalCoefs;
        return Math.round(Math.min(20, Math.max(0, moyenne)) * 100) / 100;
    },

    /**
     * Calculate all grades for all students
     */
    calculateAllGrades() {
        this.grades = {};
        const sem = this.currentSemestre;

        this.eleves.forEach(eleve => {
            const id = eleve.id;

            // FR
            const progFR = this._calculateNoteProgression(id, 'FR', sem);
            const somFR = this._getSommativesEleve(id, 'FR', sem);
            const paramsFR = this._getParams('FR', sem);
            const moyFR = this._calculateMoyenne(progFR.note, paramsFR.coeffProgression, somFR);

            // HG-EMC
            const progHG = this._calculateNoteProgression(id, 'HG-EMC', sem);
            const somHG = this._getSommativesEleve(id, 'HG-EMC', sem);
            const paramsHG = this._getParams('HG-EMC', sem);
            const moyHG = this._calculateMoyenne(progHG.note, paramsHG.coeffProgression, somHG);

            this.grades[id] = {
                eleve,
                progFR,
                progHG,
                somFR,
                somHG,
                moyFR,
                moyHG
            };
        });
    },

    // ========== RENDER SUMMARY ==========
    renderSummary() {
        const ids = Object.keys(this.grades);
        const nbEleves = ids.length;

        // Averages
        let sumMoyFR = 0, countFR = 0;
        let sumMoyHG = 0, countHG = 0;

        ids.forEach(id => {
            const g = this.grades[id];
            if (g.moyFR !== null) { sumMoyFR += g.moyFR; countFR++; }
            if (g.moyHG !== null) { sumMoyHG += g.moyHG; countHG++; }
        });

        const avgFR = countFR > 0 ? (sumMoyFR / countFR) : null;
        const avgHG = countHG > 0 ? (sumMoyHG / countHG) : null;

        document.getElementById('moyenneFR').textContent = avgFR !== null ?
            (Math.round(avgFR * 10) / 10).toFixed(1) + '/20' : '—';
        document.getElementById('moyenneHG').textContent = avgHG !== null ?
            (Math.round(avgHG * 10) / 10).toFixed(1) + '/20' : '—';

        document.getElementById('detailFR').textContent = countFR > 0 ?
            `${countFR} élève(s) noté(s)` : 'Aucune donnée';
        document.getElementById('detailHG').textContent = countHG > 0 ?
            `${countHG} élève(s) noté(s)` : 'Aucune donnée';

        document.getElementById('nbEleves').textContent = nbEleves;
        document.getElementById('detailEleves').textContent = `S${this.currentSemestre}`;

        // Count evaluations for this semester (approximate by date or just total)
        const nbEvals = this.evaluations.filter(e =>
            e.statut === 'publiee' || e.statut === 'terminee'
        ).length;
        const nbSom = this.sommatives.filter(s =>
            String(s.semestre || '1') === this.currentSemestre
        ).length;
        document.getElementById('nbEvals').textContent = nbEvals + nbSom;
        document.getElementById('detailEvals').textContent = `${nbEvals} prog. + ${nbSom} som.`;
    },

    // ========== RENDER TABLE ==========
    renderTable() {
        const tbody = document.getElementById('classTableBody');

        // Filter
        let students = Object.values(this.grades);
        if (this.searchFilter) {
            students = students.filter(g => {
                const name = `${g.eleve.prenom || ''} ${g.eleve.nom || ''}`.toLowerCase();
                return name.includes(this.searchFilter);
            });
        }

        // Sort
        students.sort((a, b) => {
            let va, vb;
            switch (this.sortColumn) {
                case 'name':
                    va = `${a.eleve.nom || ''} ${a.eleve.prenom || ''}`.toLowerCase();
                    vb = `${b.eleve.nom || ''} ${b.eleve.prenom || ''}`.toLowerCase();
                    return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
                case 'progFR':
                    va = a.progFR.note; vb = b.progFR.note;
                    break;
                case 'progHG':
                    va = a.progHG.note; vb = b.progHG.note;
                    break;
                case 'moyFR':
                    va = a.moyFR ?? -1; vb = b.moyFR ?? -1;
                    break;
                case 'moyHG':
                    va = a.moyHG ?? -1; vb = b.moyHG ?? -1;
                    break;
                default:
                    va = 0; vb = 0;
            }
            if (this.sortColumn !== 'name') {
                return this.sortAsc ? va - vb : vb - va;
            }
            return 0;
        });

        if (students.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="empty-table">
                    ${this.searchFilter ? 'Aucun élève trouvé' : 'Aucun élève'}
                </td></tr>
            `;
            return;
        }

        tbody.innerHTML = students.map(g => {
            const name = `${escapeHtml(g.eleve.prenom || '')} ${escapeHtml(g.eleve.nom || '')}`;
            return `
                <tr data-eleve-id="${g.eleve.id}">
                    <td class="col-name">${name}</td>
                    <td class="col-prog ${this._getNoteClass(g.progFR.note)}">${this._formatNote(g.progFR.note)}</td>
                    <td class="col-prog ${this._getNoteClass(g.progHG.note)}">${this._formatNote(g.progHG.note)}</td>
                    <td class="col-moy ${this._getNoteClass(g.moyFR)}">${this._formatNote(g.moyFR)}</td>
                    <td class="col-moy ${this._getNoteClass(g.moyHG)}">${this._formatNote(g.moyHG)}</td>
                    <td class="col-detail">
                        <button class="btn-detail" onclick="AdminTableauBord.openDetail('${g.eleve.id}')">Détail →</button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    _formatNote(note) {
        if (note === null || note === undefined) return '—';
        return (Math.round(note * 10) / 10).toFixed(1);
    },

    _getNoteClass(note) {
        if (note === null || note === undefined) return '';
        if (note >= 16) return 'note-excellent';
        if (note >= 12) return 'note-good';
        if (note >= 10) return 'note-ok';
        if (note >= 8) return 'note-warning';
        return 'note-danger';
    },

    // ========== DETAIL PANEL ==========
    openDetail(eleveId) {
        const g = this.grades[eleveId];
        if (!g) return;

        // Name
        document.getElementById('detailPanelName').textContent =
            `${g.eleve.prenom || ''} ${g.eleve.nom || ''}`;

        // FR
        this._renderDetailMatiere('FR', g.progFR, g.somFR, g.moyFR);

        // HG
        this._renderDetailMatiere('HG', g.progHG, g.somHG, g.moyHG);

        // Show overlay
        document.getElementById('detailOverlay').classList.remove('hidden');
    },

    _renderDetailMatiere(suffix, prog, sommatives, moyenne) {
        // Moyenne pondérée (big number)
        document.getElementById(`detailMoy${suffix}`).textContent =
            moyenne !== null ? this._formatNote(moyenne) + '/20' : '—/20';

        // Progression note
        document.getElementById(`detailProg${suffix}`).textContent =
            this._formatNote(prog.note) + '/20';

        // Formula
        document.getElementById(`detailFormula${suffix}`).textContent =
            `${prog.noteDepart} + (${prog.pointsSansBonus}/${prog.budget}) × 19.5` +
            (prog.bonus > 0 ? ` + ${prog.bonus} bonus` : '') +
            ` = ${this._formatNote(prog.note)}`;

        // Categories breakdown
        const cats = prog.categories;
        document.getElementById(`detailCats${suffix}`).innerHTML = `
            <div class="cat-row">
                <span class="cat-dot green"></span>
                <span class="cat-label">Connaissances</span>
                <span class="cat-value">${cats.connaissances} pts</span>
            </div>
            <div class="cat-row">
                <span class="cat-dot orange"></span>
                <span class="cat-label">Savoir-faire</span>
                <span class="cat-value">${cats['savoir-faire']} pts</span>
            </div>
            <div class="cat-row">
                <span class="cat-dot purple"></span>
                <span class="cat-label">Compétences</span>
                <span class="cat-value">${cats.competences} pts</span>
            </div>
            <div class="cat-row">
                <span class="cat-dot yellow"></span>
                <span class="cat-label">Bonus</span>
                <span class="cat-value">${cats.bonus} pts</span>
            </div>
            <div class="cat-row cat-total">
                <span></span>
                <span class="cat-label">Total</span>
                <span class="cat-value">${cats.total} pts / ${prog.budget}</span>
            </div>
        `;

        // Sommatives
        const somContainer = document.getElementById(`detailSom${suffix}`);
        if (sommatives.length === 0) {
            somContainer.innerHTML = '<span class="detail-empty">Aucune sommative</span>';
        } else {
            somContainer.innerHTML = sommatives.map(s => `
                <div class="som-row">
                    <span class="som-title">${escapeHtml(s.titre)}</span>
                    <span class="som-note ${s.note20 !== null ? this._getNoteClass(s.note20) : ''}">${s.note !== null ? `${s.note}/${s.bareme}` : '—'}</span>
                    <span class="som-coef">coef. ${s.coefficient}</span>
                </div>
            `).join('');
        }
    },

    closeDetail() {
        document.getElementById('detailOverlay').classList.add('hidden');
    },
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AdminTableauBord.init();
    }, 100);
});

window.AdminTableauBord = AdminTableauBord;
