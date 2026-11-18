# Consignes pour les agents de code

Le contexte du projet, les conventions et les commandes sont dans `CLAUDE.md`. Ce fichier ne garde que les règles qui valent pour n'importe quel agent.

## Next.js

Cette version de Next.js (16) a des changements incompatibles avec les versions précédentes : API, conventions, structure des fichiers. Lire le guide concerné dans `node_modules/next/dist/docs/` avant d'écrire du code, et tenir compte des avertissements de dépréciation.

## Règles

- Ne jamais lancer de test ni de script contre la base réelle : utiliser la branche Neon `test` (`npm run dev:test`).
- Aucun secret (mot de passe, clé, URL de base de données) dans un fichier, un commit ou un message. Ne pas lire les fichiers `.env*`.
- Avant un commit : `npm run format:check`, `npm run lint`, `npm run typecheck` et `npm test`.
- Ne pas committer, pousser ni appliquer une migration sans l'accord du propriétaire du dépôt.
