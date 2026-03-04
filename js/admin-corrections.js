/**
 * Admin Corrections — Correction des entraînements de compétences
 * Wizard 3 étapes : Informations → Correction → Bilan
 */

const AdminCorrections = {

    // Données chargées
    submissions: [],
    entrainements: [],
    banques: [],
    competences: [],
    criteres: [],
    utilisateurs: [],

    // État du wizard
    currentTab: 'pending',
    currentStep: 1,
    currentSubmission: null,
    wizardData: {
        criteresValides: [],
        decision: null,
        remarque: '',
        correctionType: null,
        correctionValue: ''
    },

    _saving: false,

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
            SheetsAPI.fetchAndParse('UTILISATEURS')
        ]);

        this.submissions = results[0] || [];
        this.entrainements = results[1] || [];
        this.banques = results[2] || [];
        this.competences = results[3] || [];
        this.criteres = results[4] || [];
        this.utilisateurs = results[5] || [];
    },

    callAPI(action, params) {
        return new Promise(function(resolve, reject) {
            var callbackName = 'callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            var script = document.createElement('script');

            window[callbackName] = function(response) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                resolve(response);
            };

            var queryParams = new URLSearchParams(Object.assign({ action: action, callback: callbackName }, params));
            script.src = CONFIG.WEBAPP_URL + '?' + queryParams.toString();
            script.onerror = function() {
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
        // Via banque
        if (entrainement.banque_id) {
            var banque = this.banques.find(function(b) { return String(b.id) === String(entrainement.banque_id); });
            if (banque && banque.competence_id) return this.getCompetence(banque.competence_id);
        }
        // Via entrainement direct
        if (entrainement.competence_id) return this.getCompetence(entrainement.competence_id);
        return null;
    },

    getPendingSubmissions() {
        return this.submissions
            .filter(function(s) { return s.statut === 'soumis'; })
            .sort(function(a, b) {
                return new Date(b.date_soumission || 0) - new Date(a.date_soumission || 0);
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

    escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    // ========== TABS ==========

    showTab(tab) {
        this.currentTab = tab;
        document.getElementById('togglePending').classList.toggle('active', tab === 'pending');
        document.getElementById('toggleDone').classList.toggle('active', tab === 'done');
        this.renderGrid();
    },

    updateCounts() {
        document.getElementById('pendingCount').textContent = this.getPendingSubmissions().length;
        document.getElementById('doneCount').textContent = this.getDoneSubmissions().length;
    },

    // ========== RENDER GRID ==========

    renderGrid() {
        var items = this.currentTab === 'pending' ? this.getPendingSubmissions() : this.getDoneSubmissions();
        var grid = document.getElementById('correctionsGrid');
        var empty = document.getElementById('emptyState');

        if (items.length === 0) {
            grid.innerHTML = '';
            document.getElementById('emptyIcon').textContent = this.currentTab === 'pending' ? '✅' : '📂';
            document.getElementById('emptyMessage').textContent = this.currentTab === 'pending'
                ? 'Aucune copie à corriger pour le moment !'
                : 'Aucune correction terminée.';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        var self = this;
        grid.innerHTML = items.map(function(sub) {
            return self.renderCard(sub);
        }).join('');
    },

    renderCard(sub) {
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);

        var eleveName = this.getEleveName(eleve);
        var entrainementTitle = entrainement ? entrainement.titre : 'Entraînement inconnu';
        var competenceNom = competence ? competence.nom : '';
        var isDone = sub.statut === 'valide' || sub.statut === 'non_valide';

        var subKey = sub.id || (sub.eleve_id + '_' + sub.entrainement_id);

        var decisionHtml = '';
        if (isDone) {
            var isValide = sub.statut === 'valide';
            decisionHtml = '<span class="card-decision ' + sub.statut + '">' +
                (isValide ? '✅ Validé' : '❌ Non validé') + '</span>';
        }

        var modeLabel = this.getModeLabel(sub.mode_rendu);
        var dateStr = this.formatDate(sub.date_soumission);

        return '<div class="correction-card' + (isDone ? ' done' : '') + '" onclick="AdminCorrections.openModal(\'' + this.escapeHtml(subKey) + '\')">' +
            '<div class="card-header">' +
                '<div class="card-avatar">' + this.getInitials(eleveName) + '</div>' +
                '<div class="card-eleve">' + this.escapeHtml(eleveName) + '</div>' +
            '</div>' +
            '<div class="card-entrainement">' + this.escapeHtml(entrainementTitle) + '</div>' +
            (competenceNom ? '<div class="card-competence">' + this.escapeHtml(competenceNom) + '</div>' : '') +
            '<div class="card-meta">' +
                (modeLabel ? '<span class="card-mode">' + modeLabel + '</span>' : '<span class="card-date">📅 ' + dateStr + '</span>') +
                (decisionHtml || '<span class="card-date">📅 ' + dateStr + '</span>') +
            '</div>' +
        '</div>';
    },

    // ========== MODAL / WIZARD ==========

    openModal(subId) {
        var sub = this.submissions.find(function(s) {
            return String(s.id) === String(subId) ||
                   (s.eleve_id + '_' + s.entrainement_id) === subId;
        });
        if (!sub) return;

        this.currentSubmission = sub;
        this.currentStep = 1;

        // Pré-remplir si correction déjà faite
        var existingCriteres = [];
        if (sub.criteres_valides) {
            try {
                existingCriteres = JSON.parse(sub.criteres_valides);
            } catch (_e) { /* ignore */ }
        }

        this.wizardData = {
            criteresValides: Array.isArray(existingCriteres) ? existingCriteres.map(String) : [],
            decision: (sub.statut === 'valide' || sub.statut === 'non_valide') ? sub.statut : null,
            remarque: sub.remarque_prof || '',
            correctionType: sub.correction_prof ? (String(sub.correction_prof).startsWith('http') ? 'url' : 'html') : null,
            correctionValue: sub.correction_prof || ''
        };

        this.updateModalTitle();
        this.renderStep();
        this.updateWizardIndicators();
        document.getElementById('correctionModal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('correctionModal').classList.add('hidden');
        this.currentSubmission = null;
    },

    updateModalTitle() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var title = this.getEleveName(eleve) + ' — ' + (entrainement ? entrainement.titre : 'Entraînement');
        document.getElementById('correctionModalTitle').textContent = title;
    },

    goToStep(step) {
        this.currentStep = step;
        this.renderStep();
        this.updateWizardIndicators();
    },

    updateWizardIndicators() {
        var self = this;
        document.querySelectorAll('.wizard-step').forEach(function(el) {
            var stepNum = parseInt(el.dataset.step);
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
        } else if (this.currentStep === 3) {
            body.innerHTML = this.renderStep3();
            footer.innerHTML = this.renderFooter3();
        }
    },

    // ========== ÉTAPE 1 — INFORMATIONS ==========

    renderStep1() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);

        var html = '<div class="info-grid">';
        html += this._infoItem('👤', 'Élève', this.getEleveName(eleve));
        html += this._infoItem('📅', 'Soumis le', this.formatDateLong(sub.date_soumission));
        html += this._infoItem('⏱', 'Temps passé', this.formatTime(sub.temps_passe));
        html += this._infoItem('📄', 'Mode de rendu', this.getModeLabel(sub.mode_rendu) || '—');
        html += '</div>';

        // Document de l'entraînement
        if (entrainement) {
            var docUrl = entrainement.document_url;
            var docContenu = entrainement.document_contenu;

            // Parser le contenu si c'est du JSON
            if (docContenu && typeof docContenu === 'string') {
                try {
                    var parsed = JSON.parse(docContenu);
                    if (parsed && typeof parsed === 'object' && parsed.content) {
                        docContenu = parsed.content;
                    } else if (typeof parsed === 'string') {
                        docContenu = parsed;
                    }
                } catch (_e) { /* déjà du HTML, on garde tel quel */ }
            }

            if (docUrl || docContenu) {
                html += '<div class="document-section">';
                html += '<h4>📝 Document de l\'exercice</h4>';
                if (docUrl) {
                    html += '<iframe class="document-frame" src="' + this.escapeHtml(docUrl) + '" sandbox="allow-same-origin allow-scripts"></iframe>';
                } else if (docContenu) {
                    html += '<div class="document-html">' + docContenu + '</div>';
                }
                html += '</div>';
            }
        }

        return html;
    },

    _infoItem(icon, label, value) {
        return '<div class="info-item">' +
            '<span class="info-icon">' + icon + '</span>' +
            '<div><div class="info-label">' + label + '</div>' +
            '<div class="info-value">' + this.escapeHtml(value) + '</div></div>' +
        '</div>';
    },

    renderFooter1() {
        return '<div class="footer-left"></div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.goToStep(2)">Suivant →</button>' +
            '</div>';
    },

    // ========== ÉTAPE 2 — CORRECTION ==========

    renderStep2() {
        var sub = this.currentSubmission;
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];
        var wd = this.wizardData;

        var html = '';

        // Critères de réussite
        if (criteres.length > 0) {
            html += '<div class="correction-section">';
            html += '<h4>Critères de réussite (' + criteres.length + ')</h4>';
            html += '<div class="criteres-correction-list">';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="critere-check' + (checked ? ' checked' : '') + '" onclick="AdminCorrections.toggleCritere(\'' + c.id + '\', this)">';
                html += '<input type="checkbox" id="critere_' + c.id + '"' + (checked ? ' checked' : '') + '>';
                html += '<label for="critere_' + c.id + '">' + AdminCorrections.escapeHtml(c.libelle) + '</label>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Corrigé personnalisé (repliable)
        var hasCorrige = wd.correctionType !== null;
        html += '<div class="correction-section">';
        html += '<div class="correction-section-header' + (hasCorrige ? ' expanded' : '') + '" onclick="AdminCorrections.toggleSection(this)">';
        html += '<h4>📎 Corrigé personnalisé (optionnel)</h4>';
        html += '<span class="toggle-icon">▼</span>';
        html += '</div>';
        html += '<div class="correction-section-body' + (hasCorrige ? '' : ' hidden') + '">';
        html += '<div class="corrige-toggle">';
        html += '<button class="corrige-toggle-btn' + (wd.correctionType === 'url' ? ' active' : '') + '" onclick="AdminCorrections.setCorrectionType(\'url\')">Lien Google Doc</button>';
        html += '<button class="corrige-toggle-btn' + (wd.correctionType === 'html' ? ' active' : '') + '" onclick="AdminCorrections.setCorrectionType(\'html\')">Texte</button>';
        html += '</div>';
        if (wd.correctionType === 'url') {
            html += '<input type="url" class="corrige-url-input" placeholder="https://docs.google.com/..." value="' + this.escapeHtml(wd.correctionValue) + '" oninput="AdminCorrections.wizardData.correctionValue = this.value">';
        } else if (wd.correctionType === 'html') {
            html += '<textarea class="corrige-editor" placeholder="Tapez votre corrigé ici..." oninput="AdminCorrections.wizardData.correctionValue = this.value">' + this.escapeHtml(wd.correctionValue) + '</textarea>';
        }
        html += '</div></div>';

        // Remarque (repliable)
        var hasRemarque = wd.remarque.length > 0;
        html += '<div class="correction-section">';
        html += '<div class="correction-section-header' + (hasRemarque ? ' expanded' : '') + '" onclick="AdminCorrections.toggleSection(this)">';
        html += '<h4>💬 Remarque pour l\'élève (optionnel)</h4>';
        html += '<span class="toggle-icon">▼</span>';
        html += '</div>';
        html += '<div class="correction-section-body' + (hasRemarque ? '' : ' hidden') + '">';
        html += '<textarea class="remarque-textarea" placeholder="Bon travail sur la chronologie, mais pense à croiser les documents sources..." oninput="AdminCorrections.wizardData.remarque = this.value">' + this.escapeHtml(wd.remarque) + '</textarea>';
        html += '</div></div>';

        // Décision
        html += '<div class="decision-section">';
        html += '<h4>Décision</h4>';
        html += '<div class="decision-buttons">';
        html += '<button class="btn-decision btn-non-valide' + (wd.decision === 'non_valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'non_valide\')">❌ Non validé</button>';
        html += '<button class="btn-decision btn-valide' + (wd.decision === 'valide' ? ' selected' : '') + '" onclick="AdminCorrections.setDecision(\'valide\')">✅ Validé</button>';
        html += '</div></div>';

        return html;
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
    },

    toggleSection(header) {
        header.classList.toggle('expanded');
        var body = header.nextElementSibling;
        body.classList.toggle('hidden');
    },

    setCorrectionType(type) {
        var oldType = this.wizardData.correctionType;
        this.wizardData.correctionType = type;
        if (oldType !== type) {
            this.wizardData.correctionValue = '';
        }
        this.renderStep();
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

    renderFooter2() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(1)">← Précédent</button>' +
            '</div>' +
            '<div class="footer-right">' +
                '<button class="btn btn-primary" onclick="AdminCorrections.validateStep2()">Suivant →</button>' +
            '</div>';
    },

    validateStep2() {
        if (!this.wizardData.decision) {
            this.showNotification('Veuillez choisir une décision (validé ou non validé).', 'error');
            return;
        }
        this.goToStep(3);
    },

    // ========== ÉTAPE 3 — BILAN ==========

    renderStep3() {
        var sub = this.currentSubmission;
        var eleve = this.getEleve(sub.eleve_id);
        var entrainement = this.getEntrainement(sub.entrainement_id);
        var competence = this.getCompetenceForEntrainement(entrainement);
        var competenceId = competence ? competence.id : null;
        var criteres = competenceId ? this.getCriteresByCompetence(competenceId) : [];
        var wd = this.wizardData;

        var html = '';

        // Infos
        html += '<div class="bilan-section">';
        html += '<h4>Élève</h4>';
        html += '<div class="bilan-value">' + this.escapeHtml(this.getEleveName(eleve)) + '</div>';
        html += '</div>';

        html += '<div class="bilan-section">';
        html += '<h4>Entraînement</h4>';
        html += '<div class="bilan-value">' + this.escapeHtml(entrainement ? entrainement.titre : 'Inconnu') + '</div>';
        html += '</div>';

        // Décision
        html += '<div class="bilan-section">';
        html += '<h4>Décision</h4>';
        var isValide = wd.decision === 'valide';
        html += '<div class="bilan-decision ' + wd.decision + '">' +
            (isValide ? '✅ Validé' : '❌ Non validé') + '</div>';
        html += '</div>';

        // Critères
        if (criteres.length > 0) {
            html += '<div class="bilan-section">';
            html += '<h4>Critères de réussite (' + wd.criteresValides.length + '/' + criteres.length + ')</h4>';
            html += '<div class="bilan-criteres-list">';
            criteres.forEach(function(c) {
                var checked = wd.criteresValides.indexOf(String(c.id)) !== -1;
                html += '<div class="bilan-critere ' + (checked ? 'checked' : 'unchecked') + '">';
                html += (checked ? '✅' : '❌') + ' ' + AdminCorrections.escapeHtml(c.libelle);
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Remarque
        if (wd.remarque) {
            html += '<div class="bilan-section">';
            html += '<h4>Remarque</h4>';
            html += '<div class="bilan-remarque">' + this.escapeHtml(wd.remarque) + '</div>';
            html += '</div>';
        }

        // Corrigé
        if (wd.correctionType && wd.correctionValue) {
            html += '<div class="bilan-section">';
            html += '<h4>Corrigé personnalisé</h4>';
            html += '<div class="bilan-value">' +
                (wd.correctionType === 'url' ? '🔗 Lien Google Doc' : '📝 Texte saisi') +
                '</div>';
            html += '</div>';
        }

        return html;
    },

    renderFooter3() {
        return '<div class="footer-left">' +
                '<button class="btn btn-secondary" onclick="AdminCorrections.goToStep(2)">← Modifier</button>' +
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

        var params = {
            eleve_id: sub.eleve_id,
            entrainement_id: sub.entrainement_id,
            statut: wd.decision,
            criteres_valides: JSON.stringify(wd.criteresValides),
            remarque_prof: wd.remarque || '',
            correction_prof: wd.correctionValue || ''
        };

        try {
            var result = await this.callAPI('validateEleveEntrainementCompetence', params);

            if (result.success) {
                // Mettre à jour la soumission localement
                sub.statut = wd.decision;
                sub.remarque_prof = wd.remarque;
                sub.correction_prof = wd.correctionValue;
                sub.criteres_valides = JSON.stringify(wd.criteresValides);
                sub.date_correction = new Date().toISOString();

                // Invalider le cache SheetsAPI
                try { localStorage.removeItem('brikks_sheets_EleveEntrainementsCompetences'); } catch (_e) { /* ignore */ }

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
                '<p>' + this.escapeHtml(message) + '</p>' +
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

        setTimeout(function() {
            if (notif.parentNode) notif.remove();
        }, 3000);
    }
};
