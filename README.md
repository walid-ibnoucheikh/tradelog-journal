# Tradelog

Journal de trades pour le NQ et le MNQ (futures Nasdaq). Application personnelle à usage solo : synchronisation (ou import) des exécutions depuis Tradovate (comptes prop
firm Apex, Tradeify, Lucid…), reconstruction des trades, dashboard, Daily Journal, Notebook et
rapports.

## Accès

L'app est protégée par un mot de passe unique. Dans `.env.local` (et dans les variables de Vercel,
pour Production et Preview) :

```bash
APP_PASSWORD=...     # 12 caractères minimum
SESSION_SECRET=...   # 32 caractères minimum, par exemple : openssl rand -hex 32
```

En local, sans `APP_PASSWORD`, l'app reste ouverte. En production (y compris `npm run start`), un
mot de passe absent ou trop court **verrouille toute l'app** (erreur 503 avec la raison). Changer
`SESSION_SECRET` déconnecte toutes les sessions.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui (sur Base UI) · Recharts · Tiptap
· PostgreSQL sur Neon · Drizzle ORM · Vitest. Synchro Tradovate : Playwright dans GitHub Actions.

## Démarrage

Prérequis : Node 24 (la version de Vercel) et une base PostgreSQL sur [Neon](https://neon.com).

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # puis renseigner DATABASE_URL et DATABASE_URL_UNPOOLED
npm run db:migrate           # crée les tables
npm run dev:test             # http://localhost:3000, sur la branche Neon `test`
```

**`npm run dev` et `npm run db:migrate` utilisent la base de `.env.local`, c'est-à-dire la
production une fois l'app en service.** Pour développer, lance `npm run dev:test` : il démarre le
serveur sur la branche Neon `test` (URL dans `.env.test.local`, voir « Tests »), avec rechargement à
chaud. Jamais de test ni de script de développement contre la production.

Utilisation : créer un compte dans **Accounts** (le nom Tradovate doit correspondre exactement à
celui des exports, et les règles de la prop firm se saisissent à la main), puis dans **Import** :

- soit **Sync** (un compte, une prop firm, ou tous les comptes actifs) : voir « Synchro Tradovate » ;
- soit à la main, en déposant `Fills.csv` (les trades) et `Cash History.csv` (facultatif, les frais
  réels) exportés de Tradovate. Réimporter un fichier ne crée pas de doublons.

Si `npm install` échoue avec `Cannot read properties of null (reading 'edgesOut')`, c'est un bug
d'npm 10 sur les peer dependencies : ajouter `--legacy-peer-deps`.

## Scripts

| Commande                     | Rôle                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `npm run dev:test`           | serveur de développement sur la branche Neon `test`                |
| `npm run dev`                | serveur de développement sur `.env.local` (production : prudence)  |
| `npm run build`              | build de production (lit la base : voir la CI)                     |
| `npm run start`              | serveur de production                                              |
| `npm run lint`               | ESLint                                                             |
| `npm run format`             | formate le code avec Prettier                                      |
| `npm run format:check`       | vérifie le formatage (utilisé par la CI)                           |
| `npm run typecheck`          | génère les types de routes de Next puis lance `tsc`                |
| `npm test`                   | tests Vitest (app et `agent/`)                                     |
| `npm run db:generate`        | génère une migration après un changement du schéma                 |
| `npm run db:migrate`         | applique les migrations (**sur la base de `.env.local`**)          |
| `npm run backup`             | exporte toutes les tables dans `backups/`                          |
| `npm run restore`            | recharge une sauvegarde dans une base vide                         |
| `npm run agent:cloud-local`  | essaie la synchro sur ton PC, sans GitHub (app locale + base test) |
| `npm run agent:export-cloud` | prépare le coffre `TRADELOG_CLOUD_VAULT` (états de navigateur)     |
| `npm run agent:export-state` | exporte l'état de navigateur d'une prop firm (ancien secret)       |
| `npm run agent:login`        | enregistre sur ce PC le login Tradovate d'une prop firm            |
| `npm run agent:forget`       | oublie le login enregistré sur ce PC pour une prop firm            |

`npm run typecheck` génère d'abord les types `PageProps` et `LayoutProps` de Next (`next typegen`) : un simple `tsc` échoue sur un clone neuf tant que ces types n'existent pas.

La CI (`.github/workflows/ci.yml`) enchaîne `format:check`, `lint`, `typecheck`, `test` et `build` :
les lancer avant un commit. Chaque push sur `main` déploie tout seul sur Vercel, sans attendre la CI,
et **les migrations ne suivent pas** : appliquer `db:migrate` avant de pousser un changement de
schéma.

## Synchro Tradovate (cloud)

Les boutons **Sync** de `/import` créent une demande, puis lancent le workflow
`.github/workflows/cloud-sync.yml`. Le runner GitHub ouvre un navigateur neuf, se connecte à
Tradovate, exporte `Fills` et `Cash History` de chaque compte, et les renvoie à l'app (~90 s). Il y a
aussi une synchro automatique de tous les comptes actifs chaque soir de semaine (21h30 UTC), et un
lancement à la main (onglet Actions > Run workflow, option `queue_all`).

- Le **login Tradovate** de chaque prop firm se saisit dans l'app (Import > Tradovate logins, ou
  à l'ajout d'un compte). Il est stocké chiffré (clé `CREDENTIALS_KEY`).
- Tradovate fait confiance à un _navigateur_, pas à un login : le secret GitHub
  `TRADELOG_CLOUD_VAULT` fournit un état de navigateur de confiance, préparé sur ton PC avec
  `npm run agent:export-cloud -- --no-logins <prop firms>`. Si une synchro répond `needs_login`,
  refaire cet état.
- Secrets GitHub : `SYNC_TOKEN`, `TRADELOG_URL`, `TRADELOG_CLOUD_VAULT`. Variables Vercel :
  `CLOUD_SYNC_REPO` et `CLOUD_SYNC_TOKEN` (sans elles, les boutons Sync n'existent pas en production).
  Tous se saisissent toi-même : ne jamais les écrire dans un fichier versionné ni dans un message.
- En cas d'échec, l'app affiche une phrase courte par compte, avec le détail technique replié.

Le détail et les pièges sont dans l'en-tête du workflow.

## Sauvegarde

Neon gratuit ne garde que 6 heures d'historique.

- **À la main** : `npm run backup` écrit `backups/tradelog-AAAA-MM-JJ.json` (comptes, exécutions,
  trades, notes, transactions). Le dossier est ignoré par git : le fichier contient des données
  financières personnelles, à copier dans un espace à toi. Pour restaurer dans une base **vide**
  (migrations déjà appliquées) : `npm run restore -- backups/tradelog-AAAA-MM-JJ.json`. La
  restauration refuse une base non vide.

## Tests

- Les tests unitaires (CSV, parseur Tradovate, reconstruction des trades, statistiques, filtres,
  notes, synchro) sont à côté du code, dans `src/` et `agent/`. Les calculs de P&L sont comparés aux
  rapports officiels de Tradovate (`Performance` et `Account Balance History`) sur un export
  anonymisé (`src/lib/trading/tradovate/__fixtures__/fills.csv`). Les exports réels contiennent des
  identifiants de compte : ne jamais les versionner.
- Quelques tests de `agent/` pilotent un vrai Chromium (Playwright) sur de fausses pages : ils sont
  ignorés là où le navigateur n'est pas installé (CI).
- Les tests d'intégration (par exemple `src/db/import-fills.integration.test.ts`) tournent sur une
  **branche Neon dédiée**, jamais sur la production. Ils sont ignorés si `TEST_DATABASE_URL` est
  absente. Pour l'activer :

  ```bash
  npx neonctl branches create --name test --project-id <id> --org-id <id>
  echo "TEST_DATABASE_URL=$(npx neonctl connection-string test --project-id <id> --org-id <id>)" > .env.test.local
  ```

  Ils appliquent eux-mêmes les migrations sur la branche et refusent de démarrer si l'URL de test
  est la même que `DATABASE_URL`.

## Structure

```text
src/app/          pages (groupe (app) : dashboard, daily journal, trades, notebook, reports,
                  investissements, comptes, import ; page /login à part), routes API
                  (/api/sync/*, /api/note-images/*) et Server Actions
src/proxy.ts      protection par mot de passe de toutes les routes
src/components/   composants par page ; ui/ contient shadcn/ui (non formaté par Prettier)
src/db/           schéma Drizzle, requêtes, cache des pages, logique d'import et de synchro
src/lib/          utilitaires génériques (CSV, formats, filtres, dates, journal, notes) et, par
                  domaine : trading/ (trades, stats, parseur Tradovate), investments/, accounts/
                  (règles, fraîcheur des imports), sync/ (demandes de synchro), credentials/
                  (chiffrement des logins), auth/
agent/            run de synchro exécuté par GitHub Actions (navigateur Playwright) et outils du
                  coffre d'états de navigateur
scripts/          sauvegarde, restauration et serveur de développement sur la branche test
drizzle/          migrations SQL versionnées
.github/          workflows : CI, synchro cloud
```

## Limites connues

- **Un seul mot de passe, sans limitation globale des essais** (seulement 1 s d'attente après un
  mauvais mot de passe). Choisis un mot de passe long, d'au moins 16 caractères.
- Le drawdown est calculé sur le P&L réalisé. Les prop firms comptent aussi le P&L latent, absent
  des exports Tradovate, donc le chiffre est approximatif.
- Seuls le NQ et le MNQ sont gérés. Un autre produit fait échouer l'import avec un message clair.
- Hébergement gratuit : Neon (1 Go, calcul limité, 6 h d'historique) et Vercel Hobby (usage non
  commercial). Les pages lisent tous les trades puis filtrent : à remplacer par des requêtes SQL avant
  environ 50 000 trades.
