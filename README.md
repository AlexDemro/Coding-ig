# FretMate.app

A responsive guitar practice studio, built with browser JavaScript and a dependency-free Node server.

## Run

Requires Node.js 18 or newer. No package installation is required.

```sh
npm start
```

The server listens on port 3000; set `PORT` to override it. Run `npm test` for the 45 music, tuner, chart-layout, song-search, and chart-source tests.

## Tools

- Microphone tuner for standard guitar tuning. Requires microphone permission and HTTPS or localhost. Uses A4 = 440 Hz.
- Library of 16 common chord shapes, searchable by name and family.
- Capo converter, frets 0–12, with conversion in either direction and slash-chord support.
- Song chord maker: turn pasted lyrics with inline chords or chord-above-lyric text into paginated PNG or SVG images. A live title-and-artist search fills in song details from the public Apple Music/iTunes catalog, with an Open in Spotify search link. There is no automatic lyric/chord retrieval or transcription.
- Photo reader: recognize printed lyrics and chord symbols using Tesseract.js 5, correct the recognized text and spacing, and export a new chord-over-lyric image. Images stay in the browser; the OCR library, worker, and English model require network access. Staff notes cannot be converted to chords, and missing lyrics are never invented. Pasted charts and image export work offline after the site loads.
- Metronome with adjustable tempo, time signature, downbeat accent, and tap tempo.
- Four animated strumming patterns with adjustable playback speed; audio uses synthesized plucked guitar strings with directional strums and a choice of G, D, Em, or C.

Audio playback starts after user interaction. Timing and microphone capture stop when switching tools or leaving the browser tab. Google Fonts is optional; system sans-serif fonts are used if unavailable.

## Validation

Music logic is covered by Node tests. The server and asset routes have been checked over HTTP. Automated tests also cover plucked-string synthesis, strum direction and scheduling, and microphone startup with simulated permission acceptance, denial, cancellation, and insecure contexts. Headless Chromium checks verify a generated real Web Audio stream through the tuner, desktop and mobile navigation, chart previews, actual PNG download dimensions, stale-preview invalidation, and a simulated OCR-to-image pipeline. Physical microphones, real-photo OCR accuracy, Safari, and physical mobile devices remain unverified.

## Tuner troubleshooting

Run `npm start` and open `http://localhost:3000` on your computer, or use an HTTPS deployment. Do not double-click `index.html`. Allow microphone access in the browser prompt or address-bar permissions menu. If you use Windows, check Settings → Privacy & security → Microphone and enable microphone access for desktop apps. An embedded preview can block microphone access; open the website directly in your browser. The tuner shows its permission state immediately, and pending requests can be canceled.

## Adaptive guitar tuner

The tuner uses YIN with cumulative normalized differences, sub-sample interpolation, and checks for dominant second harmonics. Its chromatic analysis range is 50–1000 Hz, covering E2–E4, drop D, down-tunings, and higher fretted notes; A4 is 440 Hz. An 8192-sample capture window is downsampled for bounded mobile processing cost. Analysis runs about every 70 ms.

Quiet inputs receive bounded analysis normalization (up to 64×). This never boosts microphone playback: input is connected to a silent output. An adaptive noise floor is learned only from unpitched frames, with an absolute minimum signal gate and periodicity-confidence checks. Random sound cannot pass merely by being made louder. Three consistent frames are required to acquire a note; median and cents-domain exponential smoothing stabilize the display. Outliers are withheld, genuine string changes reacquire, and silence clears old readings. A live meter measures the original signal in dBFS, independent of normalization. Weak, unsettled, and noisy inputs show distinct feedback.

Speech processing is requested off using optional/ideal echo cancellation, noise suppression, and automatic gain constraints, subject to browser/device support. AudioContext and the Safari webkitAudioContext fallback are supported; audio is resumed in the user gesture before permission is awaited. Browser microphone permission and HTTPS/localhost remain necessary. The site cannot override hardware limits or OS-level microphone denial, and a periodic background tone or voice can resemble a musical note.

