# Plan de nettoyage — Brikks

> Objectif : dédupliquer et centraliser, **pas** restructurer. L'architecture est saine.

---

## Phase 1 — Quick wins JS (peu de risque, gain immédiat)

### 1.1 Extraire `escapeHtml()` en fonction globale
- Ajouter `escapeHtml()` comme fonction globale dans `app.js` (hors de l'objet `App`)
- Supprimer les 24 copies dans les autres modules
- Ajouter `escapeHtml` dans les globals ESLint

### 1.2 Supprimer les `console.log` de production
- Supprimer les 43 instances dans 12 fichiers
- Garder uniquement ceux de `logger.js` (c'est son rôle)

### 1.3 Fixer les 64 warnings ESLint
- Préfixer les paramètres inutilisés avec `_` (54 cas)
- Ajouter un commentaire dans les blocs `catch` vides (10 cas)

### 1.4 Supprimer `components/components.js`
- Vérifier que ses fonctions existent déjà dans les layouts
- Supprimer le fichier orphelin (159 lignes)

---

## Phase 2 — CSS : dédupliquer et centraliser

### 2.1 Dédupliquer les classes internes des 3 gros fichiers
- `eleve-connaissances.css` : 41 classes définies 2-3 fois → garder une seule définition
- `admin-banques-exercices.css` : 47+ doublons → idem
- `eleve-exercices.css` : 7 doublons → idem

### 2.2 Créer `css/shared-components.css`
- Extraire les composants redéfinis dans 14+ fichiers : modals, boutons, loaders, empty states, formulaires
- Charger ce fichier dans toutes les pages HTML (après `style.css`)
- Supprimer ces définitions des fichiers individuels

### 2.3 Fusionner les media queries dupliquées
- Dans chaque fichier, regrouper les blocs `@media` par breakpoint (11 fichiers concernés)

---

## Phase 3 — Centraliser les constantes et utilitaires JS

### 3.1 Centraliser les clés localStorage dans `CONFIG.STORAGE_KEYS`
- Ajouter les clés manquantes : `PREVIEW`, `COMP_TIMER`, `SHEETS_PREFIX`, etc.
- Remplacer les strings en dur dans 5 fichiers

### 3.2 Centraliser les constantes de mémorisation dans `CONFIG`
- Ajouter `CONFIG.SEUIL_CONNAISSANCES` (7) et `CONFIG.SEUIL_SAVOIR_FAIRE` (5)
- Remplacer dans `eleve-connaissances.js` et `eleve-exercices.js`

### 3.3 Centraliser le pattern de cache localStorage
- Créer 2 fonctions dans `app.js` : `App.loadCache(key, ttl)` et `App.saveCache(key, data)`
- Remplacer le code dupliqué dans les 4 modules concernés

---

## Phase 4 — Backend GAS

### 4.1 Remplacer les noms de feuilles en dur dans `Competences.gs`
- 27 occurrences de strings → constantes `SHEETS.xxx`

### 4.2 Script de génération automatique de `TOUT-EN-UN.gs`
- Créer un script `npm run build:gas` qui concatène tous les `.gs` (sauf TOUT-EN-UN.gs) dans `TOUT-EN-UN.gs`
- Ordre : `Code.gs` en premier (contient les constantes), puis les autres par ordre alphabétique
- Ajouter un commentaire en-tête : "Fichier auto-généré, ne pas modifier directement"
- Documenter la procédure de déploiement

---

## Ce qu'on ne fait PAS (et pourquoi)

| Idée | Pourquoi on ne le fait pas |
|------|---------------------------|
| Redécouper les gros fichiers JS | Déjà bien structurés en sous-modules |
| Restructurer le backend GAS | Déjà organisé par domaine, tailles raisonnables |
| Centraliser `callAPI()` | Intentionnellement par module (doc CLAUDE.md) |
| Découper les gros CSS en sous-fichiers | Les doublons internes sont le vrai problème, pas la taille |
| Ajouter un framework de test | Pas prioritaire pour le nettoyage |
| Corriger les problèmes de sécurité | Accepté pour le contexte scolaire (~50 élèves) |
