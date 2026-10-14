// Small stand-ins for window, chrome.runtime Ports and WebSocket.

// A window whose postMessage delivers to its own listeners, synchronously.
export class FakeWindow {
    constructor() {
        this.listeners = [];
        this.posted = [];
    }

    addEventListener(type, listener) {
        if (type === 'message') {
            this.listeners.push(listener);
        }
    }

    removeEventListener(type, listener) {
        this.listeners = this.listeners.filter((l) => l !== listener);
    }

    postMessage(data) {
        this.posted.push(data);
        this.deliver(data, this);
    }

    deliver(data, source) {
        for (const listener of [...this.listeners]) {
            listener({data, source});
        }
    }
}

class FakeEvent {
    constructor() {
        this.listeners = [];
    }

    addListener(listener) {
        this.listeners.push(listener);
    }

    fire(...args) {
        for (const listener of [...this.listeners]) {
            listener(...args);
        }
    }
}

// Both ends of a chrome.runtime Port.
export function portPair(sender = {}) {
    const a = {name: 'rtcstats-trace', sender, sent: [], onMessage: new FakeEvent(), onDisconnect: new FakeEvent(), connected: true};
    const b = {name: 'rtcstats-trace', sender, sent: [], onMessage: new FakeEvent(), onDisconnect: new FakeEvent(), connected: true};
    const wire = (from, to) => {
        from.postMessage = (msg) => {
            if (!from.connected) {
                throw new Error('Attempting to use a disconnected port object');
            }
            from.sent.push(msg);
            to.onMessage.fire(msg, to);
        };
        // Like Chrome: the side that disconnects gets no onDisconnect.
        from.disconnect = () => {
            if (!from.connected) {
                return;
            }
            from.connected = false;
            to.connected = false;
            to.onDisconnect.fire(to);
        };
    };
    wire(a, b);
    wire(b, a);
    return [a, b];
}

export class FakeWebSocket {
    constructor(url, protocol) {
        this.url = url;
        this.protocol = protocol;
        this.readyState = 0;
        this.sent = [];
        this.closedWith = null;
        this.listeners = {};
        FakeWebSocket.instances.push(this);
    }

    addEventListener(type, listener) {
        (this.listeners[type] ||= []).push(listener);
    }

    send(data) {
        this.sent.push(data);
    }

    close(code) {
        this.closedWith = code;
        this.readyState = 3;
    }

    // Test side: what the server does.
    serverOpen() {
        this.readyState = 1;
        this.fire('open', {});
    }

    serverClose(code, reason = '') {
        this.readyState = 3;
        this.fire('close', {code, reason});
    }

    fire(type, event) {
        for (const listener of this.listeners[type] || []) {
            listener(event);
        }
    }
}
FakeWebSocket.instances = [];

export const flush = () => new Promise((resolve) => setImmediate(resolve));

export function fakeTimers() {
    const timers = [];
    return {
        timers,
        setInterval: (fn, ms) => timers.push({fn, ms, cleared: false}) - 1,
        clearInterval: (id) => {
            if (id !== null && timers[id]) {
                timers[id].cleared = true;
            }
        },
        setTimeout: (fn, ms) => timers.push({fn, ms, cleared: false}) - 1,
        clearTimeout: (id) => {
            if (id !== null && timers[id]) {
                timers[id].cleared = true;
            }
        },
        run: (id) => timers[id].fn(),
    };
}
