# Plan : Refonte page bilan/correction des évaluations

## Contexte

Actuellement, la page de résultat après une évaluation (connaissances ou SF) est un layout simple en une colonne : bandeau vert/rouge, 4 stats, seuil, et une section "correction détaillée" plate. C'est très différent des pages de résultat des entraînements qui ont un vrai layout 2 colonnes navigable (bilan + carrousel d'erreurs).

De plus, quand l'élève revient sur la liste et clique sur une évaluation terminée, il ne voit qu'un petit modal avec des stats agrégées — pas le détail de ses erreurs question par question.

## Objectif

1. Adopter le layout 2 colonnes des entraînements pour le bilan post-évaluation
2. Ajouter un message conseil renvoyant vers les banques d'entraînement à retravailler
3. Permettre de revoir le bilan complet depuis la liste des évaluations
4. Vérifier le comportement du bouton "Commencer" après passage

---

## Phase 1 — Enrichir les données sauvegardées

**Problème** : Actuellement, `EVALUATION_RESULTATS.details` ne stocke que des stats compactes par étape (`{f: "qcm", c: 2, t: 3, p: 67}`). Pas les réponses de l'élève, pas les corrections. Impossible de re-afficher le détail a posteriori.

**Solution** : Ajouter une colonne `correction_html` dans `EVALUATION_RESULTATS` qui stocke le HTML de correction complet au moment de la soumission.

### Fichiers modifiés :

**`js/eleve-evaluation.js`** — `saveResults()` :
- Pour **connaissances** : appeler `EleveConnaissances.generateErrorDetails(detailedResults)` et stocker le HTML résultant dans un nouveau paramètre `correction_html`
- Pour **SF** : envoyer `this._sfCorrectedHTML` dans le paramètre `correction_html`
- Ajouter aussi un champ `detailed_results` avec le JSON complet des résultats détaillés (pour connaissances : le retour de `compileResults()`, pour SF : les réponses via `collectExerciseDetails()`)

**`google-apps-script/Evaluations.gs`** — `saveEvaluationResult()` :
- Gérer la migration progressive de 2 nouvelles colonnes : `correction_html` et `detailed_results`
- Stocker ces données à l'écriture (même logique que les autres colonnes à migration progressive)

**Impact élève** : aucun impact visible à cette phase — on enrichit juste ce qui est sauvegardé.

**Limite Google Sheets** : une cellule peut contenir jusqu'à ~50 000 caractères. Le HTML de correction est typiquement < 10 000 caractères, donc pas de problème. En sécurité, on tronquera si > 40 000 caractères.

---

## Phase 2 — Refonte du layout bilan post-évaluation

**Fichiers modifiés** : `js/eleve-evaluation.js` (fonction `showResults`), `css/eleve-evaluation.css`

### Layout cible (2 colonnes, identique aux entraînements) :

```
.eval-result-card (grid: 1fr 1.5fr)
├── GAUCHE : .eval-result-bilan
│   ├── Icône + message (Évaluation validée / Non validée)
│   ├── Score en cercle (ex: 80%)
│   ├── Barre de stats : correct/total, temps passé
│   ├── Points gagnés/perdus (badge coloré : +3 ou +0)
│   ├── Seuil de validation (rappel : "Il fallait X% pour valider")
│   ├── 💡 Message conseil (voir Phase 3 ci-dessous)
│   └── Bouton "Retour aux évaluations"
│
└── DROITE : .eval-result-correction
    ├── Si AUCUNE ERREUR → panneau félicitation (comme entraînements)
    └── Si ERREURS :
        ├── Pour CONNAISSANCES → carrousel d'erreurs (réutiliser generateErrorDetails)
        │   ├── Slide 0 : Vue d'ensemble (liste des étapes avec erreurs)
        │   └── Slides 1+ : Détail par étape (rendu format par format)
        └── Pour SF → HTML corrigé avec onglets Corrigé / Sujet (comme entraînements SF)
```

### Adaptation par rapport aux entraînements :
- **Pas de section "répétition espacée"** (pas de dots 1-7 ou 1-5) — remplacée par les **points gagnés/perdus**
- **Pas de bouton "Réessayer"** — l'élève ne peut pas relancer une évaluation depuis le bilan (elle sera automatiquement re-proposée avec de nouvelles questions si applicable)
- **Ajout section "conseil"** (voir Phase 3)
- Même code couleur : vert (réussi), orange (partiel), rouge (échoué)

### CSS :
- Réutiliser le maximum des classes existantes (`.result-card-conn`, `.result-bilan`, `.result-correction`)
- Créer des variantes `.eval-*` pour les spécificités évaluation (points au lieu de niveaux)
- Responsive : passage en 1 colonne sous 900px (comme les entraînements)

---

## Phase 3 — Message conseil avec lien vers les entraînements

### Logique métier :

L'évaluation pioche dans une banque d'entraînement (`evaluation.attribution.banque_id`). On connaît donc la banque source.

**Si l'évaluation est réussie** :
> "Bravo ! Continue à t'entraîner pour consolider tes acquis."
> (pas de lien spécifique nécessaire)

**Si l'évaluation est ratée** :
> "Pour progresser, retravaille tes entraînements sur **[Nom de la banque]**."
> + Lien direct vers la page d'entraînement correspondante (connaissances ou SF)

### Données nécessaires :

