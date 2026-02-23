Object.assign(EleveConnaissances, {
    validateCurrentEtape() {
        if (this.currentEtapeValidated) return;

        // Loading state sur le bouton
        const actionBtn = document.querySelector('#etapeActionBar .validate-btn');
        if (actionBtn) actionBtn.classList.add('is-loading');

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        // Utiliser les données combinées stockées lors du rendu (inclut multiQuestions)
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);

        let correct = 0;
        let total = 0;
        let details = [];

        const format = this.normalizeFormat(currentEtape.format_code);

        switch (format) {
            case 'vrai_faux':
                if (donnees.reponse !== undefined && !donnees.propositions) {
                    total = 1;
                    const answer = this.userAnswers['vf_0'];
                    const expected = donnees.reponse === true || donnees.reponse === 'vrai' ? 'vrai' : 'faux';
                    const isCorrect = answer === expected;
                    if (isCorrect) correct++;

                    // Construire le texte du feedback
                    let feedbackText = isCorrect ? 'Correct' : (!answer ? 'Non répondu' : 'Mauvaise réponse');

                    // Utiliser la fonction unifiée de feedback
                    this.displayUnifiedFeedback('feedback_vf_0', isCorrect, feedbackText, isCorrect ? 1 : 0, 1);
                    const feedbackVF = answer === 'vrai' ? (donnees.feedback_vrai || '') : (donnees.feedback_faux || '');
                    details.push({ question: donnees.question, reponse: answer, attendu: expected, correct: isCorrect, feedbackOption: feedbackVF });
                } else {
                    const propositions = donnees.propositions || [];
                    // Si validation question par question (carrousel), récupérer les résultats déjà stockés
                    if (this._vfResults && Object.keys(this._vfResults).length > 0) {
                        propositions.forEach((prop, idx) => {
                            total++;
                            const r = this._vfResults[idx];
                            if (r) {
                                if (r.correct) correct++;
                                details.push(r);
                            } else {
                                const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                                details.push({ question: prop.texte, reponse: null, attendu: expected, correct: false });
                            }
                        });
                    } else {
                        propositions.forEach((prop, idx) => {
                            total++;
                            const answer = this.userAnswers[`vf_${idx}`];
                            const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
                            const isCorrect = answer === expected;
                            if (isCorrect) correct++;

                            // Construire le texte du feedback
                            let feedbackText = isCorrect ? 'Correct' : (!answer ? 'Non répondu' : 'Mauvaise réponse');

                            // Utiliser la fonction unifiée de feedback
                            this.displayUnifiedFeedback(`feedback_vf_${idx}`, isCorrect, feedbackText, isCorrect ? 1 : 0, 1);
                            const feedbackVFMulti = answer === 'vrai' ? (prop.feedback_vrai || '') : (prop.feedback_faux || '');
                            details.push({ question: prop.texte, reponse: answer, attendu: expected, correct: isCorrect, feedbackOption: feedbackVFMulti });
                        });
                    }
                }
                break;

            case 'qcm':
                // Mode multi-questions (plusieurs QCM dans une étape)
                if (donnees.multiQuestions && donnees.multiQuestions.length > 0) {
                    // Si validation question par question (carrousel), récupérer les résultats déjà stockés
                    if (this._qcmResults && Object.keys(this._qcmResults).length > 0) {
                        donnees.multiQuestions.forEach((q, qIdx) => {
                            total++;
                            const r = this._qcmResults[qIdx];
                            if (r) {
                                if (r.correct) correct++;
                                details.push(r);
                            } else {
                                // Question non validée = incorrecte
                                const choices = q.choix || q.options || [];
                                const correctIndices = this.getQcmCorrectIndices(q);
                                details.push({
                                    question: q.question,
                                    reponse: null,
                                    attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                                    correct: false
                                });
                            }
                        });
                    } else {
                        // Fallback : validation classique (1 seule question ou pas de carrousel)
                        donnees.multiQuestions.forEach((q, qIdx) => {
                            total++;
                            const choices = q.choix || q.options || [];
                            const userAnswer = this.userAnswers[`qcm_${qIdx}`];

                            const correctIndices = this.getQcmCorrectIndices(q);
                            const isCorrect = correctIndices.includes(parseInt(userAnswer));
                            if (isCorrect) correct++;

                            // Construire le texte du feedback
                            let feedbackText = isCorrect ? 'Correct' : (userAnswer == null ? 'Non répondu' : 'Mauvaise réponse');

                            // Récupérer le feedback spécifique à l'option choisie
                            const feedbackOption = (q.feedbacks_options && userAnswer != null) ? (q.feedbacks_options[parseInt(userAnswer)] || '') : '';

                            // Utiliser la fonction unifiée de feedback
                            this.displayUnifiedFeedback(`feedback_qcm_${qIdx}`, isCorrect, feedbackText, isCorrect ? 1 : 0, 1, 'qcm');
                            details.push({
                                question: q.question,
                                reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
                                attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                                correct: isCorrect,
                                feedbackOption: feedbackOption
                            });
                        });
                    }
                } else {
                    // Mode simple (une seule question QCM)
                    total = 1;
                    const choices = donnees.choix || donnees.options || [];
                    const userAnswer = this.userAnswers['qcm'];

                    const correctIndices = this.getQcmCorrectIndices(donnees);
                    if (correctIndices.includes(parseInt(userAnswer))) correct = 1;

                    // Construire le texte du feedback
                    let feedbackText = correct === 1 ? 'Correct' : (userAnswer == null ? 'Non répondu' : 'Mauvaise réponse');

                    // Récupérer le feedback spécifique à l'option choisie
                    const feedbackOption = (donnees.feedbacks_options && userAnswer != null) ? (donnees.feedbacks_options[parseInt(userAnswer)] || '') : '';

                    // Utiliser la fonction unifiée de feedback
                    this.displayUnifiedFeedback('feedback_qcm', correct === 1, feedbackText, correct, 1, 'qcm');
                    details.push({
                        question: donnees.question,
                        reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
                        attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
                        correct: correct === 1,
                        feedbackOption: feedbackOption
                    });
                }
                break;

            case 'timeline':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                if (donnees.paires && donnees.mode) {
                    // Mode texte (chronologie)
                    const chronoAnswers = this.userAnswers['chrono'] || {};
                    const paires = donnees.paires || donnees.evenements || [];
                    const mode = donnees.mode || 'date';

                    const sortedEvents = this.sortEventsByDate(paires);

                    sortedEvents.forEach((evt, idx) => {
                        total++;
                        const answer = chronoAnswers[idx];
                        const inputEl = document.querySelector(`.chrono-input[data-index="${idx}"]`);
                        if (!inputEl) return;

                        let isCorrect = false;
                        let correctValue = mode === 'evenement' ? evt.evenement : String(evt.date);
                        let reponsesAcceptees = evt.reponses_acceptees || [];

                        if (answer && answer.value) {
                            const userValue = answer.value.trim().toLowerCase();
                            if (userValue === correctValue.trim().toLowerCase()) isCorrect = true;
                            if (!isCorrect && reponsesAcceptees.length > 0) {
                                isCorrect = reponsesAcceptees.some(alt => alt.trim().toLowerCase() === userValue);
                            }
                        }

                        inputEl.classList.remove('correct', 'incorrect');
                        if (isCorrect) {
                            correct++;
                            inputEl.classList.add('correct');
                        } else {
                            inputEl.classList.add('incorrect');
                            const container = inputEl.closest('.chrono-input-zone');
                            if (container && !container.querySelector('.chrono-correction')) {
                                const correction = document.createElement('span');
                                correction.className = 'chrono-correction';
                                correction.textContent = correctValue;
                                container.appendChild(correction);
                            }
                        }

                        // Ajouter l'affichage du score
                        const container = inputEl.closest('.chrono-input-zone');
                        if (container && !container.querySelector('.chrono-score')) {
                            const scoreSpan = document.createElement('span');
                            scoreSpan.className = 'chrono-score';
                            scoreSpan.textContent = isCorrect ? ' — 1/1 point' : ' — 0/1 point';
                            container.appendChild(scoreSpan);
                        }
                        details.push({ question: mode === 'evenement' ? evt.date : evt.evenement, reponse: answer?.value, attendu: correctValue, correct: isCorrect });
                    });
                } else {
                    // Mode drag (timeline cartes)
                    const cartes = donnees.cartes || [];
                    const cardsContainer = document.getElementById('timelineCards');
                    if (cardsContainer) {
                        const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));
                        total = cartes.length;

                        // Sauvegarder l'ordre de l'élève avant validation
                        const studentOrder = placedCards.map(c => parseInt(c.dataset.originalIndex));

                        placedCards.forEach((card, positionActuelle) => {
                            const originalIndex = parseInt(card.dataset.originalIndex);
                            card.classList.remove('correct', 'incorrect');
                            card.setAttribute('draggable', 'false');

                            const isCorrect = originalIndex === positionActuelle;
                            if (isCorrect) {
                                correct++;
                                card.classList.add('correct');
                            } else {
                                card.classList.add('incorrect');
                            }

                            // Score affiché globalement en haut, pas inline

                            details.push({ question: `Position ${positionActuelle + 1}`, reponse: cartes[originalIndex]?.titre, attendu: cartes[positionActuelle]?.titre, correct: originalIndex === positionActuelle });
                        });
                    }
                }

                // Afficher le feedback minimaliste avec score pour timeline
                if (!donnees.paires || !donnees.mode) {
                    const isTimelineCorrect = correct === total;
                    const feedbackText = isTimelineCorrect ? 'Correct' : 'Mauvaise réponse';
                    this.displayUnifiedFeedback('feedback_timeline', isTimelineCorrect, feedbackText, correct, total, 'chronologie');
                }
                break;

            case 'texte_trou':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const trouInputs = document.querySelectorAll('.trou-input');
                const trous = donnees.trous || [];

                trouInputs.forEach((input, idx) => {
                    total++;
                    const userValue = input.value.trim().toLowerCase();
                    const stored = this.getStoredAnswer(`trou_${idx}`);
                    const correctValue = stored ? stored.correct.toLowerCase() : '';

                    let alternatives = [];
                    if (trous[idx] && trous[idx].alternatives) {
                        alternatives = trous[idx].alternatives.map(a => a.toLowerCase());
                    }

                    input.classList.remove('correct', 'incorrect');
                    const isOk = userValue === correctValue || alternatives.includes(userValue);
                    if (isOk) {
                        correct++;
                        input.classList.add('correct');
                    } else {
                        input.classList.add('incorrect');
                    }

                    // Score affiché globalement en haut, pas inline

                    details.push({ question: `Trou ${idx + 1}`, reponse: input.value, attendu: stored ? stored.correct : '', correct: isOk });
                });

                // Afficher le feedback avec score pour texte à trous
                const isTexteTrousCorrect = correct === total;
                const allTrousEmpty = details.every(d => !d.reponse || d.reponse.trim() === '');
                const texteTrousTexte = isTexteTrousCorrect ? 'Correct' : (allTrousEmpty ? 'Non répondu' : 'Mauvaise réponse');
                this.displayUnifiedFeedback('feedback_texte_trous', isTexteTrousCorrect, texteTrousTexte, correct, total, 'chronologie');
                break;

            case 'carte':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const marqueurs = donnees.marqueurs || [];
                marqueurs.forEach((m, idx) => {
                    total++;
                    const answer = this.userAnswers['carte_' + idx];
                    const marker = document.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
                    const answerItem = document.querySelector(`.carte-answer-item[data-index="${idx}"]`);
                    const correctAnswer = (m.reponse || '').split('|')[0].trim();

                    if (answer) {
                        const userValue = answer.trim().toLowerCase();
                        const expectedValue = (m.reponse || '').trim().toLowerCase();
                        const reponsesAcceptees = m.reponses_acceptees || [];
                        const allAccepted = [expectedValue, ...reponsesAcceptees.map(r => r.trim().toLowerCase())];
                        const isCorrect = allAccepted.some(rep => userValue === rep);

                        if (isCorrect) {
                            correct++;
                            if (marker) marker.classList.add('correct');
                            if (answerItem) answerItem.classList.add('correct');
                        } else {
                            if (marker) marker.classList.add('incorrect');
                            if (answerItem) answerItem.classList.add('incorrect');
                        }

                        // Apply correction mode visualization
                        this.applyCarteCorrectionMode(marker, idx, isCorrect, answer, correctAnswer);

                        // Score affiché globalement en haut, pas inline

                        details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrect });
                    } else {
                        if (marker) marker.classList.add('incorrect');
                        if (answerItem) answerItem.classList.add('incorrect');

                        // Apply correction mode visualization
                        this.applyCarteCorrectionMode(marker, idx, false, null, correctAnswer);

                        // Ajouter l'affichage du score
                        if (answerItem && !answerItem.querySelector('.carte-answer-score')) {
                            const scoreSpan = document.createElement('span');
                            scoreSpan.className = 'carte-answer-score';
                            scoreSpan.textContent = ' — 0/1 point';
                            answerItem.appendChild(scoreSpan);
                        }

                        details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
                    }
                });

                // Afficher le feedback avec score pour carte
                const isCarteCorrect = correct === total;
                const allMarkersEmpty = details.every(d => !d.reponse);
                const carteTexte = isCarteCorrect ? 'Correct' : (allMarkersEmpty ? 'Non répondu' : 'Mauvaise réponse');
                this.displayUnifiedFeedback('feedback_carte', isCarteCorrect, carteTexte, correct, total, 'chronologie');
                break;

            case 'question_ouverte':
                // Multi-questions avec résultats pré-validés
                if (donnees.multiQuestions && donnees.multiQuestions.length > 0 && this._qoResults && Object.keys(this._qoResults).length > 0) {
                    donnees.multiQuestions.forEach((q, qIdx) => {
                        total++;
                        const r = this._qoResults[qIdx];
                        if (r) {
                            if (r.correct) correct++;
                            details.push(r);
                        } else {
                            details.push({ question: q.question, reponse: null, attendu: (q.reponses_acceptees || [])[0] || '', correct: false });
                        }
                    });
                } else {
                    // Format simple (une seule question)
                    total = 1;
                    const qoAnswer = this.userAnswers['question_ouverte'];
                    const qoReponsesAcceptees = donnees.reponses_acceptees || [];
                    const qoStricte = donnees.comparaison_stricte || false;
                    const qoFeedbackEl = document.getElementById('feedback_question_ouverte');
                    const qoInput = document.getElementById('questionOuverteReponse');

                    let qoCorrect = false;
                    if (qoAnswer) {
                        qoCorrect = qoReponsesAcceptees.some(rep => this.compareAnswers(qoAnswer, rep, qoStricte));
                    }
                    if (qoCorrect) correct = 1;

                    if (qoInput) {
                        qoInput.classList.remove('correct', 'incorrect');
                        qoInput.classList.add(qoCorrect ? 'correct' : 'incorrect');
                    }

                    if (qoFeedbackEl) {
                        // Construire le texte du feedback
                        let feedbackText = qoCorrect ? 'Correct' : (!qoAnswer || qoAnswer.trim() === '' ? 'Non répondu' : 'Mauvaise réponse');

                        // Utiliser la fonction unifiée de feedback
                        this.displayUnifiedFeedback('feedback_question_ouverte', qoCorrect, feedbackText, qoCorrect ? 1 : 0, 1);
                    }
                    details.push({ question: donnees.question, reponse: qoAnswer, attendu: qoReponsesAcceptees[0] || '', correct: qoCorrect });
                }
                break;

            case 'association':
                if (this._multiFormatState && this._multiFormatState.results && Object.keys(this._multiFormatState.results).length > 0) {
                    Object.entries(this._multiFormatState.results).forEach(([qIdx, r]) => { total += r.total; correct += r.correct; r.details.forEach(d => details.push({ ...d, questionIndex: parseInt(qIdx) })); });
                    break;
                }
                const assocPaires = donnees.paires || [];
                total = assocPaires.length;
                const userPairs = this.userAnswers['association'] || [];

                userPairs.forEach(up => {
                    // Retrouver les éléments visuels (grille + chip)
                    const gridId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
                    const chipId = this._assocChipSide === 'gauche' ? up.gauche : up.droite;
                    const gridEl = document.querySelector(`#associationGrid .association-grid-card[data-id="${gridId}"]`);
                    const chipEl = document.querySelector(`#associationChips .association-chip[data-id="${chipId}"]`);

                    const isCorrect = String(up.gauche) === String(up.droite);
                    if (isCorrect) {
                        correct++;
                        [gridEl, chipEl].forEach(el => { if (el) { el.classList.add('correct'); } });
                    } else {
                        [gridEl, chipEl].forEach(el => { if (el) { el.classList.add('incorrect'); } });
                    }
                    details.push({
                        question: assocPaires[parseInt(up.gauche)]?.element1 || up.gauche,
                        reponse: assocPaires[parseInt(up.droite)]?.element2 || up.droite,
                        attendu: assocPaires[parseInt(up.gauche)]?.element2 || '',
                        correct: isCorrect
                    });
                });
                // Ajouter les éléments non associés comme erreurs
                for (let i = 0; i < assocPaires.length; i++) {
                    const gridId = String(i);
                    const isMatched = userPairs.some(up => {
                        const upGridId = this._assocGridSide === 'gauche' ? String(up.gauche) : String(up.droite);
                        return upGridId === gridId;
                    });
                    if (!isMatched) {
                        details.push({
                            question: assocPaires[i].element1,
                            reponse: 'Non répondu',
                            attendu: assocPaires[i].element2,
                            correct: false
                        });
                    }
                }
                // Marquer les éléments non appariés comme incorrects
                document.querySelectorAll('#associationGrid .association-grid-card:not(.correct):not(.incorrect)').forEach(el => el.classList.add('incorrect'));

                // Désactiver l'interaction sur les chips et masquer le label d'instruction
                const chipsZone = document.querySelector('#associationChips');
                if (chipsZone) chipsZone.classList.add('disabled');
                const zoneLabel = document.querySelector('.association-zone-label');
                if (zoneLabel) zoneLabel.classList.add('hidden');

                // Afficher le feedback avec score
                const isAssocCorrect = correct === total;
                const allUnpaired = userPairs.length === 0;
                const assocFeedbackText = isAssocCorrect ? 'Correct' : (allUnpaired ? 'Non répondu' : 'Mauvaise réponse');
                this.displayUnifiedFeedback('association_feedback', isAssocCorrect, assocFeedbackText, correct, total, 'association');
                break;

            case 'flashcard':
                const flashResults = this.userAnswers['flashcard'] || [];
                const flashCartes = donnees.cartes || [];
                total = flashCartes.length;
                correct = flashResults.filter(r => r.savait).length;
                flashCartes.forEach((carte, idx) => {
                    const result = flashResults[idx];
                    details.push({ question: carte.recto, reponse: result ? (result.savait ? 'Je savais' : 'Je ne savais pas') : 'Non évalué', attendu: carte.verso, correct: result ? result.savait : false });
                });
                break;
        }

        // Marquer l'étape comme validée
        this.currentEtapeValidated = true;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        // Stocker le résultat pour le bilan final
        // Si multi-format, conserver les données de chaque sous-question pour la correction visuelle
        const subQuestions = (this._multiFormatState && this._multiFormatState.questions)
            ? this._multiFormatState.questions.map((q, qIdx) => ({
                qData: q,
                result: this._multiFormatState.results[qIdx] || { correct: 0, total: 0, details: [] }
            }))
            : null;

        this.etapesResults[this.currentEtapeIndex] = {
            etapeIndex: this.currentEtapeIndex,
            etapeTitre: currentEtape.titre || `Étape ${this.currentEtapeIndex + 1}`,
            format: currentEtape.format_code,
            correct,
            total,
            pourcentage: percent,
            details,
            donnees,
            subQuestions
        };

        // Désactiver les inputs
        const content = document.getElementById('exerciseContent');
        if (content) {
            content.classList.add('validated');
            content.querySelectorAll('input, select, textarea, button').forEach(el => {
                if (!el.closest('.etape-action-bar') && !el.closest('.timeline-toggle') && !el.closest('.carte-popup')) el.disabled = true;
            });
            // Désactiver les clics sur les items d'association (grille + chips)
            content.querySelectorAll('.association-grid-card, .association-chip').forEach(el => {
                el.style.pointerEvents = 'none';
            });
        }

        // NOTE: Pour les formats multi-questions (Association, Chrono, Texte à trous via renderMultiFormat),
        // le feedback est déjà affiché par validateMultiFormatQuestion() pour chaque question.
        // Pas de feedback global supplémentaire (éviter doublon)

        // Affichage du bouton "Suivant" dans la zone d'action habituelle avec meilleur styling
        const isLastEtape = this.currentEtapeIndex >= this.currentEtapes.length - 1;
        const actionBar = document.getElementById('etapeActionBar');
        if (actionBar) {
            const btnAction = isLastEtape ? 'finishEntrainement' : 'nextEtape';
            const btnLabel = isLastEtape ? 'Terminer ✓' : 'Suivant →';
            const btnClass = isLastEtape ? 'finish-btn' : 'next-btn';
            actionBar.className = 'etape-action-bar';
            actionBar.innerHTML = `<button class="btn-etape-action ${btnClass}" onclick="EleveConnaissances.${btnAction}()">${btnLabel}</button>`;
        }
    },

    /**
     * Récupère les données d'une étape (jointure etapeQuestions → questionsConnaissances)
     */
    getEtapeDonnees(etape) {
        let donnees = {};
        const linkedQuestionRefs = this.etapeQuestions.filter(eq =>
            String(eq.etape_id) === String(etape.id)
        );

        if (linkedQuestionRefs.length > 0) {
            const questionRef = linkedQuestionRefs[0];
            const questionContent = this.questionsConnaissances.find(q =>
                String(q.id) === String(questionRef.question_id)
            );
            if (questionContent && questionContent.donnees) {
                donnees = questionContent.donnees;
                if (typeof donnees === 'string') {
                    try {
                        donnees = JSON.parse(donnees);
                    } catch (e) {
                        Logger.warn('EleveConnaissances', 'getEtapeDonnees JSON parse failed', e);
                        donnees = {};
                    }
                }
            }
        }

        if (Object.keys(donnees).length === 0 && etape.donnees) {
            donnees = etape.donnees;
            if (typeof donnees === 'string') {
                try {
                    donnees = JSON.parse(donnees);
                } catch (e) {
                    Logger.warn('EleveConnaissances', 'getEtapeDonnees JSON parse failed for etape donnees', e);
                    donnees = {};
                }
            }
        }
        return donnees;
    },

    validateQoQuestion(qIdx) {
        if (this._qoResults && this._qoResults[qIdx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const q = donnees.multiQuestions[qIdx];
        if (!q) return;

        const userAnswer = this.userAnswers[`question_ouverte_${qIdx}`];
        const reponsesAcceptees = q.reponses_acceptees || [];
        const stricte = q.comparaison_stricte || false;

        let isCorrect = false;
        if (userAnswer) {
            isCorrect = reponsesAcceptees.some(rep => this.compareAnswers(userAnswer, rep, stricte));
        }

        // Marquer l'input comme correct/incorrect
        const inputEl = document.getElementById(`questionOuverteReponse_${qIdx}`);
        if (inputEl) {
            inputEl.classList.remove('correct', 'incorrect');
            inputEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            inputEl.disabled = true;
        }

        // Afficher le feedback unifié avec score
        const feedbackText = this.extractFeedbackText('question_ouverte', isCorrect, q, userAnswer);
        this.displayUnifiedFeedback(
            `feedback_question_ouverte_${qIdx}`,
            isCorrect,
            feedbackText,
            isCorrect ? 1 : 0,
            1,
            'question-feedback'
        );

        // Stocker le résultat
        this._qoResults[qIdx] = {
            question: q.question,
            reponse: userAnswer,
            attendu: reponsesAcceptees[0] || '',
            correct: isCorrect
        };

        // Remplacer le bouton
        const totalQo = donnees.multiQuestions.length;
        const allValidated = Object.keys(this._qoResults).length >= totalQo;
        const actionDiv = document.getElementById(`qo_action_${qIdx}`);

        if (allValidated) {
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qoNavNext()">Suivant →</button>`;
            }
        }
    },

    /** Navigation Question Ouverte : aller à une question */
    qoNavGoTo(index) {
        this._carouselGoTo({
            containerSel: '.qo-multi-container',
            itemSel: '.question-ouverte-container',
            actionSel: '.qo-question-action',
            actionAttr: 'data-for-qo',
            indexProp: '_qoNavIndex'
        }, index);
    },

    /** Navigation Question Ouverte : question suivante */
    qoNavNext() {
        const idx = this._qoNavIndex || 0;
        this.qoNavGoTo(idx + 1);
    },

    // ===== CAROUSEL GÉNÉRIQUE MULTI-FORMAT (render-on-demand) =====

    /**
     * Affiche un carousel multi-question pour les formats:
     * texte_trou, association, chronologie, timeline, carte
     */
    renderMultiFormat(format, donnees, questions) {
        const multiQ = donnees.multiQuestions;
        this._multiFormatState = {
            format: format,
            questions: multiQ,
            currentIndex: 0,
            results: {},
            totalQuestions: multiQ.length
        };

        // Rendre la première question
        const firstHtml = this.renderSingleFormatQuestion(format, multiQ[0]);

        return `
            <div class="multi-format-container" data-format="${format}" data-total-mf="${multiQ.length}">
                <div class="multi-format-content" id="multiFormatContent">
                    ${firstHtml}
                </div>
                <div class="multi-format-action" id="multiFormatAction">
                    <button class="btn-qcm-validate" onclick="EleveConnaissances.validateMultiFormatQuestion()">Valider</button>
                </div>
            </div>
        `;
    },

    /** Rend une seule question pour un format donné */
    renderSingleFormatQuestion(format, qData) {
        switch (format) {
            case 'texte_trou':
                return this.renderTexteTrous(qData, []);
            case 'association':
                return this.renderAssociation(qData, []);
            case 'timeline':
                if (qData.paires && qData.mode) return this.renderChronologie(qData, []);
                return this.renderTimeline(qData, []);
            case 'carte':
                return this.renderCarte(qData, []);
            default:
                return '<div class="format-no-data"><p>Format non supporté</p></div>';
        }
    },

    /** Valide la question courante du carousel multi-format */
    validateMultiFormatQuestion() {
        const state = this._multiFormatState;
        if (!state) return;
        const idx = state.currentIndex;
        const qData = state.questions[idx];

        // Exécuter la validation spécifique au format
        const result = this.runFormatValidation(state.format, qData);
        state.results[idx] = result;

        // Afficher le feedback avec points
        const container = document.getElementById('multiFormatContent');
        let feedbackEl = document.getElementById('multiFormatFeedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.id = 'multiFormatFeedback';
            feedbackEl.className = 'multi-format-feedback';
            container.appendChild(feedbackEl);
        }
        feedbackEl.classList.remove('hidden');

        // Afficher le feedback unifié (format 2 lignes: message + score)
        const isCorrect = result.correct === result.total;
        const allUnanswered = (result.details || []).every(d => !d.reponse || (typeof d.reponse === 'string' && d.reponse.trim() === ''));
        const feedbackText = isCorrect ? 'Correct' : (allUnanswered ? 'Non répondu' : 'Réponse incorrecte');

        // Utiliser la fonction unifiée de feedback
        feedbackEl.id = 'multiFormatFeedback'; // S'assurer que l'ID existe
        // Passer le format spécifique (chronologie, timeline, etc.) pour appliquer le CSS approprié
        let feedbackFormat = state.format;
        if (!['qcm', 'vf', 'association', 'chronologie', 'timeline'].includes(feedbackFormat)) {
            feedbackFormat = 'question-feedback';
        }
        this.displayUnifiedFeedback(
            'multiFormatFeedback',
            isCorrect,
            feedbackText,
            result.correct,
            result.total,
            feedbackFormat
        );

        // Mettre à jour le bouton d'action dans un conteneur propre
        const actionDiv = document.getElementById('multiFormatAction');
        const allValidated = Object.keys(state.results).length >= state.totalQuestions;

        if (allValidated) {
            if (actionDiv) {
                actionDiv.innerHTML = '';
                actionDiv.style.marginTop = '1.5rem';
            }
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.style.marginTop = '1.5rem';
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.multiFormatNext()">Suivant →</button>`;
            }
        }
    },

    /** Passe à la question suivante du carousel multi-format */
    multiFormatNext() {
        const state = this._multiFormatState;
        if (!state) return;
        state.currentIndex++;
        const idx = state.currentIndex;
        const qData = state.questions[idx];

        // Nettoyer les réponses spécifiques au format précédent
        this.clearFormatAnswers(state.format);

        // Rendre la nouvelle question
        const content = document.getElementById('multiFormatContent');
        content.innerHTML = this.renderSingleFormatQuestion(state.format, qData);

        // Remettre le bouton Valider
        const actionDiv = document.getElementById('multiFormatAction');
        if (actionDiv) {
            actionDiv.innerHTML = `<button class="btn-qcm-validate" onclick="EleveConnaissances.validateMultiFormatQuestion()">Valider</button>`;
        }

        // Mettre à jour le compteur dans le header
        const headerCounter = document.getElementById('qcmHeaderCounter');
        if (headerCounter) headerCounter.textContent = `Question ${idx + 1} / ${state.totalQuestions}`;
        this.updateMultiProgressBar(idx + 1, state.totalQuestions);

        // Re-setup spécifique au format (drag & drop, etc.)
        this.setupFormatAfterRender(state.format);
    },

    /** Nettoie les réponses utilisateur pour le format courant */
    clearFormatAnswers(format) {
        switch (format) {
            case 'association':
                this.userAnswers['association'] = [];
                this.associationPairs = [];
                this.associationSelection = { grid: null, chip: null };
                this.associationPairCounter = 0;
                break;
            case 'timeline':
                this.userAnswers['chrono'] = {};
                break;
            case 'carte':
                Object.keys(this.userAnswers).forEach(key => {
                    if (key.startsWith('carte_')) delete this.userAnswers[key];
                });
                break;
        }
    },

    /** Re-setup après render-on-demand (drag & drop, etc.) */
    setupFormatAfterRender(format) {
        switch (format) {
            case 'timeline':
                setTimeout(() => {
                    if (document.querySelector('.timeline-cards')) {
                        this.setupTimelineDragDrop();
                        this.saveTimelineOrder();
                    }
                }, 100);
                break;
        }
    },

    /** Exécute la validation spécifique au format et retourne { correct, total, details } */
    runFormatValidation(format, qData) {
        switch (format) {
            case 'texte_trou':
                return this.runTexteValidation(qData);
            case 'association':
                return this.runAssociationValidation(qData);
            case 'timeline':
                if (qData.paires && qData.mode) return this.runChronoValidation(qData);
                return this.runTimelineValidation(qData);
            case 'carte':
                return this.runCarteValidation(qData);
            default:
                return { correct: 0, total: 0, details: [] };
        }
    },

    /** Validation texte à trous */
    runTexteValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const trouInputs = container.querySelectorAll('.trou-input');
        let correct = 0, total = 0;
        const details = [];

        trouInputs.forEach((input, idx) => {
            total++;
            const userValue = input.value.trim().toLowerCase();
            const stored = this.getStoredAnswer(`trou_${idx}`);
            const correctValue = stored ? stored.correct.toLowerCase() : '';
            let alternatives = [];
            if (qData.trous && qData.trous[idx] && qData.trous[idx].alternatives) {
                alternatives = qData.trous[idx].alternatives.map(a => a.toLowerCase());
            }
            input.classList.remove('correct', 'incorrect');
            const isOk = userValue === correctValue || alternatives.includes(userValue);
            if (isOk) {
                correct++;
                input.classList.add('correct');
            } else {
                input.classList.add('incorrect');
            }
            details.push({ question: `Trou ${idx + 1}`, reponse: input.value, attendu: stored ? stored.correct : '', correct: isOk });
        });

        return { correct, total, details };
    },

    /** Validation chronologie (mode texte) */
    runChronoValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const events = qData.paires || qData.evenements || [];
        const mode = qData.mode || 'date';
        let correct = 0, total = 0;
        const details = [];

        const sortedEvents = this.sortEventsByDate(events);

        sortedEvents.forEach((evt, idx) => {
            total++;
            const inputEl = container.querySelector(`.chrono-input[data-index="${idx}"]`);
            if (!inputEl) return;

            let isCorrect = false;
            const correctValue = mode === 'evenement' ? evt.evenement : String(evt.date);
            const reponsesAcceptees = evt.reponses_acceptees || [];
            const userValue = inputEl.value.trim().toLowerCase();

            if (userValue) {
                if (userValue === correctValue.trim().toLowerCase()) isCorrect = true;
                if (!isCorrect && reponsesAcceptees.length > 0) {
                    isCorrect = reponsesAcceptees.some(alt => alt.trim().toLowerCase() === userValue);
                }
            }

            inputEl.classList.remove('correct', 'incorrect');
            if (isCorrect) {
                correct++;
                inputEl.classList.add('correct');
            } else {
                inputEl.classList.add('incorrect');
                const inputZone = inputEl.closest('.chrono-input-zone');
                if (inputZone && !inputZone.querySelector('.chrono-correction')) {
                    const correction = document.createElement('span');
                    correction.className = 'chrono-correction';
                    correction.textContent = correctValue;
                    inputZone.appendChild(correction);
                }
            }
            details.push({ question: mode === 'evenement' ? evt.date : evt.evenement, reponse: userValue, attendu: correctValue, correct: isCorrect });
        });

        return { correct, total, details };
    },

    /** Validation timeline (mode drag & drop) */
    runTimelineValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const cartes = qData.cartes || [];
        let correct = 0;
        const total = cartes.length;
        const details = [];

        const cardsContainer = container.querySelector('.timeline-cards');
        if (cardsContainer) {
            const placedCards = Array.from(cardsContainer.querySelectorAll('.timeline-card'));

            placedCards.forEach((card, positionActuelle) => {
                const originalIndex = parseInt(card.dataset.originalIndex);
                card.classList.remove('correct', 'incorrect');
                card.setAttribute('draggable', 'false');

                if (originalIndex === positionActuelle) {
                    correct++;
                    card.classList.add('correct');
                } else {
                    card.classList.add('incorrect');
                }
                details.push({ question: `Position ${positionActuelle + 1}`, reponse: cartes[originalIndex]?.titre, attendu: cartes[positionActuelle]?.titre, correct: originalIndex === positionActuelle });
            });
        }

        return { correct, total, details };
    },

    /** Validation association */
    runAssociationValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const assocPaires = qData.paires || [];
        let correct = 0;
        const total = assocPaires.length;
        const details = [];
        const userPairs = this.userAnswers['association'] || [];

        userPairs.forEach(up => {
            const gridId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
            const chipId = this._assocChipSide === 'gauche' ? up.gauche : up.droite;
            const gridEl = container.querySelector(`.association-grid-card[data-id="${gridId}"]`);
            const chipEl = container.querySelector(`.association-chip[data-id="${chipId}"]`);

            const isCorrect = String(up.gauche) === String(up.droite);
            if (isCorrect) {
                correct++;
                [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('correct'); } });
            } else {
                [gridEl, chipEl].forEach(el => { if (el) { el.classList.remove('paired'); el.classList.add('incorrect'); } });
            }
            details.push({
                question: assocPaires[parseInt(up.gauche)]?.element1 || up.gauche,
                reponse: assocPaires[parseInt(up.droite)]?.element2 || up.droite,
                correct: isCorrect
            });
        });

        // Éléments non associés = erreurs
        for (let i = 0; i < assocPaires.length; i++) {
            const gridId = String(i);
            const isMatched = userPairs.some(up => {
                const upGridId = this._assocGridSide === 'gauche' ? String(up.gauche) : String(up.droite);
                return upGridId === gridId;
            });
            if (!isMatched) {
                details.push({ question: assocPaires[i].element1, reponse: 'Non répondu', attendu: assocPaires[i].element2, correct: false });
            }
        }

        // Feedback visuel
        container.querySelectorAll('.association-grid-card:not(.correct):not(.incorrect)').forEach(el => el.classList.add('incorrect'));
        const chipsZone = container.querySelector('.association-chips');
        if (chipsZone) chipsZone.classList.add('hidden');
        const zoneLabel = container.querySelector('.association-zone-label');
        if (zoneLabel) zoneLabel.classList.add('hidden');

        const getChipText = (id) => {
            const p = assocPaires[parseInt(id)];
            if (!p) return '?';
            return this._assocChipSide === 'gauche' ? p.element1 : p.element2;
        };

        container.querySelectorAll('.association-grid-card').forEach(card => {
            const cardId = card.dataset.id;
            const correctText = getChipText(cardId);
            const label = card.querySelector('.assoc-paired-label');
            if (!label) return;

            label.classList.remove('hidden');
            const userPair = userPairs.find(up => {
                const gId = this._assocGridSide === 'gauche' ? up.gauche : up.droite;
                return String(gId) === String(cardId);
            });

            if (userPair) {
                const chipId = this._assocChipSide === 'gauche' ? userPair.gauche : userPair.droite;
                const isCorrect = String(userPair.gauche) === String(userPair.droite);
                const studentText = getChipText(chipId);
                if (isCorrect) {
                    label.className = 'assoc-paired-label assoc-label-success';
                    label.innerHTML = `<span class="assoc-answer-ok">✓ ${this.escapeHtml(correctText)}</span>`;
                } else {
                    label.className = 'assoc-paired-label assoc-label-error';
                    label.innerHTML = `<span class="assoc-answer-wrong">✗ ${this.escapeHtml(studentText)}</span><span class="assoc-answer-right">→ ${this.escapeHtml(correctText)}</span>`;
                }
            } else {
                label.className = 'assoc-paired-label assoc-label-error';
                label.innerHTML = `<span class="assoc-answer-wrong">✗ Non répondu</span><span class="assoc-answer-right">→ ${this.escapeHtml(correctText)}</span>`;
            }
        });

        return { correct, total, details };
    },

    /** Validation carte/image cliquable */
    runCarteValidation(qData) {
        const container = document.getElementById('multiFormatContent');
        const marqueurs = qData.marqueurs || [];
        let correct = 0, total = 0;
        const details = [];

        marqueurs.forEach((m, idx) => {
            total++;
            const answer = this.userAnswers['carte_' + idx];
            const marker = container.querySelector(`.carte-marker-v2[data-index="${idx}"]`);
            const correctAnswer = (m.reponse || '').split('|')[0].trim();

            if (answer) {
                const userValue = answer.trim().toLowerCase();
                const expectedValue = (m.reponse || '').trim().toLowerCase();
                const reponsesAcceptees = m.reponses_acceptees || [];
                const allAccepted = [expectedValue, ...reponsesAcceptees.map(r => r.trim().toLowerCase())];
                const isCorrect = allAccepted.some(rep => userValue === rep);

                if (isCorrect) {
                    correct++;
                    if (marker) marker.classList.add('correct');
                } else {
                    if (marker) marker.classList.add('incorrect');
                }
                this.applyCarteCorrectionMode(marker, idx, isCorrect, answer, correctAnswer);
                details.push({ question: `Point ${idx + 1}`, reponse: answer, attendu: m.reponse, correct: isCorrect });
            } else {
                if (marker) marker.classList.add('incorrect');
                this.applyCarteCorrectionMode(marker, idx, false, null, correctAnswer);
                details.push({ question: `Point ${idx + 1}`, reponse: null, attendu: m.reponse, correct: false });
            }
        });

        // Fermer le popup si ouvert
        this.closeCartePopup?.();

        return { correct, total, details };
    },

    /** Valide une proposition Vrai/Faux individuelle dans le carrousel */
    validateVfQuestion(idx) {
        if (this._vfResults && this._vfResults[idx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const propositions = donnees.propositions || [];
        const prop = propositions[idx];
        if (!prop) return;

        const answer = this.userAnswers[`vf_${idx}`];
        const expected = prop.reponse === true || prop.reponse === 'vrai' ? 'vrai' : 'faux';
        const isCorrect = answer === expected;

        // Afficher le feedback
        const feedback = document.getElementById(`feedback_vf_${idx}`);
        if (feedback) {
            feedback.classList.remove('hidden');
            feedback.className = `vf-feedback ${isCorrect ? 'correct' : 'incorrect'}`;
            feedback.textContent = isCorrect ? '✓ Correct' : (!answer ? '⚠ Non répondu' : '✗ Mauvaise réponse');
        }

        // Verrouiller les choix
        const item = document.querySelector(`.vrai-faux-item[data-index="${idx}"]`);
        if (item) {
            item.querySelectorAll('input').forEach(el => el.disabled = true);
        }

        // Stocker le résultat
        const feedbackVFCarousel = answer === 'vrai' ? (prop.feedback_vrai || '') : (prop.feedback_faux || '');
        this._vfResults[idx] = {
            question: prop.texte,
            reponse: answer,
            attendu: expected,
            correct: isCorrect,
            feedbackOption: feedbackVFCarousel
        };

        // Remplacer le bouton
        const totalVf = propositions.length;
        const allValidated = Object.keys(this._vfResults).length >= totalVf;
        const actionDiv = document.getElementById(`vf_action_${idx}`);

        if (allValidated) {
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else {
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.vfNavNext()">Suivant →</button>`;
            }
        }
    },

    /** Navigation Vrai/Faux : aller à une proposition */
    vfNavGoTo(index) {
        this._carouselGoTo({
            containerSel: '.vrai-faux-container',
            itemSel: '.vrai-faux-item',
            actionSel: '.vf-question-action',
            actionAttr: 'data-for-vf',
            indexProp: '_vfNavIndex'
        }, index);
    },

    /** Navigation Vrai/Faux : proposition suivante */
    vfNavNext() {
        const idx = this._vfNavIndex || 0;
        this.vfNavGoTo(idx + 1);
    },

    /** Valide une question QCM individuelle dans le carrousel multi-questions */
    validateQcmQuestion(qIdx) {
        // Éviter la double validation
        if (this._qcmResults && this._qcmResults[qIdx]) return;

        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const q = donnees.multiQuestions[qIdx];
        if (!q) return;

        const choices = q.choix || q.options || [];
        const userAnswer = this.userAnswers[`qcm_${qIdx}`];

        const correctIndices = this.getQcmCorrectIndices(q);
        const isCorrect = correctIndices.includes(parseInt(userAnswer));

        // Construire le texte du feedback
        let feedbackText = isCorrect ? 'Correct' : (userAnswer == null ? 'Non répondu' : 'Mauvaise réponse');

        // Utiliser la fonction unifiée de feedback (avec score!)
        this.displayUnifiedFeedback(
            `feedback_qcm_${qIdx}`,
            isCorrect,
            feedbackText,
            isCorrect ? 1 : 0,
            1,
            'qcm'
        );

        // Verrouiller les choix + feedback visuel animé
        const block = document.querySelector(`.qcm-question-block[data-question="${qIdx}"]`);
        if (block) {
            block.querySelectorAll('input').forEach(el => el.disabled = true);
            // Marquer visuellement le choix sélectionné (sans révéler les bonnes réponses)
            block.querySelectorAll('.qcm-choice').forEach(label => {
                const input = label.querySelector('input');
                if (!input) return;
                const val = parseInt(input.value);
                if (input.checked && correctIndices.includes(val)) {
                    label.classList.add('is-correct');
                } else if (input.checked) {
                    label.classList.add('is-incorrect');
                }
            });
        }

        // Récupérer le feedback spécifique à l'option choisie
        const feedbackOption = (q.feedbacks_options && userAnswer != null) ? (q.feedbacks_options[parseInt(userAnswer)] || '') : '';

        // Stocker le résultat
        this._qcmResults[qIdx] = {
            question: q.question,
            reponse: userAnswer != null ? (choices[parseInt(userAnswer)]?.texte || choices[parseInt(userAnswer)] || userAnswer) : null,
            attendu: correctIndices.map(i => choices[i]?.texte || choices[i]).join(', '),
            correct: isCorrect,
            feedbackOption: feedbackOption
        };

        // Remplacer le bouton : "Valider" → "Suivant →" ou déclencher la validation globale
        const totalQ = donnees.multiQuestions.length;
        const allValidated = Object.keys(this._qcmResults).length >= totalQ;
        const actionDiv = document.getElementById(`qcm_action_${qIdx}`);

        if (allValidated) {
            // Toutes les questions ont été validées → déclencher la validation de l'étape
            if (actionDiv) actionDiv.innerHTML = '';
            this.validateCurrentEtape();
        } else if (qIdx < totalQ - 1) {
            // Pas la dernière → bouton "Suivant →"
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qcmNavNext()">Suivant →</button>`;
            }
        } else {
            // Dernière question mais d'autres avant ne sont pas validées
            if (actionDiv) {
                actionDiv.innerHTML = `<button class="btn-qcm-next" onclick="EleveConnaissances.qcmNavGoTo(${this.findNextUnvalidatedQcm()})">← Revenir aux questions non validées</button>`;
            }
        }
    },

    /** Trouve la prochaine question QCM non validée */
    findNextUnvalidatedQcm() {
        const currentEtape = this.currentEtapes[this.currentEtapeIndex];
        const storedData = this.selectedQuestionsPerEtape[currentEtape.id];
        const donnees = storedData?.donnees || this.getEtapeDonnees(currentEtape);
        const totalQ = donnees.multiQuestions ? donnees.multiQuestions.length : 0;
        for (let i = 0; i < totalQ; i++) {
            if (!this._qcmResults[i]) return i;
        }
        return 0;
    },

    /** Navigation QCM multi-questions : aller à une question */
    qcmNavGoTo(index) {
        this._carouselGoTo({
            containerSel: '.qcm-multi-container',
            itemSel: '.qcm-question-block',
            actionSel: '.qcm-question-action',
            actionAttr: 'data-for-qcm',
            indexProp: '_qcmNavIndex'
        }, index);
    },

    /** Navigation QCM : question suivante */
    qcmNavNext() {
        const idx = this._qcmNavIndex || 0;
        this.qcmNavGoTo(idx + 1);
    },

});
