# Brikks

Plateforme éducative pour l'apprentissage du français, de l'histoire, de la géographie et de l'EMC.

> Anciennement "Espace cours • Mme Meyer"

## Structure du projet

```
/
├── index.html          # Page de connexion
├── admin/              # Espace professeur
│   └── index.html
├── eleve/              # Espace élève
│   └── index.html
├── components/         # Composants réutilisables (sidebar, header)
├── css/
│   └── style.css       # Styles globaux
├── js/
│   ├── config.js       # Configuration (IDs, URLs)
│   ├── sheets.js       # API Google Sheets
│   ├── auth.js         # Authentification et routing
│   └── app.js          # Logique générale
└── README.md
```

## Configuration

### 1. Clé API Google

Pour que l'application fonctionne, vous devez configurer une clé API Google :

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API Google Sheets
4. Créez une clé API (Identifiants > Créer des identifiants > Clé API)
5. Ajoutez la clé dans `js/config.js` :

```javascript
API_KEY: 'VOTRE_CLE_API_ICI',
```

### 2. Google Sheets

Le spreadsheet doit contenir un onglet `UTILISATEURS` avec les colonnes :
- `identifiant` : identifiant de connexion
- `motdepasse` : mot de passe
- `role` : `prof` ou `eleve`
- `nom` : nom de l'utilisateur
- `prenom` : prénom de l'utilisateur

**Important** : Le spreadsheet doit être partagé en lecture publique ou avec les utilisateurs appropriés.

## Déploiement

Site statique hébergeable sur GitHub Pages :

1. Activez GitHub Pages dans les paramètres du repo
2. Sélectionnez la branche `main` et le dossier `/` (root)
3. Le site sera accessible à `https://[username].github.io/Brikks/`

## Fonctionnalités

### Implémentées
- Page de connexion avec vérification via Google Sheets
- Redirection automatique selon le rôle (prof → admin, élève → eleve)
- Gestion de session (sessionStorage)
- Design responsive

### À venir
- Gestion des cours
- Exercices interactifs
- Suivi de progression
- Tableaux de bord admin et élève

## Technologies

- HTML5 / CSS3 / JavaScript (vanilla)
- Google Sheets API v4
- Police : Inter (Google Fonts)
