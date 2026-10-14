// BridgeSocket must behave like the WebSocket that rtcstats' WebSocketTrace
// expects, and only ever trust what the relay posts on the same window.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import BridgeSocket from '../../src/page/bridge-socket.js';
import {PAGE, RELAY} from '../../src/common/messages.js';
import {FakeWindow} from './fakes.js';

const fromPage = (win) => win.posted.filter((m) => m.source === PAGE);

test('asks the relay to open, with the protocol and without the URL', () => {
    const win = new FakeWindow();
    const socket = new BridgeSocket('wss://ignored.example', 'rtcstats#5.0', win);
    assert.equal(socket.readyState, BridgeSocket.CONNECTING);
    assert.deepEqual(fromPage(win), [{source: PAGE, type: 'open', protocol: 'rtcstats#5.0'}]);
});

test('opens on the relay answer, then sends strings through it', () => {
    const win = new FakeWindow();
    const socket = new BridgeSocket('', 'rtcstats#5.0', win);
    let opened = 0;
    socket.addEventListener('open', () => opened++);
    win.postMessage({source: RELAY, type: 'open'});
    assert.equal(opened, 1);
    assert.equal(socket.readyState, BridgeSocket.OPEN);
    socket.send('["c",null,{}]');
    assert.deepEqual(fromPage(win).at(-1), {source: PAGE, type: 'send', data: '["c",null,{}]'});
});

test('send before open throws, like a WebSocket', () => {
    const socket = new BridgeSocket('', 'rtcstats#5.0', new FakeWindow());
    assert.throws(() => socket.send('x'));
});

test('ignores messages from other frames and from the page itself', () => {
    const win = new FakeWindow();
    const socket = new BridgeSocket('', 'rtcstats#5.0', win);
    win.deliver({source: RELAY, type: 'open'}, {});
    win.postMessage({source: PAGE, type: 'open'});
    assert.equal(socket.readyState, BridgeSocket.CONNECTING);
});

test('a relay close with an error code fires error then close', () => {
    const win = new FakeWindow();
    const socket = new BridgeSocket('', 'rtcstats#5.0', win);
    const events = [];
    socket.addEventListener('error', () => events.push('error'));
    socket.addEventListener('close', (e) => events.push('close ' + e.code));
    win.postMessage({source: RELAY, type: 'close', code: 1008, reason: 'token'});
    assert.deepEqual(events, ['error', 'close 1008']);
    assert.equal(socket.readyState, BridgeSocket.CLOSED);
    // Closed sockets stop listening.
    win.postMessage({source: RELAY, type: 'open'});
    assert.equal(socket.readyState, BridgeSocket.CLOSED);
});

test('close() tells the relay once', () => {
    const win = new FakeWindow();
    const socket = new BridgeSocket('', 'rtcstats#5.0', win);
    socket.close();
    socket.close();
    assert.equal(fromPage(win).filter((m) => m.type === 'close').length, 1);
    assert.equal(socket.readyState, BridgeSocket.CLOSED);
});
