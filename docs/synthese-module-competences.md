# Synthèse du module « Entraînement de compétences » (élève)

> Document de référence décrivant les fonctionnalités, l'articulation des éléments et les choix graphiques du module compétences côté élève dans Brikks.

---

## 1. Vue d'ensemble

Le module permet à un élève de s'entraîner sur des compétences définies par la professeure. Il est organisé en **3 niveaux de navigation** (liste → détail → exercice) et propose **2 modes** de travail : entraînement libre (autocorrection) et évaluation (soumission au professeur).

### Fichiers impliqués

| Rôle | Fichier |
|------|---------|
| Page HTML | `eleve/entrainements-comp.html` |
| JS principal (niveaux 1-2, navigation) | `js/eleve-competences.js` |
| JS exercice (niveau 3, timer, résultats) | `js/eleve-competences-exercice.js` |
| Utilitaire popup de soumission | `js/submission-utils.js` |
| CSS | `css/eleve-competences.css` |
| Backend | `google-apps-script/Competences.gs` |

---

## 2. Modèle de données

5 tables Google Sheets interconnectées :

```
CompetencesReferentiel          ← Référentiel des compétences (défini par la prof)
  │  (id, nom, description, consigne, ordre, visible)
  │
  ├── CriteresReussite          ← Critères de réussite par compétence
  │     (id, competence_id, libelle, ordre)
  │
  └── BanquesCompetences        ← Banques regroupant les exercices
        (id, competence_id, titre, description, ordre, statut)
        │
        └── EntrainementsCompetences   ← Exercices individuels
              (id, titre, competence_id, banque_id, document_url,
               document_contenu, correction_commentee, correction_contenu,
               duree, ordre, statut, delai_mail_minutes, delai_papier_jours)
              │
              └── EleveEntrainementsCompetences   ← Progression de l'élève
                    (id, eleve_id, entrainement_id, mode, statut,
                     date_debut, date_fin, date_soumission, temps_passe,
                     mode_rendu, date_envoi, date_correction)
```

### Règles de visibilité

- L'élève ne voit que les banques avec `statut = 'publie'`
- L'élève ne voit que les entraînements avec `statut = 'publie'`
- La prof (mode prévisualisation) voit tout

---

## 3. Navigation en 3 niveaux

### Niveau 1 — Liste des banques de compétences

**Ce qu'on voit :**
- Un **bandeau rouge** en haut avec le titre « Entraînement de compétences » et le compteur `X/Y validées`
- Une **barre de progression** rouge montrant le pourcentage de compétences validées
- Une **liste de cartes** (une par banque publiée), chacune affichant :
  - Une **icône de statut** à gauche (cercle coloré avec symbole)
  - Le **titre** de la banque
  - Des **métadonnées** : nombre d'exercices validés, en attente, entraînés, en cours
  - Un **badge de statut** à droite (pastille colorée avec texte)
  - Un **chevron** `›` indiquant qu'on peut cliquer

**Statuts possibles d'une banque :**

| Statut | Label affiché | Couleur | Icône |
|--------|---------------|---------|-------|
| `pas_commencee` | Pas commencée | Gris (`#f3f4f6`) | ○ |
| `en_cours` | En cours | Ambre (`#fef3c7`) | ⋯ |
| `soumise` | En attente | Violet (`#f3e8ff`) | 📤 |
| `validee` | Validée | Vert (`#dcfce7`) | ✓ |
| `non_soumise` | Non soumise | Gris | — |

**Logique de priorisation des statuts :** validée > corrigée > soumise > en cours > non soumise > pas commencée. C'est le statut le plus avancé parmi tous les exercices de la banque qui détermine le statut de la banque.

**Interaction :** clic sur une carte → ouvre le niveau 2.

---

### Niveau 2 — Détail d'une banque

**Ce qu'on voit :**
- Un **fil d'Ariane** : `Compétences › Nom de la banque`
- Une **carte de détail** contenant :
  - Le titre de la banque + son badge de statut
  - La description de la compétence associée (si renseignée)
  - **2 cartes de mode** côte à côte expliquant les options :
    - 📝 **S'entraîner** : « Travaille à ton rythme. Tu verras le corrigé commenté à la fin. »
    - 🎯 **Être évalué(e)** : « Soumets ta production pour validation par le professeur. »
- La **liste des exercices** numérotés, chacun avec :
  - Son numéro, son titre, sa durée indicative
  - Un tag de mode (si déjà commencé) : « Entraînement » (bleu) ou « Évaluation » (rouge)
  - Un badge de statut individuel

