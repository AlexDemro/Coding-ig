# FretMate

Guitar practice tools for **fretmate.online**: tuner, chord library, capo converter, photo reader, metronome, and strumming patterns. The Song chord maker/search feature remains removed.

## Run locally

Use Node.js 22 or newer:

```cmd
npm install
npm start
```

Open `http://localhost:3000`. To replace an older running copy, stop it with Ctrl+C, then start from the newly extracted folder. If the port is occupied, `set PORT=3001` in Windows Command Prompt selects another port. Leave the terminal open.

When updating an existing Windows installation, you can copy the new project files into the existing project folder (including `fonts/` and `sounds/`), keep your installed `node_modules` and sibling `.fretmate-tools` folder, restart `npm start`, and hard-refresh the browser with Ctrl+F5. These interface/audio updates do not require reinstalling Audiveris. Regenerate a sheet image to see its new font.

If a newly downloaded local copy says the staff reader is unavailable, stop its server with Ctrl+C and run `npm install`, `npm run setup:omr`, then `npm start` **in that new folder, beside its `package.json`**. Audiveris itself does not need reinstalling if already installed. Check `http://localhost:3000/api/score-capabilities` for `"available":true`, then refresh the website with Ctrl+F5. Package installation is specific to the project folder; downloading another ZIP does not bring its `node_modules` along. Always copy the complete project, including new server modules.

The connection message now distinguishes missing Node packages/project files (`OMR_APP_SETUP`), an engine the server cannot find (`OMR_ENGINE_MISSING`), a static server without the API, unexpected HTML responses, and connection/timeouts. It does not equate every failed request to a missing engine. Checks bypass stale response caches and use an AbortController timeout that also works without the newer `AbortSignal.timeout` method. Local setup instructions appear only on localhost/file URLs; remote visitors see a service-status message.

## Two photo-reading paths

Upload a clear JPG, PNG, or WebP under 15 MB. There is no text editor and the output is a downloadable PNG image.

- **Printed lyric/chord charts:** browser-based Tesseract OCR preserves the existing chord names and words. This path also works without a notation backend. Initial OCR/library/model downloads need internet access.
- **Staff notation:** an installed Audiveris engine reads notes, rests, voices, key/time signatures, and lyric syllables into MusicXML. FretMate checks the native recognition output before building an image. Printed harmony symbols in the export are preserved; when those are absent, chords are a **suggested** guitar accompaniment. Recognized lyric syllables receive chords above the words; instrumental scores receive a measure-and-beat guide without invented lyrics.

The full-score path rejects substantial abnormal/mismatched measure timing, many weak note/lyric grades, missing lyric-to-note mappings, and broken syllable sequences. When that path is unreliable, a separate, conservative recovery path can make a simplified lyric-and-chord arrangement from alternating treble/bass staves with a consistent melody key. If recovery cannot establish sufficient note and lyric evidence, `UNRELIABLE_SCORE` still clears the old image. Multiple exported movements are checked together instead of silently choosing the first partial export. These are conservative heuristics, not proof that an accepted transcription is accurate. They do not repair a badly recognized score, spell-check a song, or recover the original harmony from a melody. Clear close-ups of complete systems, including clefs and key signatures, work better than tiny previews or aged, grainy full-page photos.

Generated PNGs use a bundled **Inter** font, with measured proportional-text placement to keep chords above their syllables. Its SIL Open Font License and attribution are in `fonts/Inter-LICENSE.txt`. Font loading falls back to a modern system sans-serif if unavailable. The circular progress indicator shows the engine/OCR's reported recognition stage, and spins during stages without a numerical progress value. Percentages are stage progress, not an estimate of remaining seconds.

The staff path uses real server-side note recognition. It does not identify a song and substitute catalog lyrics or chords. The recovery path additionally reads the actual printed lyrics with local LSTM OCR. It needs installation on the computer/server running Node. A scale or melody does not uniquely determine the original chords: the output is an arrangement, not a guaranteed transcription of the composer's harmony. Recognition can misread notes, rhythms, lyrics, and verses. Use high-resolution original scans and check the image against the score. Repeats are presented in printed order, not expanded into performance order.

The provided small Minuet preview may not retain enough detail for accurate recognition even after enlargement; that preview has not been tested as an original file. The actual Blessed Assurance JPG was subsequently supplied in a ZIP and has now been exercised through both the native engine and the complete HTTP upload pipeline.

## Historical hymn recovery

Yellowed/color-cast paper is flattened before enlargement, and the native notehead matcher is made stricter for those pages. This removes background texture while preserving notation; it cannot recover detail that is missing from a tiny image. Normal neutral scans retain their existing preprocessing.

