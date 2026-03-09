# Plan de correction/évolution des évaluations

> Réorganisé par blocs fonctionnels logiques (traités dans l'ordre).

---

## Bloc 1 — Corrections transversales (rapides)

### 1.1 Points décimaux (point 1)
**Problème** : `parseInt()` empêche 0.25, 0.5, 1.5 pts dans "Points mis en jeu".

**Fichiers** :
- `js/admin-evaluations.js` L1145 et L1618 : `parseInt(briques)` → `parseFloat(briques)`
- `js/admin-evaluations.js` HTML du champ : ajouter `step="0.25" min="0.25"` au lieu de `min="1"`
- `google-apps-script/Evaluations.gs` : vérifier que `briques` n'est pas parsé en int côté backend

### 1.2 Badge "Disponible" trop large (point 4)
**Problème** : Le badge bleu "Disponible" prend toute la largeur de la carte.

**Fichiers** :
- `css/eleve-evaluations.css` L710-724 : `.bonus-status` est déjà `display: inline-block`. Le problème vient probablement du conteneur parent qui est en `display: block` ou de la carte qui n'a pas de layout flex. Vérifier le parent `.bonus-card-footer` ou équivalent.

---

## Bloc 2 — Évaluations de compétences (TC obligatoires)

> Les TC obligatoires = évaluations de compétences avec dates ouverture/fermeture.
> Se passent hors ligne (papier/mail), la prof saisit les résultats manuellement.

### 2.1 TC obligatoires dans onglet Évaluations (point 3)
**Problème** : Les TC obligatoires apparaissent dans l'onglet "Bonus" au lieu de "Évaluations".

**Fichiers** :
- `js/eleve-evaluations.js` L410 : `isTCBonus = isTC && !ev.date_ouverture && !ev.date_fermeture`
  - La logique est déjà correcte : TC AVEC dates → onglet Évaluations (L444-459), TC SANS dates → Bonus.
  - **À vérifier** : les TC créées côté admin ont-elles bien `date_ouverture`/`date_fermeture` renseignées ? Si non, elles tombent dans Bonus par défaut.
  - **Action** : vérifier les données. Si les dates sont vides, le problème est côté admin (création) pas côté élève (affichage).

### 2.2 Erreur getDataRange sur clic TC/bonus (point 7)
**Problème** : `Cannot read properties of null (reading 'getDataRange')` quand on clique sur une éval compétences/bonus.

**Cause** : `eleve-evaluation.js` redirige vers `evaluation.html` qui charge le backend `getEvaluationForEleve`. Le backend cherche des questions dans un sheet (ex: EVALUATION_QUESTIONS) qui n'existe pas ou est vide pour les TC/bonus (ils n'ont pas de questions en ligne).

