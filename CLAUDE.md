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

### Correction des évaluations (admin) — CRÉÉ SESSION 14

**Page** : `admin/corrections.html`
**Fichiers** : `js/admin-corrections.js`, `js/block-editor.js` (mixin partagé)
**Backend** : `Competences.gs` (`validateEleveEntrainementCompetence`)
**CSS** : `css/admin-corrections.css`

**Ce que fait le module :**
- La prof voit une grille de cartes (1 par copie soumise), avec compteurs par état
- Clic sur une carte ouvre un **wizard 4 étapes** :
  1. **Informations** : infos élève/exercice + toggle brouillon/publié (visibilité élève)
  2. **Correction** : block editor (ou lien Google Doc) + onglets Construction / Vue élève
  3. **Critères** : liste des critères de réussite à cocher + décision valide / non valide
  4. **Bilan** : résumé avant confirmation
- `statut_correction` (brouillon/publié) persisté côté backend — si brouillon, l'élève ne voit pas le corrigé

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

**État** : créé et audité (session 14). Code propre et maintenable.

## Architecture technique

### Stack
- **Frontend** : JavaScript vanilla + HTML + CSS (pas de framework)
- **Backend** : Google Apps Script (GAS) + Google Sheets comme base de données
- **Communication** : JSONP via `callAPI(action, params)` (script tags dynamiques). **Attention** : `callAPI` n'est pas une fonction partagée — chaque module (objet JS) a sa propre copie de la méthode.
- **Lecture directe** : certaines pages lisent Google Sheets API v4 via `sheets.js` (cache localStorage)
- **Déploiement** : GitHub Pages, avec préfixe `/Brikks/` dans les routes (voir `config.js`)
- **Linting** : ESLint configuré — lancer `npm run lint` avant de pousser des changements
- **Build GAS** : `npm run build:gas` concatène les 12 fichiers `.gs` en `TOUT-EN-UN.gs` (Code.gs en premier, puis alphabétique)
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
├── js/                          # 48 fichiers JS (~37k lignes)
│   ├── config.js                # ⭐ Configuration centrale (sheets, API, routes)
│   ├── block-editor.js          # Mixin block editor partagé (createBlockEditorMixin)
│   └── submission-utils.js      # Utilitaires de soumission (popup, calcul délais, jours ouvrés)
├── css/                         # 29 fichiers CSS (~38k lignes)
├── google-apps-script/          # 12 fichiers .gs (~7.8k lignes)
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

### Évaluations & Notes admin — PHASE 2 EN COURS

**Pages** : `admin/evaluations.html`, `admin/parametrage-eval.html`, `admin/tableau-bord.html` (placeholder)
**Fichiers** : `js/admin-evaluations.js` (~670 lignes), `js/admin-parametrage-eval.js` (~430 lignes), `css/admin-evaluations.css`, `css/admin-parametrage-eval.css`
**Backend** : `Evaluations.gs` (~990 lignes)

**Ce que fait le module :**
- **Page Évaluations** : gestion des évaluations de progression (4 types : connaissances, savoir-faire, compétences, bonus) + sommatives (5ème onglet)
- Toggle matière (FR / HG-EMC / Toutes) pour filtrer les évaluations par matière
- Chaque évaluation a un champ `matiere` (FR, HG-EMC, Les deux) — les "Les deux" comptent 100% dans chaque matière
- Onglet **Sommatives** : CRUD évaluations sommatives (note /barème, coefficient, date, semestre)
- **Saisie des résultats** : vue pleine page avec tableau des élèves, colonnes score, points, mode (papier/numérique), source (auto/manuel), remarque
- **Saisie des notes sommatives** : vue similaire avec note /barème et remarque
- **Bandeau corrections** : compte les copies à corriger (EleveEntrainementsCompetences avec statut='soumis')
- **Page Paramétrage** : 2 onglets — Notes de progression (semestres, config par matière) et Référentiel compétences (CRUD avec filtre matière)

