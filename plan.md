# Plan : Compétences personnalisées dans les bonus missions

## Concept

Remplacer les "critères libres" (simples textes sans points ni matière) par des **compétences personnalisées** : même structure qu'une compétence du référentiel (nom + matière + points + critères de réussite), mais locale à cette mission.

## Format de données

### Ancien format `criteres_libres`
```json
["Critère 1", "Critère 2"]
```

### Nouveau format `criteres_libres`
```json
[
  {
    "id": "custom_1",
    "nom": "Soin de la copie",
    "matiere": "FR",
    "points": 1,
    "criteres": ["Écriture lisible", "Pas de ratures"]
  }
]
```

### Rétro-compatibilité
Détection automatique : si le premier élément est un `string` → ancien format (traité comme avant). Si c'est un `object` → nouveau format. Les évaluations existantes continuent de fonctionner sans migration.

## Fichiers à modifier

### 1. `js/admin-evaluations.js` — Wizard création (étape 2 + validation + résumé)

**Étape 2 (`_renderStepCompetencesEtCriteres`)** — Lignes 1798-1867 :
- Remplacer la section "Critères libres" (simples inputs texte) par des **cartes de compétences personnalisées**
- Chaque carte contient : nom (input texte), matière (sélecteur FR/HG-EMC/Transversal), points (input number), critères de réussite (liste d'inputs texte avec + / -)
- Bouton "+ Ajouter une compétence personnalisée"
- Chaque compétence perso reçoit un `id` généré (`custom_${timestamp}_${index}`)

**Validation étape (`_validateStep`, case `competences_et_criteres`)** — Lignes 2739-2771 :
- Collecter les compétences personnalisées depuis le DOM (nom, matière, points, critères)
- Les inclure dans le calcul de `briques` (total des points)
- Sérialiser dans `wizardData.criteres_libres` au nouveau format JSON
- Validation : chaque compétence perso doit avoir au minimum un nom

**Résumé (`_renderStepResume`)** — Lignes 2471-2483 :
- Afficher les compétences personnalisées avec le même format que les compétences du référentiel (tag matière + points)
- Lister les critères de réussite en dessous

### 2. `js/admin-corrections.js` — Wizard correction (étape Critères)

**`getCriteresLibres()`** — Lignes 259-271 :
- Adapter pour détecter l'ancien vs nouveau format
- Si nouveau format : retourner les critères regroupés par compétence personnalisée

**`_renderStep3BonusPonctuel()`** — Lignes 1226-1248 :
- Si nouveau format : afficher les critères groupés par compétence perso (comme les TC affichent par compétence du référentiel)
- Si ancien format : comportement inchangé (liste plate)

**`toggleCritere()` + bilan** — Lignes 1279-1314, 1468-1471 :
- Adapter pour que les critères des compétences perso fonctionnent comme ceux du référentiel
- Le bilan agrège les points par compétence personnalisée

**Save (`_saveCorrection`)** — Lignes 1634-1668 :
- Inclure les points des compétences personnalisées dans `points_par_competence` (avec clé `custom_X`)

### 3. `js/eleve-evaluations.js` — Cartes élève

**`_renderBonusDemandeCard()`** — Lignes 723-842 :
- Points affichés = somme compétences référentiel + compétences perso (déjà dans `briques`)
- Pas de changement structurel nécessaire

### 4. `js/eleve-notes.js` — Page résultats élève

**`_getBonusData()`** — Lignes 541-553 :
- Détecter nouveau format et extraire les critères correctement
- Les compétences perso alimentent les points par matière (comme les compétences du référentiel)

**`_renderBonusCard()`** — Lignes 1086-1181 :
- Afficher les critères des compétences perso groupés par compétence (pas en liste plate)

### 5. `js/eleve-evaluation.js` — Vue review TC/bonus

- Si l'évaluation contient des compétences perso : les afficher dans la review avec le même traitement que les compétences du référentiel

### 6. Backend (`Evaluations.gs`) — Aucune modification
- `criteres_libres` est déjà un champ texte libre (JSON string)
- Le backend ne parse pas le contenu, il le stocke tel quel
- Pas de changement de schéma nécessaire

## Ordre d'implémentation

1. **Admin wizard (étape 2)** — le cœur du changement : nouvelle UI compétences perso
2. **Admin wizard (validation + résumé)** — collecte des données + affichage résumé
3. **Admin corrections** — adapter la correction pour le nouveau format
4. **Élève évaluations + notes** — adapter l'affichage
5. **Rétro-compatibilité** — helper partagé de détection ancien/nouveau format
