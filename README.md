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

## Adaptive guitar tuner

The tuner uses YIN with cumulative normalized differences, sub-sample interpolation, and checks for dominant second harmonics. Its chromatic analysis range is 50–1000 Hz, covering E2–E4, drop D, down-tunings, and higher fretted notes; A4 is 440 Hz. An 8192-sample capture window is downsampled for bounded mobile processing cost. Analysis runs about every 70 ms.

Quiet inputs receive bounded analysis normalization (up to 64×). This never boosts microphone playback: input is connected to a silent output. An adaptive noise floor is learned only from unpitched frames, with an absolute minimum signal gate and periodicity-confidence checks. Random sound cannot pass merely by being made louder. Three consistent frames are required to acquire a note; median and cents-domain exponential smoothing stabilize the display. Outliers are withheld, genuine string changes reacquire, and silence clears old readings. A live meter measures the original signal in dBFS, independent of normalization. Weak, unsettled, and noisy inputs show distinct feedback.

Speech processing is requested off using optional/ideal echo cancellation, noise suppression, and automatic gain constraints, subject to browser/device support. AudioContext and the Safari webkitAudioContext fallback are supported; audio is resumed in the user gesture before permission is awaited. Browser microphone permission and HTTPS/localhost remain necessary. The site cannot override hardware limits or OS-level microphone denial, and a periodic background tone or voice can resemble a musical note.

`npm test` includes deterministic synthetic quiet, decaying, harmonic-rich, noisy, alternate-tuning and 44.1/48/96 kHz inputs; broadband and low-pass noise; silence/transients; DC offsets; octave outliers, reacquisition and smoothing; microphone permission/cancellation; and input meter updates. These tests do not substitute for listening and physical microphone checks on Chrome/Safari and desktop/mobile devices.

## Reading the tuner

The tuner uses a stationary note circle and three labeled states: **Tighten**, **In tune**, and **Loosen**. Select a standard string (6 is the thickest, 1 is the thinnest) to keep its target fixed, or use Auto for chromatic tuning and alternate tunings. Small pitch fluctuations near the in-tune boundary no longer flip the instruction back and forth. A missed frame can show a dashed, explicitly labeled last-note hold for up to 300 ms; it is never displayed as a live in-tune result. Short dropouts preserve the tracking history so one missed frame does not require a full restart. The microphone meter still shows actual input level. Automated coverage includes fixed targets, direction guidance, boundary stability, brief dropout recovery, and stale-reading expiry. Physical microphone performance still depends on the device and room.
