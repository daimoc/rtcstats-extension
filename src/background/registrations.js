// Content scripts run only on the enabled sites the user granted: the
// stored site list intersected with the host permissions. Rebuilt from
// scratch on every change, so storage and permissions stay the only truth.
import {sitePattern} from '../common/sites.js';

export const PAGE_SCRIPT_ID = 'rtcstats-page';
export const RELAY_SCRIPT_ID = 'rtcstats-relay';

export async function grantedSites(permissions, sites) {
    const granted = [];
    for (const site of sites) {
        if (await permissions.contains({origins: [sitePattern(site)]})) {
            granted.push(site);
        }
    }
    return granted;
}

export async function syncRegistrations({permissions, scripting}, sites) {
    const granted = await grantedSites(permissions, sites);
    const registered = await scripting.getRegisteredContentScripts();
    if (registered.length) {
        await scripting.unregisterContentScripts({ids: registered.map((s) => s.id)});
    }
    if (!granted.length) {
        return granted;
    }
    const common = {
        matches: granted.map(sitePattern),
        runAt: 'document_start',
        allFrames: true,
        // about:blank and srcdoc frames, where some platforms create their peer connections.
        matchOriginAsFallback: true,
        persistAcrossSessions: true,
    };
    await scripting.registerContentScripts([
        // Before the site's scripts, in the site's world: it wraps RTCPeerConnection.
        {id: PAGE_SCRIPT_ID, js: ['page.js'], world: 'MAIN', ...common},
        {id: RELAY_SCRIPT_ID, js: ['relay.js'], world: 'ISOLATED', ...common},
    ]);
    return granted;
}

// Runs fn calls one after the other: two overlapping syncs would register
// the same script ids twice.
export function serialized(fn) {
    let last = Promise.resolve();
    return (...args) => {
        const run = last.then(() => fn(...args));
        last = run.catch(() => {});
        return run;
    };
}
