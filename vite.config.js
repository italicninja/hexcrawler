import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Get git information at build time
function getGitInfo() {
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    const branch = execSync('git branch --show-current').toString().trim();
    return { commit, branch };
  } catch (error) {
    console.warn('Failed to get git info:', error.message);
    return { commit: 'unknown', branch: 'unknown' };
  }
}

const gitInfo = getGitInfo();

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false
  },
  define: {
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitInfo.commit),
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(gitInfo.branch)
  }
});
