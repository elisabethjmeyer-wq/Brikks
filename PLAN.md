# Plan : Points par compétence (au lieu de points globaux par évaluation)

## Objectif

Quand la prof crée une TC ou un bonus compétence, elle mise des points **par compétence** (pas un total global). Les points gagnés sont ensuite attribués à la bonne matière (FR, HG-EMC, ou les deux si transversal) automatiquement, grâce au champ `matiere` du référentiel.

## Périmètre

| Type d'évaluation | Changement |
|---|---|
| **TC** | Points par compétence (N compétences) |
| **Bonus compétence** | Points sur 1 compétence (inchangé en pratique, mais stocké comme `points_par_competence`) |
| **Bonus ponctuel** | Pas de compétences → garde `briques` global, **pas de changement** |
| **Bonus suivi** | Pas de compétences → garde `briques` global, **pas de changement** |
| **Connaissances / SF** | Pas de compétences → garde `briques` global, **pas de changement** |

## Phase 1 — Modèle de données

### Nouvelles colonnes (migration progressive)

**EVALUATIONS** :
- `points_par_competence` — JSON : `{ "comp_id_1": 1, "comp_id_2": 1.5 }` (points misés par compétence)
- `briques` reste comme **total calculé** (somme des points par compétence) pour rétro-compatibilité

**EVALUATION_RESULTATS** :
- `points_par_competence` — JSON : `{ "comp_id_1": 1, "comp_id_2": 0.5 }` (points gagnés par compétence après correction)
- `validations` reste comme **total calculé** (somme) pour rétro-compatibilité

### Backend (Evaluations.gs)

- `createEvaluation` / `updateEvaluation` : accepter `points_par_competence` (JSON string), calculer `briques` = somme des valeurs
- `saveEvaluationCorrection` : accepter `points_par_competence` (JSON string), calculer `validations` = somme des valeurs

## Phase 2 — Wizard de création (admin-evaluations.js)

### Étape Paramètres (step 1)
- Pour TC et bonus comp : **masquer** le champ `briques` (sera calculé automatiquement)
- Pour les autres types : champ `briques` inchangé

### Étape Compétences (step 2 pour TC)
- Ajouter un **input numérique** à côté de chaque checkbox de compétence
- Quand la prof coche une compétence, un champ "Points misés" apparaît (défaut: 1, step: 0.25)
- Afficher la matière de la compétence en tag coloré (FR bleu, HG-EMC orange, Transversal gris)
- En bas de la liste : **total calculé en temps réel** ("Total : 3 pts — 1 pt FR, 1 pt HG-EMC, 1 pt transversal")

### Étape Compétence unique (step 2 pour bonus comp)
- Ajouter un input "Points misés" sous la sélection radio (défaut: 1, step: 0.25)
- Afficher la matière de la compétence sélectionnée

### Étape Résumé (dernière étape)
- Afficher le détail des points par compétence au lieu du total global
- Format : `Compétence X (FR) — 1 pt`, `Compétence Y (Transversal) — 1.5 pt`
- Ligne totale : `Total : 3.5 pts`

### Sauvegarde
- Envoyer `points_par_competence` (JSON) en plus de `briques` (total calculé côté frontend)
- `wizardData.points_par_competence = { comp_id: points, ... }`

## Phase 3 — Wizard de correction (admin-corrections.js)

### Étape Bilan (step 4)

**Pour TC** :
- Remplacer l'input unique "Points attribués : X / Y" par **un input par compétence**
- Chaque section compétence (déjà affichée dans le bilan) reçoit son propre input
- Format : `🎯 Compétence X (2/3 critères) — [input] / 1 pt`
- Logique par défaut : si tous critères validés → points max, sinon → 0 (modifiable par la prof)
- Total affiché en bas : somme des inputs
- Tag matière à côté de chaque compétence (FR, HG-EMC, Transversal)

**Pour bonus comp** :
- Un seul input (une seule compétence) — visuellement identique à aujourd'hui, mais stocké dans `points_par_competence`

**Pour bonus ponctuel** :
- Inchangé (input unique, pas de compétences)

### Sauvegarde
- Envoyer `points_par_competence` (JSON) en plus de `validations` (total)
- `wd.pointsParCompetence = { comp_id: points, ... }`

