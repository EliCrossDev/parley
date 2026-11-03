# Parley — live, two-way conversation translation

Two people, two languages, one screen. Static site + installable web app (PWA). No build step.

## Files
- `index.html` / `landing.css` / `landing.js` — landing page (Three.js voxel hero, looping demo, pricing, credits)
- `app.html` / `app.css` / `app.js` — the app (live translation, history + playback, profile)
- `styles.css` — shared design tokens (black / white / volt yellow `#d9ff3b` / electric blue `#2f6bff`)
- `manifest.webmanifest`, `sw.js`, `icon*.{svg,png}` — PWA install + offline shell
- `vercel.json` — clean URLs, microphone permission header

## Deploy (Vercel)
```
npm i -g vercel
cd parley
vercel --prod
```
Or drag the folder onto vercel.com/new. Any static host works (Netlify, Cloudflare Pages, GitHub Pages). It must be served over **HTTPS** — browsers only allow the microphone on secure origins.

## How it works
- **Speech → text**: the browser's Web Speech API (Chrome, Edge, Safari). Firefox has no support yet.
- **Who's talking**: Parley listens in the expected speaker's language, then decides the speaker by (1) a manual tap on a person's chip, (2) script detection when the two languages use different alphabets (e.g. Thai vs English), (3) the translator's language detection, (4) turn-taking. After each line it flips to expect the other person.
- **Translation**: pluggable. Default chain is Google's public `translate_a/single` endpoint → MyMemory. In the profile you can point it at your own **LibreTranslate** server for private, unlimited use.
- **Storage**: prefs in `localStorage`, conversations + audio in IndexedDB. Free keeps the 5 most recent; `prefs.pro = true` lifts the limit (wire this to your payment flow).
- **Preview the live screen without a mic**: `app.html?demo=1`

## Talk-back voices
- **Studio voices** = [Kokoro-82M](https://github.com/hexgrad/kokoro) (Apache-2.0) running fully in the browser through [kokoro-js](https://github.com/hexgrad/kokoro) + ONNX Runtime (WebGPU when available, WASM otherwise). ~90 MB downloaded once, cached by the browser, then offline. Languages: EN, ES, PT, FR, IT, HI, JA, ZH. 26 voices exposed in Profile → Talk-back voice.
- **Device voices** = the phone's built-in speech synthesis. Instant, any language.
- Languages Kokoro doesn't cover (DE, KO, TH, AR, …) fall back to device voices automatically.
- The speaker icon on the live screen toggles talk-back on/off instantly.

## Latency
- Interim transcript is translated every ~300 ms, so the translated line is already on screen (dimmed) while the person is still talking; the final pass reuses it.
- **Natural endpointing**: once the words stop changing, Parley watches the mic level. It ends the line after ~0.95 s of real silence, or ~1.5 s when the sentence is clearly unfinished (trailing "and", "pero", "que", a comma, fewer than 3 words). If the same person resumes within 2.5 s, the new words extend their last bubble instead of starting a new one. The mic stays in their language for ~2 s before expecting the other person.
- Speaker is decided from the first two words (offline word list → translator detection), and the mic switches language mid-sentence if needed.

## Production notes
- The Google endpoint is unofficial and can rate-limit. For a launch, run LibreTranslate (Docker, one command) and set it as the engine, or proxy translations through a tiny serverless function so you can swap providers without shipping an update.
- For a self-hosted speech engine (better accuracy, works on Firefox, no Google), stream audio to a server running whisper.cpp or Handy's model and return text over a WebSocket. The front end only needs `handleFinal(text)` fed from that socket.
- Safari records audio as `audio/mp4`; Chrome as `audio/webm`. Playback uses whatever was recorded, so each device plays its own recordings fine.

## Credits
Handy (cjpais), whisper.cpp (ggerganov), LibreTranslate, Argos Translate. Linked in the app and on the landing page.
