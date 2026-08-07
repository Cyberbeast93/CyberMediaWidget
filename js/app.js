const WidgetApp = {
    elements: {},
    currentTrack: null,
    currentTitle: null,
    progressInterval: null,
    themePollInterval: null,
    titleOverflowFrame: null,
    marqueeFrame: null,

    async init() {
        this.cacheElements();
        await this.loadConfig();
        this.bindEvents();
        this.checkAuth();
        this.initColorExtractor();
        window.WidgetApp = this;
        this.startThemePolling();
    },

    initColorExtractor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.width = 64;
        this.canvas.height = 64;
    },

    extractColors(imageUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, 64, 64);
                const imageData = this.ctx.getImageData(0, 0, 64, 64).data;
                
                const colors = this.analyzeColors(imageData);
                this.applyDynamicColors(colors);
                resolve(colors);
            };
            
            img.onerror = () => {
                resolve(null);
            };
            
            img.src = imageUrl;
        });
    },

    analyzeColors(data) {
        const colors = [];
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a < 128) continue;
            
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness < 20) continue;
            
            colors.push({ r, g, b, brightness });
        }
        
        if (colors.length === 0) {
            return {
                primary: { r: 0, g: 229, b: 255 },
                secondary: { r: 180, g: 180, b: 180 }
            };
        }
        
        colors.sort((a, b) => a.brightness - b.brightness);
        
        const midIndex = Math.floor(colors.length / 2);
        const darkerHalf = colors.slice(0, midIndex);
        const lighterHalf = colors.slice(midIndex);
        
        const avgColor = (arr) => {
            if (arr.length === 0) return { r: 128, g: 128, b: 128 };
            const sum = arr.reduce((acc, c) => ({
                r: acc.r + c.r,
                g: acc.g + c.g,
                b: acc.b + c.b
            }), { r: 0, g: 0, b: 0 });
            return {
                r: Math.round(sum.r / arr.length),
                g: Math.round(sum.g / arr.length),
                b: Math.round(sum.b / arr.length)
            };
        };
        
        const vibrantColors = colors.filter(c => {
            const max = Math.max(c.r, c.g, c.b);
            const min = Math.min(c.r, c.g, c.b);
            const saturation = max === 0 ? 0 : (max - min) / max;
            return saturation > 0.25 && c.brightness > 60 && c.brightness < 220;
        });
        
        let primary, secondary;
        
        if (vibrantColors.length > 0) {
            vibrantColors.sort((a, b) => {
                const satA = (Math.max(a.r, a.g, a.b) - Math.min(a.r, a.g, a.b)) / Math.max(a.r, a.g, a.b);
                const satB = (Math.max(b.r, b.g, b.b) - Math.min(b.r, b.g, b.b)) / Math.max(b.r, b.g, b.b);
                return satB - satA;
            });
            primary = vibrantColors[0];
            secondary = vibrantColors[Math.min(1, vibrantColors.length - 1)];
        } else {
            primary = avgColor(lighterHalf);
            secondary = avgColor(darkerHalf);
        }
        
        return { primary, secondary };
    },

    ensureContrast(color, targetBg, minContrast) {
        const getLuminance = (c) => {
            const [r, g, b] = [c.r, c.g, c.b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        
        const getContrast = (l1, l2) => {
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return (lighter + 0.05) / (darker + 0.05);
        };
        
        let adjusted = { ...color };
        let attempts = 0;
        
        while (attempts < 20) {
            const colorLum = getLuminance(adjusted);
            const bgLum = getLuminance(targetBg);
            const contrast = getContrast(colorLum, bgLum);
            
            if (contrast >= minContrast) break;
            
            if (bgLum > 0.5) {
                adjusted.r = Math.max(0, adjusted.r - 15);
                adjusted.g = Math.max(0, adjusted.g - 15);
                adjusted.b = Math.max(0, adjusted.b - 15);
            } else {
                adjusted.r = Math.min(255, adjusted.r + 15);
                adjusted.g = Math.min(255, adjusted.g + 15);
                adjusted.b = Math.min(255, adjusted.b + 15);
            }
            attempts++;
        }
        
        return adjusted;
    },

    applyDynamicColors(colors) {
        if (!colors) return;
        
        const { primary, secondary } = colors;
        
        const bgDarkness = 0.15;
        const widgetBg = {
            r: Math.floor(primary.r * bgDarkness),
            g: Math.floor(primary.g * bgDarkness),
            b: Math.floor(primary.b * bgDarkness)
        };
        
        const titleColor = this.ensureContrast(primary, widgetBg, 4.5);
        const artistColor = this.ensureContrast(secondary, widgetBg, 3.0);
        
        const root = document.documentElement;
        root.style.setProperty('--dynamic-primary', `rgb(${primary.r}, ${primary.g}, ${primary.b})`);
        root.style.setProperty('--dynamic-secondary', `rgb(${artistColor.r}, ${artistColor.g}, ${artistColor.b})`);
        root.style.setProperty('--dynamic-title', `rgb(${titleColor.r}, ${titleColor.g}, ${titleColor.b})`);
        root.style.setProperty('--dynamic-bg', `rgb(${widgetBg.r}, ${widgetBg.g}, ${widgetBg.b})`);
        root.style.setProperty('--dynamic-glow', `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.4)`);
        root.style.setProperty('--dynamic-progress-bg', `rgb(${Math.floor(primary.r * 0.1)}, ${Math.floor(primary.g * 0.1)}, ${Math.floor(primary.b * 0.1)})`);
        root.style.setProperty('--dynamic-gradient-start', `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.15)`);
        root.style.setProperty('--dynamic-time', `rgb(${titleColor.r}, ${titleColor.g}, ${titleColor.b})`);
        root.style.setProperty('--dynamic-icon-color', `rgb(${widgetBg.r}, ${widgetBg.g}, ${widgetBg.b})`);
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

    async loadConfig() {
        const urlConfig = getConfigFromUrl();
        const savedTheme = ThemeManager.getSavedTheme();
        this.userId = urlConfig.user || null;
        this.isPreview = urlConfig.preview;

        let serverTheme = null;
        let serverSource = null;
        if (this.userId) {
            try {
                const response = await fetch(`/api/config/${encodeURIComponent(this.userId)}`);
                if (response.ok) {
                    const config = await response.json();
                    serverTheme = config.theme || null;
                    serverSource = config.source || null;
                }
            } catch (error) {
                console.log('Could not load theme from server');
            }
        }

        const theme = urlConfig.preview && urlConfig.theme
            ? urlConfig.theme
            : serverTheme || urlConfig.theme || savedTheme;
        this.source = urlConfig.preview && urlConfig.source
            ? urlConfig.source
            : serverSource || urlConfig.source || CONFIG.defaults.source;
        ThemeManager.init(theme);

        if (urlConfig.width) {
            document.documentElement.style.setProperty('--widget-width', urlConfig.width + 'px');
        }
        if (urlConfig.height) {
            document.documentElement.style.setProperty('--widget-height', urlConfig.height + 'px');
        }

        this.elements.widget.classList.remove('is-playing', 'is-idle');
        this.elements.widget.classList.toggle('is-paused', !this.isPreview);
        document.body.classList.toggle('playback-paused', !this.isPreview);
    },

    startThemePolling() {
        if (!this.userId || this.isPreview) return;

        this.themePollInterval = setInterval(() => this.syncAppliedTheme(), 5000);
    },

    async syncAppliedTheme() {
        try {
            const response = await fetch(`/api/config/${encodeURIComponent(this.userId)}`);
            if (!response.ok) return;

            const config = await response.json();
            const configuredSource = config.source || CONFIG.defaults.source;
            if (configuredSource !== this.source) {
                window.location.reload();
                return;
            }

            if (!config.theme || config.theme === ThemeManager.getTheme()) return;

            const wasPaused = this.elements.widget.classList.contains('is-paused');
            ThemeManager.setTheme(config.theme);

            if (this.currentTrack) {
                this.showTrack(this.currentTrack);
            } else if (wasPaused) {
                document.body.classList.add('playback-paused');
            }
        } catch (error) {
            console.log('Could not sync theme from server');
        }
    },

    async checkAuth() {
        if (this.source === 'youtube') {
            SpotifyAPI.stopPolling();
            await YouTubeAPI.init(this.userId);
        } else {
            YouTubeAPI.disconnect(false);
            await SpotifyAPI.init(this.userId);
        }

        const isAuthenticated = this.source === 'youtube'
            ? YouTubeAPI.isAuthenticated()
            : SpotifyAPI.isAuthenticated();

        if (isAuthenticated) {
            if (window.opener) {
                window.opener.postMessage('spotify-connected', '*');
            }
        } else {
            this.showSetupInstructions();
        }
    },

    bindEvents() {
        const cycleTheme = () => {
            ThemeManager.cycleTheme();
            this.updateTitleOverflow();
        };

        document.addEventListener('keydown', (e) => {
            if (e.key === 't' || e.key === 'T') {
                cycleTheme();
            }
        });

        this.elements.widget.addEventListener('dblclick', () => {
            cycleTheme();
        });

        window.addEventListener('resize', () => this.updateTitleOverflow());
    },

    updateDisplay(trackData) {
        if (!trackData) {
            this.showIdle();
            return;
        }

        const hasTrackDetails = Boolean(trackData.title || trackData.artist || trackData.artwork);
        if (!hasTrackDetails) {
            if (!this.currentTrack) {
                this.showIdle();
                return;
            }

            trackData = { ...this.currentTrack, ...trackData };
        }

        if (this.isPreview && !trackData.isPlaying) {
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
        const newTitle = track.title || 'Unknown Track';
        const titleChanged = newTitle !== this.currentTitle;

        this.elements.trackTitle.textContent = newTitle;
        this.elements.trackArtist.textContent = track.artist || 'Unknown Artist';

        if (titleChanged) {
            this.currentTitle = newTitle;
            this.updateTitleOverflow();
        }

        if (track.artwork) {
            this.elements.artwork.src = track.artwork;
            this.elements.artwork.style.display = 'block';
            
            const currentTheme = ThemeManager.getTheme();
            if (currentTheme === 'dynamic' || currentTheme === 'dynamic-advanced') {
                this.extractColors(track.artwork);
            }
            
            if (currentTheme === 'dynamic-advanced') {
                document.documentElement.style.setProperty('--dynamic-artwork-url', `url(${track.artwork})`);
            }
        } else {
            this.elements.artwork.style.display = 'none';
        }

        this.updateSourceIcon(track.source);
        this.updateProgress(track.progress, track.duration);
        this.updatePlayStatus(track.isPlaying);

        const isPlaying = Boolean(track.isPlaying);
        this.elements.widget.classList.toggle('is-playing', isPlaying);
        this.elements.widget.classList.toggle('is-paused', !isPlaying);
        this.elements.widget.classList.remove('is-idle');
        document.body.classList.toggle('playback-paused', !isPlaying);
    },

    clearTitleOverflow() {
        if (this.titleOverflowFrame) {
            cancelAnimationFrame(this.titleOverflowFrame);
            this.titleOverflowFrame = null;
        }

        this.stopMarquee();
        this.currentTitle = null;
        this.elements.trackTitle.classList.remove('is-overflowing');
    },

    measureTitleWidth(text) {
        const title = this.elements.trackTitle;
        const cs = getComputedStyle(title);
        const measurer = document.createElement('span');
        measurer.style.cssText = [
            'visibility: hidden',
            'position: absolute',
            'white-space: nowrap',
            'top: -99999px',
            'left: -99999px'
        ].join(';');
        measurer.style.fontSize = cs.fontSize;
        measurer.style.fontWeight = cs.fontWeight;
        measurer.style.fontFamily = cs.fontFamily;
        measurer.style.fontStyle = cs.fontStyle;
        measurer.style.letterSpacing = cs.letterSpacing;
        measurer.style.wordSpacing = cs.wordSpacing;
        measurer.textContent = text;
        document.body.appendChild(measurer);
        const width = measurer.offsetWidth;
        document.body.removeChild(measurer);
        return width;
    },

    startMarquee(overflowDistance) {
        this.stopMarquee();

        const title = this.elements.trackTitle;
        const speed = 60;
        const pauseStart = 1000;
        const pauseEnd = 2000;
        const movePhase = (overflowDistance / speed) * 1000;
        const totalDuration = pauseStart + movePhase + pauseEnd;
        const startTime = performance.now();

        const animate = (now) => {
            this.marqueeFrame = requestAnimationFrame(animate);
            const elapsed = (now - startTime) % totalDuration;
            let tx;

            if (elapsed < pauseStart) {
                tx = 0;
            } else if (elapsed < pauseStart + movePhase) {
                const t = (elapsed - pauseStart) / movePhase;
                tx = -overflowDistance * t;
            } else {
                tx = -overflowDistance;
            }

            title.style.transform = `translateX(${tx}px)`;
        };

        this.marqueeFrame = requestAnimationFrame(animate);
    },

    stopMarquee() {
        if (this.marqueeFrame) {
            cancelAnimationFrame(this.marqueeFrame);
            this.marqueeFrame = null;
        }
        if (this.elements.trackTitle) {
            this.elements.trackTitle.style.transform = '';
        }
    },

    updateTitleOverflow() {
        this.clearTitleOverflow();
        this.stopMarquee();

        this.titleOverflowFrame = requestAnimationFrame(() => {
            this.titleOverflowFrame = null;
            const title = this.elements.trackTitle;
            const text = title.textContent || '';
            const textWidth = this.measureTitleWidth(text);
            const overflowDistance = textWidth - title.clientWidth;

            if (overflowDistance <= 1) return;

            title.classList.add('is-overflowing');
            this.startMarquee(overflowDistance);
        });
    },

    showIdle() {
        this.elements.trackTitle.textContent = 'No Track Playing';
        this.elements.trackArtist.textContent = 'Play music to see it here';
        this.elements.artwork.src = 'assets/default-artwork.svg';
        this.elements.artwork.style.display = 'block';
        document.documentElement.style.removeProperty('--dynamic-artwork-url');
        this.clearTitleOverflow();
        this.elements.progressFill.style.width = '0%';
        this.elements.currentTime.textContent = '0:00';
        this.elements.totalTime.textContent = '0:00';
        this.elements.playStatus.textContent = '';
        this.elements.widget.classList.remove('is-playing');
        this.elements.widget.classList.toggle('is-paused', !this.isPreview);
        this.elements.widget.classList.add('is-idle');
        document.body.classList.toggle('playback-paused', !this.isPreview);
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
        if (this.isPreview) {
            this.showIdle();
            return;
        }

        this.elements.trackTitle.textContent = 'Configure API Keys';
        this.elements.trackArtist.textContent = 'Open settings.html to setup';
        this.clearTitleOverflow();
        this.elements.widget.classList.remove('is-playing');
        this.elements.widget.classList.add('is-paused');
        this.elements.widget.classList.add('is-idle');
        document.body.classList.add('playback-paused');
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
        this.updateTitleOverflow();
    },

    getSource() {
        return this.source === 'youtube' && YouTubeAPI.isAuthenticated() ? 'youtube' :
               this.source === 'spotify' && SpotifyAPI.isAuthenticated() ? 'spotify' : null;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    WidgetApp.init();
});
