// "Test connection" in the options page. rtcstats-server reports a bad token
// by closing with 1008 just after 'open' (it authenticates after the
// handshake), so the socket is kept for a moment before it counts as accepted.
import {checkServerUrl, traceUrl} from '../common/settings.js';

// rtcstats-js 2.5.0 trace-websocket.js: 'rtcstats#' + PROTOCOL_VERSION.
export const TEST_PROTOCOL = 'rtcstats#5.0';
const SETTLE_MS = 1500;
const TIMEOUT_MS = 8000;

export function testConnection(WebSocketImpl, settings, version, timers = globalThis) {
    const error = checkServerUrl(settings.serverUrl);
    if (error) {
        return Promise.resolve({ok: false, message: error});
    }
    return new Promise((resolve) => {
        let ws;
        let done = false;
        const finish = (result) => {
            if (done) {
                return;
            }
            done = true;
            timers.clearTimeout(timeout);
            if (ws && ws.readyState <= 1) {
                ws.close(1000);
            }
            resolve(result);
        };
        const timeout = timers.setTimeout(
            () => finish({ok: false, message: 'No answer from the server.'}), TIMEOUT_MS);
        try {
            ws = new WebSocketImpl(traceUrl(settings, 'connection-test', version), TEST_PROTOCOL);
        } catch (e) {
            finish({ok: false, message: 'Cannot open the WebSocket: ' + e.message});
            return;
        }
        ws.addEventListener('open', () => {
            timers.setTimeout(() => finish({ok: true, message: 'Connected: the server accepts traces.'}), SETTLE_MS);
        });
        ws.addEventListener('close', (event) => {
            if (event.code === 1008) {
                finish({ok: false, message: 'The server refused the token (1008).'});
            } else {
                finish({ok: false, message: 'The connection closed (' + event.code + '). Check the URL and that the server is up.'});
            }
        });
    });
}
