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
    _objSliderValue: null,

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

    _effectiveSomStatut(som) {
        const stored = som.statut || '';
        if (stored === 'brouillon' || stored === 'terminee') return stored;
        const now = new Date();
        if (som.date_ouverture || som.date_fermeture) {
            if (som.date_ouverture && new Date(som.date_ouverture) > now) return 'planifiee';
            if (som.date_fermeture && new Date(som.date_fermeture) < now) return 'terminee';
            return 'publiee';
        }
        // Pas de statut et pas de dates → considérer comme publiée (rétro-compatibilité)
        return stored || 'publiee';
    },

    _isSemestreTermine(semestre) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const p = this.parametresNotes.find(
            r => String(r.semestre) === String(semestre) && r.date_fin
        );
        if (p && p.date_fin) {
            const fin = new Date(p.date_fin);
            return !isNaN(fin.getTime()) && today > fin;
        }
        return false;
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

        // Toutes les évals du semestre
        const semestreEvals = this.evaluations.filter(ev => {
            return this._getSemestreForEval(ev) === String(semestre);
        });

        semestreEvals.forEach(ev => {
            const cat = ev.categorie || ev.type || 'connaissances';
            if (maxCats[cat] === undefined) return;

            const r = this.resultats.find(res =>
                String(res.evaluation_id).trim() === String(ev.id).trim()
            );

            // Budget max : ventiler par compétence si disponible
            const evalPpc = this._parsePointsParCompetence(ev.points_par_competence);
            if (evalPpc && Object.keys(evalPpc).length > 0) {
                for (const compId in evalPpc) {
                    const compMat = this._getCompetenceMatiere(compId, ev);
                    if (compMat === matiere || compMat === 'Transversal') {
                        maxCats[cat] += parseFloat(evalPpc[compId]) || 0;
                    }
                }
            } else {
                const m = ev.matiere || '';
                if (m === matiere || m === 'Les deux') {
                    maxCats[cat] += parseFloat(ev.briques) || 2;
                }
            }

            // Points gagnés : ventiler par compétence si disponible
            if (r) {
                const resPpc = this._parsePointsParCompetence(r.points_par_competence);
                if (resPpc && Object.keys(resPpc).length > 0) {
                    for (const compId in resPpc) {
                        const compMat = this._getCompetenceMatiere(compId, ev);
                        if (compMat === matiere || compMat === 'Transversal') {
                            cats[cat] += parseFloat(resPpc[compId]) || 0;
                        }
                    }
                } else {
                    const m = ev.matiere || '';
                    if (m === matiere || m === 'Les deux') {
                        cats[cat] += parseFloat(r.validations) || 0;
                    }
                }
            }
        });

        const total = cats.connaissances + cats['savoir-faire'] + cats.competences + cats.bonus;
        const totalMax = maxCats.connaissances + maxCats['savoir-faire'] + maxCats.competences + maxCats.bonus;
        return { cats, maxCats, total, totalMax };
    },

    _parsePointsParCompetence(raw) {
        if (!raw) return null;
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
        } catch (_e) { return null; }
    },

    _getCompetenceMatiere(compId, evaluation) {
        // D'abord chercher dans le référentiel
        const comp = (this.competencesRef || []).find(c => String(c.id) === String(compId));
        if (comp) return comp.matiere || 'Transversal';
        // Sinon chercher dans les compétences personnalisées (criteres_libres)
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
                if (!((m === matiere || m === 'Les deux') && String(s.semestre || '1') === String(semestre))) return false;
                // Filter by statut: only show publiée or terminée (not brouillon or planifiée)
                const statut = this._effectiveSomStatut(s);
                return statut === 'publiee' || statut === 'terminee';
            })
            .map(s => {
                const r = this.resultatsSommatives.find(res =>
                    String(res.sommative_id).trim() === String(s.id).trim()
                );
                const corrPubliee = r && String(r.statut_correction || '').trim() === 'publie';
                const note = corrPubliee && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
                const bareme = parseFloat(s.bareme) || 20;
                const coefficient = parseFloat(s.coefficient) || 1;
                const note20 = note !== null ? (note / bareme) * 20 : null;
                const statutCorrection = r ? (r.statut_correction || '') : '';
                const remarqueTexte = r ? (r.remarque_texte || '') : '';
                const documentContenu = s.document_contenu || '';
                const correctionContenu = s.correction_contenu || '';
                return {
                    id: s.id, titre: s.titre || 'Sans titre', date: s.date || '',
                    note, bareme, coefficient, note20,
                    statutCorrection, remarqueTexte,
                    documentContenu, correctionContenu
                };
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
    _getCompetencesData(_matiere) {
        const visibleComps = this.competencesRef.filter(c =>
            c.visible !== false && c.visible !== 'false' && c.visible !== 'FALSE'
        );

        const self = this;

        return visibleComps.map(comp => {
            const compIdStr = String(comp.id).trim();
            const criteres = this.criteresReussite
                .filter(cr => String(cr.competence_id).trim() === compIdStr)
                .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0))
                .map(cr => cr.libelle || '');

            // ---- Source 1: EleveEntrainementsCompetences (competence training) ----
            const compBanques = this.banquesComps.filter(bc =>
                String(bc.competence_id).trim() === compIdStr
            );
            const banqueIds = new Set(compBanques.map(bc => String(bc.id).trim()));
            const entrIds = new Set(
                this.entrComps
                    .filter(e => banqueIds.has(String(e.banque_id).trim()))
                    .map(e => String(e.id).trim())
            );

            const trainingPassages = this.eleveEntrComps
                .filter(ec => entrIds.has(String(ec.entrainement_id).trim()))
                .filter(ec => ec.statut === 'valide' || ec.statut === 'non_valide')
                .map(p => ({
                    id: p.id,
                    date: self._formatDate(p.date_soumission || p.date_debut) || '',
                    reussi: p.statut === 'valide',
                    source: 'training',
                    bonus: false
                }));

            // ---- Source 2: EVALUATION_RESULTATS (bonus mission + TC) ----
            const evalPassages = [];
            this.evaluations.forEach(ev => {
                const evType = String(ev.type || '').trim();
                const sousTypeBonus = String(ev.sous_type_bonus || '').trim();
                // Note : on ne filtre plus par matière de l'évaluation ici.
                // L'évaluation cible des compétences spécifiques (competence_ids),
                // donc on vérifie si la compétence courante est ciblée,
                // quelle que soit la matière de l'évaluation.

                // Check if this evaluation targets this competence
                let targetsComp = false;
                let isBonus = false;

                if (evType === 'competences') {
                    // TC: check competence_ids
                    const compIds = self._parseJSON(ev.competence_ids, []);
                    targetsComp = compIds.map(String).indexOf(compIdStr) !== -1;
                } else if (evType === 'bonus' && (sousTypeBonus === 'competence' || sousTypeBonus === 'ponctuel' || sousTypeBonus === 'mission')) {
                    // Bonus mission: check competence_id or competence_ids
                    const bonusCompIds = self._parseJSON(ev.competence_ids, []);
                    targetsComp = String(ev.competence_id || '').trim() === compIdStr ||
                        bonusCompIds.map(String).indexOf(compIdStr) !== -1;
                    isBonus = true;
                }

                if (!targetsComp) return;

                // Find corrected result for this evaluation (published only)
                const r = self.resultats.find(res =>
                    String(res.evaluation_id).trim() === String(ev.id).trim() &&
                    String(res.demande_statut || '').trim() === 'corrige' &&
                    String(res.statut_correction || '').trim() !== 'brouillon'
                );
                if (!r) return;

                const isValid = r.is_validated === true || r.is_validated === 'true' || String(r.is_validated) === 'TRUE';
                evalPassages.push({
                    id: r.id || ev.id,
                    evalId: String(ev.id),
                    date: self._formatDate(r.date_passage) || '',
                    reussi: isValid,
                    source: evType === 'competences' ? 'tc' : 'bonus_mission',
                    bonus: isBonus,
                    evalTitle: ev.titre || ''
                });
            });

            // Merge and sort all passages by date
            const allPassages = trainingPassages.concat(evalPassages).sort((a, b) =>
                (a.date || '').localeCompare(b.date || '')
            );

            // Count validations and assign points
            let validationCount = 0;
            const mappedPassages = allPassages.map(p => {
                if (p.reussi) validationCount++;
                const pts = p.reussi ? (validationCount <= 1 ? 1 : validationCount <= 2 ? 1.5 : 2) : 0;
                return {
                    id: p.id,
                    evalId: p.evalId || '',
                    date: p.date,
                    reussi: p.reussi,
                    pts,
                    validation: p.reussi ? validationCount : null,
                    bonus: p.bonus,
                    source: p.source,
                    evalTitle: p.evalTitle || ''
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
        const self = this;

        return bonusEvals.map(ev => {
            const r = this.resultats.find(res => String(res.evaluation_id).trim() === String(ev.id).trim());
            const pts = parseFloat(ev.briques) || 2;
            const corrPubliee = r && String(r.statut_correction || '').trim() !== 'brouillon';
            const acquis = (r && corrPubliee) ? parseFloat(r.validations) || 0 : 0;
            const valide = corrPubliee && r && (r.is_validated === true || r.is_validated === 'true' || r.is_validated === 'TRUE');
            const date = r ? this._formatDate(r.date_passage) : null;
            const sousType = String(ev.sous_type_bonus || 'mission').trim();

            // Determine critères: check competence_ids first (referential), then criteres_libres (free-form)
            let criteres = [];
            const compId = ev.competence_id || '';
            const compIds = self._parseJSON(ev.competence_ids, []);
            const effectiveCompId = compId || (compIds.length === 1 ? String(compIds[0]) : '');

            // Source 1: referential criteria from linked competence
            if (effectiveCompId) {
                criteres = self.criteresReussite
                    .filter(cr => String(cr.competence_id).trim() === String(effectiveCompId).trim())
                    .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0))
                    .map(cr => cr.libelle || '');
            }

            // Source 2: free-form criteria (from evaluation or linked exercise)
            let criteresLibres = [];
            if (ev.criteres_libres) {
                criteresLibres = self._parseJSON(ev.criteres_libres, []);
            } else if (ev.criteres) {
                criteresLibres = self._parseJSON(ev.criteres, []);
            } else {
                const exId = ev.exercice_bonus_id || '';
                if (exId) {
                    const exercise = self.entrComps.find(e => String(e.id).trim() === String(exId).trim());
                    if (exercise && exercise.criteres_libres) {
                        criteresLibres = self._parseJSON(exercise.criteres_libres, []);
                    }
                }
            }
            // Merge: referential criteria + free-form criteria / compétences personnalisées
            if (criteresLibres.length > 0) {
                const existing = new Set(criteres.map(c => String(c).trim().toLowerCase()));
                // Nouveau format : compétences personnalisées (objets avec nom, criteres)
                if (criteresLibres.length > 0 && typeof criteresLibres[0] === 'object' && criteresLibres[0].nom) {
                    criteresLibres.forEach(cc => {
                        // Ajouter les critères de chaque compétence perso
                        (cc.criteres || []).forEach(cr => {
                            if (!existing.has(cr.trim().toLowerCase())) {
                                criteres.push(cr);
                                existing.add(cr.trim().toLowerCase());
                            }
                        });
                    });
                } else {
                    // Ancien format : strings simples
                    criteresLibres.forEach(cl => {
                        const text = typeof cl === 'string' ? cl : (cl.libelle || cl.label || String(cl));
                        if (!existing.has(text.trim().toLowerCase())) {
                            criteres.push(text);
                        }
                    });
                }
            }

            // Suivi: count validations + historique complet
            let suiviProgress = null;
            if (sousType === 'suivi') {
                const nbValidations = parseInt(ev.nb_validations) || 5;
                const validationsDone = r ? (parseInt(r.validation_numero) || parseInt(r.validations) || 0) : 0;
                let historique = [];
                if (r && r.validations_historique) {
                    try {
                        historique = typeof r.validations_historique === 'string'
                            ? JSON.parse(r.validations_historique) : r.validations_historique;
                        if (!Array.isArray(historique)) historique = [];
                    } catch (_e) { historique = []; }
                }
                suiviProgress = { done: validationsDone, total: nbValidations, historique };
            }

            // Demande statut for all bonus types
            // If correction is draft, show as 'accepte' (waiting) instead of 'corrige'
            let demandeStatut = r ? String(r.demande_statut || '').trim() : '';
            if (demandeStatut === 'corrige' && !corrPubliee) demandeStatut = 'accepte';

            return {
                id: ev.id,
                nom: ev.titre || 'Bonus',
                sousType,
                pts,
                valide: !!valide,
                date,
                acquis,
                criteres,
                suiviProgress,
                demandeStatut,
                competenceNom: effectiveCompId ?
                    (self.competencesRef.find(c => String(c.id).trim() === String(effectiveCompId).trim()) || {}).nom || '' : ''
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

    // toggleSemMenu removed — using simple S1/S2 buttons now

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
        var obj = this._getObjectif(this.currentMatiere, this.currentSemestre);
        this._editingObj = true;
        this._objSliderValue = obj || 10;
        this._render();
        this._initSliderDrag();
    },

    _initSliderDrag() {
        var bar = document.getElementById('resObjBar');
        var thumb = document.getElementById('resObjThumb');
        if (!bar || !thumb) return;
        var self = this;

        var onMove = function(clientX) {
            var rect = bar.getBoundingClientRect();
            var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            var val = Math.round(pct * 20);
            self._objSliderValue = val;
            thumb.style.left = (val / 20 * 100) + '%';
            var tooltip = thumb.querySelector('.res-obj-tooltip');
            if (tooltip) tooltip.textContent = val + '/20';
            // Update displayed value in header
            var valSpan = document.querySelector('.res-obj-value');
            if (valSpan) valSpan.textContent = val + '/20';
        };

        // Mouse
        thumb.addEventListener('mousedown', function(e) {
            e.preventDefault();
            var moveHandler = function(ev) { onMove(ev.clientX); };
            var upHandler = function() {
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
            };
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        });

        // Touch
        thumb.addEventListener('touchstart', function(e) {
            e.preventDefault();
            var moveHandler = function(ev) {
                if (ev.touches.length) onMove(ev.touches[0].clientX);
            };
            var endHandler = function() {
                document.removeEventListener('touchmove', moveHandler);
                document.removeEventListener('touchend', endHandler);
            };
            document.addEventListener('touchmove', moveHandler, { passive: false });
            document.addEventListener('touchend', endHandler);
        }, { passive: false });

        // Click on bar
        bar.addEventListener('click', function(e) {
            if (e.target === thumb || thumb.contains(e.target)) return;
            onMove(e.clientX);
        });
    },

    cancelEditObj() {
        this._editingObj = false;
        this._objSliderValue = null;
        this._render();
    },

    async confirmObj() {
        var val = this._objSliderValue;
        if (val === null || val === undefined || val < 0 || val > 20) return;
        this._editingObj = false;
        this._objSliderValue = null;

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

        let html = '';

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

        container.innerHTML = html;
    },

    // ========== HEADER + TOGGLES ==========
    _renderHeader(_acColor) {
        const isRO = this._isSemestreTermine(this.currentSemestre);
        let h = '<header class="hero-header res-hero-header">';
        h += '<div class="hero-left">';
        h += '<h1 class="hero-title">Mes résultats</h1>';
        h += '<p class="hero-subtitle">Comprends ta note et suis ta progression.</p>';
        h += '<div class="hero-btn" onclick="window.location.href=\'evaluations.html\'">\u{1F4CB} Mes évaluations</div>';
        h += '</div>';
        h += '<div class="hero-separator"></div>';
        // Semester selector
        h += '<div class="res-sem-area">';
        h += '<div class="res-sem-buttons">';
        [{k:'1',l:'S1'},{k:'2',l:'S2'}].forEach(s => {
            const active = this.currentSemestre === s.k;
            h += '<button class="res-sem-btn' + (active ? ' active' : '') + '" onclick="EleveResultats.setSemestre(\'' + s.k + '\')">' + s.l + '</button>';
        });
        h += '</div>';
        if (isRO) h += '<div class="res-sem-hint">Semestre terminé \u00B7 lecture seule</div>';
        h += '</div>';
        h += '</header>';
        return h;
    },

    _renderMatiereToggle() {
        let h = '<div class="tabs-bar res-matiere-bar">';
        [{k:'FR',l:'\u{1F1EB}\u{1F1F7} Français',tab:'fr'},{k:'HG-EMC',l:'\u{1F30D} HG-EMC',tab:'hg'}].forEach(t => {
            const active = this.currentMatiere === t.k;
            h += '<button class="tab-btn' + (active ? ' active' : '') + '" data-tab="' + t.tab + '" onclick="EleveResultats.setMatiere(\'' + t.k + '\')">' + t.l + '</button>';
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
        const isRO = this._isSemestreTermine(sem);
        const mc = this._noteColor(moyenne);
        const pc = this._noteColor(prog.note);
        const moyPct = Math.max((moyenne !== null ? moyenne : 0) / 20 * 100, 2);
        const objPct = obj ? (obj / 20) * 100 : null;

        let h = '';
        // HERO
        h += '<div class="res-hero" style="--hero-accent:' + acColor + '">';
        h += '<div class="res-hero-top"><div class="res-hero-left">';
        h += '<span class="res-hero-label">Ma moyenne</span>';
        h += '<span class="res-hero-note" style="color:' + mc + '">' + this._fmt(moyenne) + '</span>';
        h += '<span class="res-hero-unit">/20</span>';
        h += '</div>';
        h += this._renderObjectifInline(obj, acColor, isRO);
        h += '</div>';
        // Bar
        var isSlider = this._editingObj && !isRO;
        var sliderVal = this._objSliderValue !== null ? this._objSliderValue : (obj || 10);
        var sliderPct = (sliderVal / 20) * 100;
        h += '<div class="res-hero-bar' + (isSlider ? ' slider-mode' : '') + '" id="resObjBar">';
        h += '<div class="res-hero-bar-fill" style="width:' + moyPct + '%;background:linear-gradient(to right,' + mc + 'cc,' + mc + ')"></div>';
        if (isSlider) {
            h += '<div class="res-obj-thumb" id="resObjThumb" style="left:' + sliderPct + '%;background:' + acColor + '">';
            h += '<div class="res-obj-tooltip">' + sliderVal + '/20</div>';
            h += '</div>';
        } else if (objPct) {
            h += '<div class="res-hero-bar-obj" style="left:' + objPct + '%;background:' + acColor + '">';
            h += '<div class="res-hero-bar-obj-label" style="color:' + acColor + '">' + obj + '</div></div>';
        }
        h += '</div>';
        h += '<div class="res-hero-bar-labels"><span>0</span><span>20</span></div>';
        if (isSlider) {
            h += '<div class="res-obj-slider-actions">';
            h += '<button class="res-obj-confirm" style="background:' + acColor + '" onclick="EleveResultats.confirmObj()">Valider</button>';
            h += '<button class="res-obj-cancel" onclick="EleveResultats.cancelEditObj()">Annuler</button>';
            h += '</div>';
            h += '<div class="res-obj-slider-hint">Glisse le curseur ou clique sur la barre</div>';
        }
        h += '</div>';

        h += '<div class="res-connector">Détail</div>';

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
            h += '<span class="res-pts-dot" style="background:' + c.color + '"></span>';
            h += '<span class="res-pts-label">' + c.label + '</span>';
            h += '<div class="res-pts-bar"><div class="res-pts-bar-fill" style="width:' + pct + '%;background:' + c.color + '"></div></div>';
            h += '<span class="res-pts-value" style="color:' + (val > 0 ? c.color : '#d1d5db') + '">' + val + '/' + max + '</span>';
            h += '<span class="res-pts-arrow">\u203A</span>';
            h += '</div>';
        });
        h += '</div>';

        h += '<div class="res-plus">Contrôles</div>';

        // CONTROLES
        h += '<div class="res-card">';
        h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4DD}</span><span class="res-card-title-text">Contrôles</span></div>';
        if (soms.length > 0) h += '<span style="font-size:11px;color:#9ca3af">\u00B7 ' + soms.length + ' évaluation' + (soms.length > 1 ? 's' : '') + '</span>';
        h += '</div>';
        if (soms.length > 0) {
            soms.forEach(s => {
                const nc = s.note20 !== null ? this._noteColor(s.note20) : '#9ca3af';
                const hasDetail = s.note !== null && s.statutCorrection === 'publie';
                const clickAttr = hasDetail ? ' onclick="EleveResultats._openSommativeDetail(\'' + s.id + '\')"' : '';
                h += '<div class="res-controle-item' + (hasDetail ? ' clickable' : '') + '" style="border-left-color:' + nc + '"' + clickAttr + '><div class="res-controle-top"><div>';
                h += '<div class="res-controle-title">' + escapeHtml(s.titre) + '</div>';
                h += '<div class="res-controle-meta">' + (s.date || '') + ' \u00B7 coef. ' + s.coefficient + '</div>';
                h += '</div>';
                h += '<span class="res-controle-note" style="color:' + nc + '">' + (s.note !== null ? s.note : '\u2014');
                h += '<span class="res-controle-bareme">/' + s.bareme + '</span></span>';
                h += '</div>';
                if (hasDetail) {
                    h += '<div class="res-controle-link"><span class="res-detail-link">Voir le détail \u2192</span></div>';
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
        var h = '<div class="res-obj-display"><span>\u{1F3AF}</span>';
        if (this._editingObj) {
            var val = this._objSliderValue !== null ? this._objSliderValue : obj;
            h += '<span class="res-obj-value" style="color:' + acColor + '">' + (val || '?') + '/20</span>';
        } else if (obj) {
            h += '<span class="res-obj-value" style="color:' + acColor + '">' + obj + '/20</span>';
            h += '<span class="res-obj-edit-link" onclick="EleveResultats.startEditObj()">modifier</span>';
        } else {
            h += '<span class="res-obj-set-link" style="color:' + acColor + '" onclick="EleveResultats.startEditObj()">Fixer un objectif</span>';
        }
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
                if (p.source === 'tc') h += ' <span class="comp-passage-source-tag tc">\u{1F534} TC</span>';
                h += '</div>';
                h += '<div class="comp-passage-date">' + p.date;
                if (p.evalTitle) h += ' \u2014 ' + escapeHtml(p.evalTitle);
                h += '</div></div>';
                if (p.reussi) {
                    const ptsBg = isBonus ? C.yelBg : C.purBg;
                    const ptsColor = isBonus ? C.yel : C.pur;
                    h += '<span class="comp-passage-pts" style="background:' + ptsBg + ';color:' + ptsColor + '">+' + p.pts + '</span>';
                }
                if (p.evalId) {
                    h += '<span class="res-detail-link" onclick="event.stopPropagation();window.location.href=\'evaluation.html?id=' + p.evalId + '&mode=review\'">Voir le détail \u2192</span>';
                }
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

        if (b.sousType === 'suivi') return this._renderBonusSuiviCard(b, isOpen);

        const complet = b.valide;
        const ptsDisplay = b.valide ? b.acquis : 0;

        // Type badge info — unified "Mission" tag (teal)
        const typeInfo = { label: 'Mission', color: '#0d9488', bg: '#f0fdfa' };

        let h = '<div class="bonus-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="bonus-header" onclick="EleveResultats.toggleBonus(\'' + b.id + '\')">';
        h += '<span class="bonus-icon">\u2B50</span>';
        h += '<div class="bonus-name"><div class="bonus-name-text" style="color:' + (complet ? '#1f2937' : '#6b7280') + '">' + escapeHtml(b.nom) + '</div>';
        h += '<div class="bonus-name-sub">';
        h += '<span class="bonus-type-tag" style="background:' + typeInfo.bg + ';color:' + typeInfo.color + '">' + typeInfo.label + '</span> ';

        // Status text
        if (b.demandeStatut === 'demande') {
            h += 'Demandé';
        } else if (b.demandeStatut === 'accepte' || b.demandeStatut === 'acceptée') {
            h += 'Accepté — en attente de correction';
        } else if (b.demandeStatut === 'refuse') {
            h += '<span style="color:#ef4444">Refusé</span>';
        } else if (b.valide) {
            h += 'Validé le ' + (b.date || '');
        } else if (b.demandeStatut === 'corrige') {
            h += 'Non validé';
        } else {
            h += 'Disponible';
        }
        if (complet) h += '<span class="complete">Complet \u2713</span>';
        if (b.competenceNom) {
            h += '<span class="bonus-comp-ref" style="color:' + C.pur + '"> \u2014 ' + escapeHtml(b.competenceNom) + '</span>';
        }
        h += '</div></div>';

        const badgeBg = complet ? '#d1fae5' : ptsDisplay > 0 ? C.yelBg : '#f3f4f6';
        const badgeColor = complet ? '#059669' : ptsDisplay > 0 ? C.yel : '#d1d5db';
        h += '<span class="bonus-pts-badge" style="background:' + badgeBg + ';color:' + badgeColor + '">' + (ptsDisplay > 0 ? '+' + ptsDisplay + ' pts' : b.pts + ' pts') + '</span>';

        // Status dot
        const dotBg = b.valide ? '#059669' : b.demandeStatut === 'corrige' ? '#ef4444' : '#e5e7eb';
        const dotText = b.valide ? '\u2713' : b.demandeStatut === 'corrige' ? '\u2717' : '?';
        h += '<div class="bonus-ponctuel-dot" style="background:' + dotBg + '">' + dotText + '</div>';
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
        const statusBg = b.valide ? '#f0fdf4' : b.demandeStatut === 'corrige' ? '#fef2f2' : '#f9fafb';
        const statusBorder = b.valide ? '#bbf7d0' : b.demandeStatut === 'corrige' ? '#fecaca' : '#e5e7eb';
        h += '<div class="bonus-status-box" style="background:' + statusBg + ';border:1px solid ' + statusBorder + '">';

        if (b.valide) {
            h += '<span class="bonus-status-icon">\u2705</span>';
            h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#059669">Validé</div>';
            if (b.date) h += '<div class="bonus-status-date">' + b.date + '</div>';
            h += '</div>';
            h += '<span class="comp-passage-pts" style="background:' + C.yelBg + ';color:' + C.yel + '">+' + b.acquis + '</span>';
        } else if (b.demandeStatut === 'corrige') {
            h += '<span class="bonus-status-icon">\u274C</span>';
            h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#ef4444">Non validé</div></div>';
        } else if (b.demandeStatut === 'accepte' || b.demandeStatut === 'acceptée') {
            h += '<span class="bonus-status-icon">\u{1F4DD}</span>';
            h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#f59e0b">En attente de correction</div></div>';
        } else if (b.demandeStatut === 'demande') {
            h += '<span class="bonus-status-icon">\u23F3</span>';
            h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#6b7280">Demande en cours</div></div>';
        } else {
            h += '<span class="bonus-status-icon">\u23F3</span>';
            h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#6b7280">En attente</div></div>';
        }
        h += '</div>';

        h += '</div></div>';
        return h;
    },

    /** Render a bonus suivi card with progress bar + historique complet */
    _renderBonusSuiviCard(b, isOpen) {
        const C = this.COLORS;
        const sp = b.suiviProgress || { done: 0, total: 5, historique: [] };
        const hist = sp.historique || [];
        const pct = sp.total > 0 ? Math.round((sp.done / sp.total) * 100) : 0;
        const isComplete = sp.done >= sp.total;

        // Gestion du statut de demande
        if (b.demandeStatut === 'refuse') {
            return this._renderBonusSuiviRefused(b);
        }
        if (b.demandeStatut === 'demande') {
            return this._renderBonusSuiviPending(b);
        }

        let h = '<div class="bonus-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="bonus-header" onclick="EleveResultats.toggleBonus(\'' + b.id + '\')">';
        h += '<span class="bonus-icon">\u2B50</span>';
        h += '<div class="bonus-name"><div class="bonus-name-text" style="color:' + (isComplete ? '#1f2937' : '#6b7280') + '">' + escapeHtml(b.nom) + '</div>';
        h += '<div class="bonus-name-sub">';
        h += '<span class="bonus-type-tag" style="background:#fefce8;color:#ca8a04">Suivi</span> ';
        h += sp.done + '/' + sp.total + ' validation' + (sp.total > 1 ? 's' : '');
        if (isComplete) h += '<span class="complete">Objectif atteint \u2713</span>';
        h += '</div></div>';

        const badgeBg = isComplete ? '#d1fae5' : sp.done > 0 ? C.yelBg : '#f3f4f6';
        const badgeColor = isComplete ? '#059669' : sp.done > 0 ? C.yel : '#d1d5db';
        h += '<span class="bonus-pts-badge" style="background:' + badgeBg + ';color:' + badgeColor + '">' + (b.acquis > 0 ? '+' + b.acquis : b.pts) + ' pts</span>';

        h += '<span class="bonus-chevron">\u203A</span>';
        h += '</div>';

        // Detail
        h += '<div class="bonus-detail">';

        // Progress bar
        h += '<div class="suivi-progress-section" style="margin-top:12px">';
        h += '<div class="suivi-progress-bar"><div class="suivi-progress-fill" style="width:' + pct + '%;background:' + (isComplete ? '#059669' : C.yel) + '"></div></div>';
        h += '<div class="suivi-progress-label">' + pct + '% — ' + sp.done + ' / ' + sp.total + '</div>';

        // Historique complet avec dates et résultats ✓/✗
        if (hist.length > 0) {
            h += '<div class="suivi-historique">';
            h += '<div class="suivi-historique-title">Historique des vérifications</div>';
            h += '<div class="suivi-historique-list">';
            hist.forEach(function(entry) {
                const ok = entry.resultat === true || entry.resultat === 'true';
                const cls = ok ? 'success' : 'fail';
                const icon = ok ? '\u2713' : '\u2717';
                let dateStr = '';
                try {
                    const d = new Date(entry.date);
                    if (!isNaN(d.getTime())) {
                        dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                    } else {
                        dateStr = entry.date;
                    }
                } catch (_e) { dateStr = entry.date || ''; }
                h += '<div class="suivi-historique-entry ' + cls + '">';
                h += '<span class="suivi-historique-icon">' + icon + '</span>';
                h += '<span class="suivi-historique-date">' + escapeHtml(dateStr) + '</span>';
                h += '<span class="suivi-historique-label">' + (ok ? 'Validé' : 'Non validé') + '</span>';
                h += '</div>';
            });
            h += '</div></div>';
        } else {
            h += '<div class="suivi-no-history">Aucune vérification pour le moment</div>';
        }

        h += '</div>';
        h += '</div></div>';
        return h;
    },

    /** Carte suivi quand la demande est en attente */
    _renderBonusSuiviPending(b) {
        const isOpen = this._openBonus[b.id];
        let h = '<div class="bonus-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="bonus-header" onclick="EleveResultats.toggleBonus(\'' + b.id + '\')">';
        h += '<span class="bonus-icon">\u2B50</span>';
        h += '<div class="bonus-name"><div class="bonus-name-text" style="color:#6b7280">' + escapeHtml(b.nom) + '</div>';
        h += '<div class="bonus-name-sub"><span class="bonus-type-tag" style="background:#fefce8;color:#ca8a04">Suivi</span> ';
        h += '<span style="color:#f59e0b;font-weight:600">Demande envoyée</span></div></div>';
        h += '<span class="bonus-pts-badge" style="background:#f3f4f6;color:#d1d5db">' + (b.pts || 0) + ' pts</span>';
        h += '<span class="bonus-chevron">\u203A</span>';
        h += '</div>';
        h += '<div class="bonus-detail">';
        h += '<div class="bonus-status-box" style="background:#fffbeb;border:1px solid #fde68a;margin-top:14px">';
        h += '<span class="bonus-status-icon">\u23F3</span>';
        h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#d97706">Ta demande a été envoyée</div>';
        h += '<div class="bonus-status-date">En attente de réponse de la prof</div></div>';
        h += '</div></div></div>';
        return h;
    },

    /** Carte suivi quand la demande est refusée */
    _renderBonusSuiviRefused(b) {
        const isOpen = this._openBonus[b.id];
        let h = '<div class="bonus-card' + (isOpen ? ' open' : '') + '">';
        h += '<div class="bonus-header" onclick="EleveResultats.toggleBonus(\'' + b.id + '\')">';
        h += '<span class="bonus-icon">\u2B50</span>';
        h += '<div class="bonus-name"><div class="bonus-name-text" style="color:#6b7280">' + escapeHtml(b.nom) + '</div>';
        h += '<div class="bonus-name-sub"><span class="bonus-type-tag" style="background:#fefce8;color:#ca8a04">Suivi</span> ';
        h += '<span style="color:#ef4444;font-weight:600">Refusé</span></div></div>';
        h += '<span class="bonus-pts-badge" style="background:#f3f4f6;color:#d1d5db">' + (b.pts || 0) + ' pts</span>';
        h += '<span class="bonus-chevron">\u203A</span>';
        h += '</div>';
        h += '<div class="bonus-detail">';
        h += '<div class="bonus-status-box" style="background:#fef2f2;border:1px solid #fecaca;margin-top:14px">';
        h += '<span class="bonus-status-icon">\u274C</span>';
        h += '<div class="bonus-status-info"><div class="bonus-status-text" style="color:#dc2626">Demande refusée</div>';
        h += '<div class="bonus-status-date">Tu peux redemander plus tard</div></div>';
        h += '</div></div></div>';
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
    },

    // ========== SOMMATIVE DETAIL VIEW ==========

    _openSommativeDetail(sommativeId) {
        const s = this._getSommatives(this.currentMatiere, this.currentSemestre)
            .find(som => som.id === sommativeId);
        if (!s) return;

        // Only show if published
        if (s.statutCorrection !== 'publie') return;

        const container = document.getElementById('notes-content');
        if (!container) return;

        let h = '<div class="res-sommative-detail">';

        // Back button
        h += '<div class="res-back-row" onclick="EleveResultats._closeSommativeDetail()" style="cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:16px;color:var(--primary);font-size:14px;">';
        h += '\u2190 Retour aux résultats</div>';

        // Header
        h += '<div class="res-card" style="margin-bottom:16px;">';
        h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4DD}</span><span class="res-card-title-text">' + escapeHtml(s.titre) + '</span></div></div>';
        const nc = s.note20 !== null ? this._noteColor(s.note20) : '#9ca3af';
        h += '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;">';
        h += '<span style="font-size:1.5rem;font-weight:700;color:' + nc + '">' + (s.note !== null ? s.note : '\u2014') + '<span style="font-size:0.9rem;color:#9ca3af">/' + s.bareme + '</span></span>';
        if (s.date) h += '<span style="font-size:0.85rem;color:#9ca3af;">' + escapeHtml(s.date) + '</span>';
        h += '<span style="font-size:0.85rem;color:#9ca3af;">coef. ' + s.coefficient + '</span>';
        h += '</div>';
        h += '</div>';

        // Two-column layout
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';

        // Left: Sujet + Corrigé type
        h += '<div>';
        if (s.documentContenu) {
            h += '<div class="res-card" style="margin-bottom:12px;">';
            h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4C4}</span><span class="res-card-title-text">Sujet</span></div></div>';
            h += this._renderBlockContent(s.documentContenu);
            h += '</div>';
        }
        if (s.correctionContenu) {
            h += '<div class="res-card">';
            h += '<div class="res-card-header"><div class="res-card-title"><span>\u2705</span><span class="res-card-title-text">Corrigé type</span></div></div>';
            h += this._renderBlockContent(s.correctionContenu);
            h += '</div>';
        }
        if (!s.documentContenu && !s.correctionContenu) {
            h += '<div class="res-card"><div class="res-empty">Aucun sujet ni corrigé type disponible</div></div>';
        }
        h += '</div>';

        // Right: Remarque personnalisée
        h += '<div>';
        h += '<div class="res-card">';
        h += '<div class="res-card-header"><div class="res-card-title"><span>\u{1F4AC}</span><span class="res-card-title-text">Remarque de la prof</span></div></div>';
        if (s.remarqueTexte) {
            h += this._renderBlockContent(s.remarqueTexte);
        } else {
            h += '<div class="res-empty">Aucune remarque</div>';
        }
        h += '</div>';
        h += '</div>';

        h += '</div>'; // grid
        h += '</div>'; // res-sommative-detail

        // Save current content and replace
        this._savedMainContent = container.innerHTML;
        container.innerHTML = h;
    },

    _closeSommativeDetail() {
        const container = document.getElementById('notes-content');
        if (container && this._savedMainContent) {
            container.innerHTML = this._savedMainContent;
            this._savedMainContent = null;
        } else {
            this._render();
        }
    },

    /**
     * Render block content (JSON blocks array, URL, or plain text/HTML)
     */
    _renderBlockContent(content) {
        if (!content) return '';
        const str = String(content).trim();

        // URL → iframe or link
        if (str.startsWith('http')) {
            if (str.includes('docs.google.com')) {
                const embedUrl = str.replace(/\/edit.*$/, '/preview');
                return '<iframe src="' + escapeHtml(embedUrl) + '" style="width:100%;height:400px;border:1px solid #e5e7eb;border-radius:8px;" frameborder="0"></iframe>';
            }
            return '<a href="' + escapeHtml(str) + '" target="_blank" style="color:var(--primary);">Voir le document \u2192</a>';
        }

        // JSON blocks
        try {
            const blocks = JSON.parse(str);
            if (Array.isArray(blocks)) {
                return blocks.map(b => this._renderBlock(b)).join('');
            }
        } catch (_e) { /* not JSON */ }

        // Plain text/HTML
        return '<div style="padding:8px 0;">' + str + '</div>';
    },

    _renderBlock(block) {
        if (!block || !block.type) return '';
        switch (block.type) {
            case 'text':
                return '<div style="padding:6px 0;">' + (block.content || '') + '</div>';
            case 'document': {
                const url = block.url || '';
                if (url.includes('docs.google.com')) {
                    const embedUrl = url.replace(/\/edit.*$/, '/preview');
                    return '<iframe src="' + escapeHtml(embedUrl) + '" style="width:100%;height:350px;border:1px solid #e5e7eb;border-radius:8px;" frameborder="0"></iframe>';
                }
                return url ? '<a href="' + escapeHtml(url) + '" target="_blank" style="color:var(--primary);">Voir le document \u2192</a>' : '';
            }
            case 'image':
                return block.url ? '<img src="' + escapeHtml(block.url) + '" style="max-width:100%;border-radius:8px;margin:8px 0;" alt="">' : '';
            case 'video': {
                const vUrl = block.url || '';
                const embed = vUrl.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/');
                return '<iframe src="' + escapeHtml(embed) + '" style="width:100%;height:300px;border-radius:8px;" frameborder="0" allowfullscreen></iframe>';
            }
            case 'group': {
                const ratios = (block.ratio || '50-50').split('-').map(Number);
                let gh = '<div style="display:flex;gap:12px;">';
                (block.children || []).forEach((child, i) => {
                    gh += '<div style="flex:' + (ratios[i] || 50) + '">' + this._renderBlock(child) + '</div>';
                });
                return gh + '</div>';
            }
            default: return '';
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { EleveResultats.init(); }, 100);
});

// Back-compat: old name still works if referenced
window.EleveNotes = EleveResultats;
window.EleveResultats = EleveResultats;
