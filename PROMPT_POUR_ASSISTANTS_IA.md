# 🤖 PROMPT POUR ASSISTANTS IA - Brikks Platform

**Dernière mise à jour:** 17 février 2026
**Pour:** Claude Code et autres assistants IA travaillant sur ce projet

---

## 📌 CONTEXTE PROJET

**Brikks** est une **plateforme éducative française** pour l'apprentissage du français, de l'histoire, de la géographie et de l'EMC.

- **Ancienne nom:** Espace cours • Mme Meyer
- **Public cible:** Élèves de collège/lycée
- **Langues:** Français
- **Déploiement:** GitHub Pages (statique)

---

## 🏗️ ARCHITECTURE GÉNÉRALE

### Stack Technique

```
Frontend:          HTML5 + CSS3 + JavaScript (Vanilla - NO frameworks)
Backend:           Google Sheets API v4 (source de données)
Auth:              Session storage + Google Sheets
Hosting:           GitHub Pages (statique)
Données:           Google Sheets (source unique de vérité)
```

### Pourquoi pas de framework?
- Plateforme **simple et légère**
- Déploiement **sans build process** (GitHub Pages)
- Moins de dépendances = meilleure maintenabilité
- Performance acceptable pour le public cible

---

## 📁 STRUCTURE DES FICHIERS

### Root Level
```
Brikks/
├── index.html                    # Page d'accueil / login
├── exercice-preview.html         # Preview exercices
├── admin/
│   └── index.html               # Dashboard professeur
├── eleve/
│   └── index.html               # Dashboard élève
├── components/                   # HTML réutilisables
├── css/
│   └── style.css                # Styles globaux
└── js/                          # JavaScript (GROS VOLUME)
```

### JavaScript - Structure

**Les fichiers JS sont ÉNORMES (100-350KB)** → Monolithiques, pas modulaires

#### 🎯 FICHIERS CLÉS PAR RÔLE

**Admin (14 fichiers):**
```
admin-banques-exercices.js      (7482 lignes)  ← Gestion des banques
admin-banques-questions.js       (999 lignes)
admin-competences.js             (420 lignes)
admin-elements.js                (1081 lignes)
admin-entrainements.js           (1260 lignes)
admin-evaluations.js             (679 lignes)
admin-faq.js                      (979 lignes)
admin-lecons.js                  (1001 lignes)
admin-methodologie.js             (942 lignes)
admin-parametres.js               (813 lignes)
admin-recommandations.js          (698 lignes)
admin-suivi.js                    (861 lignes)
admin-utilisateurs.js            (1083 lignes)
admin-videos.js                   (795 lignes)
```

**Élève (14 fichiers):**
```
eleve-accueil.js                 (355 lignes)
eleve-chapitre.js                (750 lignes)
eleve-classeur.js                (163 lignes)
eleve-connaissances.js          (5137 lignes)  ← Module FORMATIONS
eleve-entrainement.js            (2617 lignes)  ← Module ENTRAÎNEMENT
eleve-evaluation.js              (1493 lignes)
eleve-evaluations.js              (270 lignes)
eleve-exercices.js               (4596 lignes)
eleve-lecons.js                   (425 lignes)
eleve-methodologie.js             (477 lignes)
eleve-methodologie-parcours.js    (912 lignes)
eleve-recommandations.js          (568 lignes)
eleve-videos.js                   (422 lignes)
```

**Core:**
```
app.js                            (111 lignes)   # Routing principal
auth.js                           (182 lignes)   # Authentification
config.js                         (89 lignes)    # Configuration API
sheets.js                         (137 lignes)   # Google Sheets API wrapper
logger.js                          (22 lignes)   # Simple logging
```

**Total:** ~38,000 lignes de JavaScript

---

## 🎓 MODULES PRINCIPAUX

### 1️⃣ MODULE DE FORMATIONS (Connaissances)
**Fichier:** `js/eleve-connaissances.js` (5,137 lignes)

