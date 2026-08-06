const YouTubeAPI = {
    userId: null,
    token: null,
    socket: null,
    reconnectTimer: null,
    connected: false,

    async init(userId) {
        this.userId = userId;
        await this.loadToken();

        if (this.token) {
            this.connect();
        }
    },

    async loadToken() {
        if (!this.userId) return;

        try {
            const response = await fetch(`/api/youtube/token/${encodeURIComponent(this.userId)}`);
            if (response.ok) {
                const data = await response.json();
                this.token = data.token || null;
            }
        } catch (error) {
            console.log('Could not load YouTube Music Desktop token');
        }
    },

    connect() {
        if (!this.token || typeof window.io !== 'function') return;

        this.clearReconnectTimer();
        this.disconnect(false);

        this.socket = window.io('http://localhost:9863/api/v1/realtime', {
            transports: ['websocket'],
            auth: {
                token: this.token
            },
            reconnection: false
        });

        this.socket.on('connect', () => {
            this.connected = true;
        });

        this.socket.on('state-update', (state) => {
            const trackData = this.parseState(state);
            if (window.WidgetApp) {
                window.WidgetApp.updateDisplay(trackData);
            }
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            this.scheduleReconnect();
        });

        this.socket.on('connect_error', () => {
            this.connected = false;
            this.scheduleReconnect();
        });
    },

    parseState(state) {
        const player = state?.player;
        const video = state?.video;
        const trackState = Number(player?.trackState);

        if (!video) {
            return { isPlaying: trackState === 1 };
        }

        const thumbnails = Array.isArray(video.thumbnails) ? video.thumbnails : [];
        const artwork = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
        const duration = Number(video.durationSeconds || 0) * 1000;
        const progress = Number(player?.videoProgress || 0) * 1000;

        return {
            isPlaying: trackState === 1,
            title: video.title || 'Unknown Track',
            artist: video.author || 'Unknown Artist',
            artwork,
            progress,
            duration,
            source: 'youtube',
            videoId: video.videoId || video.id || null
        };
    },

    scheduleReconnect() {
        if (this.reconnectTimer || !this.token) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 5000);
    },

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    },

    disconnect(clearToken = true) {
        this.clearReconnectTimer();

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }

        this.connected = false;
        if (clearToken) this.token = null;
    },

    isAuthenticated() {
        return !!this.token;
    }
};
