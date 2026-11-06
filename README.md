# Fret & Flow

A responsive guitar practice studio, built with browser JavaScript and a dependency-free Node server.

## Run

Requires Node.js 18 or newer. No package installation is required.

```sh
npm start
```

The server listens on port 3000; set `PORT` to override it. Run `npm test` for chord conversion, extraction, and synthetic pitch-detection tests.

## Tools

- Microphone tuner for standard guitar tuning. Requires microphone permission and HTTPS or localhost. Uses A4 = 440 Hz.
- Library of 16 common chord shapes, searchable by name and family.
- Capo converter, frets 0–12, with conversion in either direction and slash-chord support.
- Photo reader for printed chord symbols using Tesseract.js 5, loaded from jsDelivr. Image recognition runs in the browser; the OCR script, worker, and English language model require network access. This is not optical music recognition: staff notes are not converted into chords. OCR may make mistakes. Pasting chord text works offline.
- Metronome with adjustable tempo, time signature, downbeat accent, and tap tempo.
- Four animated strumming patterns with adjustable playback speed; audio indicates stroke timing rather than sampled guitar sound.

Audio playback starts after user interaction. Timing and microphone capture stop when switching tools or leaving the browser tab. Google Fonts is optional; system sans-serif fonts are used if unavailable.

## Validation

Music logic is covered by Node tests. The server and asset routes have been checked over HTTP. Real microphone, browser audio, responsive layout, and remote OCR integration still require browser/device validation.
