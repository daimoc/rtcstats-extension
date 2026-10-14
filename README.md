# rtcstats WebRTC monitor

A Chrome extension that adds [rtcstats](https://github.com/rtcstats/rtcstats)
monitoring to any WebRTC platform (Jitsi, BigBlueButton, Teams, Meet...)
without changing the platform. On the sites you enable, it records the WebRTC
API calls and `getStats()` results and streams them to **your own**
rtcstats-server. You get the same dumps a platform gets when it embeds
rtcstats-js itself.

## Use

1. Run an [rtcstats-server](https://github.com/rtcstats/rtcstats/tree/main/packages/rtcstats-server).
2. Open the extension's settings and enter the server URL (`wss://...`). If the server has a
   `jwtSecret`, also enter a token. Then click **Save and test the connection**.
3. On the meeting site, click the extension icon and choose **Trace this site**, then accept
   Chrome's permission prompt.
4. Reload the page, then join the meeting. Tracing must start before the platform's scripts
   run.

Each frame that uses WebRTC opens its own connection to the server, which gives one dump per
frame. Frames without WebRTC open none. The dump ends when the tab closes, the page navigates
away, or the site is disabled.

In the dump metadata, the server records the URL query:

| Parameter | Value |
|-----------|-------|
| `origin` | the traced page's origin |
| `ext` | the extension version |
| `label` | optional, from the settings |
| `rtcstats-token` | the token; the server stores it as `obfuscated` |

## How it works

```
page (MAIN world, document_start)          content script (ISOLATED)       service worker
rtcstats-js wrappers -> WebSocketTrace --postMessage--> relay.js --runtime Port--> WebSocket per frame
              (BridgeSocket)          <--open/close---          <-------------   (URL + token)
```

- **`page.js`** runs in the page's own JavaScript world, before the page's scripts, in every
  frame of an enabled site. It is rtcstats-js 2.5.0, unchanged. Webpack's `ProvidePlugin`
  replaces the `WebSocket` that rtcstats' `WebSocketTrace` opens with `BridgeSocket`. The
  events are serialized by rtcstats itself, so the wire format is exactly what rtcstats-server
  expects.
- **`relay.js`** runs in the extension's isolated world. It forwards one frame's serialized
  events to the service worker. It accepts only string payloads up to 1 MB, because the page
  can post anything on its window.
- **`background.js`** (service worker) opens the real WebSocket with the URL and token from
  `chrome.storage.local`. The token never enters the page, so the traced site's scripts cannot
  read it.
- **Sites** are opt-in. The extension asks for the host permission of one site at a time
  (`optional_host_permissions`). It registers its content scripts with
  `chrome.scripting.registerContentScripts` for the granted sites only.

The extension follows the same rules as the SIPMediaGW gateway's tracing:
- it connects on the first WebRTC call only;
- a tracing error never reaches the site's own WebRTC calls;
- the server URL must be `ws://` or `wss://`.

## Limits

- **Cross-origin frames.** A platform that runs the call in an iframe from another site
  needs that site enabled too. Add it in the settings.
- **Sites that bundle rtcstats-js v2 themselves.** Both wrappers run and both get their dump.
  The extension removes rtcstats' "already wrapped" markers so the site's own monitoring still
  starts. Both wrappers write `pc.__rtcStatsId`, so a peer connection can carry the site's id in
  the extension's dump if the two counters differ.
- **Interrupted traces.** There is no reconnection, as in rtcstats-js. If the server or the
  extension's service worker goes away mid-call, the trace stops until the next page load.
  The content script pings the service worker every 20 s so that Chrome doesn't stop it while
  you wait in a lobby.
- **getStats interval.** It is fixed at 1 s. rtcstats reads it when it wraps
  `RTCPeerConnection`, before the settings can be read.

## Develop

```sh
npm install
npm run build        # dist/, load it with chrome://extensions > Load unpacked
npm test             # unit tests (node --test)
npx playwright install chromium
npm run test:e2e     # the built extension in Chromium, against a fake rtcstats-server
npm run zip          # release/rtcstats-extension-<version>.zip for the Chrome Web Store
```

The version comes from `package.json` and is copied into the manifest at build time. To change
the icons, edit and run `scripts/make-icons.py` (needs Pillow), then commit the PNGs.

Publishing steps and the Store listing texts are in [STORE.md](STORE.md).

## License

MIT, see [LICENSE](LICENSE). The bundled rtcstats-js is MIT, see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
