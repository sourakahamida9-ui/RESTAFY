#!/usr/bin/env bash
# Vercel ignoreCommand pour le projet "restascan" (scanner scan.restafy.shop).
# Exit 0 = SKIP build, Exit 1 = BUILD.
#
# Logique : on build uniquement si des fichiers dans qr_scanner_offline/ ont
# changé.

set -euo pipefail

# Toujours build sur la branche prod
if [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  exit 1
fi

if ! git diff HEAD^ HEAD --name-only > /tmp/.vercel-changed 2>/dev/null; then
  exit 1
fi

if grep -q '^qr_scanner_offline/' /tmp/.vercel-changed; then
  exit 1
fi

exit 0
