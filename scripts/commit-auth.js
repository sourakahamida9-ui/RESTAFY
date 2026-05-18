#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('🔐 Committing Cross-Subdomain Authentication Solution...\n');

try {
  // Configure git identity
  execSync('git config user.email "v0[bot]@users.noreply.github.com"', {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  execSync('git config user.name "v0[bot]"', {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Add all new files
  const filesToAdd = [
    'qr_scanner_offline/server/_core/crossSubdomainAuth.ts',
    'qr_scanner_offline/server/_core/corsConfig.ts',
    'qr_scanner_offline/client/src/hooks/useCrossSubdomainAuth.ts',
    'qr_scanner_offline/server/routers/auth.ts',
    'CROSS_SUBDOMAIN_AUTH.md',
    'MIGRATION_GUIDE.md',
    '.env.cross-subdomain.example',
    'qr_scanner_offline/server/_core/cookies.ts',
  ];

  for (const file of filesToAdd) {
    try {
      execSync(`git add "${file}"`, {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      console.warn(`⚠️  Could not add file: ${file}`);
    }
  }

  // Commit with detailed message
  const commitMessage = `feat: implement cross-subdomain authentication system

- Add cross-domain cookie configuration for .restafy.shop
- Implement JWT token system with refresh token rotation
- Add comprehensive CORS configuration for secure cross-subdomain requests
- Create client-side authentication hook with PWA offline support
- Implement server-side authentication router with token validation
- Add IndexedDB persistence layer for offline capability
- Include complete documentation and migration guide
- Support for multiple subdomains (scan, app, admin) sharing auth state

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>`;

  execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  console.log('\n✅ Successfully committed to main branch!');
  console.log('📚 Documentation available in CROSS_SUBDOMAIN_AUTH.md');
  console.log('🔄 Migration guide available in MIGRATION_GUIDE.md');
} catch (error) {
  console.error('❌ Error during commit:', error.message);
  process.exit(1);
}