- `this.evaluation.attribution.banque_id` — déjà disponible côté frontend au moment du résultat
- Nom de la banque — il faut le récupérer. Deux options :
  - **Option A** : Le backend inclut déjà `chapitre_nom` dans l'évaluation. On peut ajouter `banque_titre` dans la réponse de `getEvaluationForEleve`.
  - **Option B** : Le frontend charge les banques depuis le cache (déjà présent dans `EleveConnaissances.banques` ou `EleveExercices.banques`). Mais ces modules ne sont pas forcément initialisés avec toutes les banques au moment de l'évaluation.

→ **Option A retenue** : enrichir la réponse backend avec `banque_titre` dans l'objet `attribution`.

### Fichiers modifiés :
- `google-apps-script/Evaluations.gs` — `getEvaluationForEleve` : ajouter le titre de la banque dans `attribution`
- `js/eleve-evaluation.js` — `showResults` : afficher le message conseil avec lien

### Lien de navigation :
- Connaissances → `entrainements-conn.html` (la banque sera visible dans l'accordéon)
- SF → `entrainements-sf.html` (idem)

---

## Phase 4 — Revoir le bilan depuis la liste des évaluations

### Approche : remplacer le modal par une navigation pleine page

Actuellement, `openReview()` dans `eleve-evaluations.js` ouvre un petit modal. On va le remplacer par une navigation vers `evaluation.html?id=X&mode=review`.

### Modifications :

**`js/eleve-evaluation.js`** — mode review :
- Dans `init()`, détecter le paramètre `mode=review` dans l'URL
- Si review : ne pas lancer l'exercice, charger le résultat depuis `EVALUATION_RESULTATS` et afficher directement le bilan
- Utiliser `correction_html` (stocké en Phase 1) pour le panneau droit
- Utiliser `detailed_results` pour les stats du panneau gauche
- Si `correction_html` est vide (anciennes évaluations passées avant la migration) : afficher un message "Détail non disponible pour cette évaluation" avec juste les stats

**`js/eleve-evaluations.js`** — navigation :
- `openReview(evaluationId)` → au lieu d'ouvrir un modal, faire `window.location.href = 'evaluation.html?id=' + evaluationId + '&mode=review'`
- Supprimer le code du modal review (HTML + JS + CSS) devenu inutile

**`google-apps-script/Evaluations.gs`** — nouvelle action API :
- `getEvaluationResult({ evaluation_id, eleve_id })` : retourne la ligne complète de `EVALUATION_RESULTATS` incluant `correction_html`, `detailed_results`, `banque_id`, etc.
- Enrichir avec les infos de l'évaluation (titre, type, seuil, briques) et le nom de la banque

**`js/eleve-evaluation.js`** — rendu review :
- Réutiliser exactement la même fonction `showResults()` de la Phase 2
- Construire un objet `globalResult` depuis les données stockées
- Afficher le layout 2 colonnes identique au bilan post-passage

### Avantage :
- Un seul code de rendu pour le bilan (post-passage ET review)
- Cohérence visuelle totale
- Pas de duplication

---

## Phase 5 — Vérification du bouton "Commencer"

### État actuel du code (`eleve-evaluations.js`, lignes 606-614) :

```javascript
if (cardStatus === 'available' && !isPapier) {
    actionHtml = `<a href="evaluation.html?id=..." class="card-btn">Commencer</a>`;
} else if (isDone) {
    actionHtml = '<div class="card-detail-link">Voir le détail →</div>';
}
```

Le bouton "Commencer" n'apparaît que si `cardStatus === 'available'`, qui requiert qu'il n'y ait pas de résultat enregistré. **La logique est correcte.**

### Vérification à faire :
- Confirmer que `_getCardStatus()` retourne bien un statut "done" quand un résultat existe
- Tester le cas où le cache SheetsAPI n'est pas encore rafraîchi après la sauvegarde (l'élève revient vite sur la liste) → le `clearCacheFor('EVALUATION_RESULTATS')` dans `saveResults` devrait résoudre ça
- Si un bug est trouvé, le corriger

### Fichiers à vérifier :
- `js/eleve-evaluations.js` — `_getCardStatus()`
- `js/eleve-evaluation.js` — `saveResults()` (vérifier le clearCache)

---

## Résumé des fichiers impactés

| Fichier | Modifications |
|---------|--------------|
| `js/eleve-evaluation.js` | Phase 1 (saveResults enrichi) + Phase 2 (showResults refondu) + Phase 4 (mode review) |
| `css/eleve-evaluation.css` | Phase 2 (nouveau layout 2 colonnes) |
| `google-apps-script/Evaluations.gs` | Phase 1 (colonnes migration) + Phase 3 (banque_titre) + Phase 4 (getEvaluationResult) |
| `google-apps-script/Code.gs` | Phase 4 (route getEvaluationResult) |
| `js/eleve-evaluations.js` | Phase 4 (navigation au lieu du modal) |
| `css/eleve-evaluations.css` | Phase 4 (supprimer CSS modal review) |

## Ordre d'exécution recommandé

1. **Phase 5** d'abord (vérification rapide du bouton)
2. **Phase 1** (enrichir les données — pas d'impact visuel)
3. **Phase 2** (refonte visuelle du bilan)
4. **Phase 3** (message conseil)
5. **Phase 4** (review depuis la liste)

Les phases 2 et 3 peuvent être fusionnées en un seul développement.

## Risques et points d'attention

- **Rétro-compatibilité** : les évaluations déjà passées n'auront pas de `correction_html`. Le mode review affichera juste les stats sans détail — c'est acceptable.
- **Taille des données** : le HTML de correction peut être volumineux pour les formats carte/association avec images. Prévoir un fallback si > 40 000 caractères.
- **Build GAS** : penser à `npm run build:gas` après modification d'Evaluations.gs.
- **Pas de tests automatisés** : tester manuellement après chaque phase.
