---
name: deploy-web-video
description: >-
  Step-by-step procedure and runbook for versioning, committing, and deploying
  the Web Video streaming PWA to GitHub Pages and remote repository.
  Use when the user asks to deploy, release, push updates, bump version, or publish the web video app.
---

# Web Video PWA Deployment Runbook

This skill outlines the strict workflow for publishing updates and deploying the `web_video` application to GitHub Pages.

## Core Rules & Lifecycle

Because this application runs as a **Progressive Web App (PWA)** with aggressive client-side caching via Service Worker (`sw.js`), simply pushing code is NOT enough for mobile users to receive changes immediately. You **MUST** bump the cache version across all target files with every deployment.

---

## Step 1: Pre-deployment Checks

1. Verify JavaScript syntax for core application files:
   ```bash
   node --check app.js
   node --check sw.js
   node --check server.js
   ```
2. If playlist/scraping updates were requested:
   ```bash
   node update_all.js
   ```

---

## Step 2: Version Bumping (Cache-Busting)

Determine the current version (e.g. `v1.0.11`) and determine the next version (e.g. `v1.0.12`).
Update the version string across the following 3 files:

1. **`sw.js`**:
   - Update `CACHE_VERSION = 'v1.0.X';`
   - Update cache array strings: `'./style.css?v=1.0.X'`, `'./app.js?v=1.0.X'`
2. **`index.html`**:
   - Update stylesheet link: `<link rel="stylesheet" href="style.css?v=1.0.X" />`
   - Update script tag: `<script src="app.js?v=1.0.X"></script>`
3. **`package.json`**:
   - Update `"version": "1.0.X"`

---

## Step 3: Git Staging, Commit & Push

1. Stage all changes:
   ```bash
   git add -A
   ```
2. Commit with conventional commit message:
   - For bug fixes: `git commit -m "fix(...): description and bump to v1.0.X"`
   - For features: `git commit -m "feat(...): description and bump to v1.0.X"`
   - For chore/versions: `git commit -m "chore: bump version to v1.0.X to force PWA deploy"`
3. Push to master branch:
   ```bash
   git push origin master
   ```

---

## Step 4: Verification

1. Ensure working directory is clean:
   ```bash
   git status
   ```
2. GitHub Pages will automatically deploy within 1-2 minutes.
3. Inform the user of the new version number and commit hash.
