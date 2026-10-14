// Messages between the page (MAIN world), the relay content script
// (ISOLATED world) and the service worker.
//
// page  -> relay : {source: PAGE, type: 'open', protocol} | {type: 'send', data} | {type: 'close'}
// relay -> page  : {source: RELAY, type: 'open'} | {type: 'close', code, reason}
// relay -> worker: {type: 'open', protocol} | {type: 'send', data} | {type: 'ping'}
// worker -> relay: {type: 'open'} | {type: 'close', code, reason}

export const PAGE = 'rtcstats-extension:page';
export const RELAY = 'rtcstats-extension:relay';
export const PORT_NAME = 'rtcstats-trace';

// One serialized trace event. getStats deltas are a few KB; a larger
// message comes from a page forging traffic, not from rtcstats.
export const MAX_MESSAGE_LENGTH = 1 << 20;

// Below the 30 s after which Chrome stops an idle service worker, which
// would drop the WebSocket while a meeting waits in a lobby.
export const KEEPALIVE_MS = 20000;
