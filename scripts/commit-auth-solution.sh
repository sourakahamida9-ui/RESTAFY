#!/bin/bash

# Cross-Subdomain Authentication Solution Commit Script
# This script commits all authentication improvements to the main branch

set -e

echo "🔐 Committing Cross-Subdomain Authentication Solution..."

# Configure git identity
git config user.email "v0[bot]@users.noreply.github.com"
git config user.name "v0[bot]"

# Add all new files
git add qr_scanner_offline/server/_core/crossSubdomainAuth.ts
git add qr_scanner_offline/server/_core/corsConfig.ts
git add qr_scanner_offline/client/src/hooks/useCrossSubdomainAuth.ts
git add qr_scanner_offline/server/routers/auth.ts
git add CROSS_SUBDOMAIN_AUTH.md
git add MIGRATION_GUIDE.md
git add .env.cross-subdomain.example

# Add modified files
git add qr_scanner_offline/server/_core/cookies.ts

# Commit with detailed message
git commit -m "feat: implement cross-subdomain authentication system

- Add cross-domain cookie configuration for .restafy.shop
- Implement JWT token system with refresh token rotation
- Add comprehensive CORS configuration for secure cross-subdomain requests
- Create client-side authentication hook with PWA offline support
- Implement server-side authentication router with token validation
- Add IndexedDB persistence layer for offline capability
- Include complete documentation and migration guide
- Support for multiple subdomains (scan, app, admin) sharing auth state

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"

echo "✅ Successfully committed to main branch!"
echo "📚 Documentation available in CROSS_SUBDOMAIN_AUTH.md"
echo "🔄 Migration guide available in MIGRATION_GUIDE.md"
