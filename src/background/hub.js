// One WebSocket to the rtcstats server per traced frame, opened when the
// frame's relay asks for it and closed when the frame goes away (Port
// disconnect), which ends the dump on the server.
import {PORT_NAME} from '../common/messages.js';
import {checkServerUrl, traceUrl} from '../common/settings.js';
import {siteKey} from '../common/sites.js';

const WS_OPEN = 1;

export function createHub({WebSocketImpl, getSettings, version, log = console.warn.bind(console)}) {
    const traces = new Map();

    const post = (port, msg) => {
        try {
            port.postMessage(msg);
        } catch (e) { /* frame gone */ }
    };

    const end = (port, code, reason) => {
        const trace = traces.get(port);
        if (!trace) {
            return;
        }
        traces.delete(port);
        trace.ended = true;
        post(port, {type: 'close', code, reason});
        try {
            port.disconnect();
        } catch (e) { /* frame gone */ }
        if (trace.ws && trace.ws.readyState <= WS_OPEN) {
            trace.ws.close(1000);
        }
    };

    const open = async (port, trace, protocol) => {
        trace.opening = true;
        const settings = await getSettings();
        if (trace.ended) {
            return;
        }
        if (checkServerUrl(settings.serverUrl)) {
            end(port, 1008, 'no rtcstats server configured');
            return;
        }
        if (!settings.sites.includes(siteKey(trace.origin))) {
            end(port, 1008, 'site not enabled');
            return;
        }
        if (typeof protocol !== 'string' || !protocol.startsWith('rtcstats#')) {
            end(port, 1002, 'unexpected protocol');
            return;
        }
        let ws;
        try {
            ws = new WebSocketImpl(traceUrl(settings, trace.origin, version), protocol);
        } catch (e) {
            log('rtcstats: cannot open the WebSocket:', e);
            end(port, 1011, 'cannot open the WebSocket');
            return;
        }
        trace.ws = ws;
        ws.addEventListener('open', () => {
            trace.state = 'open';
            post(port, {type: 'open'});
        });
        ws.addEventListener('close', (event) => {
            if (event.code === 1008) {
                log('rtcstats: the server refused the trace (1008): check the token.');
            }
            end(port, event.code, event.reason);
        });
    };

    const onConnect = (port) => {
        if (port.name !== PORT_NAME || !port.sender) {
            return;
        }
        const trace = {
            // Set by Chrome from the frame, not by the page.
            origin: port.sender.origin,
            tabId: port.sender.tab ? port.sender.tab.id : null,
            state: 'connecting',
            ws: null,
            opening: false,
            ended: false,
        };
        traces.set(port, trace);
        port.onDisconnect.addListener(() => {
            traces.delete(port);
            trace.ended = true;
            if (trace.ws && trace.ws.readyState <= WS_OPEN) {
                trace.ws.close(1000);
            }
        });
        port.onMessage.addListener((msg) => {
            if (!msg || trace.ended) {
                return;
            }
            if (msg.type === 'open' && !trace.opening) {
                open(port, trace, msg.protocol).catch((e) => {
                    log('rtcstats: cannot start the trace:', e);
                    end(port, 1011, 'cannot start the trace');
                });
            } else if (msg.type === 'send' && typeof msg.data === 'string'
                       && trace.ws && trace.ws.readyState === WS_OPEN) {
                trace.ws.send(msg.data);
            }
            // 'ping' only keeps the service worker awake.
        });
    };

    // Ends the traces of the sites no longer enabled.
    const keepSites = (sites) => {
        for (const [port, trace] of traces) {
            if (!sites.includes(siteKey(trace.origin))) {
                end(port, 1000, 'site disabled');
            }
        }
    };

    const status = (tabId) => {
        const inTab = [...traces.values()].filter((t) => t.tabId === tabId);
        return {
            traces: inTab.length,
            open: inTab.filter((t) => t.state === 'open').length,
        };
    };

    return {onConnect, keepSites, status, size: () => traces.size};
}
