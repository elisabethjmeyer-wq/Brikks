# CLAUDE.md — Contexte pour Claude Code

## Le projet

**Brikks** est une plateforme e-learning française pour ~50 élèves de secondaire (histoire-géo, EMC).
L'utilisatrice principale est la professeure qui n'est pas développeuse : expliquer en termes simples, jamais de jargon inutile.

## Principes de travail

- **Proposer avant de coder** : analyser, proposer des solutions avec explications, attendre validation
- **Challenger si meilleure approche** : "Pourquoi pas plutôt...?" avec avantages/inconvénients
- **Expliquer l'impact métier** : pas "on refactorise le singleton", mais "les élèves ne verront plus les brouillons"
- **Pas d'usine à gaz** : solutions simples, minimales, maintenables
- **Pas de sur-ingénierie** : ne pas ajouter ce qui n'est pas demandé
- **Signaler la perte de contexte** : quand tu sens que tu perds en performance (relecture de fichiers déjà lus, oublis, réponses moins précises, compression du contexte), **dis-le immédiatement** à l'utilisatrice et propose de changer de conversation. Fournis-lui un résumé à copier-coller pour la prochaine session contenant : ce qui a été fait, ce qui reste à faire, les fichiers modifiés, et les décisions prises
- **Maintenir la documentation** : après chaque session de travail, mettre à jour la vue fonctionnelle ci-dessous (état des modules) et ajouter une entrée dans `CHANGELOG.md`. Ne documenter que les modules sur lesquels tu as effectivement travaillé — ne pas deviner l'état des modules inconnus.

## Vue fonctionnelle

> Cette section décrit l'état réel de chaque module, tel que constaté par les Claude successifs.
> **Règle** : ne documenter ici que ce qu'on a vérifié en travaillant dessus. Les modules non listés sont inconnus — le prochain Claude devra les explorer lui-même.

### Entraînements de connaissances (élève) — AUDITÉ ET NETTOYÉ

**Page** : `eleve/entrainements-conn.html`
**Fichiers** : `eleve-connaissances.js`, `-formats.js`, `-validation.js`, `-results.js`, `-utils.js`
**Backend** : `Entrainements.gs` (mémorisation), `Connaissances.gs` (banques de questions)

**Ce que fait le module :**
- L'élève voit une liste de banques d'exercices, chacune contenant des entraînements
- Chaque entraînement comporte 1 à N étapes, chaque étape ayant un format de question
- Formats supportés : QCM, vrai/faux, texte à trous, association, frise chronologique, image cliquable (carte), question ouverte, flashcard
- Après validation, l'élève voit un écran de correction détaillé avec feedback par question
- Système de **répétition espacée** : 7 niveaux à valider avec des délais croissants entre chaque révision
- Les entraînements verrouillés affichent la date de prochaine révision
- Mode libre : l'élève peut s'entraîner même quand un entraînement est verrouillé (sans impact sur la progression)
- Barre de progression par banque : pourcentage moyen des niveaux validés

**Appels API** (chargement initial, 6 en parallèle) :
`getBanquesExercicesConn`, `getEntrainementsConn`, `getEtapesConn`, `getEtapeQuestionsConn`, `getFormatsQuestions`, `getQuestionsConnaissances`
**Appels API** (progression) : `getProgressionMemorisation`, `saveProgressionMemorisation`

**État** : fonctionnel, audité, code nettoyé et factorisé. UX de correction retravaillée.

### Paramètres admin + mode prévisualisation — VÉRIFIÉ

**Page** : `admin/parametres.html`
**Fichiers** : `js/admin-parametres.js` (826 lignes), `components/eleve-layout.js` (620 lignes)
**Backend** : `Parametres.gs` (194 lignes)

**Ce que fait le module :**
- La prof configure le titre, sous-titre, emoji et couleur du site via la feuille PARAMETRES
- La prof gère le menu élève avec **3 états de visibilité** par page :
  - **Visible** (vert) : page dans le menu, cliquable pour les élèves
  - **Bloqué** (orange) : page dans le menu mais verrouillée (cadenas), non cliquable
  - **Masqué** (gris) : page complètement absente du menu élève
- Le toggle cycle entre les 3 états (clic = état suivant)
- **Mode prévisualisation** (`sessionStorage.brikks_preview`) : la prof voit toutes les pages y compris les masquées, avec des badges indiquant l'état réel et un bandeau cyan « Mode test »
- Réordonnancement par drag & drop + sélection d'icône inline

**Données** : 2 colonnes dans CONFIG_MENU : `visible` (bool) + `bloque` (bool). `collectMenuState()` convertit l'état DOM → données avant sauvegarde.

**Appels API** : `SheetsAPI.fetchAndParse('PARAMETRES')`, `SheetsAPI.fetchAndParse('CONFIG_MENU')`, `updateParametres`, `updateMenuConfig`

**État** : fonctionnel, ajouté en session 7.

### Module compétences (élève + admin) — RESTRUCTURÉ SESSION 8

**Pages** : `eleve/entrainements-comp.html`, `admin/competences.html`, onglet dans `admin/banques-exercices.html`
**Fichiers** : `eleve-competences.js`, `eleve-competences-exercice.js`, `admin-competences.js`, `admin-banques-exercices-questions.js` (section compétences)
**Backend** : `Competences.gs` (CRUD banques + entraînements + critères + progressions élève)

**Modèle de données (session 8) :**
```
CompetencesReferentiel (id, nom, description, consigne, ordre, visible)
    └── CriteresReussite (id, competence_id, libelle, ordre)
BanquesCompetences (id, competence_id, titre, description, ordre, statut)  ← NOUVEAU
    └── EntrainementsCompetences (id, titre, competence_id, banque_id, ..., document_contenu, correction_contenu, delai_mail_minutes, delai_papier_jours)
          └── EleveEntrainementsCompetences (id, eleve_id, entrainement_id, mode, statut, ..., mode_rendu)
```

**Ce que fait le module :**
- Le référentiel (admin) définit les compétences et leurs critères de réussite
- Les banques de compétences regroupent les entraînements et contrôlent la visibilité élève (statut brouillon/publié)
- Chaque banque est liée à une compétence du référentiel
- L'élève voit les banques publiées sous forme de cartes (nom compétence, nb exercices, nb critères, progression)
- Navigation 3 niveaux : liste des banques → détail (critères + exercices) → exercice (iframe ou texte riche + timer)
- Document et corrigé : au choix lien Google Doc (iframe) ou texte riche saisi directement par l'admin (HTML)
- 2 modes : entraînement (corrigé visible) / évalué (soumission au prof)
- **Popup de soumission** (mode évalué) : l'élève choisit soumettre / ne pas soumettre / continuer, puis papier / numérique, avec délais précis calculés depuis `JOURS_NON_COURS`
- Délais configurables par entraînement : `delai_mail_minutes` (défaut 30), `delai_papier_jours` (défaut 1, jours ouvrés)
- Statuts élève : pas commencé → en cours → entraîné → soumis → validé → non_soumis (refus)
- `mode_rendu` stocké dans EleveEntrainementsCompetences : 'papier', 'numerique', 'non_soumis'

**Appels API** (élève, 4-5 en parallèle) :
`getCompetencesReferentiel`, `getCriteresReussite`, `getBanquesCompetences`, `getEntrainementsCompetences`, `getEleveEntrainementsCompetences`

**Appels API** (admin, dans le batch de 14 en parallèle) :
`getBanquesCompetences`, `getCompetencesReferentiel`, `getCriteresReussite`, `getTachesComplexes`

**Rétro-compatibilité** : les anciens noms d'API (getTachesComplexes, etc.) sont des aliases dans Code.gs et Competences.gs

**Legacy** : `eleve-exercices-competences.js` — **SUPPRIMÉ** (confirmé non chargé, session 11). Remplacé par `eleve-competences.js` + `eleve-competences-exercice.js`.

