# Dossier `app/` (routes style Next.js)

Ce répertoire contient des fichiers **`app/api/**/route.ts`** au format **App Router** (Next.js).

**Le déploiement actuel de l’application est Vite + Vercel** : seuls les handlers sous **`api/`** à la **racine du dépôt** sont exposés comme fonctions serverless. Le dossier `app/api/` **n’est pas monté** dans ce flux.

- **À utiliser en production** : `api/` (voir `vercel.json` et le README racine).
- **`app/api/`** : référence historique / alignement avec certaines Edge Functions ; ne pas s’y fier pour les URLs déployées tant que vous n’avez pas un projet Next.js dédié.
