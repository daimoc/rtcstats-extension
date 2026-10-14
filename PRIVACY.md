# Privacy policy: rtcstats WebRTC monitor

The extension is a tool for people who run their own rtcstats server. It has no server of its
own and sends nothing to its authors.

## What is collected

Only on the sites you enable yourself, and only in frames that use WebRTC, the extension records:

- **WebRTC API calls and their results:** peer connection configuration, SDP offers and answers,
  ICE candidates (which include IP addresses), connection state changes, and periodic
  `getStats()` statistics.
- **Media device calls:** `getUserMedia`, `getDisplayMedia`, `enumerateDevices` (device names
  and ids) and `setSinkId`.
- **Basic device information:** number of CPU cores, memory size, screen and window size,
  and user agent.
- **The traced page's origin** (for example `https://meet.example.org`), the extension
  version, and the label you set.

It does not record audio, video, the content of data channels, page content, keystrokes or
browsing history.

## Where it goes

The data goes only to the rtcstats server URL that you enter in the settings, over the
WebSocket you configure (use `wss://` for encryption). What happens to it there is decided by
whoever runs that server.

## What is stored in the browser

The server URL, the optional token and label, and the list of enabled sites are stored in
`chrome.storage.local`, on your computer only. The token is never made available to the web
pages you trace.

## Control

Tracing is off for every site until you enable it. Disabling a site, or removing the extension,
stops tracing immediately and removes the extension's access to that site.

## Contact

Open an issue on the project's repository.
