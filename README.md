# FretMate

A responsive guitar practice studio with a dependency-free Node server. The chosen website domain is **fretmate.online**. Repository changes do not configure Hostinger or deploy the domain.

## Run

Requires Node.js 18 or newer. No dependency installation is needed.

```sh
npm start
```

The server listens on port 3000; set `PORT` to override it. Open `http://localhost:3000` locally. Use HTTPS for a hosted site, particularly for microphone access.

## Tools

- **Guitar tuner:** segmented semicircle, large note display, explicit tuning instructions, standard-string selection, and chromatic Auto mode. YIN detects 50–1000 Hz with bounded sensitivity, noise gating, confidence checks, median filtering, and smoothing. Microphone speech processing is requested off where supported. A live meter shows input level. Requires browser microphone permission and HTTPS or localhost.
- **Chord library:** 16 common guitar shapes with search and chord-family filters.
- **Capo converter:** fret 0–12 conversion in either direction, including slash chords.
- **Sheet music reader:** photograph or paste a printed lyric-and-chord chart, correct the recognized text, and export paginated PNG/SVG images with chords above lyrics. OCR uses Tesseract.js 5, loaded online; images are processed locally in the browser. It cannot interpret staff notes, infer harmonies, or invent missing lyrics. Check OCR against your original.
- **Metronome:** tempo, beats per bar, accented downbeat, and tap tempo.
- **Strumming patterns:** four patterns with directional synthesized guitar strums, adjustable tempo, and G/D/Em/C practice chords.

The Song chord maker feature, song search, Spotify integration, automatic chart APIs, and GuitarParty adapter have been removed. No song-provider API keys or catalog services are required.

## Sheet image export

Open **Sheet music reader** from the sidebar or the mobile **Tools** menu. Upload a JPG, PNG, or WebP up to 15 MB and choose **Read lyrics & chords**, or paste the chart directly. A line of chord symbols must be directly above the corresponding lyric line. Inline notation such as `[G]Hello [C]there` also places changes precisely. Section headings such as `[Verse]` are kept. Edit the title, subtitle, text, and chord placement, then choose **Create chord sheet image**. Download each page as PNG or SVG. Editing clears old previews to avoid stale exports.

## Tuner notes

A4 is 440 Hz. Three consistent frames acquire a note. Median and cents-domain smoothing stabilize pitch; short dropouts briefly retain a clearly labeled last note. In-tune hysteresis reduces flicker, and selecting a string keeps the target fixed. Voice and periodic room tones can resemble musical notes; the tuner cannot identify the instrument perfectly or override microphone hardware/OS access restrictions.

If the tuner cannot start, open the site directly over HTTPS or localhost and allow microphone access in the browser's address-bar permissions menu. Audio resumes within the initial user gesture, with a Safari AudioContext fallback. Audio and recording stop when changing tools or hiding the browser tab.

## Validation

Run `npm test` for 29 tests covering chord conversion, quiet and harmonic guitar notes, alternate tunings at multiple sample rates, noise rejection, stable guidance, strum synthesis, and sheet-image layout/escaping/pagination. These synthetic and simulated capture checks do not replace physical microphone and device testing.

For browser checks, start the site in one terminal and run `npm run test:browser` in another, with Node.js 22+ and Chromium installed. The default test URL is `http://127.0.0.1:3001/`; set `SITE_URL=http://127.0.0.1:3000` to test the default server. Set `CHROMIUM_BIN` for a different Chromium/Chrome executable. Screenshots and downloads use a unique `/tmp` directory by default; set `BROWSER_TEST_OUTPUT` to a fresh writable directory elsewhere if needed.

Browser checks exercise generated Web Audio input through the tuner, navigation at desktop/mobile sizes, removal of the song-maker UI, sheet previews, actual PNG download dimensions, edit invalidation, and a simulated photo-to-image pipeline. Physical microphones, actual-photo recognition quality, Safari, and physical mobile devices remain unverified. The OCR model is mocked in browser tests; loading the real OCR library and model requires an internet connection. Google Fonts is optional and has system-font fallbacks.
