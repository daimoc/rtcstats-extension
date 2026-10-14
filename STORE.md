# Publishing on the Chrome Web Store

## Build the package

```sh
npm version patch      # or minor; the manifest takes its version from package.json
npm test && npm run test:e2e
npm run zip            # release/rtcstats-extension-<version>.zip
```

Before uploading, load `dist/` once in your everyday Chrome (chrome://extensions, then
Developer mode, then Load unpacked). Check that the extension has no errors and that a real
meeting is traced.

## Dashboard: listing

- **Name:** rtcstats WebRTC monitor
- **Summary (132 characters max):** Streams the WebRTC traces and getStats() of the sites you
  enable to your own rtcstats server.
- **Category:** Developer Tools
- **Description:**

  > Monitor the quality of any WebRTC platform (Jitsi, BigBlueButton, Meet, Teams...) with
  > rtcstats, without changing the platform.
  >
  > On the sites you enable, the extension records the WebRTC API calls and getStats()
  > statistics and streams them to your own rtcstats server
  > (https://github.com/rtcstats/rtcstats). You get the same dumps as a platform that embeds
  > rtcstats-js, ready for rtcstats' dump viewer and feature extraction.
  >
  > - Opt-in per site: no access to any site until you enable it.
  > - Your server, your data: nothing is sent anywhere else.
  > - Server tokens stay in the extension, never exposed to the traced pages.
  >
  > Requires an rtcstats server.

- **Screenshots (1280x800):** the popup on a meeting site, the settings page, and a dump
  opened in the rtcstats viewer.
- **Icon:** `icons/icon128.png`

## Dashboard: privacy practices

- **Single purpose:** Send WebRTC diagnostics (API traces and getStats() statistics) of the sites
  the user enables to the rtcstats server the user configures.
- **Permission justifications:**
  - `storage`: keeps the server URL, the token, the label and the list of enabled sites.
  - `scripting`: registers the tracing content scripts for the sites the user enabled, and only
    those, before the page loads.
  - `activeTab`: lets the popup read the current tab's site so it can offer to enable it.
  - **Host permissions** (optional, requested one site at a time): the tracing must run in the
    pages of the meeting site the user enables, before the site's own scripts.
- **Remote code:** No. All code is in the package.
- **Data usage:** check "Website content" (WebRTC session descriptions and statistics) and
  "Technical data / device information". It is sent only to the server the user sets. It is not
  sold, and not used for any purpose unrelated to the single purpose.
- **Privacy policy URL:** publish `PRIVACY.md`, for example as the repository's file URL or a
  GitHub Pages page, and give its URL.

## Expect in review

- Extensions with host permissions get an in-depth review, which can take several days.
- The code is not minified (webpack `minimize: false`), so reviewers can read it.
