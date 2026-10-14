// The built extension in a real Chromium: a loopback call on an enabled
// site reaches a fake rtcstats server, the token never reaches the page,
// and a site that is not enabled sends nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {after, before, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {decompressMethod} from '@rtcstats/rtcstats-shared';
import {chromium} from 'playwright';
import {WebSocketServer} from 'ws';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOKEN = 'e2e-secret-token';

let pages;
let server;
let context;
let worker;
let tmp;
const connections = [];

const listen = (srv) => new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv.address().port)));

async function until(check, what, timeoutMs = 20000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        const value = await check();
        if (value) {
            return value;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('timed out waiting for ' + what);
}

before(async () => {
    // Pages served on 127.0.0.1 (enabled) and localhost (not enabled).
    pages = http.createServer((req, res) => {
        const file = path.join(root, 'test/e2e/pages', path.basename(new URL(req.url, 'http://x').pathname));
        if (!fs.existsSync(file)) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, {'Content-Type': 'text/html'}).end(fs.readFileSync(file));
    });
    pages.port = await listen(pages);

    // A stand-in for rtcstats-server: records what each connection gets.
    const httpServer = http.createServer();
    server = new WebSocketServer({
        server: httpServer,
        handleProtocols: (protocols) => (protocols.has('rtcstats#5.0') ? 'rtcstats#5.0' : false),
    });
    server.on('connection', (ws, req) => {
        const record = {url: new URL(req.url, 'http://x'), protocol: ws.protocol, origin: req.headers.origin, messages: [], closed: false};
        connections.push(record);
        ws.on('message', (data) => record.messages.push(JSON.parse(data.toString())));
        ws.on('close', () => { record.closed = true; });
    });
    server.port = await listen(httpServer);
    server.http = httpServer;

    // The build, with 127.0.0.1 granted at install: a test cannot click the
    // permission prompt.
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtcstats-ext-e2e-'));
    const extension = path.join(tmp, 'extension');
    fs.cpSync(path.join(root, 'dist'), extension, {recursive: true});
    const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*'];
    fs.writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));

    context = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
        channel: 'chromium',
        headless: true,
        args: [
            `--disable-extensions-except=${extension}`,
            `--load-extension=${extension}`,
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
        ],
    });
    worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(({port, token}) => chrome.storage.local.set({
        serverUrl: `ws://127.0.0.1:${port}/dumps`,
        token,
        label: 'e2e',
        sites: ['http://127.0.0.1'],
    }), {port: server.port, token: TOKEN});
    await until(() => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length === 2),
        'the content scripts to be registered');
});

after(async () => {
    await context?.close();
    server?.close();
    server?.http.close();
    pages?.close();
    if (tmp) {
        fs.rmSync(tmp, {recursive: true, force: true});
    }
});

test('a call on an enabled site is traced to the server, and the token stays out of the page', async () => {
    const page = await context.newPage();
    // Everything the page's world can see go through window messages.
    await page.addInitScript(() => {
        window.__seen = [];
        window.addEventListener('message', (e) => window.__seen.push(JSON.stringify(e.data)));
    });
    const before = connections.length;
    await page.goto(`http://127.0.0.1:${pages.port}/loopback.html`);
    await until(() => page.evaluate(() => window.callState === 'connected'), 'the loopback call');

    const trace = await until(() => connections[before], 'a connection to the server');
    assert.equal(trace.protocol, 'rtcstats#5.0');
    assert.equal(trace.url.pathname, '/dumps');
    assert.equal(trace.url.searchParams.get('rtcstats-token'), TOKEN);
    assert.equal(trace.url.searchParams.get('origin'), `http://127.0.0.1:${pages.port}`);
    assert.equal(trace.url.searchParams.get('label'), 'e2e');
    assert.match(trace.origin, /^chrome-extension:\/\//);

    await until(() => trace.messages.some((m) => decompressMethod(m[0]) === 'getStats'), 'getStats from the page');
    const methods = trace.messages.map((m) => decompressMethod(m[0]));
    assert.equal(methods[0], 'create');
    assert.equal(trace.messages[0][1], null);
    for (const method of ['navigator.mediaDevices.getUserMedia', 'create', 'createOffer', 'setLocalDescription', 'getStats']) {
        assert.ok(methods.includes(method), method + ' missing in ' + methods.join(','));
    }
    // getStats is tied to its peer connection.
    assert.match(trace.messages.find((m) => decompressMethod(m[0]) === 'getStats')[1], /^PC_\d+$/);

    const seen = await page.evaluate(() => window.__seen.join('\n'));
    assert.ok(seen.includes('rtcstats-extension:page'), 'the page script talked to the relay');
    assert.ok(!seen.includes(TOKEN), 'the token reached the page');
    assert.ok(!seen.includes(`127.0.0.1:${server.port}`), 'the server URL reached the page');

    await page.close();
    await until(() => trace.closed, 'the server connection to close with the tab');
});

test('a site that is not enabled sends nothing', async () => {
    const page = await context.newPage();
    const before = connections.length;
    await page.goto(`http://localhost:${pages.port}/loopback.html`);
    await until(() => page.evaluate(() => window.callState === 'connected'), 'the loopback call');
    await new Promise((r) => setTimeout(r, 2500));
    assert.equal(connections.length, before);
    assert.equal(await page.evaluate(() => Symbol.for('rtcstats-extension') in window), false);
    await page.close();
});

test('disabling the site ends the running trace', async () => {
    const page = await context.newPage();
    const before = connections.length;
    await page.goto(`http://127.0.0.1:${pages.port}/loopback.html`);
    const trace = await until(() => connections[before], 'a connection to the server');
    await worker.evaluate(() => chrome.storage.local.set({sites: []}));
    await until(() => trace.closed, 'the trace to end');
    await until(() => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length === 0),
        'the content scripts to be unregistered');
    await page.close();
});

test('the options page saves the settings and tests the connection', async () => {
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.fill('#label', 'from-options');
    await page.click('#test');
    // Extension pages forbid eval, so no waitForFunction here.
    const status = await until(async () => {
        const text = await page.textContent('#server-status');
        return /Testing|Saved|^$/.test(text) ? null : text;
    }, 'the connection test result');
    assert.match(status, /^Connected/);
    assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('label')).label), 'from-options');
    const test = connections.at(-1);
    assert.equal(test.url.searchParams.get('origin'), 'connection-test');
    assert.equal(test.url.searchParams.get('rtcstats-token'), TOKEN);
    await page.close();
});
