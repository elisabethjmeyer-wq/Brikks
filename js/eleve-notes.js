/**
 * Élève Résultats — Page "Mes résultats"
 * Remplace l'ancienne page "Mes notes".
 * Navigation SPA : page principale + sous-pages (conn, sf, comp, bonus).
 */

/* global CONFIG, SheetsAPI, Auth, escapeHtml */

const EleveResultats = {
    // ========== DATA ==========
    currentUser: null,
    evaluations: [],
    resultats: [],
    sommatives: [],
    resultatsSommatives: [],
    parametresNotes: [],
    objectifs: [],
    banquesConn: [],
    banquesSF: [],
    progressionsEval: [],
    competencesRef: [],
    criteresReussite: [],
    eleveEntrComps: [],
    entrComps: [],
    banquesComps: [],

    // ========== STATE ==========
    currentMatiere: 'FR',
    currentSemestre: null,
    currentPage: null, // null | 'conn' | 'sf' | 'comp' | 'bonus'
    _showAllBanques: false,
    _openComps: {},     // { compId: true }
    _openCriteria: {},  // { compId: true }
    _openBonus: {},     // { bonusId: true }
    _openBonusCrit: {}, // { bonusId: true }
    _semOpen: false,
    _editingObj: false,

    // ========== COLORS ==========
    COLORS: {
        ac: '#6366f1', acBg: '#eef2ff',
        blue: '#3b82f6', blueBg: '#eff6ff',
        org: '#f59e0b', orgBg: '#fffbeb',
        pur: '#8b5cf6', purBg: '#f5f3ff',
        yel: '#eab308', yelBg: '#fefce8'
    },

    CAT: {
        conn:  { label: 'Connaissances', key: 'connaissances', color: '#3b82f6', bg: '#eff6ff', dot: '\u{1F535}' },
        sf:    { label: 'Savoir-faire',  key: 'savoir-faire',  color: '#f59e0b', bg: '#fffbeb', dot: '\u{1F7E0}' },
        comp:  { label: 'Compétences',   key: 'competences',   color: '#8b5cf6', bg: '#f5f3ff', dot: '\u{1F7E3}' },
        bonus: { label: 'Bonus',         key: 'bonus',         color: '#eab308', bg: '#fefce8', dot: '\u2B50' }
    },

    // ========== INIT ==========
    async init() {
        try {
            this.currentUser = await this._getCurrentUser();
            if (!this.currentUser) {
                this._showError('Impossible de récupérer ton identifiant');
                return;
            }
            await this._loadData();
            this._detectCurrentSemestre();
            this._render();
            this._showContent();
        } catch (error) {
            console.error('Erreur initialisation résultats:', error);
            this._showError('Erreur lors du chargement');
        }
    },

    async _getCurrentUser() {
        if (typeof Auth !== 'undefined' && Auth.user) return Auth.user;
        const s = sessionStorage.getItem('brikks_user');
        if (s) { try { return JSON.parse(s); } catch (_e) { /* */ } }
        const l = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        if (l) { try { return JSON.parse(l); } catch (_e) { /* */ } }
        return null;
    },

    async _loadData() {
        const [
            evData, resData, somData, resSomData, paramData, objData,
            bConnData, bSFData, progData,
            compRefData, critData, eleveCompData, entrCompData, banqCompData
        ] = await Promise.all([
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => []),
            SheetsAPI.getSheetData('BANQUES_EXERCICES_CONN').catch(() => []),
            SheetsAPI.getSheetData('BANQUES_EXERCICES').catch(() => []),
            SheetsAPI.getSheetData('PROGRESSION_EVALUATION').catch(() => []),
            SheetsAPI.getSheetData('CompetencesReferentiel').catch(() => []),
            SheetsAPI.getSheetData('CriteresReussite').catch(() => []),
            SheetsAPI.getSheetData('EleveEntrainementsCompetences').catch(() => []),
            SheetsAPI.getSheetData('EntrainementsCompetences').catch(() => []),
            SheetsAPI.getSheetData('BanquesCompetences').catch(() => [])
        ]);

        this.evaluations = SheetsAPI.parseSheetData(evData);
        const allRes = SheetsAPI.parseSheetData(resData);
        const uid = String(this.currentUser.id).trim();
        this.resultats = allRes.filter(r => String(r.eleve_id).trim() === uid);
        this.sommatives = SheetsAPI.parseSheetData(somData);
        const allResSom = SheetsAPI.parseSheetData(resSomData);
        this.resultatsSommatives = allResSom.filter(r => String(r.eleve_id).trim() === uid);
        this.parametresNotes = SheetsAPI.parseSheetData(paramData);
        this.objectifs = SheetsAPI.parseSheetData(objData);
        this.banquesConn = SheetsAPI.parseSheetData(bConnData);
        this.banquesSF = SheetsAPI.parseSheetData(bSFData);
        this.progressionsEval = SheetsAPI.parseSheetData(progData);
        this.competencesRef = SheetsAPI.parseSheetData(compRefData);
        this.criteresReussite = SheetsAPI.parseSheetData(critData);
        const allEleveComp = SheetsAPI.parseSheetData(eleveCompData);
        this.eleveEntrComps = allEleveComp.filter(r => String(r.eleve_id).trim() === uid);
        this.entrComps = SheetsAPI.parseSheetData(entrCompData);
        this.banquesComps = SheetsAPI.parseSheetData(banqCompData);

        // Filter evaluations to visible only
        this.evaluations = this.evaluations.filter(e => {
            const s = this._effectiveStatut(e);
            return s === 'planifiee' || s === 'publiee' || s === 'terminee';
        });
    },

    _showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('notes-content').style.display = 'block';
    },

    _showError(msg) {
        document.getElementById('loader').innerHTML =
            '<div style="text-align:center;padding:60px 24px;color:#94a3b8;">' +
            '<div style="font-size:3rem;margin-bottom:16px;">\u26A0\uFE0F</div>' +
            '<p>' + escapeHtml(msg) + '</p></div>';
    },

    // ========== SEMESTER ==========
    _detectCurrentSemestre() {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (const p of this.parametresNotes) {
            const d = p.date_debut ? new Date(p.date_debut) : null;
            const f = p.date_fin ? new Date(p.date_fin) : null;
            if (d && f && today >= d && today <= f) { this.currentSemestre = String(p.semestre); return; }
        }
        this.currentSemestre = '1';
    },

    _getSemestreForEval(ev) {
        const ds = ev.date_ouverture || ev.date_debut || '';
        if (!ds) return this.currentSemestre;
        const d = new Date(ds);
        if (isNaN(d.getTime())) return this.currentSemestre;
        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && d >= debut && d <= fin) return String(p.semestre);
        }
        return this.currentSemestre;
    },

    _effectiveStatut(ev) {
        if (ev.statut === 'brouillon' || ev.statut === 'terminee') return ev.statut;
        if (ev.mode_passation === 'papier') return ev.statut || 'brouillon';
        const now = new Date();
        if (ev.date_ouverture || ev.date_fermeture) {
            if (ev.date_ouverture && new Date(ev.date_ouverture) > now) return 'planifiee';
            if (ev.date_fermeture && new Date(ev.date_fermeture) < now) return 'terminee';
            return 'publiee';
        }
        return ev.statut || 'brouillon';
    },

    // ========== CALCULATION ==========
    _getParams(matiere, semestre) {
        const p = this.parametresNotes.find(
            r => r.matiere === matiere && String(r.semestre) === String(semestre)
        );
        return {
            noteDepart: parseFloat(p?.note_depart) || 8,
            budget: parseFloat(p?.budget_estime) || 100,
            coeffProg: parseFloat(p?.coefficient_progression) || 3
        };
    },

    _getEvalsForMatiere(matiere, semestre) {
        return this.evaluations.filter(ev => {
            const m = ev.matiere || '';
            if (m !== matiere && m !== 'Les deux') return false;
            return this._getSemestreForEval(ev) === String(semestre);
        });
    },

    _calculatePoints(matiere, semestre) {
        const cats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };
        const maxCats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };
        const evals = this._getEvalsForMatiere(matiere, semestre);
        evals.forEach(ev => {
            const cat = ev.categorie || ev.type || 'connaissances';
            if (maxCats[cat] === undefined) return;
            maxCats[cat] += parseFloat(ev.briques) || 2;
            const r = this.resultats.find(res =>
                String(res.evaluation_id).trim() === String(ev.id).trim()
            );
            if (r) cats[cat] += parseFloat(r.validations) || 0;
        });
        const total = cats.connaissances + cats['savoir-faire'] + cats.competences + cats.bonus;
        const totalMax = maxCats.connaissances + maxCats['savoir-faire'] + maxCats.competences + maxCats.bonus;
        return { cats, maxCats, total, totalMax };
    },

    _calculateProgression(matiere, semestre) {
        const params = this._getParams(matiere, semestre);
        const pts = this._calculatePoints(matiere, semestre);
        const sans = pts.cats.connaissances + pts.cats['savoir-faire'] + pts.cats.competences;
        const noteBase = params.noteDepart + (sans / params.budget) * 19.5;
        const raw = Math.max(0, Math.round((noteBase + pts.cats.bonus) * 100) / 100);
        const note = Math.min(20, raw);
        return { note, params, pts };
    },

    _getSommatives(matiere, semestre) {
        return this.sommatives
            .filter(s => {
                const m = s.matiere || '';
                return (m === matiere || m === 'Les deux') && String(s.semestre || '1') === String(semestre);
            })
            .map(s => {
                const r = this.resultatsSommatives.find(res =>
                    String(res.sommative_id).trim() === String(s.id).trim()
                );
                const note = r && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
                const bareme = parseFloat(s.bareme) || 20;
                const coefficient = parseFloat(s.coefficient) || 1;
                const note20 = note !== null ? (note / bareme) * 20 : null;
                return { id: s.id, titre: s.titre || 'Sans titre', date: s.date || '', note, bareme, coefficient, note20 };
            });
    },

    _calculateMoyenne(noteProg, coeffProg, soms) {
        let tp = noteProg * coeffProg, tc = coeffProg;
        soms.forEach(s => { if (s.note20 !== null) { tp += s.note20 * s.coefficient; tc += s.coefficient; } });
        if (tc === 0) return null;
        return Math.round(Math.min(20, Math.max(0, tp / tc)) * 100) / 100;
    },

    _noteColor(v) {
        if (v === null || v === undefined) return '#9ca3af';
        const t = Math.min(v / 20, 1);
        if (t < 0.25) return '#ef4444';
        if (t < 0.4) return '#f97316';
        if (t < 0.5) return '#f59e0b';
        if (t < 0.6) return '#eab308';
        if (t < 0.75) return '#84cc16';
        return '#10b981';
    },

    _fmt(n) {
        if (n === null || n === undefined) return '\u2014';
        return (Math.round(n * 10) / 10).toFixed(1);
    },

    _getObjectif(matiere, semestre) {
        const o = this.objectifs.find(obj =>
            String(obj.eleve_id).trim() === String(this.currentUser.id).trim() &&
            obj.matiere === matiere && String(obj.semestre) === String(semestre)
        );
        return o ? parseFloat(o.objectif_note) : null;
    },

    // ========== BANQUE PROGRESSION ==========
    _getBanquesForType(type, matiere) {
        const raw = type === 'conn' ? [...this.banquesConn] : [...this.banquesSF];
        return raw
            .filter(b => !b.matiere || b.matiere === matiere)
            .sort((a, b) => (parseInt(a.ordre) || 9999) - (parseInt(b.ordre) || 9999));
    },

    _getAutoBanqueIndex(type, matiere, banques) {
        if (!banques.length) return 0;
        const evalType = type === 'conn' ? 'connaissances' : 'savoir-faire';
        const sameTypeEvals = this.evaluations.filter(ev =>
            String(ev.type).trim() === evalType &&
            (String(ev.matiere || '').trim() === matiere || String(ev.matiere || '').trim() === 'Les deux')
        );
        const evalIds = new Set(sameTypeEvals.map(ev => String(ev.id).trim()));
        const validated = this.resultats.filter(r =>
            evalIds.has(String(r.evaluation_id).trim()) &&
            (r.is_validated === true || r.is_validated === 'true' || r.is_validated === 'TRUE')
        );
        const validBIds = new Set();
        validated.forEach(r => { const b = String(r.banque_id || '').trim(); if (b) validBIds.add(b); });
        let lastIdx = -1;
        banques.forEach((b, i) => { if (validBIds.has(String(b.id).trim()) && i > lastIdx) lastIdx = i; });
        if (lastIdx < 0) {
            const prog = this.progressionsEval.find(p =>
                String(p.eleve_id).trim() === String(this.currentUser.id).trim() &&
                String(p.type).trim() === evalType &&
                (!p.matiere || String(p.matiere).trim() === matiere)
            );
            const lid = prog ? String(prog.derniere_banque_validee_id || '').trim() : '';
            if (lid) lastIdx = banques.findIndex(b => String(b.id).trim() === lid);
        }
        if (lastIdx >= 0) return Math.min(lastIdx + 1, banques.length - 1);
        return 0;
    },

    _getBanqueStatuses(type, matiere) {
        const banques = this._getBanquesForType(type, matiere);
        const nextIdx = this._getAutoBanqueIndex(type, matiere, banques);
        return banques.map((b, i) => ({
            ...b,
            statut: i < nextIdx ? 'debloquee' : i === nextIdx ? 'next' : 'locked'
        }));
    },

    _getEvalsForType(type, matiere, semestre) {
        const evalType = type === 'conn' ? 'connaissances' : 'savoir-faire';
        return this._getEvalsForMatiere(matiere, semestre)
            .filter(ev => (ev.categorie || ev.type) === evalType)
            .map(ev => {
                const r = this.resultats.find(res => String(res.evaluation_id).trim() === String(ev.id).trim());
                const pts = parseFloat(ev.briques) || 2;
                const acquis = r ? parseFloat(r.validations) || 0 : null;
                const date = r ? this._formatDate(r.date_passage) : null;
                return { id: ev.id, t: ev.titre || 'Évaluation', pts, acquis, date };
            });
    },

    _formatDate(ds) {
        if (!ds) return null;
        const d = new Date(ds);
        if (isNaN(d.getTime())) return ds;
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    },

    // ========== COMPETENCES DATA ==========
    _getCompetencesData(matiere) {
        const visibleComps = this.competencesRef.filter(c =>
            c.visible !== false && c.visible !== 'false' && c.visible !== 'FALSE'
        );

        return visibleComps.map(comp => {
            const criteres = this.criteresReussite
                .filter(cr => String(cr.competence_id).trim() === String(comp.id).trim())
                .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0))
                .map(cr => cr.libelle || '');

            // Find banques for this competence
            const compBanques = this.banquesComps.filter(bc =>
                String(bc.competence_id).trim() === String(comp.id).trim()
            );
            const banqueIds = new Set(compBanques.map(bc => String(bc.id).trim()));

            // Find entrainements in those banques
            const entrIds = new Set(
                this.entrComps
                    .filter(e => banqueIds.has(String(e.banque_id).trim()))
                    .map(e => String(e.id).trim())
            );

            // Find student entries for those entrainements
            const passages = this.eleveEntrComps
                .filter(ec => entrIds.has(String(ec.entrainement_id).trim()))
                .filter(ec => ec.statut === 'valide' || ec.statut === 'non_valide')
                .sort((a, b) => {
                    const da = a.date_soumission || a.date_debut || '';
                    const db = b.date_soumission || b.date_debut || '';
                    return da.localeCompare(db);
                });

            // Get points from evaluation results for this competence's evaluations
            const compEvals = this.evaluations.filter(ev => {
                const cat = ev.categorie || ev.type;
                if (cat !== 'competences') return false;
                const m = ev.matiere || '';
                return m === matiere || m === 'Les deux';
            });

            let validationCount = 0;
            const mappedPassages = passages.map(p => {
                const reussi = p.statut === 'valide';
                if (reussi) validationCount++;
                const date = this._formatDate(p.date_soumission || p.date_debut) || '';

                // Try to find associated eval result for points
                let pts = 0;
                if (reussi) {
                    // Find evaluation with matching competence
                    for (const ev of compEvals) {
                        const r = this.resultats.find(res =>
                            String(res.evaluation_id).trim() === String(ev.id).trim()
                        );
                        if (r && parseFloat(r.validations) > 0) {
                            pts = parseFloat(r.validations) || 0;
                            break;
                        }
                    }
                    // Fallback: use increasing points per validation
                    if (!pts) pts = validationCount <= 1 ? 1 : validationCount <= 2 ? 1.5 : 2;
                }

                // Check if bonus passage
                const entrainement = this.entrComps.find(e => String(e.id).trim() === String(p.entrainement_id).trim());
                const banque = entrainement ? this.banquesComps.find(bc => String(bc.id).trim() === String(entrainement.banque_id).trim()) : null;
                const isBonus = banque ? (banque.type === 'bonus') : false;

                return {
                    id: p.id,
                    date,
                    reussi,
                    pts: reussi ? pts : 0,
                    validation: reussi ? validationCount : null,
                    bonus: isBonus
                };
            });

            const acquise = validationCount >= 3;

            return {
                id: comp.id,
                nom: comp.nom || comp.description || 'Compétence',
                criteres,
                passages: mappedPassages,
                acquise,
                validationCount
            };
        });
    },

    // ========== BONUS DATA ==========
    _getBonusData(matiere, semestre) {
        const bonusEvals = this._getEvalsForMatiere(matiere, semestre)
            .filter(ev => (ev.categorie || ev.type) === 'bonus');

        return bonusEvals.map(ev => {
            const r = this.resultats.find(res => String(res.evaluation_id).trim() === String(ev.id).trim());
            const pts = parseFloat(ev.briques) || 2;
            const acquis = r ? parseFloat(r.validations) || 0 : 0;
            const valide = r && (r.is_validated === true || r.is_validated === 'true' || r.is_validated === 'TRUE');
            const date = r ? this._formatDate(r.date_passage) : null;

            return {
                id: ev.id,
                nom: ev.titre || 'Bonus',
                type: 'ponctuel',
                pts,
                valide: !!valide,
                date,
                acquis,
                criteres: ev.criteres ? (typeof ev.criteres === 'string' ? this._parseJSON(ev.criteres, []) : ev.criteres) : []
            };
        });
    },

    _parseJSON(str, fallback) {
        if (!str) return fallback;
        try { return JSON.parse(str); } catch (_e) {
            try { return JSON.parse(JSON.parse(str)); } catch (_e2) { return fallback; }
        }
    },

    // ========== NAVIGATION ==========
    setPage(page) {
        this.currentPage = page;
        this._showAllBanques = false;
        this._openComps = {};
        this._openCriteria = {};
        this._openBonus = {};
        this._openBonusCrit = {};
        this._render();
    },

    setMatiere(mat) {
        this.currentMatiere = mat;
        this._render();
    },

    setSemestre(sem) {
        this.currentSemestre = sem;
        this._semOpen = false;
        this._render();
    },

    toggleSemMenu() {
        this._semOpen = !this._semOpen;
        this._render();
    },

    toggleShowAllBanques() {
        this._showAllBanques = !this._showAllBanques;
        this._render();
    },

    toggleComp(id) {
        this._openComps[id] = !this._openComps[id];
        if (!this._openComps[id]) this._openCriteria[id] = false;
        this._render();
    },

    toggleCompCriteria(id) {
        this._openCriteria[id] = !this._openCriteria[id];
        this._render();
    },

    toggleBonus(id) {
        this._openBonus[id] = !this._openBonus[id];
        if (!this._openBonus[id]) this._openBonusCrit[id] = false;
        this._render();
    },

    toggleBonusCriteria(id) {
        this._openBonusCrit[id] = !this._openBonusCrit[id];
        this._render();
    },

    startEditObj() {
        this._editingObj = true;
        this._render();
        const inp = document.getElementById('resObjInput');
        if (inp) inp.focus();
    },

    cancelEditObj() {
        this._editingObj = false;
        this._render();
    },

    async confirmObj() {
        const inp = document.getElementById('resObjInput');
        const val = inp ? parseFloat(inp.value) : NaN;
        if (isNaN(val) || val < 0 || val > 20) return;
        this._editingObj = false;

        try {
            const result = await this._callAPI('saveObjectifEleve', {
                eleve_id: this.currentUser.id,
                matiere: this.currentMatiere,
                semestre: this.currentSemestre,
                objectif_note: val
            });
            if (result.success) {
                SheetsAPI.clearCache();
                const objData = await SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => []);
                this.objectifs = SheetsAPI.parseSheetData(objData);
            }
        } catch (_e) { /* silent */ }
        this._render();
    },

    // ========== RENDER ENTRY ==========
    _render() {
        const container = document.getElementById('notes-content');
        const mat = this.currentMatiere;
        const sem = this.currentSemestre;
        const acColor = mat === 'FR' ? this.COLORS.ac : this.COLORS.pur;
        const isWide = this.currentPage === 'conn' || this.currentPage === 'sf';

        let html = '<div class="res-container' + (isWide ? ' wide' : '') + '">';
        html += this._renderBreadcrumb();

        if (this.currentPage === null) {
            html += this._renderHeader(acColor);
            html += this._renderMatiereToggle();
            html += this._renderMainPage(mat, sem, acColor);
        } else if (this.currentPage === 'conn' || this.currentPage === 'sf') {
            html += this._renderBankSubPage(mat, sem);
        } else if (this.currentPage === 'comp') {
            html += this._renderCompSubPage(mat);
        } else if (this.currentPage === 'bonus') {
            html += this._renderBonusSubPage(mat, sem);
        }

        html += '</div>';
        container.innerHTML = html;
    },

    // ========== BREADCRUMB ==========
    _renderBreadcrumb() {
        let h = '<div class="res-breadcrumb">';
        h += '<a>\u{1F3E0} Accueil</a><span class="crumb-sep">\u203A</span>';
        if (this.currentPage) {
            h += '<span class="crumb-link" onclick="EleveResultats.setPage(null)">Mes résultats</span>';
            h += '<span class="crumb-sep">\u203A</span>';
            const labels = { conn: 'Connaissances', sf: 'Savoir-faire', comp: 'Compétences', bonus: 'Bonus' };
            h += '<span>' + labels[this.currentPage] + '</span>';
        } else {
            h += '<span>Mes résultats</span>';
        }
        h += '</div>';
        return h;
    },

    // ========== HEADER + TOGGLES ==========
    _renderHeader(_acColor) {
        const isRO = this.currentSemestre === '1';
        let h = '<div class="res-header"><div>';
        h += '<h1 class="res-title">\u{1F4CA} Mes résultats</h1>';
        h += '<p class="res-subtitle">Comprends ta note et suis ta progression. \u00B7 ';
        h += '<a href="evaluations.html">\u{1F4CB} Mes évaluations \u2192</a></p>';
        h += '</div>';
        // Semester dropdown
        h += '<div class="sem-dropdown">';
        h += '<div class="sem-trigger' + (isRO ? ' readonly' : '') + '" onclick="EleveResultats.toggleSemMenu()">';
        h += 'Semestre ' + (this.currentSemestre === '2' ? '2' : '1');
        if (isRO) h += '<span style="font-size:9px;font-weight:500"> \u00B7 lecture seule</span>';
        h += ' <span style="font-size:8px;">\u25BE</span></div>';
        h += '<div class="sem-menu' + (this._semOpen ? ' open' : '') + '">';
        [{k:'2',l:'Semestre 2',s:'en cours'},{k:'1',l:'Semestre 1',s:'terminé \u00B7 lecture seule'}].forEach(s => {
            h += '<div class="sem-option' + (this.currentSemestre === s.k ? ' active' : '') + '" onclick="EleveResultats.setSemestre(\'' + s.k + '\')">';
            h += '<div><div class="sem-option-label">' + s.l + '</div><div class="sem-option-sub">' + s.s + '</div></div>';
            if (this.currentSemestre === s.k) h += '<span class="sem-option-check">\u2713</span>';
            h += '</div>';
        });
        h += '</div></div>';
        h += '</div>';
        h += '<div class="res-divider"></div>';
        return h;
    },

    _renderMatiereToggle() {
        let h = '<div class="matiere-toggle">';
        [{k:'FR',l:'\u{1F1EB}\u{1F1F7} Français',ac:'active-fr'},{k:'HG-EMC',l:'\u{1F30D} HG-EMC',ac:'active-hg'}].forEach(t => {
            const cls = this.currentMatiere === t.k ? ' ' + t.ac : '';
            h += '<button class="matiere-btn' + cls + '" onclick="EleveResultats.setMatiere(\'' + t.k + '\')">' + t.l + '</button>';
        });
        h += '</div>';
        return h;
    },

    // ========== MAIN PAGE ==========
    _renderMainPage(mat, sem, acColor) {
        const prog = this._calculateProgression(mat, sem);
        const soms = this._getSommatives(mat, sem);
        const moyenne = this._calculateMoyenne(prog.note, prog.params.coeffProg, soms);
        const obj = this._getObjectif(mat, sem);
        const isRO = sem === '1';
        const mc = this._noteColor(moyenne);
        const pc = this._noteColor(prog.note);
        const moyPct = Math.max((moyenne !== null ? moyenne : 0) / 20 * 100, 2);
        const objPct = obj ? (obj / 20) * 100 : null;

        let h = '';
        // HERO
        h += '<div class="res-hero" style="border-left-color:' + acColor + ';box-shadow:0 2px 16px ' + acColor + '14;">';
        h += '<div class="res-hero-top"><div class="res-hero-left">';
        h += '<span class="res-hero-label">Ma moyenne</span>';
        h += '<span class="res-hero-note" style="color:' + mc + '">' + this._fmt(moyenne) + '</span>';
        h += '<span class="res-hero-unit">/20</span>';
        h += '</div>';
        h += this._renderObjectifInline(obj, acColor, isRO);
        h += '</div>';
        // Bar
        h += '<div class="res-hero-bar">';
        h += '<div class="res-hero-bar-fill" style="width:' + moyPct + '%;background:linear-gradient(to right,' + mc + 'cc,' + mc + ')"></div>';
        if (objPct) {
            h += '<div class="res-hero-bar-obj" style="left:' + objPct + '%;background:' + acColor + '">';
            h += '<div class="res-hero-bar-obj-label" style="color:' + acColor + '">' + obj + '</div></div>';
        }
        h += '</div>';
        h += '<div class="res-hero-bar-labels"><span>0</span><span>20</span></div>';
        h += '</div>';

        h += '<div class="res-connector">composée de</div>';

        // PROGRESSION
        h += '<div class="res-card">';
        h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4C8}</span><span class="res-card-title-text">Note de progression</span></div>';
        h += '<div class="res-card-right"><span class="res-prog-note" style="color:' + pc + '">' + this._fmt(prog.note) + '</span>';
        h += '<span class="res-prog-unit">/20</span><span class="res-prog-coef">coef. ' + prog.params.coeffProg + '</span></div></div>';
        h += '<div class="res-prog-bar"><div class="res-prog-bar-fill" style="width:' + Math.max((prog.note / 20) * 100, 2) + '%;background:' + pc + '"></div></div>';
        h += '<div class="res-prog-pts-label">' + prog.pts.total + ' pts acquis sur ' + prog.pts.totalMax + '</div>';

        // Points rows
        const catKeys = ['conn', 'sf', 'comp', 'bonus'];
        catKeys.forEach(k => {
            const c = this.CAT[k];
            const val = prog.pts.cats[c.key] || 0;
            const max = prog.pts.maxCats[c.key] || 0;
            const pct = max > 0 ? Math.max((val / max) * 100, 2) : 0;
            h += '<div class="res-pts-row" onclick="EleveResultats.setPage(\'' + k + '\')">';
            h += '<span class="res-pts-dot">' + c.dot + '</span>';
            h += '<span class="res-pts-label">' + c.label + '</span>';
            h += '<div class="res-pts-bar"><div class="res-pts-bar-fill" style="width:' + pct + '%;background:' + c.color + '"></div></div>';
            h += '<span class="res-pts-value" style="color:' + (val > 0 ? c.color : '#d1d5db') + '">' + val + '/' + max + '</span>';
            h += '<span class="res-pts-arrow">\u203A</span>';
            h += '</div>';
        });
        h += '</div>';

        h += '<div class="res-plus">+</div>';

        // CONTROLES
        h += '<div class="res-card">';
        h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4DD}</span><span class="res-card-title-text">Contrôles</span></div>';
        if (soms.length > 0) h += '<span style="font-size:11px;color:#9ca3af">\u00B7 ' + soms.length + ' évaluation' + (soms.length > 1 ? 's' : '') + '</span>';
        h += '</div>';
        if (soms.length > 0) {
            soms.forEach(s => {
                const nc = s.note20 !== null ? this._noteColor(s.note20) : '#9ca3af';
                h += '<div class="res-controle-item"><div class="res-controle-top"><div>';
                h += '<div class="res-controle-title">' + escapeHtml(s.titre) + '</div>';
                h += '<div class="res-controle-meta">' + (s.date || '') + ' \u00B7 coef. ' + s.coefficient + '</div>';
                h += '</div>';
                h += '<span class="res-controle-note" style="color:' + nc + '">' + (s.note !== null ? s.note : '\u2014');
                h += '<span class="res-controle-bareme">/' + s.bareme + '</span></span>';
                h += '</div>';
                if (s.note !== null) {
                    h += '<div class="res-controle-link"><span class="res-detail-link">Remarque et correction \u2192</span></div>';
                }
                h += '</div>';
            });
        } else {
            h += '<div class="res-empty">Aucun contrôle pour le moment</div>';
        }
        h += '</div>';

        return h;
    },

    _renderObjectifInline(obj, acColor, isRO) {
        if (isRO) {
            return obj ? '<span style="font-size:11px;color:#9ca3af">\u{1F3AF} obj. ' + obj + '</span>' : '';
        }
        if (!this._editingObj) {
            let h = '<div class="res-obj-display"><span>\u{1F3AF}</span>';
            if (obj) {
                h += '<span class="res-obj-value" style="color:' + acColor + '">' + obj + '/20</span>';
                h += '<span class="res-obj-edit-link" onclick="EleveResultats.startEditObj()">modifier</span>';
            } else {
                h += '<span class="res-obj-set-link" style="color:' + acColor + '" onclick="EleveResultats.startEditObj()">Fixer un objectif</span>';
            }
            h += '</div>';
            return h;
        }
        let h = '<div class="res-obj-form"><span>\u{1F3AF}</span>';
        h += '<input id="resObjInput" class="res-obj-input" type="number" min="0" max="20" value="' + (obj || '') + '" placeholder="14" style="border-color:' + acColor + '44">';
        h += '<span style="font-size:10px;color:#9ca3af">/20</span>';
        h += '<span class="res-obj-ok" style="background:' + acColor + '" onclick="EleveResultats.confirmObj()">OK</span>';
        h += '<span class="res-obj-cancel" onclick="EleveResultats.cancelEditObj()">\u00D7</span>';
        h += '</div>';
        return h;
    },

    // ========== BANK SUB-PAGES (conn / sf) ==========
    _renderBankSubPage(mat, sem) {
        const type = this.currentPage; // 'conn' or 'sf'
        const c = this.CAT[type];
        const banques = this._getBanqueStatuses(type, mat);
        const evals = this._getEvalsForType(type, mat, sem);
        const pts = this._calculatePoints(mat, sem);
        const val = pts.cats[c.key] || 0;
        const max = pts.maxCats[c.key] || 0;
        const debloquees = banques.filter(b => b.statut === 'debloquee').length;
        const nextBank = banques.find(b => b.statut === 'next');
        const evalType = type === 'conn' ? 'QCM' : 'exercice (BEX)';

        let h = '<button class="res-back-btn" onclick="EleveResultats.setPage(null)">\u2190 Retour à mes résultats</button>';
        h += '<div class="subpage-header"><span style="font-size:14px">' + c.dot + '</span>';
        h += '<h2>' + c.label + '</h2>';
        h += '<span class="subpage-pts-badge" style="background:' + c.bg + ';color:' + c.color + '">' + val + '/' + max + ' pts</span></div>';
        h += '<div class="res-explainer" style="background:' + c.bg + ';border:1px solid ' + c.color + '20">';
        h += '<strong style="color:' + c.color + '">\u{1F4A1} Comment ça marche ?</strong> Chaque ' + evalType + ' porte sur <strong>toutes les banques débloquées</strong>. Si tu réussis, la suivante se débloque.';
        if (nextBank) h += ' Actuellement, tu peux tomber sur les <strong>' + debloquees + ' premières banques</strong>.';
        h += '</div>';

        h += '<div class="bank-grid">';
        h += this._renderBankRoadmap(banques, c.color, debloquees);
        h += this._renderEvalList(evals, c.color, c.bg);
        h += '</div>';
        return h;
    },

    _renderBankRoadmap(banques, color, debloquees) {
        const showAll = this._showAllBanques;
        const visibleCount = showAll ? banques.length : Math.min(debloquees + 3, banques.length);
        const visible = banques.slice(0, visibleCount);
        const hidden = banques.length - visibleCount;

        let h = '<div class="bank-roadmap">';
        h += '<div class="bank-roadmap-header"><div class="bank-roadmap-title">\u{1F4DA} Banques</div>';
        h += '<span class="bank-roadmap-count">' + debloquees + '/' + banques.length + '</span></div>';
        h += '<div class="bank-roadmap-bar"><div class="bank-roadmap-bar-fill" style="background:' + color + ';width:' + (debloquees / Math.max(banques.length, 1) * 100) + '%"></div></div>';

        const linePct = visibleCount > 0 ? (debloquees / visibleCount * 100) : 0;
        const lineBottom = (showAll || hidden === 0) ? '4px' : '24px';
        h += '<div class="bank-timeline">';
        h += '<div class="bank-timeline-line" style="bottom:' + lineBottom + ';background:linear-gradient(to bottom,' + color + ' ' + linePct + '%,#e5e7eb ' + linePct + '%)"></div>';

        visible.forEach((b, i) => {
            const unlocked = b.statut === 'debloquee';
            const isNext = b.statut === 'next';
            h += '<div class="bank-node">';
            if (unlocked) {
                h += '<div class="bank-node-dot unlocked" style="background:' + color + ';border:2px solid ' + color + '">\u2713</div>';
            } else if (isNext) {
                h += '<div class="bank-node-dot next" style="border:2px dashed ' + color + ';color:' + color + '">\u2192</div>';
            } else {
                h += '<div class="bank-node-dot locked">' + (i + 1) + '</div>';
            }
            h += '<div class="bank-node-content' + (isNext ? ' next' : '') + '"' + (isNext ? ' style="background:' + color + '08"' : '') + '>';
            h += '<span class="bank-node-label ' + (unlocked ? 'unlocked' : isNext ? 'next' : 'locked') + '"' + (isNext ? ' style="color:' + color + '"' : '') + '>' + escapeHtml(b.titre || 'Sans titre') + '</span>';
            if (isNext) h += '<span class="bank-node-badge">SUIV.</span>';
            h += '</div></div>';
        });

        if (hidden > 0 && !showAll) {
            h += '<div class="bank-show-more" style="color:' + color + '" onclick="EleveResultats.toggleShowAllBanques()">+ ' + hidden + ' verrouillée' + (hidden > 1 ? 's' : '') + '</div>';
        }
        if (showAll && hidden > 0) {
            h += '<div class="bank-show-less" onclick="EleveResultats.toggleShowAllBanques()">Réduire</div>';
        }

        h += '</div></div>';
        return h;
    },

    _renderEvalList(evals, color, bg) {
        let h = '<div class="eval-list-card">';
        h += '<div class="eval-list-title">\u{1F4DD} Évaluations</div>';
        h += '<div class="eval-list-items">';
        evals.forEach(ev => {
            const done = ev.acquis !== null;
            h += '<div class="eval-item ' + (done ? 'done' : 'pending') + '" style="border-left-color:' + (done ? color : '#e5e7eb') + ';background:' + (done ? bg : '#f9fafb') + '">';
            h += '<span class="eval-item-icon">' + (done ? '\u2705' : '\u2B1C') + '</span>';
            h += '<div class="eval-item-info"><div class="eval-item-name ' + (done ? 'done' : 'pending') + '">' + escapeHtml(ev.t) + '</div>';
            h += '<div class="eval-item-sub">' + (done ? 'Validé le ' + ev.date : 'Non validé') + '</div></div>';
            h += '<div class="eval-item-pts" style="background:' + (done ? bg : '#f3f4f6') + ';color:' + (done ? color : '#d1d5db') + '">+' + (done ? ev.acquis : ev.pts) + ' pts</div>';
            h += '</div>';
        });
        if (evals.length === 0) h += '<div class="res-empty">Aucune évaluation</div>';
        h += '</div></div>';
        return h;
    },

    // ========== COMPETENCES SUB-PAGE ==========
    _renderCompSubPage(mat) {
        const comps = this._getCompetencesData(mat);
        const pts = this._calculatePoints(mat, this.currentSemestre);
        const val = pts.cats.competences || 0;
        const max = pts.maxCats.competences || 0;
        const c = this.CAT.comp;

        let h = '<button class="res-back-btn" onclick="EleveResultats.setPage(null)">\u2190 Retour à mes résultats</button>';
        h += '<div class="subpage-header"><span style="font-size:14px">' + c.dot + '</span>';
        h += '<h2>Compétences</h2>';
        if (max > 0) h += '<span class="subpage-pts-badge" style="background:' + c.bg + ';color:' + c.color + '">' + val + '/' + max + ' pts</span>';
        h += '</div>';
        h += '<div class="res-explainer" style="background:' + c.bg + ';border:1px solid ' + c.color + '20">';
        h += '<strong style="color:' + c.color + '">\u{1F4A1} Comment ça marche ?</strong> Chaque compétence nécessite <strong>3 validations</strong>. Tu peux être évalué(e) autant de fois que nécessaire. Les passages bonus sont marqués \u2B50.';
        h += '</div>';

        h += '<div class="comp-list">';
        if (comps.length > 0) {
            comps.forEach(comp => { h += this._renderCompCard(comp); });
        } else {
            h += '<div class="res-empty">Aucune compétence</div>';
        }
        h += '</div>';
        return h;
    },

    _renderCompCard(comp) {
        const isOpen = this._openComps[comp.id];
        const showCrit = this._openCriteria[comp.id];
        const nbV = comp.passages.filter(p => p.reussi).length;
        const ptsTotal = comp.passages.filter(p => p.reussi).reduce((s, p) => s + p.pts, 0);
        const C = this.COLORS;

        let h = '<div class="comp-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="comp-header" onclick="EleveResultats.toggleComp(\'' + comp.id + '\')">';
        h += '<div class="comp-name"><div class="comp-name-text" style="color:' + (comp.acquise ? '#1f2937' : nbV > 0 ? '#374151' : '#6b7280') + '">' + escapeHtml(comp.nom) + '</div>';
        h += '<div class="comp-name-sub">' + nbV + '/3 validation' + (nbV > 1 ? 's' : '');
        if (comp.acquise) h += '<span class="acquise">Acquise \u2713</span>';
        h += '</div></div>';

        // Points badge
        const badgeBg = comp.acquise ? '#d1fae5' : ptsTotal > 0 ? C.purBg : '#f3f4f6';
        const badgeColor = comp.acquise ? '#059669' : ptsTotal > 0 ? C.pur : '#d1d5db';
        h += '<span class="comp-pts-badge" style="background:' + badgeBg + ';color:' + badgeColor + '">' + (ptsTotal > 0 ? '+' + ptsTotal + ' pts' : '0 pts') + '</span>';

        // Dots
        h += '<div class="comp-dots">';
        for (let i = 0; i < 3; i++) {
            h += '<div class="comp-dot ' + (i < nbV ? 'filled' : 'empty') + '">' + (i < nbV ? '\u2713' : (i + 1)) + '</div>';
        }
        h += '</div>';
        h += '<span class="comp-chevron">\u203A</span>';
        h += '</div>';

        // Detail
        h += '<div class="comp-detail">';

        // Criteria toggle
        h += '<div class="comp-criteria-toggle">';
        h += '<button class="comp-criteria-btn" onclick="event.stopPropagation();EleveResultats.toggleCompCriteria(\'' + comp.id + '\')">';
        h += (showCrit ? '\u25BE' : '\u25B8') + ' Critères de réussite (' + comp.criteres.length + ')</button>';
        h += '<div class="comp-criteria-list' + (showCrit ? ' open' : '') + '">';
        comp.criteres.forEach(cr => {
            h += '<div class="comp-criterion"><span class="comp-criterion-dot" style="color:' + C.pur + '">\u25CF</span><span>' + escapeHtml(cr) + '</span></div>';
        });
        h += '</div></div>';

        // Passages
        h += '<div class="comp-passages-title">Mes passages';
        if (comp.passages.length > 0) h += '<span class="comp-passages-count"> \u00B7 ' + comp.passages.length + ' tentative' + (comp.passages.length > 1 ? 's' : '') + '</span>';
        h += '</div>';

        if (comp.passages.length > 0) {
            h += '<div class="comp-passages-list">';
            comp.passages.forEach(p => {
                const isBonus = p.bonus;
                const accent = isBonus && p.reussi ? C.yel : p.reussi ? C.pur : '#ef4444';
                const bgClass = p.reussi ? (isBonus ? 'success-bonus' : 'success') : 'fail';
                h += '<div class="comp-passage ' + bgClass + '" style="border-left-color:' + accent + '">';
                h += '<span class="comp-passage-icon">' + (p.reussi ? '\u2705' : '\u274C') + '</span>';
                h += '<div class="comp-passage-info"><div class="comp-passage-name ' + (p.reussi ? 'success' : 'fail') + '">';
                h += p.reussi ? 'Validation ' + p.validation : 'Non validé';
                if (isBonus) h += ' <span class="comp-passage-bonus-tag">\u2B50 Bonus</span>';
                h += '</div>';
                h += '<div class="comp-passage-date">' + p.date + '</div></div>';
                if (p.reussi) {
                    const ptsBg = isBonus ? C.yelBg : C.purBg;
                    const ptsColor = isBonus ? C.yel : C.pur;
                    h += '<span class="comp-passage-pts" style="background:' + ptsBg + ';color:' + ptsColor + '">+' + p.pts + '</span>';
                }
                h += '<span class="res-detail-link">Remarque et correction \u2192</span>';
                h += '</div>';
            });
            h += '</div>';
        } else {
            h += '<div class="res-empty">Aucun passage — demande une évaluation dans l\'onglet \u2B50 Bonus</div>';
        }
        h += '</div></div>';
        return h;
    },

    // ========== BONUS SUB-PAGE ==========
    _renderBonusSubPage(mat, sem) {
        const bonusItems = this._getBonusData(mat, sem);
        const pts = this._calculatePoints(mat, sem);
        const val = pts.cats.bonus || 0;
        const max = pts.maxCats.bonus || 0;
        const c = this.CAT.bonus;

        let h = '<button class="res-back-btn" onclick="EleveResultats.setPage(null)">\u2190 Retour à mes résultats</button>';
        h += '<div class="subpage-header"><span style="font-size:14px">' + c.dot + '</span>';
        h += '<h2>Bonus</h2>';
        if (max > 0) h += '<span class="subpage-pts-badge" style="background:' + c.bg + ';color:' + c.color + '">' + val + '/' + max + ' pts</span>';
        h += '</div>';
        h += '<div class="res-explainer" style="background:' + c.bg + ';border:1px solid ' + c.color + '20">';
        h += '<strong style="color:' + c.color + '">\u2B50 Points bonus</strong> Ici tu retrouves les bonus que tu as activés. Certains se valident en une fois, d\'autres nécessitent plusieurs validations sur la durée.';
        h += '</div>';

        if (bonusItems.length > 0) {
            bonusItems.forEach(b => { h += this._renderBonusCard(b); });
        } else {
            h += '<div class="res-empty">Aucun bonus activé</div>';
        }
        return h;
    },

    _renderBonusCard(b) {
        const isOpen = this._openBonus[b.id];
        const showCrit = this._openBonusCrit[b.id];
        const C = this.COLORS;
        const complet = b.valide;
        const ptsDisplay = b.valide ? b.acquis : 0;

        let h = '<div class="bonus-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="bonus-header" onclick="EleveResultats.toggleBonus(\'' + b.id + '\')">';
        h += '<span class="bonus-icon">\u2B50</span>';
        h += '<div class="bonus-name"><div class="bonus-name-text" style="color:' + (complet ? '#1f2937' : '#6b7280') + '">' + escapeHtml(b.nom) + '</div>';
        h += '<div class="bonus-name-sub">' + (b.valide ? 'Validé le ' + (b.date || '') : 'En attente');
        if (complet) h += '<span class="complete">Complet \u2713</span>';
        h += '</div></div>';

        const badgeBg = complet ? '#d1fae5' : ptsDisplay > 0 ? C.yelBg : '#f3f4f6';
        const badgeColor = complet ? '#059669' : ptsDisplay > 0 ? C.yel : '#d1d5db';
        h += '<span class="bonus-pts-badge" style="background:' + badgeBg + ';color:' + badgeColor + '">' + (ptsDisplay > 0 ? '+' + ptsDisplay + ' pts' : b.pts + ' pts') + '</span>';

        // Status dot
        h += '<div class="bonus-ponctuel-dot" style="background:' + (b.valide ? '#059669' : '#e5e7eb') + '">' + (b.valide ? '\u2713' : '?') + '</div>';
        h += '<span class="bonus-chevron">\u203A</span>';
        h += '</div>';

        // Detail
        h += '<div class="bonus-detail">';

        // Criteria
        if (b.criteres && b.criteres.length > 0) {
            h += '<div class="comp-criteria-toggle" style="margin-top:12px">';
            h += '<button class="comp-criteria-btn" style="color:' + C.yel + '" onclick="event.stopPropagation();EleveResultats.toggleBonusCriteria(\'' + b.id + '\')">';
            h += (showCrit ? '\u25BE' : '\u25B8') + ' Critères de réussite (' + b.criteres.length + ')</button>';
            h += '<div class="comp-criteria-list' + (showCrit ? ' open' : '') + '">';
            b.criteres.forEach(cr => {
                const text = typeof cr === 'string' ? cr : (cr.libelle || cr.label || String(cr));
                h += '<div class="comp-criterion"><span class="comp-criterion-dot" style="color:' + C.yel + '">\u25CF</span><span>' + escapeHtml(text) + '</span></div>';
            });
            h += '</div></div>';
        }

        // Status box
        const statusBg = b.valide ? '#f0fdf4' : '#f9fafb';
        const statusBorder = b.valide ? '#bbf7d0' : '#e5e7eb';
        h += '<div class="bonus-status-box" style="background:' + statusBg + ';border:1px solid ' + statusBorder + '">';
        h += '<span class="bonus-status-icon">' + (b.valide ? '\u2705' : '\u23F3') + '</span>';
        h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:' + (b.valide ? '#059669' : '#6b7280') + '">' + (b.valide ? 'Validé' : 'En attente de validation') + '</div>';
        if (b.valide && b.date) h += '<div class="bonus-status-date">' + b.date + '</div>';
        h += '</div>';
        if (b.valide) {
            h += '<span class="comp-passage-pts" style="background:' + C.yelBg + ';color:' + C.yel + '">+' + b.acquis + '</span>';
            h += '<span class="res-detail-link">Remarque et correction \u2192</span>';
        }
        h += '</div>';

        h += '</div></div>';
        return h;
    },

    // ========== API ==========
    async _callAPI(action, data) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);
        return new Promise((resolve, reject) => {
            const cb = 'eleveResultatsCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');
            window[cb] = (response) => {
                delete window[cb];
                if (script.parentNode) document.body.removeChild(script);
                resolve(response);
            };
            script.onerror = () => {
                delete window[cb];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };
            Object.keys(data || {}).forEach(key => {
                url.searchParams.set(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
            });
            url.searchParams.set('callback', cb);
            script.src = url.toString();
            document.body.appendChild(script);
            setTimeout(() => {
                if (window[cb]) {
                    delete window[cb];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { EleveResultats.init(); }, 100);
});

// Back-compat: old name still works if referenced
window.EleveNotes = EleveResultats;
window.EleveResultats = EleveResultats;
