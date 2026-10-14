// Runs in every frame of an enabled site, in the page's world, before the
// page's own scripts (content script, MAIN world, document_start).

export const GET_STATS_INTERVAL_MS = 1000;
const LOADED = Symbol.for('rtcstats-extension');
// Ignored by BridgeSocket: the service worker knows the real server URL.
const ENDPOINT = 'rtcstats-extension:';

export function startTrace(win, lib, log = console.warn.bind(console)) {
    if (win[LOADED]) {
        return false;
    }
    win[LOADED] = true;
    try {
        const trace = new lib.WebSocketTrace({log});
        let connected = false;
        let off = false;
        // Connect on the first WebRTC/media call only: frames without
        // WebRTC (ads, widgets...) must not create empty dumps.
        const lazyTrace = function (...args) {
            if (off) {
                return;
            }
            // Never let a tracing error reach the site's own WebRTC calls.
            try {
                if (!connected) {
                    connected = true;
                    trace.connect(ENDPOINT);
                }
                trace(...args);
            } catch (e) {
                off = true;
                log('[rtcstats] tracing off in this frame:', e);
            }
        };
        lib.wrapRTCPeerConnection(lazyTrace, win, {getStatsInterval: GET_STATS_INTERVAL_MS});
        lib.wrapGetUserMedia(lazyTrace, win);
        lib.wrapEnumerateDevices(lazyTrace, win);
        if (typeof lib.wrapSetSinkId === 'function') {
            lib.wrapSetSinkId(lazyTrace, win);
        }
        releaseMarkers(win);
        return true;
    } catch (e) {
        log('[rtcstats] setup failed, tracing off in this frame:', e);
        return false;
    }
}

// rtcstats marks what it wraps so it never wraps twice. Remove the marks: a
// site that bundles rtcstats itself must still wrap (on top of ours), or the
// extension would silently turn off the site's own monitoring.
export function releaseMarkers(win) {
    const marked = [
        win.RTCPeerConnection && win.RTCPeerConnection.prototype,
        win.navigator && win.navigator.mediaDevices,
        win.navigator && win.navigator.mediaDevices && win.navigator.mediaDevices.enumerateDevices,
        win.HTMLMediaElement && win.HTMLMediaElement.prototype.setSinkId,
    ];
    for (const target of marked) {
        if (target && Object.prototype.hasOwnProperty.call(target, '__rtcStats')) {
            delete target.__rtcStats;
        }
    }
}
