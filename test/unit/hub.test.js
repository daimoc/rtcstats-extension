// The service worker opens one WebSocket per traced frame, with the token
// from the settings, and only for enabled sites.
import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {createHub} from '../../src/background/hub.js';
import {FakeWebSocket, flush, portPair} from './fakes.js';

const SETTINGS = {
    serverUrl: 'wss://stats.example.org/dumps',
    token: 'secret-jwt',
    label: 'desk 3',
    sites: ['https://meet.example.org'],
};

let settings;
let logs;

beforeEach(() => {
    FakeWebSocket.instances = [];
    settings = {...SETTINGS};
    logs = [];
});

function connect(origin = 'https://meet.example.org', tabId = 7) {
    const hub = createHub({
        WebSocketImpl: FakeWebSocket,
        getSettings: async () => settings,
        version: '0.1.0',
        log: (...args) => logs.push(args.join(' ')),
    });
    const [relay, sw] = portPair({origin, tab: {id: tabId}});
    relay.received = [];
    relay.onMessage.addListener((m) => relay.received.push(m));
    hub.onConnect(sw);
    return {hub, relay};
}

test('opens the WebSocket with the token, origin and label in the query', async () => {
    const {relay} = connect('https://meet.example.org:8443');
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    const [ws] = FakeWebSocket.instances;
    const url = new URL(ws.url);
    assert.equal(url.origin + url.pathname, 'wss://stats.example.org/dumps');
    assert.equal(url.searchParams.get('rtcstats-token'), 'secret-jwt');
    assert.equal(url.searchParams.get('origin'), 'https://meet.example.org:8443');
    assert.equal(url.searchParams.get('label'), 'desk 3');
    assert.equal(url.searchParams.get('ext'), '0.1.0');
    assert.equal(ws.protocol, 'rtcstats#5.0');
});

test('tells the relay when the socket opens, then forwards strings', async () => {
    const {hub, relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    const [ws] = FakeWebSocket.instances;
    relay.postMessage({type: 'send', data: 'early'});
    ws.serverOpen();
    assert.deepEqual(relay.received, [{type: 'open'}]);
    relay.postMessage({type: 'send', data: '["c",null,{}]'});
    relay.postMessage({type: 'send', data: 42});
    assert.deepEqual(ws.sent, ['["c",null,{}]']);
    assert.deepEqual(hub.status(7), {traces: 1, open: 1});
    assert.deepEqual(hub.status(8), {traces: 0, open: 0});
});

test('a second open on the same frame opens nothing more', async () => {
    const {relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    assert.equal(FakeWebSocket.instances.length, 1);
});

test('the frame going away closes the socket, which ends the dump', async () => {
    const {hub, relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    const [ws] = FakeWebSocket.instances;
    ws.serverOpen();
    relay.disconnect();
    assert.equal(ws.closedWith, 1000);
    assert.equal(hub.size(), 0);
});

test('the server closing ends the trace and disconnects the relay', async () => {
    const {hub, relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    FakeWebSocket.instances[0].serverClose(1008, 'unauthorized');
    assert.deepEqual(relay.received.at(-1), {type: 'close', code: 1008, reason: 'unauthorized'});
    assert.equal(relay.connected, false);
    assert.equal(hub.size(), 0);
    assert.match(logs.join('\n'), /token/);
});

test('no server configured: refused, no socket', async () => {
    settings.serverUrl = '';
    const {relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    assert.equal(FakeWebSocket.instances.length, 0);
    assert.equal(relay.received.at(-1).code, 1008);
});

test('a frame of a site that is not enabled is refused', async () => {
    const {relay} = connect('https://elsewhere.example.net');
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    assert.equal(FakeWebSocket.instances.length, 0);
    assert.equal(relay.received.at(-1).reason, 'site not enabled');
});

test('an unexpected protocol is refused', async () => {
    const {relay} = connect();
    relay.postMessage({type: 'open', protocol: 'chat'});
    await flush();
    assert.equal(FakeWebSocket.instances.length, 0);
});

test('a frame gone before the settings load opens no socket', async () => {
    const {relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    relay.disconnect();
    await flush();
    assert.equal(FakeWebSocket.instances.length, 0);
});

test('disabling a site ends its running traces', async () => {
    const {hub, relay} = connect();
    relay.postMessage({type: 'open', protocol: 'rtcstats#5.0'});
    await flush();
    const [ws] = FakeWebSocket.instances;
    ws.serverOpen();
    hub.keepSites(['https://meet.example.org']);
    assert.equal(hub.size(), 1);
    hub.keepSites([]);
    assert.equal(hub.size(), 0);
    assert.equal(ws.closedWith, 1000);
});

test('ignores Ports that are not trace Ports', () => {
    const hub = createHub({WebSocketImpl: FakeWebSocket, getSettings: async () => settings, version: '0'});
    const [, sw] = portPair({origin: 'https://meet.example.org'});
    sw.name = 'other';
    hub.onConnect(sw);
    assert.equal(hub.size(), 0);
});
