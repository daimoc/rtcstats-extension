// The built page script must not hold a real WebSocket: the socket and its
// token live in the service worker. Runs on dist/ (npm run build).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';

const page = new URL('../../dist/page.js', import.meta.url);

test('the page bundle gets BridgeSocket in place of WebSocket', {skip: !fs.existsSync(page) && 'run npm run build first'}, () => {
    const source = fs.readFileSync(page, 'utf8');
    assert.match(source, /provided dependency \*\/ var WebSocket = __webpack_require__/);
    assert.doesNotMatch(source, /globalThis\.WebSocket|window\.WebSocket/);
});