**Fonction:** Affichage de leçons structurées, évaluations formatives, feedback interactif

**Format questions supportées:**
- ✓ Vrai/Faux (simple + multiple)
- ✓ QCM (simple choix)
- ✓ Texte à trous
- ✓ Chronologie (frise temporelle)
- ✓ Association (grid + chips)
- ✓ Carte (image cliquable)
- ✓ Questions ouvertes

**Classes principales:**
```javascript
class EleveConnaissances {
    // Initialisation + rendu
    initialize()
    renderEtape()

    // Validation selon format
    validateCurrentEtape()
    validateMultiFormatQuestion()
    runFormatValidation(format, qData)

    // Feedback affiché
    displayUnifiedFeedback(elementId, isCorrect, text, score, maxScore)

    // Format-spécifique
    runAssociationValidation(qData)
    runCarteValidation(qData)
    runTimelineValidation(qData)
    runTexteValidation(qData)
    runChronoValidation(qData)
}
```

**Étapes clés dans le code:**
```
1. Ligne ~2450  → displayUnifiedFeedback() - affichage score
2. Ligne ~2488  → validateCurrentEtape() - validation principale
3. Ligne ~3777  → validateMultiFormatQuestion() - validation carrousel
4. Ligne ~3896  → runFormatValidation() - dispatch selon format
5. Ligne ~4033  → runAssociationValidation() - validation associations
6. Ligne ~4118  → runCarteValidation() - validation carte
```

### 2️⃣ MODULE D'ENTRAÎNEMENT
**Fichier:** `js/eleve-entrainement.js` (2,617 lignes)

**Fonction:** Exercices d'entraînement (non notés) pour consolider les acquis

**Similaire au module connaissances** mais sans notation suivie

### 3️⃣ MODULE D'ÉVALUATION
**Fichier:** `js/eleve-evaluation.js` (1,493 lignes)

**Fonction:** Évaluations sommatives (notées), suivi des résultats

---

## 🔌 API & DONNÉES

### Google Sheets Structure

**Source unique de vérité:** Google Sheets avec API v4

**Configuration:**
- Fichier: `js/config.js` (89 lignes)
- Clé API Google: À configurer
- Sheet ID: À ajouter dans config.js
- Onglets principaux:
  - `UTILISATEURS` (identifiants)
  - `LEÇONS` / `COURS` (contenu)
  - `QUESTIONS` (banque questions)
  - `EXERCICES` (exercices)
  - etc.

### Accès API
```javascript
// Dans sheets.js (137 lignes)
async function fetchSheetData(range) {
    // Appel Google Sheets API v4
}

// Utilisation dans les modules
const data = await EleveConnaissances.fetchEtapeData(id);
```

---

## 🔐 AUTHENTIFICATION

**Fichier:** `js/auth.js` (182 lignes)

**Flux:**
1. Utilisateur rentre identifiant + mot de passe (index.html)
2. Vérification contre Google Sheets
3. Créer session (sessionStorage)
4. Redirection selon rôle:
   - `prof` → `/admin/`
   - `eleve` → `/eleve/`

**Rôles:**
- `prof`: Accès admin complet
- `eleve`: Accès exercices/entraînement seulement

---

## 🎨 CONVENTIONS DE CODE

### Nommage
```javascript
// Classes Pascal Case (même si pas vraiment des classes)
class EleveConnaissances { }

// Méthodes camelCase
validateCurrentEtape() { }

// IDs HTML kebab-case
id="multiFormatContent"
id="exerciseContent"

// CSS classes kebab-case
class="feedback-header"
class="card-incorrect"
```

### Patterns
```javascript
// 1. Initialisation objet singleton
const EleveConnaissances = {
    initialize() { ... },
    validate() { ... },
    // ...
}

// 2. Données stockées en this.___
this.userAnswers = {}
this.currentEtapeIndex = 0

// 3. Rendu via innerHTML
element.innerHTML = `...${data}...`;

// 4. Gestion événements inline
onclick="EleveConnaissances.validate()"
```

