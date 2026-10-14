import assert from 'node:assert/strict';
import {test} from 'node:test';
import {checkServerUrl, loadSettings, traceUrl, withoutQuery} from '../../src/common/settings.js';
import {addSite, removeSite, siteKey, sitePattern} from '../../src/common/sites.js';

test('the server URL must be ws:// or wss://', () => {
    assert.equal(checkServerUrl('wss://stats.example.org/x'), null);
    assert.equal(checkServerUrl('ws://127.0.0.1:3000/'), null);
    assert.match(checkServerUrl(''), /empty/);
    assert.match(checkServerUrl('https://stats.example.org'), /ws:\/\//);
    assert.match(checkServerUrl('stats.example.org'), /not a valid URL/);
});

test('traceUrl keeps the server query and adds ours', () => {
    const url = new URL(traceUrl({serverUrl: 'wss://s.example/p?tenant=a', token: '', label: ''}, 'https://m.example', '1.2.3'));
    assert.equal(url.searchParams.get('tenant'), 'a');
    assert.equal(url.searchParams.get('origin'), 'https://m.example');
    assert.equal(url.searchParams.has('rtcstats-token'), false);
    assert.equal(url.searchParams.has('label'), false);
});

test('withoutQuery hides the token', () => {
    assert.equal(withoutQuery('wss://s.example/p?rtcstats-token=x'), 'wss://s.example/p');
});

test('loadSettings fills the defaults', async () => {
    const settings = await loadSettings({get: async () => ({serverUrl: 'wss://s.example'})});
    assert.deepEqual(settings, {serverUrl: 'wss://s.example', token: '', label: '', sites: []});
});

test('a site is the scheme and host name, without port or path', () => {
    assert.equal(siteKey('https://meet.example.org:8443/room/x?y'), 'https://meet.example.org');
    assert.equal(siteKey('http://localhost:3000/'), 'http://localhost');
    assert.equal(siteKey('chrome://extensions'), null);
    assert.equal(siteKey('file:///tmp/x.html'), null);
    assert.equal(siteKey('not a url'), null);
    assert.equal(sitePattern('https://meet.example.org'), 'https://meet.example.org/*');
});

test('site lists stay sorted and without duplicates', () => {
    const sites = addSite(addSite(['https://b.example'], 'https://a.example'), 'https://a.example');
    assert.deepEqual(sites, ['https://a.example', 'https://b.example']);
    assert.deepEqual(removeSite(sites, 'https://a.example'), ['https://b.example']);
});
