#!/usr/bin/env bash
# Vercel ignoreCommand pour le projet "restafy-prod" (l'app SPA principale).
# Exit 0 = SKIP build (Vercel ne déploie pas).
# Exit 1 = BUILD (comportement par défaut).
#
# Logique : on skip si TOUS les fichiers changés sont dans landing/ ou
# qr_scanner_offline/ (ces sous-projets ont leurs propres Vercel projects et
# se déploient via leurs propres ignoreCommand). Sinon on build.
#
# Cas spéciaux :
# - Si git diff échoue (clone shallow sans HEAD^), on build (safe default).
# - Toujours build sur la branche de production (main) pour pas se planter.

set -euo pipefail

# Toujours build sur la branche prod
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  exit 1
fi

# Récupère la liste des fichiers changés. Si ça échoue → build par sécurité.
if ! changed=$(git diff HEAD^ HEAD --name-only 2>/dev/null); then
  exit 1
fi

# Si aucun changement détecté (cas anormal mais possible), on skip.
if [ -z "$changed" ]; then
  exit 0
fi

# Cherche un fichier modifié EN DEHORS de landing/ ou qr_scanner_offline/.
# `grep -qvE` exit 0 si au moins une ligne ne matche pas → build.
if echo "$changed" | grep -qvE '^(landing|qr_scanner_offline|CEO)/'; then
  exit 1
fi

# Sinon tous les changements sont dans des sous-projets isolés → skip.
exit 0