`npm test` includes deterministic synthetic quiet, decaying, harmonic-rich, noisy, alternate-tuning and 44.1/48/96 kHz inputs; broadband and low-pass noise; silence/transients; DC offsets; octave outliers, reacquisition and smoothing; microphone permission/cancellation; and input meter updates. These tests do not substitute for listening and physical microphone checks on Chrome/Safari and desktop/mobile devices.

## Reading the tuner

The tuner uses a segmented semicircular gauge with a large note display and three labeled states: **Tighten**, **In tune**, and **Loosen**. Select a standard string (6 is the thickest, 1 is the thinnest) to keep its target fixed, or use Auto for chromatic tuning and alternate tunings. Small pitch fluctuations near the in-tune boundary no longer flip the instruction back and forth. A missed frame can show a dimmed, explicitly labeled last-note hold for up to 300 ms; it is never displayed as a live in-tune result. Short dropouts preserve the tracking history so one missed frame does not require a full restart. The microphone meter still shows actual input level. Automated coverage includes fixed targets, direction guidance, boundary stability, brief dropout recovery, and stale-reading expiry. Physical microphone performance still depends on the device and room.

## Lyric-and-chord images

Open **Song chord maker** from the sidebar or the mobile **Tools** menu. Type a song title, artist, or both into the search bar. After two characters, suggestions update as you type (with a 350 ms debounce). Choose a result using the mouse, touch, or arrow keys and Enter. Its title and artist are filled in automatically. Use the expandable custom-song section for original work. Then paste a chart. To anchor a chord above a specific word, put it in brackets: `[G]Hello [C]there`. Existing charts with a chord line directly above a lyric line are also accepted, preserving their spaces. Section headings such as `[Verse]` are kept. Use **Create chord sheet image** to preview and download each page as PNG or SVG. An original example is provided. Editing the source clears old previews so downloads cannot silently use stale content.

For a photo, open **Sheet music reader**, upload a JPG/PNG/WebP (up to 15 MB), and choose **Read lyrics & chords**. Recognized text generates an image when it contains both lyrics and chord symbols. Review and fix the text or use bracketed chords to correct placement, then regenerate. This is text OCR, not staff-note recognition or harmonic analysis. Search results provide metadata only. The Spotify button opens a Spotify search; it is not a verified Spotify track match and does not import lyrics or chords.

The brand is **FretMate.app**. No domain has been registered, purchased, or deployed by this change; domain availability is unverified.

## Browser checks

With Node.js 22+ and Chromium installed, start a server on port 3001 (`PORT=3001 npm start` on Unix, or set `$env:PORT=3001` in PowerShell), then run `npm run test:browser` in another terminal. Set `SITE_URL` for a different server and `CHROMIUM_BIN` for your Chromium/Chrome executable. The default executable is `/usr/bin/chromium`. Screenshots and downloads go to a unique directory under `/tmp` by default; set `BROWSER_TEST_OUTPUT` to a fresh writable directory on other operating systems. The browser test stubs photo OCR to verify the application's upload-to-export flow; it does not download or validate the external OCR model.

## Live song search

`GET /api/songs?q=…` searches the public Apple Music/iTunes catalog at `https://itunes.apple.com/search`. No API key or Spotify login is needed. This is a public music-catalog search, not the authenticated Spotify catalog: availability can vary by region and some Spotify tracks may be absent. The title and artist are filled automatically after a result is chosen. Lyrics and chords are not retrieved.

The endpoint bounds queries to 120 characters and results to eight suggestions, ranks combined title/artist tokens, deduplicates releases, caches results for five minutes, coalesces concurrent identical searches, and times out upstream requests after seven seconds. The UI cancels outdated requests and ignores late responses; it supports empty results, provider/network errors, Escape dismissal, keyboard selection, and touch. Node versions supporting `http.setGlobalProxyFromEnv` use the environment's configured proxy.

Network access to **itunes.apple.com** is required on the server. In this managed cloud environment, the initial live lookup was blocked by the outbound policy. The domain addition was saved in the environment configuration draft, but requires review/save and publication before cloud access can be claimed. Browser autocomplete tests use a catalog fixture; search-service tests exercise ranking, response validation, caching, request coalescing and provider failures. A successful real catalog query remains unverified in this cloud instance.