If a full transcription fails its checks, recovery is restricted to ordinary paired treble/bass systems with repeated, consistent melody key signatures and enough strong noteheads. It excludes weak, flag-shaped detections, preserves explicit accidentals, and matches supported major/minor/seventh chords to horizontal note positions. Earlier incomplete root/fifth voicings may be identified from later complete harmony in the same measure. This is a **simplified accompaniment**, not a transcription of the old engraving’s rhythms, voices, or exact harmony. Recovery assumes the paired keyboard/choir staves use the primary melody key; scores with ambiguous or changing melody keys are rejected.

A pinned `tesseract.js` worker rereads the printed English lyric bands and then each line. The same full English model installed by `setup:omr` supplies its LSTM data locally. Hyphenated syllables and physical character gaps determine word joins, verse continuations, and shared chorus sections. Two passes can strengthen confidence only when the same letters agree at the same printed position. There is no lyrics catalog, language-model completion, or title-specific correction. The recovery worker has a 45-second limit and is terminated after the job.

Missing note evidence becomes an amber **?**, rather than an invented chord; too many uncertain sections or missing lyric lines still block export. The image and UI explicitly label recovery as simplified accompaniment that needs review. Instrumental scores keep their existing full-transcription path.

For updates, copy **all** new project files into your existing project folder, run `npm install` for the added portable OCR dependency, restart `npm start`, and regenerate the image. The existing Audiveris installation and managed English model can be reused.

## One-time staff-reader setup on Windows

