// Content scripts are registered for the stored sites the user granted,
// in the page's world and isolated world, before the page's scripts.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {serialized, syncRegistrations} from '../../src/background/registrations.js';

function fakeChrome(granted) {
    let registered = [];
    return {
        permissions: {contains: async ({origins}) => origins.every((o) => granted.includes(o))},
        scripting: {
            getRegisteredContentScripts: async () => registered,
            unregisterContentScripts: async ({ids}) => {
                registered = registered.filter((s) => !ids.includes(s.id));
            },
            registerContentScripts: async (scripts) => {
                for (const s of scripts) {
                    if (registered.some((r) => r.id === s.id)) {
                        throw new Error('Duplicate script ID ' + s.id);
                    }
                }
                registered = [...registered, ...scripts];
            },
        },
        registered: () => registered,
    };
}

test('registers both scripts for the granted sites only', async () => {
    const chrome = fakeChrome(['https://meet.example.org/*']);
    const granted = await syncRegistrations(chrome, ['https://meet.example.org', 'https://refused.example.org']);
    assert.deepEqual(granted, ['https://meet.example.org']);
    const [page, relay] = chrome.registered();
    assert.equal(page.world, 'MAIN');
    assert.deepEqual(page.js, ['page.js']);
    assert.equal(relay.world, 'ISOLATED');
    assert.deepEqual(relay.js, ['relay.js']);
    for (const script of [page, relay]) {
        assert.deepEqual(script.matches, ['https://meet.example.org/*']);
        assert.equal(script.runAt, 'document_start');
        assert.equal(script.allFrames, true);
        assert.equal(script.matchOriginAsFallback, true);
        assert.equal(script.persistAcrossSessions, true);
    }
});

test('re-syncing replaces the registrations; no site means none', async () => {
    const chrome = fakeChrome(['https://a.example/*', 'https://b.example/*']);
    await syncRegistrations(chrome, ['https://a.example']);
    await syncRegistrations(chrome, ['https://a.example', 'https://b.example']);
    assert.equal(chrome.registered().length, 2);
    assert.deepEqual(chrome.registered()[0].matches, ['https://a.example/*', 'https://b.example/*']);
    await syncRegistrations(chrome, []);
    assert.deepEqual(chrome.registered(), []);
});

test('serialized runs overlapping calls one after the other', async () => {
    const chrome = fakeChrome(['https://a.example/*']);
    const sync = serialized(() => syncRegistrations(chrome, ['https://a.example']));
    await Promise.all([sync(), sync(), sync()]);
    assert.equal(chrome.registered().length, 2);
});

test('serialized keeps going after a failure', async () => {
    let calls = 0;
    const run = serialized(async () => {
        calls++;
        if (calls === 1) {
            throw new Error('boom');
        }
    });
    await assert.rejects(run());
    await run();
    assert.equal(calls, 2);
});
