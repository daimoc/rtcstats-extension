// Carries one frame's trace between the page (BridgeSocket) and the service
// worker. The page can post anything on its own window, so only the expected
// shapes go through.
import {KEEPALIVE_MS, MAX_MESSAGE_LENGTH, PAGE, PORT_NAME, RELAY} from '../common/messages.js';

export function startRelay(win, runtime, timers = globalThis) {
    let port = null;
    let keepalive = null;

    const toPage = (msg) => win.postMessage({source: RELAY, ...msg}, '*');

    const release = () => {
        timers.clearInterval(keepalive);
        keepalive = null;
        port = null;
    };

    const open = (protocol) => {
        let current;
        try {
            current = runtime.connect({name: PORT_NAME});
        } catch (e) {
            // The extension was reloaded or removed: this frame keeps its page alive.
            toPage({type: 'close', code: 1011, reason: 'extension unavailable'});
            return;
        }
        port = current;
        current.onMessage.addListener((msg) => {
            if (port !== current || !msg) {
                return;
            }
            if (msg.type === 'open') {
                toPage({type: 'open'});
            } else if (msg.type === 'close') {
                release();
                toPage({type: 'close', code: msg.code, reason: msg.reason});
            }
        });
        current.onDisconnect.addListener(() => {
            if (port === current) {
                release();
                toPage({type: 'close', code: 1006, reason: 'extension disconnected'});
            }
        });
        current.postMessage({type: 'open', protocol});
        keepalive = timers.setInterval(() => current.postMessage({type: 'ping'}), KEEPALIVE_MS);
    };

    win.addEventListener('message', (event) => {
        const msg = event.data;
        if (event.source !== win || !msg || msg.source !== PAGE) {
            return;
        }
        if (msg.type === 'open') {
            if (!port && typeof msg.protocol === 'string') {
                open(msg.protocol);
            }
        } else if (msg.type === 'send') {
            if (port && typeof msg.data === 'string' && msg.data.length <= MAX_MESSAGE_LENGTH) {
                port.postMessage({type: 'send', data: msg.data});
            }
        } else if (msg.type === 'close') {
            if (port) {
                const current = port;
                release();
                current.disconnect();
            }
        }
    });
}
