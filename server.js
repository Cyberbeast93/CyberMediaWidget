const express = require('express');
const https = require('https');
const http = require('http');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const HTTPS_PORT = 8443;
const HTTP_PORT = 8080;

const USERS_DIR = path.join(__dirname, 'users');
const CERT_FILE = path.join(__dirname, 'certs', 'cert.pem');
const KEY_FILE = path.join(__dirname, 'certs', 'key.pem');

if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
}

function generateUserId() {
    return crypto.randomBytes(16).toString('hex');
}

function getUserConfigPath(userId) {
    return path.join(USERS_DIR, `${userId}.json`);
}

function loadUserConfig(userId) {
    try {
        const configPath = getUserConfigPath(userId);
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading user config:', e);
    }
    return {};
}

function saveUserConfig(userId, config) {
    try {
        const configPath = getUserConfigPath(userId);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.error('Error saving user config:', e);
        return false;
    }
}

function deleteUserConfig(userId) {
    try {
        const configPath = getUserConfigPath(userId);
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        return true;
    } catch (e) {
        console.error('Error deleting user config:', e);
        return false;
    }
}

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
app.use(express.static(path.join(__dirname)));

app.get('/api/user/create', (req, res) => {
    const userId = generateUserId();
    saveUserConfig(userId, {
        spotifyClientId: '',
        spotifyClientSecret: '',
        youtubeApiKey: '',
        redirectUri: '',
        createdAt: new Date().toISOString()
    });
    res.json({ userId });
});

app.get('/api/config/:userId', (req, res) => {
    const { userId } = req.params;
    const config = loadUserConfig(userId);
    
    if (!config.spotifyClientId && !config.youtubeApiKey) {
        return res.json({ exists: false });
    }

    res.json({
        exists: true,
        spotifyClientId: config.spotifyClientId ? '***' + config.spotifyClientId.slice(-4) : '',
        spotifyClientSecret: config.spotifyClientSecret ? '***' : '',
        youtubeApiKey: config.youtubeApiKey ? '***' + config.youtubeApiKey.slice(-4) : '',
        redirectUri: config.redirectUri || '',
        hasSpotify: !!config.spotifyClientId && !!config.spotifyClientSecret,
        hasYouTube: !!config.youtubeApiKey
    });
});

app.post('/api/config/:userId', (req, res) => {
    const { userId } = req.params;
    const { spotifyClientId, spotifyClientSecret, youtubeApiKey, redirectUri } = req.body;

    const currentConfig = loadUserConfig(userId);

    const newConfig = {
        ...currentConfig,
        spotifyClientId: spotifyClientId !== undefined ? spotifyClientId : currentConfig.spotifyClientId,
        spotifyClientSecret: spotifyClientSecret !== undefined ? spotifyClientSecret : currentConfig.spotifyClientSecret,
        youtubeApiKey: youtubeApiKey !== undefined ? youtubeApiKey : currentConfig.youtubeApiKey,
        redirectUri: redirectUri || currentConfig.redirectUri
    };

    if (saveUserConfig(userId, newConfig)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to save config' });
    }
});

app.delete('/api/config/:userId', (req, res) => {
    const { userId } = req.params;
    if (deleteUserConfig(userId)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to delete config' });
    }
});

app.get('/api/tokens/:userId', (req, res) => {
    const { userId } = req.params;
    const config = loadUserConfig(userId);
    res.json({
        accessToken: config.accessToken || null,
        refreshToken: config.refreshToken || null,
        clientId: config.spotifyClientId || null
    });
});

app.get('/auth/spotify', (req, res) => {
    const { userId } = req.query;
    const config = loadUserConfig(userId);
    const clientId = config.spotifyClientId;

    if (!clientId) {
        return res.redirect(`/settings.html?user=${userId}&error=no_client_id`);
    }

    const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state'
    ];

    const host = req.get('host');
    const redirectUri = `https://${host}/callback`;

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        state: userId,
        show_dialog: 'true'
    });

    res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    const userId = req.query.state;

    if (error) {
        return res.redirect(`/settings.html?user=${userId}&error=${error}`);
    }

    if (!code) {
        return res.redirect(`/settings.html?user=${userId}&error=no_code`);
    }

    const config = loadUserConfig(userId);
    const clientId = config.spotifyClientId;
    const clientSecret = config.spotifyClientSecret;
    const host = req.get('host');
    const redirectUri = `https://${host}/callback`;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });

        if (!response.ok) {
            throw new Error('Token exchange failed');
        }

        const data = await response.json();
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;

        const updatedConfig = loadUserConfig(userId);
        updatedConfig.accessToken = accessToken;
        updatedConfig.refreshToken = refreshToken;
        saveUserConfig(userId, updatedConfig);

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Spotify Connected</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        background: #0f0f1a;
                        color: #fff;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .success {
                        text-align: center;
                        padding: 40px;
                        background: #1a1a2e;
                        border-radius: 16px;
                        border: 1px solid #00ff88;
                    }
                    h1 { color: #00ff88; margin-bottom: 16px; }
                    p { color: #808080; margin-bottom: 24px; }
                    .btn {
                        background: #00ff88;
                        color: #0a0a0a;
                        border: none;
                        padding: 12px 32px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    .btn:hover { background: #00cc6a; }
                </style>
            </head>
            <body>
                <div class="success">
                    <h1>Spotify Connected!</h1>
                    <p>You can close this window and return to settings.</p>
                    <button class="btn" onclick="window.location.href='/settings.html?user=${userId}'">Close Window</button>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Auth error:', error);
        res.redirect(`/settings.html?user=${userId}&error=auth_failed`);
    }
});

app.post('/api/spotify/refresh/:userId', async (req, res) => {
    const { userId } = req.params;
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: 'No refresh token' });
    }

    const config = loadUserConfig(userId);
    const clientId = config.spotifyClientId;
    const clientSecret = config.spotifyClientSecret;

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            throw new Error('Token refresh failed');
        }

        const data = await response.json();
        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token || refreshToken;

        const updatedConfig = loadUserConfig(userId);
        updatedConfig.accessToken = newAccessToken;
        updatedConfig.refreshToken = newRefreshToken;
        saveUserConfig(userId, updatedConfig);

        res.json({
            access_token: newAccessToken,
            refresh_token: newRefreshToken
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ error: 'Refresh failed' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`HTTP server running on port ${HTTP_PORT}`);
    console.log(`Widget: http://92.4.155.206:${HTTP_PORT}/index.html`);
});

if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    const httpsOptions = {
        key: fs.readFileSync(KEY_FILE),
        cert: fs.readFileSync(CERT_FILE)
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
        console.log(`HTTPS server running on port ${HTTPS_PORT}`);
        console.log(`Settings: https://92.4.155.206:${HTTPS_PORT}/settings.html`);
    });
}
