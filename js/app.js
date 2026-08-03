const WidgetApp = {
    elements: {},
    currentTrack: null,
    progressInterval: null,

    init() {
        this.cacheElements();
        this.loadConfig();
        this.bindEvents();
        this.checkAuth();
        window.WidgetApp = this;
    },

    cacheElements() {
        this.elements = {
            widget: document.getElementById('widget'),
            artwork: document.getElementById('artwork'),
            trackTitle: document.getElementById('track-title'),
            trackArtist: document.getElementById('track-artist'),
            progressFill: document.getElementById('progress-fill'),
            currentTime: document.getElementById('current-time'),
            totalTime: document.getElementById('total-time'),
            sourceIcon: document.getElementById('source-icon'),
            playStatus: document.getElementById('play-status')
        };
    },

    loadConfig() {
        const urlConfig = getConfigFromUrl();
        const savedTheme = ThemeManager.getSavedTheme();
        const theme = urlConfig.theme || savedTheme;

        ThemeManager.init(theme);

        this.userId = urlConfig.user || null;

        if (urlConfig.width) {
            document.documentElement.style.setProperty('--widget-width', urlConfig.width + 'px');
        }
        if (urlConfig.height) {
            document.documentElement.style.setProperty('--widget-height', urlConfig.height + 'px');
        }
    },

    async checkAuth() {
        await SpotifyAPI.init(this.userId);
        YouTubeAPI.init();

        if (SpotifyAPI.isAuthenticated() || YouTubeAPI.isAuthenticated()) {
            if (window.opener) {
                window.opener.postMessage('spotify-connected', '*');
            }
        } else {
            this.showSetupInstructions();
        }
    },

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 't' || e.key === 'T') {
                ThemeManager.cycleTheme();
            }
        });

        this.elements.widget.addEventListener('dblclick', () => {
            ThemeManager.cycleTheme();
        });
    },

    updateDisplay(trackData) {
        if (!trackData) {
            this.showIdle();
            return;
        }

        this.currentTrack = trackData;
        this.showTrack(trackData);

        if (trackData.isPlaying) {
            this.startProgressUpdate(trackData);
        } else {
            this.stopProgressUpdate();
        }
    },

    showTrack(track) {
        this.elements.trackTitle.textContent = track.title || 'Unknown Track';
        this.elements.trackArtist.textContent = track.artist || 'Unknown Artist';

        if (track.artwork) {
            this.elements.artwork.src = track.artwork;
            this.elements.artwork.style.display = 'block';
        } else {
            this.elements.artwork.style.display = 'none';
        }

        this.updateSourceIcon(track.source);
        this.updateProgress(track.progress, track.duration);
        this.updatePlayStatus(track.isPlaying);

        this.elements.widget.classList.add('is-playing');
        this.elements.widget.classList.remove('is-idle');
    },

    showIdle() {
        this.elements.trackTitle.textContent = 'No Track Playing';
        this.elements.trackArtist.textContent = '--';
        this.elements.progressFill.style.width = '0%';
        this.elements.currentTime.textContent = '0:00';
        this.elements.totalTime.textContent = '0:00';
        this.elements.playStatus.textContent = '';
        this.elements.widget.classList.remove('is-playing');
        this.elements.widget.classList.add('is-idle');
        this.stopProgressUpdate();
    },

    updatePlayStatus(isPlaying) {
        if (isPlaying) {
            this.elements.playStatus.textContent = 'Now Playing';
        } else {
            this.elements.playStatus.textContent = 'Paused';
        }
    },

    showSetupInstructions() {
        this.elements.trackTitle.textContent = 'Configure API Keys';
        this.elements.trackArtist.textContent = 'Open settings.html to setup';
        this.elements.widget.classList.add('is-idle');
    },

    updateSourceIcon(source) {
        const icons = {
            spotify: `<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
            youtube: `<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
        };

        this.elements.sourceIcon.innerHTML = icons[source] || '';
        this.elements.sourceIcon.setAttribute('data-source', source);
    },

    updateProgress(currentMs, totalMs) {
        if (!totalMs) return;

        const progress = (currentMs / totalMs) * 100;
        this.elements.progressFill.style.width = `${Math.min(progress, 100)}%`;

        this.elements.currentTime.textContent = this.formatTime(currentMs);
        this.elements.totalTime.textContent = this.formatTime(totalMs);
    },

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },

    startProgressUpdate(track) {
        this.stopProgressUpdate();

        let currentProgress = track.progress;
        const totalDuration = track.duration;

        this.progressInterval = setInterval(() => {
            currentProgress += 1000;
            if (currentProgress >= totalDuration) {
                currentProgress = totalDuration;
                this.stopProgressUpdate();
            }
            this.updateProgress(currentProgress, totalDuration);
        }, 1000);
    },

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    },

    setTheme(theme) {
        ThemeManager.setTheme(theme);
    },

    getSource() {
        return SpotifyAPI.isAuthenticated() ? 'spotify' :
               YouTubeAPI.isAuthenticated() ? 'youtube' : null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    WidgetApp.init();
});
