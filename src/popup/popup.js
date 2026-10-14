import {checkServerUrl, loadSettings} from '../common/settings.js';
import {disableSite, enableSite, isSiteEnabled} from '../common/site-access.js';
import {siteKey} from '../common/sites.js';

const $ = (id) => document.getElementById(id);

async function render(tab) {
    const settings = await loadSettings(chrome.storage.local);
    $('no-server').hidden = !checkServerUrl(settings.serverUrl);

    const site = tab && siteKey(tab.url);
    $('unsupported').hidden = !!site;
    $('supported').hidden = !site;
    if (!site) {
        return;
    }
    $('site').textContent = site;

    const enabled = await isSiteEnabled(chrome, settings.sites, site);
    const toggle = $('toggle');
    toggle.textContent = enabled ? 'Stop tracing this site' : 'Trace this site';
    toggle.classList.toggle('primary', !enabled);
    toggle.onclick = async () => {
        toggle.disabled = true;
        try {
            if (enabled) {
                await disableSite(chrome, site);
            } else if (await enableSite(chrome, site)) {
                $('reload').hidden = false;
                $('reload-hint').hidden = false;
            }
        } finally {
            toggle.disabled = false;
            render(tab);
        }
    };

    const state = $('state');
    if (!enabled) {
        state.className = 'muted';
        state.textContent = 'Not traced.';
        return;
    }
    const status = await chrome.runtime.sendMessage({type: 'status', tabId: tab.id})
        .catch(() => ({traces: 0, open: 0}));
    if (status.open) {
        state.className = 'ok';
        state.textContent = `Tracing: ${status.open} connection(s) to the server in this tab.`;
    } else if (status.traces) {
        state.className = 'warn';
        state.textContent = 'Connecting to the server...';
    } else {
        state.className = 'muted';
        state.textContent = 'Enabled. Nothing traced in this tab yet: tracing starts with the first WebRTC call after the page loads.';
    }
}

async function main() {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    for (const id of ['open-options-1', 'open-options-2']) {
        $(id).onclick = (event) => {
            event.preventDefault();
            chrome.runtime.openOptionsPage();
        };
    }
    $('reload').onclick = () => {
        chrome.tabs.reload(tab.id);
        window.close();
    };
    await render(tab);
}

main();