## Search → select → Go

The main song screen no longer asks for lyrics or chords. Select a catalog suggestion and press **Go**. A progress ring waits for a full chart, validates that it matches the selected title/artist and contains lyrics plus positioned chords, creates paginated SVG images, waits for those images to decode, and offers PNG/SVG downloads. While waiting on the chart source, the spinner is indeterminate because no real completion percentage is known. Percentages 35/60/85/100 represent completed processing stages, not an invented time estimate. Failed or missing charts never reach 100% or create an image. Editing or changing a selection cancels the previous generation and clears stale output.

The optional manual editor remains collapsed under **Optional: create an image from a chart you already have**. The photo reader remains available.

**Current blocker:** the GuitarParty provider adapter is implemented, but no GuitarParty API key is configured and live provider access has not been verified. Song catalog metadata alone cannot produce a complete, accurate lyric-and-chord image. Go reports this missing connection clearly; it no longer sends users to external chart searches. Automatic output has been exercised with test fixtures only, not a real commercial-song catalog.

### Connecting an authorized chart source

The server adapter accepts `SONG_CHART_ENDPOINT`, an HTTPS endpoint backed by an authorized collection of lyric-and-chord charts. `SONG_CHART_TOKEN` is an optional bearer credential if that source needs it. No endpoint or credential is bundled, invented, or currently configured. A provider-specific adapter may be needed to meet this contract; these variable names do not imply an existing third-party API. Configure secrets securely on your server, never in browser code. Allow the chosen destination through the environment network policy before using it.

The endpoint receives GET query parameters `title`, `artist`, and `id` (catalog track ID). It must return JSON like:

```json
{
  "title": "Test Song",
  "artist": "Test Artist",
  "chart": "[G]Original test words with a [C]chord change"
}
```

`chart` can use inline ChordPro notation or chord lines directly above lyric lines. The adapter checks title/artist identity, response bounds, and the presence of both lyrics and chords. Wrong-song, absent, unreadable, unconfigured, and unreachable sources return clear errors. It does not scrape sites, infer harmonies, or invent words. Browser tests mock the source to check progress through image creation, missing-source errors, and removal of stale results. Connecting a real chart collection and validating its accuracy remain outstanding.

## GuitarParty provider

A provider-specific adapter now searches GuitarParty by title, fetches candidate chart details, checks the artist, and returns a supported plain-text chord-and-lyric body to the image renderer. The search path (`/v2/songs/?query=…`), detail path (`/v2/songs/{id}/`), and `Guitarparty-Api-Key` authentication header were checked against the checksum-verified published `guitarparty-client` package (version 1.0.2). That client is historical evidence, not verification of the current service. The adapter requires HTTPS and does not downgrade to the HTTP URL in that historical client. Response-format handling is fixture-tested and may need adjustment after the first authorized live response.

1. Obtain your own GuitarParty API key through [GuitarParty developers](https://www.guitarparty.com/developers/api-key/). Current signup availability, access terms, HTTPS support, and coverage of particular songs remain unverified here because the network policy blocks official API/documentation requests.
2. In managed environment settings, enter the key securely for the saved **GUITARPARTY_API_KEY** secret requirement. Do not paste it into chat or commit it to GitHub. Review/save the added network access for `api.guitarparty.com` and `www.guitarparty.com`, preserving `itunes.apple.com`, and publish the environment. Restart the server after credentials are available.
3. For a local Node.js server, set the `GUITARPARTY_API_KEY` environment variable before starting. This is server-only configuration, never a browser field.
4. Leave `SONG_CHART_ENDPOINT` unset to use GuitarParty; an explicit custom endpoint takes priority.

A live lookup of **Dracula — Tame Impala** has not succeeded or been validated. Tests use constructed responses to cover routing, credential headers, matching, unsupported formats, missing songs, and provider errors. Even with a valid key, the source may not have a particular song; the app reports a missing chart rather than substituting one by a different artist. The adapter requires `objects` search results, artist metadata, and a plain-text `body` with positioned chords; HTML-only or lyrics-only results are rejected. No third-party client package is installed or executed.