**Problèmes corrigés (session 9)** :
- ~~Pas de `beforeunload` en mode évalué~~ → `_addBeforeUnload()` / `_removeBeforeUnload()` ajoutés
- ~~`tempsPasse` ne cumulait pas les reprises~~ → calcul basé sur `duree - timeRemaining`
- ~~Échec API silencieux au `finishEntrainement`~~ → notification d'erreur visible via `_showNotification()`
- ~~`getBanqueStatus` ne distinguait pas "soumis"~~ → nouveau statut `soumise` (label "En attente", cssClass `submitted`)
- ~~HTML correction dupliqué 2×~~ → factorisé dans `_buildCorrectionHTML()`
- ~~HTML document dupliqué 4×~~ → factorisé dans `_buildDocumentHTML()`
- ~~`_getCorrectionUrl` quasi-identique à `_parseCorrectionData`~~ → supprimé, `_parseCorrectionData` utilisé partout
- ~~`closeModal` écrasait `currentEntrainement`~~ → nettoyage d'état retiré du close, méthodes appelantes simplifiées

**Ajouts session 10** :
- Popup de soumission 2 étapes via `SubmissionUtils` (fichier partagé `js/submission-utils.js`)
- `showEvaluationResult()` supprimé (remplacé par le popup)
- `cancelEvaluation()` redirige vers le popup
- Colonnes `delai_mail_minutes`, `delai_papier_jours` dans EntrainementsCompetences (migration progressive)
- Colonne `mode_rendu` dans EleveEntrainementsCompetences (migration progressive)
- Champs admin pour configurer les délais de rendu par entraînement

**Ajouts session 14** :
- Vue évaluation élève refaite : layout 2 colonnes identique au mode entraînement
- `_buildFeedbackHTML()` supprimée, remplacée par `_buildCorrectionProfHTML()` (URL, blocs JSON, HTML brut)
- `_renderEvalReview()` : colonne gauche (Sujet/Corrigé toggle), colonne droite (critères lecture seule + bandeau statut)
- Critères validés par le prof (`progression.criteres_valides`) affichés avec indicateurs visuels
- Si `statut_correction === 'brouillon'`, corrigé et critères masqués côté élève

**État** : audité et nettoyé (session 9, popup session 10, vue évaluation session 14). Code propre, factorisé et maintenable.

### Correction des évaluations (admin) — CRÉÉ SESSION 14, ÉTENDU SESSION 28

**Page** : `admin/corrections.html`
**Fichiers** : `js/admin-corrections.js`, `js/block-editor.js` (mixin partagé)
**Backend** : `Competences.gs` (`validateEleveEntrainementCompetence`), `Evaluations.gs` (`saveEvaluationCorrection`)
**CSS** : `css/admin-corrections.css`

**Ce que fait le module :**
- La prof voit une grille de cartes unifiée : copies d'entraînements compétences + bonus/TC
- Sources de données : `EleveEntrainementsCompetences` (statut='soumis') + `EVALUATION_RESULTATS` (demande_statut='accepte')
- Cartes avec badges type : compétence (bleu), TC (rouge), bonus comp (violet), bonus ponctuel (teal)
- Clic sur une carte ouvre un **wizard 4 étapes** :
  1. **Informations** : infos élève/exercice + toggle brouillon/publié (visibilité élève)
  2. **Correction** : block editor (ou lien Google Doc) + onglets Construction / Vue élève
  3. **Critères** : adapté selon le type :
     - Compétence / bonus comp : critères de la compétence ciblée
     - TC : sections groupées par compétence (multi-critères)
     - Bonus ponctuel : critères libres de l'exercice
  4. **Bilan** : résumé avant confirmation
- `statut_correction` (brouillon/publié) persisté côté backend — si brouillon, l'élève ne voit pas le corrigé
- Save routé vers `saveEvaluationCorrection` (bonus/TC → EVALUATION_RESULTATS) ou `validateEleveEntrainementCompetence` (compétences → EleveEntrainementsCompetences)

**Block editor partagé** (`js/block-editor.js`) :
- Factory `createBlockEditorMixin(hostName)` retourne un objet de méthodes paramétré par le nom du module hôte
- Monté via `Object.assign(Module, createBlockEditorMixin('Module'))`
- Types de blocs : text, document, image, video, group (+ tableau/question pour AdminBanquesExercices)
- Éditeur de texte riche intégré (contenteditable + toolbar)
- Drag & drop, groupes côte à côte avec ratios configurables
- Utilisé par `AdminCorrections` et `AdminBanquesExercices`

