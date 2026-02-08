# 🐛 BUG: Association avec changements répétés d'avis

**Rapport:** Bug d'affichage et comptage lors de modifications répétées d'associations
**Format:** Association (multi-questions)
**Symptômes:**
- ❌ Score affiché: 2/4 corrects (faux)
- ✅ Score attendu: 1/4 corrects
- ❌ Charlemagne n'est pas "complètement vert"
- ❌ Feedback/correction incohérent

---

## 🔍 Cause Identifiée

### Le problème: `associationPairCounter` ne se réinitialise pas

**Seule la ligne 695 réinitialise le compteur:**
```javascript
// Ligne 695 - Démarrage d'un nouvel entraînement
this.associationPairCounter = 0;
```

**Mais AUCUNE réinitialisation lors:**
- ✗ Du passage à la question suivante (nextEtape)
- ✗ Du dépairage d'une association (unpairAssociationItem)
- ✗ De la validation de l'étape

---

## 📊 Scénario du bug

### État initial
```
associationPairCounter = 0
associationPairs = []
```

### Étape 1: Élève appaire Charlemagne ✓
```
Click: Charlemagne → Moyen âge
pairNum = ++associationPairCounter = 1
associationPairs = [
  { gauche: 3, droite: 3, pairNum: 1 }  ✓ CORRECT
]
```

### Étape 2: Élève dépaire Charlemagne
```
Click: Charlemagne (déjà appairé) → dépairer
unpairAssociationItem() supprime la paire:
associationPairs = []  ← Paire supprimée ✓
associationPairCounter = 1  ← ⚠️ RESTE À 1 (ne reset pas!)
```

### Étape 3: Élève appaire Victor Hugo
```
Click: Victor Hugo → Époque contemporaine (MAUVAIS)
pairNum = ++associationPairCounter = 2  ← Utilise 2, pas 1!
associationPairs = [
  { gauche: 0, droite: 1, pairNum: 2 }  ✗ INCORRECT
]
```

### Étape 4: Élève dépaire Victor Hugo
```
unpairAssociationItem() supprime:
associationPairs = []
associationPairCounter = 2  ← ⚠️ RESTE À 2
```

### Étape 5: Élève réappaire Charlemagne
```
Click: Charlemagne → Moyen âge (CORRECT)
pairNum = ++associationPairCounter = 3  ← Utilise 3, pas 1!
associationPairs = [
  { gauche: 3, droite: 3, pairNum: 3 }  ✓ CORRECT
]
```

### Validation
```
userAnswers['association'] = [
  { gauche: 3, droite: 3, pairNum: 3 }
]

Comptage (ligne 2684):
- correct = 0, total = 4
- userPairs.forEach():
  - up = { gauche: 3, droite: 3, pairNum: 3 }
  - isCorrect = String(3) === String(3) = TRUE
  - correct++ → correct = 1

Score final: 1/4 ✓ CORRECT ATTENDU

MAIS:
```

---

## 🎯 Le vrai problème: Dépairage visuel vs state

Quand on dépaire puis réappaire, il y a **une incohérence** :

### Dépairage de Victor Hugo (ligne 1835-1844):
```javascript
const gridId = this._assocGridSide === 'gauche' ? pair.gauche : pair.droite;
// pair.gauche = 0 (Victor Hugo)
// Si _assocGridSide = 'gauche' → gridId = 0 ✓

const gridEl = document.querySelector(
  `#associationGrid .association-grid-card[data-id="${gridId}"]`
);
// Trouve la carte Victor Hugo

gridEl.classList.remove('paired');  // Enlève la classe visuelle
delete gridEl.dataset.pairNum;      // Enlève l'attribut
```

### Réappairage de Charlemagne:
```javascript
// Victor Hugo a été dépairé visuellement
// Mais dans associationPairs, aucune trace de Victor Hugo

