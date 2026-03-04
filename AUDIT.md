# Audit complet du projet Brikks — Mars 2026

## Vue d'ensemble

| Catégorie | Fichiers | Lignes |
|-----------|----------|--------|
| JavaScript (`js/`) | 52 | ~47 000 |
| CSS (`css/`) | 32 | ~45 500 |
| Backend GAS (`google-apps-script/`) | 14 | ~17 500 |
| HTML (admin + élève + root) | 38 | ~1 700 |
| Components | 3 | ~1 125 |
| **Total** | **139** | **~113 000** |

---

## 1. Problèmes critiques (impact élevé, à traiter en priorité)

### 1.1 `escapeHtml()` dupliqué 25 fois

La même fonction identique est copiée dans **25 modules JS** (~500 lignes de code dupliqué) :

```
app.js, admin-banques-exercices.js, admin-banques-questions.js, admin-competences.js,
admin-corrections.js, admin-elements.js, admin-entrainements.js, admin-evaluations.js,
admin-faq.js, admin-methodologie.js, admin-recommandations.js, admin-suivi.js,
admin-videos.js, eleve-accueil.js, eleve-competences.js, eleve-connaissances-utils.js,
eleve-entrainement.js, eleve-evaluation.js, eleve-evaluations.js, eleve-exercices.js,
eleve-faq.js, eleve-methodologie-parcours.js, eleve-methodologie.js,
eleve-recommandations.js, eleve-videos.js
```

**Solution** : Extraire dans `app.js` comme fonction globale `escapeHtml()`, supprimer les 24 copies.

### 1.2 CSS : duplication massive entre fichiers

23 classes sont redéfinies dans 15+ fichiers chacune :

| Classe | Nb de fichiers |
|--------|---------------|
| `.empty-state` | 23 |
| `.loader` | 19 |
| `.loader-container` | 17 |
| `.empty-icon` | 17 |
| `.modal-overlay`, `.modal-header`, `.modal-close`, `.modal-body` | 16 chacune |
| `.btn-primary`, `.btn` | 16 |
| `.btn-secondary` | 15 |
| `.modal` | 14 |
| `.form-group` | 14 |

**Solution** : Créer un fichier `css/shared-components.css` (modals, boutons, loaders, empty states, formulaires), chargé par toutes les pages. Supprimer ces définitions des 32 fichiers individuels. Gain estimé : **~2 000-3 000 lignes**.

### 1.3 CSS : 3 fichiers géants avec doublons internes

| Fichier | Lignes | Doublons internes | `!important` |
|---------|--------|-------------------|-------------|
| `admin-banques-exercices.css` | 6 411 | 47+ classes définies 2-3 fois | 19 |
| `eleve-connaissances.css` | 5 676 | 41 classes définies 2-3 fois | 27 |
| `eleve-exercices.css` | 5 251 | 7 classes définies 2 fois | 36 |

Exemples de doublons internes dans `eleve-connaissances.css` :
- `.btn-qcm-next` défini **3 fois** (lignes 401, 422, 5588)
- `.correction-section` défini 2 fois (lignes 1387, 2128)
- `.qcm-choice` défini 2 fois (lignes 252, 5491)
- 38 autres classes dupliquées...

**Solution** : Dédupliquer chaque fichier (garder la définition la plus récente/complète), puis découper en sous-fichiers par responsabilité.

### 1.4 `TOUT-EN-UN.gs` : fichier monolithique de 8 777 lignes

Ce fichier est une copie intégrale de tous les autres `.gs`. S'il est déployé en même temps que les fichiers individuels, toutes les fonctions sont définies deux fois.

**Solution** : Clarifier le rôle (backup ? déploiement alternatif ?). Si c'est un artefact de déploiement, le documenter et le marquer comme auto-généré. Sinon, le supprimer.

---

## 2. Problèmes importants (impact moyen)

### 2.1 `console.log` en production : 43 instances dans 12 fichiers

| Fichier | Instances | Détail |
|---------|-----------|--------|
| `eleve-emploi-du-temps.js` | 14 | Debug intensif |
| `auth.js` | 10 | Bloc `=== DEBUG AUTH ===` |
| `admin-methodologie.js` | 10 | Debug divers |
| `admin-parametres.js` | 9 | Debug divers |
| `admin-videos.js` | 5 | Debug divers |
| 7 autres fichiers | 1-2 chacun | Ponctuels |

