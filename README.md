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

1. **Pousse ce dossier dans le repo `aimmo`** que tu as déjà créé :
   ```bash
   cd aimmo
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Active GitHub Pages** : Settings du repo → Pages → Source → **"GitHub Actions"**.

3. **Autorise les Actions à écrire dans le repo** : Settings → Actions → General →
   "Workflow permissions" → coche **"Read and write permissions"**.

4. **(Recommandé) Régénère les vrais temps de trajet** avant le premier run réel :
   - Crée une clé gratuite sur [openrouteservice.org/dev/#/signup](https://openrouteservice.org/dev/#/signup)
     (2000 requêtes/jour offertes, largement assez pour ce script)
   - Puis :
   ```bash
   cd scraper
   npm install
   ORS_API_KEY=ta_cle npm run compute-communes
   ```
   (sous PowerShell Windows : `$env:ORS_API_KEY="ta_cle"; npm run compute-communes`)

   Le fichier livré contient des **estimations manuelles** (je n'ai pas pu appeler
   l'API depuis mon environnement). Ce script calcule les vrais temps via
   OpenRouteService, en évitant les péages (les autoroutes gratuites restent
   autorisées). La liste de communes candidates est volontairement centrée sur le
   corridor Boulogne/Wimereux/Desvres — cohérent avec Merlimont — plutôt que sur toute
   la zone proche de Calais Fréthun. Commit le résultat.

5. **Génère un token GitHub personnel** (pour l'étape suivante) :
   - GitHub → Settings (ton compte, pas le repo) → Developer settings → Personal access
     tokens → Fine-grained tokens → "Generate new token"
   - Repository access : **"Only select repositories"** → choisis `aimmo`
   - Permissions : **Contents → Read and write**, **Actions → Read and write**
   - Donne-lui une expiration (30-90 jours conseillé)
   - Copie le token généré (il ne sera plus jamais affiché)

6. **Configure le site** : ouvre le site une fois déployé → Paramètres → renseigne le
   repo (`tonuser/aimmo`) et colle le token. À refaire sur chaque navigateur/appareil
   que tu utilises pour consulter le site (le token reste local à chaque navigateur).

7. **Premier run** : onglet **Actions** du repo → "Scrape & Deploy" → "Run workflow"
   (laisse "both" par défaut). Regarde les logs.

Le site sera visible sur `https://<ton-user>.github.io/aimmo/`.

## Comment ça marche au quotidien

- **Automatique (agences)** : tous les lundis et mercredis, le scraper interroge les sites
  cochés dans Paramètres, génère un bulletin par marché, commit, et redéploie le site.
- **Leboncoin** : jamais automatique par défaut. À la demande (bouton "Générer un bulletin" →
  source "Leboncoin"), ou 1x/semaine si tu actives l'auto hebdo dans Paramètres → Leboncoin.
- **À la demande** : bouton "Générer un bulletin" dans la sidebar → choisis la source (Agences
  ou Leboncoin) et le marché, ajuste éventuellement le budget pour ce run précis → "Lancer".
  Pastille verte dans la sidebar pour distinguer les bulletins manuels des automatiques.
- **Modifier les critères** : Paramètres → ajuste zones, budget, surface, étage, DPE,
  jardin/parking, sites agences activés → "Confirmer les paramètres". Commit direct via
  l'API GitHub, aucun push manuel nécessaire.

## ⚠️ Points qui demanderont probablement du réglage

- **Sélecteurs des sites agences** (`scraper/sources/pap.js`, `orpi.js`, `guy-hoquet.js`) : écrits
  sans accès web en direct, à vérifier/ajuster au premier vrai run. Orpi et Guy Hoquet ont un
  risque plus élevé que PAP de rendre leur contenu en JavaScript côté client (donc HTML brut
  vide même si la requête répond bien) — si c'est le cas, il faudra soit trouver leur endpoint
  JSON interne (onglet Réseau du navigateur), soit passer par un navigateur headless
  (Playwright), plus lourd à mettre en place.
- **Leboncoin** (`scraper/sources/leboncoin.js`) : source la plus fragile, protection anti-bot
  sérieuse. Symptômes possibles : 0 résultat, HTTP 403/429, ou un CAPTCHA renvoyé à la place du
  HTML. C'est pour ça qu'il tourne dans un workflow séparé, à la demande ou 1x/semaine max —
  jamais mélangé aux autres sources.
- **Temps de trajet** : régénère-les avec `npm run compute-communes` si tu ajoutes des
  communes ou si les coordonnées approximatives (Wacquinghen, Echinghen, Saint-Léonard —
  pas trouvé de source précise) te semblent trop décalées.

## Sites "agences" activables

Dans Paramètres, coche les sites que tu veux interroger pour chaque marché : PAP.fr, Orpi,
Guy Hoquet. Seuls les sites cochés sont scrapés — un site décoché n'est jamais interrogé, ce
qui évite de perdre du temps sur une source qui ne marche pas pour toi.

## Leboncoin — usage séparé

Volontairement isolé du reste (bascule "Agences / Leboncoin" dans la sidebar, données
séparées, dashboard dédié) :
- Jamais dans le même run que les sites agences
- Détection d'arnaques intégrée (prix suspects, incohérences de prix dans le texte, demandes
  de contact hors plateforme) — les annonces flaguées sont exclues du top 10 et comptées à
  part
- Déclenchement à la demande à tout moment, ou 1x/semaine automatique si tu actives l'option
  dans Paramètres → Leboncoin

## Sécurité du token GitHub

Le token ne quitte jamais ton navigateur (stocké en `localStorage`), sauf pour parler
directement à `api.github.com`. Il est scopé à ce repo uniquement, avec seulement les
permissions Contents + Actions. Si tu as un doute (appareil perdu, etc.), révoque-le
depuis GitHub en un clic — aucun autre repo ni aucune donnée de compte n'est concerné.

## Ajouter des communes candidates

Édite la liste `CANDIDATES` dans `scraper/compute-communes.js` (nom + coordonnées),
relance `npm run compute-communes`, commit le résultat.
