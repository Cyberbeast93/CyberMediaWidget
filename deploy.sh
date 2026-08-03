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
echo "Widget: http://92.4.155.206:8080/index.html"
echo "Settings: https://92.4.155.206:8443/settings.html"
