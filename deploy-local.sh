#!/bin/bash
# Local deploy script - uploads changes to server via SCP
# Use this if git deployment isn't working

SERVER="ubuntu@92.4.155.206"
SSH_KEY="$HOME/.ssh/oci_key"
REMOTE_DIR="~/stream-widget"

echo "Deploying to server..."

# Files to upload
FILES=(
    "server.js"
    "index.html"
    "settings.html"
    "package.json"
    "css/main.css"
    "css/settings.css"
    "css/themes/*.css"
    "js/app.js"
    "js/config.js"
    "js/settings.js"
    "js/spotify.js"
    "js/youtube.js"
    "js/themes.js"
)

for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "Uploading $file..."
        scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$file" "$SERVER:$REMOTE_DIR/$file"
    fi
done

echo "Restarting server..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SERVER" "pm2 restart stream-widget"

echo "Deploy complete!"