### State Management (Simple)
```javascript
// État global dans la classe
this._multiFormatState = {
    currentIndex: 0,
    format: 'association',
    questions: [],
    results: {}
}

// Pas de Vuex, Redux, etc. (trop lourd)
```

---

## 🚀 COMMON TASKS & SOLUTIONS

### ❌ AJOUTER UNE FONCTIONNALITÉ
1. Lire le module concerné (ex: `eleve-connaissances.js`)
2. Trouver la méthode principale (`validateCurrentEtape`, etc.)
3. Ajouter la logique
4. Tester dans navigateur
5. Commit et push

### ❌ DÉBOGUER UN PROBLÈME
1. **Ouvrir DevTools (F12)** dans navigateur
2. Chercher `console.error` ou messages d'erreur
3. Chercher dans le code JS la zone problématique
4. Ajouter des `console.log()` pour tracer l'exécution
5. Vérifier les données Google Sheets

### ❌ TESTER UNE MODIFICATION
1. Créer branche locale (`git checkout -b claude/...`)
2. Modifier le code
3. Ouvrir `eleve/index.html` dans navigateur local
4. Tester la feature
5. Vérifier console pour erreurs
6. Commit + push

### ❌ MODIFIER LE STYLE
```
Fichier: /css/style.css

Classes utilisées par module connaissances:
- .feedback-header          # Feedback message
- .feedback-icon            # ✓ ou ✗
- .feedback-score-line      # Score
- .card-correct / .card-incorrect
- .association-grid-card
- .association-chip
- etc.
```

---

## 📊 FEEDBACK SYSTEM (Important!)

### Affichage du Feedback

**Fonction principale:**
```javascript
displayUnifiedFeedback(elementId, isCorrect, feedbackText, score, maxScore, format = null)
// Ligne ~2450 dans eleve-connaissances.js
```

**Génère HTML:**
```html
<div class="question-feedback correct/incorrect">
    <div class="feedback-header">
        <span class="feedback-icon">✓</span>
        <span class="feedback-message">Correct</span>
    </div>
    <div class="feedback-score-line">
        <span class="score-label">Score:</span>
        <span class="score-value">1/1 point</span>
    </div>
</div>
```

### Personnalisation par format
```javascript
// Dans runFormatValidation(format, qData) - ligne ~3896
switch (format) {
    case 'vrai_faux':
        return this.runTexteValidation(qData);
    case 'association':
        return this.runAssociationValidation(qData);  // ← Ici on peut modifier
    case 'carte':
        return this.runCarteValidation(qData);
    // etc.
}
```

---

## ⚠️ PIÈGES COURANTS

### ❌ Pièges #1: Les fichiers JS sont ÉNORMES
- Pas de bundling/minification
- Pas de modules (import/export ES6)
- Tout est chargé dans le scope global
- **Solution:** Utiliser Ctrl+F pour chercher

### ❌ Pièges #2: State management basique
- Pas de store centralisé
- Données dispersées dans `this.___`
- Difficile de tracer d'où vient une variable
- **Solution:** Vérifier le `initialize()` de la classe

### ❌ Pièges #3: API Sheets non documentée
- Pas de schéma fixe
- Colonnes peuvent varier
- **Solution:** Vérifier les appels dans `sheets.js`

### ❌ Pièges #4: HTML via innerHTML
- Risque XSS si données non échappées
- **Solution:** Toujours utiliser `escapeHtml()`
```javascript
// ✅ Bon
label.innerHTML = `<span>${this.escapeHtml(text)}</span>`;

// ❌ Mauvais
label.innerHTML = `<span>${userInput}</span>`;
```

### ❌ Pièges #5: sessionStorage vs localStorage
- sessionStorage = perdues au fermeture du navigateur
- localStorage = persistant
- Utilisé pour auth + état utilisateur
- **Solution:** Toujours vérifier quelle variable où

