# Cyber Media Widget

A customizable OBS stream overlay widget that displays currently playing tracks from Spotify and YouTube with multiple gaming-themed presets.

## Features

- **Spotify Integration** - Shows currently playing track with album art, artist, and progress bar
- **YouTube Music Desktop Integration** - Real-time playback state through the local desktop app
- **12 Gaming Themes** - Dark, Light, Neon, Nord, Fallout, Borderlands, 7 Days to Die, Half-Life, Minecraft, Cyberpunk, Dynamic, Dynamic Advanced
- **OBS Ready** - Transparent background, configurable size, works as Browser Source
- **Keyboard Shortcuts** - Press 'T' to cycle themes, double-click widget to change theme
- **Web Settings Page** - Easy configuration UI for API keys and themes
- **Multi-User Support** - Each user has their own isolated credentials

## Themes

| Theme | Style |
|-------|-------|
| Dark | Default dark mode with red accents |
| Light | Clean light mode with purple accents |
| Neon | Cyberpunk glow with cyan/magenta |
| Nord | Arctic blue palette |
| Fallout | Vault-Tec green terminal style |
| Borderlands | Cel-shaded orange/yellow |
| 7 Days to Die | Blood red post-apocalyptic |
| Half-Life | Lambda orange/grey |
| Minecraft | Blocky grass-green pixel style |
| Cyberpunk | Neon pink/cyan glitch style |
| Dynamic | Album-art color palette |
| Dynamic Advanced | Album-art palette with blurred background |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Server

```bash
npm start
```

### 3. Open Settings

Navigate to `http://localhost:8080/settings.html` in your browser.

Production settings: `https://cy8ermedia.duckdns.org/settings.html`

### 4. Connect Spotify

1. Enter your Spotify Client ID and Secret in the settings
2. Click "Save API Keys"
3. Click "Connect Spotify"
4. Login and authorize the app
5. You'll be redirected back with a success message

### 5. Get OBS URL

Copy the generated URL from settings and add as Browser Source in OBS.

### YouTube Music Requirement

YouTube playback requires the [YouTube Music Desktop app for Windows](https://github.com/ytmdesktop/ytmdesktop/releases/download/v2.0.11/YouTube.Music.Desktop.App-2.0.11.Setup.exe) running on the same computer as OBS. The dashboard connects to its local real-time service.

## OBS Setup

1. Open OBS Studio
2. Add a new **Browser Source**
3. Set URL to your hosted widget URL (includes `?user=your-id`)
4. Set width/height to **1400 x 550**
5. The widget renders at 1200 x 350 with a 100px buffer on every side for the glow effect

## URL Parameters

Customize the widget via URL parameters:

```
https://cy8ermedia.duckdns.org/index.html?user=abc123
```

| Parameter | Options | Description |
|-----------|---------|-------------|
| `theme` | theme name | Optional preview theme; applied themes are loaded from the user's settings |
| `user` | user ID | Load that user's Spotify credentials |

## Project Structure

```
cybermedia-widget/
├── server.js           # Express server (OAuth + static files)
├── package.json        # Node.js dependencies
├── index.html          # Main widget page
├── settings.html       # Configuration UI
├── css/
│   ├── main.css        # Widget base styles
│   ├── settings.css    # Settings page styles
│   └── themes/         # Theme CSS files
├── js/
│   ├── config.js       # Configuration
│   ├── themes.js       # Theme management
│   ├── spotify.js      # Spotify API integration
│   ├── youtube.js      # YouTube API integration
│   ├── app.js          # Widget application
│   └── settings.js     # Settings page logic
├── users/              # Per-user credentials (gitignored)
└── assets/
    └── default-artwork.svg
```

## Deployment

### PM2 (Current Setup)

```bash
# Install PM2
npm install -g pm2

# Start the app
pm2 start server.js --name cybermedia-widget

# Save PM2 config
pm2 save
pm2 startup
```

### Git Deployment

```bash
# Clone on server
git clone https://github.com/Cyberbeast93/CyberMediaWidget.git
cd CyberMediaWidget

# Install and start
npm install
pm2 start server.js --name cybermedia-widget
```

## Spotify Developer Setup

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add your redirect URI to the app settings:
   - Production: `https://cy8ermedia.duckdns.org/callback`
4. Copy Client ID and Client Secret to the settings page

## Troubleshooting

### Spotify not connecting?
- Verify redirect URI in Spotify Dashboard matches your server URL
- Check settings page has correct Client ID and Client Secret
- Ensure you're accessing via `http://` (not `file://`)

### Widget not showing in OBS?
- Use the hosted URL with `?user=your-id` parameter
- Set Browser Source dimensions to 1200x350
- Check OBS Browser Source is using your server URL

### Token expired?
- The widget auto-refreshes tokens via the backend
- If issues persist, click "Reconnect Spotify" in settings

## License

MIT
