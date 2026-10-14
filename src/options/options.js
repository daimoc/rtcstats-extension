import {checkServerUrl, loadSettings} from '../common/settings.js';
import {disableSite, enableSite, isSiteEnabled} from '../common/site-access.js';
import {siteKey} from '../common/sites.js';

const $ = (id) => document.getElementById(id);

function say(element, text, kind) {
    element.textContent = text;
    element.className = kind || '';
}

async function save() {
    const serverUrl = $('serverUrl').value.trim();
    const error = checkServerUrl(serverUrl);
    if (error) {
        say($('server-status'), error, 'err');
        return false;
    }
    await chrome.storage.local.set({
        serverUrl,
        token: $('token').value.trim(),
        label: $('label').value.trim(),
    });
    say($('server-status'), 'Saved.', 'ok');
    return true;
}

async function renderSites() {
    const {sites} = await loadSettings(chrome.storage.local);
    const list = $('sites');
    list.replaceChildren();
    for (const site of sites) {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = site;
        if (!await isSiteEnabled(chrome, sites, site)) {
            const missing = document.createElement('span');
            missing.className = 'warn';
            missing.textContent = ' (permission not granted)';
            name.append(missing);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.onclick = async () => {
            await disableSite(chrome, site);
            renderSites();
        };
        item.append(name, remove);
        list.append(item);
    }
    $('no-sites').hidden = sites.length > 0;
}

async function main() {
    const settings = await loadSettings(chrome.storage.local);
    $('serverUrl').value = settings.serverUrl;
    $('token').value = settings.token;
    $('label').value = settings.label;

    $('server-form').onsubmit = (event) => {
        event.preventDefault();
        save();
    };
    $('test').onclick = async () => {
        if (!await save()) {
            return;
        }
        say($('server-status'), 'Testing...', 'muted');
        try {
            const result = await chrome.runtime.sendMessage({type: 'test'});
            say($('server-status'), result.message, result.ok ? 'ok' : 'err');
        } catch (e) {
            say($('server-status'), 'The test could not run: ' + e.message, 'err');
        }
    };

    $('site-form').onsubmit = async (event) => {
        event.preventDefault();
        const input = $('site').value.trim();
        const site = siteKey(/^[a-z]+:\/\//i.test(input) ? input : 'https://' + input);
        if (!site) {
            say($('site-status'), 'Enter an http or https site, e.g. https://meet.example.org.', 'err');
            return;
        }
        if (await enableSite(chrome, site)) {
            $('site').value = '';
            say($('site-status'), site + ' added. Reload its open tabs to start tracing.', 'ok');
        } else {
            say($('site-status'), 'Permission refused: ' + site + ' is not traced.', 'err');
        }
        renderSites();
    };

    renderSites();
}

main();
