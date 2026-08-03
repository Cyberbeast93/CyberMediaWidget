const CONFIG = {
    spotify: {
        clientId: localStorage.getItem('spotify-client-id') || '',
        scopes: [
            'user-read-currently-playing',
            'user-read-playback-state'
        ],
        authUrl: 'https://accounts.spotify.com/authorize',
        apiBase: 'https://api.spotify.com/v1'
    },
    youtube: {
        apiKey: localStorage.getItem('youtube-api-key') || '',
        apiBase: 'https://www.googleapis.com/youtube/v3'
    },
    polling: {
        interval: (parseInt(localStorage.getItem('poll-interval')) || 5) * 1000
    },
    defaults: {
        theme: 'dark',
        source: 'spotify'
    }
};

function getConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return {
        theme: params.get('theme') || CONFIG.defaults.theme,
        source: params.get('source') || CONFIG.defaults.source,
        user: params.get('user'),
        width: params.get('width'),
        height: params.get('height')
    };
}
