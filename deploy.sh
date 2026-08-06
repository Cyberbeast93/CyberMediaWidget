#!/bin/bash
# Deploy script for CyberMedia Widget
# Run this after pushing changes to GitHub

echo "Deploying CyberMedia Widget..."

cd ~/stream-widget

# Stash any local changes (users, certs, config)
git stash --include-untracked

# Pull latest from GitHub
git pull origin main

# Restore local changes
git stash pop

# Install any new dependencies
npm install

# Restart the server
pm2 restart stream-widget

echo "Deploy complete!"
echo "Widget: https://cy8ermedia.duckdns.org/index.html"
echo "Settings: https://cy8ermedia.duckdns.org/settings.html"
