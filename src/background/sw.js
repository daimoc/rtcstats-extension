import {loadSettings} from '../common/settings.js';
import {testConnection} from './connection-test.js';
import {createHub} from './hub.js';
import {serialized, syncRegistrations} from './registrations.js';

const version = chrome.runtime.getManifest().version;
const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;
const getSettings = () => loadSettings(chrome.storage.local);

const hub = createHub({WebSocketImpl: WebSocket, getSettings, version});

const sync = serialized(async () => {
    const {sites} = await getSettings();
    hub.keepSites(sites);
    try {
        await syncRegistrations(chrome, sites);
    } catch (e) {
        console.warn('rtcstats: cannot register the content scripts:', e);
    }
});

// Listeners first, at the top level: Chrome only wakes the worker for
// listeners registered synchronously.
chrome.runtime.onConnect.addListener(hub.onConnect);
chrome.runtime.onInstalled.addListener(() => sync());
chrome.runtime.onStartup.addListener(() => sync());
chrome.permissions.onAdded.addListener(() => sync());
chrome.permissions.onRemoved.addListener(() => sync());
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sites) {
        sync();
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Only the extension's own pages (popup, options): a content script's
    // sender is the web page it runs in.
    if (sender.id !== chrome.runtime.id || sender.origin !== extensionOrigin || !msg) {
        return false;
    }
    if (msg.type === 'status') {
        sendResponse(hub.status(msg.tabId));
        return false;
    }
    if (msg.type === 'test') {
        getSettings()
            .then((settings) => testConnection(WebSocket, settings, version))
            .then(sendResponse, (e) => sendResponse({ok: false, message: String(e)}));
        return true;
    }
    return false;
});
