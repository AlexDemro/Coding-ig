# FretMate

Guitar practice tools for **fretmate.online**: tuner, chord library, capo converter, photo reader, metronome, and strumming patterns. The Song chord maker/search feature remains removed.

## Run locally

Use Node.js 22 or newer:

```cmd
npm install
npm start
```

Open `http://localhost:3000`. To replace an older running copy, stop it with Ctrl+C, then start from the newly extracted folder. If the port is occupied, `set PORT=3001` in Windows Command Prompt selects another port. Leave the terminal open.

## Two photo-reading paths

Upload a clear JPG, PNG, or WebP under 15 MB. There is no text editor and the output is a downloadable PNG image.

- **Printed lyric/chord charts:** browser-based Tesseract OCR preserves the existing chord names and words. This path also works without a notation backend. Initial OCR/library/model downloads need internet access.
- **Staff notation:** an installed Audiveris engine reads notes, rests, voices, key/time signatures, and lyric syllables into MusicXML. FretMate then builds a **suggested** guitar accompaniment. Recognized lyric syllables receive chords above the words; instrumental scores receive a measure-and-beat chord guide without invented lyrics.

The staff path is real server-side recognition, not text OCR, a song catalog, or a paid lyrics API. It needs installation on the computer/server running Node. A scale or melody does not uniquely determine the original chords: the output is an arrangement, not a guaranteed transcription of the composer's harmony. Recognition can misread notes, rhythms, lyrics, and verses. Use high-resolution original scans and check the image against the score. Repeats are presented in printed order, not expanded into performance order.

The provided small Minuet preview may not retain enough detail for accurate recognition even after enlargement. The attached Blessed Assurance and Minuet images have not been processed directly by the executable because the chat provides inline previews rather than readable local image files. Independent published score fixtures exercise the real engine.

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
- **Strumming:** four patterns with synthesized plucked-string down/up strokes and G/D/Em/C practice chords.

Audio stops on navigation or hiding the page. The header and browser tab share the same green natural-sign (♮) SVG, with PNG, ICO and Apple-touch alternatives. Versioned icon URLs help invalidate the old F icon. Browser caches may still need a hard refresh.

## Validation

`npm test` runs 44 tests covering existing music tools plus MusicXML pitch/rhythm/voice parsing, chord arrangement, lyric syllables, instrumental output, MXL ZIP parsing, invalid XML, image signatures, and missing-engine behavior.

`npm run test:browser` requires Chromium and Node.js 22+. Start the server on port 3001 or set `SITE_URL` to its address; `CHROMIUM_BIN` chooses another executable. Tests cover generated Web Audio input, navigation, branding, printed-chart PNG exports, failure/replacement handling, and a fixture notation-result image. OCR/native API responses are mocked in UI tests.

Separately, real Audiveris CLI and real HTTP image-upload recognition have run on official Allegretto, Hove and Ave Maria examples. The vocal example produced recognized lyric syllables and suggested chords; instrumental examples produced measure-based guides. Tests caught and fixed a legacy-language-model incompatibility and missing exported part timing metadata. Real recognition still produced some misspellings and uncertain note timing, so these results are not proof of transcription accuracy. The model incompatibility is now treated as a setup error rather than silently labeling a vocal score instrumental. This validates the installed Linux pipeline, not the exact chat images or Windows/Hostinger deployment. Physical microphones, actual iPhones, and broad photo-recognition accuracy remain unverified.

To reproduce a real native-engine check against your own image, keep the server running and use `npm run test:omr -- path/to/score.png`. Add `--lyrics` for a vocal score to require recognized lyric syllables. Unlike the UI fixture tests, this uploads a real image and runs the installed Audiveris engine. It verifies usable data, not the correctness of every recognized note or inferred chord.
