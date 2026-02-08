# 📊 Organisation des Onglets Google Sheets - Brikks

Document pour identifier rapidement quel sheet sert à quoi, établir un code couleur et nettoyer.

---

## 🎨 CODE COULEUR RECOMMANDÉ

| Couleur | Signification | Nombre |
|---------|---------------|---------|
| 🟢 Vert | Sheets **ACTIFS** (à garder, en bon état) | 34 |
| 🟡 Orange | Sheets **LEGACY** (remplacés, à dépublier progressivement) | 10 |
| 🔴 Rouge | Sheets **À CORRIGER** (bugs connus, données mal formées) | 1-3 |
| ⚫ Noir/Gris | Sheets **ORPHELINS** (jamais utilisés, à supprimer) | 0 |

---

## 📋 DÉTAIL PAR CATÉGORIE

### 🟢 1. INFRASTRUCTURE & BASE (7 sheets) - TOUS ACTIFS
**Utilité:** Fondation du système - ne pas toucher sauf si expertise

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| UTILISATEURS | Admin Utilisateurs + Auth | 🟢 Actif | Garder |
| CLASSES | Admin + Utilisateurs | 🟢 Actif | Garder |
| GROUPES | Admin Utilisateurs | 🟢 Actif | Garder |
| DISCIPLINES | Admin Leçons + Élève | 🟢 Actif | Garder |
| THEMES | Admin Leçons + Élève | 🟢 Actif | Garder |
| CHAPITRES | Tout le système | 🟢 Actif | Garder |
| SUPPORTS_CHAPITRE | Admin Leçons + Élève | 🟢 Actif | Garder |

---

### 🟢 2. PARAMÈTRES & CONFIGURATION (4 sheets)
**Utilité:** Configuration globale du site

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| PARAMETRES | Admin Paramètres | 🟢 Actif | Garder - config générale |
| CONFIG_MENU | Admin Paramètres | 🟢 Actif | Garder - visibilité menus |
| AGENDAS | Élève Emploi du temps | 🟢 Actif | Garder - calendriers |
| BEX_CONFIG | Admin Méthodologie | 🟡 Legacy | Dépublier si inutilisé |

---

### 🟢 3. RESSOURCES PÉDAGOGIQUES (4 sheets)
**Utilité:** Bibliothèques de contenu enrichi

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| VIDEOS | Admin Vidéos + Élève | 🟢 Actif | Garder |
| RECOMMANDATIONS | Admin Reco + Élève | 🟢 Actif | Garder |
| CATEGORIES_FAQ | Admin FAQ + Élève | 🟢 Actif | Garder |
| QUESTIONS_FAQ | Admin FAQ + Élève | 🟢 Actif | Garder |

---

### 🟠 4. MÉTHODOLOGIE (6 sheets)
**Utilité:** Structuration pédagogique et progression

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| METHODOLOGIE | Admin Méthodologie + Élève | 🟢 Actif | Garder - système actuel |
| PROGRESSION_METHODOLOGIE | Admin + Élève Méthodologie | 🟢 Actif | Garder |
| PROGRESSION_LECONS | Élève Leçons | 🟢 Actif | Garder |
| METHODOLOGIE_CATEGORIES | (Ancien système) | 🟡 Legacy | ⚠️ À dépublier |
| METHODOLOGIE_COMPETENCES | (Ancien système) | 🟡 Legacy | ⚠️ À dépublier |
| METHODOLOGIE_ETAPES | (Ancien système) | 🟡 Legacy | ⚠️ À dépublier |

**Note:** Les 3 anciennes tables (`METHODOLOGIE_*`) sont conservées par compatibilité mais remplacées par METHODOLOGIE. À supprimer une fois la migration complète.

---

### 🟡 5. ENTRAÎNEMENTS CONNAISSANCES - ANCIEN SYSTÈME (5 sheets)
**Utilité:** Ancien système (dépublié, à dépublier totalement)

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| FORMATS | Admin Entraînements | 🟡 Legacy | ⚠️ À dépublier |
| QUESTIONS | Admin + Admin Éléments | 🟡 Legacy | ⚠️ À dépublier |
| ENTRAINEMENTS | Admin + Élève | 🟡 Legacy | ⚠️ À dépublier |
| ENTRAINEMENT_QUESTIONS | Admin | 🟡 Legacy | ⚠️ À dépublier |
| RESULTATS_ENTRAINEMENT | Élève (legacy) | 🟡 Legacy | ⚠️ À dépublier |

**Note:** Remplacé par le système `_CONN` ci-dessous. Ces sheets peuvent être archivés/supprimés.

---

