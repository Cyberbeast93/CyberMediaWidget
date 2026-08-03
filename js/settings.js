const SettingsApp = {
    userId: null,
    settings: {
        theme: 'dark',
        pollInterval: 5
    },

    async init() {
        this.cacheElements();
        await this.getUserId();
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
        this.updateObsUrl();
        this.checkSpotifyStatus();
        this.refreshPreview();
        this.checkUrlParams();
        await this.loadServerConfig();
    },

    cacheElements() {
        this.elements = {
            spotifyClientId: document.getElementById('spotify-client-id'),
            spotifyClientSecret: document.getElementById('spotify-client-secret'),
            youtubeApiKey: document.getElementById('youtube-api-key'),
            redirectUri: document.getElementById('redirect-uri'),
            pollInterval: document.getElementById('poll-interval'),
            themeGrid: document.getElementById('theme-grid'),
            obsUrl: document.getElementById('obs-url'),
            copyUrl: document.getElementById('copy-url'),
            refreshPreview: document.getElementById('refresh-preview'),
            saveSettings: document.getElementById('save-settings'),
            saveApiKeys: document.getElementById('save-api-keys'),
            spotifyAuth: document.getElementById('spotify-auth'),
            resetSettings: document.getElementById('reset-settings'),
            previewFrame: document.getElementById('preview-frame'),
            spotifyStatus: document.getElementById('spotify-status'),
            serverStatus: document.getElementById('server-status'),
            userIdDisplay: document.getElementById('user-id-display')
        };
    },

    async getUserId() {
        const urlParams = new URLSearchParams(window.location.search);
        let userId = urlParams.get('user');

        if (!userId) {
            userId = localStorage.getItem('cyber-media-user-id');
        }

        if (!userId) {
            try {
                const response = await fetch('/api/user/create');
                const data = await response.json();
                userId = data.userId;
                localStorage.setItem('cyber-media-user-id', userId);
            } catch (error) {
                console.error('Failed to create user:', error);
                userId = 'default';
            }
        }

        this.userId = userId;
        localStorage.setItem('cyber-media-user-id', userId);

        if (urlParams.get('user') !== userId) {
            window.history.replaceState({}, document.title, `?user=${userId}`);
        }

        if (this.elements.userIdDisplay) {
            this.elements.userIdDisplay.textContent = `User ID: ${userId.substring(0, 8)}...`;
        }
    },

    bindEvents() {
        this.elements.themeGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('theme-btn')) {
                this.selectTheme(e.target.dataset.theme);
            }
        });

        this.elements.copyUrl.addEventListener('click', () => this.copyObsUrl());
        this.elements.refreshPreview.addEventListener('click', () => this.refreshPreview());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        this.elements.saveApiKeys.addEventListener('click', () => this.saveApiKeys());
        this.elements.spotifyAuth.addEventListener('click', () => this.connectSpotify());
        this.elements.resetSettings.addEventListener('click', () => this.resetSettings());

        window.addEventListener('message', (e) => {
            if (e.data === 'spotify-connected') {
                this.updateSpotifyStatus(true);
                this.refreshPreview();
            }
        });
    },

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('error');

        if (error) {
            this.showToast(`Spotify auth failed: ${error}`, true);
            window.history.replaceState({}, document.title, `?user=${this.userId}`);
        }
    },

    loadSettings() {
        const saved = localStorage.getItem('cyber-media-settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
    },

    async loadServerConfig() {
        try {
            const response = await fetch(`/api/config/${this.userId}`);
            if (response.ok) {
                const config = await response.json();
                if (config.exists) {
                    if (config.spotifyClientId) {
                        this.elements.spotifyClientId.value = config.spotifyClientId;
                    }
                    if (config.spotifyClientSecret) {
                        this.elements.spotifyClientSecret.value = config.spotifyClientSecret;
                    }
                    if (config.youtubeApiKey) {
                        this.elements.youtubeApiKey.value = config.youtubeApiKey;
                    }
                    if (config.redirectUri) {
                        this.elements.redirectUri.value = config.redirectUri;
                    }
                    this.updateServerStatus(true);
                } else {
                    this.updateServerStatus(false);
                }
            }
        } catch (error) {
            console.log('No server config found or server not running');
            this.updateServerStatus(false);
        }
    },

    updateServerStatus(connected) {
        if (this.elements.serverStatus) {
            this.elements.serverStatus.textContent = connected ? 'Server connected' : 'Server not running';
            this.elements.serverStatus.className = `server-status ${connected ? 'connected' : ''}`;
        }
    },

    saveSettings() {
        this.settings.pollInterval = parseInt(this.elements.pollInterval.value) || 5;
        localStorage.setItem('cyber-media-settings', JSON.stringify(this.settings));
        this.updateObsUrl();
        this.showToast('Settings saved!');
        setTimeout(() => this.refreshPreview(), 100);
    },

    async saveApiKeys() {
        const clientId = this.elements.spotifyClientId.value;
        const clientSecret = this.elements.spotifyClientSecret.value;
        const youtubeKey = this.elements.youtubeApiKey.value;

        const host = window.location.hostname;
        const redirectUri = `https://${host}:8443/callback`;

        try {
            const response = await fetch(`/api/config/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    spotifyClientId: clientId,
                    spotifyClientSecret: clientSecret,
                    youtubeApiKey: youtubeKey,
                    redirectUri: redirectUri
                })
            });

            if (response.ok) {
                this.elements.redirectUri.value = redirectUri;
                this.showToast('API keys saved to server!');
                this.updateServerStatus(true);
            } else {
                this.showToast('Failed to save to server', true);
            }
        } catch (error) {
            this.showToast('Failed to connect to server', true);
        }
    },

    selectTheme(theme) {
        this.settings.theme = theme;
        this.elements.themeGrid.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
        localStorage.setItem('cyber-media-settings', JSON.stringify(this.settings));
        localStorage.setItem('widget-theme', theme);
        this.updateObsUrl();
        this.refreshPreview();
    },

    updateObsUrl() {
        const host = window.location.hostname;
        const params = new URLSearchParams({
            theme: this.settings.theme,
            user: this.userId
        });
        this.elements.obsUrl.value = `http://${host}:8080/index.html?${params.toString()}`;
    },

    copyObsUrl() {
        const url = this.elements.obsUrl.value;
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('URL copied to clipboard!');
        }).catch(() => {
            this.elements.obsUrl.select();
            document.execCommand('copy');
            this.showToast('URL copied!');
        });
    },

    refreshPreview() {
        const host = window.location.hostname;
        const params = new URLSearchParams({
            theme: this.settings.theme,
            user: this.userId
        });
        const src = `https://${host}:8443/index.html?${params.toString()}&_t=${Date.now()}`;
        this.elements.previewFrame.src = src;
    },

    updateSpotifyStatus(connected) {
        if (this.elements.spotifyStatus) {
            this.elements.spotifyStatus.textContent = connected ? 'Connected' : 'Not connected';
            this.elements.spotifyStatus.className = `spotify-status ${connected ? 'connected' : ''}`;
        }
        if (this.elements.spotifyAuth) {
            this.elements.spotifyAuth.textContent = connected ? 'Reconnect Spotify' : 'Connect Spotify';
        }
    },

    async checkSpotifyStatus() {
        try {
            const response = await fetch(`/api/tokens/${this.userId}`);
            if (response.ok) {
                const data = await response.json();
                this.updateSpotifyStatus(!!data.accessToken);
            }
        } catch (error) {
            this.updateSpotifyStatus(false);
        }
    },

    connectSpotify() {
        const clientId = this.elements.spotifyClientId.value;
        if (!clientId) {
            this.showToast('Please save your Spotify API keys first', true);
            return;
        }
        window.location.href = `/auth/spotify?userId=${this.userId}`;
    },

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings? This will delete your credentials from the server.')) {
            try {
                await fetch(`/api/config/${this.userId}`, { method: 'DELETE' });
            } catch (error) {
                console.error('Failed to delete server config:', error);
            }
            
            localStorage.clear();
            this.settings = {
                theme: 'dark',
                pollInterval: 5
            };
            
            this.elements.spotifyClientId.value = '';
            this.elements.spotifyClientSecret.value = '';
            this.elements.youtubeApiKey.value = '';
            this.elements.redirectUri.value = '';
            
            this.updateUI();
            this.updateObsUrl();
            this.refreshPreview();
            this.updateSpotifyStatus(false);
            this.showToast('Settings reset to defaults');
        }
    },

    updateUI() {
        this.elements.pollInterval.value = this.settings.pollInterval;
        this.elements.themeGrid.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
        });
    },

    showToast(message, isError = false) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SettingsApp.init();
});