**Statuts possibles d'un exercice :**

| Statut | Label | Couleur | Icône |
|--------|-------|---------|-------|
| `pas_commence` | Pas commencé | Gris | ○ |
| `en_cours` | En cours | Ambre | ▶ |
| `entraine` | Entraîné | Bleu (`#dbeafe`) | 📝 |
| `soumis` | Soumis | Violet (`#f3e8ff`) | 📤 |
| `corrige` | Corrigé | — | 📋 |
| `valide` | Validé | Vert (`#dcfce7`) | ✓ |
| `non_soumis` | Non soumis | — | ✕ |

**Interaction au clic sur un exercice — dépend du statut :**

| Statut actuel | Action au clic |
|---------------|----------------|
| Jamais commencé | Popup de choix du mode (entraînement ou évaluation) |
| En cours (évaluation) | Reprend directement l'exercice (le chrono tourne toujours) |
| En cours (entraînement) | Popup : « Reprendre » ou « Recommencer » |
| Entraîné | Popup : « Se ré-entraîner » ou « Consulter le corrigé » |
| Non soumis | Popup de choix du mode (comme première fois) |
| Soumis / Corrigé / Validé | Vue relecture (document + suivi) |

---

### Niveau 3 — Vue exercice (pendant le travail)

**Structure de la page (2 colonnes) :**

```
┌─────────────────────────────────────────────────────┐
│  ← [Titre de l'exercice]     [Badge mode]  [Timer]  │  ← Barre du haut
├─────────────────────────────────────────────────────┤
│  CONSIGNE                                            │  ← Encadré jaune (optionnel)
│  Texte de la consigne...                             │
├──────────────────────────────┬──────────────────────┤
│                              │                      │
│  📄 Sujet                    │  Critères de réussite │  ← Grille 2 colonnes
│                              │  ☐ Critère 1          │
│  [Document / iframe /        │  ☐ Critère 2          │
│   texte riche / blocs]       │  ☐ Critère 3          │
│                              │                      │
│                              │  [Bouton Terminer]   │
│                              │                      │
└──────────────────────────────┴──────────────────────┘
```

**Éléments de la vue exercice :**

1. **Barre du haut** : bouton retour ←, titre, badge de mode (« Entraînement libre » en bleu ou « Évaluation » en rouge), timer ⏱

2. **Consigne** (optionnel) : encadré jaune (fond `#fffbeb`, bordure gauche `#f59e0b`) affichant la consigne de la compétence ou la description de l'exercice

3. **Colonne gauche — Document** : le sujet de l'exercice. 3 formats possibles :
   - **Blocs** (nouveau format JSON) : combinaison de blocs texte, document (iframe), image et vidéo
   - **Texte riche** (HTML brut) : contenu saisi directement par la prof
   - **Lien** (URL) : iframe Google Doc / Drive / Publuu avec barre d'outils (ouvrir dans un nouvel onglet)

4. **Colonne droite (sidebar, sticky)** :
   - **Critères de réussite** : liste de cases à cocher que l'élève coche au fur et à mesure (aide-mémoire, pas de validation automatique)
   - **Bouton d'action** : « J'ai terminé — voir le corrigé » (entraînement) ou « Terminer » (évaluation)

5. **Timer** : compte à rebours à partir de la durée définie par la prof
   - Affichage normal : fond gris
   - **< 5 minutes** : fond jaune (warning), texte ambre
   - **< 1 minute** : fond rouge (danger), texte rouge + animation pulsation
   - **Temps écoulé** : fond gris (overtime), texte gris clair. Le chrono continue en négatif
   - En mode entraînement : le timer est indicatif, un bandeau jaune s'affiche à 0 (« Tu devrais avoir terminé ! Prends le temps qu'il te faut. »)
   - En mode évaluation : le timer déclenche automatiquement le popup de soumission à 0