1. Install **Audiveris 5.11.0**, using its official [Windows console installer](https://github.com/Audiveris/audiveris/releases/download/5.11.0/Audiveris-5.11.0-windowsConsole-x86_64.msi). The [official release page](https://github.com/Audiveris/audiveris/releases/tag/5.11.0) lists other platforms. The runtime is included. Never substitute unrelated Audiveris-branded sites.
2. In the FretMate project folder, run:

   ```cmd
   npm install
   npm run setup:omr
   npm start
   ```

3. Setup looks for the installed executable and downloads/checksums the full English lyric model (including the legacy recognition data required by Audiveris). If the executable is installed elsewhere, set `AUDIVERIS_COMMAND` to its full path and rerun setup. For example, if that is your actual installation path:

   ```cmd
   set "AUDIVERIS_COMMAND=C:\Program Files\Audiveris\Audiveris.exe"
   npm run setup:omr
   npm start
   ```

The Windows installer and Node integration have not been tested on Windows here. The executable lookup supports common installer locations and an explicit path override. No API key is required. Visitors do not need Audiveris installed when the website has a working recognition backend; the server owner installs it once.

On Debian/Ubuntu-compatible Linux x64, `npm run setup:omr` can download and extract the pinned official .deb without root, verify its SHA-256, configure a 2 GB maximum heap, and install the checksummed English model. Files go in `../.fretmate-tools`, outside the checkout. Set `FRETMATE_TOOLS_DIR` to override that managed location. LSTM-only browser OCR models cannot replace this native lyric model. The Linux route has been exercised in this environment. Other platforms need their official Audiveris installation and an executable path if automatic detection fails. Audiveris is a separate program with its own license; its source is at [Audiveris/audiveris](https://github.com/Audiveris/audiveris).

## Hostinger shared hosting

**Uploading static files to Hostinger shared hosting/Website Builder does not enable staff recognition.** That deployment needs a separately hosted, persistent Node service that can execute the installed notation engine. This repository does not provision, purchase, or deploy such a server, change DNS, or change a Hostinger plan.

The static website can call a separate backend after one is deployed:

1. Set the public `scoreApiBase` value in `score-config.js` to that backend's HTTPS origin. It is empty for local/same-origin Node use. Never put secrets in this file.
2. Configure the backend environment variable `FRETMATE_ALLOWED_ORIGINS` with the exact permitted site origins, for example `https://fretmate.online,https://www.fretmate.online`. CORS does not allow arbitrary origins or credentialed cookies.
3. Install dependencies and the notation engine on that backend, run the Node server behind HTTPS, and validate an actual score upload before announcing the feature as live.

When no backend is available, the page clearly identifies the missing capability while retaining browser OCR for charts that already have printed chords. The icon and other practice tools are static assets and do not require the notation service.

## Recognition API

- `GET /api/score-capabilities`: whether the engine executable is available. This is a setup check, not a guarantee that a particular photo will be recognized.
- `POST /api/score`: raw JPEG/PNG/WebP bytes with the matching Content-Type; returns a job ID.
- `GET /api/score/:id`: real recognition-stage progress and final arrangement rows or an explicit error.

The server checks file types/signatures and size, preprocesses orientation/contrast, limits image dimensions, runs one engine job at a time, enforces a three-minute process timeout, and deletes temporary uploaded images and native output after processing. Results live only in memory, expire after 15 minutes, and are bounded to 20 jobs. New uploads may receive a busy response while an older job finishes. The application does not send score images to a third-party music-recognition API. Staff processing uploads the photo to the FretMate backend itself; users should understand which backend the configured site uses.

## Other tools

- **Tuner:** adaptive YIN, 50–1000 Hz, standard-string selection or chromatic Auto, smoothing and in-tune hysteresis, actual input level, short labeled last-note holds, and explicit tune-up/down guidance. Requires microphone permission and HTTPS/localhost. A4 is 440 Hz.
- **Chord library:** 16 common shapes with search and family filters.
- **Capo converter:** frets 0–12, both conversion directions and slash chords.
- **Metronome:** tempo, beats/bar, accented downbeats and tap tempo.
- **Strumming:** four starting patterns, an editable 8/16-step grid, down/up/rest cycling, separate accents, 12 practice chords, tempo, swing, natural-feel and volume controls. Edits save automatically in the current browser's local storage. Clear strokes starts a blank pattern; Reset returns to the campfire preset and defaults. Grid/preset edits stop playback; tempo/feel/chord changes apply as playback continues.

Strumming normally uses six bundled FluidR3 acoustic steel-guitar samples, decoded locally with Web Audio and transposed to fretted pitches. Silence trimming, sample-pitch calibration, softer upstrokes, string-by-string pick timing, subtle stereo positioning, damped retriggers, body filtering, and output compression make the result less mechanical. Natural feel adds small timing/strength variations; Swing changes the long–short spacing while preserving the bar duration. If sample decoding/loading fails, a fractional-delay plucked-string model supplies a fallback. Samples, source links, stated CC BY 3.0 US license, and changes are credited in `sounds/guitar/CREDITS.txt`, linked on the page. No paid audio API is used.

Audio stops on navigation or hiding the page. The header and browser tab share the same green natural-sign (♮) SVG, with PNG, ICO and Apple-touch alternatives. Versioned icon URLs help invalidate the old F icon. Browser caches may still need a hard refresh.

## Validation

`npm test` runs 73 tests covering existing music tools plus pattern persistence/normalization, subdivision conversion, swing timing, string pitch accuracy, proportional chart placement, MusicXML pitch/rhythm/voice parsing, printed harmony preservation, lyric syllables, recognition rejection criteria, instrumental output, MXL ZIP parsing, invalid XML, image signatures, and missing-engine behavior.

`npm run test:browser` requires Chromium and Node.js 22+. Start the server on port 3001 or set `SITE_URL` to its address; `CHROMIUM_BIN` chooses another executable. Tests cover generated Web Audio input, navigation, branding, actual Inter-font PNG exports, circular progress, failure/replacement handling, and fixture notation-result/rejection responses. They also exercise editable strokes/accents, subdivision and swing changes, saved settings after reload, sampled-audio decoding, real offline audio rendering/headroom, playback cancellation, and desktop/mobile layouts. OCR/native API responses are mocked in UI tests.

Separately, real Audiveris CLI and real HTTP image-upload recognition have run on official Allegretto, Hove and Ave Maria examples. The vocal example produced recognized lyric syllables and suggested chords; instrumental examples produced measure-based guides. Tests caught and fixed a legacy-language-model incompatibility and missing exported part timing metadata. Real recognition still produced some misspellings and uncertain note timing, so these results are not proof of transcription accuracy. The model incompatibility is now treated as a setup error rather than silently labeling a vocal score instrumental. These checks validate the installed Linux pipeline; Windows/Hostinger deployment remains unverified here. Physical microphones, actual iPhones, and broad photo-recognition accuracy remain unverified.

The new quality checks accept the clean Allegretto recognition through a real HTTP upload (145 notes, 17 measures, no abnormal measures) and reject the flawed Ave Maria recognition through a real HTTP upload (9 of 14 native part-measures flagged abnormal), which formerly produced a garbled lyric sheet. This is a regression check on known outputs, not a general accuracy benchmark.

To reproduce a real native-engine check against your own image, keep the server running and use `npm run test:omr -- path/to/score.png`. Add `--lyrics` for a vocal score to require recognized lyric syllables. Unlike the UI fixture tests, this uploads a real image and runs the installed Audiveris engine. It verifies usable data, not the correctness of every recognized note or inferred chord.

The exact uploaded Blessed Assurance JPG (1200 × 1800; SHA-256 `853fe96478a48f1803d983ebbaf00786de873bbbfa45cc109221219fa7484d2f`) initially split into separate movements and produced garbled lyrics. The revised HTTP path completed in approximately one minute, using 298 strong noteheads across 23 measure regions, with three verses and a chorus. Its final Amen has insufficient note evidence and is explicitly marked for review. The upload and raw native outputs remain outside the repository. This single-image regression check does not establish general chord-transcription accuracy. Automated checks validate structure, representative recognized phrases, and uncertainty handling; they do not verify every proposed chord against the composer’s harmony.
