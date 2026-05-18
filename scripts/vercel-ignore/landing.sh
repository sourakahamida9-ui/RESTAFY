#!/usr/bin/env bash
# Vercel ignoreCommand pour le projet "restafybenin" (landing www.restafy.shop).
# Exit 0 = SKIP build, Exit 1 = BUILD.
#
# Logique : on build uniquement si des fichiers dans landing/ ont changé.

set -euo pipefail

# Toujours build sur la branche prod
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  exit 1
fi

# Si git diff échoue (clone shallow), build par sécurité.
if ! git diff HEAD^ HEAD --name-only > /tmp/.vercel-changed 2>/dev/null; then
  exit 1
fi

# Si une ligne commence par landing/ → build, sinon skip.
if grep -q '^landing/' /tmp/.vercel-changed; then
  exit 1
fi

exit 0
