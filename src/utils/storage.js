
const STORAGE_KEY = 'zeta_recent_searches';
const MAX_RECENT = 4;

export const getRecentSearches = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Failed to load recent searches', e);
        return [];
    }
};

export const addRecentSearch = (query) => {
    if (!query) return;
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    try {
        let recents = getRecentSearches();
        // Remove existing if present to move it to the top
        recents = recents.filter(item => item !== cleanQuery);
        // Add to the beginning
        recents.unshift(cleanQuery);
        // Limit to max
        if (recents.length > MAX_RECENT) {
            recents = recents.slice(0, MAX_RECENT);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
        return recents;
    } catch (e) {
        console.error('Failed to save recent search', e);
        return [];
    }
};

export const removeRecentSearch = (query) => {
    try {
        let recents = getRecentSearches();
        recents = recents.filter(item => item !== query);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
        return recents;
    } catch (e) {
        console.error('Failed to remove recent search', e);
        return [];
    }
};

export const clearRecentSearches = () => {
    localStorage.removeItem(STORAGE_KEY);
};