### 🟢 6. BANQUES EXERCICES & FORMATS (4 sheets)
**Utilité:** Exercices savoir-faire (système actif et bien utilisé)

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| BANQUES_EXERCICES | Admin Banques + Élève | 🟢 Actif | Garder |
| FORMATS_EXERCICES | Admin Banques | 🟢 Actif | Garder |
| EXERCICES | Admin + Élève Exercices | 🟢 Actif | Garder |
| RESULTATS_EXERCICES | Élève Exercices | 🟢 Actif | Garder |

---

### 🔴⚠️ 7. ENTRAÎNEMENTS CONNAISSANCES - NOUVEAU SYSTÈME (7 sheets)
**Utilité:** Système actif - **ATTENTION : BUGS CONNUS**

| Sheet | Module | État | Problème |
|-------|--------|------|----------|
| BANQUES_QUESTIONS | Admin + Admin Banques | 🟢 Actif | OK |
| QUESTIONS_CONNAISSANCES | Admin + Élève | 🟢 Actif | ⚠️ **Vérifier format association** |
| BANQUES_EXERCICES_CONN | Admin + Élève | 🟢 Actif | OK |
| ENTRAINEMENTS_CONN | Admin + Élève | 🟢 Actif | ⚠️ **Bug association détecté** |
| ETAPES_CONN | Admin + Élève | 🟢 Actif | ⚠️ **Vérifier reset compteur** |
| ETAPE_QUESTIONS_CONN | Admin + Élève | 🟢 Actif | OK |
| FORMATS_QUESTIONS | Admin + Élève | 🟢 Actif | ⚠️ **Correction display** |

**⚠️ BUGS CONNUS À CORRIGER:**
1. **Association format:** Quand l'élève change d'avis (select/deselect répétés), le compteur `associationPairCounter` ne se réinitialise pas → scoring incorrect (2/4 au lieu de 1/4)
2. **Reset état:** L'état du DOM peut se désynchroniser avec `associationPairs`
3. **Affichage corrections:** Les corrections d'association ne s'affichent pas correctement

**Fichiers concernés:**
- `/js/eleve-connaissances.js` (lignes ~1760-1854, ~2675-2765)
- `/admin/admin-banques-exercices.js` (vérifier structure données créée)

---

### 🟢 8. MÉMORISATION & HISTORIQUE (2 sheets)
**Utilité:** Suivi progression et statistiques

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| PROGRESSION_MEMORISATION | Élève Exercices/Connaissances | 🟢 Actif | Garder |
| HISTORIQUE_PRATIQUES_SF | Élève Exercices | 🟢 Actif | Garder |

---

### 🟢 9. ÉVALUATIONS (3 sheets)
**Utilité:** Contrôles, DS, examens

| Sheet | Module | État | Action |
|-------|--------|------|--------|
| EVALUATIONS | Admin + Élève Évaluations | 🟢 Actif | Garder |
| EVALUATION_QUESTIONS | Admin Évaluations | 🟢 Actif | Garder |
| EVALUATION_RESULTATS | Admin + Élève | 🟢 Actif | Garder |

---

## 📊 RÉSUMÉ CONSOLIDÉ

### Par État
- **🟢 ACTIFS:** 34 sheets (à garder, bien utilisés)
- **🟡 LEGACY:** 10 sheets (remplacés, à dépublier progressivement)
- **🔴 À CORRIGER:** 3-4 sheets dans le système `_CONN` (bugs association)
- **⚫ ORPHELINS:** 0 sheet (tous utilisés)

### Par Module Métier
| Module | Sheets | État |
|--------|--------|------|
| **Admin Leçons** | DISCIPLINES, THEMES, CHAPITRES, SUPPORTS_CHAPITRE | 🟢 OK |
| **Admin Utilisateurs** | UTILISATEURS, CLASSES, GROUPES | 🟢 OK |
| **Admin Entraînements (LEGACY)** | FORMATS, QUESTIONS, ENTRAINEMENTS, ENTRAINEMENT_QUESTIONS | 🟡 Legacy |
| **Admin Banques Exercices** | BANQUES_EXERCICES, FORMATS_EXERCICES, EXERCICES | 🟢 OK |
| **Admin Entraînements (NOUVEAU)** | QUESTIONS_CONNAISSANCES, ETAPES_CONN, ETAPE_QUESTIONS_CONN | 🔴 **À CORRIGER** |
| **Admin Méthodologie** | METHODOLOGIE, PROGRESSION_METHODOLOGIE | 🟢 OK |
| **Admin Paramètres** | PARAMETRES, CONFIG_MENU | 🟢 OK |
| **Admin FAQ** | CATEGORIES_FAQ, QUESTIONS_FAQ | 🟢 OK |
| **Admin Évaluations** | EVALUATIONS, EVALUATION_QUESTIONS, EVALUATION_RESULTATS | 🟢 OK |
| **Élève (tous)** | Tous utilisés sauf legacy | 🟢✅ Ou 🔴⚠️ |

