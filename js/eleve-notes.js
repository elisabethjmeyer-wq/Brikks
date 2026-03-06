/**
 * Élève Notes - Page "Mes notes"
 * Affiche la note de progression, les points par catégorie, la moyenne pondérée,
 * les sommatives et l'objectif de l'élève.
 */

const EleveNotes = {
    // Data
    currentUser: null,
    evaluations: [],
    resultats: [],
    sommatives: [],
    resultatsSommatives: [],
    parametresNotes: [],
    objectifs: [],

    // State
    currentMatiere: 'FR',
    currentSemestre: null, // Auto-détecté depuis les dates de paramétrage

    // ========== INITIALIZATION ==========
    async init() {
        try {
            this.currentUser = await this._getCurrentUser();
            if (!this.currentUser) {
                this._showError('Impossible de récupérer ton identifiant');
                return;
            }

            await this._loadData();
            this._detectCurrentSemestre();
            this._setupEventListeners();
            this._render();
            this._showContent();
        } catch (error) {
            console.error('Erreur initialisation notes:', error);
            this._showError('Erreur lors du chargement');
        }
    },

    async _getCurrentUser() {
        if (typeof Auth !== 'undefined' && Auth.user) return Auth.user;
        const sessionUser = sessionStorage.getItem('brikks_user');
        if (sessionUser) {
            try { return JSON.parse(sessionUser); } catch (_e) { /* ignore */ }
        }
        const localUser = localStorage.getItem(CONFIG.STORAGE_KEYS.USER);
        if (localUser) {
            try { return JSON.parse(localUser); } catch (_e) { /* ignore */ }
        }
        return null;
    },

    async _loadData() {
        const [
            evaluationsData,
            resultatsData,
            sommativesData,
            resultatsSommativesData,
            parametresData,
            objectifsData
        ] = await Promise.all([
            SheetsAPI.getSheetData('EVALUATIONS').catch(() => []),
            SheetsAPI.getSheetData('EVALUATION_RESULTATS').catch(() => []),
            SheetsAPI.getSheetData('NOTES_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('RESULTATS_SOMMATIVES').catch(() => []),
            SheetsAPI.getSheetData('PARAMETRES_NOTES').catch(() => []),
            SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => [])
        ]);

        this.evaluations = SheetsAPI.parseSheetData(evaluationsData);
        this.resultats = SheetsAPI.parseSheetData(resultatsData);
        this.sommatives = SheetsAPI.parseSheetData(sommativesData);
        this.resultatsSommatives = SheetsAPI.parseSheetData(resultatsSommativesData);
        this.parametresNotes = SheetsAPI.parseSheetData(parametresData);
        this.objectifs = SheetsAPI.parseSheetData(objectifsData);
    },

    _showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('notes-content').style.display = 'block';
    },

    _showError(msg) {
        document.getElementById('loader').innerHTML = `
            <div style="text-align: center; padding: 60px 24px; color: #94a3b8;">
                <div style="font-size: 3rem; margin-bottom: 16px;">⚠️</div>
                <p>${escapeHtml(msg)}</p>
            </div>
        `;
    },

    /**
     * Détecte le semestre en cours à partir des dates de PARAMETRES_NOTES.
     * Fallback : semestre 1 si aucune date ne correspond.
     */
    _detectCurrentSemestre() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const p of this.parametresNotes) {
            const debut = p.date_debut ? new Date(p.date_debut) : null;
            const fin = p.date_fin ? new Date(p.date_fin) : null;
            if (debut && fin && today >= debut && today <= fin) {
                this.currentSemestre = String(p.semestre);
                break;
            }
        }
        // Fallback
        if (!this.currentSemestre) this.currentSemestre = '1';

        // Activer le bon bouton S1/S2
        document.querySelectorAll('.sem-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.semestre === this.currentSemestre);
        });
    },

    /**
     * Détermine le semestre d'une évaluation à partir de sa date.
     * Utilise date_ouverture ou date_debut de l'évaluation.
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

    // ========== EVENT LISTENERS ==========
    _setupEventListeners() {
        document.querySelectorAll('.matiere-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.matiere-tab').forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentMatiere = e.currentTarget.dataset.matiere;
                this._render();
            });
        });

        document.querySelectorAll('.sem-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sem-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentSemestre = e.currentTarget.dataset.semestre;
                this._render();
            });
        });
    },

    // ========== CALCULATION (same logic as admin) ==========
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
        const eleveId = this.currentUser.id;
        const cats = { connaissances: 0, 'savoir-faire': 0, competences: 0, bonus: 0 };

        const matchingEvals = this.evaluations.filter(ev => {
            const m = ev.matiere || '';
            if (m !== matiere && m !== 'Les deux') return false;
            // Filtrer par semestre
            return this._getSemestreForEval(ev) === String(semestre);
        });

        matchingEvals.forEach(ev => {
            const result = this.resultats.find(r =>
                String(r.evaluation_id).trim() === String(ev.id).trim() &&
                String(r.eleve_id).trim() === String(eleveId).trim()
            );
            if (result) {
                const validations = parseFloat(result.validations) || 0;
                const categorie = ev.categorie || ev.type || 'connaissances';
                if (cats[categorie] !== undefined) {
                    cats[categorie] += validations;
                }
            }
        });

        const total = cats.connaissances + cats['savoir-faire'] + cats.competences + cats.bonus;
        return { ...cats, total };
    },

    _calculateProgression(matiere, semestre) {
        const params = this._getParams(matiere, semestre);
        const points = this._calculatePoints(matiere, semestre);

        const ptsSansBonus = points.connaissances + points['savoir-faire'] + points.competences;
        const noteBase = params.noteDepart + (ptsSansBonus / params.budget) * 19.5;
        const noteAvecBonus = noteBase + points.bonus;
        const note = Math.min(20, Math.max(0, Math.round(noteAvecBonus * 100) / 100));

        return { note, noteDepart: params.noteDepart, budget: params.budget, ptsSansBonus, bonus: points.bonus, categories: points };
    },

    _getSommatives(matiere, semestre) {
        const eleveId = this.currentUser.id;
        return this.sommatives
            .filter(s => {
                const m = s.matiere || '';
                return (m === matiere || m === 'Les deux') && String(s.semestre || '1') === String(semestre);
            })
            .map(s => {
                const r = this.resultatsSommatives.find(res =>
                    String(res.sommative_id).trim() === String(s.id).trim() &&
                    String(res.eleve_id).trim() === String(eleveId).trim()
                );
                const note = r && r.note !== '' && r.note !== undefined ? parseFloat(r.note) : null;
                const bareme = parseFloat(s.bareme) || 20;
                const coefficient = parseFloat(s.coefficient) || 1;
                const note20 = note !== null ? (note / bareme) * 20 : null;
                return {
                    titre: s.titre || 'Sans titre',
                    date: s.date || '',
                    note, bareme, coefficient,
                    note20: note20 !== null ? Math.round(note20 * 100) / 100 : null
                };
            });
    },

    _calculateMoyenne(noteProg, coeffProg, sommatives) {
        let totalPts = noteProg * coeffProg;
        let totalCoefs = coeffProg;

        sommatives.forEach(s => {
            if (s.note20 !== null) {
                totalPts += s.note20 * s.coefficient;
                totalCoefs += s.coefficient;
            }
        });

        if (totalCoefs === 0) return null;
        return Math.round(Math.min(20, Math.max(0, totalPts / totalCoefs)) * 100) / 100;
    },

    // ========== RENDER ==========
    _render() {
        const mat = this.currentMatiere;
        const sem = this.currentSemestre;
        const params = this._getParams(mat, sem);

        // Progression
        const prog = this._calculateProgression(mat, sem);
        document.getElementById('noteSemester').textContent = 'S' + sem;
        document.getElementById('noteProgression').textContent = this._fmt(prog.note) + '/20';
        document.getElementById('noteFormula').textContent =
            `${prog.noteDepart} + (${prog.ptsSansBonus}/${prog.budget}) × 19.5` +
            (prog.bonus > 0 ? ` + ${prog.bonus}` : '') +
            ` = ${this._fmt(prog.note)}`;

        // Progress bar
        const pct = Math.min(100, Math.max(0, ((prog.note - prog.noteDepart) / (20 - prog.noteDepart)) * 100));
        document.getElementById('noteProgressFill').style.width = pct + '%';
        document.getElementById('noteProgressStart').textContent = prog.noteDepart;

        // Color the main note
        const mainCard = document.getElementById('mainNoteCard');
        mainCard.className = 'note-card main-note ' + this._noteColorClass(prog.note);

        // Points breakdown
        this._renderPoints(prog.categories, prog.budget);

        // Sommatives
        const soms = this._getSommatives(mat, sem);
        this._renderSommatives(soms);

        // Moyenne
        const moyenne = this._calculateMoyenne(prog.note, params.coeffProg, soms);
        this._renderMoyenne(prog.note, params.coeffProg, soms, moyenne);

        // Objectif
        this._renderObjectif(mat, sem);
    },

    _renderPoints(cats, budget) {
        const total = cats.total;
        const items = [
            { label: 'Connaissances', value: cats.connaissances, color: '#10b981' },
            { label: 'Savoir-faire', value: cats['savoir-faire'], color: '#f59e0b' },
            { label: 'Compétences', value: cats.competences, color: '#8b5cf6' },
            { label: 'Bonus', value: cats.bonus, color: '#eab308' }
        ];

        document.getElementById('pointsTotal').textContent = `${total} / ${budget}`;

        document.getElementById('pointsBars').innerHTML = items.map(item => {
            const pct = budget > 0 ? Math.min(100, (item.value / budget) * 100) : 0;
            return `
                <div class="points-bar-row">
                    <span class="points-bar-label">${item.label}</span>
                    <div class="points-bar-track">
                        <div class="points-bar-fill" style="width: ${pct}%; background: ${item.color}"></div>
                    </div>
                    <span class="points-bar-value">${item.value}</span>
                </div>
            `;
        }).join('');
    },

    _renderSommatives(soms) {
        const list = document.getElementById('sommativesList');
        if (soms.length === 0) {
            list.innerHTML = '<div class="empty-text">Aucune évaluation sommative pour ce semestre</div>';
            return;
        }

        list.innerHTML = soms.map(s => {
            const noteText = s.note !== null ? `${s.note}/${s.bareme}` : 'Pas encore de note';
            const noteClass = s.note20 !== null ? this._noteColorClass(s.note20) : 'note-pending';
            return `
                <div class="sommative-item">
                    <div class="sommative-info">
                        <span class="sommative-title">${escapeHtml(s.titre)}</span>
                        ${s.date ? `<span class="sommative-date">${s.date}</span>` : ''}
                    </div>
                    <div class="sommative-right">
                        <span class="sommative-note ${noteClass}">${noteText}</span>
                        <span class="sommative-coef">coef. ${s.coefficient}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    _renderMoyenne(noteProg, coeffProg, soms, moyenne) {
        document.getElementById('moyProgValue').textContent = this._fmt(noteProg) + '/20';
        document.getElementById('moyProgCoef').textContent = 'coef. ' + coeffProg;

        // Sommatives in moyenne
        const somContainer = document.getElementById('moyenneSommatives');
        const notedSoms = soms.filter(s => s.note20 !== null);
        if (notedSoms.length === 0) {
            somContainer.innerHTML = '<div class="moyenne-item"><div class="moyenne-label">Sommatives</div><div class="moyenne-value muted">—</div></div>';
        } else {
            somContainer.innerHTML = notedSoms.map((s, i) => `
                ${i > 0 ? '<div class="moyenne-separator">+</div>' : ''}
                <div class="moyenne-item">
                    <div class="moyenne-label">${escapeHtml(s.titre)}</div>
                    <div class="moyenne-value">${this._fmt(s.note20)}/20</div>
                    <div class="moyenne-coef">coef. ${s.coefficient}</div>
                </div>
            `).join('');
        }

        document.getElementById('moyenneValue').textContent =
            moyenne !== null ? this._fmt(moyenne) + '/20' : '—/20';
    },

    _renderObjectif(matiere, semestre) {
        const obj = this.objectifs.find(o =>
            String(o.eleve_id).trim() === String(this.currentUser.id).trim() &&
            o.matiere === matiere &&
            String(o.semestre) === String(semestre)
        );
        document.getElementById('objectifInput').value = obj ? obj.objectif_note : '';
    },

    // ========== SAVE OBJECTIF ==========
    async saveObjectif() {
        const value = parseFloat(document.getElementById('objectifInput').value);
        if (isNaN(value) || value < 0 || value > 20) return;

        const btn = document.getElementById('saveObjectifBtn');
        btn.disabled = true;
        btn.textContent = '...';

        try {
            const result = await this._callAPI('saveObjectifEleve', {
                eleve_id: this.currentUser.id,
                matiere: this.currentMatiere,
                semestre: this.currentSemestre,
                objectif_note: value
            });
            if (result.success) {
                btn.textContent = '✓';
                setTimeout(() => { btn.textContent = 'Enregistrer'; btn.disabled = false; }, 1500);
                // Update local data
                SheetsAPI.clearCache();
                const objData = await SheetsAPI.getSheetData('OBJECTIFS_ELEVES').catch(() => []);
                this.objectifs = SheetsAPI.parseSheetData(objData);
            } else {
                btn.textContent = 'Erreur';
                setTimeout(() => { btn.textContent = 'Enregistrer'; btn.disabled = false; }, 2000);
            }
        } catch (_e) {
            btn.textContent = 'Erreur';
            setTimeout(() => { btn.textContent = 'Enregistrer'; btn.disabled = false; }, 2000);
        }
    },

    // ========== HELPERS ==========
    _fmt(note) {
        if (note === null || note === undefined) return '—';
        return (Math.round(note * 10) / 10).toFixed(1);
    },

    _noteColorClass(note) {
        if (note >= 16) return 'note-excellent';
        if (note >= 12) return 'note-good';
        if (note >= 10) return 'note-ok';
        if (note >= 8) return 'note-warning';
        return 'note-danger';
    },

    async _callAPI(action, data = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        return new Promise((resolve, reject) => {
            const cbName = 'eleveNotesCallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const script = document.createElement('script');

            window[cbName] = (response) => {
                delete window[cbName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(response);
            };

            script.onerror = () => {
                delete window[cbName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

            Object.keys(data).forEach(key => {
                url.searchParams.set(key, typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key]);
            });

            url.searchParams.set('callback', cbName);
            script.src = url.toString();
            document.body.appendChild(script);

            setTimeout(() => {
                if (window[cbName]) {
                    delete window[cbName];
                    if (script.parentNode) document.body.removeChild(script);
                    reject(new Error('Timeout'));
                }
            }, 30000);
        });
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        EleveNotes.init();
    }, 100);
});

window.EleveNotes = EleveNotes;