**Données** : colonnes de `EleveEntrainementsCompetences` (migration progressive) :
`correction_prof` (URL ou JSON blocs), `criteres_valides` (JSON array d'IDs), `statut_correction` (brouillon/publie), `remarque_prof` (inutilisé)

**Appels API** : `validateEleveEntrainementCompetence` (écriture), `getEleveEntrainementsCompetences` (lecture, retourne toutes les colonnes dynamiquement)

**Session 32** : étape Critères enrichie (tags matière + badges validation live par compétence), étape Bilan avec résumé par matière en lecture seule (plus d'input manuel de points). Points calculés automatiquement depuis les critères validés via `_computePointsParCompetence()` et `_getCompPointsMap()`.

**État** : créé et audité (session 14), points auto (session 32). Code propre et maintenable.

### Notes élève — CRÉÉ SESSION 16, HARMONISÉ SESSION 25

**Page** : `eleve/notes.html`
**Fichiers** : `js/eleve-notes.js` (~470 lignes), `css/eleve-notes.css` (~640 lignes)
**CSS importé** : `eleve-evaluations.css` (pour `.hero-header`, `.tabs-bar`, `.tab-btn`)
**Backend** : lecture seule via `SheetsAPI` (6 tables) + `saveObjectifEleve` (JSONP)

**Ce que fait le module :**
- L'élève voit ses notes pour une matière (toggle FR / HG-EMC via `.tabs-bar`)
- Hero header avec titre, lien évaluations, et sélecteur semestre S1/S2
- Note de progression avec barre visuelle et formule détaillée
- Points par catégorie (connaissances, savoir-faire, compétences, bonus) en barres colorées
- Liste des évaluations sommatives avec notes et coefficients
- Moyenne pondérée : `(progression × coefProg + Σ(sommative × coef)) / Σ(coefs)`
- Objectif personnel via slider interactif sur la barre de progression (clic pour positionner), sauvegardé via API

**Calculs** : identiques au tableau de bord admin (`admin-tableau-bord.js`), appliqués au seul élève connecté.

**Appels API** (chargement, 6 en parallèle) :
`EVALUATIONS`, `EVALUATION_RESULTATS`, `NOTES_SOMMATIVES`, `RESULTATS_SOMMATIVES`, `PARAMETRES_NOTES`, `OBJECTIFS_ELEVES`

**Appels API** (écriture) : `saveObjectifEleve` (JSONP)

**Harmonisation session 25** :
- Breadcrumb supprimé (géré par `eleve-layout.js`)
- Container `.res-container` supprimé (largeur gérée par `<main>`)
- Header adopte le pattern `.hero-header` de la page évaluations
- Dropdown semestre remplacé par boutons S1/S2 simples
- Toggle matière réutilise `.tabs-bar` + `.tab-btn` existants
- CSS réécrit : variables CSS du site (`--primary`, `--gray-*`, `--accent-*`), tailles augmentées (14-16px), cards avec padding 22-26px et `box-shadow` aligné

**Ajouts session 28** :
- Section Compétences : agrège les passages depuis EleveEntrainementsCompetences + EVALUATION_RESULTATS (bonus comp + TC)
- Passages montrent la source (bonus, TC) avec tags visuels et le titre de l'évaluation
- Section Bonus : 3 sous-types distincts (compétence, ponctuel, suivi)
- Bonus suivi : barre de progression (historique complet au clic prévu en phase future)
- Bonus comp/ponctuel : statuts détaillés (demandé, accepté, corrigé, validé, refusé)
- Type tags sur les cartes bonus (compétence violet, ponctuel teal, suivi jaune)

**Refonte session 38** :
- 6 bugs corrigés (visibilité, liens, calculs)
- Refonte visuelle (cards, typographie, couleurs)
- Toggle matière séparé du hero header
- Objectif via slider sur la barre de progression (remplace l'ancien input)

**État** : créé (session 16), harmonisé (session 25), bonus/TC (session 28), refondu (session 38). Fonctionnel.

### Mes évaluations élève (liste) — REFONDU SESSION 21

**Page** : `eleve/evaluations.html`
**Fichiers** : `js/eleve-evaluations.js` (~824 lignes), `css/eleve-evaluations.css` (~887 lignes)
**Backend** : lecture seule via `SheetsAPI` (6 tables) + `callAPI` pour les résultats compétences

**Ce que fait le module :**
- L'élève voit la liste de ses évaluations avec onglets (Évaluations / Bonus) et compteurs
- Carte de progression en haut à droite : moyenne /20, points par catégorie (conn, SF, comp, bonus), lien vers la page notes
- Toggle matière (FR / HG-EMC) filtre les évaluations et recalcule la moyenne
- Cartes enrichies : badge type, statut (à faire, en cours, validée, non validée, terminée, absent, non rendu), score en cercle, points gagnés/perdus
- Regroupement par statut : « À PASSER » en haut, « TERMINÉES » en bas
- Lien « Voir le détail → » pour consulter la correction après passage
- Tags visuels pour les statuts spéciaux : absent (rouge) et non rendu (orange) avec +0 point affiché

**Appels API** (chargement, 8 en parallèle) :
`EVALUATIONS`, `EVALUATION_RESULTATS`, `NOTES_SOMMATIVES`, `RESULTATS_SOMMATIVES`, `PARAMETRES_NOTES`, `OBJECTIFS_ELEVES` (via SheetsAPI) + `getEleveEntrainementsCompetences`, `getBanquesCompetences` (via callAPI)

**État** : refondu (session 21), statuts NR/ABS ajoutés (session 23). Fonctionnel.

### Évaluation élève (passage d'évaluation) — REFONDU SESSION 17, SF SESSION 20, BILAN SESSION 23

**Page** : `eleve/evaluation.html`
**Fichiers** : `js/eleve-evaluation.js` (~1081 lignes), `css/eleve-evaluation.css` (~392 lignes)
**Backend** : `Evaluations.gs` (~2066 lignes)

**Ce que fait le module :**
- L'élève passe une évaluation chronométrée (connaissances, savoir-faire, compétences, bonus)
- **Connaissances** : piloté via `EleveConnaissances` (étapes, formats QCM/VF/etc., validation)
- **Savoir-faire** : piloté via `EleveExercices` (exercice unique, formats tableau/carte/document/etc.)
- Timer compte à rebours avec alerte visuelle en dessous de 60s
- Modal de confirmation pour quitter (avec les boutons Annuler / Confirmer)
- **Écran bilan 2 colonnes** (session 23) : colonne gauche (résultat, score, points, bouton retour) + colonne droite (conseil personnalisé + correction détaillée scrollable)

**Bifurcation par type (session 20)** :
- `init()` détecte le type et appelle `setupConnaissancesModule()` ou `setupSFModule()`
- `setupSFModule()` injecte l'exercice dans `EleveExercices`, utilise ses `FORMAT_HANDLERS`
- `renderSFExerciseView()` : rendu SF avec bandeau orange, timer, bouton Terminer
- `_finishSF()` : validation via le handler SF, capture du HTML corrigé
- SF seuil = 100% (zéro erreur), résultat sauvegardé avec `banque_id` pour la progression

**Écran bilan (session 23)** :
- Layout 2 colonnes desktop, empilé mobile
- Conseil contextuel : lien vers la banque source de l'évaluation pour s'entraîner (réussite ou échec)
- Correction détaillée dans un conteneur scrollable à droite
- Vue review pleine page accessible depuis la liste des évaluations (via `?review=1&evalId=...`)

**Layout** : plein écran sans sidebar. Design cohérent avec les entraînements :
- Bandeau `exercise-header.connaissances` (bleu) ou `.savoir-faire` (orange) selon le type
- Barre de progression des étapes (connaissances) ou exercice unique (SF)

**Scripts chargés** : `eleve-connaissances*.js` (5 fichiers) + `eleve-exercices*.js` (3 fichiers : base, formats, validation)

**Appels API** : mêmes que EleveConnaissances/EleveExercices (via override), + `saveEvaluationResult`

**État** : connaissances refondu (session 17), SF ajouté (session 20), bilan refondu (session 23). Fonctionnel.

## Architecture technique

### Stack
- **Frontend** : JavaScript vanilla + HTML + CSS (pas de framework)
- **Backend** : Google Apps Script (GAS) + Google Sheets comme base de données
- **Communication** : JSONP via `callAPI(action, params)` (script tags dynamiques). **Attention** : `callAPI` n'est pas une fonction partagée — chaque module (objet JS) a sa propre copie de la méthode.
- **Lecture directe** : certaines pages lisent Google Sheets API v4 via `sheets.js` (cache localStorage)
- **Déploiement** : GitHub Pages, avec préfixe `/Brikks/` dans les routes (voir `config.js`)
- **Linting** : ESLint configuré — lancer `npm run lint` avant de pousser des changements
- **Build GAS** : `npm run build:gas` concatène les 12 fichiers source `.gs` en `TOUT-EN-UN.gs` (Code.gs en premier, puis alphabétique)
- **Pattern modules** : chaque module est un objet singleton `const ModuleName = { ... }` (pas de classes). Les gros modules sont découpés via `Object.assign(ModuleName, { ... })` dans des fichiers séparés (-formats, -validation, etc.)

### Fonctions globales
- **`escapeHtml(str)`** : fonction globale définie dans `app.js` (hors de l'objet `App`). Échappe les caractères HTML via DOM. Utilisée dans tous les modules — ne pas redéfinir en local.
- **`createBlockEditorMixin(hostName)`** : factory globale définie dans `js/block-editor.js`. Retourne un objet de méthodes pour un éditeur de blocs (text, document, image, video, group). Le paramètre `hostName` est utilisé pour générer les `onclick` (ex: `AdminCorrections.addBlock('text')`). Monter via `Object.assign(Module, createBlockEditorMixin('Module'))`.

### Fichiers clés à connaître
- **`js/config.js`** : configuration centrale — tables Google Sheets (`CONFIG.SHEETS`), URL API, routes, seuils de mémorisation (`CONFIG.SEUIL_*`), clés localStorage (`CONFIG.STORAGE_KEYS`). C'est le schéma de la "base de données".
- **`google-apps-script/Code.gs`** : routeur backend — toutes les actions API y sont routées via un switch/case
- **`components/admin-layout.js`** et **`components/eleve-layout.js`** : sidebar, header, navigation
- **`README.md`** : ⚠️ **OBSOLÈTE** — contient des informations dépassées, ne pas s'y fier
- **`.eslintrc.json`** : config ESLint, contient la liste de tous les globals (noms des modules)

### Structure du repo
```
Brikks/
├── js/                          # 57 fichiers JS (~50k lignes)
│   ├── config.js                # ⭐ Configuration centrale (sheets, API, routes)
│   ├── block-editor.js          # Mixin block editor partagé (createBlockEditorMixin)
│   └── submission-utils.js      # Utilitaires de soumission (popup, calcul délais, jours ouvrés)
├── css/                         # 35 fichiers CSS (~48k lignes)
├── google-apps-script/          # 12 fichiers .gs + TOUT-EN-UN.gs (~10k lignes source)
│   ├── Code.gs                  # Routeur principal (switch/case sur 'action')
│   ├── Entrainements.gs         # Entraînements + mémorisation (répétition espacée)
│   ├── Connaissances.gs         # Banques de questions connaissances
│   ├── Exercices.gs             # Banques d'exercices + savoir-faire
│   ├── Evaluations.gs           # Évaluations
│   ├── Competences.gs           # Référentiel compétences + tâches complexes
│   ├── Users.gs                 # Utilisateurs, classes, groupes
│   ├── Themes.gs                # Disciplines, thèmes, chapitres
│   ├── Methodologie.gs          # Méthodologie (arbre hiérarchique)
│   ├── FAQ.gs                   # FAQ
│   ├── Videos.gs                # Vidéos + recommandations
│   └── Parametres.gs            # Paramètres du site
├── admin/                       # 18 pages HTML admin (prof)
├── eleve/                       # 18 pages HTML élève
├── components/                  # Layouts admin + élève + composants partagés
└── index.html                   # Point d'entrée (login)
```

### Module connaissances élève (audité)
```
js/eleve-connaissances.js           # Principal : chargement, rendu accordéon, navigation étapes
js/eleve-connaissances-formats.js   # Rendus des formats (QCM, V/F, chrono, association, etc.)
js/eleve-connaissances-validation.js # Validation des réponses par format
js/eleve-connaissances-results.js   # Écran de résultats, progression, mémorisation
js/eleve-connaissances-utils.js     # Helpers partagés (normalizeFormat, resetEtapeState, etc.)
```

### Module exercices SF élève (audité et restructuré)
```
js/eleve-exercices.js               # Principal (1 198 lignes) : init, cache, accordéon, navigation, timer
js/eleve-exercices-sf.js            # Logique métier SF (435 lignes) : répétition espacée, statuts, blocage
js/eleve-exercices-formats.js       # Rendus HTML + corrections + resets (863 lignes)
js/eleve-exercices-validation.js    # Validation des réponses + comparaison normalisée (288 lignes)
js/eleve-exercices-results.js       # Résultats, stats locales, écran SF, célébration (635 lignes)
js/eleve-exercices-competences.js   # SUPPRIMÉ (remplacé par eleve-competences*.js)
css/eleve-exercices.css             # Styles exercices élève
```

**Ce que fait le module :**
- L'élève voit une liste de banques d'exercices en accordéon, chacune avec un bandeau de statut SF
- Chaque banque a un exercice aléatoire assigné, formats supportés : `tableau_saisie`, `carte_cliquable`, `document_tableau`, `question_ouverte`, `document_mixte`
- Système de **répétition espacée SF** : 5 niveaux avec espacements croissants (0, 1, 3, 7, 14 jours)
- Dès la répétition 2, le temps de réponse conditionne la validation (automatisation)
- Mode libre : l'élève peut s'entraîner pendant les pauses d'espacement (sans impact sur la progression)
- Écran de résultat SF dédié avec bilan, correction détaillée, et animation de célébration

**Patterns techniques :**
- `parseJSONField(raw, fallback)` : helper global pour parser les champs JSON (gère double-encodage)
- `FORMAT_HANDLERS` : registre central des formats `{render, validate, showCorrection, reset}`
- Cache localStorage (TTL 5 min) + refresh arrière-plan avec merge des stats locales
- Stats par banque (`statsSFBanque`) comme source de vérité, `statsSF` en fallback lecture seule

**Appels API** (chargement, 3 en parallèle) :
`getBanquesExercices`, `getExercices`, `getFormatsExercices`
**Appels API** (stats SF) : `getHistoriquePratiquesSF`, `getResultatsEleve`, `saveResultatExercice`, `savePratiqueSF`

### Module admin connaissances — création d'entraînements (audité et nettoyé)
```
js/admin-banques-exercices.js                  # Module parent (1 419 lignes) : init, cache, API JSONP, tabs, rendu savoir-faire
js/admin-banques-exercices-connaissances.js    # Extension (1 756 lignes) : wizard 4 étapes + CRUD banques/entraînements
js/admin-banques-exercices-questions.js        # Extension (1 848 lignes) : CRUD banques de questions
js/admin-banques-exercices-builders.js         # Extension (1 849 lignes) : builders (tableau, carte, mixte)
css/admin-banques-exercices.css                # Styles (4 324 lignes, dont ~800 pour le wizard)
css/admin-banques-questions.css                # Styles banques de questions (812 lignes)
```

**Ce que fait le module :**
- La prof gère deux sections via un toggle : « Banques d'exercices » (entraînements) et « Banques de questions »
- Création/modification d'un entraînement via un wizard en 4 étapes :
  1. Paramètres (titre, durée, seuil, statut brouillon/publié)
  2. Étapes (formats d'exercices) — ajout par format, drag & drop pour réordonner
  3. Questions — mode manuel (sélection checkboxes) ou aléatoire (nb + banque source)
  4. Validation — résumé avant sauvegarde
- CRUD complet pour les banques d'exercices, entraînements, étapes, et questions

**Patterns techniques :**
- Cache localStorage (TTL 3 min) + refresh arrière-plan
- Mises à jour optimistes avec rollback en cas d'erreur API
- Protection double-clic via flags `_navigating`, `_addingEtape`, `_finalizing`, etc.
- Notifications non-bloquantes (`showNotification`) pour les erreurs et validations
- `getQuestionsForFormat(formatCode, etapeId?)` : fonction unifiée de filtrage des questions

**Appels API** (chargement, 12 en parallèle) :
`getBanquesExercices`, `getFormatsExercices`, `getExercices`, `getTachesComplexes`, `getCompetencesReferentiel`, `getBanquesQuestions`, `getQuestionsConnaissances`, `getFormatsQuestions`, `getBanquesExercicesConn`, `getEntrainementsConn`, `getEtapesConn`, `getEtapeQuestionsConn`

## Conventions importantes

### Formats de questions — noms canoniques
Toujours utiliser les noms canoniques. La fonction `normalizeFormat()` dans utils.js gère les alias.

| Canonical | Alias (géré par normalizeFormat) |
|-----------|----------------------------------|
| `texte_trou` | `texte_trous` |
| `timeline` | `chronologie` |
| `qcm` | — |
| `vrai_faux` | — |
| `association` | — |
| `carte` | — |
| `question_ouverte` | — |
| `flashcard` | — |

### Convention de durée (session 20)

**Règle : `duree` est TOUJOURS stockée en minutes** (dans les Google Sheets et dans les objets JS côté frontend).

| Module | Stockage | Default | Timer interne |
|--------|----------|---------|---------------|
| Connaissances | minutes | 15 | `ent.duree * 60` |
| Savoir-faire | minutes | 10 | `exo.duree * 60` dans `startTimer()` |
| Compétences | minutes | 30 | `(entrainement.duree || 30) * 60` |
| Évaluation | minutes | 15 | `dureeMinutes * 60` (unifié tous types) |

- **Saisie admin** : l'utilisatrice entre des minutes, stockées telles quelles
- **Timer** : la conversion `× 60` se fait **une seule fois**, au moment de lancer le compte à rebours
- **Migration** : `migrateDureeToMinutes` (action API) convertit les anciennes valeurs en secondes (> 120) vers des minutes

### Constantes de mémorisation
| Module | Étapes | Constante backend | Constante frontend |
|--------|--------|-------------------|-------------------|
| **Connaissances** | 7 | `ETAPE_MAX = 7` (Entrainements.gs) | `CONFIG.SEUIL_CONNAISSANCES` → `SEUIL_ETAPES` (EleveConnaissances) |
| **Savoir-faire** | 5 | Système par banque (Exercices.gs) | `CONFIG.SEUIL_SAVOIR_FAIRE` → `SEUIL_REPETITIONS` (EleveExercices) |

Les seuils sont centralisés dans `config.js`. Les modules les lisent via `CONFIG.SEUIL_*`.

Le backend incrémente `prog.etape` après succès → c'est le **prochain** niveau à tenter.
Pour afficher le nombre de niveaux **validés** : `Math.max(0, prog.etape - 1)`.

### Helpers factorisés (eleve-connaissances-utils.js)
- `normalizeFormat(format)` — normalise les alias de format
- `getQcmCorrectIndices(q)` — extrait les indices corrects d'une question QCM
- `sortEventsByDate(events)` — tri chronologique par date numérique
- `resetEtapeState()` — réinitialise l'état d'une étape (réponses, sélections, format states)
- `getFormatLabel(formatCode)` — label humain d'un format (normalise automatiquement)
- `normalizeIntermediaire(text)` — normalisation légère (casse, accents, ponctuation, chiffres romains/lettres) sans stop words ni stemming — pour texte_trou, timeline, carte
- `compareAnswers(user, expected, stricte, light?)` — compare réponse élève/attendue. `stricte=true` → exact, `stricte=false` → normalisation souple. `light=true` → utilise `normalizeIntermediaire` au lieu de `normalizeSouple`

### Niveaux de comparaison des réponses
| Niveau | Fonction | Tolérance | Formats |
|--------|----------|-----------|---------|
| **Strict** | `compareAnswers(…, true)` | trim seulement | Tous (si `comparaison_stricte = true`) |
| **Intermédiaire** | `compareAnswers(…, false, true)` | casse, accents, ponctuation, chiffres romains/arabes/lettres | texte_trou, timeline, carte |
| **Complet** | `compareAnswers(…, false)` | intermédiaire + stop words + stemming + ordre libre | question_ouverte |

Le champ `donnees.comparaison_stricte` (boolean) contrôle le mode de correction par question. Présent dans les formats : question_ouverte, texte_trou, timeline (mode texte), carte. Défaut : `false` (souple).

### Pattern de données
- Les entraînements ont un `statut` : `'publie'` ou `'brouillon'` — filtrer côté frontend
- Les `format_code` viennent du backend, peuvent être des alias → toujours normaliser
- Les progressions (`this.progressions[entrainement_id]`) contiennent : `etape`, `statut`, `prochaine_revision`, `seuil`

## Points connus non traités

### Bugs / dette technique du module connaissances (à traiter)

- ~~**Erreur silencieuse de sauvegarde**~~ : **CORRIGÉ (session 6)** — bandeau rouge affiché si la sauvegarde échoue.
- ~~**Validation dupliquée**~~ : **CORRIGÉ (session 6)** — `validateCurrentEtape()` délègue maintenant aux `run*Validation()` pour 5 formats (texte_trou, timeline, chrono, carte, association). Les 3 formats restants (vrai_faux, qcm, question_ouverte) n'avaient pas de duplication.
- ~~**Parsing JSON `donnees` dupliqué 4x**~~ : **CORRIGÉ (session 6)** — `parseJSONField()` utilisé partout.
- **CSS chaotique (5 586 lignes)** : 17 doublons exacts supprimés (session 11). Reste : ~250 lignes de classes mortes (ancien système badges/progress), conflits de sélecteurs entre sections (`.correction-section`, `.unsupported-format`, `.qcm-feedback`), 4 blocs `@media 768px` séparés, 3 systèmes de carrousel CSS qui coexistent. Nettoyage supplémentaire **requiert des tests visuels**. Fichier : `css/eleve-connaissances.css`.
- ~~**`SEUIL_ETAPES` hardcodé côté frontend**~~ : **CORRIGÉ (session 11)** — les seuils sont maintenant centralisés dans `CONFIG.SEUIL_CONNAISSANCES` et `CONFIG.SEUIL_SAVOIR_FAIRE` dans `config.js`.
- ~~**Listener leak**~~ : **CORRIGÉ (session 6)** — listener stocké dans `_popoverClickHandler` et nettoyé dans `cleanupEventListeners()`.

### Bugs coordination frontend ↔ backend (session 12)

- ~~**`eleve_id` en dur dans evaluations**~~ : **CORRIGÉ (session 12)** — `eleve-evaluation.js` envoyait `'current_user'` au lieu de l'ID réel. Ajout de `_getCurrentUserId()` (Auth.user / sessionStorage / localStorage).
- ~~**Auto-soumission compétences sans vérification**~~ : **CORRIGÉ (session 12)** — `eleve-competences-exercice.js:_autoSubmitExpired()` mettait à jour l'état local même si l'API échouait. Vérifie maintenant `result.success`.
- ~~**Sauvegarde fire-and-forget wizard**~~ : **CORRIGÉ (session 12)** — `admin-banques-exercices-connaissances.js` envoyait `updateEntrainementConn` sans `await`. Maintenant attend + vérifie la réponse.
- ~~**Progression mémorisation sans else**~~ : **CORRIGÉ (session 12)** — `eleve-connaissances-results.js` ne gérait pas `response.success === false`. Branche else ajoutée avec `{ saveError: true }`.
- ~~**saveResultatExercice silencieux**~~ : **CORRIGÉ (session 12)** — `eleve-exercices-results.js` ignorait les échecs API. Log ajouté.
- ~~**Chaîne critères sans vérification**~~ : **CORRIGÉ (session 12)** — `admin-competences.js` ne vérifiait pas le succès de chaque delete/create/update de critère. Vérifie maintenant chaque opération.

### Bugs régression session 11 (corrigés session 13)

- ~~**Wizards admin cassés (self.escapeHtml)**~~ : **CORRIGÉ (session 13)** — la centralisation de `escapeHtml()` en global (session 11, Phase 1) n'avait pas été propagée à 3 fichiers d'extension (`comp-wizard`, `sf-wizard`, `builders`). 8 appels `self.escapeHtml(...)` lançaient un TypeError silencieux. Wizard compétences vide, wizard SF affichait l'étape 1 en double, prévisualisation exercices cassée.
- ~~**CSS modal-overlay conflit de convention**~~ : **CORRIGÉ (session 13)** — `style.css` base utilisait `display: none` + `.active`, toutes les pages utilisent `display: flex` + `.hidden`. Aligné sur `.hidden`.

### Bugs session 15 (correction + vue élève)

- ~~**Statut `non_valide` non géré dans `handleExerciseClick`**~~ : **CORRIGÉ (session 15)** — l'élève cliquait sur un exercice non validé et rien ne se passait. Le statut n'était pas dans le switch. Ajouté → ouvre la vue review.
- ~~**Wizard correction sans `beforeunload`**~~ : **CORRIGÉ (session 15)** — toute navigation hors de la page perdait les données du wizard sans avertissement. `beforeunload` ajouté à l'ouverture du modal, retiré à la fermeture/sauvegarde.
- ~~**`callAPI` sans timeout dans admin-corrections**~~ : **CORRIGÉ (session 15)** — timeout 30s ajouté pour éviter les requêtes bloquées indéfiniment.
- ~~**Notifications trop rapides**~~ : **CORRIGÉ (session 15)** — durée augmentée (4s success, 6s error) + animation de sortie `slideOut`.
- ~~**Code.gs : action POST non lue**~~ : **CORRIGÉ (session 15)** — `handleRequest` ne lisait `action` que depuis `e.parameter` (query params). Si un futur appel POST envoie l'action dans le body, elle était ignorée. Maintenant : `params.action || data.action`.

### Évaluations & Notes admin — PHASES 1-3 COMPLÈTES

**Pages** : `admin/evaluations.html`, `admin/parametrage-eval.html`, `admin/tableau-bord.html` (placeholder)
**Fichiers** : `js/admin-evaluations.js` (~2223 lignes), `js/admin-parametrage-eval.js` (~616 lignes), `css/admin-evaluations.css`, `css/admin-parametrage-eval.css`
**Backend** : `Evaluations.gs` (~2066 lignes)

**Ce que fait le module :**
- **Page Évaluations** : gestion des évaluations de progression (4 types : connaissances, savoir-faire, compétences, bonus) + sommatives (5ème onglet)
- Toggle matière (FR / HG-EMC / Toutes) pour filtrer les évaluations par matière
- Chaque évaluation a un champ `matiere` (FR, HG-EMC, Les deux) — les "Les deux" comptent 100% dans chaque matière
- Onglet **Sommatives** : CRUD évaluations sommatives (note /barème, coefficient, date, semestre)
- **Saisie des résultats** : vue pleine page avec tableau des élèves, colonnes score, points, mode (papier/numérique), source (auto/manuel), remarque. Affiche la banque/exercice réellement passés par chaque élève. Statuts spéciaux NR (non rendu) / ABS (absent) / NE (non évalué) avec couleurs de ligne distinctes. Tri par date décroissante.
- **Saisie des notes sommatives** : tableau compact (max 720px), colonnes Élève / Correction / Note / Statut. Note en lecture seule (remplie par le wizard de correction). Statut cliquable (toggle brouillon ↔ publié) uniquement si note existe. Ligne verte quand publié.
- **Bandeau corrections** : compte les copies à corriger (EleveEntrainementsCompetences avec statut='soumis')
- **Page Paramétrage** : 2 onglets — Notes de progression (semestres, config par matière) et Référentiel compétences (CRUD avec filtre matière)
- **Mode de passation** : chaque évaluation peut être "numérique" (défaut) ou "papier". En mode papier : badge 📄 sur la carte admin, boutons Commencer/Repasser masqués côté élève. L'attribution reste identique (auto par défaut, override manuel possible). Colonne `mode_passation` dans EVALUATIONS.
- **Programmation temporelle** : champs `date_ouverture` et `date_fermeture` optionnels. Le statut effectif est calculé automatiquement à partir des dates (planifiée → publiée → terminée). Côté élève : les évals planifiées apparaissent "à venir", les fermées sont masquées ou affichées comme "terminées".

**Tables backend (Phase 1)** :
- `PARAMETRES_NOTES` : id, matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin
- `NOTES_SOMMATIVES` : id, titre, matiere, bareme, coefficient, date, semestre
- `RESULTATS_SOMMATIVES` : id, sommative_id, eleve_id, note, statut, remarque_texte, remarque_media, date_saisie
- `OBJECTIFS_ELEVES` : id, eleve_id, matiere, semestre, objectif_note
- `EVALUATION_RESULTATS` : ajout colonnes mode, source, remarque_texte, remarque_media, statut, statut_resultat (upsert). `statut_resultat` : 'normal' (défaut), 'non_rendu', 'absent', 'non_evalue' — géré par l'admin dans la saisie des résultats
- `EVALUATIONS` : ajout colonnes date_ouverture, date_fermeture, mode_passation

**Appels API (évaluations)** : `createEvaluation`, `updateEvaluation`, `deleteEvaluation`, `saveEvaluationResult`, `getEvaluationResults`
**Appels API (sommatives)** : `createNoteSommative`, `updateNoteSommative`, `deleteNoteSommative`, `saveResultatSommative`, `getResultatsSommatives`
**Appels API (paramétrage)** : `saveParametresNotes`, `getParametresNotes`, `saveObjectifEleve`, `getObjectifsEleves`

**Sidebar admin** (4 items) : Évaluations, Tableau de bord, Paramétrage, Suivi

**Tableau de bord** (`admin/tableau-bord.html`, `js/admin-tableau-bord.js`, `css/admin-tableau-bord.css`) :
- Moteur de calcul : note de progression (`noteDepart + (pts/budget) × 19.5 + bonus`, cap 20)
- Points agrégés depuis EVALUATION_RESULTATS par catégorie et matière
- Moyenne pondérée : `(prog × coefProg + Σ(som × coef)) / Σ(coefs)`
- Vue classe triable + panneau détail élève (slide-in) + toggle semestre S1/S2

**État** : Phases 1-3 complètes. Mode passation papier/numérique ajouté (session 18). Page notes élève créée (session 16). Saisie résultats enrichie (session 23). Race condition sauvegarde corrigée (session 39).

### Onglets Tâches complexes et Bonus ponctuels — SUPPRIMÉS (Phase 9, session 30)

Les onglets TC (4ème) et Bonus ponctuels (5ème) de Banques d'exercices ont été supprimés.
Le contenu (document, corrigé, compétences, critères libres) est maintenant créé directement dans la page Évaluations via un wizard 5 étapes avec block editor.
Le code mort (`renderTachesComplexesTab`, `renderBonusPonctuelsTab`, modals associées) reste dans `admin-banques-exercices-questions.js` (non appelé).

### Admin Évaluations — wizard création — REFONDU SESSION 30 (Phase 9), AMÉLIORÉ SESSION 36

**Page** : `admin/evaluations.html` (onglets Compétences et Bonus)
**Fichiers** : `js/admin-evaluations.js` (~3800 lignes), `css/admin-evaluations.css`, `js/block-editor.js` (mixin)
**Backend** : `Evaluations.gs` (colonnes `document_contenu`, `correction_contenu`, `correction_commentee`, `competence_ids`, `criteres_libres`, `description`)

**Wizard TC** : 5 étapes (Paramètres → Compétences → Document → Corrigé → Résumé)
**Wizard bonus mission** : 5 étapes (Paramètres → Évaluation → Document → Corrigé → Résumé)
- L'étape 2 "Évaluation" fusionne compétences du référentiel + critères libres dans 2 sections pliables
- Section compétences : checkboxes groupées par matière, points par compétence, recherche
- Section critères libres : inputs texte personnalisés, ajout/suppression dynamique
- Validation : au moins une compétence OU un critère libre requis
**Connaissances / SF** : wizard 2 étapes (paramètres + sélection banque/entrainement) — inchangé
**Bonus suivi** : wizard 2 étapes (Paramètres → Détails : description + nb réussites + critères de réussite)

**Contenu stocké directement dans EVALUATIONS** : pas d'indirection via EntrainementsCompetences.
**Rétro-compatibilité** : `getEvaluationForEleve` (backend) crée un objet `exercice` virtuel pour les anciennes évaluations liées via `exercice_tc_id` / `exercice_comp_id` / `exercice_bonus_id`.

**Block editor** : monté via `Object.assign(AdminEvaluations, createBlockEditorMixin('AdminEvaluations'))`.
CSS partagé depuis `admin-banques-exercices.css` (chargé dans evaluations.html).

**Transport API** : `callAPI` utilise l'encodage Base64 (param `d`) pour éviter la limite URL JSONP avec les champs JSON volumineux. Le backend (`Code.gs:handleRequest`) décode automatiquement ce param.

**Bugs corrigés (session 29)** :
- ~~Cache périmé cross-page~~ → `clearCacheFor()` + `loadData()` dans `openModal()`
- ~~Mismatch type ID dropdowns~~ → `String()` sur toutes les comparaisons
- ~~Double parseSheetData côté élève~~ → supprimé dans `_loadCriteresHtml()`

**Bugs corrigés (session 36)** :
- ~~Erreur réseau (script.onerror) à la sauvegarde bonus mission~~ → URL JSONP trop longue avec les champs JSON URL-encodés. Fix : encodage Base64 du payload dans un seul param `d`

**État** : Phase 9 (A-E) complète. Wizard fonctionnel, rétro-compatible.

---

## Plan global — Évaluations phases 4-8

> Plan de référence pour les futures sessions. Coché = fait.

### Vue d'ensemble des parcours

**Parcours prof :**
```
Création :
  Évaluations > onglet Bonus       → créer bonus compétence / ponctuel / suivi
  Évaluations > onglet Compétences  → créer tâche complexe

Gestion des demandes :
  Évaluations                       → bandeau "X demandes" → accepter/refuser

Correction :
  Corrections (sidebar)             → wizard correction adapté au type

Saisie suivi :
  Évaluations > Saisie              → tableau progressif pour bonus suivi
```

**Parcours élève :**
```
Entraînements compétences :
  Entraînement uniquement, pas d'évaluation

Évaluations > Bonus :
  Bonus compétence  → "Demander" → attendre acceptation prof (date passage OU date butoir) → consulter sujet (lecture seule) → rendre papier/mail → voir correction
  Bonus ponctuel    → "Demander" → attendre acceptation prof → consulter sujet → rendre papier/mail → voir correction
  Bonus suivi       → "Demander" → attendre acceptation prof → vérifications périodiques (✓/✗) → points quand objectif atteint

Évaluations > Évaluations :
  Tâche complexe obligatoire → dates ouverture/fermeture → consulter sujet (lecture seule) → rendre papier/mail → voir correction par compétence
  Tâche complexe bonus       → "Demander" → même flux que bonus compétence → voir correction par compétence

Mes résultats :
  Section Compétences → validations par compétence (issues des bonus comp + tâches complexes), plafond 3 validations = acquise
  Section Bonus       → points bonus (suivi + ponctuel)
```

### Les 3 types de bonus

| Type | Description | Parcours élève | Points |
|------|-------------|----------------|--------|
| **Bonus compétence** | Évaluation liée au référentiel de compétences. L'élève demande à la passer, la prof accepte/refuse, l'élève passe en classe, la prof corrige. | Demander → Acceptation → Passage → Correction | Points bonus compétence |
| **Bonus ponctuel** | Évaluation ponctuelle avec critères libres (pas liés au référentiel). La prof la crée, l'élève demande à la passer. | Demander → Acceptation → Consulter sujet → Rendu papier/mail → Correction | Points bonus ponctuel |
| **Bonus suivi** | Suivi progressif (ex: gestion du matériel). L'élève demande à être évalué, la prof vérifie périodiquement (✓/✗). L'élève n'est pas pénalisé en cas d'échec. | Demander → Acceptation → Vérifications datées (✓/✗) → Points quand objectif atteint | Points bonus suivi |

### Phases restantes

**Phase 4 — Admin : création des évaluations bonus + TC** ✅
- [x] Onglet TC dans Banques d'exercices (banques + exercices + wizard 5 étapes)
- [x] Onglet Bonus ponctuels dans Banques d'exercices (5ème onglet, wizard 5 étapes avec critères libres)
- [x] Évaluations > onglet Compétences : créer une évaluation TC (cascade dropdown banque TC → exercice)
- [x] Évaluations > onglet Bonus : créer les 3 sous-types (compétence, ponctuel, suivi)
- [x] Backend : colonnes pour bonus/TC (sous_type_comp, sous_type_bonus, banque_tc_id, exercice_tc_id, banque_comp_id, exercice_comp_id, banque_bonus_id, exercice_bonus_id, nb_validations) en migration progressive

**Phase 5 — Backend demandes + Admin gestion des demandes**

> **Contraintes fondamentales (sessions 27-28)** :
> - Les évals bonus et TC ne se passent JAMAIS en ligne — consultation sujet uniquement
> - Le rendu est papier ou par mail. Terminologie : "sujet papier" / "sujet numérique"
> - La saisie du résultat est toujours manuelle par la prof
> - Le bouton "Commencer" ne doit JAMAIS apparaître pour les bonus/TC
> - Tous les bonus (compétence + ponctuel + suivi) fonctionnent sur demande de l'élève
> - Les TC peuvent être obligatoires (dates ouverture/fermeture) OU sur demande (bonus)
> - Plafond : 3 validations par compétence → compétence acquise, l'élève ne peut plus demander dessus
> - Bonus suivi : l'élève demande, la prof vérifie périodiquement (✓/✗ datés), l'élève n'est pas pénalisé si échec, points attribués quand nb réussites atteint (ex: 5 ✓)

- [x] **Backend : demandes dans EVALUATION_RESULTATS** — pas de table séparée, colonnes `demande_statut`, `date_demande`, `date_acceptation`, `date_rendu`, `type_date`, `remarque_prof` en migration progressive
- [x] **Backend : API demandes** — `demanderEvaluation`, `repondreDemandeEvaluation` (accepter/refuser + type_date [passage_classe/date_butoir] + date + remarque)
- [x] **Backend : API suivi** — `saveValidationSuivi` (legacy), `saveVerificationSuivi` (vérifications datées ✓/✗ avec historique JSON)
- [x] **Admin : bandeau "X demandes"** — bandeau bleu en haut de la page Évaluations, compte les `demande_statut='demande'`
- [x] **Admin : modal liste demandes** — cartes par demande avec badge type (bonus comp, ponctuel, TC), bouton "Répondre"
- [x] **Admin : modal accepter/refuser** — boutons Accepter/Refuser, choix type de date (passage classe / date butoir), date, remarque optionnelle
- [x] **Admin : saisie résultats bonus/TC** — colonne statut demande + colonne remarque (sans score/durée auto)
- [x] **Admin : saisie suivi** — tableau filtré (élèves inscrits uniquement), panneau "Ajouter une vérification" (date + toggle ✓/✗ par élève), pastilles historique, points attribués quand objectif atteint

**Phase 6 — Élève : affichage bonus + TC dans "Mes évaluations"** ✅

- [x] **Élève : cartes bonus compétence** — bouton "Demander" → statuts (envoyée, acceptée avec date, refusée avec remarque) → correction
- [x] **Élève : cartes bonus ponctuel** — même flux demande que bonus compétence
- [x] **Élève : cartes bonus suivi** — flux demande (bouton "Demander"), critères dépliables (chevron), barre de progression X/Y après acceptation, date dernière vérification, "Objectif atteint !" quand complet
- [x] **Élève : cartes tâche complexe obligatoire** — dans onglet Évaluations, mode papier forcé, consulter sujet
- [x] **Élève : cartes tâche complexe bonus** — dans onglet Bonus, même flux demande
- [x] **Élève : consultation sujet** — lien vers page évaluation en mode "sujet" (lecture seule)
- [x] **Élève : plafond 3 validations** — calcul validations par compétence, carte grisée "Compétence acquise" si 3/3

**Phase 7 — Admin : corrections bonus + TC** ✅
- [x] Backend : `saveEvaluationCorrection` action (correction_prof, criteres_valides, statut_correction, competence_ids_validees dans EVALUATION_RESULTATS)
- [x] Page Corrections : charge EVALUATIONS + EVALUATION_RESULTATS, merge bonus/TC avec compétences
- [x] Cartes avec badges type (TC rouge, bonus comp violet, ponctuel teal)
- [x] Wizard correction **bonus compétence** : block editor + critères de la compétence ciblée + validé/non validé
- [x] Wizard correction **bonus ponctuel** : block editor + critères libres de l'évaluation + validé/non validé
- [x] Wizard correction **tâche complexe** : block editor + N sections de critères (une par compétence) + validé/non validé par compétence
- [x] Save routé vers `saveEvaluationCorrection` (bonus/TC) ou `validateEleveEntrainementCompetence` (compétences)
- [x] Compteur copies à corriger dans la page évaluations inclut bonus + TC

**Phase 8 — Élève : résultats** ✅
- [x] Section Compétences : validations par compétence (training + bonus comp + TC), N/3, "Acquise" si 3/3
- [x] Passages montrent la source (bonus, TC) avec tags visuels
- [x] Section Bonus : 3 sous-types (compétence avec statut demande, ponctuel avec critères libres, suivi avec barre de progression)
- [x] Bonus suivi : barre de progression + historique complet au clic (à venir dans page résultats)
- [x] Calcul de la note de progression : déjà intégré via `_calculatePoints` qui lit EVALUATION_RESULTATS

**Phase 9 — Refonte : intégration wizards TC/bonus dans Évaluations** ✅

> **Décision session 29** : séparer clairement entraînements (Banques d'exercices) et évaluations (page Évaluations).
> Les onglets TC et Bonus ponctuels sont supprimés de Banques d'exercices.
> Les wizards de création sont intégrés directement dans la page Évaluations.
> Le contenu (document, corrigé, compétences, critères) est stocké dans EVALUATIONS (relation 1→1, pas d'indirection via EntrainementsCompetences).
> Les bonus compétence sont aussi dissociés des entraînements : wizard intégré avec sélection d'une compétence du référentiel.

**Nouvelles colonnes EVALUATIONS** (migration progressive) :
| Colonne | Usage | Types |
|---------|-------|-------|
| `document_contenu` | JSON blocs ou HTML (sujet) | TC, bonus comp, bonus ponctuel |
| `correction_contenu` | JSON blocs ou HTML (corrigé) | TC, bonus comp, bonus ponctuel |
| `correction_commentee` | URL Google Doc (alt au block editor) | TC, bonus comp, bonus ponctuel |
| `criteres_libres` | JSON array de strings | bonus ponctuel |
| `description` | Consigne/description | TC, bonus comp, bonus ponctuel |

Note : `competence_ids` existe déjà dans EVALUATIONS.

**Nouveaux wizards dans page Évaluations** :
| Type | Étapes |
|------|--------|
| **TC** | Paramètres → Compétences (N checkboxes) → Document (block editor) → Corrigé → Résumé |
| **Bonus mission** | Paramètres → Évaluation (compétences + critères libres fusionnés, sections pliables) → Document → Corrigé → Résumé |
| **Bonus suivi** | Paramètres → Détails (description + nb réussites + critères de réussite) |
| **Conn / SF** | Paramètres → Sélection entraînement (inchangé) |

**Phase A — Backend + colonnes** : ✅ (session 29)
**Phase B — Wizard admin 5 étapes** : ✅ (session 30)
**Phase C — Côté élève** : ✅ (session 30) — `eleve-evaluation.js` lit directement depuis data, fallback exercice
**Phase D — Corrections admin** : ✅ (session 30) — `getCriteresLibres()` lit depuis evaluation d'abord
**Phase E — Nettoyage HTML/JS** : ✅ (session 30) — onglets TC/Bonus supprimés de banques-exercices. Code mort conservé dans questions.js (non appelé)
**Phase F — Migration données existantes** : à faire manuellement si nécessaire (script GAS pour copier contenu EntrainementsCompetences → EVALUATIONS)

**Phase 10 — Points par compétence** ✅ (session 31)

> Au lieu d'un total global de points (`briques`) par évaluation, les points sont définis et attribués **par compétence**.
> Chaque compétence du référentiel a un champ `matiere` (FR, HG-EMC, Transversal).
> Les points gagnés sont automatiquement ventilés vers la bonne note de progression selon la matière de la compétence.
> Transversal = compte dans FR **et** HG-EMC.

**Nouvelles colonnes** (migration progressive) :
- `EVALUATIONS.points_par_competence` — JSON `{ "comp_id": pts_misés, ... }`
- `EVALUATION_RESULTATS.points_par_competence` — JSON `{ "comp_id": pts_gagnés, ... }`
- `briques` et `validations` restent comme totaux calculés (rétro-compatibilité)

**Changements** :
- Wizard création : inputs points par compétence dans l'étape Compétences (TC) et Compétence unique (bonus comp)
- Wizard correction : inputs points par compétence dans le bilan (étape 4), défaut intelligent
- `_calculatePoints()` refactoré dans 3 fichiers : ventile par matière du référentiel
- Affichage élève review TC : bandeau détaillé par compétence avec tags matière
- Section compétences notes élève : ne filtre plus par matière d'évaluation (filtre par competence_ids)

**Phase 11 — Refonte bonus suivi** ✅ (session 35)

> Le bonus suivi passe d'un simple compteur progressif à un vrai flux demande + vérifications datées.
> L'élève demande à être évalué (s'engage sur la durée), la prof vérifie périodiquement avec résultat ✓/✗.
> L'élève n'est pas pénalisé en cas d'échec — seules les réussites comptent vers l'objectif.

**Nouveau modèle de données** :
- `EVALUATION_RESULTATS.validations_historique` — JSON array `[{"date":"2026-01-15","resultat":true},{"date":"2026-02-03","resultat":false},...]`
- `validation_numero` recalculé = nombre de `true` dans l'historique (rétro-compatible)
- `EVALUATIONS.criteres_libres` utilisé pour les critères de réussite du suivi

**Changements** :
- Wizard admin : 2 étapes (Paramètres → Détails : description + nb réussites requises + critères de réussite)
- Admin saisie : tableau filtré (élèves inscrits uniquement), panneau "Ajouter une vérification" (date picker + toggle ✓/✗), pastilles historique colorées
- Carte élève : 5 statuts (`suivi_disponible`, `suivi_demande`, `suivi_refuse`, `suivi_en_cours`, `suivi_complete`), bouton "Demander", critères dépliables (chevron), barre de progression, date dernière vérification
- Carte admin : compteur "Inscrits" (élèves acceptés) au lieu de "0/26 Saisis"
- Backend : action `saveVerificationSuivi` (ajout/modif/suppression avec historique JSON)

**À faire** : historique complet visible au clic sur la carte suivi dans la page résultats (`eleve-notes.js`)

### Décisions prises (sessions 28-29)

> Questions ouvertes de la session 27 — **toutes résolues** :

1. **Bonus ponctuel : qui initie ?** → La prof crée le bonus, l'élève demande à le passer (même flux que bonus compétence)
2. **Mode de rendu** → Terminologie : "sujet papier" / "sujet numérique". L'élève ne fait jamais l'évaluation en ligne, il consulte le sujet seulement
3. **Date fixée par la prof** → Deux options : "date de passage en classe" OU "date butoir de rendu". La prof choisit l'un ou l'autre lors de l'acceptation. L'élève voit l'info sur sa carte
4. **Notifications** → Réutiliser le système existant (cloche dans sidebar + page corrections)
5. **Tâches complexes côté élève** → Même logique hors-ligne que les bonus. Consultation sujet, rendu papier/mail, saisie résultats manuelle
6. **Bonus suivi** → Flux demande élève + vérifications datées (✓/✗) par la prof, historique JSON, critères de réussite, l'élève n'est pas pénalisé en cas d'échec

> Décisions session 29 — **refonte architecture** :

7. **Séparation entraînements / évaluations** → Banques d'exercices = entraînements élève uniquement (conn, SF, comp). Page Évaluations = création complète TC, bonus, sommatives
8. **Relation 1→1** → Un exercice TC/bonus = une évaluation. Plus de banques intermédiaires ni de cascade dropdown
9. **Bonus compétence dissocié des entraînements** → Wizard intégré dans Évaluations avec sélection d'1 compétence du référentiel (plus de lien vers les exercices de la banque compétences)
10. **Stockage direct dans EVALUATIONS** → `document_contenu`, `correction_contenu`, `competence_ids`, `criteres_libres` stockés dans la table EVALUATIONS

---

### Points structurels

- **Sécurité** : mots de passe en clair dans Google Sheets, pas d'auth côté serveur, clé API exposée côté client. Acceptable pour ~50 élèves en environnement scolaire, mais à documenter.
- ~~**Suppression d'élèves sans cascade**~~ : **CORRIGÉ (session 9)** — `deleteUser()` nettoie maintenant 9 tables liées (progressions, résultats, connexions, compétences) avant de supprimer l'utilisateur. Fonction utilitaire `deleteRowsByValue_()` ajoutée.
- ~~**SHEETS constant obsolète**~~ : **CORRIGÉ (session 9)** — `TachesComplexes` → `EntrainementsCompetences`, `EleveTachesComplexes` → `EleveEntrainementsCompetences` dans Code.gs et TOUT-EN-UN.gs.
- **Module savoir-faire** : seuil de 5 étapes — vérifier l'alignement frontend/backend. Les fichiers sont très gros (~54k + ~64k lignes).
- **Code admin connaissances** : audité et nettoyé. Reste : CSS du wizard avec ~7 sélecteurs `.etape-*` dupliqués (fonctionnel mais fragile), `getQuestionPreview()` dupliqué dans 3 fichiers différents (à extraire dans un helper partagé un jour)
- **Module exercices élève SF** : audité et restructuré (session 4). L'ancien sous-module compétences (`eleve-exercices-competences.js`) a été supprimé — remplacé par `eleve-competences.js` + `eleve-competences-exercice.js`.
- **Tests** : aucun test automatisé (pas de framework de test configuré)
- **7 copies de `callAPI`** : chaque module a sa propre implémentation. Seul `admin-banques-exercices.js` a un timeout (15s). Les 6 autres peuvent rester bloqués indéfiniment. À centraliser un jour dans un fichier partagé. `admin-evaluations.js` utilise l'encodage Base64 (param `d`) pour éviter la limite URL avec les payloads JSON volumineux — à propager aux autres modules si le même problème survient.
- **Double système de lecture** : `callAPI` (JSONP) et `SheetsAPI` (REST direct) avec caches indépendants (TTL 3-5 min). Peut causer des décalages de données entre pages admin.
- **`SheetsAPI.clearCache()` trop large** : efface le cache de toutes les tables au lieu de celle modifiée. `SheetsAPI.clearCacheFor(sheetName)` ajouté (session 21) pour invalider une table spécifique — mais seul `admin-evaluations.js` l'utilise. Les autres modules appellent encore `clearCache()` global.
- **Block editor : listeners non nettoyés** : `_initBlockDragDrop()` dans `block-editor.js` ajoute des listeners à chaque re-render (`_renderBlocks()`). Les anciens listeners sont orphelins. Pas de bug observable sur des sessions courtes, mais memory leak théorique sur de longues sessions d'édition.
- **`remarque_prof`** : colonne créée par migration progressive dans `EleveEntrainementsCompetences`, mais le wizard correction ne l'utilise plus (remarque supprimée au profit du block editor). Colonne inerte.
- ~~**Erreur 429 Google Sheets au chargement**~~ : **CORRIGÉ (session 34)** — `checkPendingActivities` (4 appels) se lançait en parallèle de `loadData` (16 appels) → 20 requêtes simultanées dépassaient le quota. Différé de 2s pour laisser les données se mettre en cache.
- ~~**Dates tronquées côté élève**~~ : **CORRIGÉ (session 34)** — `_formatDateOnly()` affichait "Mar 10 mar" sans année. Remplacé par `toLocaleDateString('fr-FR')` → "mardi 10 mars 2026". Heure perdue par auto-conversion Google Sheets → cellule `date_rendu` forcée en texte (`@`) dans `Evaluations.gs`.
- ~~**Race condition sauvegarde résultats**~~ : **CORRIGÉ (session 39)** — `saveSaisie()` envoyait 24 requêtes en parallèle (`Promise.all`), causant des `appendRow` concurrents qui s'écrasaient + IDs dupliqués. Fix : `LockService.getScriptLock()` backend + ID unique avec suffixe aléatoire + sauvegarde par lots de 4 côté frontend.