---

## 🎯 ACTIONS RECOMMANDÉES

### Phase 1 : IMMÉDIAT (Coloration & Documentation)
- [ ] Colorier les sheets dans Google Sheets selon le code couleur
- [ ] Ajouter une première ligne de documentation dans chaque onglet

### Phase 2 : COURT TERME (Bugs Connus)
**PRIORITAIRE:** Fixer les bugs du système `_CONN` (association)
- [ ] Reset `associationPairCounter` dans `nextEtape()` → `eleve-connaissances.js`
- [ ] Ajouter defensive checks dans `unpairAssociationItem()`
- [ ] Valider cohérence état association

**Voir:** `/home/user/Brikks/BUG_ASSOCIATION_CHANGEMENTS_AVIS.md`

### Phase 3 : MOYEN TERME (Data Pipeline)
- [ ] Audit du wizard (comment crée-t-il les données?)
- [ ] Ajouter validation des données avant écriture Google Sheets
- [ ] Documenter structure attendue pour chaque format

### Phase 4 : LONG TERME (Dépublication Legacy)
- [ ] Mesurer usage réel des sheets legacy
- [ ] Créer calendrier de dépublication
- [ ] Migrer les données historiques (si besoin)
- [ ] Supprimer sheets: `FORMATS`, `QUESTIONS`, `ENTRAINEMENTS`, `ENTRAINEMENT_QUESTIONS`, `RESULTATS_ENTRAINEMENT`, `METHODOLOGIE_CATEGORIES`, `METHODOLOGIE_COMPETENCES`, `METHODOLOGIE_ETAPES`

---

## 🔗 Dépendances Globales

```
UTILISATEURS (hub central)
  ├── CLASSES, GROUPES
  ├── RESULTATS_ENTRAINEMENT, RESULTATS_EXERCICES, EVALUATION_RESULTATS
  ├── PROGRESSION_MEMORISATION, PROGRESSION_METHODOLOGIE, PROGRESSION_LECONS
  └── HISTORIQUE_PRATIQUES_SF

DISCIPLINES
  ├── THEMES
  │   ├── CHAPITRES
  │   │   ├── SUPPORTS_CHAPITRE
  │   │   ├── METHODOLOGIE (optionnel)
  │   │   └── EVALUATIONS
  │   └── VIDEOS, RECOMMANDATIONS

ENTRAINEMENTS_CONN (nouveau système)
  ├── BANQUES_EXERCICES_CONN
  ├── ETAPES_CONN
  │   └── ETAPE_QUESTIONS_CONN
  │       └── QUESTIONS_CONNAISSANCES
  │           └── BANQUES_QUESTIONS
  └── PROGRESSION_MEMORISATION

METHODOLOGIE (nouveau)
  ├── BEX_CONFIG (optionnel)
  ├── PROGRESSION_METHODOLOGIE
  └── PROGRESSION_LECONS

EVALUATIONS
  ├── EVALUATION_QUESTIONS
  │   └── QUESTIONS (legacy) ou QUESTIONS_CONNAISSANCES (nouveau)
  └── EVALUATION_RESULTATS
```

---

## 📝 Notes Techniques

**Structure Importante:**
- Colonne `donnees` contient JSON encodé dans la plupart des sheets
- Attention au double-encoding (JSON stringifié puis stringifié à nouveau)
- Wizard crée les données → vérifier sa cohérence

**Formules à éviter:**
- Pas de formule Google Sheets directement sur la colonne `donnees` (casse le JSON)
- Les formules doivent être dans des colonnes séparées

**Performance:**
- HISTORIQUE_PRATIQUES_SF peut croître rapidement (log détaillé)
- PROGRESSION_MEMORISATION grandit avec chaque interaction
- Archiver régulièrement les données anciennes (> 1 an)

---

## 🖍️ Comment Colorier dans Google Sheets

1. **Sélectionner un onglet entier**
2. **Clic droit** → Propriétés de la feuille
3. **Onglet Couleur**
4. Choisir la couleur selon le code:
   - 🟢 **Vert clair** = Actif
   - 🟡 **Orange** = Legacy
   - 🔴 **Rouge clair** = À corriger
   - ⚫ **Gris** = Orphelin

**Couleurs suggérées dans Google Sheets:**
- Vert: `#C6E0B4` ou `#92D050`
- Orange: `#FFC000` ou `#FCE4D6`
- Rouge: `#FF0000` ou `#F8CBAD`

---

**Généré:** 2026-02-08 | Version 1.0
