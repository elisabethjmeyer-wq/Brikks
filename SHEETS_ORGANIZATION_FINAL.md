# 📊 Organisation des Onglets Google Sheets - Brikks (RÉEL)

Document basé sur les **36 onglets réels** du Google Sheet "Espace cours_backend"

---

## 🎨 CODE COULEUR RECOMMANDÉ

| Couleur | Signification | Nombre |
|---------|---------------|---------|
| 🟢 Vert | Sheets **ACTIFS** (à garder, en bon état) | 31 |
| 🟡 Orange | Sheets **À DOCUMENTER** (nouveaux, pas dans le code, à vérifier) | 5 |
| 🔴 Rouge | Sheets **À CORRIGER** (bugs connus, données mal formées) | 0 |

---

## 📋 LES 36 ONGLETS - DÉTAIL COMPLET

### 🟢 1. INFRASTRUCTURE & BASE (7 onglets)
**Utilité:** Fondation du système - ne pas toucher

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| UTILISATEURS | Gestion des comptes (élèves, profs, admins) | 🟢 Actif | Vert |
| CLASSES | Gestion des classes scolaires | 🟢 Actif | Vert |
| GROUPES | Gestion des groupes au sein des classes | 🟢 Actif | Vert |
| DISCIPLINES | Matières principales (Math, SVT, etc.) | 🟢 Actif | Vert |
| THEMES | Groupes de chapitres par discipline | 🟢 Actif | Vert |
| CHAPITRES | Unités de contenu pédagogique | 🟢 Actif | Vert |
| SUPPORTS_CHAPITRE | Fichiers, vidéos, liens associés aux chapitres | 🟢 Actif | Vert |

---

### 🟢 2. PARAMÈTRES & CONFIGURATION (3 onglets)
**Utilité:** Configuration globale du site

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| PARAMETRES | Configuration générale (titre, logo, seuils) | 🟢 Actif | Vert |
| CONFIG_MENU | Visibilité/ordre des menus élève | 🟢 Actif | Vert |
| AGENDAS | Calendriers et plannings d'enseignement | 🟢 Actif | Vert |

---

### 🟢 3. RESSOURCES PÉDAGOGIQUES (4 onglets)
**Utilité:** Bibliothèques de contenu enrichi

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| VIDEOS | Bibliothèque de vidéos pédagogiques | 🟢 Actif | Vert |
| RECOMMANDATIONS | Ressources externes recommandées | 🟢 Actif | Vert |
| CATEGORIES_FAQ | Catégorisation des FAQ | 🟢 Actif | Vert |
| QUESTIONS_FAQ | Contenu des questions/réponses FAQ | 🟢 Actif | Vert |

---

### 🟢 4. MÉTHODOLOGIE (2 onglets)
**Utilité:** Structuration pédagogique et progression

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| METHODOLOGIE | Structure pédagogique unifiée (système actuel) | 🟢 Actif | Vert |
| PROGRESSION_METHODOLOGIE | Suivi des progressions dans méthodologie | 🟢 Actif | Vert |

---

### 🟢 5. PROGRESSION ÉLÈVES (1 onglet)
**Utilité:** Suivi des apprentissages

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| PROGRESSION_LECONS | Suivi des leçons lues par les élèves | 🟢 Actif | Vert |

---

### 🟢 6. ENTRAÎNEMENTS CONNAISSANCES (7 onglets)
**Utilité:** Questions et exercices savoir-faire + entraînements connaissances

| Onglet | Rôle | État | Bugs | Code Couleur |
|--------|------|------|------|---------|
| QUESTIONS_CONNAISSANCES | Questions (QCM, Vrai/Faux, Association, etc.) | 🟢 Actif | ⚠️ Format association | Vert |
| BANQUES_QUESTIONS | Banques de questions | 🟢 Actif | OK | Vert |
| FORMATS_QUESTIONS | Types de formats pour le système connaissances | 🟢 Actif | OK | Vert |
| ENTRAINEMENTS_CONN | Entraînements (contenant étapes) | 🟢 Actif | ⚠️ Bug association | Vert |
| ETAPES_CONN | Étapes des entraînements | 🟢 Actif | ⚠️ Reset compteur | Vert |
| ETAPE_QUESTIONS_CONN | Sélection des questions pour chaque étape | 🟢 Actif | OK | Vert |
| BANQUES_EXERCICES_CONN | Banques d'exercices (nouveau système) | 🟢 Actif | OK | Vert |

**⚠️ BUGS CONNUS (système _CONN):**
1. Format **association**: Scoring incorrect (2/4 au lieu de 1/4) quand élève change d'avis
2. **associationPairCounter** ne se réinitialise pas entre questions
3. **DOM/état** peuvent se désynchroniser

---

### 🟢 7. EXERCICES SAVOIR-FAIRE (4 onglets)
**Utilité:** Exercices pratiques (système stable et bien utilisé)

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| BANQUES_EXERCICES | Groupes d'exercices | 🟢 Actif | Vert |
| FORMATS_EXERCICES | Types d'exercices (QCM, Texte à trous, etc.) | 🟢 Actif | Vert |
| EXERCICES | Exercices individuels (énoncé, réponses) | 🟢 Actif | Vert |
| RESULTATS_EXERCICES | Résultats et progression des élèves | 🟢 Actif | Vert |

---

### 🟢 8. MÉMORISATION & HISTORIQUE (2 onglets)
**Utilité:** Suivi progression et statistiques

| Onglet | Rôle | État | Code Couleur |
|--------|------|------|---------|
| PROGRESSION_MEMORISATION | Système répétition espacée (spaced repetition) | 🟢 Actif | Vert |
| HISTORIQUE_PRATIQUES_SF | Log détaillé des pratiques savoir-faire | 🟢 Actif | Vert |

