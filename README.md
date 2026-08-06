# AImmo

Dashboard personnel de recherche immobilière (Achat + Location) autour de Boulogne-sur-Mer,
avec relevés automatiques (lundi/mercredi), génération à la demande, et paramètres
modifiables sans jamais toucher au code.

## Architecture

```
.github/workflows/scrape-and-deploy.yml   → planifié + déclenchable à la demande
scraper/
  scrape.js                               → scrape, score, écrit les bulletins JSON
  compute-communes.js                     → calcule les vrais temps de trajet (OSRM)
frontend/
  public/criteria-achat.json              → critères Achat (source de vérité)
  public/criteria-location.json           → critères Location (source de vérité)
  public/data/communes-temps.json         → temps de trajet vers Calais Fréthun
  public/data/bulletins/achat/            → bulletins générés (JSON)
  public/data/bulletins/location/
  src/                                    → app Vue 3 + TypeScript
```

Tout tourne sur GitHub (Actions + Pages), gratuitement. Zéro serveur à toi.

## Mise en route (une seule fois)

1. **Pousse ce dossier dans le repo `AImmo`** que tu as déjà créé :
   ```bash
   cd AImmo
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Active GitHub Pages** : Settings du repo → Pages → Source → **"GitHub Actions"**.

3. **Autorise les Actions à écrire dans le repo** : Settings → Actions → General →
   "Workflow permissions" → coche **"Read and write permissions"**.

4. **(Recommandé) Régénère les vrais temps de trajet** avant le premier run réel :
   ```bash
   cd scraper
   npm install
   npm run compute-communes
   ```
   Le fichier livré contient des **estimations manuelles** (je n'ai pas pu appeler
   l'API de calcul d'itinéraire depuis mon environnement). Ce script utilise OSRM
   (gratuit, sans clé) pour les remplacer par de vrais temps calculés, en excluant les
   autoroutes. Commit le résultat.

5. **Génère un token GitHub personnel** (pour l'étape suivante) :
   - GitHub → Settings (ton compte, pas le repo) → Developer settings → Personal access
     tokens → Fine-grained tokens → "Generate new token"
   - Repository access : **"Only select repositories"** → choisis `AImmo`
   - Permissions : **Contents → Read and write**, **Actions → Read and write**
   - Donne-lui une expiration (30-90 jours conseillé)
   - Copie le token généré (il ne sera plus jamais affiché)

6. **Configure le site** : ouvre le site une fois déployé → Paramètres → renseigne le
   repo (`tonuser/AImmo`) et colle le token. À refaire sur chaque navigateur/appareil
   que tu utilises pour consulter le site (le token reste local à chaque navigateur).

7. **Premier run** : onglet **Actions** du repo → "Scrape & Deploy" → "Run workflow"
   (laisse "both" par défaut). Regarde les logs.

Le site sera visible sur `https://<ton-user>.github.io/AImmo/`.

## Comment ça marche au quotidien

- **Automatique** : tous les lundis et mercredis, le scraper tourne, génère un bulletin
  par marché, commit, et redéploie le site. Rien à faire.
- **À la demande** : bouton "Générer un bulletin" dans la sidebar → choisis le marché,
  ajuste éventuellement le budget pour ce run précis (n'affecte pas tes critères
  enregistrés) → "Lancer". Le bulletin apparaît en quelques minutes avec une pastille
  verte dans la sidebar pour le distinguer des bulletins automatiques.
- **Modifier les critères** : Paramètres → ajuste zones (slider de temps de trajet),
  budget (slider), surface, étage, DPE, jardin/parking → "Confirmer les paramètres".
  Ça committe directement `criteria-<market>.json` dans le repo via l'API GitHub —
  aucun push manuel nécessaire. Le prochain bulletin (auto ou à la demande) utilisera
  les nouveaux critères.

## ⚠️ Points qui demanderont probablement du réglage

- **Sélecteurs PAP.fr** (`scraper/scrape.js`, fonction `parseListingCard`) : écrits sans
  accès web en direct, à vérifier/ajuster au premier vrai run (0 résultat = sélecteurs à
  corriger, cf. inspecteur du navigateur sur une page de recherche PAP).
- **Temps de trajet** : régénère-les avec `npm run compute-communes` (voir étape 4)
  pour remplacer les estimations manuelles par du calcul réel.
- **Anti-bot** : si PAP bloque les requêtes automatisées, il faudra espacer davantage
  les requêtes ou changer de source.

## Sécurité du token GitHub

Le token ne quitte jamais ton navigateur (stocké en `localStorage`), sauf pour parler
directement à `api.github.com`. Il est scopé à ce repo uniquement, avec seulement les
permissions Contents + Actions. Si tu as un doute (appareil perdu, etc.), révoque-le
depuis GitHub en un clic — aucun autre repo ni aucune donnée de compte n'est concerné.

## Ajouter des communes candidates

Édite la liste `CANDIDATES` dans `scraper/compute-communes.js` (nom + coordonnées),
relance `npm run compute-communes`, commit le résultat.
