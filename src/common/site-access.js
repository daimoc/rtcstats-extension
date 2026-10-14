// Turning a site on or off from the popup or the options page. Both must run
// from a click: chrome.permissions.request needs a user gesture.
import {loadSettings} from './settings.js';
import {addSite, removeSite, sitePattern} from './sites.js';

export async function enableSite(chrome, site) {
    // Stored before the prompt: the service worker registers the scripts
    // when the permission arrives, even if the popup is gone by then.
    const {sites} = await loadSettings(chrome.storage.local);
    await chrome.storage.local.set({sites: addSite(sites, site)});
    const granted = await chrome.permissions.request({origins: [sitePattern(site)]});
    if (!granted) {
        const {sites: now} = await loadSettings(chrome.storage.local);
        await chrome.storage.local.set({sites: removeSite(now, site)});
    }
    return granted;
}

export async function disableSite(chrome, site) {
    const {sites} = await loadSettings(chrome.storage.local);
    await chrome.storage.local.set({sites: removeSite(sites, site)});
    await chrome.permissions.remove({origins: [sitePattern(site)]});
}

export async function isSiteEnabled(chrome, sites, site) {
    return sites.includes(site)
        && await chrome.permissions.contains({origins: [sitePattern(site)]});
}