---

### 🟡 9. NOUVEAUX ONGLETS (à documenter) (5 onglets)
**Utilité:** À clarifier - pas référencés dans Code.gs

| Onglet | Rôle Supposé | État | Code Couleur | Action |
|--------|--------------|------|---------|--------|
| EleveConnexions | Suivi des connexions des élèves | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |
| CompetencesReferentiel | Référentiel de compétences | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |
| CriteresReussite | Critères de réussite | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |
| TachesComplexes | Tâches complexes / projets | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |
| CONVERSATIONS | Messages/conversations élève-prof | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |
| MESSAGES | Messages système | 🟡 À clarifier | Orange | ❓ Vérifier l'utilité |

**⚠️ À INVESTIGUER:** Ces 6 onglets ne sont pas déclarés dans Code.gs. Sont-ils utilisés ? Doivent-ils être archivés ou mieux intégrés ?

---

## 📊 RÉSUMÉ FINAL

### Par État
- **🟢 ACTIFS & BIEN UTILISÉS:** 31 onglets (garder)
- **🟡 À DOCUMENTER/CLARIFIER:** 5 onglets (nouveaux, vérifier utilité)
- **🔴 À CORRIGER:** 0 onglet (bugs seulement dans association format)

### Par Module Métier
| Module | Onglets | État |
|--------|---------|------|
| **Admin Leçons** | DISCIPLINES, THEMES, CHAPITRES, SUPPORTS_CHAPITRE | 🟢 OK |
| **Admin Utilisateurs** | UTILISATEURS, CLASSES, GROUPES | 🟢 OK |
| **Admin Banques Exercices** | BANQUES_EXERCICES, FORMATS_EXERCICES, EXERCICES | 🟢 OK |
| **Admin Entraînements (Nouveau)** | QUESTIONS_CONNAISSANCES, ETAPES_CONN, ETAPE_QUESTIONS_CONN | ⚠️ Bugs |
| **Admin Méthodologie** | METHODOLOGIE, PROGRESSION_METHODOLOGIE | 🟢 OK |
| **Admin Paramètres** | PARAMETRES, CONFIG_MENU | 🟢 OK |
| **Admin FAQ** | CATEGORIES_FAQ, QUESTIONS_FAQ | 🟢 OK |
| **Ressources** | VIDEOS, RECOMMANDATIONS | 🟢 OK |
| **Élève Progression** | PROGRESSION_LECONS, PROGRESSION_MEMORISATION | 🟢 OK |
| **Suivi** | HISTORIQUE_PRATIQUES_SF, RESULTATS_EXERCICES | 🟢 OK |
| **Nouveaux/À clarifier** | EleveConnexions, CompetencesReferentiel, CriteresReussite, TachesComplexes, CONVERSATIONS, MESSAGES | 🟡 ❓ |

---

## 🎯 PRIORITÉS

### Phase 1 : IMMÉDIAT (Coloration)
- [ ] Colorier les 31 onglets **verts** (Vert clair)
- [ ] Colorier les 5 onglets **orange** (Orange)
- [ ] Ajouter une description dans la première ligne de chaque onglet

### Phase 2 : COURT TERME (Clarification)
- [ ] Investiguer les 5 onglets orange : qui les utilise ? Sont-ils essentiels ?
- [ ] Ajouter les onglets manquants à `Code.gs` (synchroniser le backend)

### Phase 3 : MOYEN TERME (Bugs association)
- [ ] Corriger le bug d'association scoring (2/4 au lieu de 1/4)
- [ ] Reset `associationPairCounter` dans `nextEtape()`
- [ ] Ajouter defensive checks dans `unpairAssociationItem()`

### Phase 4 : LONG TERME (Data Pipeline)
- [ ] Audit du wizard (comment crée-t-il les données ?)
- [ ] Ajouter validation avant écriture Google Sheets
- [ ] Documenter structure attendue pour chaque format

---

## 🔗 Onglets à synchroniser dans Code.gs

**Manquent dans Code.gs mais existent dans le Sheet:**
- EleveConnexions
- CompetencesReferentiel
- CriteresReussite
- TachesComplexes
- CONVERSATIONS
- MESSAGES

**Action:** Ajouter ces 6 onglets à la déclaration SHEETS dans Code.gs pour que le backend puisse les utiliser.

---

## 🖍️ Codes Couleurs Google Sheets à appliquer

Pour chaque onglet, faire : **Clic droit** → **Propriétés de la feuille** → **Couleur**

### 🟢 VERT (31 onglets)
Couleur: `#C6E0B4` ou `#92D050`
- Tous les onglets listés sauf les 5 orange

### 🟡 ORANGE (5 onglets)
Couleur: `#FFC000` ou `#FCE4D6`
- EleveConnexions
- CompetencesReferentiel
- CriteresReussite
- TachesComplexes
- CONVERSATIONS / MESSAGES (grouper ensemble)

---

## 📝 Notes Techniques

**Structure Importante:**
- Colonne `donnees` contient JSON encodé
- Attention au double-encoding (JSON stringifié puis stringifié)
- Wizard crée les données → vérifier sa cohérence

**Formules à éviter:**
- Pas de formule Google Sheets sur la colonne `donnees` (casse le JSON)
- Formules dans colonnes séparées seulement

**Performance:**
- HISTORIQUE_PRATIQUES_SF croît rapidement
- PROGRESSION_MEMORISATION grandit avec chaque interaction
- Archiver les données > 1 an régulièrement

---

**Généré:** 2026-02-08 | Version 2.0 (Basé sur vrai Google Sheet)
**Total onglets:** 36 | **Actifs:** 31 | **À clarifier:** 5
