# Deployment Guide

A simple guide for deploying changes to your server.

## Overview

```
[Your Computer] --git push--> [GitHub] --git pull--> [Server]
```

---

## Step 1: Make Changes Locally

Edit your code on your local machine using your preferred editor.

---

## Step 2: Push Changes to GitHub

Open a terminal in your project folder and run:

```bash
# Check what files changed
git status

# Add all changed files
git add .

# Commit with a message describing what you changed
git commit -m "your message here"

# Push to GitHub
git push origin main
```

### Quick One-Liner
```bash
git add . && git commit -m "your message" && git push origin main
```

---

## Step 3: Deploy to Server

### Connect to Your Server
```bash
ssh root@195.201.95.159
```

### Pull and Restart
```bash
cd ~/service-parts
git pull origin main
npm run build
pm2 restart service-parts
```

### Quick One-Liner (after connecting via SSH)
```bash
cd ~/service-parts && git pull origin main && npm run build && pm2 restart service-parts
```

---

## Useful Commands

### On Your Local Machine

| Command | Description |
|---------|-------------|
| `git status` | See what files changed |
| `git add .` | Stage all changes |
| `git add filename` | Stage a specific file |
| `git commit -m "message"` | Save changes with a message |
| `git push origin main` | Upload to GitHub |
| `git pull origin main` | Download latest from GitHub |
| `git log --oneline -5` | See last 5 commits |

### On Your Server

| Command | Description |
|---------|-------------|
| `pm2 status` | Check if app is running |
| `pm2 restart service-parts` | Restart the app |
| `pm2 logs service-parts` | View app logs |
| `pm2 logs service-parts --lines 100` | View last 100 log lines |
| `pm2 stop service-parts` | Stop the app |
| `pm2 start service-parts` | Start the app |

---

## Troubleshooting

### "Failed to find Server Action" Error
You forgot to rebuild after pulling. Run:
```bash
npm run build && pm2 restart service-parts
```

### Changes Not Showing
1. Make sure you pushed from local: `git push origin main`
2. Make sure you pulled on server: `git pull origin main`
3. Rebuild and restart: `npm run build && pm2 restart service-parts`

### Check Server Logs for Errors
```bash
pm2 logs service-parts --lines 50
```

### App Won't Start
```bash
# Check for errors
npm run build

# If build succeeds, restart
pm2 restart service-parts
```

---

## Complete Workflow Example

### On Your Computer:
```bash
# 1. Make your code changes in your editor

# 2. Open terminal in project folder

# 3. Push changes
git add .
git commit -m "fix: updated image upload"
git push origin main
```

### On Your Server:
```bash
# 1. Connect via SSH
ssh root@195.201.95.159

# 2. Deploy
cd ~/service-parts && git pull origin main && npm run build && pm2 restart service-parts
```

Done! Your changes are now live.
