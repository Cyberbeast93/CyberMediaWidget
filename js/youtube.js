const YouTubeAPI = {
    apiKey: null,
    currentVideo: null,
    pollInterval: null,

    init() {
        this.apiKey = CONFIG.youtube.apiKey || localStorage.getItem('youtube-api-key');
        if (this.apiKey) {
            this.startPolling();
        }
    },

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('youtube-api-key', key);
        if (key) {
            this.startPolling();
        } else {
            this.stopPolling();
        }
    },

    getApiKey() {
        return this.apiKey;
    },

    async searchVideos(query, maxResults = 10) {
        if (!this.apiKey) return [];

        try {
            const params = new URLSearchParams({
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults: maxResults,
                key: this.apiKey
            });

            const response = await fetch(`${CONFIG.youtube.apiBase}/search?${params}`);
            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('YouTube search error:', error);
            return [];
        }
    },

    async getVideoDetails(videoId) {
        if (!this.apiKey || !videoId) return null;

        try {
            const params = new URLSearchParams({
                part: 'snippet,contentDetails',
                id: videoId,
                key: this.apiKey
            });

            const response = await fetch(`${CONFIG.youtube.apiBase}/videos?${params}`);
            if (!response.ok) throw new Error('Get video failed');

            const data = await response.json();
            if (data.items && data.items.length > 0) {
                return this.parseVideoData(data.items[0]);
            }
            return null;
        } catch (error) {
            console.error('Get video details error:', error);
            return null;
        }
    },

    parseVideoData(video) {
        const snippet = video.snippet;
        const contentDetails = video.contentDetails;
        const duration = this.parseDuration(contentDetails.duration);

        return {
            isPlaying: true,
            title: snippet.title,
            artist: snippet.channelTitle,
            artwork: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '',
            progress: 0,
            duration: duration,
            source: 'youtube',
            videoId: video.id
        };
    },

    parseDuration(iso8601Duration) {
        const match = iso8601Duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');

        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    },

    setCurrentlyPlaying(videoId) {
        this.getVideoDetails(videoId).then(data => {
            if (data) {
                this.currentVideo = data;
                if (window.WidgetApp) {
                    window.WidgetApp.updateDisplay(data);
                }
            }
        });
    },

    startPolling() {
        this.stopPolling();
    },

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    },

    isAuthenticated() {
        return !!this.apiKey;
    }
};
