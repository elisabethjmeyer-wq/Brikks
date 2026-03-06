/**
 * Exercices Élève — Logique métier Savoir-Faire
 *
 * Contient : statuts par banque, espacement, validation de répétition,
 * sélection d'exercice aléatoire, popup de blocage, merge de stats.
 *
 * Étendu sur EleveExercices via Object.assign().
 */

/* global EleveExercices */

Object.assign(EleveExercices, {

    // ============================================
    // STATS & MERGE
    // ============================================

    /**
     * Fusionne les stats banques locales avec celles du backend.
     * Garde toujours les valeurs les plus élevées/récentes pour éviter de perdre la progression.
     */
    mergeStatsBanque(localStats, remoteStats) {
        const merged = { ...remoteStats };

        for (const [banqueId, localStat] of Object.entries(localStats || {})) {
            if (!merged[banqueId]) {
                merged[banqueId] = localStat;
            } else {
                const remoteStat = merged[banqueId];

                if ((localStat.repetitions_validees || 0) > (remoteStat.repetitions_validees || 0)) {
                    merged[banqueId].repetitions_validees = localStat.repetitions_validees;
                    merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                    merged[banqueId].exercices_reussis = localStat.exercices_reussis || [];
                } else if ((localStat.repetitions_validees || 0) === (remoteStat.repetitions_validees || 0)) {
                    if (localStat.date_derniere_validation && remoteStat.date_derniere_validation) {
                        if (new Date(localStat.date_derniere_validation) > new Date(remoteStat.date_derniere_validation)) {
                            merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                        }
                    } else if (localStat.date_derniere_validation) {
                        merged[banqueId].date_derniere_validation = localStat.date_derniere_validation;
                    }
                    const allExos = new Set([
                        ...(localStat.exercices_reussis || []),
                        ...(remoteStat.exercices_reussis || [])
                    ]);
                    merged[banqueId].exercices_reussis = [...allExos];
                }

                merged[banqueId].total_pratiques = Math.max(
                    localStat.total_pratiques || 0,
                    remoteStat.total_pratiques || 0
                );
            }
        }

        return merged;
    },

    /**
     * Calcule les stats par banque à partir des stats par exercice.
     * Fallback si le backend ne retourne pas encore statsBanque.
     */
    computeStatsBanqueFromStatsExercice(statsExercice) {
        const statsBanque = {};

        for (const [exoId, stats] of Object.entries(statsExercice || {})) {
            const banqueId = String(stats.banque_id);
            if (!banqueId) continue;

            if (!statsBanque[banqueId]) {
                statsBanque[banqueId] = {
                    banque_id: banqueId,
                    repetitions_validees: 0,
                    exercices_reussis: [],
                    date_derniere_validation: null,
                    total_pratiques: 0
                };
            }

            const sb = statsBanque[banqueId];
            sb.total_pratiques += (stats.total_pratiques || 0);

            if (stats.repetitions_validees > 0) {
                if (!sb.exercices_reussis.includes(exoId)) {
                    sb.exercices_reussis.push(exoId);
                }

                if (stats.repetitions_validees > sb.repetitions_validees) {
                    sb.repetitions_validees = stats.repetitions_validees;
                    sb.date_derniere_validation = stats.date_derniere_validation;
                } else if (stats.repetitions_validees === sb.repetitions_validees) {
                    if (stats.date_derniere_validation) {
                        if (!sb.date_derniere_validation || stats.date_derniere_validation > sb.date_derniere_validation) {
                            sb.date_derniere_validation = stats.date_derniere_validation;
                        }
                    }
                }
            }
        }

        return statsBanque;
    },

    // ============================================
    // STATUT PAR BANQUE
    // ============================================

    /**
     * Détermine le statut d'une banque SF (progression par banque).
     * @returns {Object} { status, repetitions, exercice?, prochaineDispo?, message, peutFaire, estEntrainementLibre }
     */
    getBanqueStatusSF(banqueId, exercices) {
        if (!exercices || exercices.length === 0) {
            return { status: 'vide', message: 'Aucun exercice', repetitions: 0, peutFaire: false };
        }

        const now = new Date();
        const stats = this.statsSFBanque[String(banqueId)];

        // Pas de stats = jamais fait cette banque
        if (!stats || stats.repetitions_validees === undefined || stats.repetitions_validees === 0) {
            const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
            return {
                status: this.STATUTS_SF.A_DECOUVRIR,
                repetitions: 0,
                ...this.LABELS_STATUTS_SF['a-decouvrir'],
                statusClass: 'a-decouvrir',
                message: 'Premier essai',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercice: exercice
            };
        }

        const reps = stats.repetitions_validees || 0;
        const exercicesReussis = stats.exercices_reussis || [];
        const dernierePratique = stats.date_derniere_validation
            ? new Date(stats.date_derniere_validation)
            : null;

        // Maîtrisé (5 répétitions)
        if (reps >= this.SEUIL_REPETITIONS) {
            if (dernierePratique) {
                const joursDepuis = Math.floor((now - dernierePratique) / (1000 * 60 * 60 * 24));
                if (joursDepuis >= this.SEUIL_JOURS_RAPPEL) {
                    const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
                    return {
                        status: this.STATUTS_SF.RAPPEL_SUGGERE,
                        repetitions: reps,
                        ...this.LABELS_STATUTS_SF['rappel-suggere'],
                        statusClass: 'rappel-suggere',
                        message: `${joursDepuis}j depuis dernière pratique`,
                        joursRestants: 0,
                        prochaineDispo: null,
                        peutFaire: true,
                        estEntrainementLibre: false,
                        joursDepuis,
                        exercice: exercice,
                        exercicesReussis
                    };
                }
            }

            return {
                status: this.STATUTS_SF.MAITRISE,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['maitrise'],
                statusClass: 'maitrise',
                message: 'Banque maîtrisée !',
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercicesReussis
            };
        }

        // En cours (1-4 répétitions) — vérifier espacement
        if (reps > 0 && dernierePratique) {
            const espacementRequis = this.ESPACEMENTS_REPETITIONS[reps] || 7;
            const prochaineDispo = new Date(dernierePratique);
            prochaineDispo.setDate(prochaineDispo.getDate() + espacementRequis);

            const joursRestants = Math.max(0, Math.ceil((prochaineDispo - now) / (1000 * 60 * 60 * 24)));

            if (now < prochaineDispo) {
                const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
                return {
                    status: this.STATUTS_SF.EN_PAUSE,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['en-pause'],
                    statusClass: 'en-pause',
                    message: `Dispo dans ${joursRestants}j`,
                    joursRestants: joursRestants,
                    prochaineDispo: prochaineDispo.toISOString(),
                    peutFaire: false,
                    estEntrainementLibre: true,
                    exercice: exercice,
                    exercicesReussis
                };
            } else {
                const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
                return {
                    status: this.STATUTS_SF.A_REVISER,
                    repetitions: reps,
                    ...this.LABELS_STATUTS_SF['a-reviser'],
                    statusClass: 'a-reviser',
                    message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS} disponible`,
                    joursRestants: 0,
                    prochaineDispo: null,
                    peutFaire: true,
                    estEntrainementLibre: false,
                    exercice: exercice,
                    exercicesReussis
                };
            }
        }

        // En cours sans date (cas rare)
        if (reps > 0) {
            const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis);
            return {
                status: this.STATUTS_SF.EN_COURS,
                repetitions: reps,
                ...this.LABELS_STATUTS_SF['en-cours'],
                statusClass: 'en-cours',
                message: `Répétition ${reps + 1}/${this.SEUIL_REPETITIONS}`,
                joursRestants: 0,
                prochaineDispo: null,
                peutFaire: true,
                estEntrainementLibre: false,
                exercice: exercice,
                exercicesReussis
            };
        }

        // Par défaut : à découvrir
        const exercice = this.getExerciceAleatoirePourBanque(banqueId, exercices, []);
        return {
            status: this.STATUTS_SF.A_DECOUVRIR,
            repetitions: 0,
            ...this.LABELS_STATUTS_SF['a-decouvrir'],
            statusClass: 'a-decouvrir',
            message: 'Premier essai',
            joursRestants: 0,
            prochaineDispo: null,
            peutFaire: true,
            estEntrainementLibre: false,
            exercice: exercice
        };
    },

    // ============================================
    // SÉLECTION D'EXERCICE
    // ============================================

    /**
     * Sélectionne un exercice aléatoire parmi ceux non encore réussis pour cette banque.
     */
    getExerciceAleatoirePourBanque(banqueId, exercices, exercicesReussis) {
        if (!exercices || exercices.length === 0) return null;

        const reussisSet = new Set((exercicesReussis || []).map(id => String(id)));
        let exercicesDisponibles = exercices.filter(e => !reussisSet.has(String(e.id)));

        // Si tous réussis, recycler
        if (exercicesDisponibles.length === 0) {
            exercicesDisponibles = exercices;
        }

        const randomIndex = Math.floor(Math.random() * exercicesDisponibles.length);
        return exercicesDisponibles[randomIndex];
    },

    // ============================================
    // POPUP DE BLOCAGE
    // ============================================

    showBlocagePopup(statusInfo, onEntrainementLibre, onClose) {
        const existingPopup = document.querySelector('.blocage-popup-overlay');
        if (existingPopup) existingPopup.remove();

        const prochaineDateStr = statusInfo.prochaineDispo
            ? new Date(statusInfo.prochaineDispo).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            })
            : 'bientôt';

        const prochainNumero = statusInfo.repetitions + 1;
        const ordinalMsg = prochainNumero <= this.SEUIL_REPETITIONS
            ? `Tu pourras passer à ton ${this.ORDINAUX[prochainNumero]} entraînement dans ${statusInfo.joursRestants} jour${statusInfo.joursRestants > 1 ? 's' : ''}`
            : 'Tu as maîtrisé cette banque !';

        const popup = document.createElement('div');
        popup.className = 'blocage-popup-overlay';
        popup.innerHTML = `
            <div class="blocage-popup">
                <div class="blocage-popup-header">
                    <span class="blocage-icon">🔒</span>
                    <h3>Pas encore !</h3>
                </div>
                <div class="blocage-popup-body">
                    <p class="blocage-message">
                        Tu as réussi cet entraînement ! Pour apprendre efficacement, retravaille cette banque le <strong>${prochaineDateStr}</strong>.
                    </p>
                    <div class="blocage-progress">
                        <span class="blocage-etape">${ordinalMsg}</span>
                    </div>
                </div>
                <div class="blocage-popup-actions">
                    <button class="btn btn-primary blocage-btn-compris" type="button">
                        J'ai compris
                    </button>
                    <button class="btn btn-ghost blocage-btn-libre" type="button">
                        M'entraîner quand même
                    </button>
                </div>
                <p class="blocage-warning">
                    ⚠️ L'entraînement libre ne compte pas pour ta progression
                </p>
            </div>
        `;

        document.body.appendChild(popup);

        popup.querySelector('.blocage-btn-compris').addEventListener('click', () => {
            popup.remove();
            if (onClose) onClose();
        });

        popup.querySelector('.blocage-btn-libre').addEventListener('click', () => {
            popup.remove();
            if (onEntrainementLibre) onEntrainementLibre();
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
                if (onClose) onClose();
            }
        });
    },

    // ============================================
    // VALIDATION DE RÉPÉTITION
    // ============================================

    /**
     * Valide une tentative d'exercice SF au niveau de la banque.
     * @param {Object} exercice - Données de l'exercice
     * @param {number} score - Score obtenu (0-100)
     * @param {number} tempsPasse - Temps passé en secondes
     * @param {Object} statsBanque - Stats actuelles de la banque
     * @returns {Object} Résultat de la validation
     */
    validerRepetitionSF(exercice, score, tempsPasse, statsBanque) {
        const tempsPrevu = (exercice.duree || 15) * 60;
        const repsActuelles = statsBanque?.repetitions_validees || 0;
        const prochaineRep = repsActuelles + 1;

        // Entraînement libre = ne compte pas
        if (this.isEntrainementLibre) {
            const isSuccessLibre = score === 100;
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'entrainement_libre',
                message: isSuccessLibre ? 'Bravo !' : "Continue de t'entraîner, tu vas y arriver !",
                conseil: '',
                estMaitrise: repsActuelles >= this.SEUIL_REPETITIONS,
                proposeNouvelExercice: false,
                scoreEntrainementLibre: score
            };
        }

        // Score non parfait
        if (score < 100) {
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'score_insuffisant',
                message: `Continue tes efforts ! (${score}%)`,
                conseil: '',
                estMaitrise: false,
                proposeNouvelExercice: true
            };
        }

        // Temps dépassé pour répétitions >= 2
        if (prochaineRep >= this.REP_TEMPS_OBLIGATOIRE && tempsPasse > tempsPrevu) {
            return {
                repetitionValidee: false,
                nouvelleRepetition: repsActuelles,
                raison: 'temps_depasse',
                message: 'Presque ! Essaie d\'aller plus vite',
                conseil: '',
                estMaitrise: false,
                proposeNouvelExercice: true
            };
        }

        // Répétition validée !
        const nouvelleRep = Math.min(prochaineRep, this.SEUIL_REPETITIONS);
        const estMaitrise = nouvelleRep >= this.SEUIL_REPETITIONS;

        let prochaineDispo = null;
        let joursAttente = 0;
        if (!estMaitrise) {
            joursAttente = this.ESPACEMENTS_REPETITIONS[nouvelleRep] || 7;
            prochaineDispo = new Date();
            prochaineDispo.setDate(prochaineDispo.getDate() + joursAttente);
        }

        return {
            repetitionValidee: true,
            nouvelleRepetition: nouvelleRep,
            raison: 'succes',
            message: estMaitrise
                ? '🎉 Banque maîtrisée !'
                : `Bravo ! Niveau ${nouvelleRep}/${this.SEUIL_REPETITIONS} atteint`,
            conseil: estMaitrise
                ? 'Félicitations ! Tu maîtrises cette banque !'
                : '',
            prochaineDispo: prochaineDispo?.toISOString(),
            joursAttente: joursAttente,
            estMaitrise: estMaitrise,
            proposeNouvelExercice: false
        };
    }
});
