# CHANGELOG — Journal des modifications

> Chaque session Claude ajoute une entrée en haut de ce fichier avec : date, résumé des modifications, fichiers touchés, décisions prises.

---

## 2026-03-08 — Session 26 : Onglet Tâches complexes + nettoyage compétences

### Modifications

1. **Nouvel onglet « Tâches complexes »** dans la page Banques d'exercices (4ème onglet, couleur rouge)
2. **Multi-compétences** : les banques de tâches complexes permettent de sélectionner plusieurs compétences du référentiel (checkboxes) via le champ `competence_ids` (JSON array)
3. **Modal dédiée** : formulaire de création/modification de banque TC avec checkboxes multi-sélection, titre, description, ordre, statut
4. **CRUD complet** : création, modification, suppression de banques TC + ajout/modification/suppression d'exercices (réutilise le wizard compétences existant)
5. **Drag & drop** : réordonnancement des banques et des exercices dans chaque banque
6. **Badges compétences** : chaque carte de banque TC affiche les compétences évaluées sous forme de badges violets
7. **Simplification onglet Compétences** : retrait du badge `type_usage` et du sélecteur d'usage dans la modal (les compétences sont toujours des entraînements)
8. **Séparation des données** : les banques sont splitées au chargement selon `type_usage` (`banquesCompetences` vs `banquesTachesComplexes`)

### Architecture

Les tâches complexes réutilisent les tables backend existantes (`BanquesCompetences` + `EntrainementsCompetences`) avec `type_usage='tache_complexe'`. Pas de nouvelle table Google Sheets nécessaire. La distinction se fait côté frontend par filtrage.

### Fichiers modifiés
- `admin/banques-exercices.html` : 4ème onglet + modal `#banqueTCModal`
- `js/admin-banques-exercices.js` : split données, tab switching, counts, rollback
- `js/admin-banques-exercices-questions.js` : rendu TC, modal TC, CRUD, drag & drop, nettoyage badge compétences
- `css/admin-banques-exercices.css` : styles onglet rouge, icône TC, checkboxes, badges compétences
- `google-apps-script/TOUT-EN-UN.gs` : rebuild

### Décisions
- Réutilisation des tables existantes plutôt que création de nouvelles (évite setup Google Sheets)
- Les exercices TC utilisent le wizard compétences existant (même format : document + correction + durée)
- L'onglet compétences ne montre plus le type_usage (toujours entraînement)

---

## 2026-03-08 — Session 25 : Harmonisation visuelle page résultats élève

### Modifications

1. **Hero header unifié** : la page « Mes résultats » utilise le même pattern `.hero-header` que la page évaluations (fond blanc, gradient latéral, border-radius 16px)
2. **Sélecteur semestre simplifié** : le dropdown remplacé par 2 boutons S1/S2 dans le hero header
3. **Toggle matière** : réutilise `.tabs-bar` et `.tab-btn` existants au lieu d'un composant custom
4. **Breadcrumb supprimé** : dupliquait celui géré par `eleve-layout.js`
5. **Container supprimé** : plus de `max-width: 700px` — la largeur est gérée par le `<main>` du layout
6. **CSS réécrit** : variables CSS du site (`--primary`, `--gray-*`), tailles de texte augmentées (14-16px), paddings cards 22-26px, box-shadow aligné

### Fichiers modifiés
- `js/eleve-notes.js` : suppression breadcrumb, header hero, boutons S1/S2, tabs-bar matière, suppression container wrapper
- `css/eleve-notes.css` : réécriture complète avec variables CSS du site
- `eleve/notes.html` : ajout import `eleve-evaluations.css` pour réutiliser hero-header et tabs-bar

### Décisions
- Import de `eleve-evaluations.css` dans `notes.html` pour réutiliser les classes sans duplication
- Suppression de `toggleSemMenu()` devenu inutile (boutons simples)

---

## 2026-03-08 — Session 24 : Wizard papier simplifié + statut sur carte

### Modifications

1. **Wizard éval papier : date simple** :
   - Quand mode passation = papier, les champs date/heure d'ouverture et fermeture sont remplacés par un unique champ "Date de l'évaluation" (type `date`, sans heure)
   - La date est stockée dans `date_ouverture`, `date_fermeture` reste vide
   - Le switch de mode (numérique ↔ papier) re-rend dynamiquement la section dates

2. **Statut retiré du wizard, ajouté sur la carte** :
   - Le select Brouillon/Publiée/Terminée est supprimé du wizard de création/modification
   - Un 4ème bouton (pastille colorée) apparaît sur chaque carte évaluation
   - Clic sur la pastille ouvre un dropdown avec les 3 statuts
   - Changement de statut instantané (mise à jour optimiste + appel API)
   - À la création, le statut est automatiquement "brouillon"

3. **Auto-terminée pour évals papier** :
   - Quand l'admin saisit des résultats sur une évaluation papier, le backend passe automatiquement le statut à "terminée"
   - Fonction `autoTerminePapier_()` ajoutée dans `Evaluations.gs`
   - Le rechargement des données après sauvegarde met à jour la carte automatiquement