---

## 🔗 PARCOURIR LE CODE EFFICACEMENT

### Utiliser Grep (TRÈS IMPORTANT)
```bash
# Chercher une fonction
grep -n "validateMultiFormatQuestion" js/eleve-connaissances.js

# Chercher une classe
grep -n "class EleveConnaissances" js/*.js

# Chercher un ID HTML
grep -n "multiFormatContent" js/*.js

# Chercher un appel de fonction
grep -rn "displayUnifiedFeedback" js/
```

### Vérifier où une fonction est APPELÉE
```bash
# Ligne 2450: displayUnifiedFeedback est DÉFINIE
# Où est-elle APPELÉE?
grep -n "this.displayUnifiedFeedback\|displayUnifiedFeedback(" js/*.js
```

### Sauter à une ligne dans l'éditeur
```bash
# Plupart éditeurs: Ctrl+G "ligne:colonne"
# VS Code: Ctrl+G → taper "2450"
```

---

## 📚 DOCUMENTATION ADDITIONNELLE

**Fichiers importants dans le repo:**
- `00_COMMENCER_ICI.md` - Guide rapide
- `README.md` - Vue générale
- `ARCHITECTURE_ANALYSIS.md` - Analyse détaillée
- `CODE_LOCATIONS_MAP.md` - Localisation du code

**Pour le module Connaissances spécifiquement:**
- `GUIDE_IMPLEMENTATION_UX.md` - Implementation guide
- `PROPOSITIONS_UX_IMPROVEMENTS.md` - Améliorations UX
- `DEMO_SCORE_DESIGNS.html` - Démo des designs

---

## ✅ CHECKLIST - AVANT DE COMMENCER

- [ ] J'ai compris que c'est **Vanilla JS** (pas de framework)
- [ ] Je sais que les données viennent de **Google Sheets**
- [ ] Je connais la différence entre **Connaissances** et **Entraînement**
- [ ] Je sais que l'auth est simple (**sessionStorage**)
- [ ] Je comprends que les fichiers JS sont **ÉNORMES** (utiliser Grep)
- [ ] Je sais que le feedback principal est dans **displayUnifiedFeedback()**
- [ ] Je vais toujours utiliser **escapeHtml()** pour éviter XSS
- [ ] Je vais tester dans le **navigateur local** avant de push

---

## 🆘 BESOIN D'AIDE?

### Questions courantes

**Q: Par où commencer à lire le code?**
```
R: Commencer par initialize() de la classe du module
   → Puis les méthodes principales (validate, render, etc.)
   → Puis les details (helpers, css, etc.)
```

**Q: Comment déboguer rapidement?**
```
R: 1. Ouvrir DevTools (F12)
   2. Ajouter console.log() aux points clés
   3. Relancer la page (F5)
   4. Lire les logs + erreurs
```

**Q: Où trouver le code pour [feature XYZ]?**
```
R: 1. Utiliser Ctrl+F ou grep
   2. Chercher le nom de la feature
   3. Chercher les IDs HTML associés
   4. Suivre les appels de fonctions
```

**Q: Puis-je tester en local sans déployer?**
```
R: Oui! Ouvrir eleve/index.html dans navigateur
   Attention: Certaines fonctionnalités need Google Sheets API
```

---

## 🎯 RÉSUMÉ ULTIME

**Brikks = Plateforme éducative vanille JS + Google Sheets**

```
Avant de coder:
1. ✅ Lire ce prompt
2. ✅ Chercher le bon fichier (grep ou Ctrl+F)
3. ✅ Comprendre la structure (initialize → validate → display)
4. ✅ Écrire du code (avec escapeHtml()!)
5. ✅ Tester en local (DevTools)
6. ✅ Commit + push + PR

Questions? Voir la section "BESOIN D'AIDE?"
```

---

**Happy coding! 🚀**

*Créé avec 💙 pour rendre le code accessible aux assistants IA*
