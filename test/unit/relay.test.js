// The relay forwards one frame's trace to the service worker, and only the
// shapes the page is expected to post.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startRelay} from '../../src/content/relay.js';
import {KEEPALIVE_MS, MAX_MESSAGE_LENGTH, PAGE, RELAY} from '../../src/common/messages.js';
import {FakeWindow, fakeTimers, portPair} from './fakes.js';

function setup() {
    const win = new FakeWindow();
    const timers = fakeTimers();
    const worker = [];
    const runtime = {
        connect: () => {
            const [content, sw] = portPair();
            sw.received = [];
            sw.onMessage.addListener((m) => sw.received.push(m));
            worker.push(sw);
            return content;
        },
    };
    startRelay(win, runtime, timers);
    const page = (msg) => win.postMessage({source: PAGE, ...msg});
    const toPage = () => win.posted.filter((m) => m.source === RELAY);
    return {win, timers, worker, page, toPage};
}

test('opens one Port per frame and forwards open both ways', () => {
    const {worker, page, toPage} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    page({type: 'open', protocol: 'rtcstats#5.0'});
    assert.equal(worker.length, 1);
    const [sw] = worker;
    assert.deepEqual(sw.received, [{type: 'open', protocol: 'rtcstats#5.0'}]);
    sw.postMessage({type: 'open'});
    assert.deepEqual(toPage(), [{source: RELAY, type: 'open'}]);
});

test('a send before open is dropped', () => {
    const {worker, page} = setup();
    page({type: 'send', data: 'x'});
    assert.equal(worker.length, 0);
});

test('drops non-string and oversized payloads', () => {
    const {worker, page} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    page({type: 'send', data: {not: 'a string'}});
    page({type: 'send', data: 'y'.repeat(MAX_MESSAGE_LENGTH + 1)});
    page({type: 'send', data: 'ok'});
    assert.deepEqual(worker[0].received.slice(1), [{type: 'send', data: 'ok'}]);
});

test('ignores messages that are not from this window', () => {
    const {win, worker} = setup();
    win.deliver({source: PAGE, type: 'open', protocol: 'rtcstats#5.0'}, {});
    assert.equal(worker.length, 0);
});

test('a worker close reaches the page and frees the frame for a new trace', () => {
    const {worker, page, toPage, timers} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    worker[0].postMessage({type: 'close', code: 1008, reason: 'token'});
    assert.deepEqual(toPage().at(-1), {source: RELAY, type: 'close', code: 1008, reason: 'token'});
    assert.equal(timers.timers[0].cleared, true);
    page({type: 'open', protocol: 'rtcstats#5.0'});
    assert.equal(worker.length, 2);
});

test('a lost worker closes the page socket', () => {
    const {worker, page, toPage} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    worker[0].disconnect();
    assert.equal(toPage().at(-1).code, 1006);
});

test('the page close disconnects the Port', () => {
    const {worker, page} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    let gone = false;
    worker[0].onDisconnect.addListener(() => { gone = true; });
    page({type: 'close'});
    assert.equal(gone, true);
});

test('pings the worker to keep it awake', () => {
    const {worker, page, timers} = setup();
    page({type: 'open', protocol: 'rtcstats#5.0'});
    assert.equal(timers.timers[0].ms, KEEPALIVE_MS);
    timers.run(0);
    assert.deepEqual(worker[0].received.at(-1), {type: 'ping'});
});

test('an unavailable extension closes the page socket instead of throwing', () => {
    const win = new FakeWindow();
    startRelay(win, {connect: () => { throw new Error('Extension context invalidated.'); }}, fakeTimers());
    win.postMessage({source: PAGE, type: 'open', protocol: 'rtcstats#5.0'});
    assert.equal(win.posted.at(-1).code, 1011);
});
