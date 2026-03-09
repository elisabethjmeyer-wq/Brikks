# Plan de correction/évolution des évaluations

> 11 points remontés, regroupés en blocs logiques. Chaque bloc est indépendant.

---

## Bloc A — Points décimaux (point 1)

**Problème** : Le champ "Points mis en jeu" n'accepte que des entiers (`parseInt()`).
**Impact** : La prof ne peut pas mettre 0.25, 0.5, 1.5 pts.

**Correction** :
- `admin-evaluations.js` : remplacer `parseInt()` par `parseFloat()` pour le champ `briques` (2 endroits)
- Ajouter `step="0.25"` au champ HTML `<input type="number" id="evalBriques">`
- Ajuster le `min` à `0.25` au lieu de `1`
- Backend (`Evaluations.gs`) : `parseFloat` au lieu de `parseInt` si utilisé

---

## Bloc B — Wizard bonus suivi : critères/consignes pour l'élève (point 2)

**Problème** : Le wizard bonus suivi n'a qu'une étape (paramètres + nb validations). Pas de champ pour expliquer à l'élève ce qu'il doit faire (ex: "Gestion du matériel : apporter ses affaires à chaque cours").

**Proposition** : Ajouter un champ `description_eleve` (texte long) dans le wizard, visible côté élève sur la carte bonus suivi.
- Step 1 du wizard bonus suivi : ajouter un textarea "Consignes pour l'élève" sous le champ nb_validations
- Colonne `description_eleve` dans EVALUATIONS (migration progressive)
- Côté élève : afficher cette description sur la carte bonus suivi

---

## Bloc C — Réorganisation TC obligatoire vs Bonus (point 3)

**Problème actuel** : Les TC obligatoires (évaluations de compétences) apparaissent dans l'onglet Bonus côté élève au lieu de l'onglet Évaluations.

**Règle métier clarifiée** :
- **Onglet Évaluations** : connaissances + savoir-faire + **tâches complexes obligatoires** (avec dates ouverture/fermeture)
- **Onglet Bonus** : bonus compétence + bonus ponctuel + bonus suivi + **tâches complexes bonus** (sur demande, sans dates)

**Correction** :
- `eleve-evaluations.js` : modifier la logique de tri des évaluations entre les onglets
  - TC avec `date_ouverture` ou `date_fermeture` → onglet Évaluations
  - TC sans dates (sur demande) → onglet Bonus
  - Tous les autres bonus → onglet Bonus

---

## Bloc D — Badge "Disponible" trop large (point 4)

**Problème** : Le tag "Disponible" sur les cartes bonus prend toute la largeur en bleu.

**Correction** : CSS — le badge `.bonus-status.disponible` doit être `display: inline-block` / `width: fit-content` au lieu de prendre toute la ligne. Vérifier le conteneur parent.

---

## Bloc E — Demande bonus : feedback élève + notification admin (point 5)

**Problèmes** :
1. Quand l'élève clique "Demander", le bouton ne change pas visuellement
2. Pas de notification dans la cloche admin

**Corrections** :
1. **Élève** : après `demanderEvaluation` réussie, mettre à jour l'état local de la carte immédiatement (statut → `demande_envoyee`, remplacer le bouton par un badge "Demande envoyée")
2. **Admin** : intégrer le compteur de demandes dans le système de cloche existant (sidebar notification)

---

## Bloc F — Acceptation bonus → carte dans "Mes évaluations" + option voir sujet (point 6)

**Problèmes** :
1. Quand la prof accepte un bonus, la carte devrait passer dans "Mes évaluations" côté élève
2. La prof doit pouvoir choisir si l'élève peut voir le sujet avant l'évaluation

**Corrections** :
1. Côté élève : les bonus avec `demande_statut='accepte'` et `type_date='passage_classe'` apparaissent dans l'onglet Évaluations (à passer). Les bonus avec `type_date='date_butoir'` restent dans Bonus avec le lien vers le sujet.
2. Admin : ajouter un toggle "L'élève peut consulter le sujet" dans le modal d'acceptation → colonne `sujet_visible` dans EVALUATION_RESULTATS (migration progressive)

---

## Bloc G — Erreur getDataRange consultation sujet (point 7)

**Problème** : Quand on clique sur une évaluation de compétences ou bonus, erreur "Cannot read properties of null (reading 'getDataRange')".

**Cause probable** : Le backend cherche un sheet de questions qui n'existe pas pour les types bonus/TC.

**Correction** :
- Backend : dans `Evaluations.gs`, gérer le cas bonus/TC → ne pas chercher les questions
- Frontend : `eleve-evaluation.js` doit détecter le mode sujet et afficher le document en lecture seule

---

## Bloc H — Refonte gestion des demandes admin (point 8)

**Problème** : Le bandeau de demandes prend trop de place. Mieux vaut la cloche + toggle dans l'onglet Bonus.

**Proposition** :
1. **Cloche admin** : compteur de demandes en attente (badge rouge)
2. **Onglet Bonus admin** : toggle "Créer évaluations / Gérer les demandes"
   - Vue "Créer" : liste des évaluations bonus (actuelle)
   - Vue "Demandes" : cartes des demandes en attente avec accepter/refuser
3. **Suppression du bandeau** bleu
4. Demande acceptée → carte dans Corrections avec infos (date demande, date passage/butoir, consignes)

---

## Bloc I — Supprimer remarque du tableau de saisie (point 9)

**Problème** : Le champ "Remarque" est inutile dans le tableau de saisie pour bonus et TC.

**Correction** : masquer la colonne "Remarque" quand le type est bonus ou compétences.

---

## Bloc J — Attribution des points dans la correction (point 10)

**Problème** : La page Corrections ne permet pas d'attribuer les points gagnés.

**Corrections** :
1. Wizard correction : ajouter un champ "Points attribués" (0 à `briques` max) dans l'étape Bilan
2. Backend : `saveEvaluationCorrection` enregistre `score` dans EVALUATION_RESULTATS
3. Tableau de saisie : afficher `score` en lecture seule quand il vient de la correction

---

## Bloc K — Feedback élève : rendu copie + correction visible (point 11)

**Problèmes** :
1. L'élève ne peut pas signaler qu'il a rendu sa copie
2. Pas de changement visible après correction
3. L'élève ne peut pas consulter la correction

**Corrections** :
1. Bouton "J'ai rendu" → `demande_statut='rendu'` → carte "En attente de correction"
2. Après correction : carte affiche les points, passe dans "Terminées"
3. Clic sur carte terminée : vue correction (correction_prof + critères)

---

## Ordre de traitement proposé

1. **Bloc A** (points décimaux) — rapide
2. **Bloc D** (badge CSS) — rapide
3. **Bloc I** (supprimer remarque saisie) — rapide
4. **Bloc G** (erreur getDataRange) — bug critique
5. **Bloc B** (wizard suivi consignes) — moyen
6. **Bloc C** (TC obligatoire dans Évaluations) — moyen
7. **Bloc E** (feedback demande élève + notif admin) — moyen
8. **Bloc H** (refonte demandes admin) — important
9. **Bloc J** (points dans correction) — moyen
10. **Bloc F** (acceptation → mes évaluations + option sujet) — moyen
11. **Bloc K** (rendu copie + correction élève) — important
