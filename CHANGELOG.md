# CHANGELOG — Journal des modifications

> Chaque session Claude ajoute une entrée en haut de ce fichier avec : date, résumé des modifications, fichiers touchés, décisions prises.

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
