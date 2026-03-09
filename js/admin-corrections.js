/**
 * Admin Corrections — Correction des copies (compétences + bonus + TC)
 * Wizard 4 étapes : Informations → Correction → Critères → Bilan
 *
 * Sources :
 *  - EleveEntrainementsCompetences (statut='soumis') → entraînements compétences
 *  - EVALUATION_RESULTATS (demande_statut='accepte') → bonus comp, bonus ponctuel, TC
 */

const AdminCorrections = {

    // Données chargées
    submissions: [],       // Unified list (competence + bonus/TC)
    entrainements: [],     // EntrainementsCompetences
    banques: [],           // BanquesCompetences
    competences: [],       // CompetencesReferentiel
    criteres: [],          // CriteresReussite
    utilisateurs: [],      // UTILISATEURS
    evaluations: [],       // EVALUATIONS (bonus/TC)
    evalResultats: [],     // EVALUATION_RESULTATS (bonus/TC)

    // État du wizard
    currentTab: 'pending',
    currentStep: 1,
    currentSubmission: null,
    wizardData: {
        criteresValides: [],
        decision: null,
        correctionType: null,
        correctionValue: '',
        statutCorrection: 'publie'
    },

    _saving: false,
    _searchQuery: '',

    // ========== INITIALIZATION ==========

    async init() {
        try {
            await this.loadData();
            this.updateCounts();
            this.renderGrid();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation corrections:', error);
            this.showError('Erreur lors du chargement des corrections');
        }
    },

    // ========== DATA LOADING (SheetsAPI — cache localStorage) ==========

    async loadData() {
        var results = await Promise.all([
            SheetsAPI.fetchAndParse('EleveEntrainementsCompetences'),
            SheetsAPI.fetchAndParse('EntrainementsCompetences'),
            SheetsAPI.fetchAndParse('BanquesCompetences'),
            SheetsAPI.fetchAndParse('CompetencesReferentiel'),
            SheetsAPI.fetchAndParse('CriteresReussite'),
            SheetsAPI.fetchAndParse('UTILISATEURS'),
            SheetsAPI.fetchAndParse('EVALUATIONS'),
            SheetsAPI.fetchAndParse('EVALUATION_RESULTATS')
        ]);

        var eleveEntComp = results[0] || [];
        this.entrainements = results[1] || [];
        this.banques = results[2] || [];
        this.competences = results[3] || [];
        this.criteres = results[4] || [];
        this.utilisateurs = results[5] || [];
        this.evaluations = results[6] || [];
        this.evalResultats = results[7] || [];

        // Build unified submissions list
        this.submissions = this._buildUnifiedSubmissions(eleveEntComp);
    },

    /**
     * Merge competence training submissions + bonus/TC evaluation results
     * into a single list with a _sourceType field.
     */
    _buildUnifiedSubmissions(eleveEntComp) {
        var subs = [];
        var self = this;

        // 1. Competence training submissions (existing behavior)
        eleveEntComp.forEach(function(s) {
            if (s.statut === 'soumis' || s.statut === 'valide' || s.statut === 'non_valide') {
                s._sourceType = 'competence';
                s._sourceTable = 'EleveEntrainementsCompetences';
                subs.push(s);
            }
        });

        // 2. Bonus/TC evaluation results where demande_statut='accepte' (awaiting correction)
        //    or already corrected (demande_statut='corrige')
        this.evalResultats.forEach(function(r) {
            var ds = String(r.demande_statut || '').trim();
            if (ds !== 'accepte' && ds !== 'corrige') return;

            // Find the parent evaluation to determine type
            var evaluation = self.evaluations.find(function(ev) {
                return String(ev.id) === String(r.evaluation_id);
            });
            if (!evaluation) return;

            var evalType = String(evaluation.type || '').trim();
            var sousTypeBonus = String(evaluation.sous_type_bonus || '').trim();

            // Only include bonus comp, bonus ponctuel, and TC (competences)
            var sourceType = null;
            if (evalType === 'competences') {
                sourceType = 'tc';
            } else if (evalType === 'bonus' && sousTypeBonus === 'competence') {
                sourceType = 'bonus_comp';
            } else if (evalType === 'bonus' && sousTypeBonus === 'ponctuel') {
                sourceType = 'bonus_ponctuel';
            }
            // Skip suivi — no correction wizard for those
            if (!sourceType) return;

            // Map to unified submission shape
            var sub = {
                id: r.id || (r.eleve_id + '_eval_' + r.evaluation_id),
                eleve_id: r.eleve_id,
                evaluation_id: r.evaluation_id,
                date_soumission: r.date_demande || r.date_passage || '',
                date_correction: r.date_passage || '',
                correction_prof: r.correction_prof || '',
                criteres_valides: r.criteres_valides || '',
                statut_correction: r.statut_correction || '',
                competence_ids_validees: r.competence_ids_validees || '',
                _sourceType: sourceType,
                _sourceTable: 'EVALUATION_RESULTATS',
                _evaluation: evaluation,
                _evalResultat: r
            };

            // Map statut for pending vs done
            if (ds === 'accepte' && !r.correction_prof && !r.criteres_valides) {
                sub.statut = 'soumis'; // Awaiting correction
            } else if (ds === 'corrige') {
                // Check is_validated to determine valide/non_valide
                var isValid = r.is_validated === true || r.is_validated === 'true' || String(r.is_validated) === 'TRUE';
                sub.statut = isValid ? 'valide' : 'non_valide';
            } else {
                sub.statut = 'soumis';
            }

            subs.push(sub);
        });

        return subs;
    },

    callAPI(action, params) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var script = document.createElement('script');

            // Timeout de 30 secondes (les écritures peuvent être lentes)
            var timeout = setTimeout(function() {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Timeout: ' + action));
            }, 30000);

            window[callbackName] = function(response) {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            var queryParams = new URLSearchParams(Object.assign({ action: action, callback: callbackName }, params));
            script.src = CONFIG.WEBAPP_URL + '?' + queryParams.toString();
            script.onerror = function() {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('API call failed: ' + action));
            };

            document.body.appendChild(script);
        });
    },

    // ========== HELPERS ==========

    getEleve(eleveId) {
        return this.utilisateurs.find(function(u) { return String(u.id) === String(eleveId); });
    },

    getEntrainement(entrainementId) {
        return this.entrainements.find(function(e) { return String(e.id) === String(entrainementId); });
    },

    getCompetence(competenceId) {
        return this.competences.find(function(c) { return String(c.id) === String(competenceId); });
    },

    getCriteresByCompetence(competenceId) {
        return this.criteres
            .filter(function(c) { return String(c.competence_id) === String(competenceId); })
            .sort(function(a, b) { return (a.ordre || 0) - (b.ordre || 0); });
    },

    getCompetenceForEntrainement(entrainement) {
        if (!entrainement) return null;
        if (entrainement.banque_id) {
            var banque = this.banques.find(function(b) { return String(b.id) === String(entrainement.banque_id); });
            if (banque && banque.competence_id) return this.getCompetence(banque.competence_id);
        }
        if (entrainement.competence_id) return this.getCompetence(entrainement.competence_id);
        return null;
    },

    /** Get the evaluation object for a bonus/TC submission */
    getEvaluationForSub(sub) {
        if (sub._evaluation) return sub._evaluation;
        if (!sub.evaluation_id) return null;
        return this.evaluations.find(function(ev) { return String(ev.id) === String(sub.evaluation_id); });
    },

    /** Get the exercise (EntrainementsCompetences) linked to a bonus/TC evaluation */
    getExerciseForEvaluation(evaluation) {
        if (!evaluation) return null;
        var exId = evaluation.exercice_tc_id || evaluation.exercice_comp_id || evaluation.exercice_bonus_id || '';
        if (!exId) return null;
        return this.entrainements.find(function(e) { return String(e.id) === String(exId); });
    },

    /** Get competence IDs for a TC evaluation (multi-competence) */
    getCompetenceIdsForTC(evaluation) {
        if (!evaluation) return [];
        // Try competence_ids (JSON array) first
        if (evaluation.competence_ids) {
            try {
                var parsed = typeof evaluation.competence_ids === 'string' ?
                    JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
                if (Array.isArray(parsed)) return parsed.map(String);
            } catch (_e) { /* ignore */ }
        }
        // Fallback: get from the linked exercise
        var exercise = this.getExerciseForEvaluation(evaluation);
        if (exercise && exercise.competence_ids) {
            try {
                var parsed2 = typeof exercise.competence_ids === 'string' ?
                    JSON.parse(exercise.competence_ids) : exercise.competence_ids;
                if (Array.isArray(parsed2)) return parsed2.map(String);
            } catch (_e2) { /* ignore */ }
        }
        // Last fallback: single competence_id
        if (evaluation.competence_id) return [String(evaluation.competence_id)];
        return [];
    },

    /** Get critères libres for a bonus ponctuel exercise */
    getCriteresLibres(evaluation) {
        // Phase 9 : critères libres stockés directement dans EVALUATIONS
        var raw = evaluation ? evaluation.criteres_libres : '';
        if (raw) {
            try {
                var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (Array.isArray(parsed)) return parsed;
            } catch (_e) { /* ignore */ }
        }
        // Fallback : chercher dans l'exercice lié (anciennes évaluations)
        var exercise = this.getExerciseForEvaluation(evaluation);
        if (!exercise || !exercise.criteres_libres) return [];
        try {
            var parsed2 = typeof exercise.criteres_libres === 'string' ?
                JSON.parse(exercise.criteres_libres) : exercise.criteres_libres;
            if (Array.isArray(parsed2)) return parsed2;
        } catch (_e2) { /* ignore */ }
        return [];
    },

    /** Get display info for a submission (title, competence, type label) */
    getSubDisplayInfo(sub) {
        var info = { title: '', competence: '', typeLabel: '', typeBadgeClass: '' };

        if (sub._sourceType === 'competence') {
            var ent = this.getEntrainement(sub.entrainement_id);
            var comp = this.getCompetenceForEntrainement(ent);
            info.title = ent ? ent.titre : 'Entraînement inconnu';
            info.competence = comp ? comp.nom : '';
            info.typeLabel = 'Compétence';
            info.typeBadgeClass = 'badge-type-competence';
        } else {
            var evaluation = this.getEvaluationForSub(sub);
            info.title = evaluation ? evaluation.titre : 'Évaluation inconnue';

            if (sub._sourceType === 'tc') {
                info.typeLabel = 'Tâche complexe';
                info.typeBadgeClass = 'badge-type-tc';
                var compIds = this.getCompetenceIdsForTC(evaluation);
                if (compIds.length > 0) {
                    var self = this;
                    info.competence = compIds.map(function(cid) {
                        var c = self.getCompetence(cid);
                        return c ? c.nom : '';
                    }).filter(Boolean).join(', ');
                }
            } else if (sub._sourceType === 'bonus_comp') {
                info.typeLabel = 'Bonus compétence';
                info.typeBadgeClass = 'badge-type-bonus-comp';
                if (evaluation && evaluation.competence_id) {
                    var comp2 = this.getCompetence(evaluation.competence_id);
                    info.competence = comp2 ? comp2.nom : '';
                }
            } else if (sub._sourceType === 'bonus_ponctuel') {
                info.typeLabel = 'Bonus ponctuel';
                info.typeBadgeClass = 'badge-type-bonus-ponctuel';
            }
        }

        return info;
    },

    getPendingSubmissions() {
        return this.submissions
            .filter(function(s) { return s.statut === 'soumis'; })
            .sort(function(a, b) {
                return new Date(a.date_soumission || 0) - new Date(b.date_soumission || 0);
            });
    },

    getDoneSubmissions() {
        return this.submissions
            .filter(function(s) { return s.statut === 'valide' || s.statut === 'non_valide'; })
            .sort(function(a, b) {
                return new Date(b.date_correction || 0) - new Date(a.date_correction || 0);
            });
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    },

    formatDateLong(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    },

    formatTime(seconds) {
        if (!seconds) return '—';
        var s = parseInt(seconds, 10);
        if (s < 60) return s + 's';
        var min = Math.floor(s / 60);
        var sec = s % 60;
        return min + ' min' + (sec > 0 ? ' ' + sec + 's' : '');
    },

    getInitials(name) {
        if (!name) return '?';
        var parts = name.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return parts[0].substring(0, 2).toUpperCase();
    },

    getModeLabel(mode) {
        if (mode === 'papier') return '📄 Papier';
        if (mode === 'numerique') return '💻 Numérique';
        return '';
    },

    getEleveName(eleve) {
        if (!eleve) return 'Élève inconnu';
        var prenom = eleve.prenom || '';
        var nom = eleve.nom || '';
        if (prenom && nom) return prenom + ' ' + nom;
        return eleve.identifiant || 'Élève inconnu';
    },

    formatRelativeDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        var diffH = Math.floor(diffMs / 3600000);
        var diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return "À l'instant";
        if (diffMin < 60) return 'Il y a ' + diffMin + ' min';
        if (diffH < 24) return 'Il y a ' + diffH + 'h';
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
        return this.formatDate(dateStr);
    },

    _isOlderThan(dateStr, days) {
        if (!dateStr) return false;
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return (new Date() - d) > days * 86400000;
    },

    // ========== TABS ==========

    showTab(tab) {
        this.currentTab = tab;
        document.getElementById('togglePending').classList.toggle('active', tab === 'pending');
        document.getElementById('toggleDone').classList.toggle('active', tab === 'done');
        var bg = document.getElementById('segmentedBg');
        if (bg) bg.classList.toggle('right', tab === 'done');
        this.renderGrid();
    },

    updateCounts() {
        document.getElementById('pendingCount').textContent = this.getPendingSubmissions().length;
        document.getElementById('doneCount').textContent = this.getDoneSubmissions().length;
    },

    onSearch(query) {
        this._searchQuery = (query || '').trim().toLowerCase();
        this.renderGrid();
    },

    // ========== RENDER GRID ==========

    renderGrid() {
        var items = this.currentTab === 'pending' ? this.getPendingSubmissions() : this.getDoneSubmissions();
        var grid = document.getElementById('correctionsGrid');
        var empty = document.getElementById('emptyState');

        var self = this;
        if (this._searchQuery) {
            items = items.filter(function(s) {
                var eleve = self.getEleve(s.eleve_id);
                var name = self.getEleveName(eleve).toLowerCase();
                return name.indexOf(self._searchQuery) !== -1;
            });
        }

        if (items.length === 0) {
            grid.innerHTML = '';
            var isSearch = this._searchQuery.length > 0;
            document.getElementById('emptyIcon').textContent = isSearch ? '🔍' : (this.currentTab === 'pending' ? '✅' : '📂');
            document.getElementById('emptyMessage').textContent = isSearch
                ? 'Aucun résultat pour « ' + this._searchQuery + ' »'
                : (this.currentTab === 'pending'
                    ? 'Aucune copie à corriger pour le moment !'
                    : 'Aucune correction terminée.');
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = items.map(function(sub) {
            return self.renderCard(sub);
        }).join('');
    },

    renderCard(sub) {
        var eleve = this.getEleve(sub.eleve_id);
        var eleveName = this.getEleveName(eleve);
        var displayInfo = this.getSubDisplayInfo(sub);
        var isDone = sub.statut === 'valide' || sub.statut === 'non_valide';

        var subKey = sub.id || (sub.eleve_id + '_' + (sub.entrainement_id || sub.evaluation_id));

        var stripeClass = isDone ? ('stripe-' + sub.statut) : 'stripe-pending';

        var badgesHtml = '<div class="card-badges">';

        // Type badge (TC, bonus comp, bonus ponctuel, compétence)
        if (sub._sourceType !== 'competence') {
            badgesHtml += '<span class="card-badge ' + displayInfo.typeBadgeClass + '">' + displayInfo.typeLabel + '</span>';
        }

        if (displayInfo.competence) {
            badgesHtml += '<span class="card-badge badge-competence">' + escapeHtml(displayInfo.competence) + '</span>';
        }

        var modeLabel = this.getModeLabel(sub.mode_rendu);
        if (modeLabel) {
            var modeClass = sub.mode_rendu === 'papier' ? 'badge-papier' : 'badge-numerique';
            badgesHtml += '<span class="card-badge ' + modeClass + '">' + modeLabel + '</span>';
        }

        if (!isDone) {
            if (sub._sourceType !== 'competence') {
                badgesHtml += '<span class="card-badge badge-waiting">📝 À corriger</span>';
            } else if (sub.date_envoi) {
                var envoyeLabel = sub.mode_rendu === 'papier' ? '✅ Copie déposée' : '✅ Copie envoyée';
                badgesHtml += '<span class="card-badge badge-sent">' + envoyeLabel + '</span>';
            } else if (sub.mode_rendu === 'papier' || sub.mode_rendu === 'numerique') {
                badgesHtml += '<span class="card-badge badge-waiting">📄 Copie en attente</span>';
            } else {
                badgesHtml += '<span class="card-badge badge-waiting">⏳ Terminé</span>';
            }
        }

        badgesHtml += '</div>';

        var dateRef = isDone ? sub.date_correction : sub.date_soumission;
        var relativeDate = this.formatRelativeDate(dateRef);
        var isUrgent = !isDone && this._isOlderThan(sub.date_soumission, 2);

        var decisionHtml = '';
        if (isDone) {
            var isValide = sub.statut === 'valide';
            decisionHtml = '<span class="card-decision ' + sub.statut + '">' +
                (isValide ? '✅ Validé' : '❌ Non validé') + '</span>';
        }

        return '<div class="correction-card' + (isDone ? ' done' : '') + '" onclick="AdminCorrections.openModal(\'' + escapeHtml(subKey) + '\')">' +
            '<div class="card-stripe ' + stripeClass + '"></div>' +
            '<div class="card-body">' +
                '<div class="card-avatar">' + this.getInitials(eleveName) + '</div>' +
                '<div class="card-main">' +
                    '<div class="card-eleve">' + escapeHtml(eleveName) + '</div>' +
                    '<div class="card-entrainement">' + escapeHtml(displayInfo.title) + '</div>' +
                '</div>' +
                badgesHtml +
                '<div class="card-right">' +
                    '<span class="card-date' + (isUrgent ? ' urgent' : '') + '">' + relativeDate + '</span>' +
                    decisionHtml +
                '</div>' +
                '<span class="card-arrow">›</span>' +
            '</div>' +
        '</div>';
    },

    // ========== MODAL / WIZARD ==========

    openModal(subId) {
        var sub = this.submissions.find(function(s) {
            return String(s.id) === String(subId) ||
                   (s.eleve_id + '_' + s.entrainement_id) === subId ||
                   (s.eleve_id + '_eval_' + s.evaluation_id) === subId;
        });
        if (!sub) return;

        this.currentSubmission = sub;
        this.currentStep = 1;

        var existingCriteres = [];
        if (sub.criteres_valides) {
            try {
                existingCriteres = JSON.parse(sub.criteres_valides);
            } catch (_e) { /* ignore */ }
        }

        // For TC: parse competence_ids_validees (JSON object { compId: [critereIds] })
        var existingCompValidees = {};
        if (sub.competence_ids_validees) {
            try {
                existingCompValidees = JSON.parse(sub.competence_ids_validees);
            } catch (_e2) { /* ignore */ }
        }

        // Détecter le type de correction existante
        var corrType = null;
        var corrValue = '';
        if (sub.correction_prof) {
            var val = String(sub.correction_prof);
            if (val.startsWith('http')) {
                corrType = 'url';
                corrValue = val;
            } else {
                corrType = 'blocks';
                corrValue = val;
            }
        }

        // Score existant (points attribués lors d'une correction précédente)
        var existingScore = sub._evalResultat ? parseFloat(sub._evalResultat.score) : undefined;
        if (isNaN(existingScore)) existingScore = undefined;

        // Points par compétence existants (reprise de correction)
        var existingPpc = {};
        if (sub._evalResultat && sub._evalResultat.points_par_competence) {
            try {
                existingPpc = typeof sub._evalResultat.points_par_competence === 'string' ?
                    JSON.parse(sub._evalResultat.points_par_competence) : sub._evalResultat.points_par_competence;
            } catch (_e) { /* ignore */ }
        }

        this.wizardData = {
            criteresValides: Array.isArray(existingCriteres) ? existingCriteres.map(String) : [],
            competenceValidees: existingCompValidees, // TC: { compId: [critereIds] }
            decision: (sub.statut === 'valide' || sub.statut === 'non_valide') ? sub.statut : null,
            correctionType: corrType,
            correctionValue: corrValue,
            statutCorrection: sub.statut_correction || 'publie',
            score: existingScore,
            pointsParCompetence: existingPpc
        };

        this._wizardDirty = false;
        this.updateModalTitle();
        this.renderStep();
        this.updateWizardIndicators();
        document.getElementById('correctionModal').classList.remove('hidden');
        this._addBeforeUnload();
    },

    closeModal() {
        document.getElementById('correctionModal').classList.add('hidden');
        this.currentSubmission = null;
        this._wizardDirty = false;
        this._removeBeforeUnload();
    },

    _beforeUnloadHandler: null,

    _addBeforeUnload() {
        this._removeBeforeUnload();
        this._beforeUnloadHandler = function(e) {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    },

    _removeBeforeUnload() {
        if (this._beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this._beforeUnloadHandler);
            this._beforeUnloadHandler = null;
        }
    },

    updateModalTitle() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var displayInfo = this.getSubDisplayInfo(sub);
        var title = this.getEleveName(eleve) + ' — ' + displayInfo.title;
        document.getElementById('correctionModalTitle').textContent = title;
    },

    goToStep(step) {
        if (this.currentStep === 2) {
            this._saveStep2State();
        }
        this.currentStep = step;
        this.renderStep();
        this.updateWizardIndicators();
    },

    updateWizardIndicators() {
        var self = this;
        document.querySelectorAll('.wizard-step').forEach(function(el) {
            var stepNum = parseInt(el.dataset.step, 10);
            el.classList.remove('active', 'completed');
            if (stepNum === self.currentStep) {
                el.classList.add('active');
            } else if (stepNum < self.currentStep) {
                el.classList.add('completed');
            }
        });
    },

    renderStep() {
        var body = document.getElementById('correctionModalBody');
        var footer = document.getElementById('correctionModalFooter');

        if (this.currentStep === 1) {
            body.innerHTML = this.renderStep1();
            footer.innerHTML = this.renderFooter1();
        } else if (this.currentStep === 2) {
            body.innerHTML = this.renderStep2();
            footer.innerHTML = this.renderFooter2();
            this._initStep2();
        } else if (this.currentStep === 3) {
            body.innerHTML = this.renderStep3();
            footer.innerHTML = this.renderFooter3();
        } else if (this.currentStep === 4) {
            body.innerHTML = this.renderStep4();
            footer.innerHTML = this.renderFooter4();
        }
    },

    // ========== ÉTAPE 1 — INFORMATIONS ==========

    renderStep1() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var displayInfo = this.getSubDisplayInfo(sub);

        var html = '<div class="info-grid">';
        html += this._infoItem('👤', 'Élève', this.getEleveName(eleve));

        if (sub._sourceType !== 'competence') {
            // Bonus/TC: show type + evaluation title
            html += this._infoItem('🏷', 'Type', displayInfo.typeLabel);
            html += this._infoItem('📝', 'Évaluation', displayInfo.title);
            if (displayInfo.competence) {
                html += this._infoItem('🎯', sub._sourceType === 'tc' ? 'Compétences' : 'Compétence', displayInfo.competence);
            }
            html += this._infoItem('📅', 'Date demande', this.formatDateLong(sub.date_soumission));
        } else {
            // Competence training (existing)
            html += this._infoItem('📅', 'Soumis le', this.formatDateLong(sub.date_soumission));
            html += this._infoItem('⏱', 'Temps passé', this.formatTime(sub.temps_passe));
            html += this._infoItem('📄', 'Mode de rendu', this.getModeLabel(sub.mode_rendu) || '—');
            html += this._infoItem('🎯', 'Compétence', displayInfo.competence || '—');
            html += this._infoItem('📝', 'Exercice', displayInfo.title);
        }
        html += '</div>';

        // Statut brouillon / publié
        var isPublie = sub.statut_correction !== 'brouillon';
        html += '<div class="statut-toggle-section">';
        html += '<label class="statut-toggle-label">Visibilité pour l\'élève</label>';
        html += '<div class="statut-toggle">';
        html += '<button type="button" class="statut-btn' + (!isPublie ? ' active brouillon' : '') + '" data-statut="brouillon" onclick="AdminCorrections._setStatutCorrection(\'brouillon\')">🔒 Brouillon</button>';
        html += '<button type="button" class="statut-btn' + (isPublie ? ' active publie' : '') + '" data-statut="publie" onclick="AdminCorrections._setStatutCorrection(\'publie\')">👁 Publié</button>';
        html += '</div>';
        html += '<div class="statut-help">' + (isPublie ? 'L\'élève verra la correction' : 'L\'élève ne verra pas la correction') + '</div>';
        html += '</div>';

        return html;
    },

    _infoItem(icon, label, value) {
        return '<div class="info-item">' +
            '<span class="info-icon">' + icon + '</span>' +
            '<div><div class="info-label">' + label + '</div>' +
            '<div class="info-value">' + escapeHtml(value) + '</div></div>' +
        '</div>';
    },

    _setStatutCorrection(statut) {
        this.wizardData.statutCorrection = statut;
        var btns = document.querySelectorAll('.statut-btn');
        btns.forEach(function(btn) {
            var isActive = btn.dataset.statut === statut;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('brouillon', isActive && statut === 'brouillon');
            btn.classList.toggle('publie', isActive && statut === 'publie');
        });
        var help = document.querySelector('.statut-help');
        if (help) help.textContent = statut === 'publie' ? 'L\'élève verra la correction' : 'L\'élève ne verra pas la correction';
    },

    renderFooter1() {
        return '<div class="footer-left"></div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.goToStep(2)">Suivant →</button>' +
            '</div>';
    },

    // ========== ÉTAPE 2 — CORRECTION (block editor uniquement) ==========

    renderStep2() {
        var wd = this.wizardData;

        // Détecter le mode corrigé
        var hasCorrectionBlocks = wd.correctionType === 'blocks' && wd.correctionValue;
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        var html = '';

        // Corrigé commenté — header
        html += '<div class="step-header">';
        html += '<span class="step-icon">📝</span>';
        html += '<div><h3>Corrigé commenté</h3>';
        html += '<p>Construisez le corrigé que l\'élève verra (optionnel)</p></div>';
        html += '</div>';

        // Source toggle (Lien Google Doc / Éditeur) — pill style
        html += '<div class="source-toggle" id="correctionToggle">';
        html += '<button type="button" class="source-toggle-btn' + (corrMode === 'url' ? ' active' : '') + '" data-mode="url" onclick="AdminCorrections._switchCorrectionMode(\'url\')">Lien Google Doc</button>';
        html += '<button type="button" class="source-toggle-btn' + (corrMode === 'editor' ? ' active' : '') + '" data-mode="editor" onclick="AdminCorrections._switchCorrectionMode(\'editor\')">Éditeur</button>';
        html += '</div>';

        // Panel URL
        html += '<div class="source-panel" id="correctionUrlPanel"' + (corrMode !== 'url' ? ' style="display:none"' : '') + '>';
        html += '<div class="form-group">';
        html += '<label>Lien Google Doc du corrigé</label>';
        html += '<input type="text" class="form-input" id="correctionUrlInput" placeholder="https://docs.google.com/document/d/..." value="' + escapeHtml(wd.correctionType === 'url' ? wd.correctionValue : '') + '">';
        html += '<div class="form-help">Collez le lien de partage du Google Doc (doit être accessible en lecture)</div>';
        html += '</div>';
        html += '</div>';

        // Panel Éditeur (block editor avec tabs Construction / Vue élève)
        html += '<div class="source-panel" id="correctionEditorPanel"' + (corrMode !== 'editor' ? ' style="display:none"' : '') + '>';

        // Tabs Construction / Vue élève
        html += '<div class="tb-tabs">';
        html += '<button type="button" class="tb-tab active" id="corrTabConstruction" onclick="AdminCorrections._switchEditorTab(\'construction\')">';
        html += '<span class="tb-tab-icon">⚙️</span> Construction</button>';
        html += '<button type="button" class="tb-tab" id="corrTabPreview" onclick="AdminCorrections._switchEditorTab(\'preview\')">';
        html += '<span class="tb-tab-icon">👁</span> Vue élève</button>';
        html += '</div>';

        // Construction panel
        html += '<div id="corrConstructionPanel">';
        html += '<div id="corrBlockEditorContainer" class="block-editor"></div>';
        html += this.renderBlockAddBar();
        html += '</div>';

        // Preview panel
        html += '<div id="corrPreviewPanel" class="tb-preview-panel" style="display:none;">';
        html += '<div id="corrPreviewContainer" class="cw-preview-frame">';
        html += '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\'aperçu</div>';
        html += '</div>';
        html += '</div>';

        html += '</div>'; // fin source-panel éditeur

        return html;
    },

    // ========== INITIALISATION ÉTAPE 2 ==========

    _initStep2() {
        // Détecter le mode corrigé
        var wd = this.wizardData;
        var hasCorrectionBlocks = wd.correctionType === 'blocks' && wd.correctionValue;
        var corrMode = hasCorrectionBlocks ? 'editor' : 'url';

        if (corrMode === 'editor') {
            this._initCorrectionBlockEditor();
        }
    },

    _initCorrectionBlockEditor() {
        this._blockEditorContainerId = 'corrBlockEditorContainer';

        var blocks = null;
        var wd = this.wizardData;
        if (wd.correctionType === 'blocks' && wd.correctionValue) {
            try {
                var parsed = JSON.parse(wd.correctionValue);
                if (Array.isArray(parsed)) blocks = parsed;
            } catch (_err) {
                // HTML brut → convertir en un bloc texte
                blocks = [{ type: 'text', content: wd.correctionValue }];
            }
        }

        this.initBlockEditor(blocks);
    },

    _switchCorrectionMode(mode) {
        var toggle = document.getElementById('correctionToggle');
        if (!toggle) return;

        toggle.querySelectorAll('.source-toggle-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        var urlPanel = document.getElementById('correctionUrlPanel');
        var editorPanel = document.getElementById('correctionEditorPanel');
        if (urlPanel) urlPanel.style.display = mode === 'url' ? '' : 'none';
        if (editorPanel) editorPanel.style.display = mode === 'editor' ? '' : 'none';

        // Si on bascule vers l'éditeur et qu'il n'est pas encore initialisé
        if (mode === 'editor') {
            var container = document.getElementById('corrBlockEditorContainer');
            if (container && !container.hasChildNodes()) {
                this._initCorrectionBlockEditor();
            }
        }
    },

    _switchEditorTab(tab) {
        var constructionPanel = document.getElementById('corrConstructionPanel');
        var previewPanel = document.getElementById('corrPreviewPanel');
        var constructionTab = document.getElementById('corrTabConstruction');
        var previewTab = document.getElementById('corrTabPreview');

        if (tab === 'construction') {
            if (constructionPanel) constructionPanel.style.display = '';
            if (previewPanel) previewPanel.style.display = 'none';
            if (constructionTab) constructionTab.classList.add('active');
            if (previewTab) previewTab.classList.remove('active');
        } else {
            // Sauver l'état et générer l'aperçu
            this._saveEditorsState();
            var blocksJson = this.getBlocksJSON();
            var previewContainer = document.getElementById('corrPreviewContainer');
            if (previewContainer) {
                if (blocksJson) {
                    previewContainer.innerHTML = this._renderBlocksPreview(JSON.parse(blocksJson));
                } else {
                    previewContainer.innerHTML = '<div class="cw-preview-empty">Ajoutez du contenu pour voir l\'aperçu</div>';
                }
            }
            if (constructionPanel) constructionPanel.style.display = 'none';
            if (previewPanel) previewPanel.style.display = '';
            if (constructionTab) constructionTab.classList.remove('active');
            if (previewTab) previewTab.classList.add('active');
        }
    },

    /** Rendu de l'aperçu des blocs (vue élève) */
    _renderBlocksPreview(blocks) {
        if (!blocks || blocks.length === 0) {
            return '<div class="cw-preview-empty">Aucun contenu</div>';
        }
        var self = this;
        var html = '';
        blocks.forEach(function(block) {
            html += self._renderBlockPreview(block);
        });
        return html;
    },

    _renderBlockPreview(block) {
        if (block.type === 'text') {
            var h = '<div class="preview-block preview-text">' + (block.content || '') + '</div>';
            if (block.legende) h += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            return h;
        }
        if (block.type === 'document') {
            var embedUrl = block.url || '';
            var h2 = '';
            if (block.titre) h2 += '<div class="preview-doc-titre">' + escapeHtml(block.titre) + '</div>';
            if (embedUrl) h2 += '<iframe src="' + escapeHtml(embedUrl) + '" class="preview-doc-iframe"></iframe>';
            if (block.legende) h2 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            return '<div class="preview-block preview-document">' + h2 + '</div>';
        }
        if (block.type === 'image') {
            var imgSrc = this._convertToDirectImageUrl(block.url || '');
            var h3 = '<div class="preview-block preview-image">';
            h3 += '<img src="' + escapeHtml(imgSrc) + '" alt="Image">';
            if (block.legende) h3 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            h3 += '</div>';
            return h3;
        }
        if (block.type === 'video') {
            var videoUrl = block.url || '';
            var ytMatch = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            var h4 = '<div class="preview-block preview-video">';
            if (ytMatch) {
                h4 += '<iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '" width="100%" height="315" frameborder="0" allowfullscreen></iframe>';
            } else {
                h4 += '<a href="' + escapeHtml(videoUrl) + '" target="_blank">' + escapeHtml(videoUrl) + '</a>';
            }
            if (block.legende) h4 += '<div class="preview-legende">' + this._formatLegende(block.legende) + '</div>';
            h4 += '</div>';
            return h4;
        }
        if (block.type === 'group' && block.children) {
            var ratio = block.ratio || '50-50';
            var parts = ratio.split('-');
            var self = this;
            var h5 = '<div class="preview-block preview-group" style="display:flex;gap:16px">';
            block.children.forEach(function(child, idx) {
                var flex = parseInt(parts[idx] || 50);
                h5 += '<div style="flex:' + flex + '">' + self._renderBlockPreview(child) + '</div>';
            });
            h5 += '</div>';
            return h5;
        }
        return '';
    },

    _formatLegende(text) {
        if (!text) return '';
        return escapeHtml(text).replace(/\*([^*]+)\*/g, '<em>$1</em>');
    },

    // ========== SAUVEGARDE ÉTAT ÉTAPE 2 ==========

    _saveStep2State() {
        var toggle = document.getElementById('correctionToggle');
        if (!toggle) return;
        var activeBtn = toggle.querySelector('.source-toggle-btn.active');
        var mode = activeBtn ? activeBtn.dataset.mode : 'url';

        if (mode === 'editor') {
            this._saveEditorsState();
            var blocksJson = this.getBlocksJSON();
            this.wizardData.correctionType = blocksJson ? 'blocks' : null;
            this.wizardData.correctionValue = blocksJson || '';
        } else {
            var urlInput = document.getElementById('correctionUrlInput');
            var val = urlInput ? urlInput.value.trim() : '';
            this.wizardData.correctionType = val ? 'url' : null;
            this.wizardData.correctionValue = val;
        }

    },

    // ========== ACTIONS ÉTAPE 2 ==========

    renderFooter2() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(1)">← Précédent</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.goToStep(3)">Suivant →</button>' +
            '</div>';
    },

    // ========== ÉTAPE 3 — CRITÈRES + DÉCISION ==========

    renderStep3() {
        var sub = this.currentSubmission;
        var wd = this.wizardData;

        var html = '';

        // Header
        html += '<div class="step-header">';
        html += '<span class="step-icon">✅</span>';
        html += '<div><h3>Critères de réussite</h3>';
        html += '<p>Cochez les critères validés par l\'élève</p></div>';
        html += '</div>';

        if (sub._sourceType === 'tc') {
            // TC: multiple competences, each with its own critères
            html += this._renderStep3TC();
        } else if (sub._sourceType === 'bonus_ponctuel') {
            // Bonus ponctuel: critères libres
            html += this._renderStep3BonusPonctuel();
        } else {
            // Competence training OR bonus comp: single competence critères
            html += this._renderStep3SingleCompetence();
        }

        // Décision
        html += '<div class="decision-section">';
        html += '<h4>Décision</h4>';
        html += '<div class="decision-buttons">';
        html += '<button class="btn-decision btn-non-valide' + (wd.decision === 'non_valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'non_valide\')">❌ Non validé</button>';
        html += '<button class="btn-decision btn-valide' + (wd.decision === 'valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'valide\')">✅ Validé</button>';
        html += '</div></div>';

        return html;
    },

    /** Step 3 for competence training + bonus compétence (single competence) */
    _renderStep3SingleCompetence() {
        var sub = this.currentSubmission;
        var wd = this.wizardData;
        var competenceId = null;
        var evaluation = null;

        if (sub._sourceType === 'bonus_comp') {
            evaluation = this.getEvaluationForSub(sub);
            competenceId = evaluation ? evaluation.competence_id : null;
            // Try competence_ids if competence_id not set
            if (!competenceId && evaluation && evaluation.competence_ids) {
                try {
                    var parsed = typeof evaluation.competence_ids === 'string' ? JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
                    if (Array.isArray(parsed) && parsed.length > 0) competenceId = parsed[0];
                } catch (_e) { /* ignore */ }
            }
        } else {
            var entrainement = this.getEntrainement(sub.entrainement_id);
            var competence = this.getCompetenceForEntrainement(entrainement);
            competenceId = competence ? competence.id : null;
        }

        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];

        if (criteres.length > 0) {
            var html = '';

            // For bonus_comp: show competency header with points + matière
            if (sub._sourceType === 'bonus_comp' && evaluation && competenceId) {
                var ptsMap = this._getCompPointsMap(evaluation);
                var info = ptsMap[String(competenceId)];
                if (info) {
                    var allChecked = criteres.every(function(c) { return wd.criteresValides.indexOf(String(c.id)) !== -1; });
                    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
                    html += '<span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:' + info.color + '20;color:' + info.color + ';font-weight:600;white-space:nowrap;">' + info.pts + ' pt' + (info.pts > 1 ? 's' : '') + ' · ' + escapeHtml(info.label) + '</span>';
                    html += '<span class="comp-valid-badge" id="compBadge_single" style="font-size:0.75rem;padding:2px 8px;border-radius:4px;font-weight:600;white-space:nowrap;' +
                        (allChecked ? 'background:#dcfce7;color:#16a34a;">' + '✅ Validée' : 'background:#fee2e2;color:#dc2626;">' + '❌ Non validée') + '</span>';
                    html += '</div>';
                }
            }

            html += '<div class="criteres-correction-list">';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="critere-check' + (checked ? ' checked' : '') + '" onclick="AdminCorrections.toggleCritere(\'' + c.id + '\', this)">';
                html += '<input type="checkbox" id="critere_' + c.id + '"' + (checked ? ' checked' : '') + '>';
                html += '<label for="critere_' + c.id + '">' + escapeHtml(c.libelle) + '</label>';
                html += '</div>';
            });
            html += '</div>';
            return html;
        }
        return '<div class="empty-criteres">Aucun critère défini pour cette compétence.</div>';
    },

    /** Retourne les points par compétence pour une évaluation TC ou bonus comp */
    _getCompPointsMap(evaluation) {
        var matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
        var matiereLabels = { 'FR': 'FR', 'HG-EMC': 'HG-EMC', 'Transversal': 'Trans.' };

        var evalPpc = {};
        if (evaluation && evaluation.points_par_competence) {
            try {
                evalPpc = typeof evaluation.points_par_competence === 'string' ? JSON.parse(evaluation.points_par_competence) : evaluation.points_par_competence;
            } catch (_e) { /* ignore */ }
        }
        var hasEvalPpc = Object.keys(evalPpc).length > 0;

        var compIds = this.getCompetenceIdsForTC(evaluation);
        // Bonus comp: single comp from competence_ids or competence_id
        if (compIds.length === 0 && evaluation) {
            if (evaluation.competence_ids) {
                try {
                    var parsed = typeof evaluation.competence_ids === 'string' ? JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
                    if (Array.isArray(parsed) && parsed.length > 0) compIds = parsed.map(String);
                } catch (_e) { /* ignore */ }
            }
            if (compIds.length === 0 && evaluation.competence_id) {
                compIds = [String(evaluation.competence_id)];
            }
        }

        var totalBriques = parseFloat(evaluation ? evaluation.briques : 0) || 0;
        var fallbackPerComp = compIds.length > 0 ? totalBriques / compIds.length : 1;
        var self = this;
        var map = {};

        compIds.forEach(function(compId) {
            var comp = self.getCompetence(compId);
            var compMat = comp ? (comp.matiere || 'Transversal') : 'Transversal';
            var pts = hasEvalPpc ? (parseFloat(evalPpc[String(compId)]) || 1) : (fallbackPerComp || 1);
            map[String(compId)] = {
                pts: pts,
                matiere: compMat,
                color: matiereColors[compMat] || '#6b7280',
                label: matiereLabels[compMat] || compMat
            };
        });
        return map;
    },

    /** Step 3 for TC: grouped by competence */
    _renderStep3TC() {
        var sub = this.currentSubmission;
        var wd = this.wizardData;
        var evaluation = this.getEvaluationForSub(sub);
        var compIds = this.getCompetenceIdsForTC(evaluation);

        if (compIds.length === 0) {
            return '<div class="empty-criteres">Aucune compétence associée à cette tâche complexe.</div>';
        }

        // Initialize competenceValidees if empty
        if (!wd.competenceValidees || typeof wd.competenceValidees !== 'object') {
            wd.competenceValidees = {};
        }

        var self = this;
        var ptsMap = this._getCompPointsMap(evaluation);
        var html = '';

        compIds.forEach(function(compId) {
            var comp = self.getCompetence(compId);
            var criteres = self.getCriteresByCompetence(compId);
            var compValides = wd.competenceValidees[compId] || [];
            var allValid = criteres.length > 0 && criteres.every(function(c) { return compValides.indexOf(String(c.id)) !== -1; });
            var info = ptsMap[String(compId)] || { pts: 1, matiere: 'Transversal', color: '#6b7280', label: 'Trans.' };

            html += '<div class="tc-competence-section" data-comp-id="' + compId + '">';
            html += '<div class="tc-comp-header" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
            html += '<span class="tc-comp-icon">🎯</span>';
            html += '<h4 style="flex:1;margin:0;">' + escapeHtml(comp ? comp.nom : 'Compétence inconnue') + '</h4>';
            // Points + matière tag
            html += '<span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:' + info.color + '20;color:' + info.color + ';font-weight:600;white-space:nowrap;">' + info.pts + ' pt' + (info.pts > 1 ? 's' : '') + ' · ' + escapeHtml(info.label) + '</span>';
            // Validation badge
            html += '<span class="comp-valid-badge" id="compBadge_' + compId + '" style="font-size:0.75rem;padding:2px 8px;border-radius:4px;font-weight:600;white-space:nowrap;' +
                (allValid ? 'background:#dcfce7;color:#16a34a;">' + '✅ Validée' : 'background:#fee2e2;color:#dc2626;">' + '❌ Non validée') + '</span>';
            html += '</div>';

            if (criteres.length > 0) {
                html += '<div class="criteres-correction-list">';
                criteres.forEach(function(c) {
                    var checked = compValides.indexOf(String(c.id)) !== -1;
                    html += '<div class="critere-check' + (checked ? ' checked' : '') + '" onclick="AdminCorrections.toggleCritereTC(\'' + compId + '\', \'' + c.id + '\', this)">';
                    html += '<input type="checkbox"' + (checked ? ' checked' : '') + '>';
                    html += '<label>' + escapeHtml(c.libelle) + '</label>';
                    html += '</div>';
                });
                html += '</div>';
            } else {
                html += '<div class="empty-criteres">Aucun critère défini.</div>';
            }

            html += '</div>';
        });

        return html;
    },

    /** Step 3 for bonus ponctuel: critères libres */
    _renderStep3BonusPonctuel() {
        var sub = this.currentSubmission;
        var wd = this.wizardData;
        var evaluation = this.getEvaluationForSub(sub);
        var criteresLibres = this.getCriteresLibres(evaluation);

        if (criteresLibres.length === 0) {
            return '<div class="empty-criteres">Aucun critère libre défini pour cette évaluation.</div>';
        }

        var html = '<div class="criteres-correction-list">';
        criteresLibres.forEach(function(label, idx) {
            var critId = 'libre_' + idx;
            var checked = wd.criteresValides.indexOf(critId) !== -1;
            html += '<div class="critere-check' + (checked ? ' checked' : '') + '" onclick="AdminCorrections.toggleCritere(\'' + critId + '\', this)">';
            html += '<input type="checkbox" id="critere_' + critId + '"' + (checked ? ' checked' : '') + '>';
            html += '<label for="critere_' + critId + '">' + escapeHtml(label) + '</label>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    },

    /** Toggle critère for TC (per competence) */
    toggleCritereTC(compId, critereId, el) {
        var wd = this.wizardData;
        if (!wd.competenceValidees) wd.competenceValidees = {};
        if (!wd.competenceValidees[compId]) wd.competenceValidees[compId] = [];

        var list = wd.competenceValidees[compId];
        var idx = list.indexOf(String(critereId));
        if (idx === -1) {
            list.push(String(critereId));
            el.classList.add('checked');
            el.querySelector('input').checked = true;
        } else {
            list.splice(idx, 1);
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
        }

        // Update validation badge
        var criteres = this.getCriteresByCompetence(compId);
        var allValid = criteres.length > 0 && criteres.every(function(c) { return list.indexOf(String(c.id)) !== -1; });
        var badge = document.getElementById('compBadge_' + compId);
        if (badge) {
            badge.innerHTML = allValid ? '✅ Validée' : '❌ Non validée';
            badge.style.background = allValid ? '#dcfce7' : '#fee2e2';
            badge.style.color = allValid ? '#16a34a' : '#dc2626';
        }
    },

    toggleCritere(critereId, el) {
        var idx = this.wizardData.criteresValides.indexOf(String(critereId));
        if (idx === -1) {
            this.wizardData.criteresValides.push(String(critereId));
            el.classList.add('checked');
            el.querySelector('input').checked = true;
        } else {
            this.wizardData.criteresValides.splice(idx, 1);
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
        }

        // Update bonus_comp validation badge if present
        var sub = this.currentSubmission;
        if (sub && sub._sourceType === 'bonus_comp') {
            var badge = document.getElementById('compBadge_single');
            if (badge) {
                var evaluation = this.getEvaluationForSub(sub);
                var competenceId = evaluation ? evaluation.competence_id : null;
                if (!competenceId && evaluation && evaluation.competence_ids) {
                    try {
                        var parsed = typeof evaluation.competence_ids === 'string' ? JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
                        if (Array.isArray(parsed) && parsed.length > 0) competenceId = parsed[0];
                    } catch (_e) { /* ignore */ }
                }
                if (competenceId) {
                    var criteres = this.getCriteresByCompetence(competenceId);
                    var wd = this.wizardData;
                    var allValid = criteres.length > 0 && criteres.every(function(c) { return wd.criteresValides.indexOf(String(c.id)) !== -1; });
                    badge.innerHTML = allValid ? '✅ Validée' : '❌ Non validée';
                    badge.style.background = allValid ? '#dcfce7' : '#fee2e2';
                    badge.style.color = allValid ? '#16a34a' : '#dc2626';
                }
            }
        }
    },

    setDecision(decision) {
        this.wizardData.decision = decision;
        document.querySelectorAll('.btn-decision').forEach(function(btn) {
            btn.classList.remove('selected');
        });
        var selector = decision === 'valide' ? '.btn-valide' : '.btn-non-valide';
        var btn = document.querySelector(selector);
        if (btn) btn.classList.add('selected');
    },

    renderFooter3() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(2)">← Précédent</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.validateStep3()">Suivant →</button>' +
            '</div>';
    },

    validateStep3() {
        if (!this.wizardData.decision) {
            this.showNotification('Veuillez choisir une décision (validé ou non validé).', 'error');
            return;
        }
        this.goToStep(4);
    },

    // ========== ÉTAPE 4 — BILAN ==========

    renderStep4() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var displayInfo = this.getSubDisplayInfo(sub);
        var wd = this.wizardData;

        var html = '';

        html += '<div class="bilan-section">';
        html += '<h4>Élève</h4>';
        html += '<div class="bilan-value">' + escapeHtml(this.getEleveName(eleve)) + '</div>';
        html += '</div>';

        html += '<div class="bilan-section">';
        html += '<h4>' + (sub._sourceType === 'competence' ? 'Entraînement' : 'Évaluation') + '</h4>';
        html += '<div class="bilan-value">' + escapeHtml(displayInfo.title) + '</div>';
        if (sub._sourceType !== 'competence') {
            html += '<div class="bilan-type-badge ' + displayInfo.typeBadgeClass + '">' + displayInfo.typeLabel + '</div>';
        }
        html += '</div>';

        // Décision
        html += '<div class="bilan-section">';
        html += '<h4>Décision</h4>';
        var isValide = wd.decision === 'valide';
        html += '<div class="bilan-decision ' + wd.decision + '">' +
            (isValide ? '✅ Validé' : '❌ Non validé') + '</div>';
        html += '</div>';

        // Critères — depends on type
        html += this._renderStep4Criteres(sub);

        // Corrigé
        if (wd.correctionValue) {
            html += '<div class="bilan-section">';
            html += '<h4>Corrigé personnalisé</h4>';
            html += '<div class="bilan-value">' +
                (wd.correctionType === 'url' ? '🔗 Lien Google Doc' : '📝 Contenu riche (blocs)') +
                '</div>';
            html += '</div>';
        }

        // Points attribués (pour bonus/TC uniquement)
        if (sub._sourceType !== 'competence') {
            var evaluation = this.getEvaluationForSub(sub);
            html += this._renderStep4Points(sub, evaluation, wd);
        }

        return html;
    },

    _renderStep4Criteres(sub) {
        var wd = this.wizardData;
        var html = '';

        if (sub._sourceType === 'tc') {
            // TC: show critères per competence
            var evaluation = this.getEvaluationForSub(sub);
            var compIds = this.getCompetenceIdsForTC(evaluation);
            var self = this;

            compIds.forEach(function(compId) {
                var comp = self.getCompetence(compId);
                var criteres = self.getCriteresByCompetence(compId);
                var compValides = wd.competenceValidees[compId] || [];

                if (criteres.length === 0) return;

                html += '<div class="bilan-section">';
                html += '<h4>🎯 ' + escapeHtml(comp ? comp.nom : 'Compétence') +
                    ' (' + compValides.length + '/' + criteres.length + ')</h4>';
                html += '<div class="bilan-criteres-list">';
                criteres.forEach(function(c) {
                    var checked = compValides.indexOf(String(c.id)) !== -1;
                    html += '<div class="bilan-critere ' + (checked ? 'checked' : 'unchecked') + '">';
                    html += (checked ? '✅' : '❌') + ' ' + escapeHtml(c.libelle);
                    html += '</div>';
                });
                html += '</div></div>';
            });
        } else if (sub._sourceType === 'bonus_ponctuel') {
            // Bonus ponctuel: critères libres
            var evaluation2 = this.getEvaluationForSub(sub);
            var criteresLibres = this.getCriteresLibres(evaluation2);
            if (criteresLibres.length > 0) {
                html += '<div class="bilan-section">';
                html += '<h4>Critères libres (' + wd.criteresValides.length + '/' + criteresLibres.length + ')</h4>';
                html += '<div class="bilan-criteres-list">';
                criteresLibres.forEach(function(label, idx) {
                    var critId = 'libre_' + idx;
                    var checked = wd.criteresValides.indexOf(critId) !== -1;
                    html += '<div class="bilan-critere ' + (checked ? 'checked' : 'unchecked') + '">';
                    html += (checked ? '✅' : '❌') + ' ' + escapeHtml(label);
                    html += '</div>';
                });
                html += '</div></div>';
            }
        } else {
            // Competence training + bonus comp: single competence
            var competenceId = null;
            if (sub._sourceType === 'bonus_comp') {
                var eval3 = this.getEvaluationForSub(sub);
                competenceId = eval3 ? eval3.competence_id : null;
            } else {
                var ent = this.getEntrainement(sub.entrainement_id);
                var comp2 = this.getCompetenceForEntrainement(ent);
                competenceId = comp2 ? comp2.id : null;
            }

            var criteres2 = competenceId ? this.getCriteresByCompetence(competenceId) : [];
            if (criteres2.length > 0) {
                html += '<div class="bilan-section">';
                html += '<h4>Critères de réussite (' + wd.criteresValides.length + '/' + criteres2.length + ')</h4>';
                html += '<div class="bilan-criteres-list">';
                criteres2.forEach(function(c) {
                    var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                    html += '<div class="bilan-critere ' + (checked ? 'checked' : 'unchecked') + '">';
                    html += (checked ? '✅' : '❌') + ' ' + escapeHtml(c.libelle);
                    html += '</div>';
                });
                html += '</div></div>';
            }
        }

        return html;
    },

    /** Calcule les points par compétence automatiquement depuis les critères validés */
    _computePointsParCompetence(sub, evaluation, wd) {
        var ptsMap = this._getCompPointsMap(evaluation);
        var ppc = {};
        var total = 0;

        for (var compId in ptsMap) {
            var info = ptsMap[compId];
            var criteres = this.getCriteresByCompetence(compId);

            // Déterminer les critères validés pour cette compétence
            var valides;
            if (sub._sourceType === 'tc') {
                valides = (wd.competenceValidees && wd.competenceValidees[compId]) ? wd.competenceValidees[compId] : [];
            } else {
                // bonus_comp: critères dans criteresValides
                valides = wd.criteresValides || [];
            }

            var allValid = criteres.length > 0 && criteres.every(function(c) { return valides.indexOf(String(c.id)) !== -1; });
            var pts = allValid ? info.pts : 0;
            ppc[compId] = pts;
            total += pts;
        }

        return { ppc: ppc, total: total };
    },

    _renderStep4Points(sub, evaluation, wd) {
        var html = '';
        var matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };

        var ptsMap = this._getCompPointsMap(evaluation);
        var hasCompetences = Object.keys(ptsMap).length > 0 && (sub._sourceType === 'tc' || sub._sourceType === 'bonus_comp');

        if (hasCompetences) {
            // Auto-compute points from criteria validation
            var computed = this._computePointsParCompetence(sub, evaluation, wd);
            wd.pointsParCompetence = computed.ppc;
            wd.score = computed.total;

            // Group by matière for summary
            var byMatiere = {};
            var self = this;
            for (var compId in ptsMap) {
                var info = ptsMap[compId];
                var mat = info.matiere;
                if (!byMatiere[mat]) byMatiere[mat] = { earned: 0, max: 0, color: info.color };
                byMatiere[mat].max += info.pts;
                byMatiere[mat].earned += computed.ppc[compId] || 0;
                // Transversal: also count in FR and HG-EMC for display
            }

            html += '<div class="bilan-section">';
            html += '<h4>Points gagnés par matière</h4>';

            var matiereOrder = ['FR', 'HG-EMC', 'Transversal'];
            matiereOrder.forEach(function(mat) {
                if (!byMatiere[mat]) return;
                var m = byMatiere[mat];
                var color = m.color || matiereColors[mat] || '#6b7280';
                var matLabel = mat === 'Transversal' ? 'Transversal (FR + HG-EMC)' : mat;
                html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray-100, #f3f4f6);">';
                html += '<span style="display:inline-block;font-size:0.8rem;padding:3px 10px;border-radius:4px;background:' + color + '20;color:' + color + ';font-weight:600;min-width:60px;text-align:center;">' + escapeHtml(matLabel) + '</span>';
                html += '<span style="font-size:0.95rem;font-weight:600;">' + m.earned + ' / ' + m.max + ' pt' + (m.max > 1 ? 's' : '') + '</span>';
                if (m.earned >= m.max && m.max > 0) {
                    html += '<span style="color:#16a34a;">✅</span>';
                } else if (m.earned > 0) {
                    html += '<span style="color:#f59e0b;">⚠️</span>';
                }
                html += '</div>';
            });

            // Per-competency detail
            html += '<div style="margin-top:12px;">';
            html += '<details><summary style="cursor:pointer;font-size:0.85rem;color:var(--gray-400);margin-bottom:6px;">Détail par compétence</summary>';
            for (var cId in ptsMap) {
                var cInfo = ptsMap[cId];
                var comp = self.getCompetence(cId);
                var earned = computed.ppc[cId] || 0;
                var isValid = earned > 0;
                html += '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:0.8rem;">';
                html += '<span>' + (isValid ? '✅' : '❌') + '</span>';
                html += '<span style="flex:1;">' + escapeHtml(comp ? comp.nom : 'Compétence') + '</span>';
                html += '<span style="font-weight:600;">' + earned + ' / ' + cInfo.pts + '</span>';
                html += '</div>';
            }
            html += '</details></div>';

            html += '</div>';
        } else {
            // Mode global (fallback : bonus ponctuel, ou anciennes évals sans compétences)
            var maxPts = evaluation ? (parseFloat(evaluation.briques) || 1) : 1;
            var currentScore = wd.score !== undefined ? wd.score : (wd.decision === 'valide' ? maxPts : 0);
            html += '<div class="bilan-section">';
            html += '<h4>Points attribués</h4>';
            html += '<div class="bilan-points-input">';
            html += '<input type="number" id="correctionScore" class="form-input" ' +
                'value="' + currentScore + '" min="0" max="' + maxPts + '" step="0.25" ' +
                'onchange="AdminCorrections.wizardData.score = parseFloat(this.value) || 0" ' +
                'style="width: 80px; display: inline-block;">';
            html += ' <span class="bilan-max-pts">/ ' + maxPts + ' pts</span>';
            html += '</div>';
            html += '</div>';
        }

        return html;
    },

    renderFooter4() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(3)">← Modifier</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn-confirm" id="confirmBtn" onclick="AdminCorrections.confirmCorrection()">✅ Confirmer la correction</button>' +
            '</div>';
    },

    // ========== SAVE ==========

    async confirmCorrection() {
        if (this._saving) return;
        this._saving = true;

        var btn = document.getElementById('confirmBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Enregistrement...';
        }

        var sub = this.currentSubmission;
        var wd = this.wizardData;

        try {
            var result;

            if (sub._sourceType === 'competence') {
                // Existing flow: save to EleveEntrainementsCompetences
                result = await this.callAPI('validateEleveEntrainementCompetence', {
                    eleve_id: sub.eleve_id,
                    entrainement_id: sub.entrainement_id,
                    statut: wd.decision,
                    criteres_valides: JSON.stringify(wd.criteresValides),
                    correction_prof: wd.correctionValue || '',
                    statut_correction: wd.statutCorrection || 'publie'
                });
            } else {
                // Bonus/TC flow: save to EVALUATION_RESULTATS via saveEvaluationCorrection
                var params = {
                    evaluation_id: sub.evaluation_id,
                    eleve_id: sub.eleve_id,
                    correction_prof: wd.correctionValue || '',
                    statut_correction: wd.statutCorrection || 'publie',
                    is_validated: wd.decision === 'valide'
                };

                if (sub._sourceType === 'tc') {
                    // TC: save per-competence critères as JSON object
                    params.competence_ids_validees = JSON.stringify(wd.competenceValidees || {});
                    params.criteres_valides = JSON.stringify(wd.criteresValides);
                } else {
                    // Bonus comp / ponctuel: simple critères list
                    params.criteres_valides = JSON.stringify(wd.criteresValides);
                }

                // Points attribués — auto-compute from criteria for TC/bonus comp
                if (sub._sourceType === 'tc' || sub._sourceType === 'bonus_comp') {
                    var evaluation = this.getEvaluationForSub(sub);
                    var computed = this._computePointsParCompetence(sub, evaluation, wd);
                    if (Object.keys(computed.ppc).length > 0) {
                        params.points_par_competence = JSON.stringify(computed.ppc);
                    }
                    params.score = computed.total;
                    params.validations = computed.total;
                } else if (wd.score !== undefined) {
                    params.score = wd.score;
                    params.validations = wd.score;
                }

                result = await this.callAPI('saveEvaluationCorrection', params);
            }

            if (result.success) {
                sub.statut = wd.decision;
                sub.correction_prof = wd.correctionValue;
                sub.criteres_valides = JSON.stringify(wd.criteresValides);
                sub.statut_correction = wd.statutCorrection || 'publie';
                sub.date_correction = new Date().toISOString();

                // Invalidate relevant caches
                try {
                    if (sub._sourceType === 'competence') {
                        localStorage.removeItem('brikks_sheets_EleveEntrainementsCompetences');
                    } else {
                        localStorage.removeItem('brikks_sheets_EVALUATION_RESULTATS');
                    }
                } catch (_e) { /* ignore */ }

                this.closeModal();
                this.updateCounts();
                this.renderGrid();
                this.showNotification('Correction enregistrée !', 'success');
            } else {
                this.showNotification('Erreur : ' + (result.error || 'Échec de la sauvegarde'), 'error');
            }
        } catch (error) {
            console.error('Erreur sauvegarde correction:', error);
            this.showNotification('Erreur réseau. Réessayez.', 'error');
        } finally {
            this._saving = false;
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✅ Confirmer la correction';
            }
        }
    },

    // ========== UI HELPERS ==========

    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('corrections-content').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML =
            '<div style="text-align: center; color: #ef4444;">' +
                '<p>' + escapeHtml(message) + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Réessayer</button>' +
            '</div>';
    },

    showNotification(message, type) {
        var existing = document.querySelector('.correction-notification');
        if (existing) existing.remove();

        var notif = document.createElement('div');
        notif.className = 'correction-notification ' + (type || 'success');
        notif.textContent = message;
        document.body.appendChild(notif);

        // Durée plus longue pour les erreurs, animation de sortie
        var duration = type === 'error' ? 6000 : 4000;
        setTimeout(function() {
            if (notif.parentNode) {
                notif.classList.add('fade-out');
                setTimeout(function() {
                    if (notif.parentNode) notif.remove();
                }, 300);
            }
        }, duration);
    }
};

// Monter le block editor mixin pour le corrigé (text, document, image, video)
Object.assign(AdminCorrections, createBlockEditorMixin('AdminCorrections'));
