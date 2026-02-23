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

## Ce qui a été fait (audit + corrections)

### Nettoyage
- ~880 lignes de code mort supprimées (JS, GAS, CSS)
- Documentation obsolète supprimée, `.gitignore` ajouté
- ESLint configuré, fichiers volumineux découpés en modules

### Bugs corrigés
- Filtre `statut === 'publie'` restauré (brouillons visibles par les élèves)
- SEUIL_ETAPES aligné à 7 partout (était 6 dans le menu, 7 côté serveur)
- Barre de progression corrigée (affichait le prochain niveau au lieu du validé)
- Feedback de correction amélioré (panels vert/rouge, "Non répondu", flashcards)

### Refactoring
- Code dupliqué factorisé (QCM x4, chrono sort x3, reset state x3)
- Noms de formats unifiés via `normalizeFormat()`
- Constante `SEUIL_ETAPES` partagée (1 seul endroit à modifier)

## Points connus non traités

- **Sécurité** : mots de passe en clair dans Google Sheets, pas d'auth côté serveur, clé API exposée côté client. Acceptable pour ~50 élèves en environnement scolaire, mais à documenter.
- **Module savoir-faire** : seuil de 5 étapes — vérifier l'alignement frontend/backend
- **Code admin** : pas encore audité/nettoyé
- **Module exercices élève** : pas encore audité
- **Tests** : aucun test automatisé (pas de framework de test configuré)
