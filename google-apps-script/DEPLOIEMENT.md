# Deploiement du Google Apps Script

## Etape 1 : Acceder a Apps Script

1. Ouvrir votre Google Sheets : https://docs.google.com/spreadsheets/d/1rsWXHwP2fyuJ0VZKL9UAzFws9UMFqyHXDt5_j8O2Ry0
2. Menu **Extensions** > **Apps Script**

## Etape 2 : Copier le code

1. Dans l'editeur Apps Script, supprimer le contenu existant de `Code.gs`
2. Copier tout le contenu du fichier `Code.gs` de ce dossier
3. Coller dans l'editeur

## Etape 3 : Tester le script

1. Dans le menu deroulant des fonctions, selectionner `testScript`
2. Cliquer sur **Executer**
3. Autoriser l'acces si demande
4. Verifier dans les logs (Affichage > Journaux) que tout est OK

## Etape 4 : Deployer en Web App

1. Cliquer sur **Deployer** > **Nouveau deploiement**
2. Cliquer sur l'icone engrenage et selectionner **Application Web**
3. Configurer :
   - **Description** : Brikks Backend v1
   - **Executer en tant que** : Moi (votre email)
   - **Qui a acces** : Tout le monde
4. Cliquer sur **Deployer**
5. **Copier l'URL** du Web App (elle ressemble a : `https://script.google.com/macros/s/XXXXX/exec`)

## Etape 5 : Configurer Brikks

1. Ouvrir le fichier `js/config.js`
2. Remplacer `'REMPLACER_PAR_URL_WEB_APP'` par l'URL copiee :

```javascript
WEBAPP_URL: 'https://script.google.com/macros/s/VOTRE_ID/exec',
```

3. Sauvegarder et deployer sur GitHub Pages

## Test du Web App

Vous pouvez tester le Web App directement dans le navigateur :

```
https://script.google.com/macros/s/VOTRE_ID/exec?action=testScript
```

## Operations disponibles

### Themes

| Action | Parametres requis | Parametres optionnels |
|--------|-------------------|----------------------|
| `addTheme` | `discipline_id`, `nom` | `ordre` |
| `updateTheme` | `id` | `discipline_id`, `nom`, `ordre` |
| `deleteTheme` | `id` | - |

### Chapitres

| Action | Parametres requis | Parametres optionnels |
|--------|-------------------|----------------------|
| `addChapter` | `theme_id`, `titre` | `numero`, `numero_lecon`, `contenu`, `lien`, `statut` |
| `updateChapter` | `id` | `theme_id`, `numero`, `numero_lecon`, `titre`, `contenu`, `lien`, `statut` |
| `deleteChapter` | `id` | - |

## Exemple d'appel JavaScript

```javascript
// Ajouter un chapitre
const response = await fetch(CONFIG.WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        action: 'addChapter',
        theme_id: 'theme_123',
        titre: 'Mon nouveau chapitre',
        statut: 'brouillon'
    })
});

const result = await response.json();
console.log(result); // { success: true, id: 'chap_xxx', message: '...' }
```

## Mise a jour du deploiement

Si vous modifiez le code :

1. Menu **Deployer** > **Gerer les deploiements**
2. Cliquer sur l'icone crayon pour modifier
3. Incrementer le numero de version
4. Cliquer sur **Deployer**

L'URL reste la meme, pas besoin de la changer dans config.js.

## Depannage

### Erreur "Autorisation requise"
- Re-executer `testScript` pour re-autoriser l'acces

### Erreur CORS
- Verifier que "Qui a acces" = "Tout le monde"
- Le script utilise `createTextOutput` avec MIME JSON qui gere le CORS

### Erreur "Feuille non trouvee"
- Verifier que les onglets `THEMES` et `CHAPITRES` existent dans le Google Sheets
