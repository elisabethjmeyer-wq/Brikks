/**
 * Moteur d'Evaluation Eleve
 * Pilote EleveConnaissances ou EleveExercices en "mode évaluation"
 * pour réutiliser les rendus et validations des modules d'entraînement.
 *
 * Type connaissances → piloté via EleveConnaissances (étapes, formats QCM/VF/etc.)
 * Type savoir-faire  → piloté via EleveExercices (format unique : tableau, carte, etc.)
 */

const EleveEvaluation = {
    // État évaluation
    evaluation: null,
    duration: 0,
    remainingTime: 0,
    timerInterval: null,
    timeExpired: false,
    isSubmitting: false,

    // SF : résultat de validation stocké pour finishEvaluation
    _sfValidationResult: null,

    // ========== INITIALISATION ==========
    async init() {
        try {
            const params = new URLSearchParams(window.location.search);
            const evalId = params.get('id');
            const mode = params.get('mode');

            if (!evalId || evalId === 'test') {
                throw new Error('ID d\'évaluation manquant');
            }

            // Mode review : afficher le bilan d'une évaluation déjà passée
            if (mode === 'review') {
                await this._initReviewMode(evalId);
                return;
            }

            // Mode sujet : afficher le document en lecture seule (TC/bonus)
            if (mode === 'sujet') {
                await this._initSujetMode(evalId);
                return;
            }

            await this.loadEvaluation(evalId);

            // Bifurquer selon le type d'évaluation
            if (this.evaluation.type === 'savoir-faire') {
                this.setupSFModule();
            } else {
                this.setupConnaissancesModule();
            }

            this._addBeforeUnload();
            this.startTimer();
            this.render();
            this.showContent();
        } catch (error) {
            console.error('Erreur initialisation:', error);
            this.showError(error.message || 'Erreur lors du chargement de l\'évaluation');
        }
    },

    // ========== CHARGEMENT ==========
    async loadEvaluation(evalId) {
        const eleveId = this._getCurrentUserId();
        let response;
        if (eleveId) {
            response = await this.callAPI('getEvaluationForEleve', { id: evalId, eleve_id: eleveId });
        } else {
            response = await this.callAPI('getEvaluation', { id: evalId });
        }

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Évaluation non trouvée');
        }

        const data = response.data;

        // Vérification côté client : l'évaluation doit être accessible
        const effectiveStatut = this._computeEffectiveStatut(data);
        if (effectiveStatut === 'brouillon') {
            throw new Error('Cette évaluation n\'est pas encore disponible.');
        }
        if (effectiveStatut === 'planifiee') {
            throw new Error('Cette évaluation n\'est pas encore ouverte.');
        }
        if (effectiveStatut === 'terminee') {
            throw new Error('Cette évaluation est terminée.');
        }

        this.evaluation = {
            id: data.id,
            titre: data.titre,
            type: data.type,
            chapitre_id: data.chapitre_id,
            chapitre_nom: data.chapitre_nom,
            description: data.description,
            briques: parseInt(data.briques) || 1,
            seuil: parseInt(data.seuil) || 80,
            methodologie_id: data.methodologie_id,
            criteres: data.criteres,
            attribution: data.attribution
        };

        // Durée en secondes (duree stockée en minutes partout → × 60)
        const dureeMinutes = parseInt(data.duree) || 15;
        this.duration = dureeMinutes * 60;
        this.remainingTime = this.duration;

        if (data.type === 'savoir-faire') {
            // SF : le backend renvoie data.questions (array d'un exercice)
            this._rawSFQuestions = data.questions || [];
            if (this._rawSFQuestions.length === 0) {
                throw new Error('Aucun exercice disponible pour cette évaluation');
            }
        } else {
            // Connaissances : données structurées par étape
            this._rawEtapes = data.etapes || [];
            this._rawEtapeQuestions = data.etapeQuestions || [];
            this._rawQuestionsConnaissances = data.questionsConnaissances || [];
            this._rawEntrainementData = data.entrainementData || {};

            if (this._rawEtapes.length === 0) {
                throw new Error('Aucune étape disponible pour cette évaluation');
            }
        }
    },

    // ========== MODE SUJET (lecture seule TC/bonus) ==========

    /**
     * Affiche le sujet d'une évaluation TC ou bonus en lecture seule.
     * TC : layout 2 colonnes (sujet + critères), style entraînement compétences.
     * Bonus : layout simple (header + document).
     */
    async _initSujetMode(evalId) {
        const eleveId = this._getCurrentUserId();
        const response = eleveId
            ? await this.callAPI('getEvaluationForEleve', { id: evalId, eleve_id: eleveId })
            : await this.callAPI('getEvaluation', { id: evalId });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Évaluation non trouvée');
        }

        const data = response.data;
        const exercice = data.exercice || {};
        const type = String(data.type || '').trim();

        // Phase 9 : lire le contenu directement depuis data (EVALUATIONS), fallback vers exercice
        const docContenu = data.document_contenu || exercice.document_contenu || '';
        const documentHtml = this._buildDocumentHtml(docContenu);

        if (type === 'competences') {
            await this._renderTCSujetMode(data, exercice, documentHtml);
        } else {
            await this._renderBonusSujetMode(data, exercice, documentHtml);
        }

        this.showContent();
    },

    /**
     * Rendu TC / bonus mission (avec compétences) : layout 2 colonnes.
     * Barre de titre + tag, sujet à gauche, critères à droite.
     * @param {string} variant - 'tc' (défaut) ou 'bonus' pour le badge
     */
    async _renderTCSujetMode(data, exercice, documentHtml, variant) {
        const title = data.titre || 'Sujet';
        const isBonus = variant === 'bonus';
        const badgeLabel = isBonus ? 'Bonus mission' : 'Évaluation de compétence';
        const badgeClass = isBonus ? 'bonus' : 'tc';

        // Charger les critères de réussite des compétences liées
        let criteresHtml = '';
        try {
            const competenceIds = this._parseCompetenceIds(data, exercice);
            if (competenceIds.length > 0) {
                criteresHtml = await this._loadCriteresHtml(competenceIds);
            }
        } catch (e) {
            console.warn('Impossible de charger les critères:', e);
        }

        // Consignes
        const consigne = data.description || exercice.consigne || data.criteres || '';
        const consigneHtml = consigne
            ? `<div class="sujet-consigne">${escapeHtml(consigne)}</div>`
            : '';

        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="sujet-view sujet-view-tc">
                <div class="sujet-topbar">
                    <button class="sujet-back-btn" onclick="window.history.back()">←</button>
                    <div class="sujet-topbar-info">
                        <h1>${escapeHtml(title)}</h1>
                        <div class="sujet-topbar-meta">
                            <span class="sujet-mode-badge ${badgeClass}">${escapeHtml(badgeLabel)}</span>
                        </div>
                    </div>
                </div>
                <div class="sujet-layout">
                    <div class="sujet-document-section">
                        <div class="sujet-section-header">📄 Sujet</div>
                        ${consigneHtml}
                        <div class="sujet-document-content">
                            ${documentHtml}
                        </div>
                    </div>
                    <div class="sujet-sidebar-section">
                        ${criteresHtml || '<div class="sujet-no-criteres">Aucun critère défini</div>'}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Rendu bonus mission : layout 2 colonnes si competence_ids présents,
     * layout simple header + document sinon.
     */
    async _renderBonusSujetMode(data, exercice, documentHtml) {
        // Bonus mission avec compétences : layout 2 colonnes comme TC
        const competenceIds = this._parseCompetenceIds(data, exercice);
        if (competenceIds.length > 0) {
            return this._renderTCSujetMode(data, exercice, documentHtml, 'bonus');
        }

        // Bonus mission sans compétences : layout simple (plein écran, sans sidebar critères)
        const title = data.titre || 'Sujet';

        // Phase 9 : description directement sur data, fallback exercice.consigne
        const consigne = data.description || exercice.consigne || data.criteres || '';
        const consigneHtml = consigne
            ? `<div class="sujet-consigne"><strong>Consignes :</strong> ${escapeHtml(consigne)}</div>`
            : '';

        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="sujet-view sujet-view-tc">
                <div class="sujet-topbar">
                    <button class="sujet-back-btn" onclick="window.history.back()">←</button>
                    <div class="sujet-topbar-info">
                        <h1>${escapeHtml(title)}</h1>
                        <div class="sujet-topbar-meta">
                            <span class="sujet-mode-badge bonus">Bonus mission</span>
                        </div>
                    </div>
                </div>
                <div class="sujet-document-section" style="max-width: 900px;">
                    <div class="sujet-section-header">📄 Sujet</div>
                    ${consigneHtml}
                    <div class="sujet-document-content">
                        ${documentHtml}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Construit le HTML du document (URL iframe, blocs JSON, ou HTML brut).
     */
    _buildDocumentHtml(docContenu) {
        if (!docContenu) {
            return '<p class="sujet-empty">Aucun document disponible pour cette évaluation.</p>';
        }
        if (String(docContenu).startsWith('http')) {
            const embedUrl = docContenu.includes('/edit') ? docContenu.replace('/edit', '/preview') : docContenu;
            return `<iframe src="${escapeHtml(embedUrl)}" class="sujet-iframe"></iframe>`;
        }
        try {
            const blocks = JSON.parse(docContenu);
            if (Array.isArray(blocks)) {
                return this._renderBlocksReadOnly(blocks);
            }
            return `<div class="sujet-html-content">${docContenu}</div>`;
        } catch (e) {
            return `<div class="sujet-html-content">${docContenu}</div>`;
        }
    },

    /**
     * Parse les IDs de compétences depuis un exercice TC.
     */
    _parseCompetenceIds(data, exercice) {
        // Phase 9 : competence_ids peut être directement sur data (EVALUATIONS) ou sur exercice
        const source = data || exercice || {};
        const fallback = exercice || {};
        let ids = [];
        const rawIds = source.competence_ids || fallback.competence_ids || '';
        if (rawIds) {
            try {
                const parsed = JSON.parse(rawIds);
                ids = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                ids = [rawIds];
            }
        }
        if (ids.length === 0 && (source.competence_id || fallback.competence_id)) {
            ids = [source.competence_id || fallback.competence_id];
        }
        return ids.map(id => String(id).trim()).filter(Boolean);
    },

    /**
     * Charge les critères de réussite pour les compétences données.
     * Retourne du HTML groupé par matière, avec critères repliables.
     */
    async _loadCriteresHtml(competenceIds) {
        const [referentiel, criteres] = await Promise.all([
            SheetsAPI.fetchAndParse('CompetencesReferentiel'),
            SheetsAPI.fetchAndParse('CriteresReussite')
        ]);

        const matiereOrder = ['FR', 'HG-EMC', 'Transversal'];
        const matiereLabels = { 'FR': 'Français', 'HG-EMC': 'Histoire-Géo · EMC', 'Transversal': 'Transversal' };
        const matiereColors = { 'FR': '#3b82f6', 'HG-EMC': '#f59e0b', 'Transversal': '#6b7280' };
        const matiereBgs = { 'FR': '#eff6ff', 'HG-EMC': '#fffbeb', 'Transversal': '#f3f4f6' };

        // Collecter les compétences demandées avec leurs critères
        const compsData = [];
        for (const compId of competenceIds) {
            const comp = referentiel.find(c => String(c.id).trim() === compId);
            const compCriteres = criteres
                .filter(c => String(c.competence_id).trim() === compId)
                .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
            if (!comp && compCriteres.length === 0) continue;
            compsData.push({
                name: comp ? (comp.nom || 'Compétence') : 'Compétence',
                matiere: (comp && comp.matiere) || 'Transversal',
                criteres: compCriteres
            });
        }

        // Grouper par matière
        const groups = {};
        compsData.forEach(cd => {
            if (!groups[cd.matiere]) groups[cd.matiere] = [];
            groups[cd.matiere].push(cd);
        });
        const sortedKeys = Object.keys(groups).sort((a, b) => {
            const ia = matiereOrder.indexOf(a) === -1 ? 99 : matiereOrder.indexOf(a);
            const ib = matiereOrder.indexOf(b) === -1 ? 99 : matiereOrder.indexOf(b);
            return ia - ib;
        });

        let blocksHtml = '';
        sortedKeys.forEach(mat => {
            const label = matiereLabels[mat] || mat;
            const color = matiereColors[mat] || '#6b7280';
            const bg = matiereBgs[mat] || '#f3f4f6';

            let cardsHtml = '';
            groups[mat].forEach(cd => {
                const nbCriteres = cd.criteres.length;
                cardsHtml += `
                    <div class="sujet-criteres-block" style="border-left: 3px solid ${color};">
                        <button type="button" class="sujet-comp-toggle" onclick="EleveEvaluation._toggleCriteres(this)">
                            <span class="sujet-comp-arrow">▸</span>
                            <h4 class="sujet-criteres-title">${escapeHtml(cd.name)}</h4>
                            <span class="sujet-comp-count">${nbCriteres} critère${nbCriteres > 1 ? 's' : ''} à valider</span>
                        </button>
                        <div class="sujet-criteres-list" style="display: none;">
                            ${cd.criteres.map(c => `
                                <div class="sujet-critere-item">
                                    <span class="sujet-critere-check">☐</span>
                                    <span class="sujet-critere-label">${escapeHtml(c.libelle || '')}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });

            blocksHtml += `
                <div class="tc-matiere-block">
                    <div class="tc-matiere-header" style="background: ${bg}; color: ${color};">
                        <span>${escapeHtml(label)}</span>
                    </div>
                    <div class="tc-matiere-body">${cardsHtml}</div>
                </div>
            `;
        });

        const totalComps = compsData.length;
        return `
            <div class="tc-review-comps-container">
                <div class="sujet-sidebar-title">Compétences évaluées & critères de réussite</div>
                <p class="tc-review-criteres-summary">${totalComps} compétence${totalComps > 1 ? 's' : ''} · ${compsData.reduce((s, cd) => s + cd.criteres.length, 0)} critères</p>
                ${blocksHtml}
            </div>
        `;
    },

    /**
     * Toggle l'affichage des critères d'une compétence.
     */
    _toggleCriteres(btn) {
        const block = btn.closest('.sujet-criteres-block');
        const list = block.querySelector('.sujet-criteres-list');
        const arrow = btn.querySelector('.sujet-comp-arrow');
        const isOpen = list.style.display !== 'none';
        list.style.display = isOpen ? 'none' : 'flex';
        arrow.textContent = isOpen ? '▸' : '▾';
    },

    /**
     * Rendu en lecture seule des blocs du block editor.
     * Gère : text, image (Drive), document (Google), video (YouTube, Loom, Drive), group.
     */
    _renderBlocksReadOnly(blocks) {
        return blocks.map(block => {
            if (!block || !block.type) return '';
            switch (block.type) {
                case 'text':
                    return `<div class="block-text">${block.content || ''}</div>`;
                case 'image': {
                    if (!block.url) return '';
                    const imgUrl = this._convertDriveUrl(block.url);
                    const legend = block.legende || block.alt || '';
                    return `<div class="block-image"><img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(legend)}">${legend ? `<p class="block-legende">${escapeHtml(legend)}</p>` : ''}</div>`;
                }
                case 'document':
                    if (block.url) {
                        const embedUrl = block.url.includes('/edit') ? block.url.replace('/edit', '/preview') : block.url;
                        return `<div class="block-document"><iframe src="${escapeHtml(embedUrl)}" class="sujet-iframe" allowfullscreen></iframe></div>`;
                    }
                    return '';
                case 'video':
                    if (!block.url) return '';
                    return `<div class="block-video">${this._buildVideoEmbed(block.url)}</div>`;
                case 'group':
                    if (Array.isArray(block.children)) {
                        const ratio = block.ratio || '1-1';
                        return `<div class="block-group ratio-${escapeHtml(ratio)}">${this._renderBlocksReadOnly(block.children)}</div>`;
                    }
                    return '';
                default:
                    return '';
            }
        }).join('');
    },

    /**
     * Convertit une URL Google Drive en URL d'image directe.
     */
    _convertDriveUrl(url) {
        const match = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return 'https://lh3.googleusercontent.com/d/' + match[1];
        const idMatch = url.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) return 'https://lh3.googleusercontent.com/d/' + idMatch[1];
        return url;
    },

    /**
     * Construit un embed vidéo (YouTube, Loom, Google Drive).
     */
    _buildVideoEmbed(url) {
        // YouTube : watch?v= ou youtu.be/
        const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytMatch) {
            return `<div class="block-video-wrapper"><iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        // Loom : loom.com/share/ → loom.com/embed/
        const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
        if (loomMatch) {
            return `<div class="block-video-wrapper"><iframe src="https://www.loom.com/embed/${loomMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        // Google Drive video
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            return `<div class="block-video-wrapper"><iframe src="https://drive.google.com/file/d/${driveMatch[1]}/preview" frameborder="0" allowfullscreen></iframe></div>`;
        }
        // Fallback : lien direct
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="block-video-link">🎬 Voir la vidéo</a>`;
    },

    // ========== MODE REVIEW ==========

    /**
     * Charge et affiche le bilan d'une évaluation déjà passée.
     */
    async _initReviewMode(evalId) {
        const eleveId = this._getCurrentUserId();
        if (!eleveId) {
            throw new Error('Utilisateur non connecté');
        }

        const response = await this.callAPI('getEvaluationResultForReview', {
            evaluation_id: evalId,
            eleve_id: eleveId
        });

        if (!response.success || !response.data) {
            throw new Error(response.error || 'Résultat non trouvé');
        }

        const { resultat, evaluation, banque_titre, competences, criteres } = response.data;

        // Si c'est une TC ou un bonus mission avec compétences, rendre la vue compétences (2 colonnes)
        const evalType = evaluation ? String(evaluation.type || '').trim() : '';
        const hasCompetenceIds = evaluation && this._parseCompetenceIds(evaluation, {}).length > 0;
        const isCompetenceReview = evalType === 'competences' || (evalType === 'bonus' && hasCompetenceIds);
        if (isCompetenceReview) {
            this._renderTCReview(resultat, evaluation, competences || [], criteres || []);
            this.showContent();
            return;
        }

        // Reconstruire this.evaluation pour _buildResultHTML
        this.evaluation = {
            id: evalId,
            titre: evaluation ? evaluation.titre : '',
            type: evaluation ? String(evaluation.type || 'connaissances').trim() : 'connaissances',
            briques: evaluation ? (parseInt(evaluation.briques) || 1) : 1,
            seuil: evaluation ? (parseInt(evaluation.seuil) || 80) : 80,
            attribution: {
                banque_id: resultat.banque_id || '',
                banque_titre: banque_titre || ''
            }
        };

        // Reconstruire globalResult
        const isValidated = resultat.is_validated === true || resultat.is_validated === 'true' || resultat.is_validated === 'TRUE';
        const score = parseInt(resultat.score) || 0;
        const tempsPasse = parseInt(resultat.temps_passe) || 0;
        const validations = parseFloat(resultat.validations) || 0;

        // Reconstituer correct/total depuis details
        let correct = 0;
        let total = 0;
        const details = Array.isArray(resultat.details) ? resultat.details : [];
        details.forEach(d => {
            if (d) {
                correct += (d.c || 0);
                total += (d.t || 0);
            }
        });

        const globalResult = {
            score: score,
            correct: correct,
            total: total,
            isValidated: isValidated,
            pointsEarned: validations,
            elapsedTime: tempsPasse,
            correctionHtml: resultat.correction_html || this._getLocalCorrection(evalId, eleveId)
        };

        // Masquer le container d'exercice, afficher le résultat
        const exerciseContainer = document.getElementById('exerciseContainer');
        if (exerciseContainer) exerciseContainer.style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = this._buildResultHTML(globalResult);
        this._initCarouselNav();

        this.showContent();
    },

    // ========== VUE REVIEW TC (2 colonnes) ==========

    /**
     * Rendu de la vue review pour une tâche complexe.
     * Layout 2 colonnes : remarque/corrigé à gauche, critères à droite.
     */
    _renderTCReview(resultat, evaluation, competences, criteres) {
        const exerciseContainer = document.getElementById('exerciseContainer');
        if (exerciseContainer) exerciseContainer.style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';

        const titre = evaluation.titre || 'Évaluation';
        const matiere = evaluation.matiere || '';
        const matiereLabel = matiere === 'FR' ? 'Français' : matiere === 'HG-EMC' ? 'HG-EMC' : matiere;
        // Correction brouillon ? Ne pas montrer
        const isBrouillon = String(resultat.statut_correction || '').trim() === 'brouillon';

        // Parse correction prof (remarque individuelle)
        const correctionProf = !isBrouillon ? (resultat.correction_prof || '') : '';

        // Corrigé type (de l'évaluation elle-même)
        const correctionType = !isBrouillon ? (evaluation.correction_contenu || evaluation.correction_commentee || '') : '';

        // Parse critères validés
        let criteresValides = [];
        if (!isBrouillon && resultat.criteres_valides) {
            try { criteresValides = JSON.parse(resultat.criteres_valides); } catch (_e) { /* ignore */ }
        }

        // Parse competence_ids de l'évaluation
        let compIds = [];
        if (evaluation.competence_ids) {
            try {
                const parsed = typeof evaluation.competence_ids === 'string' ? JSON.parse(evaluation.competence_ids) : evaluation.competence_ids;
                compIds = Array.isArray(parsed) ? parsed.map(String) : [];
            } catch (_e) { /* ignore */ }
        }

        // Parse points par compétence (résultat et évaluation)
        let resPpc = null;
        if (resultat.points_par_competence) {
            try {
                const parsed = typeof resultat.points_par_competence === 'string' ? JSON.parse(resultat.points_par_competence) : resultat.points_par_competence;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) resPpc = parsed;
            } catch (_e) { /* ignore */ }
        }
        let evalPpc = null;
        if (evaluation.points_par_competence) {
            try {
                const parsed = typeof evaluation.points_par_competence === 'string' ? JSON.parse(evaluation.points_par_competence) : evaluation.points_par_competence;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) evalPpc = parsed;
            } catch (_e) { /* ignore */ }
        }

        // --- Calculer les points gagnés par matière (pour afficher dans la sidebar) ---
        const pointsParMatiere = {};
        if (resPpc && evalPpc) {
            compIds.forEach(cid => {
                const comp = competences.find(c => String(c.id) === String(cid));
                const compMat = comp ? (comp.matiere || 'Transversal') : 'Transversal';
                if (!pointsParMatiere[compMat]) pointsParMatiere[compMat] = { gained: 0, max: 0 };
                pointsParMatiere[compMat].gained += parseFloat(resPpc[String(cid)]) || 0;
                pointsParMatiere[compMat].max += parseFloat(evalPpc[String(cid)]) || 1;
            });
        }

        // --- Colonne gauche : onglets Remarque / Corrigé ---
        const hasRemarque = !!correctionProf;
        const hasCorrige = !!correctionType;
        const hasTabs = hasRemarque && hasCorrige;

        let tabsHtml = '';
        if (hasTabs) {
            tabsHtml = `
                <div class="tc-review-tabs">
                    <button class="tc-review-tab active" data-tab="remarque" onclick="EleveEvaluation._switchTCTab('remarque')">📝 Remarque</button>
                    <button class="tc-review-tab" data-tab="corrige" onclick="EleveEvaluation._switchTCTab('corrige')">📋 Corrigé</button>
                </div>
            `;
        }

        let remarqueHtml = '';
        if (hasRemarque) {
            remarqueHtml = `<div class="tc-review-tab-content${hasTabs ? ' active' : ''}" id="tcTabRemarque">
                <div class="sujet-document-content">${this._buildCorrectionContent(correctionProf)}</div>
            </div>`;
        }

        let corrigeHtml = '';
        if (hasCorrige) {
            corrigeHtml = `<div class="tc-review-tab-content${!hasRemarque ? ' active' : ''}" id="tcTabCorrige">
                <div class="sujet-document-content">${this._buildCorrectionContent(correctionType)}</div>
            </div>`;
        }

        const leftEmpty = !hasRemarque && !hasCorrige;
        const leftContent = leftEmpty
            ? '<div class="tc-review-empty">Pas de remarque ni de correction disponible.</div>'
            : `${tabsHtml}${remarqueHtml}${corrigeHtml}`;

        // --- Colonne droite : compétences groupées par matière, critères collapsibles ---
        let sidebarContent = '';

        // Parse compétences personnalisées (nouveau format criteres_libres)
        let customComps = [];
        if (evaluation.criteres_libres) {
            try {
                const parsedCL = typeof evaluation.criteres_libres === 'string' ? JSON.parse(evaluation.criteres_libres) : evaluation.criteres_libres;
                if (Array.isArray(parsedCL) && parsedCL.length > 0 && typeof parsedCL[0] === 'object' && parsedCL[0].nom) {
                    customComps = parsedCL;
                }
            } catch (_e) { /* ignore */ }
        }

        // Parse competence_ids_validees pour les compétences perso
        let compIdsValidees = {};
        if (resultat.competence_ids_validees) {
            try {
                compIdsValidees = typeof resultat.competence_ids_validees === 'string' ? JSON.parse(resultat.competence_ids_validees) : resultat.competence_ids_validees;
            } catch (_e) { /* ignore */ }
        }

        // Ajouter les points des compétences perso au pointsParMatiere
        if (resPpc && customComps.length > 0) {
            customComps.forEach(cc => {
                const ccMat = cc.matiere || 'FR';
                if (!pointsParMatiere[ccMat]) pointsParMatiere[ccMat] = { gained: 0, max: 0 };
                pointsParMatiere[ccMat].gained += parseFloat(resPpc[cc.id]) || 0;
                pointsParMatiere[ccMat].max += cc.points || 1;
            });
        }

        const hasComps = compIds.length > 0 || customComps.length > 0;
        if (!isBrouillon && hasComps) {
            let totalComps = compIds.length + customComps.length;
            let nbCompsValidees = 0;

            // Regrouper par matière
            const matiereOrder = ['FR', 'HG-EMC', 'Les deux', 'Transversal'];
            const matiereLabels = { 'FR': 'Français', 'HG-EMC': 'HG-EMC', 'Les deux': 'Transversal', 'Transversal': 'Transversal' };
            const matiereColors = { 'FR': '#6366f1', 'HG-EMC': '#ea580c', 'Les deux': '#6b7280', 'Transversal': '#6b7280' };
            const matiereBgs = { 'FR': '#eef2ff', 'HG-EMC': '#fff7ed', 'Les deux': '#f3f4f6', 'Transversal': '#f3f4f6' };

            const compsData = [];
            compIds.forEach(compId => {
                const comp = competences.find(c => String(c.id) === String(compId));
                const compCriteres = criteres
                    .filter(c => String(c.competence_id) === String(compId))
                    .sort((a, b) => (parseInt(a.ordre) || 0) - (parseInt(b.ordre) || 0));
                if (compCriteres.length === 0) return;

                const allValid = compCriteres.every(c => criteresValides.indexOf(String(c.id)) !== -1);
                if (allValid) nbCompsValidees++;

                compsData.push({
                    name: comp ? (comp.nom || 'Compétence') : 'Compétence',
                    matiere: (comp && comp.matiere) || 'Transversal',
                    allValid,
                    criteres: compCriteres
                });
            });

            // Ajouter les compétences personnalisées à compsData
            customComps.forEach(cc => {
                const ccId = cc.id || 'custom_0';
                const ccCriteres = (cc.criteres || []).map((cr, ci) => ({
                    id: 'cc_' + ccId + '_' + ci,
                    libelle: cr
                }));
                const ccValides = compIdsValidees[ccId] || [];
                const allValid = ccCriteres.length > 0
                    ? ccCriteres.every(c => ccValides.indexOf(String(c.id)) !== -1)
                    : (resPpc && parseFloat(resPpc[ccId]) > 0);
                if (allValid) nbCompsValidees++;

                compsData.push({
                    name: cc.nom || 'Compétence personnalisée',
                    matiere: cc.matiere || 'FR',
                    allValid: !!allValid,
                    criteres: ccCriteres,
                    isCustom: true
                });
            });

            // Grouper par matière
            const groups = {};
            compsData.forEach(cd => {
                if (!groups[cd.matiere]) groups[cd.matiere] = [];
                groups[cd.matiere].push(cd);
            });
            const sortedKeys = Object.keys(groups).sort((a, b) => {
                const ia = matiereOrder.indexOf(a) === -1 ? 99 : matiereOrder.indexOf(a);
                const ib = matiereOrder.indexOf(b) === -1 ? 99 : matiereOrder.indexOf(b);
                return ia - ib;
            });

            let blocksHtml = '';
            sortedKeys.forEach(mat => {
                const label = matiereLabels[mat] || mat;
                const color = matiereColors[mat] || '#6b7280';
                const bg = matiereBgs[mat] || '#f3f4f6';
                const matPts = pointsParMatiere[mat];
                const ptsLabel = matPts ? `${matPts.gained} / ${matPts.max} pt${matPts.max > 1 ? 's' : ''}` : '';

                let cardsHtml = '';
                groups[mat].forEach(cd => {
                    const nbCriteres = cd.criteres.length;
                    // Pour compétences perso, les validations sont dans compIdsValidees[ccId]
                    const validationSource = cd.isCustom ? [] : criteresValides;
                    const nbValides = cd.criteres.filter(c => {
                        if (cd.isCustom) {
                            // Trouver le ccId dans le nom du critère id (format: cc_<ccId>_<ci>)
                            const parts = String(c.id).split('_');
                            const ccId = parts.slice(1, -1).join('_');
                            return (compIdsValidees[ccId] || []).indexOf(String(c.id)) !== -1;
                        }
                        return validationSource.indexOf(String(c.id)) !== -1;
                    }).length;

                    cardsHtml += `
                        <div class="sujet-criteres-block" style="border-left: 3px solid ${cd.allValid ? '#10b981' : color};">
                            <button type="button" class="sujet-comp-toggle" onclick="EleveEvaluation._toggleCriteres(this)">
                                <span class="sujet-comp-arrow">▸</span>
                                <h4 class="sujet-criteres-title">${cd.isCustom ? '✏️ ' : ''}${escapeHtml(cd.name)}</h4>
                                <span class="tc-review-comp-badge ${cd.allValid ? 'validated' : 'not-validated'}">${cd.allValid ? '✅ Validée' : `${nbValides}/${nbCriteres}`}</span>
                            </button>
                            <div class="sujet-criteres-list" style="display: none;">
                                ${cd.criteres.map(c => {
                                    let isValid;
                                    if (cd.isCustom) {
                                        const parts = String(c.id).split('_');
                                        const ccId = parts.slice(1, -1).join('_');
                                        isValid = (compIdsValidees[ccId] || []).indexOf(String(c.id)) !== -1;
                                    } else {
                                        isValid = criteresValides.indexOf(String(c.id)) !== -1;
                                    }
                                    return `<div class="sujet-critere-item" style="background: ${isValid ? '#f0fdf4' : '#fef2f2'};">
                                        <span class="sujet-critere-check" style="color: ${isValid ? '#10b981' : '#ef4444'};">${isValid ? '✅' : '❌'}</span>
                                        <span class="sujet-critere-label">${escapeHtml(c.libelle)}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                });

                blocksHtml += `
                    <div class="tc-matiere-block">
                        <div class="tc-matiere-header" style="background: ${bg}; color: ${color};">
                            <span>${escapeHtml(label)}</span>
                            ${ptsLabel ? `<span class="tc-matiere-pts">${ptsLabel}</span>` : ''}
                        </div>
                        <div class="tc-matiere-body">${cardsHtml}</div>
                    </div>
                `;
            });

            sidebarContent = `
                <div class="tc-review-comps-container">
                    <div class="sujet-sidebar-title">Compétences évaluées</div>
                    <p class="tc-review-criteres-summary">${nbCompsValidees} / ${totalComps} compétence${totalComps > 1 ? 's' : ''} validée${nbCompsValidees > 1 ? 's' : ''}</p>
                    ${blocksHtml}
                </div>
            `;
        } else if (isBrouillon) {
            sidebarContent = '<div class="tc-review-empty">La correction n\'est pas encore disponible.</div>';
        }

        // --- Assemblage : layout pleine largeur comme le sujet ---
        resultContainer.innerHTML = `
            <div class="sujet-view sujet-view-tc">
                <div class="sujet-topbar">
                    <button class="sujet-back-btn" onclick="window.location.href='evaluations.html'">←</button>
                    <div class="sujet-topbar-info">
                        <h1>${escapeHtml(titre)}</h1>
                        <div class="sujet-topbar-meta">
                            <span class="sujet-mode-badge tc">${String(evaluation.type || '').trim() === 'bonus' ? 'Bonus mission' : 'Évaluation de compétence'}</span>
                            ${matiereLabel ? `<span class="sujet-mode-badge matiere">${escapeHtml(matiereLabel)}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="sujet-layout">
                    <div class="sujet-document-section">
                        ${leftContent}
                    </div>
                    <div class="sujet-sidebar-section">
                        ${sidebarContent}
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Construit le HTML d'un contenu de correction (blocs JSON, URL, ou HTML brut).
     */
    _buildCorrectionContent(content) {
        if (!content) return '';

        // URL directe ?
        if (typeof content === 'string' && content.indexOf('http') === 0) {
            // Vidéo Loom, YouTube, Drive → embed
            const ytMatch = content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            const loomMatch = content.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
            const driveVidMatch = content.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);

            if (ytMatch || loomMatch || driveVidMatch) {
                return `<div class="block-video">${this._buildVideoEmbed(content)}</div>`;
            }
            // Document Google Docs
            const embedUrl = content.includes('/edit') ? content.replace('/edit', '/preview') : content;
            return `<div class="block-document"><iframe src="${escapeHtml(embedUrl)}" class="sujet-iframe" allowfullscreen></iframe></div>`;
        }

        // Blocs JSON ?
        try {
            const blocks = JSON.parse(content);
            if (Array.isArray(blocks)) {
                return this._renderBlocksReadOnly(blocks);
            }
        } catch (_e) { /* pas du JSON */ }

        // HTML brut
        return `<div class="block-text">${content}</div>`;
    },

    /**
     * Toggle onglet Remarque / Corrigé dans la vue TC review.
     */
    _switchTCTab(tab) {
        document.querySelectorAll('.tc-review-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tc-review-tab-content').forEach(panel => {
            panel.classList.toggle('active', panel.id === (tab === 'remarque' ? 'tcTabRemarque' : 'tcTabCorrige'));
        });
    },

    // ========== SETUP CONNAISSANCES ==========

    /**
     * Injecte les données dans EleveConnaissances et configure le mode évaluation.
     * Remplace certaines méthodes pour piloter le flow depuis l'évaluation.
     */
    setupConnaissancesModule() {
        const EC = EleveConnaissances;
        const self = this;

        // Injecter les données
        EC.etapes = this._rawEtapes;
        EC.etapeQuestions = this._rawEtapeQuestions;
        EC.questionsConnaissances = this._rawQuestionsConnaissances;

        // Initialiser l'état d'entraînement
        EC.currentEtapes = this._rawEtapes;
        EC.currentEtapeIndex = 0;
        EC.currentEtapeValidated = false;
        EC.etapesResults = [];
        EC.selectedQuestionsPerEtape = {};
        EC.userAnswers = {};
        EC._answerStore = {};
        EC._multiFormatState = null;

        // Faux entraînement/banque pour le rendu du header
        EC.currentEntrainement = {
            id: 'eval_' + this.evaluation.id,
            titre: this.evaluation.titre,
            duree: null, // Timer géré par EleveEvaluation
            seuil: this.evaluation.seuil
        };
        EC.currentBanque = {
            id: 'eval_banque',
            titre: this.evaluation.chapitre_nom || ''
        };

        // Remplacer finishEntrainement pour déclencher la logique évaluation
        EC.finishEntrainement = function() {
            self.finishEvaluation();
        };

        // Remplacer handleTimeUp
        EC.handleTimeUp = function() {
            self.onTimeExpired();
        };

        // Désactiver backToList — l'élève ne peut pas quitter pendant l'évaluation
        EC.backToList = function() {
            // Bloquer la navigation — l'évaluation doit être terminée
        };

        // Remplacer renderEntrainementView pour utiliser le layout évaluation
        EC.renderEntrainementView = function() {
            self.renderExerciseView();
        };
    },

    // ========== SETUP SAVOIR-FAIRE ==========

    /**
     * Configure EleveExercices en mode évaluation pour un exercice SF.
     * L'exercice est injecté directement (pas d'appel API getExercice).
     */
    setupSFModule() {
        const EE = EleveExercices;
        const question = this._rawSFQuestions[0];

        // Construire un objet exercice compatible avec EleveExercices
        EE.currentExercise = {
            id: question.id,
            titre: question.enonce || 'Exercice',
            donnees: typeof question.donnees === 'string'
                ? question.donnees
                : JSON.stringify(question.donnees || {}),
            format_id: question.format_id || (question.format && question.format.id) || '',
            duree: null, // Timer géré par EleveEvaluation, pas par EleveExercices
            consigne: question.consigne || ''
        };

        // Stocker le format pour que getFormatHandler fonctionne
        EE.formats = question.format ? [question.format] : [];
        EE.currentType = 'savoir-faire';
        EE.isEntrainementLibre = false;
        EE.exerciseStartTime = Date.now();
        EE.isValidating = false;

        // Empêcher le timer SF de démarrer (on utilise celui de l'évaluation)
        EE.startTimer = function() {};
        EE.stopTimer = function() {};
    },

    // ========== RENDU PRINCIPAL ==========
    render() {
        if (this.evaluation.type === 'savoir-faire') {
            this.renderSFExerciseView();
        } else {
            this.renderExerciseView();
        }
    },

    /**
     * Rendu de la vue exercice connaissances dans le conteneur de l'évaluation.
     * Réutilise le même layout que les entraînements (exercise-card)
     * et délègue le contenu à EleveConnaissances.renderEtapeContent().
     */
    renderExerciseView() {
        const EC = EleveConnaissances;
        const etapes = EC.currentEtapes;
        const currentEtape = etapes[EC.currentEtapeIndex];
        const isValidated = EC.currentEtapeValidated;
        const isLastEtape = EC.currentEtapeIndex >= etapes.length - 1;
        const isFlashcard = currentEtape.format_code === 'flashcard';

        // Récupérer les questions liées à cette étape
        const etapeQuestions = EC.etapeQuestions
            .filter(eq => String(eq.etape_id) === String(currentEtape.id))
            .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

        const typeLabel = this.getTypeLabel(this.evaluation.type);
        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="exercise-view eval-exercise-view">
                <div class="exercise-card">
                    <!-- Bandeau avec titre, type, points et timer -->
                    <div class="exercise-header connaissances">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${escapeHtml(this.evaluation.titre)}</h1>
                                <div class="exercise-header-meta">
                                    ${escapeHtml(typeLabel)} · ${this.evaluation.briques} pt${this.evaluation.briques > 1 ? 's' : ''} en jeu · Seuil : ${this.evaluation.type === 'savoir-faire' ? '100%' : this.evaluation.seuil + '%'} · Étape ${EC.currentEtapeIndex + 1}/${etapes.length}
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="exerciseTimer">
                            <span id="timerDisplay">${this.formatTime(this.remainingTime)}</span>
                        </div>
                    </div>

                    <!-- Barre de progression des étapes -->
                    <div class="etapes-navigation">
                        <div class="etapes-progress">
                            ${etapes.map((etape, idx) => {
                                const validated = idx < EC.etapesResults.length;
                                const isCurrent = idx === EC.currentEtapeIndex;
                                return `<div class="etape-dot ${validated ? 'completed' : ''} ${isCurrent ? 'current' : ''}"
                                     title="Étape ${idx + 1}">
                                    ${validated ? '✓' : idx + 1}
                                </div>`;
                            }).join('<div class="etape-connector"></div>')}
                        </div>
                    </div>

                    <!-- Titre de l'étape -->
                    <div class="etape-header">
                        <h2>${escapeHtml(currentEtape.titre || 'Étape ' + (EC.currentEtapeIndex + 1))}</h2>
                        <span class="qcm-header-counter" id="qcmHeaderCounter"></span>
                        <span class="etape-format-badge">${EC.getFormatLabel(currentEtape.format_code)}</span>
                    </div>
                    <!-- Barre de progression intra-étape (multi-questions) -->
                    <div class="multi-progress-bar hidden" id="multiProgressBar">
                        <div class="multi-progress-fill" id="multiProgressFill"></div>
                    </div>

                    <!-- Contenu de l'étape (questions) — rendu par EleveConnaissances -->
                    <div class="exercise-content ${isValidated ? 'validated' : ''}" id="exerciseContent">
                        ${EC.renderEtapeContent(currentEtape, etapeQuestions)}
                    </div>

                    <!-- Zone de feedback (visible après validation) -->
                    <div class="etape-feedback hidden" id="etapeFeedback"></div>

                    <!-- Bouton d'action -->
                    <div class="etape-action-bar" id="etapeActionBar">
                        ${isFlashcard ? '' : `
                            <button class="btn-etape-action ${isValidated ? (isLastEtape ? 'finish-btn' : 'next-btn') : 'validate-btn'}" onclick="EleveConnaissances.${isValidated ? (isLastEtape ? 'finishEntrainement' : 'nextEtape') : 'validateCurrentEtape'}()">
                                ${isValidated ? (isLastEtape ? 'Terminer ✓' : 'Suivant →') : 'Valider'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;

        // Synchroniser l'affichage du timer avec le nouvel élément
        this.updateTimerDisplay();

        // Gérer le multi-questions (carrousel QCM, V/F, etc.)
        const qcmMulti = document.querySelector('.qcm-multi');
        const vfMulti = document.querySelector('.vf-multi');
        const qoMulti = document.querySelector('.qo-multi');
        const mfMulti = document.querySelector('.multi-format-container');
        const flashcardContainer = document.querySelector('.flashcard-container');
        const multiTotal = qcmMulti ? parseInt(qcmMulti.getAttribute('data-total-q'))
                         : vfMulti ? parseInt(vfMulti.getAttribute('data-total-vf'))
                         : qoMulti ? parseInt(qoMulti.getAttribute('data-total-qo'))
                         : mfMulti ? parseInt(mfMulti.getAttribute('data-total-mf'))
                         : 0;
        if (multiTotal > 1) {
            const validateBtn = document.querySelector('#etapeActionBar .validate-btn');
            if (validateBtn) validateBtn.classList.add('hidden');
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Question 1 / ${multiTotal}`;
            EC.updateMultiProgressBar(1, multiTotal);
        }
        if (flashcardContainer && EC.flashcardState) {
            const headerCounter = document.getElementById('qcmHeaderCounter');
            if (headerCounter) headerCounter.textContent = `Carte 1 / ${EC.flashcardState.total}`;
            EC.updateMultiProgressBar(1, EC.flashcardState.total);
        }
    },

    /**
     * Rendu de la vue exercice SF dans le conteneur de l'évaluation.
     * Utilise les FORMAT_HANDLERS de EleveExercices pour le rendu.
     */
    renderSFExerciseView() {
        const EE = EleveExercices;
        const exo = EE.currentExercise;
        const format = EE.formats[0];

        const donnees = parseJSONField(exo.donnees);
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        // Générer le HTML du contenu via le format handler
        const handler = EE.getFormatHandler(typeUI);
        let contentHTML = '';
        if (handler && handler.render) {
            contentHTML = handler.render.call(EE, donnees, structure);
        } else {
            contentHTML = `<div style="text-align:center; color:#6b7280; padding:2rem;">
                <p>Format d'exercice non supporté : ${escapeHtml(typeUI)}</p>
            </div>`;
        }

        const typeLabel = this.getTypeLabel(this.evaluation.type);
        const container = document.getElementById('exerciseContainer');
        container.innerHTML = `
            <div class="exercise-view eval-exercise-view">
                <div class="exercise-card">
                    <div class="exercise-header savoir-faire">
                        <div class="exercise-header-left">
                            <div class="exercise-header-info">
                                <h1>${escapeHtml(this.evaluation.titre)}</h1>
                                <div class="exercise-header-meta">
                                    ${escapeHtml(typeLabel)} · ${this.evaluation.briques} pt${this.evaluation.briques > 1 ? 's' : ''} en jeu · Seuil : 100%
                                </div>
                            </div>
                        </div>
                        <div class="exercise-timer" id="exerciseTimer">
                            <span id="timerDisplay">${this.formatTime(this.remainingTime)}</span>
                        </div>
                    </div>

                    ${exo.consigne ? `
                        <div class="exercise-consigne">${escapeHtml(exo.consigne)}</div>
                    ` : ''}

                    <div class="exercise-content" id="exerciseContent">
                        ${contentHTML}
                    </div>

                    <div class="exercise-actions">
                        <button class="btn btn-verifier" id="btnTerminerEval" onclick="EleveEvaluation.finishEvaluation()">
                            Terminer
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.updateTimerDisplay();
    },

    getTypeLabel(type) {
        const labels = {
            connaissances: 'Connaissances',
            'savoir-faire': 'Savoir-faire',
            competences: 'Compétences',
            bonus: 'Bonus'
        };
        return labels[type] || type;
    },

    // ========== APPEL API (JSONP) ==========
    async callAPI(action, params = {}) {
        const url = new URL(CONFIG.WEBAPP_URL);
        url.searchParams.set('action', action);

        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });

        return new Promise((resolve, reject) => {
            const callbackName = 'evalCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const script = document.createElement('script');

            window[callbackName] = (data) => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                resolve(data);
            };

            script.onerror = () => {
                delete window[callbackName];
                if (script.parentNode) document.body.removeChild(script);
                reject(new Error('Erreur réseau'));
            };

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

    // ========== AFFICHAGE ==========
    showContent() {
        document.getElementById('loader').style.display = 'none';
        document.getElementById('evaluationContent').style.display = 'block';
    },

    showError(message) {
        document.getElementById('loader').innerHTML = `
            <div class="error-state">
                <span style="font-size: 48px;">:(</span>
                <p>${escapeHtml(message)}</p>
                <button class="btn btn-secondary" onclick="window.history.back()">Retour</button>
            </div>
        `;
    },

    // ========== TIMER ==========
    startTimer() {
        this.timeExpired = false;
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimer(), 1000);
    },

    updateTimer() {
        if (this.remainingTime > 0) {
            this.remainingTime--;
            this.updateTimerDisplay();

            const timerEl = document.getElementById('exerciseTimer');
            if (timerEl && this.remainingTime <= 60) {
                timerEl.classList.add('warning');
            }
        } else {
            this.onTimeExpired();
        }
    },

    updateTimerDisplay() {
        const timeStr = this.formatTime(this.remainingTime);
        // Mettre à jour le timer dans le header évaluation (si encore visible)
        const timerValueEl = document.getElementById('timerValue');
        if (timerValueEl) timerValueEl.textContent = timeStr;
        // Mettre à jour le timer dans le bandeau exercise-header
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) timerDisplay.textContent = timeStr;
    },

    onTimeExpired() {
        this.stopTimer();
        this.timeExpired = true;
        this.finishEvaluation();
    },

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    getElapsedTime() {
        return this.duration - this.remainingTime;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ========== FIN D'ÉVALUATION ==========
    async finishEvaluation() {
        if (this.isSubmitting) return;
        this.isSubmitting = true;

        this.stopTimer();

        let globalResult;

        if (this.evaluation.type === 'savoir-faire') {
            globalResult = this._finishSF();
        } else {
            globalResult = this._finishConnaissances();
        }

        // Afficher un écran d'attente pendant la sauvegarde
        this._showSaving();

        // Sauvegarder les résultats — bloquant
        const saveOk = await this.saveResults(globalResult);

        if (saveOk) {
            this.showResults(globalResult);
        } else {
            this._showSaveFailure(globalResult);
        }
    },

    /**
     * Finalisation pour une évaluation de connaissances.
     */
    _finishConnaissances() {
        const EC = EleveConnaissances;

        // Valider l'étape en cours si pas encore fait
        if (!EC.currentEtapeValidated) {
            EC.validateCurrentEtape();
        }

        const globalResult = this.calculateGlobalResult();

        // Compiler les résultats détaillés pour la correction
        const detailedResults = EC.compileResults();
        globalResult.detailedResults = detailedResults;

        return globalResult;
    },

    /**
     * Finalisation pour une évaluation savoir-faire.
     * Valide l'exercice via le format handler de EleveExercices.
     */
    _finishSF() {
        const EE = EleveExercices;
        const format = EE.formats[0];
        const structure = parseJSONField(format?.structure);
        const typeUI = structure.type_ui || 'tableau_saisie';

        // Valider l'exercice via le format handler
        const handler = EE.getFormatHandler(typeUI);
        let result = { correct: 0, total: 0 };
        if (handler && handler.validate) {
            result = handler.validate.call(EE);
        }

        // Appliquer les corrections visuelles sur le DOM
        if (handler && handler.showCorrection) {
            handler.showCorrection.call(EE);
        }

        // Capturer le HTML corrigé pour l'afficher dans les résultats
        const exerciseContent = document.querySelector('.exercise-content');
        this._sfCorrectedHTML = exerciseContent ? exerciseContent.innerHTML : '';

        this._sfValidationResult = result;

        const { correct, total } = result;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        const isValidated = score === 100;

        return {
            score,
            correct,
            total,
            isValidated,
            pointsEarned: isValidated ? this.evaluation.briques : 0,
            elapsedTime: this.getElapsedTime()
        };
    },

    /** Écran d'attente pendant la sauvegarde */
    _showSaving() {
        document.getElementById('exerciseContainer').style.display = 'none';
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header">
                    <div class="loader" style="margin: 0 auto 16px;"></div>
                    <h2>Enregistrement en cours...</h2>
                    <p>Ne ferme pas cette page.</p>
                </div>
            </div>
        `;
    },

    /** Écran d'échec de sauvegarde avec bouton retry */
    _showSaveFailure(globalResult) {
        const resultContainer = document.getElementById('resultContainer');
        resultContainer.innerHTML = `
            <div class="evaluation-result">
                <div class="evaluation-result-header failed">
                    <div class="evaluation-result-icon">⚠️</div>
                    <h2>Erreur d'enregistrement</h2>
                    <p>Tes résultats n'ont pas pu être enregistrés.<br>
                    <small style="color:#666">${escapeHtml(this._saveDebug || 'Erreur inconnue')}</small></p>
                </div>
                <div class="result-actions" style="margin-top: 24px;">
                    <button class="btn btn-primary" id="retryBtn" onclick="EleveEvaluation._retrySave()">
                        Réessayer
                    </button>
                </div>
                <p style="text-align:center; margin-top:16px; color:#94a3b8; font-size:13px;">
                    Si le problème persiste, contacte ta professeure.<br>
                    Score : ${globalResult.score}% — ${globalResult.correct}/${globalResult.total} bonnes réponses
                </p>
            </div>
        `;
        // Stocker le résultat pour le retry
        this._pendingResult = globalResult;
    },

    /** Retry de sauvegarde */
    async _retrySave() {
        const btn = document.getElementById('retryBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enregistrement...'; }

        const saveOk = await this.saveResults(this._pendingResult);
        if (saveOk) {
            this.showResults(this._pendingResult);
        } else {
            this._showSaveFailure(this._pendingResult);
        }
    },

    calculateGlobalResult() {
        const EC = EleveConnaissances;
        let totalCorrect = 0;
        let totalQuestions = 0;

        EC.etapesResults.forEach(result => {
            if (result) {
                totalCorrect += result.correct;
                totalQuestions += result.total;
            }
        });

        const globalScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        let isValidated = false;
        if (this.evaluation.type === 'savoir-faire') {
            isValidated = globalScore === 100;
        } else {
            isValidated = globalScore >= this.evaluation.seuil;
        }

        return {
            score: globalScore,
            correct: totalCorrect,
            total: totalQuestions,
            isValidated,
            pointsEarned: isValidated ? this.evaluation.briques : 0,
            elapsedTime: this.getElapsedTime()
        };
    },

    /**
     * Calcule le statut effectif d'une évaluation à partir de ses dates.
     * Même logique que le backend et que EleveEvaluations.
     */
    _computeEffectiveStatut(evaluation) {
        if (evaluation.statut === 'brouillon' || evaluation.statut === 'terminee') return evaluation.statut;
        if (evaluation.mode_passation === 'papier') return evaluation.statut || 'brouillon';
        const now = new Date();
        if (evaluation.date_ouverture || evaluation.date_fermeture) {
            if (evaluation.date_ouverture && new Date(evaluation.date_ouverture) > now) return 'planifiee';
            if (evaluation.date_fermeture && new Date(evaluation.date_fermeture) < now) return 'terminee';
            return 'publiee';
        }
        return evaluation.statut || 'brouillon';
    },

    _getCurrentUserId() {
        try {
            if (typeof Auth !== 'undefined' && Auth.getCurrentUser) {
                const user = Auth.getCurrentUser();
                if (user && user.id) return user.id;
            }
            const sessionUser = sessionStorage.getItem('brikks_user');
            if (sessionUser) return JSON.parse(sessionUser).id;
            return null;
        } catch (e) {
            console.error('Erreur récupération utilisateur:', e);
            return null;
        }
    },

    /**
     * Sauvegarde les résultats de l'évaluation via l'API backend.
     * @returns {boolean} true si la sauvegarde a réussi
     */
    async saveResults(globalResult) {
        try {
            const eleveId = this._getCurrentUserId();
            if (!eleveId) {
                console.error('[EVAL SAVE] Pas d\'utilisateur connecté');
                this._saveDebug = 'Pas d\'utilisateur connecté';
                return false;
            }

            // Résumé compact (format différent selon conn/SF)
            let detailsCompact;
            if (this.evaluation.type === 'savoir-faire') {
                detailsCompact = [{
                    f: 'savoir-faire',
                    c: globalResult.correct,
                    t: globalResult.total,
                    p: globalResult.score
                }];
            } else {
                detailsCompact = EleveConnaissances.etapesResults.map(r => r ? {
                    i: r.etapeIndex,
                    f: r.format,
                    c: r.correct,
                    t: r.total,
                    p: r.pourcentage
                } : null);
            }

            const attribution = this.evaluation.attribution || {};
            const params = {
                evaluation_id: this.evaluation.id,
                eleve_id: eleveId,
                score: globalResult.score,
                validations: globalResult.pointsEarned,
                is_validated: globalResult.isValidated,
                temps_passe: globalResult.elapsedTime,
                details: JSON.stringify(detailsCompact),
                banque_id: attribution.banque_id || '',
                entrainement_id: attribution.entrainement_id || ''
            };

            // Stocker la correction HTML en localStorage pour le mode review
            // (ne pas l'envoyer via JSONP GET — l'URL serait trop longue et provoque des erreurs réseau)
            this._storeCorrectionLocally(this.evaluation.id, eleveId, globalResult);

            console.log('[EVAL SAVE] Envoi:', JSON.stringify(params));
            const result = await this.callAPI('saveEvaluationResult', params);
            console.log('[EVAL SAVE] Réponse:', JSON.stringify(result));

            if (!result.success) {
                this._saveDebug = 'API erreur: ' + (result.error || JSON.stringify(result));
                return false;
            }
            // Invalider le cache pour que la page liste affiche le résultat frais
            if (typeof SheetsAPI !== 'undefined' && SheetsAPI.clearCacheFor) {
                SheetsAPI.clearCacheFor('EVALUATION_RESULTATS');
            }
            return true;
        } catch (error) {
            console.error('[EVAL SAVE] Exception:', error);
            this._saveDebug = 'Exception: ' + error.message;
            return false;
        }
    },

    /**
     * Affiche le bilan post-évaluation en layout 2 colonnes.
     * Réutilisé pour le mode review (Phase 4).
     */
    showResults(globalResult) {
        this._removeBeforeUnload();
        document.getElementById('exerciseContainer').style.display = 'none';

        const resultContainer = document.getElementById('resultContainer');
        resultContainer.style.display = 'block';

        resultContainer.innerHTML = this._buildResultHTML(globalResult);

        // Init carrousel navigation si présent
        this._initCarouselNav();
    },

    /**
     * Stocke la correction HTML en localStorage pour le mode review.
     * Évite d'envoyer des données volumineuses via JSONP GET.
     */
    _storeCorrectionLocally(evalId, eleveId, globalResult) {
        try {
            const type = this.evaluation.type || 'connaissances';
            let correctionHtml = '';
            if (type === 'savoir-faire') {
                if (this._sfCorrectedHTML) correctionHtml = this._sfCorrectedHTML;
            } else {
                const EC = typeof EleveConnaissances !== 'undefined' ? EleveConnaissances : null;
                if (globalResult.detailedResults && EC && typeof EC.generateErrorDetails === 'function') {
                    correctionHtml = EC.generateErrorDetails(globalResult.detailedResults);
                }
            }
            if (correctionHtml) {
                const key = 'eval_correction_' + evalId + '_' + eleveId;
                localStorage.setItem(key, correctionHtml);
            }
        } catch (e) {
            // localStorage plein ou indisponible — pas critique
            console.warn('[EVAL] Impossible de stocker la correction localement:', e.message);
        }
    },

    /**
     * Récupère la correction HTML depuis localStorage (fallback si non stockée côté serveur).
     */
    _getLocalCorrection(evalId, eleveId) {
        try {
            return localStorage.getItem('eval_correction_' + evalId + '_' + eleveId) || '';
        } catch (e) {
            return '';
        }
    },

    /**
     * Construit le HTML du bilan 2 colonnes (réutilisé par showResults et mode review).
     */
    _buildResultHTML(globalResult) {
        const score = globalResult.score || 0;
        const isValidated = globalResult.isValidated;
        const type = this.evaluation.type || 'connaissances';
        const seuil = type === 'savoir-faire' ? 100 : (parseInt(this.evaluation.seuil) || 80);
        const attribution = this.evaluation.attribution || {};

        // Catégorie visuelle
        let colorClass = 'error';
        if (isValidated) colorClass = 'success';
        else if (score >= seuil / 2) colorClass = 'partial';

        const icon = isValidated ? '🎉' : (colorClass === 'partial' ? '💪' : '😔');
        const message = isValidated ? 'Évaluation validée !' : 'Évaluation non validée';

        // Correction détaillée (conn ou SF)
        let correctionHtml = globalResult.correctionHtml || '';
        if (!correctionHtml) {
            if (type === 'savoir-faire') {
                if (this._sfCorrectedHTML) correctionHtml = this._sfCorrectedHTML;
            } else {
                const EC = typeof EleveConnaissances !== 'undefined' ? EleveConnaissances : null;
                if (globalResult.detailedResults && EC && typeof EC.generateErrorDetails === 'function') {
                    correctionHtml = EC.generateErrorDetails(globalResult.detailedResults);
                }
            }
        }

        // Points affichage
        const points = globalResult.pointsEarned !== undefined ? globalResult.pointsEarned : 0;
        const briques = this.evaluation.briques || points;
        const pointsClass = isValidated ? 'earned' : 'lost';
        const pointsSign = isValidated ? '+' : '';

        // Temps
        const tempsStr = this.formatTime(globalResult.elapsedTime || 0);

        // Message conseil
        const conseilHtml = this._buildConseilHTML(isValidated, type, attribution);

        // Colonne droite
        let rightHtml;
        if (!correctionHtml || score === 100) {
            rightHtml = `
                <div class="eval-result-right is-felicitation">
                    <div class="felicitation-panel ${isValidated ? 'success' : ''}">
                        <span class="felicitation-icon">${isValidated ? '🏆' : '📝'}</span>
                        <h3>${isValidated ? 'Bravo, sans faute !' : 'Pas de correction disponible'}</h3>
                        <p>${isValidated ? 'Tu as tout réussi, continue comme ça !' : 'Les détails de correction ne sont pas disponibles pour cette évaluation.'}</p>
                    </div>
                </div>`;
        } else {
            rightHtml = `
                <div class="eval-result-right is-correction">
                    <div class="eval-correction-header">
                        <h3>Correction détaillée</h3>
                    </div>
                    <div class="eval-correction-body">
                        ${correctionHtml}
                    </div>
                </div>`;
        }

        return `
            <div class="eval-result-card">
                <div class="eval-result-bilan">
                    <div class="bilan-header ${colorClass}">
                        <span class="bilan-icon">${icon}</span>
                        <span class="bilan-message">${message}</span>
                    </div>

                    <div class="bilan-score">
                        <div class="score-circle ${colorClass}">${score}%</div>
                        <div class="score-detail">${globalResult.correct || 0}/${globalResult.total || 0} bonnes réponses</div>
                    </div>

                    <div class="bilan-stats-row">
                        <div class="bilan-stat">
                            <span class="stat-icon">⏱</span>
                            <span class="stat-value">${tempsStr}</span>
                        </div>
                        <div class="bilan-stat">
                            <span class="stat-icon">🎯</span>
                            <span class="stat-value">Seuil : ${seuil}%</span>
                        </div>
                    </div>

                    <div class="bilan-points ${pointsClass}">
                        <span class="points-value">${pointsSign}${points}</span>
                        <span class="points-label">point${points > 1 ? 's' : ''} sur ${briques}</span>
                    </div>

                    ${conseilHtml}

                    <div class="bilan-actions">
                        <button class="btn btn-primary" onclick="window.location.href='evaluations.html'">
                            Retour aux évaluations
                        </button>
                    </div>
                </div>
                ${rightHtml}
            </div>
        `;
    },

    /**
     * Construit le message conseil avec lien vers la banque d'entraînement.
     */
    _buildConseilHTML(isValidated, type, attribution) {
        if (isValidated) {
            return `
                <div class="bilan-conseil success">
                    <span class="conseil-icon">✅</span>
                    <p>Bravo ! Continue à t'entraîner pour consolider tes acquis.</p>
                </div>`;
        }

        const banqueTitre = attribution.banque_titre || '';
        const page = type === 'connaissances' ? 'entrainements-conn.html' : 'entrainements-sf.html';
        const label = type === 'connaissances' ? 'connaissances' : 'savoir-faire';

        if (banqueTitre) {
            return `
                <div class="bilan-conseil warning">
                    <span class="conseil-icon">💡</span>
                    <div>
                        <p>Pour progresser, retravaille tes entraînements ${label} :</p>
                        <a href="${page}" class="conseil-link">${escapeHtml(banqueTitre)}</a>
                    </div>
                </div>`;
        }

        return `
            <div class="bilan-conseil warning">
                <span class="conseil-icon">💡</span>
                <p>Pour progresser, retravaille tes <a href="${page}">entraînements ${label}</a>.</p>
            </div>`;
    },

    /**
     * Initialise la navigation carrousel dans la correction (si présent).
     */
    _initCarouselNav() {
        const container = document.querySelector('.eval-correction-body');
        if (!container) return;

        // Réattacher les listeners du carrousel connaissances si présent
        const arrows = container.querySelectorAll('.carousel-arrow');
        const slides = container.querySelectorAll('.carousel-slide');
        if (arrows.length === 0 || slides.length === 0) return;

        let currentSlide = 0;
        const updateSlide = (idx) => {
            slides.forEach((s, i) => {
                s.classList.toggle('hidden', i !== idx);
            });
            currentSlide = idx;
            const prevBtn = container.querySelector('.carousel-arrow.prev');
            const nextBtn = container.querySelector('.carousel-arrow.next');
            if (prevBtn) prevBtn.disabled = idx === 0;
            if (nextBtn) nextBtn.disabled = idx === slides.length - 1;
            // Update dots
            container.querySelectorAll('.carousel-dot').forEach((d, i) => {
                d.classList.toggle('active', i === idx);
            });
        };

        const prevBtn = container.querySelector('.carousel-arrow.prev');
        const nextBtn = container.querySelector('.carousel-arrow.next');
        if (prevBtn) prevBtn.addEventListener('click', () => { if (currentSlide > 0) updateSlide(currentSlide - 1); });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (currentSlide < slides.length - 1) updateSlide(currentSlide + 1); });

        // Clickable overview rows
        container.querySelectorAll('[data-slide-index]').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.slideIndex);
                if (!isNaN(idx)) updateSlide(idx);
            });
        });

        updateSlide(0);
    },

    // ========== NAVIGATION ==========
    _beforeUnloadHandler: null,

    _addBeforeUnload() {
        this._beforeUnloadHandler = (e) => {
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

    closeConfirmModal() {
        document.getElementById('confirmModal').classList.add('hidden');
    }
};

window.EleveEvaluation = EleveEvaluation;
