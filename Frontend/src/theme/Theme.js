
// Theme configuration
export const themeConfig = {
    name: 'operation-center-dark',
    colors: {
        '--bg-primary': '#020617',
        '--bg-secondary': '#0f172a',
        '--bg-tertiary': '#1e293b',
        '--bg-card': '#0f172a',
        '--bg-card-hover': '#1e293b',
        '--bg-modal': '#0f172a',
        '--bg-modal-header': '#020617',
        '--border-primary': '#1e293b',
        '--border-secondary': '#334155',
        '--border-hover': '#334155',
        '--text-primary': '#e2e8f0',
        '--text-secondary': '#cbd5e1',
        '--text-tertiary': '#94a3b8',
        '--text-muted': '#64748b',
        '--accent-primary': '#60a5fa',
        '--accent-secondary': '#3b82f6',
        '--accent-issue': '#fbbf24',
        '--status-active-bg': 'rgba(34, 197, 94, 0.15)',
        '--status-active-color': '#4ade80',
        '--status-active-border': 'rgba(34, 197, 94, 0.3)',
        '--status-resolving-bg': 'rgba(251, 191, 36, 0.15)',
        '--status-resolving-color': '#fbbf24',
        '--status-resolving-border': 'rgba(251, 191, 36, 0.3)',
        '--status-pending-bg': 'rgba(239, 68, 68, 0.15)',
        '--status-pending-color': '#f87171',
        '--status-pending-border': 'rgba(239, 68, 68, 0.3)',
        '--shadow-sm': 'rgba(0, 0, 0, 0.3)',
        '--shadow-md': 'rgba(0, 0, 0, 0.4)',
        '--shadow-lg': 'rgba(0, 0, 0, 0.6)',
        '--shadow-modal': 'rgba(0, 0, 0, 0.8)'
    }
};

// save theme to localStorage
function saveThemeToStorage(theme) {
    try {
        localStorage.setItem('cogniflow-theme', JSON.stringify(theme));
        console.log('Theme saved to localStorage');
    } catch (error) {
        console.error('Error saving theme to localStorage:', error);
    }
}

//load theme from localStorage
function loadThemeFromStorage() {
    try {
        const storedTheme = localStorage.getItem('cogniflow-theme');
        if (storedTheme) {
            return JSON.parse(storedTheme);
        }
    } catch (error) {
        console.error('Error loading theme from localStorage:', error);
    }
    return null;
}

//apply theme to the page
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme && theme.colors) {
        Object.entries(theme.colors).forEach(([property, value]) => {
            root.style.setProperty(property, value);
        });
        console.log('Theme applied:', theme.name);
    }
}

// initialize theme on page load
export function initializeTheme() {
    // Try to load theme from localStorage
    let theme = loadThemeFromStorage();

    // If no theme or invalid theme structure, use default and save it
    if (!theme || !theme.colors) {
        console.warn('Invalid or missing theme in storage, resetting to default.');
        theme = themeConfig;
        saveThemeToStorage(theme);
    }

    applyTheme(theme);
}

