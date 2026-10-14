// Stands in for the WebSocket that rtcstats' WebSocketTrace opens: webpack's
// ProvidePlugin swaps it in for the page bundle only. Events are already
// serialized by WebSocketTrace; they go to the relay content script, and the
// real socket lives in the service worker, so the server URL and token never
// reach the page.
import {PAGE, RELAY} from '../common/messages.js';

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

export default class BridgeSocket {
    // The URL is ignored: the service worker builds it from the settings.
    constructor(url, protocol, target = globalThis) {
        this.readyState = CONNECTING;
        this.protocol = '';
        this._target = target;
        this._listeners = {};
        this._onRelay = (event) => {
            const msg = event.data;
            if (event.source !== this._target || !msg || msg.source !== RELAY) {
                return;
            }
            if (msg.type === 'open' && this.readyState === CONNECTING) {
                this.readyState = OPEN;
                this.protocol = protocol;
                this._emit('open', {type: 'open'});
            } else if (msg.type === 'close' && this.readyState !== CLOSED) {
                if (msg.code !== 1000) {
                    this._emit('error', {type: 'error'});
                }
                this._closed(msg.code, msg.reason);
            }
        };
        target.addEventListener('message', this._onRelay);
        this._post({type: 'open', protocol});
    }

    addEventListener(type, listener) {
        (this._listeners[type] ||= []).push(listener);
    }

    removeEventListener(type, listener) {
        this._listeners[type] = (this._listeners[type] || []).filter((l) => l !== listener);
    }

    send(data) {
        if (this.readyState !== OPEN) {
            throw new Error('BridgeSocket is not open');
        }
        this._post({type: 'send', data});
    }

    close() {
        if (this.readyState === CLOSING || this.readyState === CLOSED) {
            return;
        }
        this._post({type: 'close'});
        this._closed(1000, '');
    }

    _closed(code, reason) {
        this.readyState = CLOSED;
        this._target.removeEventListener('message', this._onRelay);
        this._emit('close', {type: 'close', code, reason});
    }

    _post(msg) {
        // To this frame only: the relay listens on the same window.
        this._target.postMessage({source: PAGE, ...msg}, '*');
    }

    _emit(type, event) {
        for (const listener of this._listeners[type] || []) {
            try {
                listener(event);
            } catch (e) {
                console.warn('[rtcstats] listener failed:', e);
            }
        }
    }
}

BridgeSocket.CONNECTING = CONNECTING;
BridgeSocket.OPEN = OPEN;
BridgeSocket.CLOSING = CLOSING;
BridgeSocket.CLOSED = CLOSED;