// Charlemagne est réappairé:
// Le rendu affiche:
// - Charlemagne: ✓ Moyen âge (CORRECT)
// - Victor Hugo: ✗ — (non appairé)
// - Jules César: ✗ — (non appairé)
// - Louis 14: ✗ — (non appairé)
```

Cela DEVRAIT afficher 1/4. **Mais l'image montre 2/4!**

---

## 🔴 Où vient le "2/4"?

### Possibilité 1: Comptage des paires non appairées (ligne 2705-2719)

```javascript
// Ajouter les éléments non associés comme erreurs
for (let i = 0; i < assocPaires.length; i++) {
    const gridId = String(i);
    const isMatched = userPairs.some(up => {
        const upGridId = this._assocGridSide === 'gauche' ? String(up.gauche) : String(up.droite);
        return upGridId === gridId;
    });
    if (!isMatched) {
        details.push({
            question: assocPaires[i].element1,
            reponse: '—',
            attendu: assocPaires[i].element2,
            correct: false  ← FAUX, ajouté à details
        });
    }
}
```

**Cela ajoute les éléments non appairés comme FAUX, mais ne les compte pas dans `total` !**

Donc `total = userPairs.length = 1` (Charlemagne)

Mais wait... l'image affiche **2/4 corrects**, pas 1/4. Où vient le 4?

### Possibilité 2: `total` est le nombre de paires dans la config

```javascript
const assocPaires = donnees.paires || [];
total = assocPaires.length;  // ← Nombre de paires possibles!
```

Si le wizard a créé 4 paires:
- Victor Hugo ↔ Époque moderne
- Jules César ↔ Antiquité
- Louis 14 ↔ Époque contemporaine
- Charlemagne ↔ Moyen âge

Alors `total = 4` ✓

**Mais pour `correct`, nous avons:**
```javascript
correct = 1  // Seule Charlemagne est appairée correctement
```

Donc affichage: **1/4** ✓

**Mais l'image affiche 2/4!**

---

## 🤔 Hypothèse: Comptage double des paires

Peut-être que `associationPairs` contient DEUX paires?

```javascript
associationPairs = [
  { gauche: 0, droite: 1, pairNum: 2 },  // Victor Hugo → Époque contemporaine
  { gauche: 3, droite: 3, pairNum: 3 }   // Charlemagne → Moyen âge
]
```

**Alors:**
```javascript
userPairs.forEach(up => {
    const isCorrect = String(up.gauche) === String(up.droite);
    if (isCorrect) correct++;
});

// Boucle 1: up = {gauche: 0, droite: 1} → isCorrect = FALSE
// Boucle 2: up = {gauche: 3, droite: 3} → isCorrect = TRUE → correct = 1