**Solution** : Supprimer tous les `console.log` ou les remplacer par `Logger.debug()` (le module `logger.js` existe déjà mais n'est presque pas utilisé).

### 2.2 Noms de feuilles hardcodés dans `Competences.gs`

27+ occurrences de noms de feuilles en dur (`'CompetencesReferentiel'`, `'CriteresReussite'`, etc.) au lieu d'utiliser la constante `SHEETS` définie dans `Code.gs`.

**Fichiers concernés** : `Competences.gs` (27 instances), `TOUT-EN-UN.gs` (38+ instances miroir)

**Solution** : Remplacer par les constantes `SHEETS.xxx` pour faciliter le renommage futur.

### 2.3 Pattern de cache dupliqué dans 4 modules

Le même code de gestion de cache localStorage (vérification TTL, stockage, refresh arrière-plan) est dupliqué dans :
- `eleve-connaissances.js` (TTL 5 min)
- `eleve-exercices.js` (TTL 5 min)
- `eleve-competences.js` (TTL 5 min)
- `admin-banques-exercices.js` (TTL 3 min)

**Solution** : Extraire dans un helper partagé `CacheUtils` (dans `app.js` ou un nouveau `cache-utils.js`).

### 2.4 Clés localStorage incohérentes

Certaines clés utilisent `CONFIG.STORAGE_KEYS`, d'autres sont en dur :

| Clé | Méthode | Fichier |
|-----|---------|---------|
| `brikks_user` | `CONFIG.STORAGE_KEYS.USER` ✓ | auth.js |
| `brikks_preview` | **Hardcodé** ✗ | auth.js:165 |
| `brikks_comp_timer_` | **Hardcodé** ✗ | eleve-competences-exercice.js |
| `brikks_sheets_` | **Hardcodé** ✗ | admin-suivi.js |
| `brikks_admin_banques_cache` | **Hardcodé** ✗ | admin-banques-exercices.js |

**Solution** : Centraliser toutes les clés dans `CONFIG.STORAGE_KEYS`.

### 2.5 Constantes de mémorisation hardcodées

| Constante | Valeur | Frontend | Backend |
|-----------|--------|----------|---------|
| Seuil connaissances | 7 | `SEUIL_ETAPES: 7` (eleve-connaissances.js:25) | `ETAPE_MAX = 7` (Entrainements.gs) |
| Seuil savoir-faire | 5 | `SEUIL_REPETITIONS: 5` (eleve-exercices.js:105) | Système par banque (Exercices.gs) |

Le backend renvoie `etape_max` mais le frontend l'ignore.

**Solution** : Soit utiliser la valeur du backend, soit ajouter dans `CONFIG` et documenter la synchronisation nécessaire.

### 2.6 129 déclarations `!important` dans le CSS

| Fichier | Count |
|---------|-------|
| eleve-exercices.css | 36 |
| eleve-connaissances.css | 27 |
| admin-banques-exercices.css | 19 |
| eleve-competences.css | 9 |
| admin-competences.css | 9 |
| Autres (8 fichiers) | ≤8 chacun |

**Cause** : les redéfinitions de classes entre fichiers créent des conflits de spécificité. La centralisation des composants partagés (point 1.2) devrait réduire ce nombre de ~80%.

### 2.7 Media queries dupliquées dans 11 fichiers

Même breakpoint défini 2+ fois dans le même fichier :

| Fichier | Blocs @media | Breakpoints uniques |
|---------|-------------|-------------------|
| eleve-connaissances.css | 14 blocs | 5 uniques |
| eleve-exercices.css | 13 blocs | 6 uniques |
| admin-banques-exercices.css | 8 blocs | 4 uniques |
| lecons.css | 7 blocs | 4 uniques |

**Solution** : Fusionner les blocs `@media` pour chaque breakpoint dans chaque fichier.

---

## 3. Problèmes mineurs (nettoyage)

### 3.1 `components.js` orphelin

`/components/components.js` (159 lignes) n'est chargé par **aucune page HTML**. Contient des utilitaires (sidebar toggle, user menu, initials) potentiellement dupliqués dans `admin-layout.js` et `eleve-layout.js`.

**Solution** : Vérifier si les fonctions existent dans les layouts, puis supprimer.

### 3.2 Pages placeholder sans contenu

7 pages sont des stubs vides sans module JS :
- Admin : `index.html`, `formats.html`, `messagerie.html`, `notes.html`, `suivi.html`
- Élève : `messagerie.html`, `notes.html`

Note : `admin-suivi.js` existe (1 119 lignes) mais `admin/suivi.html` ne le charge pas.

### 3.3 Nommage incohérent des pages élève

| Page HTML | Module JS chargé |
|-----------|-----------------|
| `entrainements-conn.html` | `eleve-connaissances*.js` |
| `entrainements-sf.html` | `eleve-exercices*.js` |
| `entrainements-comp.html` | `eleve-competences*.js` |

Les noms HTML et JS ne correspondent pas.

### 3.4 `getQuestionPreview()` dupliqué dans 3-4 fichiers

Fonction de prévisualisation des questions dupliquée dans :
- `admin-entrainements.js:361`
- `admin-banques-questions.js:970`
- `admin-banques-exercices-questions.js:101`
- `admin-banques-exercices-connaissances.js` (via `this.`)

**Solution** : Extraire dans un helper partagé.

### 3.5 Préfixes CSS `-webkit-box` obsolètes

2 occurrences de `-webkit-box` / `-webkit-box-orient` (remplaçables par `display: flex`). Garder `-webkit-line-clamp` et `-webkit-backdrop-filter` (encore nécessaires).

### 3.6 ESLint : 64 warnings (0 erreurs)

- 54 `no-unused-vars` (paramètres sans préfixe `_`, variables assignées non utilisées)
- 10 `no-empty` (blocs catch vides)

Corrigeable rapidement avec `npm run lint:fix` + revue manuelle.

### 3.7 2 TODO restants dans le code

- `admin-evaluations.js:576` : `// TODO: Implement attribution saving`
- `logger.js:16` : `// TODO: Send to monitoring service if needed`

---

## 4. Points structurels (à garder en tête)

### 4.1 Sécurité (accepté pour le contexte scolaire)

- Mots de passe en clair dans Google Sheets (Users.gs)
- Pas de contrôle d'accès côté serveur (n'importe quel utilisateur authentifié peut appeler toutes les API)
- IDs basés sur les timestamps (prédictibles)
- Clé API Sheets exposée côté client
- Pas de validation des données entrantes côté backend (injection de formules possible via champs `donnees`)

