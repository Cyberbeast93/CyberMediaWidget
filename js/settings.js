const SettingsApp = {
    userId: null,
    appliedTheme: 'dark',
    activeApiTab: 'spotify',
    settings: {
        theme: 'dark',
        pollInterval: 5
    },

    async init() {
        this.cacheElements();
        await this.getUserId();
        this.loadSettings();
        await this.loadServerConfig();
        this.bindEvents();
        this.updateUI();
        this.updateObsUrl();
        this.checkSpotifyStatus();
        this.checkUrlParams();
        this.refreshPreview();
    },

    cacheElements() {
        this.elements = {
            spotifyClientId: document.getElementById('spotify-client-id'),
            spotifyClientSecret: document.getElementById('spotify-client-secret'),
            redirectUri: document.getElementById('redirect-uri'),
            pollInterval: document.getElementById('poll-interval'),
            themeGrid: document.getElementById('theme-grid'),
            apiTabs: document.querySelectorAll('.api-tab'),
            apiPanels: document.querySelectorAll('.api-panel'),
            applyTheme: document.getElementById('apply-theme'),
            themeStatus: document.getElementById('theme-status'),
            obsUrl: document.getElementById('obs-url'),
            copyUrl: document.getElementById('copy-url'),
            refreshPreview: document.getElementById('refresh-preview'),
            saveSettings: document.getElementById('save-settings'),
            saveApiKeys: document.getElementById('save-api-keys'),
            spotifyAuth: document.getElementById('spotify-auth'),
            youtubeConnect: document.getElementById('youtube-connect'),
            youtubeDisconnect: document.getElementById('youtube-disconnect'),
            youtubeStatus: document.getElementById('youtube-desktop-status'),
            youtubeAuthCode: document.getElementById('youtube-auth-code'),
            youtubeAuthCodeValue: document.getElementById('youtube-auth-code-value'),
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
        this.elements.apiTabs.forEach(tab => {
            tab.addEventListener('click', () => this.selectApiTab(tab.dataset.apiTab));
        });

        this.elements.themeGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('theme-btn')) {
                this.selectTheme(e.target.dataset.theme);
            }
        });

        this.elements.applyTheme.addEventListener('click', () => this.applyTheme());
        this.elements.copyUrl.addEventListener('click', () => this.copyObsUrl());
        this.elements.refreshPreview.addEventListener('click', () => this.refreshPreview());
        this.elements.saveSettings.addEventListener('click', () => this.saveSettings());
        this.elements.saveApiKeys.addEventListener('click', () => this.saveApiKeys());
        this.elements.spotifyAuth.addEventListener('click', () => this.connectSpotify());
        this.elements.youtubeConnect.addEventListener('click', () => this.connectYouTube());
        this.elements.youtubeDisconnect.addEventListener('click', () => this.disconnectYouTube());
        this.elements.resetSettings.addEventListener('click', () => this.resetSettings());

        window.addEventListener('message', (e) => {
            if (e.data === 'spotify-connected') {
                this.updateSpotifyStatus(true);
                this.refreshPreview();
            }
        });
    },

    selectApiTab(tabName) {
        this.activeApiTab = tabName;
        this.elements.saveApiKeys.textContent = 'Save Config';

        this.elements.apiTabs.forEach(tab => {
            const isActive = tab.dataset.apiTab === tabName;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        this.elements.apiPanels.forEach(panel => {
            panel.hidden = panel.dataset.apiPanel !== tabName;
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
        this.elements.redirectUri.value = this.getRedirectUri();

        try {
            const response = await fetch(`/api/config/${this.userId}`);
            if (response.ok) {
                const config = await response.json();
                if (config.theme) {
                    this.appliedTheme = config.theme;
                    this.settings.theme = config.theme;
                }
                if (config.exists) {
                    if (config.spotifyClientId) {
                        this.elements.spotifyClientId.value = config.spotifyClientId;
                    }
                    if (config.spotifyClientSecret) {
                        this.elements.spotifyClientSecret.value = config.spotifyClientSecret;
                    }
                    this.updateServerStatus(true);
                } else {
                    this.updateServerStatus(false);
                }

                this.updateYouTubeStatus(!!config.hasYouTubeDesktop);
            }
        } catch (error) {
            console.log('No server config found or server not running');
            this.updateServerStatus(false);
            this.updateYouTubeStatus(false);
        }
    },

    updateServerStatus(connected) {
        if (this.elements.serverStatus) {
            this.elements.serverStatus.textContent = connected ? 'Server connected' : 'Server not running';
            this.elements.serverStatus.className = `server-status ${connected ? 'connected' : ''}`;
        }
    },

    getRedirectUri() {
        return new URL('/callback', window.location.origin).toString();
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

        const redirectUri = this.getRedirectUri();

        try {
            const response = await fetch(`/api/config/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    spotifyClientId: clientId,
                    spotifyClientSecret: clientSecret,
                    redirectUri: redirectUri
                })
            });

            if (response.ok) {
                this.elements.redirectUri.value = redirectUri;
                this.showToast('Configuration saved to server!');
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
        this.updateThemeStatus();
        this.refreshPreview();
    },

    async applyTheme() {
        try {
            const response = await fetch(`/api/config/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ theme: this.settings.theme })
            });

            if (!response.ok) throw new Error('Theme update failed');

            this.appliedTheme = this.settings.theme;
            localStorage.setItem('widget-theme', this.appliedTheme);
            this.updateThemeStatus();
            this.refreshPreview();
            this.showToast('Theme applied to OBS!');
        } catch (error) {
            this.showToast('Failed to apply theme', true);
        }
    },

    updateObsUrl() {
        const params = new URLSearchParams({
            user: this.userId
        });
        const widgetUrl = new URL('/index.html', window.location.origin);
        widgetUrl.search = params.toString();
        this.elements.obsUrl.value = widgetUrl.toString();
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
        const params = new URLSearchParams({
            theme: this.settings.theme,
            preview: '1',
            user: this.userId
        });
        params.set('_t', Date.now());
        const previewUrl = new URL('/index.html', window.location.origin);
        previewUrl.search = params.toString();
        this.elements.previewFrame.src = previewUrl.toString();
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

    async connectYouTube() {
        const bridgeUrl = 'http://localhost:9863';
        const appInfo = {
            appId: 'cyber-media-widget',
            appName: 'Cyber Media Widget',
            appVersion: '1.0.0'
        };

        this.elements.youtubeConnect.disabled = true;
        this.elements.youtubeStatus.textContent = 'Requesting connection code...';
        this.elements.youtubeAuthCode.hidden = true;

        try {
            const codeResponse = await fetch(`${bridgeUrl}/api/v1/auth/requestcode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(appInfo)
            });
            const codeData = await codeResponse.json();

            if (!codeResponse.ok || codeData.statusCode || !codeData.code) {
                throw new Error(codeData.message || 'YouTube Music Desktop is not available');
            }

            this.elements.youtubeAuthCodeValue.textContent = codeData.code;
            this.elements.youtubeAuthCode.hidden = false;
            this.elements.youtubeStatus.textContent = 'Waiting for desktop app approval...';

            const tokenResponse = await fetch(`${bridgeUrl}/api/v1/auth/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    appId: appInfo.appId,
                    code: codeData.code
                })
            });
            const tokenData = await tokenResponse.json();

            if (!tokenResponse.ok || tokenData.statusCode || !tokenData.token) {
                throw new Error(tokenData.message || 'Desktop app approval failed');
            }

            const saveResponse = await fetch(`/api/youtube/token/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: tokenData.token })
            });

            if (!saveResponse.ok) throw new Error('Could not save the desktop connection');

            this.updateYouTubeStatus(true);
            this.updateServerStatus(true);
            this.elements.youtubeAuthCode.hidden = true;
            this.showToast('YouTube Music connected!');
            this.refreshPreview();
        } catch (error) {
            this.updateYouTubeStatus(false);
            this.elements.youtubeAuthCode.hidden = true;
            const message = error instanceof TypeError
                ? 'Could not reach YouTube Music Desktop. Make sure it is installed and running on this computer.'
                : error.message || 'Could not connect to YouTube Music Desktop';
            this.showToast(message, true);
        } finally {
            this.elements.youtubeConnect.disabled = false;
        }
    },

    async disconnectYouTube() {
        try {
            const response = await fetch(`/api/youtube/token/${this.userId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Disconnect failed');

            this.updateYouTubeStatus(false);
            this.showToast('YouTube Music disconnected');
            this.refreshPreview();
        } catch (error) {
            this.showToast('Could not disconnect YouTube Music', true);
        }
    },

    updateYouTubeStatus(connected) {
        if (!this.elements.youtubeStatus) return;

        this.elements.youtubeStatus.textContent = connected ? 'Connected to YouTube Music Desktop' : 'Not connected';
        this.elements.youtubeStatus.className = `youtube-desktop-status ${connected ? 'connected' : ''}`;
        this.elements.youtubeConnect.textContent = connected ? 'Reconnect YouTube Music' : 'Connect YouTube Music';
        this.elements.youtubeDisconnect.hidden = !connected;
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
            this.appliedTheme = 'dark';
            
            this.elements.spotifyClientId.value = '';
            this.elements.spotifyClientSecret.value = '';
            this.elements.redirectUri.value = this.getRedirectUri();
            
            this.updateUI();
            this.updateObsUrl();
            this.refreshPreview();
            this.updateSpotifyStatus(false);
            this.updateYouTubeStatus(false);
            this.showToast('Settings reset to defaults');
        }
    },

    updateUI() {
        this.elements.pollInterval.value = this.settings.pollInterval;
        this.elements.themeGrid.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === this.settings.theme);
        });
        this.updateThemeStatus();
    },

    updateThemeStatus() {
        const isApplied = this.settings.theme === this.appliedTheme;
        this.elements.applyTheme.disabled = isApplied;
        this.elements.themeStatus.textContent = isApplied
            ? 'Applied to OBS'
            : 'Preview only. Apply to update OBS.';
        this.elements.themeStatus.className = `theme-status ${isApplied ? 'applied' : 'pending'}`;
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
