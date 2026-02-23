# CLAUDE.md — Contexte pour Claude Code

## Le projet

**Brikks** est une plateforme e-learning française pour ~50 élèves de secondaire (histoire-géo, EMC).
L'utilisatrice principale est la professeure qui n'est pas développeuse : expliquer en termes simples, jamais de jargon inutile.

## Principes de travail

- **Proposer avant de coder** : analyser, proposer des solutions avec explications, attendre validation
- **Challenger si meilleure approche** : "Pourquoi pas plutôt...?" avec avantages/inconvénients
- **Expliquer l'impact métier** : pas "on refactorise le singleton", mais "les élèves ne verront plus les brouillons"
- **Pas d'usine à gaz** : solutions simples, minimales, maintenables
- **Pas de sur-ingénierie** : ne pas ajouter ce qui n'est pas demandé
- **Signaler la perte de contexte** : quand tu sens que tu perds en performance (relecture de fichiers déjà lus, oublis, réponses moins précises, compression du contexte), **dis-le immédiatement** à l'utilisatrice et propose de changer de conversation. Fournis-lui un résumé à copier-coller pour la prochaine session contenant : ce qui a été fait, ce qui reste à faire, les fichiers modifiés, et les décisions prises
- **Maintenir la documentation** : après chaque session de travail, mettre à jour la vue fonctionnelle ci-dessous (état des modules) et ajouter une entrée dans `CHANGELOG.md`. Ne documenter que les modules sur lesquels tu as effectivement travaillé — ne pas deviner l'état des modules inconnus.

## Vue fonctionnelle

> Cette section décrit l'état réel de chaque module, tel que constaté par les Claude successifs.
> **Règle** : ne documenter ici que ce qu'on a vérifié en travaillant dessus. Les modules non listés sont inconnus — le prochain Claude devra les explorer lui-même.

### Entraînements de connaissances (élève) — AUDITÉ ET NETTOYÉ

**Page** : `eleve/entrainements-conn.html`
**Fichiers** : `eleve-connaissances.js`, `-formats.js`, `-validation.js`, `-results.js`, `-utils.js`
**Backend** : `Entrainements.gs` (mémorisation), `Connaissances.gs` (banques de questions)

**Ce que fait le module :**
- L'élève voit une liste de banques d'exercices, chacune contenant des entraînements
- Chaque entraînement comporte 1 à N étapes, chaque étape ayant un format de question
- Formats supportés : QCM, vrai/faux, texte à trous, association, frise chronologique, image cliquable (carte), question ouverte, flashcard
- Après validation, l'élève voit un écran de correction détaillé avec feedback par question
- Système de **répétition espacée** : 7 niveaux à valider avec des délais croissants entre chaque révision
- Les entraînements verrouillés affichent la date de prochaine révision
- Mode libre : l'élève peut s'entraîner même quand un entraînement est verrouillé (sans impact sur la progression)
- Barre de progression par banque : pourcentage moyen des niveaux validés

**État** : fonctionnel, audité, code nettoyé et factorisé. UX de correction retravaillée.

## Architecture technique

### Stack
- **Frontend** : JavaScript vanilla + HTML + CSS (pas de framework)
- **Backend** : Google Apps Script (GAS) + Google Sheets comme base de données
- **Communication** : JSONP via `callAPI(action, params)` (script tags dynamiques)
- **Lecture directe** : certaines pages lisent Google Sheets API v4 via `sheets.js` (cache localStorage)

### Structure du repo
```
Brikks/
├── js/                          # 44 fichiers JS (~38k lignes)
├── css/                         # 29 fichiers CSS (~38k lignes)
├── google-apps-script/          # 12 fichiers .gs (~7.8k lignes)
│   ├── Code.gs                  # Routeur principal (switch/case sur 'action')
│   ├── Entrainements.gs         # Entraînements + mémorisation (répétition espacée)
│   ├── Connaissances.gs         # Banques de questions connaissances
│   ├── Exercices.gs             # Banques d'exercices + savoir-faire
│   ├── Evaluations.gs           # Évaluations
│   ├── Competences.gs           # Référentiel compétences + tâches complexes
│   ├── Users.gs                 # Utilisateurs, classes, groupes
│   ├── Themes.gs                # Disciplines, thèmes, chapitres
│   ├── Methodologie.gs          # Méthodologie (arbre hiérarchique)
│   ├── FAQ.gs                   # FAQ
│   ├── Videos.gs                # Vidéos + recommandations
│   └── Parametres.gs            # Paramètres du site
├── admin/                       # 18 pages HTML admin (prof)
├── eleve/                       # 18 pages HTML élève
├── components/                  # Layouts admin + élève + composants partagés
└── index.html                   # Point d'entrée (login)
```

### Module connaissances élève (le plus récemment travaillé)
```
js/eleve-connaissances.js           # Principal : chargement, rendu accordéon, navigation étapes
js/eleve-connaissances-formats.js   # Rendus des formats (QCM, V/F, chrono, association, etc.)
js/eleve-connaissances-validation.js # Validation des réponses par format
js/eleve-connaissances-results.js   # Écran de résultats, progression, mémorisation
js/eleve-connaissances-utils.js     # Helpers partagés (normalizeFormat, resetEtapeState, etc.)
```

## Conventions importantes

### Formats de questions — noms canoniques
Toujours utiliser les noms canoniques. La fonction `normalizeFormat()` dans utils.js gère les alias.

| Canonical | Alias (géré par normalizeFormat) |
|-----------|----------------------------------|
| `texte_trou` | `texte_trous` |
| `timeline` | `chronologie` |
| `qcm` | — |
| `vrai_faux` | — |
| `association` | — |
| `carte` | — |
| `question_ouverte` | — |
| `flashcard` | — |

### Constantes de mémorisation
| Module | Étapes | Constante backend | Constante frontend |
|--------|--------|-------------------|-------------------|
| **Connaissances** | 7 | `ETAPE_MAX = 7` (Entrainements.gs) | `SEUIL_ETAPES: 7` (EleveConnaissances) |
| **Savoir-faire** | 5 | À vérifier | À vérifier |

Le backend incrémente `prog.etape` après succès → c'est le **prochain** niveau à tenter.
Pour afficher le nombre de niveaux **validés** : `Math.max(0, prog.etape - 1)`.

### Helpers factorisés (eleve-connaissances-utils.js)
- `normalizeFormat(format)` — normalise les alias de format
- `getQcmCorrectIndices(q)` — extrait les indices corrects d'une question QCM
- `sortEventsByDate(events)` — tri chronologique par date numérique
- `resetEtapeState()` — réinitialise l'état d'une étape (réponses, sélections, format states)
- `getFormatLabel(formatCode)` — label humain d'un format (normalise automatiquement)

### Pattern de données
- Les entraînements ont un `statut` : `'publie'` ou `'brouillon'` — filtrer côté frontend
- Les `format_code` viennent du backend, peuvent être des alias → toujours normaliser
- Les progressions (`this.progressions[entrainement_id]`) contiennent : `etape`, `statut`, `prochaine_revision`, `seuil`

## Points connus non traités

- **Sécurité** : mots de passe en clair dans Google Sheets, pas d'auth côté serveur, clé API exposée côté client. Acceptable pour ~50 élèves en environnement scolaire, mais à documenter.
- **Module savoir-faire** : seuil de 5 étapes — vérifier l'alignement frontend/backend
- **Code admin** : pas encore audité/nettoyé
- **Module exercices élève** : pas encore audité
- **Tests** : aucun test automatisé (pas de framework de test configuré)