4. **Côté élève** :
   - Les évaluations papier utilisent le statut manuel (pas d'auto-calcul depuis les dates)

### Fichiers modifiés
- `js/admin-evaluations.js` : wizard mode papier, `_renderProgrammation()`, `_onModePassationChange()`, `toggleStatusDropdown()`, `changeStatut()`, statut retiré du wizard
- `css/admin-evaluations.css` : styles dropdown statut (`.status-dropdown`, `.status-dot`)
- `js/eleve-evaluations.js` : `_computeEffectiveStatut()` gère le mode papier
- `google-apps-script/Evaluations.gs` : `autoTerminePapier_()`, appels dans `saveEvaluationResult`
- `google-apps-script/TOUT-EN-UN.gs` : rebuild

### Décisions
- Le statut n'est plus modifiable dans le wizard — uniquement via la pastille sur la carte (plus rapide, moins de clics)
- Pour les évals papier, le statut est entièrement manuel (pas de logique de dates d'ouverture/fermeture)
- L'auto-terminée se déclenche dès la première saisie de résultat sur une éval papier

---

## 2026-03-08 — Session 23 : Refonte bilan évaluation + statuts NR/ABS

### Modifications

1. **Refonte écran bilan évaluation élève** :
   - Layout 2 colonnes : gauche (résultat, score, points, bouton retour) + droite (conseil + correction scrollable)
   - Conseil contextuel avec lien vers la banque source pour s'entraîner
   - Vue review pleine page accessible depuis la liste des évaluations (`?review=1&evalId=...`)

2. **Fix cache et attribution des évaluations** :
   - Cache `SheetsAPI` : désactivation du cache arrière-plan qui écrasait les données fraîches
   - Attribution verrouillée : une fois qu'un élève a une banque_id attribuée, elle ne change plus (même après refresh)
   - Fix écrasement `banque_id` lors de la sauvegarde des résultats

3. **Affichage banque/exercice dans le tableau de saisie admin** :
   - Chaque ligne élève affiche la banque et l'exercice réellement passés (lu depuis `EVALUATION_RESULTATS`)

4. **Statuts spéciaux NR (non rendu) / ABS (absent)** :
   - Colonne `statut_resultat` dans `EVALUATION_RESULTATS` : 'normal', 'non_rendu', 'absent'
   - Admin saisie : boutons NR/ABS par élève avec couleurs de ligne (orange/rouge)
   - Évals terminées côté élève : cartes visibles avec badge non rendu/absent + tag visuel + +0 point
   - Backend : `saveEvaluationResult` gère le champ `statut_resultat`, migration progressive de la colonne

### Fichiers modifiés
- `js/eleve-evaluation.js` : refonte écran bilan, vue review, conseil contextuel
- `css/eleve-evaluation.css` : layout 2 colonnes bilan, responsive
- `js/eleve-evaluations.js` : affichage tags NR/ABS sur les cartes
- `css/eleve-evaluations.css` : styles tags NR/ABS
- `js/admin-evaluations.js` : boutons NR/ABS dans saisie, affichage banque/exercice
- `css/admin-evaluations.css` : styles lignes NR/ABS
- `js/sheets.js` : fix cache arrière-plan
- `google-apps-script/Evaluations.gs` : colonne `statut_resultat`, migration progressive
- `google-apps-script/Code.gs` : routage nouvelle action
- `google-apps-script/TOUT-EN-UN.gs` : rebuild

### Décisions
- Le conseil post-évaluation renvoie vers la banque source (connaissances ou SF) pour s'entraîner avant de retenter
- Les évaluations NR/ABS restent visibles côté élève (pas masquées) avec +0 point explicite
- `statut_resultat` ajouté par migration progressive (la colonne est créée automatiquement si absente)

---

## 2026-03-07 — Session 22 : Ajustements page évaluations élève

### Modifications

1. **Retrait du centrage `max-width: 740px`** sur `#evaluations-content` — la page reprend toute la largeur disponible, alignée à gauche comme les autres pages
2. **Section « Terminées » repliée par défaut** : l'élève voit d'abord les évaluations à passer sans scroller. Le toggle reste cliquable pour déplier. Appliqué aussi à l'onglet Bonus.

### Fichiers modifiés
- `css/eleve-evaluations.css` (retrait max-width)
- `js/eleve-evaluations.js` (sections repliées par défaut)

---

## 2026-03-07 — Session 21 : Refonte page « Mes évaluations » élève

### Modifications

1. **Refonte complète de la page évaluations élève** :
   - Nouveau design avec carte de progression (moyenne, points par catégorie, lien vers notes)
   - Onglets Évaluations / Bonus avec compteurs
   - Cartes d'évaluation enrichies : badge type (connaissances/SF), statut (validée, à faire, etc.), score en cercle, points gagnés/perdus
   - Regroupement par statut : À PASSER en haut, puis TERMINÉES
   - Lien « Voir le détail → » pour consulter la correction
   - Toggle matière (FR / HG-EMC) avec filtrage des évaluations et recalcul de la moyenne

2. **Fix bugs** :
   - `is_validated` : le calcul de validation utilisait `>=` au lieu de `>` pour le seuil (un score de 0% avec seuil 0 était validé)
   - Cache stale `SheetsAPI` : ajout de `SheetsAPI.invalidateCache(tableName)` pour invalider une table spécifique après sauvegarde (au lieu de tout vider)
   - Navigation retour depuis `eleve-evaluation.js` : invalide le cache EVALUATION_RESULTATS pour afficher le résultat immédiatement

3. **Fix CSS layout header** :
   - La carte progression débordait du header flex → contrainte `max-width` + `overflow: hidden`
   - Les sélecteurs `#evaluations-page .header-left/.header-right` écrasaient le header du layout global (hamburger + titre du site) → scopés avec `.page-header > .header-left`
   - Suppression du `.loader` local qui écrasait le `.loader` global de `style.css`

### Fichiers modifiés
- `js/eleve-evaluations.js` : refonte complète du rendu (cartes, onglets, progression, toggle matière)
- `css/eleve-evaluations.css` : refonte complète des styles
- `eleve/evaluations.html` : ajout scripts `sheets.js` + `eleve-notes.js` (calculs partagés)
- `js/eleve-evaluation.js` : invalidation cache après soumission
- `js/sheets.js` : ajout `SheetsAPI.invalidateCache(tableName)`

### Décisions
- La page évaluations réutilise le moteur de calcul de `eleve-notes.js` pour la moyenne
- Toggle matière persisté en `sessionStorage` (cohérent avec la page notes)
- Scopage CSS strict : tout sélecteur interne doit passer par `.page-header >` pour éviter les conflits avec le layout global

---

## 2026-03-06 — Session 20 : Évaluations SF + unification des durées

### Modifications

1. **Support des évaluations savoir-faire côté élève** :
   - Le module `eleve-evaluation.js` ne supportait que les connaissances. Les évaluations SF échouaient avec "Aucune étape disponible" car le backend renvoie `data.questions` (un exercice) au lieu de `data.etapes`
   - Ajouté `setupSFModule()` : injection de l'exercice dans `EleveExercices`, utilisation des `FORMAT_HANDLERS` SF (tableau_saisie, carte_cliquable, document_tableau, question_ouverte, document_mixte)
   - Ajouté `renderSFExerciseView()` : rendu SF avec le même layout évaluation (bandeau, timer, bouton Terminer)
   - Ajouté `_finishSF()` : validation via le handler SF + capture du HTML corrigé pour l'écran de résultat
   - Scripts SF (`eleve-exercices.js`, `-formats.js`, `-validation.js`) ajoutés dans `evaluation.html`
   - La progression SF admin se résout automatiquement : les résultats sont maintenant sauvegardés avec `banque_id`

2. **Unification du stockage des durées en minutes** :
   - Avant : SF stockait `duree` en secondes (600 = 10 min), compétences aussi (1800 = 30 min), connaissances en minutes (15 = 15 min)
   - Maintenant : tout est en minutes partout (saisie, stockage, affichage). Le timer interne fait `duree × 60` au lancement du compte à rebours
   - Wizards admin SF/comp : retrait des `× 60` (sauvegarde) et `÷ 60` (lecture)
   - Frontend élève : `startTimer(duree * 60)`, affichage simplifié
   - Defaults backend : 600 → 10 (Exercices.gs), 1800 → 30 (Competences.gs)
   - Migration one-shot : `migrateDureeToMinutes` divise par 60 les valeurs > 120 dans Exercices et EntrainementsCompetences

### Fichiers modifiés
- `js/eleve-evaluation.js` : support SF complet + timer unifié
- `eleve/evaluation.html` : scripts SF ajoutés
- `js/eleve-exercices.js` : `startTimer(duree * 60)`, affichage en minutes
- `js/eleve-exercices-results.js` : `tempsPrevu` converti en secondes
- `js/eleve-exercices-sf.js` : `tempsPrevu` converti en secondes
- `js/eleve-competences.js` : retrait des `÷ 60` à l'affichage
- `js/eleve-competences-exercice.js` : `duree * 60` pour le timer
- `js/admin-banques-exercices-sf-wizard.js` : retrait `× 60` sauvegarde, `÷ 60` lecture
- `js/admin-banques-exercices-comp-wizard.js` : idem
- `js/admin-banques-exercices.js` : defaults 600 → 10
- `js/admin-banques-exercices-questions.js` : retrait `× 60` sauvegarde, `÷ 60` lecture
- `google-apps-script/Code.gs` : routeur + `migrateDureeToMinutes_()`
- `google-apps-script/Exercices.gs` : default 600 → 10
- `google-apps-script/Competences.gs` : default 1800 → 30

### Décisions
- Convention unique : `duree` = minutes partout. Le `× 60` se fait uniquement au moment de lancer un timer (conversion en secondes internes)
- Migration des données existantes : seuil > 120 pour distinguer secondes vs minutes (aucun exercice ne dure plus de 2h)
- La migration doit être appelée une fois après déploiement du backend (`?action=migrateDureeToMinutes`)

---

## 2026-03-06 — Session 19 : Améliorations évaluations (Phase D)

### Modifications

1. **Wizard admin revu (D1)** :
   - Matière toujours visible (plus masquée pour non-bonus), couplée avec Mode passation sur la même ligne
   - Champ Durée ajouté pour connaissances et savoir-faire (avec placeholder "Auto si lié à un entraînement")
   - Durée manuelle prioritaire sur la durée auto-détectée depuis le contenu lié
   - Collecte du champ `evalDuree` dans `_collectWizardStepData()`

2. **Tableau de saisie enrichi (D2)** :
   - Colonne "Sujet attribué" ajoutée pour connaissances et savoir-faire (nom de banque + entraînement)
   - Chargement des attributions via `getAttributionsSujets` à l'ouverture de la saisie
   - Badge source (🤖 auto / ✏️ manuel) affiché avec le sujet
   - Lignes sans résultat visuellement distinguées (opacité réduite)
   - Colonne "Détail" supprimée (non fonctionnelle)

3. **Indicateur budget (D3)** :
   - Barre de progression "Points distribués : X / Y pts (S1/S2)" affichée sous les onglets
   - Calcul automatique : somme des briques des évals non-bonus pour la matière/semestre courant vs budget_estime
   - Couleurs : vert (< 80%), orange (80-100%), rouge (> 100%)

### Fichiers modifiés
- `js/admin-evaluations.js` : wizard durée, saisie avec attributions, budget indicator
- `css/admin-evaluations.css` : styles sujet, budget indicator, no-result rows
- `admin/evaluations.html` : budget indicator HTML
- `google-apps-script/TOUT-EN-UN.gs` : rebuild

---

## 2026-03-06 — Session 18 : Mode de passation papier/numérique + programmation temporelle

### Modifications

1. **Mode de passation** (papier / numérique) :
   - Wizard admin : champ "Mode de passation" dans l'étape Paramètres (aide contextuelle : "Papier : pas de bouton Commencer côté élève")
   - Cartes admin : badge 📄 Papier affiché si mode papier
   - Cartes élève : boutons Commencer/Repasser masqués pour les évaluations papier, badge 📄 dans les métadonnées
   - Backend : `mode_passation` ajouté aux champs modifiables dans `updateEvaluation`
   - **Prérequis** : ajouter la colonne `mode_passation` dans le header de la feuille EVALUATIONS

2. **Programmation temporelle** (dates d'ouverture/fermeture) :
   - Champs `date_ouverture` et `date_fermeture` ajoutés aux champs modifiables backend
   - Statut effectif auto-calculé à partir des dates (planifiée → publiée → terminée)
   - Côté élève : catégorie "fermées" ajoutée, évals planifiées affichées comme "à venir"
   - Côté admin : dates affichées sur les cartes

3. **Nettoyages** :
   - Variable `eval` renommée en `evaluation` dans `eleve-evaluations.js` (mot réservé JS)
   - Durée affichée correctement (`duree` prioritaire sur `duree_estimee`)
   - `statut_resultat` ajouté aux champs modifiables dans `saveEvaluationResult`

### Fichiers modifiés
- `js/admin-evaluations.js` : badge papier, dates sur cartes, statut auto-calculé
- `js/eleve-evaluations.js` : filtrage par dates, catégorie fermées, masquage boutons papier
- `google-apps-script/Evaluations.gs` : champs modifiables étendus (mode_passation, dates, statut_resultat)
- `google-apps-script/TOUT-EN-UN.gs` : idem

### Décisions
- Le mode papier est un flag visuel : il masque les boutons côté élève mais ne change pas le système d'attribution (toujours automatique par défaut, override manuel via le modal 👥)
- Les colonnes `mode_passation`, `date_ouverture`, `date_fermeture` doivent être ajoutées manuellement dans le header de la feuille EVALUATIONS
- Pas de génération PDF/impression pour le moment

---

## 2026-03-05 — Session 17 : Refonte visuelle page évaluation élève

### Problèmes corrigés

1. **Header noir/jaune incohérent** : la page d'évaluation avait un header custom (`evaluation-header`) avec un gradient noir, des accents jaunes et une police monospace pour le timer — un design complètement étranger au reste du site.

2. **Modal de confirmation cassée** : les styles `.modal-footer` et `.modal-small` n'étaient définis dans aucun CSS chargé par la page. Les boutons (`.btn-primary`) avaient `width: 100%` (style du login), ce qui les rendait pleine largeur dans le popup.

3. **Layout sans repères** : pas de bouton "Quitter" visible (seulement une croix SVG discrète dans le header noir), pas de continuité visuelle avec les entraînements.

### Modifications

1. **Remplacement du header** par le bandeau `exercise-header.connaissances` (bleu, identique aux entraînements) contenant : titre de l'évaluation, type + points en jeu, timer.

2. **Ajout d'un bouton « ← Quitter l'évaluation »** en haut (même style que « ← Retour aux entraînements »).

3. **Correction de la modal** : ajout des styles `.modal-footer` (boutons côte à côte) et override de `.btn-primary` en `width: auto` dans le contexte `#confirmModal`.

4. **Nettoyage HTML** : suppression du header custom, du `progressSection` redondant, simplification de la structure.

5. **CSS réduit** de ~400 lignes à ~220 lignes (suppression de tout le design custom header/badges/timer).

### Fichiers modifiés
- `js/eleve-evaluation.js` : `renderExerciseView()` réécrit, `renderHeader()` supprimé, `updateTimerDisplay()` simplifié
- `eleve/evaluation.html` : HTML simplifié (header + progressSection supprimés)
- `css/eleve-evaluation.css` : réécrit (header supprimé, modal-footer ajouté, résultats conservés)

### Décisions
- Le mode plein écran (sans sidebar) est conservé — logique pour une évaluation chronométrée
- Le design réutilise les classes existantes (`exercise-header`, `exercise-card`, `exercise-timer`) au lieu d'un design system séparé

---

## 2026-03-05 — Session 16 (suite 2) : Phase 4 Page notes élève

### Modifications

1. **Page "Mes notes" élève** (`eleve/notes.html`, `js/eleve-notes.js`, `css/eleve-notes.css`) :
   - Toggle matière FR / HG-EMC
   - Note de progression avec barre de progression et formule détaillée
   - Points par catégorie (connaissances, savoir-faire, compétences, bonus) avec barres colorées
   - Moyenne pondérée avec détail progression + sommatives
   - Liste des évaluations sommatives avec notes et coefficients
   - Objectif personnel (saisie + sauvegarde via API)
   - Même moteur de calcul que le tableau de bord admin

### Fichiers créés
- `js/eleve-notes.js` (~290 lignes)
- `css/eleve-notes.css` (~280 lignes)
- `eleve/notes.html` (réécrit depuis placeholder)

### Fichiers modifiés
- `.eslintrc.json` (ajout global `EleveNotes`)

---

## 2026-03-05 — Session 16 (suite) : Phase 3 Tableau de bord

### Modifications

1. **Moteur de calcul des notes** (`js/admin-tableau-bord.js`) :
   - Note de progression : `noteDepart + (pointsSansBonus / budget) × 19.5 + bonus`, plafonnée à 20
   - Points agrégés par catégorie depuis EVALUATION_RESULTATS
   - Moyenne pondérée : `(progression × coefProg + Σ(sommative×coef)) / Σ(coefs)`
   - Évaluations "Les deux" comptent 100% dans chaque matière

2. **Vue classe** : tableau triable avec Prog. FR, Prog. HG, Moy. FR, Moy. HG. Code couleur par niveau.

3. **Cartes résumé** : moyennes classe FR/HG, nb élèves, nb évaluations.

4. **Toggle semestre** (S1/S2).

5. **Panneau détail élève** (slide-in) : formule détaillée, points par catégorie, sommatives, moyenne.

### Fichiers créés
- `js/admin-tableau-bord.js` (~300 lignes)
- `css/admin-tableau-bord.css` (~400 lignes)
- `admin/tableau-bord.html` (réécrit)

---

## 2026-03-05 — Session 16 : Phase 2 Évaluations (matière, sommatives, saisie)

### Contexte
Continuation du module Évaluations & Notes. Phase 1 (backend + paramétrage + sidebar) était terminée. Phase 2 enrichit la page Évaluations existante.

### Modifications

1. **Toggle matière** (`admin/evaluations.html`, `js/admin-evaluations.js`) : boutons FR / HG-EMC / Toutes dans le header. Filtre les évaluations et sommatives par matière. Les évaluations "Les deux" apparaissent dans les deux filtres.

2. **Champ matière dans le modal** : nouveau select (FR / HG-EMC / Les deux) avec aide contextuelle "Les points comptent 100% dans chaque matière".

3. **Onglet Sommatives** (5ème onglet) : CRUD complet pour les évaluations sommatives (note /barème, coefficient, date, semestre). Modal de création/modification dédié. Cartes avec compteur notes saisies/total.

4. **Bandeau corrections** : affiche le nombre de copies à corriger (EleveEntrainementsCompetences statut='soumis') avec lien vers la page corrections.

5. **Saisie des résultats** (vue pleine page) : clic sur 📝 d'une évaluation → tableau avec tous les élèves. Pour les évaluations de progression : colonnes mode (papier/numérique), score, points, source (auto/manuel), remarque. Pour les sommatives : note /barème et remarque. Barre de sauvegarde fixe en bas.

6. **Champ catégorie** dans le modal évaluation : permet de spécifier la catégorie pour le calcul de la note de progression (par défaut = même que le type).

### Fichiers modifiés
- `admin/evaluations.html` — restructuré avec matière toggle, sommatives tab, saisie view, sommative modal
- `js/admin-evaluations.js` — réécrit (~670 lignes) avec matière filter, sommatives CRUD, saisie view, corrections banner
- `css/admin-evaluations.css` — réécrit avec styles pour matière toggle, badges, saisie table, sommative cards, notifications
- `.eslintrc.json` — ajout global `AdminEvaluations`
- `CLAUDE.md` — ajout documentation module Évaluations & Notes admin

### Décisions
- Sommatives dans un 5ème onglet (pas mélangées avec les 4 types de progression)
- Saisie en vue pleine page (pas en modal) pour avoir de la place pour le tableau
- Mode papier/numérique par élève par évaluation (dans EVALUATION_RESULTATS)

---

## 2026-03-04 — Session 15 : Corrections bugs affichage corrigé + wizard

### Contexte
L'utilisatrice signale que le corrigé ne s'affiche pas côté élève, que les notifications fonctionnent mal, et que le wizard correction perd ses données à la navigation.

### Corrections

1. **Statut `non_valide` manquant** (`js/eleve-competences.js`) : le switch `handleExerciseClick` ne gérait pas le statut `non_valide`. L'élève cliquait sur un exercice corrigé "non validé" → rien ne se passait. C'était la raison principale pour laquelle le corrigé ne s'affichait pas.

2. **Wizard correction : `beforeunload`** (`js/admin-corrections.js`) : tout l'état du wizard était en mémoire. Navigation hors de la page = perte totale sans avertissement. Ajout de `_addBeforeUnload()` / `_removeBeforeUnload()` à l'ouverture/fermeture du modal.

3. **`callAPI` sans timeout** (`js/admin-corrections.js`) : les requêtes JSONP pouvaient rester bloquées indéfiniment (pas de timeout, pas d'erreur). Ajout d'un timeout de 30s avec rejet de la promise.

4. **Notifications améliorées** (`js/admin-corrections.js` + `css/admin-corrections.css`) : durée portée à 4s (success) / 6s (error), animation de sortie `slideOut` ajoutée.

5. **Code.gs : lecture de l'action depuis le body POST** : `handleRequest` ne lisait `action` que depuis `e.parameter`. Ajout de `data.action` en fallback pour les futurs appels POST.

### Fichiers modifiés
- `js/eleve-competences.js` — ajout `non_valide` dans `handleExerciseClick`
- `js/admin-corrections.js` — beforeunload, timeout callAPI, notifications améliorées
- `css/admin-corrections.css` — animation slideOut
- `google-apps-script/Code.gs` — action POST fallback
- `google-apps-script/TOUT-EN-UN.gs` — rebuild

---

## 2026-03-04 — Session 14 : Wizard correction refondé + vue évaluation élève

### Contexte
Refonte complète du wizard de correction (admin) et de la vue post-correction (élève) pour les entraînements de compétences en mode évaluation.

### Modifications

1. **Block editor partagé** (`js/block-editor.js`) : extraction d'un mixin factory `createBlockEditorMixin(hostName)` réutilisable. Blocs : text, document, image, video, group. Drag & drop, éditeur de texte riche intégré, groupes côte à côte avec ratios.

2. **Wizard correction 4 étapes** (`js/admin-corrections.js`) :
   - Étape 1 : Informations + toggle brouillon/publié
   - Étape 2 : Block editor avec toggle Lien Google Doc / Éditeur + onglets Construction / Vue élève
   - Étape 3 : Critères de réussite (cocher/décocher) + décision validé / non validé
   - Étape 4 : Bilan résumé avant confirmation
   - Remarque supprimée (redondante avec le block editor)

3. **Vue évaluation élève** (`js/eleve-competences-exercice.js`) :
   - Layout 2 colonnes identique au mode entraînement
   - Colonne gauche : toggle Sujet (document exercice) / Corrigé (correction_prof du wizard)
   - Colonne droite : critères de réussite en lecture seule (cochés par le prof) + bandeau statut
   - Parsing JSON blocs dans `_buildCorrectionProfHTML()` (remplace `_buildFeedbackHTML`)
   - Si `statut_correction === 'brouillon'`, corrigé et critères masqués côté élève

4. **Backend** (`Competences.gs`) :
   - Colonne `statut_correction` ajoutée à la migration progressive
   - Écriture/lecture de `statut_correction` dans `validateEleveEntrainementCompetence()`

5. **Nettoyage post-audit** :
   - 6 classes CSS mortes supprimées (`.comp-prof-feedback`, `.comp-prof-remarque`, etc.)
   - XSS corrigé dans `_formatLegende()` de `admin-corrections.js` (manquait `escapeHtml`)
   - `parseInt` radix ajouté dans `block-editor.js` et `admin-corrections.js`
   - Fond vert `.comp-inplace-corrige` supprimé (neutre partout)

### Fichiers créés
- `js/block-editor.js` — mixin block editor partagé

### Fichiers modifiés
- `js/admin-corrections.js` — refondu (wizard 4 étapes + block editor)
- `js/admin-banques-exercices-blockeditor.js` — réécrit pour utiliser le mixin
- `js/eleve-competences-exercice.js` — vue évaluation 2 colonnes
- `css/admin-corrections.css` — styles wizard + block editor
- `css/eleve-competences.css` — styles eval review + nettoyage CSS mort
- `admin/corrections.html` — ajout script block-editor.js, 4 étapes wizard
- `admin/banques-exercices.html` — ajout script block-editor.js
- `google-apps-script/Competences.gs` — colonne statut_correction
- `google-apps-script/TOUT-EN-UN.gs` — rebuild
- `.eslintrc.json` — ajout global `createBlockEditorMixin`

### Décisions
- Le block editor est un mixin (pas une classe) pour rester cohérent avec le pattern singleton du projet
- `remarque_prof` conservée en colonne inerte (migration progressive la crée mais le wizard ne l'utilise plus)
- Le fond vert du corrigé (`.comp-inplace-corrige`) supprimé en entraînement ET évaluation — fond neutre partout

---

## 2026-03-04 — Session 13 : Correction bugs wizards cassés par la session 11

### Contexte
Les wizards de création d'entraînements (compétences et savoir-faire) étaient cassés suite au nettoyage Phase 1 de la session 11. Un conflit CSS modal-overlay était aussi présent.

### Corrections
1. **`self.escapeHtml()` → `escapeHtml()`** : la suppression de `escapeHtml()` du module `AdminBanquesExercices` (session 11, Phase 1) n'avait pas été propagée à 3 fichiers d'extension. 8 appels `self.escapeHtml(...)` lançaient un `TypeError` silencieux :
   - **Wizard compétences vide** : erreur dans `_renderCompWizardStep1()` → contenu jamais affiché
   - **Wizard SF doublon étape 1/2** : erreur dans `_renderSFWizardStep2()` → HTML de l'étape 1 restait affiché
   - **Prévisualisation exercices SF cassée** : erreur dans le builder de prévisualisation
2. **CSS `modal-overlay`** : `style.css` utilisait `display: none` + `.active`, alors que toutes les pages utilisent `display: flex` + `.hidden`. Aligné sur la convention `.hidden`.

### Fichiers modifiés
`js/admin-banques-exercices-comp-wizard.js`, `js/admin-banques-exercices-sf-wizard.js`, `js/admin-banques-exercices-builders.js`, `css/style.css`

---

## 2026-03-04 — Session 12 : Audit coordination frontend ↔ backend + corrections

### Contexte
Audit systématique de tous les appels API (callAPI / SheetsAPI) entre le frontend JS et le backend GAS. Vérification des noms d'actions, des paramètres, de la gestion des réponses et des erreurs.

### Corrections (6 bugs)
1. **`eleve-evaluation.js`** : `eleve_id: 'current_user'` (en dur) → récupère l'ID réel via `Auth.user` / `sessionStorage` / `localStorage`. Toutes les évaluations étaient enregistrées avec un faux ID.
2. **`eleve-competences-exercice.js`** : auto-soumission (timer expiré) ne vérifiait pas `result.success` → maintenant vérifie avant de mettre à jour l'état local.
3. **`admin-banques-exercices-connaissances.js`** : sauvegarde étape 1 du wizard en fire-and-forget → `await` + vérification `result.success`.
4. **`eleve-connaissances-results.js`** : pas de `else` si `saveProgressionMemorisation` échoue → branche else ajoutée avec `{ saveError: true }`.
5. **`eleve-exercices-results.js`** : échec silencieux de `saveResultatExercice` → log de l'erreur.
6. **`admin-competences.js`** : chaîne critères (delete/create/update) sans vérifier chaque `success` → vérification individuelle + arrêt si échec.

### Constats de l'audit (non corrigés, documentés)
- 7 implémentations différentes de `callAPI` (seule `admin-banques-exercices.js` a un timeout de 15s)
- Double système de lecture (callAPI JSONP vs SheetsAPI REST) avec caches indépendants
- `SheetsAPI.clearCache()` efface le cache de toutes les tables au lieu de celle modifiée

### Fichiers modifiés
`js/eleve-evaluation.js`, `js/eleve-competences-exercice.js`, `js/admin-banques-exercices-connaissances.js`, `js/eleve-connaissances-results.js`, `js/eleve-exercices-results.js`, `js/admin-competences.js`

---

## 2026-03-04 — Session 11 : Audit et nettoyage global du codebase

### Contexte
Audit complet du codebase pour dédupliquer, centraliser et réduire la dette technique. Travail en 4 phases.

### Phase 1 — Quick wins JS
- **`escapeHtml()` centralisé** : 26 copies identiques → 1 fonction globale dans `app.js`, ~300 appels `this.escapeHtml()` remplacés dans 38 fichiers.
- **`console.log` supprimés** : 56 statements de debug dans 20 fichiers (gardé uniquement `logger.js`)
- **ESLint** : 70 warnings → 7 (faux positifs globals). 24 params préfixés `_`, 28 variables mortes supprimées, 11 catch vides commentés.
- **`components/components.js` supprimé** : fichier orphelin de 159 lignes, jamais chargé.

### Phase 2 — CSS
- **`.empty-state` et `.modal-overlay` centralisés** dans `style.css`, redondances supprimées dans 23 + 15 fichiers.
- **17 blocs CSS exactement dupliqués** supprimés dans `eleve-connaissances.css` (-83 lignes).
- Fusion media queries reportée (responsive overrides intentionnels).

### Phase 3 — Centralisation JS
- **Seuils mémorisation** : `CONFIG.SEUIL_CONNAISSANCES` (7) et `CONFIG.SEUIL_SAVOIR_FAIRE` (5) dans `config.js`.
- **Clés localStorage** : 10 clés dans `CONFIG.STORAGE_KEYS`.

### Phase 4 — Backend GAS
- **Competences.gs** : 38 noms de feuilles en dur → constantes `SHEETS.*`.
- **Script `npm run build:gas`** : auto-génère `TOUT-EN-UN.gs` (12 fichiers concaténés).

### Fichiers créés
- `scripts/build-gas.js`, `PLAN.md`

### Fichiers supprimés
- `components/components.js`

### Décisions prises
- Pas de restructuration (architecture saine)
- `btn-primary` non centralisé (gradients différents = design intentionnel)
- Pattern `.hidden` vs `.active` pour modals : les deux coexistent

---

## 2026-02-27 — Popup de soumission avec choix de format de rendu et délais configurables

### Contexte
Quand un élève terminait un entraînement de compétence en mode évaluation, un message générique s'affichait avec "envoyez votre travail dans les 30 minutes" ou "déposez dans le casier le lendemain". Problèmes : le délai de 30 min était figé, le "lendemain" ne tenait pas compte des week-ends/vacances, et l'élève n'avait pas le choix de son format de rendu.

### Modifications

**Nouveau fichier utilitaire** (`js/submission-utils.js`) :
- `SubmissionUtils.loadJoursNonCours()` — charge la feuille JOURS_NON_COURS via SheetsAPI
- `SubmissionUtils.prochainJourOuvre(nbJours, joursNonCours)` — calcule le Nème jour ouvré en sautant week-ends et jours non-cours
- `SubmissionUtils.formatDeadlineMail(delaiMinutes)` — "avant 15h42"
- `SubmissionUtils.formatDeadlinePapier(delaiJours, joursNonCours)` — "avant le lundi 3 mars"
- `SubmissionUtils.showSubmissionPopup(options)` — popup 2 étapes : choix intention (soumettre / ne pas soumettre / continuer) puis choix format (papier / numérique) avec délais précis

**Nouveau fichier CSS** (`css/submission-popup.css`) :
- Styles du popup overlay, boutons de choix, écrans de confirmation et de refus

**Module compétences élève** (`js/eleve-competences-exercice.js`) :
- Ajout `showSubmissionPopup(timerExpired)` — affiche le popup quand l'élève clique "Terminer" ou quand le chrono expire
- `finishEntrainement(modeRendu)` accepte maintenant un paramètre `modeRendu` ('papier', 'numerique', 'non_soumis')
- Envoie `mode_rendu` au backend lors de la sauvegarde
- Suppression de `showEvaluationResult()` (remplacé par le popup)
- `cancelEvaluation()` redirige vers le popup

**Module legacy compétences** (`js/eleve-exercices-competences.js`) :
- `showTimeExpiredPointsBonus()` utilise le popup au lieu du message HTML figé
- `showTimeExpired()` délègue au popup pour le mode `points_bonus`, garde l'écran simple pour l'entraînement

**Backend** (`google-apps-script/Competences.gs`) :
- `finishEleveEntrainementCompetence` gère `mode_rendu` (papier/numerique/non_soumis) et le statut `non_soumis`
- Migration progressive de la colonne `mode_rendu` dans EleveEntrainementsCompetences
- Migration progressive des colonnes `delai_mail_minutes` et `delai_papier_jours` dans EntrainementsCompetences

**Admin** (`admin/banques-exercices.html`, `js/admin-banques-exercices-questions.js`) :
- Ajout de 2 champs dans le formulaire : "Délai rendu par mail (min)" et "Délai rendu papier (jours de cours)"
- Valeurs lues et sauvegardées dans les entraînements de compétences

**Config** (`js/config.js`) :
- Ajout de `JOURS_NON_COURS` dans `CONFIG.SHEETS`

### Flux de soumission (mode évaluation)
```
[Terminer] ou [Temps écoulé]
→ Popup étape 1 : Soumettre / Ne pas soumettre / Continuer (si temps restant)
→ Si soumettre → étape 2 : Papier / Numérique → confirmation avec délai précis
→ Si ne pas soumettre → confirmation de sécurité → statut non_soumis
```

### À faire côté Google Sheets (manuellement)
1. Créer l'onglet `JOURS_NON_COURS` avec une colonne `date` (DD/MM/YYYY)
2. Y ajouter les dates de vacances, fériés, journées pédagogiques
3. Les colonnes `delai_mail_minutes`, `delai_papier_jours` et `mode_rendu` sont créées automatiquement par migration progressive

### Fichiers créés
- `js/submission-utils.js`
- `css/submission-popup.css`

### Fichiers modifiés
- `js/eleve-competences-exercice.js`
- `js/eleve-exercices-competences.js`
- `js/admin-banques-exercices-questions.js`
- `admin/banques-exercices.html`
- `google-apps-script/Competences.gs`
- `js/config.js`
- `.eslintrc.json`
- `eleve/entrainements-comp.html`
- `eleve/entrainements-sf.html`

---

## 2026-02-27 — Block editor pour le corrigé + wizard 4 étapes

### Contexte
L'étape 3 du wizard de création d'entraînements de compétences utilisait un éditeur texte riche simple pour le corrigé. La prof n'avait pas la main sur l'organisation texte/image/vidéo comme pour le document (étape 2). Le résumé était mélangé avec le corrigé dans la même étape.

### Modifications

**Wizard comp 4 étapes** (`js/admin-banques-exercices-comp-wizard.js`) :
- Ajout d'une étape 4 « Résumé » dédiée à la synthèse avant enregistrement
- Étape 3 « Corrigé » : remplacé l'éditeur texte riche par le même block editor que l'étape 2 (blocs texte, image, vidéo, document avec drag & drop et groupement côte à côte)
- Toggle « Lien Google Doc » / « Éditeur » conservé sur l'étape 3
- Le block editor singleton est partagé entre étapes 2 et 3 : les blocs sont sauvegardés/restaurés à chaque changement d'étape via `_saveCompWizardStepState`
- `correction_contenu` stocke maintenant du JSON (array de blocs) au lieu de HTML brut
- Factorisé `_renderBlockAddBar()` pour éviter la duplication du HTML de la barre d'ajout

**Rendu élève** (`js/eleve-competences-exercice.js`) :
- `_buildCorrectionHTML()` détecte automatiquement le format : JSON (nouveau, blocs) vs HTML brut (ancien)
- Nouvelle méthode `_renderCorrectionBlocks()` qui réutilise `_renderSingleBlock()` pour afficher les blocs du corrigé

**CSS** (`css/eleve-competences.css`, `css/admin-banques-exercices.css`) :
- Retiré `font-style: italic` de `.comp-block-legende` et `.cw-preview-frame .comp-block-legende` pour que seul le texte entre `*étoiles*` s'affiche en italique

### Rétro-compatibilité
- Les anciens corrigés en HTML brut continuent à s'afficher normalement côté élève
- Les anciens corrigés en lien Google Doc ne sont pas impactés

### Fichiers modifiés
- `js/admin-banques-exercices-comp-wizard.js` (réécrit)
- `js/eleve-competences-exercice.js` (2 modifications)
- `css/eleve-competences.css` (1 suppression)
- `css/admin-banques-exercices.css` (1 suppression)

---

## 2026-02-26 — Éditeur riche pour document et corrigé (entraînements de compétences)

### Contexte
Ajout de la possibilité pour l'admin de saisir le document (sujet) et le corrigé commenté directement en texte riche dans le popup, au lieu d'être limité à un lien Google Doc.

### Modifications

**HTML modal admin** (`admin/banques-exercices.html`) :
- Remplacement des champs URL simples par des sections avec toggle « Lien / Texte »
- Ajout d'un éditeur riche léger (contenteditable + toolbar : gras, italique, souligné, listes, couleur)
- Le toggle permet de choisir entre coller un lien Google Doc ou saisir du contenu formaté directement

**JS admin** (`js/admin-banques-exercices-questions.js`) :
- `toggleSourceMode()` : bascule entre les panneaux URL et éditeur riche
- `_initRichTextEditors()` : initialise les toolbars de formatage
- `_getEditorContent()` / `_getActiveSourceMode()` : récupèrent le contenu selon le mode actif
- `saveTacheComplexe()` : envoie `document_contenu` et `correction_contenu` au backend
- `openTacheComplexeModal()` : charge le bon mode (URL ou texte) à l'édition
- `_toggleBanqueFields()` : masque les deux sections complètes en mode banque

**CSS** (`css/admin-banques-exercices.css`, `css/eleve-competences.css`) :
- Styles pour le toggle Lien/Texte et l'éditeur riche (toolbar + contenteditable)
- Styles élève pour l'affichage du texte riche (`.comp-document-richtext`, `.comp-richtext-content`)

**Backend** (`google-apps-script/Competences.gs`) :
- 2 nouvelles colonnes dans `EntrainementsCompetences` : `document_contenu`, `correction_contenu`
- Migration progressive : colonnes ajoutées automatiquement si absentes
- Create/update gèrent les nouveaux champs

**Rendu élève** (`js/eleve-competences-exercice.js`) :
- `_buildDocumentHTML()` : affiche le texte riche si `document_contenu` existe, sinon iframe
- `_buildCorrectionHTML()` : affiche le texte riche si `correction_contenu` existe, sinon iframe
- `showTrainingResult()` / `showExerciseReview()` : les tabs Corrigé/Sujet fonctionnent aussi en mode texte riche

### Décisions
- Pas de bibliothèque externe : `contenteditable` + `execCommand` — léger et suffisant pour les besoins
- 2 colonnes séparées (pas de JSON dans les colonnes existantes) — rétro-compatible, les anciens entraînements fonctionnent sans modification
- Le contenu riche est stocké en HTML dans la feuille Google Sheets

### Fichiers modifiés
- `admin/banques-exercices.html`
- `js/admin-banques-exercices-questions.js`
- `css/admin-banques-exercices.css`
- `css/eleve-competences.css`
- `js/eleve-competences-exercice.js`
- `google-apps-script/Competences.gs`
- `CHANGELOG.md`
- `CLAUDE.md` (vue fonctionnelle)

---

## 2026-02-26 (session 9) — Audit et nettoyage du module entraînement de compétences

### Contexte
Audit complet du module compétences (élève + admin + backend + legacy) suivi de la correction de tous les problèmes identifiés pour obtenir un code propre et maintenable.

### Phase 1 — Audit
- **Lecture complète** de tous les fichiers du module (7 000 lignes hors legacy)
- **Identification** : 5 bugs/risques fonctionnels, 6 duplications, 3 points legacy, 1 problème ESLint

### Phase 2 — Corrections

**Bugs corrigés :**
- `beforeunload` ajouté en mode évalué (`_addBeforeUnload` / `_removeBeforeUnload`) — empêche la fermeture accidentelle de l'onglet
- `tempsPasse` : calcul corrigé — basé sur `duree - timeRemaining` au lieu de `Date.now() - exerciseStartTime`, gère correctement les reprises et l'overtime
- `finishEntrainement` : notification d'erreur visible si la sauvegarde échoue (via `_showNotification`), la progression locale n'est plus mise à jour en cas d'échec API
- `getBanqueStatus` : nouveau statut "soumise" (label "En attente", cssClass `submitted`, icône 📤) entre "en_cours" et "validée"

**Factorisation :**
- `_buildDocumentHTML(entrainement)` : génère toolbar + iframe — remplace 4 copies identiques
- `_buildCorrectionHTML(correctionCommentee)` : génère le HTML du corrigé commenté — remplace 2 copies identiques
- `_getCorrectionUrl` supprimé : `_parseCorrectionData` utilisé partout (y compris `showCorrigeCommente`)
- `closeModal` simplifié : ne réinitialise plus `currentEntrainement`, les méthodes appelantes (`resumeTraining`, `restartTrainingFromModal`, `viewReviewFromModal`) simplifiées

**CSS :**
- Ajout des styles `.comp-card-status-icon.submitted` et `.comp-card-badge.submitted` (violet, cohérent avec la palette existante)

### Fichiers modifiés
- `js/eleve-competences.js` — getBanqueStatus, closeModal, résumé des simplifications
- `js/eleve-competences-exercice.js` — réécriture : beforeunload, tempsPasse, notification, builders HTML, suppression _getCorrectionUrl
- `css/eleve-competences.css` — styles submitted
- `CLAUDE.md` — problèmes marqués comme corrigés
- `CHANGELOG.md` — cette entrée

### Phase 3 — Synchronisation backend

**Problème identifié** : quand un élève est supprimé, seule la ligne dans UTILISATEURS était effacée. Les données de progression restaient dans 9 tables orphelines (connexions, résultats, mémorisation, évaluations, compétences, méthodologie, leçons, historique SF).

**Corrections :**
- `deleteUser()` (Users.gs) : suppression en cascade — nettoie les 9 tables liées avant de supprimer l'utilisateur
- Nouvelle fonction utilitaire `deleteRowsByValue_(ss, sheetName, columnName, value)` pour la suppression par colonne
- `SHEETS` constant (Code.gs + TOUT-EN-UN.gs) : `TachesComplexes` → `EntrainementsCompetences`, `EleveTachesComplexes` → `EleveEntrainementsCompetences` (alignement avec les vrais noms d'onglets Google Sheets)

**Tables nettoyées en cascade lors de la suppression d'un élève :**
PROGRESSION_MEMORISATION, RESULTATS_EXERCICES, HISTORIQUE_PRATIQUES_SF, RESULTATS_ENTRAINEMENT, EVALUATION_RESULTATS, PROGRESSION_METHODOLOGIE, PROGRESSION_LECONS, EleveConnexions, EleveEntrainementsCompetences

### Fichiers modifiés (phase 3)
- `google-apps-script/Users.gs` — cascade delete + helper deleteRowsByValue_
- `google-apps-script/Code.gs` — SHEETS constant corrigée
- `google-apps-script/TOUT-EN-UN.gs` — même corrections (copie groupée)

### Phase 4 — Audit synchronisation des onglets compétences

Audit complet des 5 onglets du module compétences : CompetencesReferentiel, CriteresReussite, BanquesCompetences, EntrainementsCompetences, EleveEntrainementsCompetences.

**Cascade delete ajoutée sur `deleteEntrainementCompetence()`** :
- Supprime les progressions élèves (`EleveEntrainementsCompetences` avec `entrainement_id` correspondant) en plus de l'entraînement lui-même
- Messages d'erreur enrichis (feuille non trouvée, id manquant, colonne absente, id non trouvé avec valeur)
- Réponse enrichie : retourne `deleted_id` en cas de succès

**Cascade delete ajoutée sur `deleteBanqueCompetence()`** (phase 3) :
- Supprime les entraînements associés (`EntrainementsCompetences` avec `banque_id` correspondant)

**Problème non résolu : suppression individuelle d'entraînement**
Le code backend `deleteEntrainementCompetence()` est correct (cherche par ID, appelle deleteRow). Cause la plus probable : **le backend déployé sur Google Apps Script n'est pas à jour** et n'a pas la route `deleteTacheComplexe`. Le frontend utilise l'UI optimiste qui masque temporairement l'item, mais le backend ne le supprime pas réellement. À vérifier en redéployant le code.

### Fichiers modifiés (phase 4)
- `google-apps-script/Competences.gs` — cascade delete entrainement → progressions élèves
- `google-apps-script/TOUT-EN-UN.gs` — même correction

### Ce qui reste à faire
- **Redéployer le backend** (Code.gs + Competences.gs) sur Google Apps Script pour activer toutes les corrections
- Module legacy `eleve-exercices-competences.js` (785 l.) à supprimer quand confirmé non chargé
- ESLint v10/v8 mismatch non traité (hors périmètre)

---

## 2026-02-25 (session 8) — Restructuration compétences : introduction des banques

### Contexte
Les entraînements de compétences étaient directement liés aux compétences du référentiel, sans couche intermédiaire. Le champ `visible` du référentiel contrôlait à la fois l'admin et la visibilité élève. On introduit une table `BanquesCompetences` pour séparer le référentiel (définition des compétences) de la gestion des entraînements (organisation, publication).

### Modifications

**Nouvelle table `BanquesCompetences`** :
- Colonnes : id, competence_id, titre, description, ordre, statut, date_creation
- Chaque banque est liée à une compétence du référentiel
- Le `statut` (brouillon/publié) contrôle la visibilité côté élève
- CRUD complet dans le backend

**Backend (`Competences.gs`, `Code.gs`)** :
- 4 nouvelles fonctions : getBanquesCompetences, createBanqueCompetence, updateBanqueCompetence, deleteBanqueCompetence
- 4 nouvelles routes dans le routeur
- EntrainementsCompetences gagne la colonne `banque_id` (migration progressive automatique)
- `competence_id` conservé sur les entraînements pour rétro-compatibilité

**Admin — Banques d'exercices > Compétences** :
- L'onglet affiche maintenant les banques de compétences (au lieu de grouper par compétence du référentiel)
- Chaque banque montre son statut (brouillon/publié) et ses entraînements
- Boutons : créer une banque (+), modifier, supprimer, ajouter un entraînement
- La modal de création de banque permet de choisir une compétence et un titre
- La modal d'entraînement pointe vers une banque (au lieu d'une compétence directement)

**Élève — Page compétences** :
- Charge les banques publiées (au lieu des compétences visibles)
- Chaque carte affiche le titre de la banque (ou le nom de la compétence)
- Les critères sont toujours résolus via la compétence du référentiel
- Les entraînements sont filtrés par `banque_id` (fallback sur `competence_id`)
- Navigation : banque → détail → exercice (inchangé dans le principe)

### Fichiers modifiés
- `google-apps-script/Competences.gs` — CRUD BanquesCompetences + colonne banque_id
- `google-apps-script/Code.gs` — routes + SHEETS constant
- `js/config.js` — BanquesCompetences dans CONFIG.SHEETS
- `js/admin-banques-exercices.js` — chargement, cache, counts, delete
- `js/admin-banques-exercices-questions.js` — rendu banques, modals banque/entraînement
- `js/eleve-competences.js` — chargement banques, rendu par banque, navigation

### Décisions prises
- `competence_id` reste sur EntrainementsCompetences pour rétro-compatibilité (legacy module, aliases)
- La colonne `banque_id` est ajoutée automatiquement si absente (migration progressive)
- Le référentiel admin garde son toggle visible pour l'instant (pas de changement)
- Le module legacy `eleve-exercices-competences.js` n'est pas modifié (utilise encore les anciens aliases)

---

## 2026-02-24 (session 7) — Mode prévisualisation prof + 3 états de visibilité

### Contexte
La prof devait activer les pages pour les élèves avant de pouvoir les tester elle-même. Risque que les élèves voient des pages pas prêtes.

### Modifications

**3 états de visibilité par page (admin > paramètres) :**
- **Visible** (vert) : page dans le menu, cliquable pour les élèves
- **Bloqué** (orange) : page dans le menu mais verrouillée (cadenas)
- **Masqué** (gris) : page complètement absente du menu élève

Le toggle on/off a été remplacé par un bouton qui cycle entre les 3 états (clic = état suivant).

**Mode prévisualisation amélioré :**
- Le bouton oeil dans l'admin redirige vers le côté élève (inchangé)
- Maintenant la prof voit **toutes les pages** y compris les masquées
- Chaque page masquée ou bloquée a un badge indiquant son état réel
- Les pages masquées/bloquées sont cliquables en preview (bordure pointillée)
- Le bandeau jaune dit "Mode test — Vous voyez toutes les pages (les élèves non)"

### Fichiers modifiés
- `js/admin-parametres.js` — sélecteur 3 états, collectMenuState avec bloque
- `components/eleve-layout.js` — loadMenuConfig 3 états, getSidebarHTML badges, preview
- `google-apps-script/Parametres.gs` — sauvegarde du champ bloque
- `css/admin-parametres.css` — bouton 3 états (remplace toggle)
- `css/style.css` — badges preview sidebar

### Décisions prises
- Pas de changement backend lourd : la colonne `bloque` existait déjà dans CONFIG_MENU, elle n'était juste pas sauvegardée
- Le mode preview utilise toujours `sessionStorage.brikks_preview` (pas de nouveau paramètre)
- En mode preview, tout est cliquable (même les pages masquées) pour permettre les tests

---

## 2026-02-23 (session 6) — Correction de 5 bugs / dette technique

### Contexte
Traitement des 5 premiers points de dette technique documentés dans CLAUDE.md : ESLint, erreur silencieuse, listener leak, parsing JSON dupliqué, validation dupliquée.

### Corrections

**1. ESLint verrouillé sur v8.57.1**
- Le caret `^8.57.1` dans package.json permettait une montée involontaire à v10 dans certains environnements
- Version verrouillée à `8.57.1` (sans `^`) pour éviter ce problème

**2. Erreur silencieuse de sauvegarde corrigée**
- Quand `saveProgressionMemorisation` échoue, l'élève voyait "Bravo" mais sa progression était perdue
- Maintenant : un bandeau rouge "Ta progression n'a pas pu être enregistrée" s'affiche
- `lastProgressionResult` reçoit `{ saveError: true }` en cas d'erreur, détecté par `renderResultScreen`

**3. Listener leak corrigé**
- `generateErrorDetails()` ajoutait un click listener sur `document` à chaque affichage de résultats, sans jamais le retirer
- Le listener est maintenant stocké dans `_popoverClickHandler`, retiré avant chaque ajout, et nettoyé dans `cleanupEventListeners()`

**4. Parsing JSON consolidé avec parseJSONField()**
- 4 endroits de parsing manuel remplacés par `parseJSONField()` (gère double-encodage, null, objet)
- `parseJSONField` déclaré conditionnellement dans `eleve-connaissances.js` pour les pages qui ne chargent pas `eleve-exercices.js`
- Fichiers touchés : `eleve-connaissances.js` (3 endroits), `eleve-connaissances-validation.js` (1 endroit)

**5. Validation dupliquée refactorisée**
- `validateCurrentEtape()` contenait ~200 lignes de logique dupliquée avec les méthodes `run*Validation()`
- 5 blocs remplacés par des appels à `run*Validation(donnees, document)` : texte_trou, timeline (drag), chrono (texte), carte, association
- Les `run*Validation()` acceptent maintenant un paramètre `container` optionnel
- Bug corrigé au passage : `runAssociationValidation` ne renvoyait pas `attendu` dans les détails
- Les 3 formats restants (vrai_faux, qcm, question_ouverte) conservent leur logique propre (carrousels avec validation individuelle)

### Fichiers modifiés
- `package.json` — version ESLint verrouillée
- `js/eleve-connaissances.js` — ajout `parseJSONField`, remplacement de 3 blocs de parsing
- `js/eleve-connaissances-results.js` — erreur sauvegarde visible, listener leak corrigé
- `js/eleve-connaissances-validation.js` — parsing consolidé, validation refactorisée, container param
- `css/eleve-connaissances.css` — style `.save-error` pour le bandeau d'erreur
- `CLAUDE.md` — bugs marqués comme corrigés
- `CHANGELOG.md`

### Décisions prises
- `parseJSONField` déclaré conditionnellement (`if typeof === 'undefined'`) plutôt qu'extrait dans un fichier partagé — suit le pattern d'autonomie par module
- Les formats vrai_faux, qcm, question_ouverte ne sont pas refactorisés — leur logique de carrousel est fondamentalement différente des `run*Validation()`
- L'association en mode single gagne les labels de correction visuels (amélioration héritée de `runAssociationValidation`)

---

## 2026-02-23 (session 5) — Toggle comparaison souple/stricte pour tous les formats texte

### Contexte
Ajout du choix entre comparaison souple et réponse exacte pour tous les formats à saisie texte, pas seulement question ouverte.

### Modifications

**Admin (formulaire de création/édition de questions) :**
- Toggle « Mode de correction » ajouté pour **texte à trous**, **frise chronologique (mode texte)** et **carte**
- Le champ `comparaison_stricte` est sauvegardé dans `donnees` pour ces 3 formats
- Même design que le toggle existant pour question ouverte (radio souple/stricte)

**Validation élève :**
- Nouvelle fonction `normalizeIntermediaire()` : comme `normalizeSouple()` mais sans suppression des mots-outils ni stemming — adaptée aux réponses courtes (trous, dates, noms de lieux)
- `compareAnswers()` accepte un 4e paramètre `light` pour utiliser la normalisation intermédiaire
- Les 6 blocs de validation (texte_trou, timeline, carte × principal + carrousel) utilisent maintenant `compareAnswers()` au lieu de `trim().toLowerCase()`

### Fichiers modifiés
- `js/admin-banques-exercices-questions.js` — toggle UI + sauvegarde donnees
- `js/eleve-connaissances-utils.js` — `normalizeIntermediaire()`, `compareAnswers()` avec param `light`
- `js/eleve-connaissances-validation.js` — 6 blocs de validation harmonisés
- `CLAUDE.md` — documentation des niveaux de comparaison
- `CHANGELOG.md`

### Décisions prises
- 3 niveaux de normalisation : strict (trim), intermédiaire (casse+accents+chiffres), complet (+ stop words + stemming)
- Par défaut souple — les questions existantes (sans le champ) héritent du mode souple, améliorant la tolérance
- La normalisation intermédiaire ne retire PAS les mots-outils → un trou contenant « la » ou « le » reste validable

---

## 2026-02-23 (session 4) — Audit et restructuration module exercices SF (élève + admin)

### Contexte
Audit complet du module entraînements savoir-faire côté élève et admin, suivi du nettoyage et de la restructuration en fichiers par responsabilité.

### Harmonisation menu SF élève
- **Bandeau par banque** avec statut, progression (dots 1-5), et CTA adapté au contexte
- **Tri des banques** : à réviser → en cours → à découvrir → en pause → maîtrisées
- **CTA dynamique** selon le statut de la banque (commencer, continuer, réviser, s'entraîner)

### Nettoyage code mort (~430 lignes supprimées)
- `getExerciceStatusSF`, `_getStatusFromOldSystem`, `_getWeekNumber`, `_hashCode`, `getExerciceDisponible`, `calculateGlobalStatsSF`
- Bloc SF mort dans `renderExercisesList` (chemin inaccessible)
- Constantes legacy `SEUIL_PRATIQUES_PARFAITES`, `SEUIL_JOURS_RAFRAICHIR`
- ~20 `console.log` de debug (élève + admin)

### Résolution dualité SF
- Suppression du système legacy par exercice (`statsSF`) au profit du système par banque (`statsSFBanque`) comme source de vérité
- `statsSF` conservé en lecture seule pour le fallback de calcul

### Helpers factorisés
- **`parseJSONField(raw, fallback)`** : remplace 11 blocs de parsing JSON dupliqués (gère string, double-encodage, objet, null)
- **`FORMAT_HANDLERS`** : registre central `{render, validate, showCorrection, reset}` par format — remplace 4 chaînes if/else dispersées

### Restructuration en fichiers (renderer 1852 lignes → 4 fichiers)
| Fichier | Lignes | Responsabilité |
|---------|--------|----------------|
| `eleve-exercices-sf.js` | 435 | Logique métier SF (répétition espacée, statuts, blocage) |
| `eleve-exercices-formats.js` | 863 | Rendus HTML + affichage corrections + resets |
| `eleve-exercices-validation.js` | 288 | Validation des réponses + comparaison normalisée |
| `eleve-exercices-results.js` | 635 | Sauvegarde résultats, stats locales, écran SF, célébration |

Fichier supprimé : `eleve-exercices-renderer.js`
Fichier principal : 1632 → 1198 lignes

### Fichiers modifiés
- `js/eleve-exercices.js` — nettoyé et allégé
- `js/eleve-exercices-renderer.js` — supprimé (remplacé par 3 fichiers)
- `js/admin-banques-exercices.js` — console.log supprimés
- `js/admin-banques-exercices-builders.js` — console.log supprimé
- `eleve/entrainements-sf.html` — scripts mis à jour
- `eleve/entrainements-comp.html` — scripts mis à jour
- `css/eleve-exercices.css` — style `.exercice-hint-sub`
- `.eslintrc.json` — globals `parseJSONField`, `FORMAT_HANDLERS`

### Décisions prises
- **Pattern Object.assign maintenu** : cohérent avec le module connaissances
- **Catch vides sur localStorage** : intentionnels (cache non critique), pas modifiés
- **`structure` param non utilisé dans certains rendus** : conservé pour la cohérence de signature avec `FORMAT_HANDLERS`

---

## 2026-02-23 (session 3) — Audit et nettoyage module admin connaissances

### Contexte
Audit complet du module de création d'entraînements de connaissances côté admin (wizard 4 étapes).

### Bug corrigé
- **Boutons Suivant/Valider bloqués** : après la création d'un entraînement (étape 1), `renderWizardStep()` ne réinitialisait pas `disabled` sur les boutons de navigation. Le bouton restait grisé sur toutes les étapes suivantes.

### Gestion d'erreurs améliorée
- **`finalizeEntrainement()`** : ajout d'un `catch` avec notification visible. Avant, si la sauvegarde échouait, la prof ne voyait aucun message d'erreur.
- **Sauvegarde arrière-plan étape 1** : en mode édition, l'appel API silencieux affiche maintenant une notification en cas d'échec réseau.

### UX notifications
- Tous les `alert()` (14) remplacés par `showNotification()` (bandeaux non-bloquants en bas de page)
- Ajout du style CSS `notification-warning` (orange) pour les validations de formulaire

### Refactoring
- **`getQuestionsForFormat()` et `getQuestionsForFormatAndBanque()`** fusionnés en une seule fonction avec paramètre `etapeId` optionnel — supprime la duplication de logique de filtrage
- **23 `console.log`/`warn` de debug** supprimés — ne restent que les `console.error` (erreurs réelles)

### Documentation
- `CLAUDE.md` : ajout de la vue fonctionnelle du module admin connaissances (fichiers, patterns techniques, appels API)
- Mise à jour des points connus non traités (admin marqué comme audité)

### Fichiers modifiés
- `js/admin-banques-exercices-connaissances.js`
- `css/admin-banques-exercices.css`
- `CLAUDE.md`
- `CHANGELOG.md`

### Décisions prises
- Les `onclick` inline restent en l'état — c'est la convention de tout le projet, changer ici serait incohérent
- Les `confirm()` (suppressions) restent des popups bloquantes — c'est voulu pour les actions destructives
- Les sélecteurs CSS `.etape-*` dupliqués ne sont pas refactorisés — fonctionnel mais à nettoyer avec tests visuels
- `getQuestionPreview()` dupliqué dans 3 fichiers — à extraire plus tard dans un helper partagé

---

## 2026-02-23 (session 2) — Auto-audit et corrections ciblées

### Contexte
Auto-audit critique du travail de la session précédente. Identification de bugs, code mort restant, et lacunes dans la documentation.

### Bugs corrigés
- `restartEntrainement()` ne remettait pas le chrono à zéro (`exerciseStartTime`) ni ne vidait la sélection de questions (`selectedQuestionsPerEtape`) — le temps affiché était cumulatif et les mêmes questions réapparaissaient
- `resetEtapeState()` oubliait de nettoyer `flashcardState` — données résiduelles possibles entre étapes
- Animation de célébration : ajout du niveau 7 (manquait, le niveau final réutilisait l'animation du 6)

### Nettoyage code mort
- Suppression `CACHE_RESULTATS_KEY` (constante définie mais jamais utilisée) dans `eleve-connaissances.js`
- Suppression `isFreeTraining` (propriété écrite mais jamais lue, le code utilise `isTrainingMode`) dans `eleve-connaissances-results.js`

### Documentation améliorée (CLAUDE.md)
- Ajout `config.js` comme fichier clé (schéma de la base de données)
- Ajout info ESLint (`npm run lint`)
- Clarification que `callAPI` est par-module (pas partagé)
- Ajout du pattern `Object.assign` pour les modules
- Ajout déploiement GitHub Pages
- Ajout des appels API du module connaissances
- Ajout fichiers clés à connaître (`.eslintrc.json`, `config.js`, layouts)
- Signal `README.md` obsolète
- **Nouvelle section** : bugs et dette technique détaillés pour le prochain Claude (validation dupliquée, CSS chaotique, erreur silencieuse sauvegarde, parsing JSON dupliqué, listener leak)

### Commentaires corrigés
- "6 niveaux" → "7 niveaux" dans utils.js et results.js

### Fichiers modifiés
- `js/eleve-connaissances.js`
- `js/eleve-connaissances-results.js`
- `js/eleve-connaissances-utils.js`
- `CLAUDE.md`
- `CHANGELOG.md`

---

## 2026-02-23 — Audit et nettoyage module connaissances élève

### Bugs corrigés
- Filtre `statut === 'publie'` restauré dans `eleve-connaissances.js` — les brouillons d'entraînements étaient visibles par les élèves
- SEUIL_ETAPES aligné à 7 partout — le menu affichait "/6", le modal "/6", l'écran de fin "/7", le serveur attendait 7
- Barre de progression corrigée — utilisait `prog.etape` (prochain à tenter) au lieu de `etape - 1` (validé), affichait 29% au lieu de 14% pour 1 niveau validé

### Nettoyage code mort (~880 lignes supprimées)
- **JS** : `filterBanques`, `previousEtape`, `displayAssociationCorrectionVisual`, `restartAsTraining`, `toggleEtapeDetails`, `calculateDaysUntil`, `displayGlobalFeedback`, propriété `resultats`
- **Backend GAS** : `saveProgressionEntrainement`, `getProgressionEntrainements`, `checkEntrainementDisponible`, `getProgressionBanque` + leurs routes dans Code.gs
- **CSS** : ancien bloc chrono drag-drop (~185 lignes écrasées par le nouveau), classes `conn-progress-*`, `conn-search-*`, `etape-nav-btn`
- **Logger.debug** : supprimé les logs qui exposaient les réponses/données complètes dans la console

### Refactoring
- 4 helpers extraits dans `eleve-connaissances-utils.js` :
  - `normalizeFormat()` : `texte_trous` → `texte_trou`, `chronologie` → `timeline`
  - `getQcmCorrectIndices()` : extraction des indices corrects QCM (était dupliqué 4x)
  - `sortEventsByDate()` : tri chrono par date numérique (était dupliqué 3x)
  - `resetEtapeState()` : reset état par étape (était dupliqué 3x)
- Constante `SEUIL_ETAPES: 7` centralisée sur l'objet `EleveConnaissances`
- Tous les `case 'texte_trous':` et `case 'chronologie':` éliminés grâce à `normalizeFormat()` aux points d'entrée

### UX correction (sessions précédentes, même branche)
- Panels vert/rouge pour le feedback au lieu de flèches
- "Non répondu" au lieu de "Mauvaise réponse" quand l'élève ne répond pas
- Flashcards agrandies pour éviter le scroll
- Correction association : grille de cartes avec images
- Correction image cliquable : panels standard au lieu de popovers

### Documentation
- `CLAUDE.md` créé : architecture, conventions, principes de travail, vue fonctionnelle
- `CHANGELOG.md` créé (ce fichier)

### Fichiers modifiés
- `js/eleve-connaissances.js`
- `js/eleve-connaissances-formats.js`
- `js/eleve-connaissances-validation.js`
- `js/eleve-connaissances-results.js`
- `js/eleve-connaissances-utils.js`
- `css/eleve-connaissances.css`
- `google-apps-script/Code.gs`
- `google-apps-script/Entrainements.gs`

### Décisions prises
- Connaissances = 7 étapes de mémorisation, savoir-faire = 5
- `timeline` est le nom canonique (pas `chronologie`), `texte_trou` (pas `texte_trous`)
- L'ancien système drag-drop chrono est mort, remplacé par le système input/frise
- L'alignement ETAPE_MAX/SEUIL_ETAPES pour savoir-faire reste à faire
