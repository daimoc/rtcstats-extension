// Settings in chrome.storage.local. The token is only ever read by the
// service worker and the options page, never sent to a page.

export const DEFAULTS = {serverUrl: '', token: '', label: '', sites: []};

export async function loadSettings(storage) {
    return {...DEFAULTS, ...(await storage.get(Object.keys(DEFAULTS)))};
}

// Returns an error message, or null when the URL can be used.
export function checkServerUrl(url) {
    if (!url) {
        return 'The server URL is empty.';
    }
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return 'The server URL is not a valid URL.';
    }
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        return 'The server URL must start with ws:// or wss://.';
    }
    return null;
}

// The server records the query in the dump's metadata, like the gateway's
// gw/room/browsing parameters.
export function traceUrl(settings, origin, version) {
    const url = new URL(settings.serverUrl);
    url.searchParams.set('origin', origin);
    url.searchParams.set('ext', version);
    if (settings.label) {
        url.searchParams.set('label', settings.label);
    }
    if (settings.token) {
        url.searchParams.set('rtcstats-token', settings.token);
    }
    return url.toString();
}

export function withoutQuery(url) {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}
