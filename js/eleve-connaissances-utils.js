/**
 * eleve-connaissances-utils.js
 *
 * Utility methods extracted from eleve-connaissances.js.
 * Contains text comparison helpers, normalization pipeline,
 * formatting utilities, and celebration animations.
 *
 * Depends on EleveConnaissances being defined first.
 */

Object.assign(EleveConnaissances, {

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ========== PIPELINE COMPARAISON SOUPLE ==========

    /** Mots-outils français à ignorer en mode souple */
    STOP_WORDS: new Set([
        'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd',
        'a', 'au', 'aux', 'et', 'ou', 'en', 'dans', 'sur', 'par', 'pour'
    ]),

    /** Table chiffres écrits → arabe (1-30) */
    NOMBRES_LETTRES: {
        'zero': '0', 'un': '1', 'deux': '2', 'trois': '3', 'quatre': '4',
        'cinq': '5', 'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9',
        'dix': '10', 'onze': '11', 'douze': '12', 'treize': '13', 'quatorze': '14',
        'quinze': '15', 'seize': '16', 'dix-sept': '17', 'dix-huit': '18', 'dix-neuf': '19',
        'vingt': '20', 'vingt-et-un': '21', 'vingt-deux': '22', 'vingt-trois': '23',
        'vingt-quatre': '24', 'vingt-cinq': '25', 'vingt-six': '26', 'vingt-sept': '27',
        'vingt-huit': '28', 'vingt-neuf': '29', 'trente': '30',
        'premier': '1', 'premiere': '1', 'deuxieme': '2', 'troisieme': '3',
        'quatrieme': '4', 'cinquieme': '5', 'sixieme': '6', 'septieme': '7',
        'huitieme': '8', 'neuvieme': '9', 'dixieme': '10',
        'onzieme': '11', 'douzieme': '12', 'treizieme': '13', 'quatorzieme': '14',
        'quinzieme': '15', 'seizieme': '16', 'vingtieme': '20', 'trentieme': '30'
    },

    /** Table chiffres romains → arabe */
    ROMAINS: {
        'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8,
        'IX': 9, 'X': 10, 'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
        'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20, 'XXI': 21,
        'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27,
        'XXVIII': 28, 'XXIX': 29, 'XXX': 30
    },

    /**
     * Convertit les chiffres romains en arabes dans un texte.
     * Cherche les mots composés uniquement de I, V, X et les convertit.
     */
    convertRomainToArabe(text) {
        return text.replace(/\b([IVXLC]+)\b/g, (match) => {
            if (this.ROMAINS[match] !== undefined) {
                return String(this.ROMAINS[match]);
            }
            return match;
        });
    },

    /**
     * Convertit les nombres écrits en lettres en arabes.
     * Ex: "quatorze" → "14", "vingt-deux" → "22"
     */
    convertNombresLettres(text) {
        // D'abord les composés (vingt-deux, dix-sept, etc.)
        for (const [lettres, chiffre] of Object.entries(this.NOMBRES_LETTRES)) {
            if (lettres.includes('-')) {
                const regex = new RegExp('\\b' + lettres.replace('-', '[\\s-]') + '\\b', 'g');
                text = text.replace(regex, chiffre);
            }
        }
        // Puis les simples
        for (const [lettres, chiffre] of Object.entries(this.NOMBRES_LETTRES)) {
            if (!lettres.includes('-')) {
                const regex = new RegExp('\\b' + lettres + '\\b', 'g');
                text = text.replace(regex, chiffre);
            }
        }
        return text;
    },

    /**
     * Singularisation légère du français :
     * - eaux → eau (gâteaux → gâteau)
     * - aux → al (animaux → animal)
     * - s final retiré (chats → chat)
     * - x final retiré (cheveux → cheveu)
     */
    simpleStem(word) {
        if (word.length <= 2) return word;
        if (word.endsWith('eaux')) return word.slice(0, -1);       // eaux → eau
        if (word.endsWith('aux')) return word.slice(0, -3) + 'al'; // aux → al
        if (word.endsWith('s')) return word.slice(0, -1);          // s final
        if (word.endsWith('x')) return word.slice(0, -1);          // x final
        return word;
    },

    /**
     * Normalise un texte pour comparaison tolérante (mode souple) :
     * - minuscules + suppression accents
     * - conversion romains → arabes, lettres → arabes
     * - suppression ponctuation
     * - suppression mots-outils
     * - singularisation légère
     */
    normalizeSouple(text) {
        if (!text) return '';
        // Convertir romains AVANT la mise en minuscules
        let t = this.convertRomainToArabe(text.trim());
        t = t.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
            .replace(/['']/g, ' ')                            // apostrophes → espace
            .replace(/[^a-z0-9\s\-]/g, '')                    // garder lettres, chiffres, espaces, tirets
            .replace(/\s+/g, ' ')
            .trim();
        // Convertir nombres en lettres → arabes
        t = this.convertNombresLettres(t);
        // Supprimer mots-outils et appliquer stemming
        const words = t.split(' ')
            .filter(w => !this.STOP_WORDS.has(w))
            .map(w => this.simpleStem(w));
        return words.join(' ');
    },

    /**
     * Sépare un texte brut en éléments (split sur "," et " et " et " ou ").
     * À appeler AVANT normalisation pour conserver les délimiteurs.
     */
    splitElements(text) {
        return text
            .split(/\s*,\s*|\s+et\s+|\s+ou\s+/i)
            .map(s => s.trim())
            .filter(Boolean);
    },

    /**
     * Compare une réponse élève à une réponse attendue.
     * @param {string} userAnswer - réponse de l'élève
     * @param {string} expectedAnswer - réponse attendue
     * @param {boolean} stricte - si true, comparaison exacte ; si false, pipeline souple
     */
    compareAnswers(userAnswer, expectedAnswer, stricte) {
        if (!userAnswer || !expectedAnswer) return false;

        // Mode strict : comparaison exacte (trim seulement)
        if (stricte) {
            return userAnswer.trim() === expectedAnswer.trim();
        }

        // Mode souple : comparaison directe après normalisation
        const normUser = this.normalizeSouple(userAnswer);
        const normExpected = this.normalizeSouple(expectedAnswer);
        if (normUser === normExpected) return true;

        // Comparaison par éléments : splitter le texte BRUT, puis normaliser chaque partie
        const userParts = this.splitElements(userAnswer).map(p => this.normalizeSouple(p)).sort();
        const expectedParts = this.splitElements(expectedAnswer).map(p => this.normalizeSouple(p)).sort();

        if (userParts.length === expectedParts.length && userParts.length > 0 &&
            userParts.every((part, i) => part === expectedParts[i])) {
            return true;
        }

        return false;
    },

    /**
     * Convertit une URL Google Drive partagée en URL d'image directe.
     * Ex: https://drive.google.com/file/d/ABC123/view → https://lh3.googleusercontent.com/d/ABC123
     */
    normalizeImageUrl(url) {
        if (!url) return '';
        const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/);
        if (driveFileMatch) {
            return `https://lh3.googleusercontent.com/d/${driveFileMatch[1]}`;
        }
        const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
        if (driveOpenMatch) {
            return `https://lh3.googleusercontent.com/d/${driveOpenMatch[1]}`;
        }
        const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
        if (driveUcMatch) {
            return `https://lh3.googleusercontent.com/d/${driveUcMatch[1]}`;
        }
        return url;
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    getFormatLabel(formatCode) {
        const labels = {
            'vrai_faux': 'Vrai/Faux',
            'qcm': 'QCM',
            'chronologie': 'Frise chronologique',
            'timeline': 'Frise chronologique',
            'texte_trou': 'Texte à trous',
            'texte_trous': 'Texte à trous',
            'association': 'Association',
            'carte': 'Image cliquable',
            'question_ouverte': 'Question ouverte',
            'flashcard': 'Flashcards'
        };
        return labels[formatCode] || formatCode;
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // ============================================
    // CÉLÉBRATIONS - Animations paillettes progressives (6 niveaux)
    // ============================================

    /**
     * Animation de célébration progressive selon le niveau validé
     * Intensité croissante : paillettes → confettis → étoiles dorées
     */
    triggerCelebration(level) {
        // Supprimer une célébration existante
        const existing = document.querySelector('.celebration-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.className = `celebration-container level-${level}`;
        document.body.appendChild(container);

        // Configuration progressive pour 6 niveaux
        const config = {
            1: { sparkles: 20, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b'] },
            2: { sparkles: 30, confetti: 0, stars: 0, colors: ['#fcd34d', '#fbbf24', '#f59e0b', '#34d399'] },
            3: { sparkles: 40, confetti: 15, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6'] },
            4: { sparkles: 45, confetti: 30, stars: 0, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            5: { sparkles: 50, confetti: 45, stars: 8, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa'] },
            6: { sparkles: 60, confetti: 60, stars: 15, colors: ['#fcd34d', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24'] }
        };

        const cfg = config[Math.min(level, 6)] || config[1];

        // Paillettes
        for (let i = 0; i < cfg.sparkles; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = Math.random() * 100 + '%';
            sparkle.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            sparkle.style.animationDelay = Math.random() * 0.5 + 's';
            sparkle.style.width = (6 + Math.random() * 8) + 'px';
            sparkle.style.height = sparkle.style.width;
            container.appendChild(sparkle);
        }

        // Confettis (niveau 3+)
        for (let i = 0; i < cfg.confetti; i++) {
            const confettiEl = document.createElement('div');
            confettiEl.className = 'confetti';
            confettiEl.style.left = Math.random() * 100 + '%';
            confettiEl.style.backgroundColor = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
            confettiEl.style.animationDelay = Math.random() * 0.8 + 's';
            confettiEl.style.width = (6 + Math.random() * 6) + 'px';
            confettiEl.style.height = (12 + Math.random() * 10) + 'px';
            container.appendChild(confettiEl);
        }

        // Étoiles dorées (niveau 5+)
        for (let i = 0; i < cfg.stars; i++) {
            const star = document.createElement('div');
            star.className = 'golden-star';
            star.style.left = Math.random() * 100 + '%';
            star.style.animationDelay = Math.random() * 1 + 's';
            star.style.width = (15 + Math.random() * 15) + 'px';
            star.style.height = star.style.width;
            container.appendChild(star);
        }

        // Supprimer après l'animation
        setTimeout(() => container.remove(), 5000);
    },

    /**
     * Célébration niveau 3 : Banque complète (tous les entraînements mémorisés)
     * Feu d'artifice spectaculaire multi-couleurs
     */
    celebrateBanqueComplete() {
        if (typeof confetti === 'undefined') return;

        const duration = 4000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 100, zIndex: 10000 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 80 * (timeLeft / duration);

            // Feu d'artifice depuis différentes positions
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ee82ee']
            });
            confetti({
                ...defaults,
                particleCount,
                origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                colors: ['#ff0000', '#ffa500', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#ee82ee']
            });
        }, 250);

        // Grand final au centre
        setTimeout(() => {
            confetti({
                particleCount: 200,
                spread: 180,
                origin: { y: 0.5, x: 0.5 },
                colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96e6a1'],
                shapes: ['star'],
                scalar: 1.5,
                gravity: 0.8
            });
        }, 3500);
    },

    /**
     * Vérifie si une banque est complètement mémorisée et déclenche la célébration
     */
    checkAndCelebrateBanqueComplete(banqueId) {
        const banqueEntrainements = this.entrainements.filter(e => e.banque_exercice_id === banqueId);
        if (banqueEntrainements.length === 0) return false;

        const allMemorized = banqueEntrainements.every(ent => {
            const prog = this.progressions[ent.id];
            return prog && prog.statut === 'memorise';
        });

        if (allMemorized) {
            // Petit délai pour laisser l'utilisateur voir le message d'abord
            setTimeout(() => this.celebrateBanqueComplete(), 500);
            return true;
        }
        return false;
    }

});
