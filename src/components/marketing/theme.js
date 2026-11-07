// Keep this function self-contained: SiteLayout serializes it for prepaint use.
export function initializeTheme(toggle = null) {
  const storageKey = 'starlight-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  const loadStoredTheme = () => {
    try {
      const theme = localStorage.getItem(storageKey);
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch {
      return null;
    }
  };

  const preferredTheme = () =>
    loadStoredTheme() ?? (systemTheme.matches ? 'dark' : 'light');

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    if (toggle) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      const label = `Switch to ${nextTheme} theme`;
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    }
  };

  const toggleTheme = () => {
    const nextTheme =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      // The selected theme still applies for this page view.
    }
    applyTheme(nextTheme);
  };

  const handleSystemChange = () => {
    if (!loadStoredTheme()) applyTheme(preferredTheme());
  };

  applyTheme(preferredTheme());
  return { toggleTheme, handleSystemChange, systemTheme };
}