**Persistance du timer :**
- Mode évaluation : le timer est sauvegardé dans `localStorage` toutes les 10 secondes. Si l'élève quitte la page (fermeture, navigation), le chrono continue à tourner. Au retour, le temps écoulé pendant l'absence est déduit. Si le timer a expiré pendant l'absence, auto-soumission au retour.
- Mode entraînement : le timer se met en pause quand l'élève quitte et reprend là où il en était.
- Protection `beforeunload` en mode évaluation (avertissement avant fermeture de l'onglet)

---

## 4. Les deux modes de travail

### Mode « Entraînement » (autocorrection)

**Principe :** l'élève travaille à son rythme sur le document. Le timer est indicatif. À la fin, il voit le corrigé commenté de la prof.

**Fin de l'exercice :**
- L'élève clique « J'ai terminé — voir le corrigé »
- Le document se transforme en **vue à onglets** : `📄 Sujet` / `📝 Corrigé` (le sujet reste visible en basculant d'onglet)
- Le corrigé peut être : des blocs (texte + images + documents + vidéos), du texte riche HTML, un lien vers un Google Doc (iframe), ou une proposition de correction textuelle
- Le bouton d'action disparaît mais les critères restent visibles dans la sidebar
- Statut → `entraine`
- L'élève peut se ré-entraîner autant de fois qu'il veut (le statut repasse à `en_cours`)

### Mode « Évaluation » (soumission au professeur)

**Principe :** l'élève soumet sa production pour correction par la professeure. Le timer est contraignant.

**Fin de l'exercice — popup de soumission en 2 étapes :**

**Étape 1 — Choix principal :**
- **Soumettre mon travail** → passe à l'étape 2
- **Ne pas soumettre** → confirmation « Ce choix est définitif » → statut `non_soumis`
- **Continuer à travailler** → ferme le popup (seulement si le timer n'est pas à 0)

**Étape 2 — Choix du format de rendu :**
- **📄 Sur papier** : « Dépose ta copie dans le casier de ton professeur. Dernier délai : le [date calculée, jours ouvrés] »
- **📧 Par voie numérique** : « Envoie ton travail par message sur MBN. Dernier délai : avant [heure calculée] »

**Calcul des délais :**
- Délai numérique : `delai_mail_minutes` (défaut 30 min) ajouté à l'heure actuelle → « avant 15h42 »
- Délai papier : `delai_papier_jours` (défaut 1 jour ouvré) calculé en excluant weekends et jours listés dans la feuille `JOURS_NON_COURS` → « le lundi 3 mars 2026 »

---

## 5. Écrans post-exercice

### Résultat entraînement (onglets)

Après avoir cliqué « J'ai terminé » en mode entraînement, la zone document bascule en mode relecture avec 2 onglets :
- **Sujet** : le document de travail original
- **Corrigé** : le corrigé commenté de la prof

L'élève peut naviguer librement entre les deux. Les critères de réussite restent visibles dans la sidebar.

### Résultat évaluation — carte bilan (2 colonnes)

Après soumission en mode évaluation, l'écran affiche une **carte en 2 colonnes** :

```
┌───────────────────────────┬─────────────────────────────┐
│                           │                             │
│  ✔ Exercice terminé !     │  📧 Envoie ton travail      │
│                           │                             │
│  COMPÉTENCE ÉVALUÉE       │  Envoie ton travail par     │
│  Analyser un document     │  message sur MBN à ton      │
│                           │  professeur.                │
│  ⏱ 12:34 / 30:00         │                             │
│                           │  🕑 avant 15h42             │
│  Soumis le 01/03 à 14h12  │  dernier délai              │
│                           │                             │
│  ●——●——○                  │  [J'ai envoyé mon travail]  │
│  Terminé  Envoyé  Corr.   │                             │
│                           │                             │
└───────────────────────────┴─────────────────────────────┘
```

**Colonne gauche (bilan) :**
- Icône check verte + « Exercice terminé ! »
- Compétence évaluée (nom)
- Temps passé / temps total
- Date de soumission
- Mini-stepper horizontal (3 pastilles : Terminé ✓ → Envoyé ○/✓ → Correction ○)

**Colonne droite (action) — 3 variantes selon l'état :**

| État | Contenu | Fond |
|------|---------|------|
| En attente d'envoi (papier) | 📄 « Dépose ta copie... » + deadline + bouton « J'ai déposé » | Dégradé vert clair |
| En attente d'envoi (numérique) | 📧 « Envoie par MBN... » + deadline + bouton « J'ai envoyé » | Dégradé vert clair |
| Déjà envoyé | ⏳ « En attente de correction. Tu recevras ta correction prochainement. » | Gris clair |
| Délai dépassé | ⚠️ « Le délai est passé. Contacte ton professeur. » | Dégradé rouge clair |

**Confirmation d'envoi :**
- L'élève clique « J'ai envoyé/déposé mon travail »
- Un `confirm()` demande confirmation
- Appel API `saveEnvoiCompetence` → enregistre `date_envoi`
- Le statut reste `soumis` (c'est déclaratif, pas de vérification automatique)
- La colonne droite bascule vers « En attente de correction »

### Vue relecture (après complétion)

Quand l'élève revient consulter un exercice déjà terminé :

- **Mode entraînement terminé** : vue à onglets Sujet/Corrigé (identique à la fin de l'exercice)
- **Mode évaluation soumis** : carte bilan 2 colonnes (avec action adaptée selon l'état d'envoi)
- **Mode évaluation validé/corrigé** : stepper vertical 3 étapes (Terminé → Envoyé → Correction/Validée) + document en dessous

---

## 6. Machine à états (cycle de vie d'un exercice)

```
                    ┌──────────────────┐
                    │   PAS COMMENCÉ   │
                    └────────┬─────────┘
                             │ (choix du mode)
                    ┌────────▼─────────┐
                    │    EN COURS       │◄──────────────────┐
                    │ (mode entr./eval) │                   │
                    └───┬──────────┬───┘                   │
                        │          │                        │
            (entr.)     │          │     (eval.)            │
                        │          │                        │
               ┌────────▼──┐  ┌───▼────────────┐           │
               │  ENTRAÎNÉ  │  │    SOUMIS       │           │
               └──────┬─────┘  └───┬──────┬─────┘           │
                      │            │      │                  │
            (ré-entr.)│     ┌──────▼──┐   │                  │
                      │     │ CORRIGÉ  │   │                  │
                      │     └──────┬──┘   │                  │
                      │            │      │                  │
                      │     ┌──────▼──┐   │                  │
                      │     │ VALIDÉ   │   │                  │
                      │     └─────────┘   │                  │
                      │                   │                  │
                      └───────────────────┼──────────────────┘
                                          │
                              ┌───────────▼──┐
                              │  NON SOUMIS   │──── (retry) ──► EN COURS
                              └──────────────┘
```

**Transitions clés :**
- `pas_commence` → `en_cours` : l'élève choisit un mode et démarre
- `en_cours` → `entraine` : fin du mode entraînement (autocorrection)
- `en_cours` → `soumis` : fin du mode évaluation (soumission)
- `en_cours` → `non_soumis` : l'élève refuse de soumettre dans le popup
- `entraine` → `en_cours` : ré-entraînement (même mode ou upgrade vers évaluation)
- `non_soumis` → `en_cours` : l'élève peut recommencer (choix du mode)
- `soumis` → `corrige` → `valide` : côté prof (correction manuelle)

---

## 7. Chargement des données et cache

### Appels API au chargement (5 en parallèle)

1. `getCompetencesReferentiel` — toutes les compétences
2. `getCriteresReussite` — tous les critères
3. `getBanquesCompetences` — toutes les banques (filtrées `publie` côté frontend)
4. `getEntrainementsCompetences` — tous les exercices (filtrés `publie` côté frontend)
5. `getEleveEntrainementsCompetences` — progressions de l'élève connecté

### Stratégie de cache

- Cache `localStorage` avec TTL de 5 minutes (`brikks_competences_eleve_cache`)
- Si cache valide : affichage immédiat + refresh silencieux en arrière-plan
- Si cache expiré : loader affiché, chargement complet

---

## 8. Design graphique

### Identité visuelle

- **Couleur principale** : rouge (`#ef4444` → `#dc2626`), utilisée pour le bandeau, la barre de progression, les boutons principaux et le badge évaluation
- **Palette de gris** (Tailwind) : du `#1f2937` (texte foncé) au `#f9fafb` (fond très clair)
- **Coins arrondis** : 12-16px pour les cartes, 8-10px pour les éléments internes, 9999px pour les badges/pastilles
- **Ombres** : subtiles (`0 2px 8px rgba(0,0,0,0.06)`) pour les cartes, plus marquées pour les modales (`0 20px 60px`)
- **Typographie** : tailles de 0.65rem (labels micro) à 1.35rem (titre bandeau), graisse 500-700

### Code couleur par statut

| Famille | Fond | Texte | Usage |
|---------|------|-------|-------|
| Gris | `#f3f4f6` | `#9ca3af` | Pas commencé, éléments neutres |
| Ambre | `#fef3c7` | `#d97706` | En cours, timer warning |
| Bleu | `#dbeafe` | `#2563eb` | Entraîné, mode entraînement |
| Violet | `#f3e8ff` | `#7c3aed` | Soumis (en attente) |
| Vert | `#dcfce7` | `#16a34a` | Validé, cases cochées, succès |
| Rouge | `#fef2f2` | `#dc2626` | Mode évaluation, timer danger |

### Interactions

- **Cartes (hover)** : ombre qui s'intensifie + bordure rosée (`#fca5a5`) + translation 4px vers la droite
- **Boutons** : transition 0.2s, hover = couleur plus foncée, active = pas de décalage
- **Cases à cocher** : carré personnalisé (20px), fond vert + coche blanche ✓ quand cochée
- **Timer pulse** : animation `scale(1.05)` quand < 1 minute (état danger)

### Responsive

- **< 768px** : la grille 2 colonnes (document + sidebar) passe en colonne unique. La topbar s'empile verticalement.
- **< 600px** : le stepper vertical passe en horizontal. Paddings réduits. Les cartes de mode se superposent.
- **< 900px** : la carte bilan 2 colonnes passe en colonne unique (bilan au-dessus, action en-dessous).

---

## 9. Formats de contenu supportés

### Documents (sujet)

| Format | Source | Rendu |
|--------|--------|-------|
| Blocs JSON | `document_contenu` (array JSON) | Combinaison de blocs texte, images, documents iframe et vidéos |
| Texte riche | `document_contenu` (HTML brut) | HTML affiché directement dans un conteneur scrollable |
| Lien | `document_url` | iframe avec conversion automatique (Google Docs → `/preview`, Drive → `/preview`, Publuu → `?embed`, PDF → Google Viewer) |

### Corrigés

Mêmes 3 formats, stockés dans `correction_contenu` (blocs JSON ou HTML) et/ou `correction_commentee` (JSON `{url, proposition}` ou URL directe).

### Types de blocs (nouveau format)

| Type | Contenu | Rendu |
|------|---------|-------|
| `text` | HTML riche + légende optionnelle | Bordure gauche indigo (`#6366f1`), style éditorial |
| `document` | URL + titre + légende | iframe Google Doc/Drive avec lien nouvel onglet |
| `image` | URL + légende | Figure avec conversion auto Drive → `lh3.googleusercontent.com` |
| `video` | URL + légende | iframe YouTube (nocookie) ou Drive preview |
| `group` | Array d'enfants (blocs) | Conteneur flex côte à côte |

---

## 10. Popup de soumission (SubmissionUtils)

Composant partagé (`js/submission-utils.js`) réutilisable, utilisé par le module compétences.

### Étape 1 — Choix principal

```
┌────────────────────────────────────┐
│  Que veux-tu faire ?               │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ ✅ Soumettre mon travail     │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ ❌ Ne pas soumettre          │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ ⏩ Continuer à travailler    │  │  ← masqué si timer = 0
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Étape 2 — Format de rendu

```
┌────────────────────────────────────┐
│  Comment veux-tu rendre ?          │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ 📄 Sur papier                │  │
│  │ Dernier délai :              │  │
│  │ le lundi 3 mars 2026         │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ 📧 Par voie numérique       │  │
│  │ Dernier délai :              │  │
│  │ avant 15h42                  │  │
│  └──────────────────────────────┘  │
│                                    │
│  [← Retour]                       │
└────────────────────────────────────┘
```

### Calcul des jours ouvrés

L'algorithme avance jour par jour à partir d'aujourd'hui, en sautant :
- Les samedis et dimanches
- Les dates listées dans la feuille Google Sheets `JOURS_NON_COURS` (vacances, jours fériés)

La recherche dans `JOURS_NON_COURS` utilise un `Set` pour une performance O(1).

---

## 11. Récapitulatif des écrans

| Écran | Quand | Éléments principaux |
|-------|-------|---------------------|
| **Liste (niveau 1)** | Page d'accueil du module | Bandeau rouge, progression, cartes banques |
| **Détail (niveau 2)** | Clic sur une banque | Fil d'Ariane, cartes de mode, liste d'exercices |
| **Choix du mode** | Premier clic sur un exercice | Popup modal : Entraînement / Évaluation |
| **Exercice (niveau 3)** | Pendant le travail | Document + sidebar critères + timer |
| **Résultat entraînement** | Après « J'ai terminé » (mode entr.) | Onglets Sujet/Corrigé in-place |
| **Popup soumission** | Après « Terminer » (mode éval.) ou timer = 0 | 2 étapes : choix → format de rendu |
| **Carte bilan** | Après soumission (mode éval.) | 2 colonnes : bilan + action d'envoi |
| **Relecture entraînement** | Retour sur un exercice entraîné | Onglets Sujet/Corrigé |
| **Relecture évaluation** | Retour sur un exercice soumis/validé | Stepper de suivi + document |
| **Timer expiré** | Retour après expiration du timer | Message auto-soumission |
