const SpotifyAPI = {
    accessToken: null,
    refreshToken: null,
    userId: null,
    isPlaying: false,
    pollInterval: null,

    async init(userId) {
        this.userId = userId;
        await this.loadTokens();
        if (this.accessToken) {
            this.startPolling();
        }
    },

    async loadTokens() {
        if (!this.userId) return;
        
        try {
            const response = await fetch(`/api/tokens/${this.userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.accessToken) {
                    this.accessToken = data.accessToken;
                    this.refreshToken = data.refreshToken;
                    this.startPolling();
                }
            }
        } catch (error) {
            console.log('Could not load tokens from server');
        }
    },

    saveTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    },

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
    },

    async refreshAccessToken() {
        if (!this.refreshToken || !this.userId) return false;

        try {
            const response = await fetch(`/api/spotify/refresh/${this.userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: this.refreshToken
                })
            });

            if (!response.ok) throw new Error('Token refresh failed');

            const data = await response.json();
            this.saveTokens(data.access_token, data.refresh_token);
            return true;
        } catch (error) {
            console.error('Token refresh error:', error);
            this.clearTokens();
            return false;
        }
    },

    async getCurrentlyPlaying() {
        if (!this.accessToken) return null;

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (response.status === 401) {
                const refreshed = await this.refreshAccessToken();
                if (refreshed) return this.getCurrentlyPlaying();
                return null;
            }

            if (response.status === 204) {
                return { isPlaying: false };
            }

            if (!response.ok) throw new Error('Failed to get currently playing');

            const data = await response.json();
            return this.parseTrackData(data);
        } catch (error) {
            console.error('Get currently playing error:', error);
            return null;
        }
    },

    parseTrackData(data) {
        if (!data || !data.item) {
            return { isPlaying: false };
        }

        const track = data.item;
        const artists = track.artists.map(a => a.name).join(', ');
        const albumArt = track.album.images[0]?.url || '';

        return {
            isPlaying: data.is_playing,
            title: track.name,
            artist: artists,
            artwork: albumArt,
            progress: data.progress_ms,
            duration: track.duration_ms,
            source: 'spotify'
        };
    },

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => this.poll(), CONFIG.polling.interval);
        this.poll();
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    async poll() {
        if (!this.accessToken) return;

        const trackData = await this.getCurrentlyPlaying();
        if (trackData && window.WidgetApp) {
            window.WidgetApp.updateDisplay(trackData);
        }
    },

    isAuthenticated() {
        return !!this.accessToken;
    },

    logout() {
        this.stopPolling();
        this.clearTokens();
    }
};
