/**
 * Utilitaires de soumission — calcul des délais de rendu
 *
 * Fournit :
 * - SubmissionUtils.loadJoursNonCours()  — charge la feuille JOURS_NON_COURS
 * - SubmissionUtils.prochainJourOuvre(nbJours, joursNonCours)
 * - SubmissionUtils.formatDeadlineMail(delaiMinutes)
 * - SubmissionUtils.formatDeadlinePapier(delaiJours, joursNonCours)
 * - SubmissionUtils.buildSubmissionFlow(options) — construit le popup 2 étapes
 */

const SubmissionUtils = {

    // Cache des jours non-cours (chargé une seule fois par session)
    _joursNonCoursCache: null,

    /**
     * Charge la liste des jours sans cours depuis Google Sheets.
     * Retourne un Set de chaînes "YYYY-MM-DD" pour lookup rapide.
     */
    async loadJoursNonCours() {
        if (this._joursNonCoursCache) return this._joursNonCoursCache;

        try {
            const data = await SheetsAPI.fetchAndParse('JOURS_NON_COURS');
            const dates = new Set();

            data.forEach(function(row) {
                // Accepte les colonnes 'date', 'Date', etc.
                var raw = row.date || row.Date || '';
                if (!raw) return;

                var d = SubmissionUtils._parseDate(raw);
                if (d) {
                    dates.add(SubmissionUtils._toKey(d));
                }
            });

            this._joursNonCoursCache = dates;
            return dates;
        } catch (e) {
            console.warn('JOURS_NON_COURS non disponible, seuls les week-ends seront exclus.', e);
            this._joursNonCoursCache = new Set();
            return this._joursNonCoursCache;
        }
    },

    /**
     * Parse une date depuis différents formats (DD/MM/YYYY, YYYY-MM-DD, Date Google Sheets).
     */
    _parseDate(raw) {
        if (raw instanceof Date) return raw;
        var str = String(raw).trim();

        // Format DD/MM/YYYY
        var parts = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
        if (parts) {
            return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
        }

        // Format YYYY-MM-DD ou ISO
        var d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    },

    /**
     * Convertit une Date en clé "YYYY-MM-DD" pour comparaison.
     */
    _toKey(d) {
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    },

    /**
     * Vérifie si une date est un jour ouvré (pas week-end, pas dans joursNonCours).
     */
    _isJourOuvre(d, joursNonCours) {
        var day = d.getDay();
        if (day === 0 || day === 6) return false; // dimanche, samedi
        if (joursNonCours && joursNonCours.has(this._toKey(d))) return false;
        return true;
    },

    /**
     * Calcule la date du Nème prochain jour ouvré à partir de maintenant.
     * @param {number} nbJours — nombre de jours ouvrés à avancer (1 = prochain jour de cours)
     * @param {Set} joursNonCours — Set de "YYYY-MM-DD"
     * @returns {Date}
     */
    prochainJourOuvre(nbJours, joursNonCours) {
        var d = new Date();
        var count = 0;
        var maxIterations = 60; // sécurité : ne pas boucler indéfiniment

        while (count < nbJours && maxIterations > 0) {
            d.setDate(d.getDate() + 1);
            if (this._isJourOuvre(d, joursNonCours)) {
                count++;
            }
            maxIterations--;
        }

        return d;
    },

    /**
     * Formate un délai mail en heure limite lisible.
     * @param {number} delaiMinutes — nombre de minutes après maintenant
     * @returns {string} ex: "avant 15h42"
     */
    formatDeadlineMail(delaiMinutes) {
        var deadline = new Date(Date.now() + delaiMinutes * 60 * 1000);
        var h = deadline.getHours();
        var m = String(deadline.getMinutes()).padStart(2, '0');
        return 'avant ' + h + 'h' + m;
    },

    /**
     * Formate un délai papier en date lisible.
     * @param {number} delaiJours — nombre de jours ouvrés
     * @param {Set} joursNonCours — Set de "YYYY-MM-DD"
     * @returns {string} ex: "avant le lundi 3 mars"
     */
    formatDeadlinePapier(delaiJours, joursNonCours) {
        var d = this.prochainJourOuvre(delaiJours, joursNonCours);
        var jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                     'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return 'le ' + jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()];
    },

    // ==========================================
    // POPUP DE SOUMISSION — 2 ÉTAPES
    // ==========================================

    /**
     * Affiche le popup de soumission en 2 étapes.
     * @param {Object} options
     *   - container {HTMLElement} — élément parent dans lequel injecter le popup
     *   - timerExpired {boolean} — true si le chronomètre est terminé
     *   - delaiMailMinutes {number} — délai mail en minutes (défaut: 30)
     *   - delaiPapierJours {number} — délai papier en jours ouvrés (défaut: 1)
     *   - joursNonCours {Set} — jours non-cours chargés
     *   - onSubmit {function(modeRendu)} — callback quand l'élève soumet (modeRendu: 'papier'|'numerique')
     *   - onDecline {function} — callback quand l'élève refuse l'évaluation
     *   - onContinue {function} — callback pour continuer à travailler
     */
    showSubmissionPopup(options) {
        var container = options.container;
        var timerExpired = options.timerExpired || false;

        var continueBtn = timerExpired ? '' : '<button class="submission-choice-btn submission-continue" id="submissionContinueBtn">' +
            '<span class="submission-choice-icon">\u21A9\uFE0F</span>' +
            '<div class="submission-choice-text">' +
            '<strong>Continuer \u00E0 travailler</strong>' +
            '<span>Je veux encore modifier mon travail</span>' +
            '</div></button>';

        var overlay = document.createElement('div');
        overlay.className = 'submission-overlay';
        overlay.id = 'submissionOverlay';

        overlay.innerHTML =
            '<div class="submission-popup">' +
                '<div class="submission-step" id="submissionStep1">' +
                    '<h2>Que souhaites-tu faire ?</h2>' +
                    '<div class="submission-choices">' +
                        '<button class="submission-choice-btn submission-submit" id="submissionSubmitBtn">' +
                            '<span class="submission-choice-icon">\u2705</span>' +
                            '<div class="submission-choice-text">' +
                                '<strong>Soumettre mon travail</strong>' +
                                '<span>Je veux \u00EAtre corrig\u00E9(e)</span>' +
                            '</div>' +
                        '</button>' +
                        '<button class="submission-choice-btn submission-decline" id="submissionDeclineBtn">' +
                            '<span class="submission-choice-icon">\u274C</span>' +
                            '<div class="submission-choice-text">' +
                                '<strong>Ne pas soumettre</strong>' +
                                '<span>Je ne souhaite pas \u00EAtre \u00E9valu\u00E9(e)</span>' +
                            '</div>' +
                        '</button>' +
                        continueBtn +
                    '</div>' +
                '</div>' +
                '<div class="submission-step hidden" id="submissionStep2Format">' +
                    '<h2>Dans quel format as-tu r\u00E9alis\u00E9 ton travail ?</h2>' +
                    '<div class="submission-choices">' +
                        '<button class="submission-choice-btn submission-paper" id="submissionPaperBtn">' +
                            '<span class="submission-choice-icon">\u{1F4C4}</span>' +
                            '<div class="submission-choice-text">' +
                                '<strong>En format papier</strong>' +
                                '<span>Je d\u00E9pose ma copie au lyc\u00E9e</span>' +
                            '</div>' +
                        '</button>' +
                        '<button class="submission-choice-btn submission-digital" id="submissionDigitalBtn">' +
                            '<span class="submission-choice-icon">\u{1F4E7}</span>' +
                            '<div class="submission-choice-text">' +
                                '<strong>Au format num\u00E9rique</strong>' +
                                '<span>J\'envoie mon travail par mail</span>' +
                            '</div>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="submission-step hidden" id="submissionStep2Decline">' +
                    '<div class="submission-warning-box">' +
                        '<div class="submission-warning-icon">\u26A0\uFE0F</div>' +
                        '<h2>Es-tu s\u00FBr(e) ?</h2>' +
                        '<p>Ton travail ne sera pas \u00E9valu\u00E9.<br>Cette d\u00E9cision est d\u00E9finitive.</p>' +
                    '</div>' +
                    '<div class="submission-confirm-actions">' +
                        '<button class="submission-action-btn submission-action-cancel" id="submissionDeclineCancelBtn">Annuler</button>' +
                        '<button class="submission-action-btn submission-action-confirm" id="submissionDeclineConfirmBtn">Confirmer</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        container.appendChild(overlay);

        // Étape 1 : choix principal
        document.getElementById('submissionSubmitBtn').addEventListener('click', function() {
            document.getElementById('submissionStep1').classList.add('hidden');
            document.getElementById('submissionStep2Format').classList.remove('hidden');
        });

        document.getElementById('submissionDeclineBtn').addEventListener('click', function() {
            document.getElementById('submissionStep1').classList.add('hidden');
            document.getElementById('submissionStep2Decline').classList.remove('hidden');
        });

        if (!timerExpired) {
            document.getElementById('submissionContinueBtn').addEventListener('click', function() {
                overlay.remove();
                if (options.onContinue) options.onContinue();
            });
        }

        // Étape 2 : choix format
        var self = this;
        document.getElementById('submissionPaperBtn').addEventListener('click', function() {
            self._showConfirmation(overlay, 'papier', options);
        });

        document.getElementById('submissionDigitalBtn').addEventListener('click', function() {
            self._showConfirmation(overlay, 'numerique', options);
        });

        // Étape 2 : confirmation refus
        document.getElementById('submissionDeclineCancelBtn').addEventListener('click', function() {
            document.getElementById('submissionStep2Decline').classList.add('hidden');
            document.getElementById('submissionStep1').classList.remove('hidden');
        });

        document.getElementById('submissionDeclineConfirmBtn').addEventListener('click', function() {
            overlay.remove();
            if (options.onDecline) options.onDecline();
        });
    },

    /**
     * Affiche l'écran de confirmation avec le délai précis.
     */
    _showConfirmation(overlay, modeRendu, options) {
        var delaiMail = options.delaiMailMinutes || 30;
        var delaiPapier = options.delaiPapierJours || 1;
        var joursNonCours = options.joursNonCours || new Set();

        var deadlineText;
        if (modeRendu === 'numerique') {
            deadlineText = this.formatDeadlineMail(delaiMail);
        } else {
            deadlineText = this.formatDeadlinePapier(delaiPapier, joursNonCours);
        }

        // Sauvegarder les instructions pour affichage sur la page de suivi
        if (options.entrainementId) {
            this.saveDeliveryInfo(options.entrainementId, modeRendu, deadlineText);
        }

        // Fermer le popup et naviguer directement vers la page de suivi
        overlay.remove();
        if (options.onSubmit) options.onSubmit(modeRendu);
    },

    /**
     * Sauvegarde les instructions de livraison en localStorage.
     */
    saveDeliveryInfo(entrainementId, modeRendu, deadlineText) {
        try {
            localStorage.setItem('brikks_delivery_' + entrainementId, JSON.stringify({
                modeRendu: modeRendu,
                deadlineText: deadlineText
            }));
        } catch (e) { /* silencieux */ }
    },

    /**
     * Récupère les instructions de livraison depuis localStorage.
     * @returns {{ modeRendu: string, deadlineText: string }|null}
     */
    getDeliveryInfo(entrainementId) {
        try {
            var raw = localStorage.getItem('brikks_delivery_' + entrainementId);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    },

    /**
     * Construit le HTML des instructions de livraison pour l'affichage post-soumission.
     */
    buildDeliveryHTML(modeRendu, deadlineText) {
        if (modeRendu === 'numerique') {
            return '<div class="submission-confirm-detail">' +
                '<span class="submission-confirm-icon">\u{1F4E7}</span>' +
                '<div>' +
                    '<strong>Envoie moi ton travail via MBN</strong>' +
                    '<p>' + deadlineText + '</p>' +
                '</div>' +
            '</div>';
        } else {
            return '<div class="submission-confirm-detail">' +
                '<span class="submission-confirm-icon">\u{1F4C4}</span>' +
                '<div>' +
                    '<strong>D\u00E9pose ta copie dans le casier du professeur</strong>' +
                    '<p>' + deadlineText + '</p>' +
                '</div>' +
            '</div>';
        }
    },

    /**
     * Affiche l'écran de confirmation pour "non soumis".
     */
    showDeclineConfirmation(container, onDone) {
        var existing = document.getElementById('submissionOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.className = 'submission-overlay';
        overlay.id = 'submissionOverlay';

        overlay.innerHTML =
            '<div class="submission-popup">' +
                '<div class="submission-step">' +
                    '<div class="submission-info-box">' +
                        '<div class="submission-info-icon">\u{1F4CB}</div>' +
                        '<h2>Choix enregistr\u00E9</h2>' +
                        '<p>Ce travail ne sera pas \u00E9valu\u00E9.</p>' +
                    '</div>' +
                    '<button class="submission-action-btn submission-action-done" id="submissionDeclineDoneBtn">Compris</button>' +
                '</div>' +
            '</div>';

        container.appendChild(overlay);

        document.getElementById('submissionDeclineDoneBtn').addEventListener('click', function() {
            overlay.remove();
            if (onDone) onDone();
        });
    }
};
