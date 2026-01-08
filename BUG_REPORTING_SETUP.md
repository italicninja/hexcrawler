# Bug Reporting Setup

This document explains how to configure the bug reporting feature for the Hexcrawler project.

## Overview

The bug reporting feature allows users to submit bug reports directly from the game client to GitHub Issues. When a user submits a bug report, it automatically includes:

- User's bug description
- Current game log (all log entries)
- Environment information (git branch, commit, user agent)
- Timestamp

## Setup Instructions

### 1. Generate a GitHub Personal Access Token (PAT)

1. Go to GitHub Settings: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Hexcrawler Bug Reports")
4. Set expiration (recommend: No expiration for production, or 90 days for testing)
5. Select scopes:
   - ✅ **repo** (Full control of private repositories)
     - This is required because the repository is private
6. Click "Generate token"
7. **IMPORTANT:** Copy the token immediately - you won't be able to see it again!

### 2. Configure the Environment Variable

#### For Development:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and replace the placeholder with your actual PAT:
   ```
   VITE_GITHUB_PAT=ghp_your_actual_token_here
   ```

3. **NEVER commit the `.env` file** - it's already in `.gitignore`

#### For Production/Deployment:

Set the environment variable in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Netlify: Site Settings → Build & Deploy → Environment
- Other platforms: Consult their documentation

Variable name: `VITE_GITHUB_PAT`
Variable value: Your GitHub PAT

### 3. Restart the Development Server

After adding the `.env` file, restart your dev server:

```bash
npm run dev
```

## Testing the Feature

1. Run the game in development mode
2. Click the "Report Bug" button in the bottom-right toolbar
3. Fill out the bug description
4. Click "Submit Bug Report"
5. Check your GitHub repository's Issues tab - you should see a new issue!

## Security Notes

- The PAT is only used client-side for submitting issues
- The token is embedded in the built JavaScript bundle
- For production use, consider implementing a server-side proxy to keep the PAT secure
- Rotate the PAT periodically for security
- If the token is ever compromised, revoke it immediately at https://github.com/settings/tokens

## Troubleshooting

### "GitHub PAT not configured" error
- Make sure the `.env` file exists and contains `VITE_GITHUB_PAT=...`
- Restart your development server after creating `.env`
- Check that the variable name is exactly `VITE_GITHUB_PAT` (case-sensitive)

### "Failed to submit bug report" error
- Verify the PAT has the `repo` scope
- Check that the token hasn't expired
- Ensure the repository name in `src/utils/githubApi.js` is correct (`italicninja/hexcrawler`)
- Check browser console for detailed error messages

### Issues not appearing in GitHub
- Verify you have write access to the repository
- Check that the PAT belongs to a user with repository access
- Look for the issue in the repository's Issues tab

## File Structure

```
src/
├── components/
│   └── ui/
│       ├── BottomToolbar.jsx       # Bug report button
│       ├── BugReportModal.jsx      # Bug report modal component
│       └── BugReportModal.css      # Modal styling
└── utils/
    └── githubApi.js                # GitHub API integration

.env.example                         # Template for environment variables
.env                                # Your actual PAT (DO NOT COMMIT)
```

## Future Improvements

- Add server-side proxy for PAT security
- Include system information (OS, browser version)
- Add screenshot attachment capability
- Implement issue search to prevent duplicates
- Add ability to attach save files
