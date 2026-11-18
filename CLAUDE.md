# Tradelog

Application personnelle (usage solo) de suivi de trades et de journal pour le NQ et le MNQ. Projet personnel, pas professionnel.

@AGENTS.md

**Garder ce fichier court** : l'essentiel seulement, pas de détail qui se lit dans le code.

## Contexte trading

- Instruments : NQ et MNQ uniquement (tick 0,25 pt ; point = 20 $ / 2 $). Comptes de prop firms via Tradovate : un seul format d'import.
- Règles par compte saisies à la main (rien en dur), calcul dans `src/lib/accounts/account-rules.ts` sur le P&L réalisé : approximatif, le latent n'est pas dans les fichiers.
- **Journée de trading = session de futures : 18h → 17h heure de New York** (`dayKey`, `TRADING_TIMEZONE` dans `src/lib/trading/stats.ts`). Tout regroupement par jour passe par `dayKey`. Heures affichées en New York, étiquetées « ET ».
- Win % et day win % excluent les break-even. Avg win/loss = gain moyen / perte moyenne.
- **Break-even** : sortie entre −0,25 et +2,25 pt par contrat (`describeTrade`, `src/lib/trading/trade.ts`), forçable par trade (`break_even_override`). Les BE n'entrent ni dans gagnants ni dans perdants, mais leur argent reste dans le P&L.
- Score (`src/lib/trading/score.ts`) : moyenne de 6 notes sur 100, repères empiriques.

## Interface

- Barre latérale sombre, cartes, gains verts / pertes rouges, accent violet. Mode clair et sombre (`.dark` sur `<html>`), couleurs par jeton dans `globals.css` (`--profit`, `--loss`, `--be`).
- **Textes en anglais**, dates en jour/mois/année (locale `en-GB`), nombres en `en-US`.
- Filtre de compte (`?account=`) : défaut par page (`defaultScopeFor`, `src/lib/filters.ts`). Un choix explicite l'emporte.
- **Mobile** : sous 640 px ou écran tactile, tout contrôle ≥ 44 px et champs 16 px. Pas de défilement horizontal, pas de tableau large, toute grille de page a `grid-cols-1` en base.
- **Graphiques** : pas d'animation Recharts sur les séries (coût proportionnel au nombre de trades). Les graphiques à fenêtres gardent une échelle verticale sur tout l'historique.
- Titre d'onglet : une balise `<title>` dans chaque page (`PageHeader`), jamais `metadata.title` dans le layout.

## Stack et conventions

- Next.js 16 (App Router, `src/`, alias `@/*`), TypeScript, Tailwind 4, shadcn/ui sur Base UI, Recharts, Tiptap, Neon Postgres + Drizzle. Doc de Next dans `node_modules/next/dist/docs/` : la lire avant de coder.
- `cacheComponents: true` : toute lecture de la base, de `cookies` ou de `searchParams` se fait dans un composant async sous `<Suspense>`. Une page `loading.tsx` par route.
- Mutations : Server Actions (`"use server"`) avec `useActionState`, puis `refresh()`. **Chaque action commence par `await requireAuth()`** (un test le vérifie ; seules `login` et `logout` sont exemptées).
- Accès : mot de passe unique (`APP_PASSWORD` 12+ caractères, `SESSION_SECRET` 32+), `src/proxy.ts`. En production, un mot de passe absent verrouille tout : ne jamais « corriger » en ouvrant.
- Pages dans `src/app/(app)/`, composants dans `src/components/<page>/`, logique pure et testée dans `src/lib/<domaine>/` (tests à côté). Prettier : sans point-virgule, guillemets doubles, 100 colonnes.

## Commandes

- `npm run dev:test` : serveur de dev sur une branche Neon `test`. **`npm run dev` lit `.env.local`, donc la base réelle** : à éviter pour développer.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` : la CI les enchaîne, les lancer avant tout commit.
- `npm run db:generate` après un changement de `src/db/schema.ts`. `npm run db:migrate` vise la base de `.env.local`.
- `npm run backup` / `npm run restore -- <fichier>` : export / import JSON dans `backups/` (ignoré par git).
- `scripts/seed-fake-trades.mjs [clear]` : faux historique sur la branche test seulement (refuse de tourner contre la base réelle).

## Échelle et limites

- Ne jamais lire toute une table pour filtrer en JS : `getTrades` et `getTradeResultsByAccount` chargent tous les trades, à remplacer par du SQL avant ~50 000 trades.
- Neon gratuit : 1 Go, 100 CU-heures par mois, 6 h d'historique. Tout appel réveille la base : jamais de polling direct.
- **Cache des pages** : un wrapper qui lit `searchParams` + un composant `"use cache"` qui reçoit des props sérialisables. Toute écriture de données appelle `afterWrite()` (action) ou `invalidateData()` (route) : `src/lib/cache-coverage.test.ts` le vérifie.

## Import et synchro Tradovate

- `Fills.csv` donne les trades ; `Cash History.csv` (facultatif) donne les frais réels. Trades reconstruits en FIFO par compte et contrat ; P&L net = brut − frais. Idempotent (clé = Fill ID). Ne jamais committer d'exports réels (identifiants de compte) : fixtures anonymisées.
- La synchro tourne dans un runner GitHub Actions (`.github/workflows/cloud-sync.yml`, navigateur Playwright). Les routes `/api/sync/*` sont authentifiées par `SYNC_TOKEN`. Les logins Tradovate sont chiffrés (`CREDENTIALS_KEY`) : **jamais de login ni de secret dans git, les journaux ou un message**.
- Un compte dont le solde a franchi le seuil est proposé « blown / closed » à confirmer, jamais changé automatiquement.

## Notes et base de données

- Notes en JSON Tiptap, nettoyées côté serveur (`src/lib/note.ts`, liste blanche).
- Pas de `LIKE` sur une colonne `date`. Driver `neon-http` : pas de transactions interactives, utiliser `db.batch`.

## Plus tard

Bouton FR/EN, onglets Performance / Compare / Calendar des Reports, Progress Tracker, import de `Orders.csv` (stop loss, R-multiple).
