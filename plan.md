# Plan — Page review sommative côté élève

## Résumé

Ajouter une page review (2 colonnes) pour les évaluations sommatives, visible quand l'évaluation est terminée ou notée. Les 4 états de la carte sont ajustés selon le déroulé validé.

## Changements

### 1. Backend — `Evaluations.gs` + `Code.gs`

Nouvelle action `getSommativeForReview(data)` :
- Paramètres : `{ sommative_id, eleve_id }`
- Lit la sommative depuis `NOTES_SOMMATIVES`
- Lit le résultat de l'élève depuis `RESULTATS_SOMMATIVES`
- Retourne `{ sommative, resultat }` (resultat peut être null si pas encore noté)

Ajout du case dans le routeur `Code.gs`.

### 2. Frontend — `eleve-evaluation.js`

Nouveau mode `review-som` dans `init()` :
- `_initSommativeReviewMode(evalId)` : appelle `getSommativeForReview`, puis rend la vue
- `_renderSommativeReview(sommative, resultat)` : layout 2 colonnes
  - **Colonne gauche** : toggle Sujet / Corrigé type (tabs si les deux existent, sinon celui qui est renseigné)
  - **Colonne droite** :
    - Si résultat avec `statut_correction=publie` → note sur barème + remarque individuelle
    - Si résultat sans publication → "En attente de correction"
    - Si pas de résultat → "En attente de correction"

Logique de visibilité du corrigé type : visible uniquement si l'évaluation est terminée (effStatut = terminee) ou si une note existe. Le backend retournera cette info, mais le frontend vérifie aussi.

### 3. Frontend — `eleve-evaluations.js` (`renderSommativeCard`)

Mise à jour des 4 états de la carte :

| État | cardStatus | Changements |
|------|-----------|-------------|
| Planifiée | `upcoming` | Inchangé (déjà "À venir" + "Consulter le sujet" si visible) |
| Ouverte | `available` | Inchangé (déjà "Consulter le sujet" si doc existe) |
| Terminée sans note | `not_done` | Ajouter "Voir le détail →" si sujet OU corrigé type renseigné → lien `evaluation.html?id=X&mode=review-som` |
| Notée | `done` | Remplacer "Note publiée" par "Voir le détail →" → lien `evaluation.html?id=X&mode=review-som` |

### 4. Build GAS

`npm run build:gas` pour reconstruire `TOUT-EN-UN.gs`.

## Fichiers modifiés

- `google-apps-script/Evaluations.gs` — nouvelle fonction `getSommativeForReview`
- `google-apps-script/Code.gs` — nouveau case dans le routeur
- `js/eleve-evaluation.js` — nouveau mode `review-som` + rendu 2 colonnes
- `js/eleve-evaluations.js` — mise à jour de `renderSommativeCard`

## Ce qui ne change PAS

- Le wizard admin (déjà les 3 étapes : paramètres, sujet, corrigé type)
- La saisie des résultats admin (déjà note + remarque)
- Le backend `createNoteSommative` / `updateNoteSommative` (colonnes déjà présentes)
- La page notes élève (a déjà `_openSommativeDetail` — reste tel quel)
