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
- **Sheet music reader:** upload a photo of a printed lyric-and-chord chart and automatically receive downloadable PNG images with chords above the lyrics. There is no text editor or code output. OCR uses Tesseract.js 5, loaded online; images are processed locally in the browser. It cannot interpret staff notes, infer harmonies, or invent missing lyrics. Check OCR against your original.
- **Metronome:** tempo, beats per bar, accented downbeat, and tap tempo.
- **Strumming patterns:** four patterns with directional synthesized guitar strums, adjustable tempo, and G/D/Em/C practice chords.

The Song chord maker feature, song search, Spotify integration, automatic chart APIs, and GuitarParty adapter have been removed. No song-provider API keys or catalog services are required.

## Photo-to-image reader

Open **Sheet music reader**, upload a clear JPG, PNG, or WebP up to 15 MB, and processing starts automatically. The result is an actual PNG image preview and **Download image** link for each page. There are no lyric/chord entry fields, code examples, raw OCR output, or SVG export controls. Uploading another photo clears the previous output, cancels obsolete processing, and prevents late results from replacing the newer image. Unreadable photos show a brief explanation and a retry button.

The photo must already contain printed lyrics and chord names. This is text recognition, not optical staff-note recognition or a harmonic-arrangement engine. Staff-only scores, lyrics without chords, and chord-only photos are rejected rather than used to fabricate an arrangement. OCR can still make mistakes; compare the image against your original before playing.

Tesseract.js 5 runs locally in the browser, including automatic orientation detection. Its English model loads from the official `@tesseract.js-data/eng` package on jsDelivr. No uploaded image is sent to an external image-processing API. Word bounding boxes, where available, align recognized chords to the nearest lyric word; text-based layout is a fallback. Low-confidence chord guesses and unrelated distant text are rejected. The internet is required for the first library/model download.

## Browser-tab icon

The website includes the same green natural-sign (♮) logo used beside the FretMate name as SVG, multi-size ICO, PNG, and an Apple touch icon. The server supplies the correct image MIME types. The header and tab share the same SVG asset, with versioned links to refresh the old F icon. Browsers can cache old favicons; a hard refresh, new tab, or clearing site data may be needed after updating the deployed files. The Hostinger domain is **fretmate.online**; GitHub updates do not deploy it.

## Windows: port already in use

`EADDRINUSE` means another process already uses the requested port. Usually an older FretMate server is still running. Stop that copy with Ctrl+C in its Command Prompt window, or run the following in the new window:

```cmd
set PORT=3001
npm start
```

Then open `http://localhost:3001`. Leave the terminal open. If 3001 is also busy, choose another unused port. The server now reports this situation with a readable message instead of an unhandled stack trace.

## Tuner notes

A4 is 440 Hz. Three consistent frames acquire a note. Median and cents-domain smoothing stabilize pitch; short dropouts briefly retain a clearly labeled last note. In-tune hysteresis reduces flicker, and selecting a string keeps the target fixed. Voice and periodic room tones can resemble musical notes; the tuner cannot identify the instrument perfectly or override microphone hardware/OS access restrictions.

If the tuner cannot start, open the site directly over HTTPS or localhost and allow microphone access in the browser's address-bar permissions menu. Audio resumes within the initial user gesture, with a Safari AudioContext fallback. Audio and recording stop when changing tools or hiding the browser tab.

## Validation

Run `npm test` for 33 tests covering chord conversion, quiet and harmonic guitar notes, alternate tunings at multiple sample rates, noise rejection, stable guidance, strum synthesis, and sheet-image layout/escaping/pagination. These synthetic and simulated capture checks do not replace physical microphone and device testing.

For browser checks, start the site in one terminal and run `npm run test:browser` in another, with Node.js 22+ and Chromium installed. The default test URL is `http://127.0.0.1:3001/`; set `SITE_URL=http://127.0.0.1:3000` to test the default server. Set `CHROMIUM_BIN` for a different Chromium/Chrome executable. Screenshots and downloads use a unique `/tmp` directory by default; set `BROWSER_TEST_OUTPUT` to a fresh writable directory elsewhere if needed.

Browser checks exercise generated Web Audio input through the tuner, navigation at desktop/mobile sizes, removal of the song-maker UI, upload-only photo processing, actual PNG previews and downloads, replacement/error handling, favicon links, and a simulated photo-to-image pipeline. Physical microphones, actual-photo recognition quality, Safari, and physical mobile devices remain unverified. The OCR model is mocked in browser UI tests. Separately, real Tesseract 5.1.1 recognition was exercised on a generated photo fixture containing original lyrics with G/C/Am/D chord labels, and the expected chord-to-word positions were recovered. That controlled fixture is not a claim about arbitrary real-world photo quality. Loading the real OCR library and model requires an internet connection. Google Fonts is optional and has system-font fallbacks.
