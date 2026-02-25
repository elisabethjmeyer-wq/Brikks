# Plan : Restructuration du module Compétences

## Objectif

Séparer le référentiel (liste de compétences + critères) de la gestion des banques d'entraînements.
Aujourd'hui les compétences du référentiel contrôlent directement ce que les élèves voient.
On veut introduire une couche "banque" dans l'onglet Compétences des banques d'exercices,
qui gère la visibilité élève indépendamment du référentiel.

## Modèle actuel

```
CompetencesReferentiel (id, nom, description, consigne, ordre, visible)
    └── CriteresReussite (id, competence_id, libelle, ordre)
    └── EntrainementsCompetences (id, competence_id, titre, description, ...)
          └── EleveEntrainementsCompetences (id, eleve_id, entrainement_id, ...)
```

Le champ `visible` du référentiel contrôle TOUT : admin + élève.
Pas de notion de "banque" — les entraînements sont directement rattachés à une compétence.

## Modèle cible

```
CompetencesReferentiel (id, nom, description, consigne, ordre)
    └── CriteresReussite (id, competence_id, libelle, ordre)
                                    ↑ (lecture seule, pour affichage)
BanquesCompetences (id, competence_id, titre, description, ordre, statut)  ← NOUVEAU
    └── EntrainementsCompetences (id, banque_id, titre, description, ...)  ← FK change
          └── EleveEntrainementsCompetences (inchangé)
```

- Le référentiel perd le champ `visible` (ou il devient interne admin)
- Nouvelle table `BanquesCompetences` : chaque banque est liée à une compétence du référentiel
- Les entraînements passent de `competence_id` → `banque_id`
- La banque a un `statut` (brouillon/publié) qui contrôle la visibilité élève
- Côté élève : on affiche les banques publiées comme des cartes compétences
  (nom de la compétence, critères, entraînements publiés, progression)

## Étapes d'implémentation

### Étape 1 — Backend : nouvelle table + API

**Fichier** : `google-apps-script/Competences.gs`

- Créer les fonctions CRUD pour `BanquesCompetences` :
  - `getBanquesCompetences()` — lecture
  - `createBanqueCompetence(data)` — création (id, competence_id, titre, description, ordre, statut)
  - `updateBanqueCompetence(data)` — modification
  - `deleteBanqueCompetence(data)` — suppression (+ cascade entraînements ?)

**Fichier** : `google-apps-script/Code.gs`
- Ajouter les routes dans le switch/case
- Ajouter le nom de la table dans SHEETS

**Fichier** : `js/config.js`
- Ajouter `BanquesCompetences: 'BanquesCompetences'` dans CONFIG.SHEETS

### Étape 2 — Backend : adapter EntrainementsCompetences

**Fichier** : `google-apps-script/Competences.gs`

- Les entraînements passent de `competence_id` → `banque_id`
- Adapter `createEntrainementCompetence` et `updateEntrainementCompetence`
- Garder `competence_id` en lecture seule (dénormalisé ou résolu via la banque)

### Étape 3 — Admin : onglet Compétences dans Banques d'exercices

**Fichier** : `js/admin-banques-exercices-questions.js` (section compétences ~lignes 1595-1950)

Refonte complète de la section :
- Charger `BanquesCompetences` au lieu de regrouper par compétence du référentiel
- Rendu accordéon : chaque banque = une carte (titre = nom compétence, statut brouillon/publié)
- Bouton "+" en haut → modal création de banque :
  - Select compétence (depuis le référentiel complet, pas juste les visibles)
  - Titre (pré-rempli avec le nom de la compétence)
  - Description
  - Statut (brouillon/publié)
- À l'intérieur de chaque banque : liste des entraînements (comme aujourd'hui)
- Bouton "+" par banque → modal création d'entraînement (comme aujourd'hui, mais `banque_id` au lieu de `competence_id`)
- Actions sur la banque : éditer, supprimer, changer statut

**Fichier** : `js/admin-banques-exercices.js`
- Ajouter `banquesCompetences: []` dans les données
- Charger `getBanquesCompetences` dans loadData / cache
- Adapter `updateCounts()` pour compter les banques

### Étape 4 — Admin : simplifier le référentiel

**Fichier** : `js/admin-competences.js`

- Retirer le toggle visible/masqué (le référentiel ne contrôle plus la visibilité élève)
- La page reste pour : CRUD compétences + gestion des critères de réussite
- Optionnel : ajouter un indicateur "utilisée dans X banques" pour chaque compétence

### Étape 5 — Élève : adapter la page compétences

**Fichier** : `js/eleve-competences.js`

- Charger `getBanquesCompetences` en plus des données actuelles
- Filtrer par `statut === 'publie'` au lieu de `visible === true`
- Les cartes affichent toujours le nom de la compétence (résolu via `banque.competence_id` → référentiel)
- Les critères viennent toujours du référentiel (via `competence_id` de la banque)
- Les entraînements sont filtrés par `banque_id` au lieu de `competence_id`
- Le reste de la navigation (détail + exercice) reste identique

**Fichier** : `js/eleve-competences-exercice.js`
- Adapter les références si la structure de données change (banque_id vs competence_id)

### Étape 6 — Migration des données existantes

- Script de migration (ou manuel dans Google Sheets) :
  - Pour chaque compétence qui a des entraînements → créer une banque
  - Mettre `statut = 'publie'` si la compétence était visible, `brouillon` sinon
  - Mettre à jour les entraînements existants : `competence_id` → `banque_id`

### Étape 7 — Nettoyage

- Retirer le champ `visible` du référentiel (ou le laisser sans impact)
- Nettoyer le module legacy `eleve-exercices-competences.js` si plus utilisé
- Mettre à jour le cache (clés, TTL)

## Fichiers impactés

| Fichier | Changement |
|---------|------------|
| `google-apps-script/Competences.gs` | CRUD BanquesCompetences + adapter entraînements |
| `google-apps-script/Code.gs` | Nouvelles routes |
| `js/config.js` | Nouvelle table |
| `js/admin-banques-exercices.js` | Charger banquesCompetences, cache, counts |
| `js/admin-banques-exercices-questions.js` | Refonte onglet Compétences |
| `js/admin-competences.js` | Retirer toggle visible |
| `js/eleve-competences.js` | Filtrer par banques publiées |
| `js/eleve-competences-exercice.js` | Adapter références |
| `js/eleve-exercices-competences.js` | Adapter ou supprimer |

## Risques

- **Données existantes** : les entraînements actuels ont `competence_id`, il faut migrer vers `banque_id`
- **Module legacy** (`eleve-exercices-competences.js`) : utilise l'ancien modèle, à vérifier s'il est encore actif
- **Évaluations** : le module évaluations référence des compétences — vérifier qu'il n'est pas impacté
- **Pas de tests automatisés** : chaque changement doit être testé manuellement

## Approche recommandée

Commencer par les étapes 1-2 (backend) puis 3 (admin), car c'est le cœur du changement.
Les étapes 4-5 (référentiel + élève) en découlent naturellement.
La migration (étape 6) peut se faire manuellement dans Google Sheets si peu de données.
