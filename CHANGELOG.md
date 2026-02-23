# CHANGELOG — Journal des modifications

> Chaque session Claude ajoute une entrée en haut de ce fichier avec : date, résumé des modifications, fichiers touchés, décisions prises.

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
