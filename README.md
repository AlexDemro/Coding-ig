# FretMate.app

A responsive guitar practice studio, built with browser JavaScript and a dependency-free Node server.

## Run

Requires Node.js 18 or newer. No package installation is required.

```sh
npm start
```

The server listens on port 3000; set `PORT` to override it. Run `npm test` for the 30 music, tuner, and chart-layout tests.

## Tools

- Microphone tuner for standard guitar tuning. Requires microphone permission and HTTPS or localhost. Uses A4 = 440 Hz.
- Library of 16 common chord shapes, searchable by name and family.
- Capo converter, frets 0–12, with conversion in either direction and slash-chord support.
- Song chord maker: turn pasted lyrics with inline chords or chord-above-lyric text into paginated PNG or SVG images. Spotify track links can be attached as references; there is no automatic Spotify lyric/chord retrieval or transcription.
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

Open **Song chord maker** from the sidebar or the mobile **Tools** menu. Enter a title and optional artist or capo instructions, then paste a chart. To anchor a chord above a specific word, put it in brackets: `[G]Hello [C]there`. Existing charts with a chord line directly above a lyric line are also accepted, preserving their spaces. Section headings such as `[Verse]` are kept. Use **Create chord sheet image** to preview and download each page as PNG or SVG. An original example is provided. Editing the source clears old previews so downloads cannot silently use stale content.

For a photo, open **Sheet music reader**, upload a JPG/PNG/WebP (up to 15 MB), and choose **Read lyrics & chords**. Recognized text generates an image when it contains both lyrics and chord symbols. Review and fix the text or use bracketed chords to correct placement, then regenerate. This is text OCR, not staff-note recognition or harmonic analysis. Spotify links are validated track references only; they do not import song data.

The brand is **FretMate.app**. No domain has been registered, purchased, or deployed by this change; domain availability is unverified.

## Browser checks

With Node.js 22+ and Chromium installed, start a server on port 3001 (`PORT=3001 npm start` on Unix, or set `$env:PORT=3001` in PowerShell), then run `npm run test:browser` in another terminal. Set `SITE_URL` for a different server and `CHROMIUM_BIN` for your Chromium/Chrome executable. The default executable is `/usr/bin/chromium`. Screenshots and downloads go to a unique directory under `/tmp` by default; set `BROWSER_TEST_OUTPUT` to a fresh writable directory on other operating systems. The browser test stubs photo OCR to verify the application's upload-to-export flow; it does not download or validate the external OCR model.