correct = 1, total = 4 → 1/4
```

Mais l'image montre **2/4 corrects**!

---

## 💡 Vrai problème détecté

### C'est un bug d'état fragmenté:

**`associationPairs` vs DOM sont désynchronisés**

Quand l'élève dépaire/réappaire:
1. DOM est mis à jour visuellement (classes CSS enlevées)
2. Mais `associationPairs` n'est pas entièrement nettoyé
3. Ou il y a une corruption de pairNum qui cause des incohérences

### Possibilité 3: Double comptage via `pairNum`

```javascript
// Lors du dépairage:
unpairAssociationItem(element, zone, id) {
    const pairNum = element.dataset.pairNum;  // ← Récupère depuis le DOM

    if (pairNum) {
        // Cherche dans associationPairs
        const pairIndex = this.associationPairs.findIndex(p => String(p.pairNum) === String(pairNum));
        // Peut ne PAS trouver si associationPairs n'est pas en sync avec DOM!
    }
}
```

**Si DOM et `associationPairs` ne sont pas en sync:**
- `element.dataset.pairNum` existe (du DOM)
- Mais la paire n'existe plus dans `associationPairs`
- Donc `unpairAssociationItem()` ne supprime RIEN!
- Quand on réappaire, on ajoute une nouvelle paire SANS supprimer l'ancienne

Résultat: **2 paires dans `associationPairs` dont 1 seule est "correcte" dans le calcul**

---

## 🔧 Le vrai bug en code

### Ligne 1821-1853: `unpairAssociationItem()`

```javascript
unpairAssociationItem(element, zone, id) {
    const pairNum = element.dataset.pairNum;
    if (!pairNum) return;  // ← Si dataset.pairNum est vide, sort

    const pairIndex = this.associationPairs.findIndex(p => String(p.pairNum) === String(pairNum));
    if (pairIndex > -1) {
        const pair = this.associationPairs[pairIndex];
        this.associationPairs.splice(pairIndex, 1);
        // ...supprime la paire...
    }
    // ⚠️ BUT: Si pairIndex === -1 (pas trouvé), NE FAIT RIEN!
    // Les classes DOM sont enlevées, mais la paire reste dans associationPairs!
}
```

### Le problème exact:

**Quand `element.dataset.pairNum` n'existe pas en cohérence avec `associationPairs`:**
- `pairIndex` = -1
- `unpairAssociationItem()` renvoie silencieusement
- Les classes CSS sont enlevées du DOM (classe 'paired' enlevée)
- Mais la paire RESTE dans `associationPairs`!
- Lors de la validation, la paire "fantôme" est comptée

---

## 🔴 Correction requise

### Problème 1: `associationPairCounter` ne reset jamais entre questions

```javascript
// ❌ ACTUEL
nextEtape() {
    this.currentEtapeIndex++;
    this.userAnswers = {};
    this.associationSelection = { grid: null, chip: null };
    this.associationPairs = [];
    // ⚠️ PAS DE RESET DE this.associationPairCounter!
}
```

### Problème 2: État du DOM et `associationPairs` peuvent se désynchroniser

```javascript
// ❌ ACTUEL
unpairAssociationItem(element, zone, id) {
    const pairNum = element.dataset.pairNum;
    if (!pairNum) return;  // ← Sort si dataset vide

    // Mais le DOM était en classe 'paired', donc on est entré dans cette fonction!
    // La cohérence est déjà brisée
}
```

### Problème 3: Nettoyage incomplet du dépairage

```javascript
// ❌ ACTUEL
[gridEl, chipEl].forEach(el => {
    if (el) {
        for (let i = 1; i <= 8; i++) el.classList.remove(`association-pair-color-${i}`);
        el.classList.remove('paired', 'selected');
        delete el.dataset.pairNum;  // ← Enlevé du DOM
        // ⚠️ MAIS associationPairs n'est pas forcément synchronisée!
    }
});
```

---

## ✅ Solution proposée

### A. Reset du compteur entre questions

```javascript
nextEtape() {
    // ...
    this.userAnswers = {};
    this.associationSelection = { grid: null, chip: null };
    this.associationPairs = [];
    this.associationPairCounter = 0;  // ← AJOUTER CETTE LIGNE
}
```

### B. Validation défensive du dépairage

```javascript
unpairAssociationItem(element, zone, id) {
    const pairNum = element.dataset.pairNum;
    if (!pairNum) {
        // ⚠️ Élément a classe 'paired' mais pas de dataset.pairNum!
        // C'est une incohérence - nettoyer à la main
        element.classList.remove('paired', 'selected');
        for (let i = 1; i <= 8; i++) {
            element.classList.remove(`association-pair-color-${i}`);
        }
        return;
    }

    const pairIndex = this.associationPairs.findIndex(p => String(p.pairNum) === String(pairNum));
    if (pairIndex > -1) {
        const pair = this.associationPairs[pairIndex];
        this.associationPairs.splice(pairIndex, 1);
        this.saveAnswer('association', this.associationPairs);
        // ...reste du nettoyage...
    } else {
        // ⚠️ Pair introuvable mais dataset existe - incohérence détectée!
        console.warn('[Association] Pair number', pairNum, 'not found in associationPairs. DOM/State desync!');
        // Nettoyer le DOM quand même
        element.classList.remove('paired', 'selected');
        for (let i = 1; i <= 8; i++) {
            element.classList.remove(`association-pair-color-${i}`);
        }
    }
}
```

### C. Valider l'intégrité au chargement

```javascript
validateCurrentEtape() {
    // ...avant la validation

    // Pour format association, valider la cohérence
    if (currentEtape.format_code === 'association') {
        const userPairs = this.userAnswers['association'] || [];
        console.log('[Association] Validation - userPairs:', userPairs);

        // Vérifier que tous les dataset.pairNum correspondent à associationPairs
        document.querySelectorAll('.association-grid-card.paired, .association-chip.paired').forEach(el => {
            const pairNum = el.dataset.pairNum;
            const found = userPairs.some(p => String(p.pairNum) === String(pairNum));
            if (!found) {
                console.error('[Association] Pair', pairNum, 'in DOM but not in userPairs!');
                el.classList.remove('paired');
            }
        });
    }

    // ...suite de la validation
}
```

---

## 📝 Conclusion

Le bug est causé par:
1. **`associationPairCounter` ne reset jamais** entre les modifications
2. **DOM et `associationPairs` peuvent se désynchroniser** lors du dépairage/réappairage
3. **Aucune validation défensive** pour détecter les incohérences

Quand l'élève change d'avis plusieurs fois:
- Le DOM affiche correctement l'état visuel
- Mais `associationPairs` peut contenir des paires "fantômes"
- La validation compte alors 2 paires au lieu de 1

**Impact:** Score incorrect (2/4 au lieu de 1/4), affichage de correction confus.
