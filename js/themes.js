const THEMES = [
    'dark', 'light', 'neon', 'nord',
    'fallout', 'borderlands', '7days', 'halflife', 'minecraft'
];

const ThemeManager = {
    currentTheme: 'dark',

    init(theme) {
        this.setTheme(theme || CONFIG.defaults.theme);
    },

    setTheme(theme) {
        if (!THEMES.includes(theme)) {
            console.warn(`Theme "${theme}" not found. Available: ${THEMES.join(', ')}`);
            theme = CONFIG.defaults.theme;
        }

        document.body.className = `theme-${theme}`;
        this.currentTheme = theme;

        this.applyThemeEffects(theme);

        localStorage.setItem('widget-theme', theme);
    },

    getTheme() {
        return this.currentTheme;
    },

    cycleTheme() {
        const currentIndex = THEMES.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        this.setTheme(THEMES[nextIndex]);
        return THEMES[nextIndex];
    },

    applyThemeEffects(theme) {
        const widget = document.getElementById('widget');

        widget.classList.remove('theme-fallout', 'theme-borderlands', 'theme-7days', 'theme-halflife', 'theme-minecraft');

        switch (theme) {
            case 'fallout':
                widget.classList.add('theme-fallout');
                break;
            case 'borderlands':
                widget.classList.add('theme-borderlands');
                break;
            case '7days':
                widget.classList.add('theme-7days');
                break;
            case 'halflife':
                widget.classList.add('theme-halflife');
                break;
            case 'minecraft':
                widget.classList.add('theme-minecraft');
                break;
        }
    },

    getSavedTheme() {
        return localStorage.getItem('widget-theme') || CONFIG.defaults.theme;
    }
};