## Phase 4 — Calcul des notes (admin-tableau-bord.js + eleve-notes.js)

### `_calculatePoints(eleveId, matiere, semestre)`

**Nouvelle logique** :
```
Pour chaque évaluation du semestre :
  Si l'éval a un résultat pour cet élève :
    Si résultat.points_par_competence existe (JSON) :
      Pour chaque compétence dans le JSON :
        Trouver la matière de la compétence dans le référentiel
        Si compétence.matiere === matiere OU compétence.matiere === 'Transversal' :
          Ajouter les points à la catégorie de l'éval (competences/bonus)
    Sinon (rétro-compatibilité) :
      Si eval.matiere === matiere OU eval.matiere === 'Les deux' :
        Ajouter résultat.validations à la catégorie
```

**Impact** : identique dans `admin-tableau-bord.js` et `eleve-notes.js` (même logique dupliquée).

### `maxCats` (budget) — même logique pour les points misés

Pour calculer le budget max par matière, on fait pareil avec `evaluation.points_par_competence` au lieu de `evaluation.briques`.

## Phase 5 — Affichage élève

### Page de résultat TC (eleve-evaluation.js — review mode)

**Points banner** : remplacer le bandeau global `2 / 3 pts` par un bandeau détaillé :
- Ligne par compétence : `Compétence X (FR) : 1/1 pt ✅` ou `Compétence Y (Transversal) : 0/1.5 pt ❌`
- Total en dessous : `Total : 1 / 2.5 pts`
- Tag matière coloré à côté de chaque compétence

**Colonne droite (critères)** : inchangée (affiche déjà les critères par compétence avec ✅/❌)

### Cartes évaluations (eleve-evaluations.js)

- Le badge `+X pts` continue d'afficher le **total** (somme de `points_par_competence`)
- Pas de changement de l'affichage des cartes (trop petit pour le détail)

### Page notes (eleve-notes.js)

**Section Compétences** :
- Les passages montrent déjà la source (bonus, TC) avec tags visuels
- Ajouter les points spécifiques à cette compétence (au lieu du total de l'éval)
- Ex: passage TC "Explorations portugaises" → `+1 pt` (au lieu de `+2 pts` qui était le total)

**Calcul de la note de progression** :
- Utilise la nouvelle logique `_calculatePoints()` → les points vont dans la bonne matière

## Ordre d'implémentation

1. **Backend** : colonnes + lecture/écriture `points_par_competence` dans Evaluations.gs
2. **Wizard création** : UI points par compétence dans admin-evaluations.js
3. **Wizard correction** : UI points par compétence dans admin-corrections.js
4. **Calcul des notes** : refactorer `_calculatePoints` dans admin-tableau-bord.js + eleve-notes.js
5. **Affichage élève review** : bandeau détaillé dans eleve-evaluation.js
6. **Affichage élève notes** : points par compétence dans eleve-notes.js
7. **Build GAS** : `npm run build:gas` pour reconstruire TOUT-EN-UN.gs
8. **Lint** : `npm run lint` pour vérifier

## Rétro-compatibilité

- Les évaluations existantes n'ont pas `points_par_competence` → le code utilise `briques` / `validations` comme avant
- Le fallback est automatique : si `points_par_competence` est absent/vide, on tombe sur l'ancien calcul
- Pas besoin de migration de données existantes

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `google-apps-script/Evaluations.gs` | Lecture/écriture `points_par_competence`, calcul auto de `briques`/`validations` |
| `js/admin-evaluations.js` | Wizard création : inputs points par compétence (step 2) + résumé |
| `js/admin-corrections.js` | Wizard correction : inputs points par compétence (step 4 bilan) |
| `js/admin-tableau-bord.js` | `_calculatePoints()` : ventilation par matière via référentiel |
| `js/eleve-notes.js` | `_calculatePoints()` : même refacto + affichage section compétences |
| `js/eleve-evaluation.js` | Review TC : bandeau points détaillé par compétence |
| `css/admin-evaluations.css` | Styles pour inputs points dans les checkboxes compétences |
| `css/admin-corrections.css` | Styles pour inputs points dans le bilan |
| `css/eleve-evaluation.css` | Styles pour bandeau points détaillé |