### 4.2 Aucun test automatisé

Pas de framework de test configuré. `npm test` retourne une erreur. À considérer au moins pour les fonctions de validation/comparaison.

### 4.3 `callAPI` dupliqué par module (intentionnel)

Chaque module a sa propre méthode `callAPI()` (19 modules). C'est documenté comme intentionnel dans CLAUDE.md mais crée ~500 lignes de duplication.

### 4.4 159 routes dans Code.gs

Toutes les routes sont actives et correspondent à des fonctions existantes. 11 alias de rétro-compatibilité (`getTachesComplexes` → `getEntrainementsCompetences`, etc.).

---

## 5. Plan d'action recommandé

### Phase 1 — Quick wins (quelques heures, gain immédiat)

| Action | Fichiers | Gain estimé |
|--------|----------|-------------|
| Extraire `escapeHtml()` global dans `app.js` | 25 fichiers | ~500 lignes |
| Supprimer les `console.log` de production | 12 fichiers | 43 lignes + propreté |
| Corriger les warnings ESLint | 25 fichiers | 64 warnings → 0 |
| Supprimer `components.js` orphelin | 1 fichier | 159 lignes |
| Dédupliquer les classes CSS internes | 3 fichiers | ~400-800 lignes |

### Phase 2 — Factorisation (1-2 jours, gain structurel)

| Action | Fichiers | Gain estimé |
|--------|----------|-------------|
| Créer `css/shared-components.css` | 32 fichiers | ~2 000-3 000 lignes |
| Centraliser le cache localStorage | 4 fichiers | ~200 lignes + maintenabilité |
| Centraliser les clés `CONFIG.STORAGE_KEYS` | 5 fichiers | Cohérence |
| Remplacer les noms de feuilles hardcodés (Competences.gs) | 1 fichier | 27 remplacements |
| Fusionner les media queries dupliquées | 11 fichiers | ~200 lignes |

### Phase 3 — Découpage des gros fichiers (2-3 jours, maintenabilité)

| Action | Fichier source | Fichiers cibles |
|--------|---------------|----------------|
| Découper `admin-banques-exercices.css` (6 411 l.) | 1 | 3-4 fichiers |
| Découper `eleve-connaissances.css` (5 676 l.) | 1 | 3 fichiers |
| Découper `eleve-exercices.css` (5 251 l.) | 1 | 3 fichiers |
| Clarifier le rôle de `TOUT-EN-UN.gs` | 1 | Documentation |

### Phase 4 — Améliorations optionnelles

- Extraire `getQuestionPreview()` en helper partagé
- Ajouter des variables CSS (`:root { --color-* }`)
- Configurer un framework de test minimal (Jest/Vitest)
- Évaluer la centralisation de `callAPI()` dans `app.js`

---

*Audit réalisé le 4 mars 2026. Fichiers analysés : 139 fichiers, ~113 000 lignes de code.*
