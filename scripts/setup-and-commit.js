#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');

try {
  process.chdir(projectRoot);
  console.log(`📂 Working directory: ${process.cwd()}`);

  // Check if .git exists
  const gitDir = path.join(projectRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    console.log('🔧 Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });
    execSync('git config user.email "v0[bot]@users.noreply.github.com"', { stdio: 'inherit' });
    execSync('git config user.name "v0[bot]"', { stdio: 'inherit' });
  }

  // Check if we have a remote
  try {
    execSync('git remote get-url origin', { stdio: 'pipe' });
    console.log('✅ Remote origin already configured');
  } catch {
    console.log('🔗 Adding remote origin...');
    execSync('git remote add origin https://github.com/Souraka229/RESTAFY2.git', { stdio: 'inherit' });
  }

  // Stage all changes
  console.log('📝 Staging changes...');
  execSync('git add .', { stdio: 'inherit' });

  // Create commit
  console.log('💾 Creating commit...');
  const commitMessage = `feat: implement cross-subdomain authentication system

- Add cross-domain cookie configuration for subdomain sharing
- Implement JWT token system with refresh tokens
- Add CORS configuration for secure cross-subdomain requests
- Create client-side authentication hook with PWA offline support
- Add server-side authentication router with session management
- Implement IndexedDB persistence for offline capability
- Add comprehensive documentation and migration guides

This enables seamless authentication across multiple subdomains (scan.restafy.shop, app.restafy.shop, etc.)
with proper security, offline support, and PWA compatibility.`;

  execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });

  console.log('\n✨ Successfully committed cross-subdomain authentication solution!');
  console.log('📌 Changes are ready to be pushed to the repository.');
} catch (error) {
  console.error('❌ Error during setup and commit:', error.message);
  process.exit(1);
}
