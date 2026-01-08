import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';

// Get git information at build time
function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const branch = execSync('git branch --show-current').toString().trim();
    
    // Get last 50 commits for changelog
    const gitLog = execSync('git log -50 --pretty=format:"%h|%s|%ai"')
      .toString()
      .trim();
    
    return { commit, branch, gitLog };
  } catch (error) {
    console.warn('Failed to get git info:', error.message);
    return { commit: 'unknown', branch: 'unknown', gitLog: '' };
  }
}

// Read package.json version
function getAppVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
    return packageJson.version;
  } catch (error) {
    console.warn('Failed to read package.json:', error.message);
    return 'unknown';
  }
}

const gitInfo = getGitInfo();
const appVersion = getAppVersion();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false
  },
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitInfo.commit),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(gitInfo.branch),
    'import.meta.env.VITE_GIT_LOG': JSON.stringify(gitInfo.gitLog),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion)
  }
});
