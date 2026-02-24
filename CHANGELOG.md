# CHANGELOG — Journal des modifications

> Chaque session Claude ajoute une entrée en haut de ce fichier avec : date, résumé des modifications, fichiers touchés, décisions prises.

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