**Fichiers** :
- `google-apps-script/Evaluations.gs` : dans la fonction qui charge l'évaluation pour l'élève, ajouter un guard `if (type === 'competences' || type === 'bonus') return { success: true, evaluation: evalData }` sans chercher les questions
- `js/eleve-evaluation.js` : détecter le type TC/bonus → afficher le document/sujet en lecture seule (pas le module d'exercice)
- `js/eleve-evaluations.js` L878 : `consulterSujet()` redirige vers `evaluation.html?mode=sujet` — ce mode doit être implémenté

### 2.3 Consultation sujet TC en lecture seule (point 7 suite)
**Problème** : Le mode `?mode=sujet` n'existe pas dans `eleve-evaluation.js`.

**Implémentation** :
- `js/eleve-evaluation.js` : ajouter un branch `if (mode === 'sujet')` dans `init()`
- Charger l'évaluation (métadonnées seulement, pas de questions)
- Récupérer le document/sujet de l'exercice TC lié (`exercice_tc_id` ou `exercice_comp_id`)
- Afficher en lecture seule : titre, consignes, document (iframe Google Doc ou HTML)
- Pas de timer, pas de bouton "Terminer", pas de correction

### 2.4 Supprimer remarque du tableau de saisie TC (point 9)
**Problème** : Colonne "Remarque" inutile dans la saisie des résultats TC.

**Fichiers** :
- `js/admin-evaluations.js` L1929 : `const showRemarque = isBonusOrTC;` → `const showRemarque = false;` (ou simplement supprimer la condition)
- Supprimer aussi la cellule remarqueCell dans le HTML des lignes (L1980-1984)

### 2.5 Points attribués dans le wizard Correction TC (point 10)
**Problème** : La page Corrections ne permet pas d'attribuer les points pour les TC.

**Fichiers** :
- `js/admin-corrections.js` : dans l'étape Bilan du wizard, ajouter :
  - Affichage "Points mis en jeu : X pts" (lu depuis `evaluation.briques`)
  - Champ input "Points attribués" (0 à briques, step 0.25)
  - Ce champ est envoyé comme `score` dans `saveEvaluationCorrection`
- `google-apps-script/Evaluations.gs` `saveEvaluationCorrection` : ajouter `score` aux colonnes écrites
- `js/admin-evaluations.js` tableau de saisie : si `score` existe dans EVALUATION_RESULTATS, l'afficher en lecture seule dans la colonne Résultat (au lieu du dropdown)

### 2.6 Feedback élève après correction TC (point 11 partiel)
**Problème** : L'élève ne voit rien changer après correction.

**Fichiers** :
- `js/eleve-evaluations.js` : dans `categorizeEvaluations()`, les TC avec `demande_statut='corrige'` ou `is_validated` doivent apparaître dans "Terminées" avec les points gagnés
- Carte terminée cliquable → ouvre vue correction (correction_prof + critères validés par compétence)
- Réutiliser la logique existante de `openReview()` en l'adaptant pour les TC

---

## Bloc 3 — Évaluations bonus (compétence + ponctuel)

> Bonus = sur demande de l'élève. Se passent hors ligne.
> Flux : Disponible → Demandé → Accepté → Rendu → Corrigé → Terminé

### 3.1 Feedback après clic "Demander" (point 5)
**Problème** : Le bouton "Demander" ne change pas visuellement après le clic.

**Analyse** : Le code actuel (L854-872) fait `loadData() → categorizeEvaluations() → render()` après succès. En théorie la carte devrait se mettre à jour. **Hypothèses** :
  - Le `loadData()` recharge depuis le cache localStorage (pas encore invalidé)
  - Ou le re-render est trop rapide et le nouveau statut n'est pas encore visible

**Fichiers** :
- `js/eleve-evaluations.js` `demanderEvaluation()` : invalider le cache `EVALUATION_RESULTATS` avant le reload
- Ajouter un feedback visuel immédiat (désactiver le bouton + texte "Envoi...") pendant l'appel API
- Après succès : notification toast "Demande envoyée !" + re-render complet

### 3.2 Notification admin dans la cloche (point 5)
**Problème** : Pas de notification dans la cloche admin quand un élève fait une demande.

**Fichiers** :
- `components/admin-layout.js` : le système de cloche existe-t-il déjà ? Si oui, ajouter le compteur de demandes. Si non, ajouter une cloche dans le header admin avec badge.
- Compter les `demande_statut='demande'` dans EVALUATION_RESULTATS
- Clic sur la cloche → naviguer vers l'onglet Bonus avec la vue demandes

### 3.3 Toggle "Créer / Gérer demandes" dans onglet Bonus admin (point 8)
**Problème** : Le bandeau de demandes prend de la place. L'utilisatrice veut un toggle.

**Implémentation** (option 1 choisie) :
- `js/admin-evaluations.js` : dans le render de l'onglet Bonus, ajouter un toggle en haut :
  ```
  [Créer évaluations] [Gérer les demandes (3)]
  ```
- Vue "Créer" = contenu actuel (liste des évals bonus + bouton "+ Nouvelle")
- Vue "Gérer" = liste des demandes en attente avec cartes (élève, éval, date, badge type) + boutons Accepter/Refuser
- Supprimer le bandeau bleu `#demandesBanner`
- Le compteur "(3)" dans le toggle se met à jour dynamiquement

### 3.4 Acceptation → carte migre dans "Mes évaluations" (point 6)
**Problème** : Quand la prof accepte un bonus, la carte reste dans l'onglet Bonus.

**Règle** : Tout bonus accepté (`demande_statut='accepte'`) migre dans l'onglet Évaluations côté élève.

**Fichiers** :
- `js/eleve-evaluations.js` `categorizeEvaluations()` : modifier la logique pour que les bonus/TC-bonus avec `demande_statut='accepte'` aillent dans `categories.available` (onglet Évaluations, section "À passer") au lieu de rester dans `categories.bonus`
- Carte affichée avec badge type (bonus comp = violet, ponctuel = teal) + info date
- Mode passation forcé "papier" (pas de bouton "Commencer")

### 3.5 Option "voir le sujet" lors de l'acceptation (point 6)
**Problème** : La prof veut contrôler si l'élève peut voir le sujet avant.

**Fichiers** :
- `js/admin-evaluations.js` `openReponseModal()` : ajouter un toggle "L'élève peut consulter le sujet avant l'évaluation" (oui/non, défaut: non)
- `google-apps-script/Evaluations.gs` `repondreDemandeEvaluation` : colonne `sujet_visible` dans EVALUATION_RESULTATS (migration progressive)
- `js/eleve-evaluations.js` : si `sujet_visible` = true → lien "Consulter le sujet" visible. Si false → juste les infos (date, consigne) mais pas de lien vers le sujet.

### 3.6 Bouton "J'ai rendu" côté élève (point 11)
**Problème** : L'élève n'a aucun moyen de signaler qu'il a rendu sa copie.

**Fichiers** :
- `js/eleve-evaluations.js` : sur la carte acceptée (dans onglet Évaluations après migration), ajouter un bouton "J'ai rendu ma copie"
- Appel API : action `signalerRendu` → met `demande_statut='rendu'` dans EVALUATION_RESULTATS
- `google-apps-script/Evaluations.gs` : ajouter action `signalerRendu` (simple update d'une colonne)
- `google-apps-script/Code.gs` : router l'action
- Après rendu : carte passe en statut "En attente de correction" (pas de bouton, juste un badge)

### 3.7 Correction visible côté élève (point 11)
**Problème** : Après correction par la prof, l'élève ne voit rien.

**Fichiers** :
- `js/eleve-evaluations.js` `categorizeEvaluations()` : les bonus avec `demande_statut='corrige'` + `is_validated` défini → statut `validated` ou `failed`, dans "Terminées"
- Carte terminée affiche les points gagnés (+X ou +0)
- Clic → vue correction : affiche correction_prof (block editor content ou URL) + critères validés
- Réutiliser `openReview()` en l'adaptant pour les bonus (charger depuis EVALUATION_RESULTATS au lieu de EleveEntrainementsCompetences)

---

## Bloc 4 — Bonus suivi

### 4.1 Wizard suivi : consignes pour l'élève (point 2)
**Problème** : Le wizard bonus suivi n'a pas de champ pour expliquer à l'élève quoi faire.

**Fichiers** :
- `js/admin-evaluations.js` : dans `_renderWizardStep1()`, quand `sous_type_bonus === 'suivi'`, ajouter un textarea "Consignes pour l'élève" sous le champ nb_validations
- Valeur stockée dans `wizardData.description_eleve`
- `js/admin-evaluations.js` `saveEvaluation()` : envoyer `description_eleve` au backend
- `google-apps-script/Evaluations.gs` `createEvaluation/updateEvaluation` : colonne `description_eleve` dans EVALUATIONS (migration progressive)
- `js/eleve-evaluations.js` : afficher la description sur la carte bonus suivi, sous la barre de progression

---

## Ordre de traitement

1. **Bloc 1** — Corrections transversales (1.1 points décimaux, 1.2 badge CSS)
2. **Bloc 2** — Évaluations de compétences (2.1 à 2.6)
3. **Bloc 3** — Évaluations bonus (3.1 à 3.7)
4. **Bloc 4** — Bonus suivi (4.1)
