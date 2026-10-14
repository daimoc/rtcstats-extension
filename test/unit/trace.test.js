// The page script wraps WebRTC once per frame, connects lazily, never lets
// a tracing error reach the site, and leaves the site free to wrap too.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GET_STATS_INTERVAL_MS, releaseMarkers, startTrace} from '../../src/page/trace.js';

function fakeLib() {
    const calls = {connect: [], trace: [], wrapped: []};
    const lib = {
        WebSocketTrace: function () {
            const trace = (...args) => calls.trace.push(args);
            trace.connect = (url) => calls.connect.push(url);
            return trace;
        },
        wrapRTCPeerConnection: (trace, win, options) => {
            calls.wrapped.push(['pc', options]);
            lib.pcTrace = trace;
        },
        wrapGetUserMedia: () => calls.wrapped.push(['gum']),
        wrapEnumerateDevices: () => calls.wrapped.push(['enum']),
        wrapSetSinkId: () => calls.wrapped.push(['sink']),
    };
    return {lib, calls};
}

test('wraps everything once per frame, with the getStats interval', () => {
    const win = {};
    const {lib, calls} = fakeLib();
    assert.equal(startTrace(win, lib, () => {}), true);
    assert.equal(startTrace(win, lib, () => {}), false);
    assert.deepEqual(calls.wrapped, [['pc', {getStatsInterval: GET_STATS_INTERVAL_MS}], ['gum'], ['enum'], ['sink']]);
});

test('connects on the first traced call only', () => {
    const {lib, calls} = fakeLib();
    startTrace({}, lib, () => {});
    assert.equal(calls.connect.length, 0);
    lib.pcTrace('create', 'PC_0', {});
    lib.pcTrace('createOffer', 'PC_0', {});
    assert.equal(calls.connect.length, 1);
    assert.equal(calls.trace.length, 2);
});

test('a tracing error turns tracing off instead of reaching the site', () => {
    const {lib, calls} = fakeLib();
    const logs = [];
    lib.WebSocketTrace = function () {
        const trace = () => { throw new Error('boom'); };
        trace.connect = () => calls.connect.push('x');
        return trace;
    };
    startTrace({}, lib, (...args) => logs.push(args));
    assert.doesNotThrow(() => lib.pcTrace('create', 'PC_0', {}));
    assert.doesNotThrow(() => lib.pcTrace('createOffer', 'PC_0', {}));
    assert.equal(calls.connect.length, 1);
    assert.equal(logs.length, 1);
});

test('works with a library without wrapSetSinkId', () => {
    const {lib, calls} = fakeLib();
    delete lib.wrapSetSinkId;
    assert.equal(startTrace({}, lib, () => {}), true);
    assert.equal(calls.wrapped.length, 3);
});

test('a failing setup is logged, not thrown', () => {
    const {lib} = fakeLib();
    lib.wrapGetUserMedia = () => { throw new Error('no mediaDevices'); };
    const logs = [];
    assert.equal(startTrace({}, lib, (...args) => logs.push(args)), false);
    assert.equal(logs.length, 1);
});

test('releaseMarkers removes the rtcstats double-wrap marks', () => {
    const enumerateDevices = () => {};
    enumerateDevices.__rtcStats = true;
    const setSinkId = () => {};
    setSinkId.__rtcStats = true;
    const win = {
        RTCPeerConnection: {prototype: {__rtcStats: true}},
        navigator: {mediaDevices: {__rtcStats: true, enumerateDevices}},
        HTMLMediaElement: {prototype: {setSinkId}},
    };
    releaseMarkers(win);
    assert.equal('__rtcStats' in win.RTCPeerConnection.prototype, false);
    assert.equal('__rtcStats' in win.navigator.mediaDevices, false);
    assert.equal('__rtcStats' in enumerateDevices, false);
    assert.equal('__rtcStats' in setSinkId, false);
    assert.doesNotThrow(() => releaseMarkers({}));
});
