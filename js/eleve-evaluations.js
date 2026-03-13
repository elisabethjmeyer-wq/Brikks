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
        const [evaluationsData, resultatsData, parametresData, sommativesData, resSommativesData, objectifsData, competencesRefData] = await Promise.all([
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => []),
            SheetsAPI.getSheetData('CompetencesReferentiel').catch(() => [])
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

        this.competencesReferentiel = SheetsAPI.parseSheetData(competencesRefData);

        // Calculer les validations par compétence pour le plafond (3 max)
        this._computeCompetenceValidations();

        // Only visible evaluations
        this.evaluations = this.evaluations.filter(e => {
            const s = this._computeEffectiveStatut(e);
            return s === 'planifiee' || s === 'publiee' || s === 'terminee';
        });
    },

    /**
     * Calcule le nombre de validations par compétence pour l'élève courant
     * Sources : resultats d'évaluations validés liés à une compétence
     */
    _computeCompetenceValidations() {
        this.competenceValidations = {}; // { competence_id: count }
        const allResultats = this.resultats.filter(r => this._isTruthy(r.is_validated));
        allResultats.forEach(r => {
            const evalId = String(r.evaluation_id || '').trim();
            const evaluation = this.evaluations.find(e => String(e.id).trim() === evalId);
            if (!evaluation) return;
            // Bonus mission : 1 compétence via competence_id (si présent)
            if (evaluation.type === 'bonus' && String(evaluation.sous_type_bonus || '').trim() !== 'suivi') {
                const compId = String(evaluation.competence_id || '').trim();
                if (compId) {
                    this.competenceValidations[compId] = (this.competenceValidations[compId] || 0) + 1;
                }
            }
            // TC : plusieurs compétences via competence_ids
            if (evaluation.type === 'competences') {
                try {
                    const ids = JSON.parse(evaluation.competence_ids || '[]');
                    // Vérifier quelles compétences ont été validées
                    let validIds = ids;
                    if (r.competence_ids_validees) {
                        try { validIds = JSON.parse(r.competence_ids_validees); } catch (_e) { /* use all */ }
                    }
                    validIds.forEach(id => {
                        const cid = String(id).trim();
                        if (cid) this.competenceValidations[cid] = (this.competenceValidations[cid] || 0) + 1;
                    });
                } catch (_e) { /* ignore */ }
            }
        });
    },

    /**
     * Vérifie si une compétence est acquise (3 validations atteintes)
     */
    _isCompetenceAcquise(competenceId) {
        return (this.competenceValidations[String(competenceId).trim()] || 0) >= 3;
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
        // Brouillon/terminée = décision manuelle de la prof, jamais écrasé par les dates
        if (evaluation.statut === 'brouillon' || evaluation.statut === 'terminee') return evaluation.statut;
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
        if (type === 'bonus') return 'Critères de réussite';
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
        const semestreEvals = this.evaluations.filter(ev => {
            return this._getSemestreForEval(ev) === String(this.currentSemestre);
        });
        semestreEvals.forEach(ev => {
            const result = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            if (!result) return;
            const categorie = ev.categorie || ev.type || 'connaissances';
            if (cats[categorie] === undefined) return;

            // Mode points par compétence : ventiler par matière
            const resPpc = this._parsePointsParCompetence(result.points_par_competence);
            if (resPpc && Object.keys(resPpc).length > 0) {
                for (const compId in resPpc) {
                    const compMat = this._getCompetenceMatiere(compId);
                    if (compMat === matiere || compMat === 'Transversal') {
                        cats[categorie] += parseFloat(resPpc[compId]) || 0;
                    }
                }
            } else {
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

    _getCompetenceMatiere(compId) {
        const comp = (this.competencesReferentiel || []).find(c => String(c.id) === String(compId));
        return comp ? (comp.matiere || 'Transversal') : 'Transversal';
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

    _effectiveSomStatut(som) {
        const stored = som.statut || '';
        if (stored === 'brouillon' || stored === 'terminee') return stored;
        const now = new Date();
        if (som.date_ouverture || som.date_fermeture) {
            if (som.date_ouverture && new Date(som.date_ouverture) > now) return 'planifiee';
            if (som.date_fermeture && new Date(som.date_fermeture) < now) return 'terminee';
            return 'publiee';
        }
        return stored || 'publiee';
    },

    _getSommatives(matiere) {
        return this.notesSommatives
            .filter(s => {
                const m = s.matiere || '';
                if (!((m === matiere || m === 'Les deux') && String(s.semestre || '1') === String(this.currentSemestre))) return false;
                // Filter by statut: only show publiée or terminée
                const statut = this._effectiveSomStatut(s);
                return statut === 'publiee' || statut === 'terminee';
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
            bonus: []
        };

        // Progression evaluations — filtrer par semestre courant
        this.evaluations.forEach(ev => {
            if (this._getSemestreForEval(ev) !== String(this.currentSemestre)) return;

            const resultat = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim()
            );
            const effectiveStatut = this._computeEffectiveStatut(ev);
            const isBonus = ev.type === 'bonus';
            const isTC = ev.type === 'competences';

            // Détecter le statut de demande pour bonus/TC
            const demandeStatut = resultat ? String(resultat.demande_statut || '').trim() : '';
            const sousType = String(ev.sous_type_bonus || '').trim();

            // Déterminer le cardStatus en fonction du type
            let cardStatus;
            if (isBonus) {
                // Bonus et TC sur demande : statuts basés sur le workflow de demande
                if (sousType === 'suivi') {
                    // Suivi : flux demande + progression
                    if (demandeStatut === 'demande') {
                        cardStatus = 'suivi_demande';
                    } else if (demandeStatut === 'accepte' || demandeStatut === 'rendu') {
                        const validNum = resultat ? (parseInt(resultat.validation_numero) || 0) : 0;
                        const nbTotal = parseInt(ev.nb_validations) || 5;
                        const isComplete = validNum >= nbTotal;
                        cardStatus = isComplete ? 'suivi_complete' : 'suivi_en_cours';
                    } else if (demandeStatut === 'refuse') {
                        cardStatus = 'suivi_refuse';
                    } else {
                        cardStatus = 'suivi_disponible';
                    }
                } else if (demandeStatut === 'demande') {
                    cardStatus = 'demande_envoyee';
                } else if (demandeStatut === 'accepte') {
                    cardStatus = 'demande_acceptee';
                } else if (demandeStatut === 'rendu') {
                    cardStatus = 'rendu';
                } else if (demandeStatut === 'corrige') {
                    cardStatus = this._isTruthy(resultat.is_validated) ? 'validated' : 'failed';
                } else if (demandeStatut === 'refuse') {
                    cardStatus = 'demande_refusee';
                } else if (resultat && this._isTruthy(resultat.is_validated)) {
                    cardStatus = 'validated';
                } else if (resultat && resultat.id && !this._isTruthy(resultat.is_validated) && resultat.validations !== undefined && resultat.validations !== '') {
                    cardStatus = 'failed';
                } else {
                    cardStatus = 'disponible';
                }

                const cardData = { ...ev, resultat, cardStatus, demandeStatut, mode_passation: 'papier' };

                // Bonus accepté → migre dans l'onglet Évaluations (section "À passer")
                if (cardStatus === 'demande_acceptee' || cardStatus === 'rendu' || cardStatus === 'suivi_en_cours') {
                    this.categories.available.push(cardData);
                    return;
                }
                // Bonus terminé (corrigé/validé/failed/suivi complet) → dans "Terminées"
                if (cardStatus === 'validated' || cardStatus === 'failed' || cardStatus === 'suivi_complete') {
                    this.categories.done.push(cardData);
                    return;
                }
                // Sinon (disponible, demande_envoyee, refusee, suivi_disponible, suivi_demande, suivi_refuse) → onglet Bonus
                this.categories.bonus.push(cardData);
                return;
            }

            // TC obligatoire (avec dates) → va dans évaluations classiques
            if (isTC) {
                if (resultat && this._isTruthy(resultat.is_validated)) {
                    cardStatus = 'validated';
                } else if (resultat && resultat.id) {
                    cardStatus = 'done';
                } else if (effectiveStatut === 'planifiee') {
                    cardStatus = 'upcoming';
                } else {
                    cardStatus = 'available';
                }
                // Les TC ne se passent pas en ligne → forcer mode papier
                const evWithPapier = { ...ev, resultat, cardStatus, mode_passation: 'papier' };
                if (cardStatus === 'upcoming') this.categories.upcoming.push(evWithPapier);
                else if (cardStatus === 'available') this.categories.available.push(evWithPapier);
                else this.categories.done.push(evWithPapier);
                return;
            }

            // Types classiques (connaissances, savoir-faire)
            if (effectiveStatut === 'terminee') {
                if (resultat) {
                    const statutRes = String(resultat.statut_resultat || '').trim();
                    if (statutRes === 'non_rendu') {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'non_rendu' });
                    } else if (statutRes === 'absent') {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'absent' });
                    } else {
                        this.categories.done.push({ ...ev, resultat, cardStatus: 'done' });
                    }
                } else {
                    this.categories.done.push({ ...ev, cardStatus: 'not_done' });
                }
                return;
            }

            if (effectiveStatut === 'planifiee') {
                this.categories.upcoming.push({ ...ev, cardStatus: 'upcoming' });
                return;
            }

            if (resultat) {
                const statutRes = String(resultat.statut_resultat || '').trim();
                if (statutRes === 'non_rendu' || statutRes === 'absent') {
                    const cs = statutRes === 'non_rendu' ? 'non_rendu' : 'absent';
                    this.categories.done.push({ ...ev, resultat, cardStatus: cs });
                    return;
                }
                const isValidated = this._isTruthy(resultat.is_validated);
                const status = isValidated ? 'validated' : 'failed';
                this.categories.done.push({ ...ev, resultat, cardStatus: status });
            } else {
                this.categories.available.push({ ...ev, cardStatus: 'available' });
            }
        });

        // Sommative evaluations (from NOTES_SOMMATIVES) — same sections as other evals
        this.notesSommatives.forEach(som => {
            if (this._getSemestreForEval(som) !== String(this.currentSemestre)) return;
            const effStatut = this._effectiveSomStatut(som);
            if (effStatut === 'brouillon') return;
            const r = this.resultatsSommatives.find(res =>
                String(res.sommative_id).trim() === String(som.id).trim()
            );
            const corrPubliee = r && String(r.statut_correction || '').trim() === 'publie';
            const note = corrPubliee && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
            const bareme = parseFloat(som.bareme) || 20;
            const coefficient = parseFloat(som.coefficient) || 1;
            const somData = {
                ...som,
                type: 'controle',
                note, bareme, coefficient,
                isSommative: true,
                resultatSom: r || null
            };
            if (effStatut === 'terminee' || note !== null) {
                somData.cardStatus = note !== null ? 'done' : 'not_done';
                this.categories.done.push(somData);
            } else if (effStatut === 'planifiee') {
                somData.cardStatus = 'upcoming';
                this.categories.upcoming.push(somData);
            } else {
                // publiee
                somData.cardStatus = 'available';
                this.categories.available.push(somData);
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

        const totalCount = available.length + upcoming.length + done.length;
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

        if (done.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminées <span class="section-count">${done.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
                        ${done.map(e => e.isSommative ? this.renderSommativeCard(e) : this._renderAnyCard(e)).join('')}
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
                    <p>Des évaluations bonus apparaîtront ici pour gagner des points supplémentaires !</p>
                </div>
            `;
            return;
        }

        // Séparer par état
        const actifs = bonus.filter(b =>
            b.cardStatus === 'disponible' || b.cardStatus === 'demande_envoyee' ||
            b.cardStatus === 'demande_acceptee' || b.cardStatus === 'demande_refusee' ||
            b.cardStatus === 'suivi_disponible' || b.cardStatus === 'suivi_demande' ||
            b.cardStatus === 'suivi_refuse'
        );
        const termines = bonus.filter(b =>
            b.cardStatus === 'validated' || b.cardStatus === 'failed'
        );

        let html = '';
        if (actifs.length > 0) {
            html += this._renderBonusSection('Disponibles', actifs, 'section-active');
        }
        if (termines.length > 0) {
            html += `
                <div class="eval-section section-done">
                    <button class="section-header collapsible" onclick="EleveEvaluations.toggleSection(this)">
                        <h2>Terminés <span class="section-count">${termines.length}</span></h2>
                        <span class="section-toggle">▼</span>
                    </button>
                    <div class="section-cards collapsed">
                        ${termines.map(e => this.renderBonusCard(e)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    _renderBonusSection(title, evals, cssClass) {
        return `
            <div class="eval-section ${cssClass}">
                <div class="section-header">
                    <h2>${title} <span class="section-count">${evals.length}</span></h2>
                </div>
                <div class="section-cards">
                    ${evals.map(e => this.renderBonusCard(e)).join('')}
                </div>
            </div>
        `;
    },

    // ========== BONUS CARD ==========
    renderBonusCard(evaluation) {
        const sousType = String(evaluation.sous_type_bonus || '').trim();
        const isTC = evaluation.type === 'competences';

        if (sousType === 'suivi') return this._renderBonusSuiviCard(evaluation);
        // Bonus mission ou TC sur demande
        return this._renderBonusDemandeCard(evaluation, isTC);
    },

    /**
     * Carte bonus avec workflow de demande (mission, TC)
     */
    _renderBonusDemandeCard(evaluation, isTC) {
        const cardStatus = evaluation.cardStatus;
        const resultat = evaluation.resultat;
        const briques = parseInt(evaluation.briques) || 1;
        const title = evaluation.titre || 'Évaluation bonus';

        // Plafond 3 validations si la mission cible une compétence
        const competenceId = String(evaluation.competence_id || '').trim();
        const isAcquise = competenceId && this._isCompetenceAcquise(competenceId);

        // Badge type
        let typeBadge, typeColor;
        if (isTC) {
            typeBadge = 'Tâche complexe';
            typeColor = '#dc2626';
        } else {
            typeBadge = 'Bonus mission';
            typeColor = '#0d9488';
        }

        let cardClass = 'eval-card bonus-card';
        if (isAcquise) cardClass += ' acquise';
        if (cardStatus === 'validated') cardClass += ' done validated';
        if (cardStatus === 'failed') cardClass += ' done failed';

        // Points badge
        let pointsBadge;
        if (cardStatus === 'validated' && resultat) {
            const pts = parseFloat(resultat.validations) || 0;
            pointsBadge = `<span class="card-points earned">+${pts}</span>`;
        } else if (cardStatus === 'failed') {
            pointsBadge = '<span class="card-points lost">+0</span>';
        } else {
            pointsBadge = `<span class="card-points pending">${briques} point${briques > 1 ? 's' : ''} à gagner</span>`;
        }

        // Statut + action
        let statusHtml = '';
        let actionHtml = '';

        if (isAcquise && cardStatus === 'disponible') {
            statusHtml = '<span class="bonus-status acquise">Compétence acquise</span>';
            actionHtml = '';
        } else if (cardStatus === 'disponible') {
            actionHtml = `<button class="card-btn type-bonus" id="btnDemande_${evaluation.id}" onclick="event.stopPropagation(); EleveEvaluations.demanderEvaluation('${evaluation.id}')">Demander cette évaluation</button>`;
        } else if (cardStatus === 'demande_envoyee') {
            actionHtml = '<span class="bonus-status en-attente">Demande envoyée</span>';
        } else if (cardStatus === 'demande_acceptee') {
            const dateRendu = resultat ? (resultat.date_rendu || '') : '';
            const typeDate = resultat ? String(resultat.type_date || '').trim() : '';
            const dateInfo = dateRendu ? `<div class="bonus-date-info">${escapeHtml(this._formatDateRendu(dateRendu, typeDate))}</div>` : '';
            const remarque = resultat ? (resultat.remarque_prof || '') : '';
            const remarqueHtml = remarque ? `<div class="bonus-remarque">${escapeHtml(remarque)}</div>` : '';
            statusHtml = `<span class="bonus-status accepte">Accepté</span>${dateInfo}${remarqueHtml}`;
            const hasDoc = String(evaluation.document_contenu || '').trim() !== '';
            if (hasDoc) {
                actionHtml = '<div class="card-action-info">Consulter le sujet</div>';
                cardClass += ' clickable';
            }
        } else if (cardStatus === 'demande_refusee') {
            const remarque = resultat ? (resultat.remarque_prof || '') : '';
            const remarqueHtml = remarque ? `<div class="bonus-remarque">${escapeHtml(remarque)}</div>` : '';
            statusHtml = `<span class="bonus-status refuse">Refusé</span>${remarqueHtml}`;
        } else if (cardStatus === 'validated') {
            statusHtml = '<span class="bonus-status valide">Validé</span>';
            actionHtml = '<div class="card-detail-link">Voir la correction →</div>';
            cardClass += ' clickable';
        } else if (cardStatus === 'failed') {
            statusHtml = '<span class="bonus-status non-valide">Non validé</span>';
            actionHtml = '<div class="card-detail-link">Voir la correction →</div>';
            cardClass += ' clickable';
        }

        // Click handler for review
        let clickAttr = '';
        if (cardStatus === 'validated' || cardStatus === 'failed') {
            clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')"`;
        } else if (cardStatus === 'demande_acceptee' && String(evaluation.document_contenu || '').trim() !== '') {
            clickAttr = ` onclick="EleveEvaluations.consulterSujet('${evaluation.id}')"`;
        }

        // Meta
        const metaParts = [];
        const matiere = evaluation.matiere || '';
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        return `
            <div class="${cardClass}"${clickAttr}>
                <div class="card-layout">
                    <div class="card-info">
                        <div class="card-title-row">
                            <span class="card-bullet" style="background:${typeColor}"></span>
                            <h3 class="card-title">${escapeHtml(title)}</h3>
                        </div>
                        <div class="card-type" style="color:${typeColor}">${typeBadge}</div>
                        ${evaluation.description_eleve ? `<div class="card-description">${escapeHtml(evaluation.description_eleve)}</div>` : ''}
                        ${metaLine}
                        ${statusHtml}
                    </div>
                    <div class="card-right">
                        ${pointsBadge}
                        ${actionHtml}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Carte bonus suivi — 3 états : disponible, en cours (avec progression), complet
     */
    _renderBonusSuiviCard(evaluation) {
        const resultat = evaluation.resultat;
        const cardStatus = evaluation.cardStatus;
        const briques = parseInt(evaluation.briques) || 1;
        const nbTotal = parseInt(evaluation.nb_validations) || 5;
        const currentVal = resultat ? (parseInt(resultat.validation_numero) || parseInt(resultat.validations) || 0) : 0;
        const isComplete = currentVal >= nbTotal;
        const title = evaluation.titre || 'Suivi';
        const pct = nbTotal > 0 ? Math.round((currentVal / nbTotal) * 100) : 0;

        let cardClass = 'eval-card bonus-card bonus-suivi type-bonus';
        if (isComplete) cardClass += ' done validated';

        // Points badge
        let pointsBadge;
        if (isComplete) {
            pointsBadge = `<span class="card-points earned">+${briques}</span>`;
        } else {
            pointsBadge = `<span class="card-points pending">${briques} point${briques > 1 ? 's' : ''} à gagner</span>`;
        }

        // Critères dépliables
        const criteresHtml = this._renderSuiviCriteres(evaluation);

        // Type subtitle (cohérent avec les autres cartes)
        let typeSubLabel = `${nbTotal} validations`;
        if (cardStatus === 'suivi_en_cours') typeSubLabel = 'En cours';
        else if (cardStatus === 'suivi_complete') typeSubLabel = 'Objectif atteint !';
        else if (cardStatus === 'suivi_refuse') typeSubLabel = '';

        const typeSubtitle = `<div class="card-type type-suivi">Bonus suivi${typeSubLabel ? ` · <span class="card-sublabel">${typeSubLabel}</span>` : ''}</div>`;

        // Statut (badges inline dans card-info)
        let statusHtml = '';
        if (cardStatus === 'suivi_demande') {
            statusHtml = '<span class="bonus-status en-attente">Demande envoyée</span>';
        } else if (cardStatus === 'suivi_refuse') {
            const remarque = resultat ? (resultat.remarque_prof || '') : '';
            statusHtml = `<span class="bonus-status refuse">Refusé</span>`;
            if (remarque) statusHtml += `<div class="bonus-remarque">${escapeHtml(remarque)}</div>`;
        } else if (cardStatus === 'suivi_en_cours' || cardStatus === 'suivi_complete') {
            statusHtml = this._renderSuiviProgress(currentVal, nbTotal, pct, isComplete, resultat);
        }

        // Action (dans card-right, comme les autres cartes)
        let actionHtml = '';
        if (cardStatus === 'suivi_disponible') {
            actionHtml = `<button class="card-btn type-bonus" id="btnDemande_${evaluation.id}" onclick="event.stopPropagation(); EleveEvaluations.demanderEvaluation('${evaluation.id}')">Demander</button>`;
        }

        // Description tronquée (2 lignes max)
        const descHtml = evaluation.description_eleve
            ? `<div class="card-description suivi-description">${escapeHtml(evaluation.description_eleve)}</div>`
            : '';

        return `
            <div class="${cardClass}">
                <div class="card-layout">
                    <div class="card-info">
                        <div class="card-title-row">
                            <span class="card-bullet type-bonus"></span>
                            <h3 class="card-title">${escapeHtml(title)}</h3>
                        </div>
                        ${typeSubtitle}
                        ${descHtml}
                        ${criteresHtml}
                        ${statusHtml}
                    </div>
                    <div class="card-right">
                        ${pointsBadge}
                        ${actionHtml}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Critères de réussite dépliables (chevron)
     */
    _renderSuiviCriteres(evaluation) {
        let criteres = [];
        if (evaluation.criteres_libres) {
            try {
                const parsed = typeof evaluation.criteres_libres === 'string'
                    ? JSON.parse(evaluation.criteres_libres) : evaluation.criteres_libres;
                if (Array.isArray(parsed)) criteres = parsed.filter(c => c && c.trim());
            } catch (_e) { /* ignore */ }
        }
        if (criteres.length === 0) return '';

        const uid = 'suivi_criteres_' + evaluation.id;
        const items = criteres.map(c => `<li>${escapeHtml(c)}</li>`).join('');

        return `
            <div class="suivi-criteres-toggle" onclick="event.stopPropagation(); EleveEvaluations._toggleSuiviCriteres('${uid}')">
                <span class="suivi-criteres-chevron" id="chevron_${uid}">▸</span> Critères de réussite
            </div>
            <ul class="suivi-criteres-list hidden" id="${uid}">${items}</ul>
        `;
    },

    /**
     * Toggle critères dépliables
     */
    _toggleSuiviCriteres(uid) {
        const list = document.getElementById(uid);
        const chevron = document.getElementById('chevron_' + uid);
        if (!list) return;
        const isHidden = list.classList.contains('hidden');
        list.classList.toggle('hidden');
        if (chevron) chevron.textContent = isHidden ? '▾' : '▸';
    },

    /**
     * Barre de progression + date dernière validation
     */
    _renderSuiviProgress(currentVal, nbTotal, pct, isComplete, resultat) {
        // Dernière date de vérification
        let lastDateHtml = '';
        if (resultat && resultat.validations_historique) {
            try {
                const hist = typeof resultat.validations_historique === 'string'
                    ? JSON.parse(resultat.validations_historique) : resultat.validations_historique;
                if (Array.isArray(hist) && hist.length > 0) {
                    const lastEntry = hist[hist.length - 1];
                    const d = new Date(lastEntry.date);
                    if (!isNaN(d.getTime())) {
                        lastDateHtml = `<div class="suivi-last-date">Dernière vérification : ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>`;
                    }
                }
            } catch (_e) { /* ignore */ }
        }

        return `
            <div class="suivi-progress-container">
                <div class="suivi-progress-bar">
                    <div class="suivi-progress-fill ${isComplete ? 'complete' : ''}" style="width:${pct}%"></div>
                </div>
                <span class="suivi-progress-label">${currentVal}/${nbTotal}</span>
            </div>
            ${isComplete ? '<span class="bonus-status valide">Objectif atteint !</span>' : ''}
            ${lastDateHtml}
        `;
    },

    /**
     * Demander à être évalué(e)
     */
    async demanderEvaluation(evaluationId) {
        // Feedback immédiat : remplacer le bouton par le tag "Demande envoyée"
        const btn = event ? event.target : null;
        if (btn) {
            const tag = document.createElement('span');
            tag.className = 'bonus-status en-attente';
            tag.textContent = 'Demande envoyée';
            btn.replaceWith(tag);
        }

        try {
            const result = await this.callAPI('demanderEvaluation', {
                evaluation_id: evaluationId,
                eleve_id: this.currentUserId
            });
            if (result.success) {
                // Mise à jour optimiste : injecter le résultat localement
                // pour que l'UI reflète immédiatement la demande,
                // même si le re-fetch Sheets API retourne des données en cache
                this.resultats.push({
                    id: result.id || ('res_' + Date.now()),
                    evaluation_id: evaluationId,
                    eleve_id: this.currentUserId,
                    demande_statut: 'demande',
                    date_demande: new Date().toISOString(),
                    source: 'demande_eleve'
                });
                this.categorizeEvaluations();
                this.render();
                this.updateTabCounts();
                this._showToast('Demande envoyée !');

                // Rafraîchir en arrière-plan pour mettre à jour le cache
                SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
                SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => {});
            } else {
                alert(result.error || 'Erreur lors de la demande');
                // Re-render pour restaurer le bouton
                this.categorizeEvaluations();
                this.render();
                this.updateTabCounts();
            }
        } catch (error) {
            console.error('Erreur demande:', error);
            alert('Erreur réseau');
            this.categorizeEvaluations();
            this.render();
            this.updateTabCounts();
        }
    },

    /**
     * Consulter le sujet d'une évaluation acceptée (lecture seule)
     */
    consulterSujet(evaluationId) {
        window.location.href = 'evaluation.html?id=' + evaluationId + '&mode=sujet';
    },


    _renderSection(title, evals, cssClass) {
        return `
            <div class="eval-section ${cssClass}">
                <div class="section-header">
                    <h2>${title} <span class="section-count">${evals.length}</span></h2>
                </div>
                <div class="section-cards">
                    ${evals.map(e => e.isSommative ? this.renderSommativeCard(e) : this._renderAnyCard(e)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Route vers le bon renderer selon le type de carte.
     * Bonus suivi → renderBonusCard, bonus non-suivi → _renderBonusDemandeCard, sinon renderCard.
     */
    _renderAnyCard(e) {
        const sousType = String(e.sous_type_bonus || '').trim();
        if (sousType === 'suivi') return this.renderBonusCard(e);
        if (e.type === 'bonus') return this._renderBonusDemandeCard(e, false);
        return this.renderCard(e);
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
        if (resultat && isDone && !isMissed && !isPapier) {
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

        // TC : sujet consultable ?
        const isTC = type === 'competences';
        const hasDocContenu = String(evaluation.document_contenu || '').trim() !== '';
        const sujetAvance = isTC && (evaluation.sujet_disponible_avance === true || evaluation.sujet_disponible_avance === 'true' || evaluation.sujet_disponible_avance === 'TRUE');

        // Type subtitle
        let typeLabel = config.label;
        if (isTC) typeLabel = 'Tâche complexe';
        const typeSubtitle = `<div class="card-type ${config.cssClass}">${escapeHtml(typeLabel)} · <span class="card-sublabel">Progression</span></div>`;

        // Meta
        const metaParts = [];
        const dateStr = this._getCardDate(evaluation, cardStatus);
        if (dateStr) metaParts.push(`<span class="meta-date">${escapeHtml(dateStr)}</span>`);
        if (duree > 0) metaParts.push(`<span class="meta-duree">${duree} min</span>`);
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        if (isTC) metaParts.push('<span class="meta-mode papier">En classe</span>');
        else if (isPapier) metaParts.push('<span class="meta-mode papier">Papier</span>');
        else metaParts.push('<span class="meta-mode numerique">Numérique</span>');
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        const isBonusOrTC = isTC || (evaluation.type === 'bonus');
        const conditionLine = isBonusOrTC ? '' : `<div class="card-condition">Réussite : ${escapeHtml(condition)}</div>`;

        // Action
        let actionHtml = '';
        let statusExtra = '';
        if (sujetAvance && !isDone) {
            statusExtra += '<span class="bonus-status sujet-avance" style="align-self:flex-start">Sujet consultable</span>';
        }
        if (cardStatus === 'demande_acceptee') {
            // Bonus accepté migré dans "Évaluations"
            const dateRendu = resultat ? (resultat.date_rendu || '') : '';
            const typeDate = resultat ? String(resultat.type_date || '').trim() : '';
            if (dateRendu) {
                statusExtra = `<div class="card-bonus-date">${escapeHtml(this._formatDateRendu(dateRendu, typeDate))}</div>`;
            }
            const remarque = resultat ? (resultat.remarque_prof || '') : '';
            if (remarque) {
                statusExtra += `<div class="card-bonus-remarque">${escapeHtml(remarque)}</div>`;
            }
            // Bouton consulter sujet si document_contenu existe (bonus accepté = sujet accessible)
            if (hasDocContenu) {
                actionHtml = `<a href="evaluation.html?id=${evaluation.id}&mode=sujet" class="card-btn type-bonus" onclick="event.stopPropagation()">Consulter le sujet</a>`;
            }
        } else if (cardStatus === 'rendu') {
            statusExtra = '<span class="bonus-status en-attente" style="align-self:flex-start">En attente de correction</span>';
        } else if (cardStatus === 'available' && isTC && hasDocContenu) {
            // TC ouverte + sujet renseigné → consultable
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}&mode=sujet" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Consulter le sujet</a>`;
        } else if (cardStatus === 'available' && isTC) {
            // TC ouverte sans sujet → en classe seulement
            actionHtml = '<div class="card-action-info papier">En classe</div>';
        } else if (cardStatus === 'available' && !isPapier) {
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Commencer</a>`;
        } else if (cardStatus === 'available' && isPapier) {
            actionHtml = '<div class="card-action-info papier">En classe</div>';
        } else if (cardStatus === 'upcoming' && sujetAvance) {
            // TC planifiée mais sujet consultable à l'avance (toggle explicite)
            actionHtml = `<a href="evaluation.html?id=${evaluation.id}&mode=sujet" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Consulter le sujet</a>`;
        } else if (cardStatus === 'upcoming') {
            actionHtml = `<div class="card-action-info upcoming">${escapeHtml(this.getCountdown(evaluation.date_ouverture))}</div>`;
        } else if (isMissed) {
            actionHtml = '';
        } else if (isDone && resultat && isTC) {
            // TC : "Voir le détail" uniquement si la correction est publiée
            const corrPubliee = String(resultat.statut_correction || '').trim() === 'publie';
            if (corrPubliee) {
                clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')"`;
                cardClass += ' clickable';
                actionHtml = '<div class="card-detail-link">Voir le détail →</div>';
            } else {
                statusExtra += '<span class="bonus-status en-attente" style="align-self:flex-start">En attente de correction</span>';
            }
        } else if (isDone && resultat) {
            clickAttr = ` onclick="EleveEvaluations.openReview('${evaluation.id}')"`;
            cardClass += ' clickable';
            actionHtml = '<div class="card-detail-link">Voir le détail →</div>';
        } else if (isDone && !isPapier) {
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
                        ${statusExtra}
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

        const status = som.cardStatus || 'available';
        let cardClass = `eval-card ${config.cssClass}`;
        if (status === 'done' || status === 'not_done') cardClass += ' done';
        else if (status === 'upcoming') cardClass += ' upcoming';

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
        if (som.date_ouverture) metaParts.push(`<span class="meta-date">${escapeHtml(this.formatDate(som.date_ouverture))}</span>`);
        if (matiere && matiere !== 'Les deux') metaParts.push(`<span class="meta-matiere">${escapeHtml(matiere)}</span>`);
        if (matiere === 'Les deux') metaParts.push('<span class="meta-matiere">FR + HG</span>');
        const metaLine = metaParts.length > 0
            ? `<div class="card-meta">${metaParts.join('<span class="meta-sep">·</span>')}</div>`
            : '';

        // Sujet consultable ?
        const hasDoc = String(som.document_contenu || '').trim() !== '';
        const hasCorrige = String(som.correction_contenu || '').trim() !== '';
        const sujetVisibleAvance = som.sujet_visible === true || som.sujet_visible === 'true' || som.sujet_visible === 'TRUE';
        const hasContent = hasDoc || hasCorrige;

        // Status + action
        let statusHtml = '';
        let actionHtml = '';
        if (hasNote) {
            // État 4 : notée → lien vers review
            actionHtml = `<a href="evaluation.html?id=${som.id}&mode=review-som" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Voir le détail &#8594;</a>`;
        } else if (status === 'not_done' && hasContent) {
            // État 3 : terminée sans note, contenu dispo → lien review
            statusHtml = '<div class="card-action-info pending">En attente de correction</div>';
            actionHtml = `<a href="evaluation.html?id=${som.id}&mode=review-som" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Voir le détail &#8594;</a>`;
        } else if (status === 'not_done') {
            // État 3 : terminée sans note, pas de contenu
            statusHtml = '<div class="card-action-info pending">En attente de correction</div>';
        } else if (status === 'available' && hasDoc) {
            // État 2 : ouverte + sujet renseigné → consultable
            actionHtml = `<a href="evaluation.html?id=${som.id}&mode=sujet" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Consulter le sujet</a>`;
        } else if (status === 'upcoming' && hasDoc && sujetVisibleAvance) {
            // État 1 bis : planifiée mais sujet visible à l'avance
            actionHtml = `<a href="evaluation.html?id=${som.id}&mode=sujet" class="card-btn ${config.cssClass}" onclick="event.stopPropagation()">Consulter le sujet</a>`;
            statusHtml = '<span class="bonus-status sujet-avance" style="align-self:flex-start">Sujet consultable</span>';
        } else if (status === 'upcoming') {
            // État 1 : planifiée
            statusHtml = '<div class="card-action-info upcoming">À venir</div>';
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
                        ${statusHtml}
                    </div>
                    <div class="card-right">
                        ${badge}
                        ${actionHtml}
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
    /**
     * Formate une date de rendu avec label adapté au type.
     * date_butoir : "À rendre le Lun 10 mar" ou "À rendre le Lun 10 mar (avant 14h30)"
     * passage_classe : "Passage en classe le Lun 10 mar" ou "Passage en classe le Lun 10 mar à 14h30"
     */
    _formatDateRendu(dateStr, typeDate) {
        if (!dateStr) return '';
        const str = String(dateStr).trim();
        const dateOnly = this._formatDateOnly(str);
        const timeStr = this._extractTime(str);

        if (typeDate === 'date_butoir') {
            if (timeStr) return `À rendre le ${dateOnly} avant ${timeStr}`;
            return `À rendre le ${dateOnly}`;
        }
        // passage_classe
        if (timeStr) return `Passage en classe le ${dateOnly} à ${timeStr}`;
        return `Passage en classe le ${dateOnly}`;
    },

    /** Extrait la partie date formatée (sans heure) — format français complet */
    _formatDateOnly(dateStr) {
        const str = String(dateStr).trim();
        let date;
        // Format ISO : YYYY-MM-DD ou YYYY-MM-DDTHH:MM
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
            const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
            const parts = datePart.split('-');
            date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            // Fallback : format Google Sheets (ex: "10/03/2026 18:48:00")
            date = new Date(str);
        }
        if (isNaN(date.getTime())) return str;
        return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },

    /** Extrait l'heure formatée "14h30" — gère les formats ISO et Google Sheets */
    _extractTime(dateStr) {
        const str = String(dateStr).trim();
        let timePart = '';
        if (str.includes('T')) {
            // ISO : "2026-03-10T14:30"
            timePart = str.split('T')[1];
        } else if (str.includes(' ') && str.includes(':')) {
            // Google Sheets : "10/03/2026 18:48:00"
            const spaceIdx = str.indexOf(' ');
            timePart = str.substring(spaceIdx + 1);
        }
        if (!timePart) return '';
        const tParts = timePart.split(':');
        const h = parseInt(tParts[0]);
        const min = parseInt(tParts[1] || 0);
        if (isNaN(h)) return '';
        // Ne pas afficher minuit (00h00) — signifie souvent qu'aucune heure n'a été saisie
        if (h === 0 && min === 0) return '';
        return `${h}h${String(min).padStart(2, '0')}`;
    },

    /**
     * Formate une date pour affichage.
     * "2026-03-10" → "lundi 10 mars 2026"
     * "2026-03-10T14:30" → "lundi 10 mars 2026 à 14h30"
     */
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const str = String(dateStr).trim();
            const dateOnly = this._formatDateOnly(str);
            const timeStr = this._extractTime(str);
            if (timeStr) return `${dateOnly} à ${timeStr}`;
            return dateOnly;
        } catch (_e) { return dateStr; }
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
    },

    // ========== API ==========
    async callAPI(action, data = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        return new Promise((resolve, reject) => {
            const callbackName = 'eleveEvalsCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[callbackName] = (response) => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(response);
            };

            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            Object.keys(data).forEach(key => {
                url.searchParams.set(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
            });

            url.searchParams.set('callback', callbackName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    },

    _showToast(message) {
        const existing = document.querySelector('.eleve-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'eleve-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { EleveEvaluations.init(); }, 200);
});

window.EleveEvaluations = EleveEvaluations;
