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
- Four animated strumming patterns with adjustable playback speed; audio uses synthesized plucked guitar strings with directional strums and a choice of G, D, Em, or C.

Audio playback starts after user interaction. Timing and microphone capture stop when switching tools or leaving the browser tab. Google Fonts is optional; system sans-serif fonts are used if unavailable.

## Validation

Music logic is covered by Node tests. The server and asset routes have been checked over HTTP. Automated tests also cover plucked-string synthesis, strum direction and scheduling, and microphone startup with simulated permission acceptance, denial, cancellation, and insecure contexts. Real microphone, browser audio, responsive layout, and remote OCR integration still require browser/device validation.

## Tuner troubleshooting

Run `npm start` and open `http://localhost:3000` on your computer, or use an HTTPS deployment. Do not double-click `index.html`. Allow microphone access in the browser prompt or address-bar permissions menu. If you use Windows, check Settings → Privacy & security → Microphone and enable microphone access for desktop apps. An embedded preview can block microphone access; open the website directly in your browser. The tuner shows its permission state immediately, and pending requests can be canceled.
