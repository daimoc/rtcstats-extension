import assert from 'node:assert/strict';
import {beforeEach, test} from 'node:test';
import {TEST_PROTOCOL, testConnection} from '../../src/background/connection-test.js';
import {FakeWebSocket, fakeTimers} from './fakes.js';

const SETTINGS = {serverUrl: 'wss://s.example/', token: 't', label: '', sites: []};

beforeEach(() => {
    FakeWebSocket.instances = [];
});

test('accepted when the socket stays open past the auth check', async () => {
    const timers = fakeTimers();
    const result = testConnection(FakeWebSocket, SETTINGS, '1', timers);
    const [ws] = FakeWebSocket.instances;
    assert.equal(ws.protocol, TEST_PROTOCOL);
    assert.equal(new URL(ws.url).searchParams.get('rtcstats-token'), 't');
    ws.serverOpen();
    timers.run(1);
    assert.equal((await result).ok, true);
    assert.equal(ws.closedWith, 1000);
});

test('a 1008 close right after open is a refused token', async () => {
    const timers = fakeTimers();
    const result = testConnection(FakeWebSocket, SETTINGS, '1', timers);
    const [ws] = FakeWebSocket.instances;
    ws.serverOpen();
    ws.serverClose(1008);
    timers.run(1);
    const {ok, message} = await result;
    assert.equal(ok, false);
    assert.match(message, /token/);
});

test('no answer times out', async () => {
    const timers = fakeTimers();
    const result = testConnection(FakeWebSocket, SETTINGS, '1', timers);
    timers.run(0);
    assert.equal((await result).ok, false);
});

test('a bad URL never opens a socket', async () => {
    const {ok} = await testConnection(FakeWebSocket, {...SETTINGS, serverUrl: 'https://s.example'}, '1');
    assert.equal(ok, false);
    assert.equal(FakeWebSocket.instances.length, 0);
});