**Tables backend (Phase 1)** :
- `PARAMETRES_NOTES` : id, matiere, semestre, note_depart, budget_estime, coefficient_progression, date_debut, date_fin
- `NOTES_SOMMATIVES` : id, titre, matiere, bareme, coefficient, date, semestre
- `RESULTATS_SOMMATIVES` : id, sommative_id, eleve_id, note, statut, remarque_texte, remarque_media, date_saisie
- `OBJECTIFS_ELEVES` : id, eleve_id, matiere, semestre, objectif_note
- `EVALUATION_RESULTATS` : ajout colonnes mode, source, remarque_texte, remarque_media, statut (upsert)

**Appels API (évaluations)** : `createEvaluation`, `updateEvaluation`, `deleteEvaluation`, `saveEvaluationResult`, `getEvaluationResults`
**Appels API (sommatives)** : `createNoteSommative`, `updateNoteSommative`, `deleteNoteSommative`, `saveResultatSommative`, `getResultatsSommatives`
**Appels API (paramétrage)** : `saveParametresNotes`, `getParametresNotes`, `saveObjectifEleve`, `getObjectifsEleves`

**Sidebar admin** (4 items) : Évaluations, Tableau de bord, Paramétrage, Suivi

**Tableau de bord** (`admin/tableau-bord.html`, `js/admin-tableau-bord.js`, `css/admin-tableau-bord.css`) :
- Moteur de calcul : note de progression (`noteDepart + (pts/budget) × 19.5 + bonus`, cap 20)
- Points agrégés depuis EVALUATION_RESULTATS par catégorie et matière
- Moyenne pondérée : `(prog × coefProg + Σ(som × coef)) / Σ(coefs)`
- Vue classe triable + panneau détail élève (slide-in) + toggle semestre S1/S2

**Phase restante** : Phase 4 (pages élève + enrichissement Suivi)

**État** : Phases 1-3 complètes.

### Points structurels

- **Sécurité** : mots de passe en clair dans Google Sheets, pas d'auth côté serveur, clé API exposée côté client. Acceptable pour ~50 élèves en environnement scolaire, mais à documenter.
- ~~**Suppression d'élèves sans cascade**~~ : **CORRIGÉ (session 9)** — `deleteUser()` nettoie maintenant 9 tables liées (progressions, résultats, connexions, compétences) avant de supprimer l'utilisateur. Fonction utilitaire `deleteRowsByValue_()` ajoutée.
- ~~**SHEETS constant obsolète**~~ : **CORRIGÉ (session 9)** — `TachesComplexes` → `EntrainementsCompetences`, `EleveTachesComplexes` → `EleveEntrainementsCompetences` dans Code.gs et TOUT-EN-UN.gs.
- **Module savoir-faire** : seuil de 5 étapes — vérifier l'alignement frontend/backend. Les fichiers sont très gros (~54k + ~64k lignes).
- **Code admin connaissances** : audité et nettoyé. Reste : CSS du wizard avec ~7 sélecteurs `.etape-*` dupliqués (fonctionnel mais fragile), `getQuestionPreview()` dupliqué dans 3 fichiers différents (à extraire dans un helper partagé un jour)
- **Module exercices élève SF** : audité et restructuré (session 4). L'ancien sous-module compétences (`eleve-exercices-competences.js`) a été supprimé — remplacé par `eleve-competences.js` + `eleve-competences-exercice.js`.
- **Tests** : aucun test automatisé (pas de framework de test configuré)
- **7 copies de `callAPI`** : chaque module a sa propre implémentation. Seul `admin-banques-exercices.js` a un timeout (15s). Les 6 autres peuvent rester bloqués indéfiniment. À centraliser un jour dans un fichier partagé.
- **Double système de lecture** : `callAPI` (JSONP) et `SheetsAPI` (REST direct) avec caches indépendants (TTL 3-5 min). Peut causer des décalages de données entre pages admin.
- **`SheetsAPI.clearCache()` trop large** : efface le cache de toutes les tables au lieu de celle modifiée. Force des rechargements inutiles.
- **Block editor : listeners non nettoyés** : `_initBlockDragDrop()` dans `block-editor.js` ajoute des listeners à chaque re-render (`_renderBlocks()`). Les anciens listeners sont orphelins. Pas de bug observable sur des sessions courtes, mais memory leak théorique sur de longues sessions d'édition.
- **`remarque_prof`** : colonne créée par migration progressive dans `EleveEntrainementsCompetences`, mais le wizard correction ne l'utilise plus (remarque supprimée au profit du block editor). Colonne inerte.
